// 筆記引擎：本機優先的資料操作＋與雲端同步（03 §4、§5）。不碰 DOM，可在 Node 測試。
//
// 不變式：
// - UI 只讀寫這裡（→ IndexedDB）；雲端是同步與備份層。
// - 每台裝置只寫自己的分片檔（單一寫入者），讀取時合併所有裝置的版本。
// - 本機修改在「確認上傳成功」前不會從 outbox 移除。
// - 有衝突的筆記不能一般編輯，必須先選定版本（Codex 審查 #3）。

import { AdapterError, deviceFileName, shardFileName, type RemoteFile, type SyncAdapter } from "../adapter/types"
import { HlcClock, parseHlc } from "../model/hlc"
import { newDeviceId, newNoteId } from "../model/ids"
import {
  APP_TAG,
  SCHEMA_VERSION,
  chapterAnchor,
  extractLinks,
  shardOf,
  validateRecord,
  validateShard,
  type NoteRecord,
  type ShardFile,
} from "../model/record"
import { vvDominatedBy, vvLeq, vvMax, vvIncrement } from "../model/vv"
import { nextVv, pruneOwn, resolveAll, type Resolved } from "../merge/merge"
import type { NotesStore, RemoteShardCache } from "../store/db"

export type ErrorKind = "cloud-wiped" | "storage-full" | "admin" | "newer-schema" | "circuit-open" | "other"

export type EngineStatus =
  | { kind: "local-only" }
  | { kind: "needs-reconnect" }
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "ready"; lastSyncAt: number }
  | { kind: "offline"; since: number }
  | { kind: "error"; error: ErrorKind; message: string }

export class ConflictPendingError extends Error {
  constructor(readonly id: string) {
    super("這則筆記有兩個版本，請先選定要保留哪一個")
    this.name = "ConflictPendingError"
  }
}

export interface NoteInput {
  book: string
  chapter: number
  verseStart: number | null
  verseEnd: number | null
  title: string
  body: string
  tags: string[]
}

export interface EngineOptions {
  store: NotesStore
  now?: () => number
  maxWritesPerMinute?: number
  appVersion?: string
  deviceLabel?: string
}

interface OwnFile {
  id: string
  version: string
}

type Listener = () => void

const CAS_RETRIES = 3

export class NotesEngine {
  deviceId: string
  private readonly store: NotesStore
  private readonly now: () => number
  private readonly maxWritesPerMinute: number
  private readonly appVersion: string
  private readonly deviceLabel: string

  private own = new Map<string, NoteRecord>()
  private remote = new Map<string, RemoteShardCache>()
  private resolvedMap = new Map<string, Resolved>()
  private clock: HlcClock
  private adapter: SyncAdapter | null = null
  private hasToken: () => boolean = () => false
  private statusValue: EngineStatus = { kind: "local-only" }
  private changeListeners = new Set<Listener>()
  private statusListeners = new Set<Listener>()
  private localWriteListeners = new Set<Listener>()
  private chain: Promise<unknown> = Promise.resolve()
  private writeTimes: number[] = []
  private consecutiveFailures = 0
  private circuitUntil = 0
  lastPullAt = 0
  /** 每次從雲端收到其他裝置的新資料就 +1（排程器據此調整輪詢間隔）。 */
  remoteRevision = 0

  private constructor(store: NotesStore, deviceId: string, opts: EngineOptions) {
    this.store = store
    this.deviceId = deviceId
    this.now = opts.now ?? Date.now
    this.maxWritesPerMinute = opts.maxWritesPerMinute ?? 6
    this.appVersion = opts.appVersion ?? "0"
    this.deviceLabel = opts.deviceLabel ?? ""
    this.clock = new HlcClock(deviceId, null, this.now)
  }

  static async create(opts: EngineOptions): Promise<NotesEngine> {
    let deviceId = await opts.store.getMeta<string>("deviceId")
    if (!deviceId) {
      deviceId = newDeviceId()
      await opts.store.setMeta("deviceId", deviceId)
    }
    const engine = new NotesEngine(opts.store, deviceId, opts)
    await engine.reloadFromStore()
    // 啟動時從所有已知版本與上次保存的值恢復時鐘（Codex 審查 #4）
    const hlcLast = await opts.store.getMeta<string>("hlcLast")
    if (hlcLast) engine.clock.observe(hlcLast)
    return engine
  }

  // ---------- 事件 ----------

  onChange(fn: Listener): () => void {
    this.changeListeners.add(fn)
    return () => this.changeListeners.delete(fn)
  }
  onStatus(fn: Listener): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }
  /** 本機有新修改（排程器據此安排上傳、通知其他分頁）。 */
  onLocalWrite(fn: Listener): () => void {
    this.localWriteListeners.add(fn)
    return () => this.localWriteListeners.delete(fn)
  }
  private emit(set: Set<Listener>) {
    for (const fn of set) {
      try {
        fn()
      } catch (e) {
        console.error("[personal-notes] listener error", e)
      }
    }
  }

  get status(): EngineStatus {
    return this.statusValue
  }
  private setStatus(s: EngineStatus) {
    this.statusValue = s
    this.emit(this.statusListeners)
  }

  // ---------- 讀取 ----------

  /** 從 IndexedDB 重新載入（啟動時、其他分頁通知有變更時）。 */
  async reloadFromStore(): Promise<void> {
    const [own, remote, deviceId] = await Promise.all([
      this.store.getAllOwn(),
      this.store.getAllRemote(),
      this.store.getMeta<string>("deviceId"),
    ])
    if (deviceId && deviceId !== this.deviceId) {
      this.deviceId = deviceId
      this.clock = new HlcClock(deviceId, this.clock.current(), this.now)
    }
    this.own = new Map(own.map((r) => [r.id, r]))
    this.remote = new Map(remote.map((c) => [c.fileId, c]))
    for (const r of own) this.clock.observe(r.hlc)
    for (const c of remote) for (const r of c.records) this.clock.observe(r.hlc)
    this.rebuild()
  }

  private allVersions(): NoteRecord[] {
    const out: NoteRecord[] = [...this.own.values()]
    for (const c of this.remote.values()) out.push(...c.records)
    return out
  }

  private rebuild(): void {
    this.resolvedMap = resolveAll(this.allVersions())
    this.emit(this.changeListeners)
  }

  get(id: string): Resolved | undefined {
    return this.resolvedMap.get(id)
  }

  /** 畫面上要顯示的筆記：勝出版本未刪除，或有待處理的衝突。 */
  visible(): Resolved[] {
    return [...this.resolvedMap.values()].filter((r) => !r.winner.deleted || r.conflicts.length > 0)
  }

  forChapter(book: string, chapter: number): Resolved[] {
    return this.visible()
      .filter((r) => r.winner.anchor.book === book && r.winner.anchor.chapter === chapter)
      .sort((a, b) => {
        const va = a.winner.anchor.verseStart ?? 0
        const vb = b.winner.anchor.verseStart ?? 0
        return va - vb || a.winner.createdAt.localeCompare(b.winner.createdAt)
      })
  }

  async pendingShards(): Promise<number> {
    return (await this.store.getOutbox()).length
  }

  // ---------- 本機修改 ----------

  private stamp(hlc: string): number {
    return parseHlc(hlc)?.wall ?? this.now()
  }

  private iso(): string {
    return new Date(this.now()).toISOString()
  }

  private sanitize(input: Partial<NoteInput>) {
    const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean)
    return { ...input, tags: [...new Set(tags)] }
  }

  async create(input: NoteInput): Promise<NoteRecord> {
    const clean = this.sanitize(input) as NoteInput
    const hlc = this.clock.tick()
    const now = this.iso()
    const record: NoteRecord = {
      id: newNoteId(this.now()),
      type: "note",
      anchor: chapterAnchor(clean.book, clean.chapter, clean.verseStart, clean.verseEnd),
      title: clean.title,
      body: clean.body,
      tags: clean.tags,
      links: extractLinks(clean.body),
      createdAt: now,
      updatedAt: now,
      hlc,
      vv: nextVv(null, this.deviceId, this.stamp(hlc)),
      author: this.deviceId,
      deleted: false,
    }
    await this.commit([{ record, expectedHlc: null, previous: undefined }])
    return record
  }

  async update(id: string, patch: Partial<NoteInput>): Promise<NoteRecord> {
    return this.withCas(async () => {
      const r = this.mustGet(id)
      if (r.conflicts.length > 0) throw new ConflictPendingError(id)
      const base = r.winner
      const clean = this.sanitize({ tags: base.tags, ...patch })
      const book = clean.book ?? base.anchor.book ?? "_FREE"
      const chapter = clean.chapter ?? base.anchor.chapter ?? 0
      const verseStart = clean.verseStart !== undefined ? clean.verseStart : base.anchor.verseStart
      const verseEnd = clean.verseEnd !== undefined ? clean.verseEnd : base.anchor.verseEnd
      const body = clean.body ?? base.body
      const hlc = this.clock.tick()
      const record: NoteRecord = {
        ...base,
        anchor: { ...base.anchor, ...chapterAnchor(book, chapter, verseStart, verseEnd) },
        title: clean.title ?? base.title,
        body,
        tags: clean.tags ?? base.tags,
        links: extractLinks(body),
        updatedAt: this.iso(),
        hlc,
        vv: nextVv(r, this.deviceId, this.stamp(hlc)),
        author: this.deviceId,
        deleted: false,
      }
      return this.commitOne(record)
    })
  }

  async remove(id: string): Promise<void> {
    await this.withCas(async () => {
      const r = this.mustGet(id)
      if (r.conflicts.length > 0) throw new ConflictPendingError(id)
      const hlc = this.clock.tick()
      const record: NoteRecord = {
        ...r.winner,
        title: "",
        body: "",
        tags: [],
        links: [],
        updatedAt: this.iso(),
        hlc,
        vv: nextVv(r, this.deviceId, this.stamp(hlc)),
        author: this.deviceId,
        deleted: true,
      }
      return this.commitOne(record)
    })
  }

  /**
   * 解決衝突：keep＝保留指定 hlc 的版本；keepBoth＝保留目前顯示的版本，並把其他版本另存為新筆記。
   * 新版本以前緣最大值為基礎，會一次取代所有衝突版本。
   */
  async resolveConflict(id: string, choice: { keep: string } | { keepBoth: true }): Promise<void> {
    await this.withCas(async () => {
      const r = this.mustGet(id)
      const versions = [r.winner, ...r.conflicts]
      const chosen = "keep" in choice ? versions.find((v) => v.hlc === choice.keep) : r.winner
      if (!chosen) throw new Error("找不到要保留的版本")
      const hlc = this.clock.tick()
      const resolution: NoteRecord = {
        ...chosen,
        updatedAt: this.iso(),
        hlc,
        vv: nextVv(r, this.deviceId, this.stamp(hlc)),
        author: this.deviceId,
      }
      const copies: NoteRecord[] = []
      if ("keepBoth" in choice) {
        for (const c of r.conflicts) {
          if (c.deleted) continue
          const chlc = this.clock.tick()
          copies.push({
            ...c,
            id: newNoteId(this.now()),
            title: `${c.title || "筆記"}（另一個版本）`,
            createdAt: this.iso(),
            updatedAt: this.iso(),
            hlc: chlc,
            vv: nextVv(null, this.deviceId, this.stamp(chlc)),
            author: this.deviceId,
          })
        }
      }
      await this.commit([
        { record: resolution, expectedHlc: this.own.get(id)?.hlc ?? null, previous: this.own.get(id) },
        ...copies.map((c) => ({ record: c, expectedHlc: null, previous: undefined })),
      ])
      return resolution
    })
  }

  private mustGet(id: string): Resolved {
    const r = this.resolvedMap.get(id)
    if (!r) throw new Error(`找不到筆記 ${id}`)
    return r
  }

  private async commitOne(record: NoteRecord): Promise<NoteRecord> {
    const previous = this.own.get(record.id)
    await this.commit([{ record, expectedHlc: previous?.hlc ?? null, previous }])
    return record
  }

  private async commit(entries: { record: NoteRecord; expectedHlc: string | null; previous: NoteRecord | undefined }[]) {
    // 換書卷時，舊分片也要重寫（把舊版本移出）
    const shards = entries.flatMap((e) => [shardOf(e.record), ...(e.previous ? [shardOf(e.previous)] : [])])
    const ok = await this.store.saveOwnIfUnchanged(
      entries.map((e) => ({ record: e.record, expectedHlc: e.expectedHlc })),
      shards,
      this.now(),
    )
    if (!ok) throw new CasConflict()
    for (const e of entries) this.own.set(e.record.id, e.record)
    await this.store.setMeta("hlcLast", this.clock.current())
    this.rebuild()
    this.emit(this.localWriteListeners)
  }

  /** 同裝置其他分頁先改了同一則 → 重新載入後重做一次（最多 3 次）。 */
  private async withCas<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await fn()
      } catch (e) {
        if (!(e instanceof CasConflict) || i >= CAS_RETRIES) throw e
        await this.reloadFromStore()
      }
    }
  }

  // ---------- 匯出與匯入 ----------

  exportData(): { app: string; schema: number; exportedAt: string; records: NoteRecord[] } {
    const records: NoteRecord[] = []
    for (const r of this.resolvedMap.values()) {
      if (!r.winner.deleted) records.push(r.winner)
      records.push(...r.conflicts.filter((c) => !c.deleted))
    }
    return { app: APP_TAG, schema: SCHEMA_VERSION, exportedAt: this.iso(), records }
  }

  /**
   * 匯入（走正常合併規則，重複匯入無害）：
   * - 新筆記 → 原樣加入；
   * - 已有且匯入版本已被看過 → 略過；
   * - 匯入版本較新（看過目前所有版本）→ 成為新版本；
   * - 同時修改 → 另存為新筆記，標題加「（匯入）」，不覆蓋現有內容。
   */
  async importData(data: unknown): Promise<{ added: number; updated: number; copied: number; skipped: number; invalid: number }> {
    const list = (data as { records?: unknown[] })?.records
    if (!Array.isArray(list)) throw new Error("不是本站匯出的筆記檔")
    const result = { added: 0, updated: 0, copied: 0, skipped: 0, invalid: 0 }
    const entries: { record: NoteRecord; expectedHlc: string | null; previous: NoteRecord | undefined }[] = []
    for (const raw of list) {
      const r = validateRecord(raw)
      if (!r) {
        result.invalid++
        continue
      }
      this.clock.observe(r.hlc)
      const current = this.resolvedMap.get(r.id)
      if (!current) {
        entries.push({ record: r, expectedHlc: this.own.get(r.id)?.hlc ?? null, previous: this.own.get(r.id) })
        result.added++
        continue
      }
      const front = [current.winner, ...current.conflicts]
      if (front.some((v) => vvLeq(r.vv, v.vv))) {
        result.skipped++
        continue
      }
      const hlc = this.clock.tick()
      if (front.every((v) => vvDominatedBy(v.vv, r.vv))) {
        const vv = vvMax(current.frontierVv, r.vv)
        entries.push({
          record: { ...r, hlc, vv: { ...vvIncrement(vv, this.deviceId), [this.deviceId]: Math.max((vv[this.deviceId] ?? 0) + 1, this.stamp(hlc)) }, author: this.deviceId, updatedAt: this.iso() },
          expectedHlc: this.own.get(r.id)?.hlc ?? null,
          previous: this.own.get(r.id),
        })
        result.updated++
      } else {
        entries.push({
          record: {
            ...r,
            id: newNoteId(this.now()),
            title: `${r.title || "筆記"}（匯入）`,
            hlc,
            vv: nextVv(null, this.deviceId, this.stamp(hlc)),
            author: this.deviceId,
          },
          expectedHlc: null,
          previous: undefined,
        })
        result.copied++
      }
    }
    if (entries.length > 0) await this.withCas(() => this.commit(entries))
    return result
  }

  /** 把未登入時寫的匿名筆記加入此帳號（D-05）。 */
  async adoptRecords(records: NoteRecord[]): Promise<number> {
    const entries = records
      .filter((r) => !this.resolvedMap.has(r.id))
      .map((r) => ({ record: r, expectedHlc: this.own.get(r.id)?.hlc ?? null, previous: this.own.get(r.id) }))
    if (entries.length > 0) {
      for (const e of entries) this.clock.observe(e.record.hlc)
      await this.withCas(() => this.commit(entries))
    }
    return entries.length
  }

  // ---------- 同步 ----------

  /** 設定雲端後端；adapter 為 null 代表僅本機模式。 */
  setAdapter(adapter: SyncAdapter | null, hasToken: () => boolean = () => true): void {
    this.adapter = adapter
    this.hasToken = hasToken
    if (!adapter) this.setStatus({ kind: "local-only" })
    else this.setStatus(hasToken() ? { kind: "idle" } : { kind: "needs-reconnect" })
  }

  /** 授權狀態改變時由外部通知（取得新 token、token 過期）。 */
  authChanged(): void {
    if (!this.adapter) return
    if (!this.hasToken()) this.setStatus({ kind: "needs-reconnect" })
    else if (this.statusValue.kind === "needs-reconnect") this.setStatus({ kind: "idle" })
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn)
    this.chain = run.catch(() => undefined)
    return run
  }

  /** 拉取＋上傳。失敗不丟例外，結果反映在 status。 */
  sync(): Promise<void> {
    return this.exclusive(async () => {
      if (!this.adapter) return
      if (!this.hasToken()) {
        this.setStatus({ kind: "needs-reconnect" })
        return
      }
      if (this.now() < this.circuitUntil) return
      if ((await this.store.getMeta<boolean>("cloudWiped")) === true) {
        this.setStatus({ kind: "error", error: "cloud-wiped", message: "雲端的筆記資料似乎被刪除了" })
        return
      }
      this.setStatus({ kind: "syncing" })
      try {
        // 先從 IndexedDB 重新載入：其他分頁可能剛寫入（多分頁時，排程器另用 Web Locks 確保一次只有一個分頁同步）
        await this.reloadFromStore()
        const bootstrapped = await this.store.getMeta<boolean>("bootstrapped")
        if (bootstrapped) await this.pullInner()
        else await this.bootstrapInner()
        if (this.statusValue.kind === "error") return
        await this.pushInner()
        if ((this.statusValue.kind as string) === "error") return
        this.consecutiveFailures = 0
        this.setStatus({ kind: "ready", lastSyncAt: this.now() })
      } catch (e) {
        this.handleError(e)
      }
    })
  }

  /** 只上傳（排程器在輸入停頓後呼叫）。 */
  push(): Promise<void> {
    return this.exclusive(async () => {
      if (!this.adapter || !this.hasToken() || this.now() < this.circuitUntil) return
      if (!(await this.store.getMeta<boolean>("bootstrapped"))) return
      if ((await this.store.getMeta<boolean>("cloudWiped")) === true) return
      try {
        await this.reloadFromStore()
        await this.pushInner()
        if (this.statusValue.kind !== "error") {
          this.consecutiveFailures = 0
          this.setStatus({ kind: "ready", lastSyncAt: this.now() })
        }
      } catch (e) {
        this.handleError(e)
      }
    })
  }

  /**
   * 「先同步再編輯」（D-03）：距上次拉取超過 maxAgeMs 就先同步，最多等 timeoutMs。
   * 回傳 local（未登入）、no-token（需重新連線）、fresh（可編輯）、failed（顯示離線提示）。
   */
  async ensureFresh(maxAgeMs = 30_000, timeoutMs = 8_000): Promise<"local" | "no-token" | "fresh" | "failed"> {
    if (!this.adapter) return "local"
    if (!this.hasToken()) return "no-token"
    if (this.statusValue.kind === "ready" && this.now() - this.lastPullAt < maxAgeMs) return "fresh"
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs)
    })
    const r = await Promise.race([this.sync().then(() => "done" as const), timeout])
    if (timer) clearTimeout(timer)
    if (r === "timeout") return "failed"
    const kind = this.statusValue.kind as string
    if (kind === "ready") return "fresh"
    if (kind === "needs-reconnect") return "no-token"
    return "failed"
  }

  private handleError(e: unknown): void {
    const err = e instanceof AdapterError ? e : null
    if (err?.kind === "auth") {
      this.setStatus({ kind: "needs-reconnect" })
      return
    }
    if (err?.kind === "storageFull") {
      this.setStatus({ kind: "error", error: "storage-full", message: "你的 Google 雲端硬碟空間已滿，筆記暫時只存在這台裝置" })
      return
    }
    if (err?.kind === "admin") {
      this.setStatus({ kind: "error", error: "admin", message: "此帳號的管理員不允許這個網站存取雲端硬碟，筆記只會存在這台裝置" })
      return
    }
    if (e instanceof NewerSchemaError) {
      this.setStatus({ kind: "error", error: "newer-schema", message: "雲端的筆記是用較新版本的網站寫的，請重新整理網頁" })
      return
    }
    this.consecutiveFailures++
    if (this.consecutiveFailures >= 5) {
      this.circuitUntil = this.now() + 5 * 60_000
      this.setStatus({ kind: "error", error: "circuit-open", message: "同步連續失敗，5 分鐘後再自動重試" })
      return
    }
    if (err?.kind === "network" || err?.kind === "rateLimit" || err?.kind === "server") {
      this.setStatus({ kind: "offline", since: this.now() })
      return
    }
    console.error("[personal-notes] sync error", e)
    this.setStatus({ kind: "error", error: "other", message: e instanceof Error ? e.message : String(e) })
  }

  private async ownFiles(): Promise<Record<string, OwnFile>> {
    return (await this.store.getMeta<Record<string, OwnFile>>("ownFiles")) ?? {}
  }

  private async readRemote(file: RemoteFile): Promise<boolean> {
    const raw = await this.adapter!.read(file.id)
    const v = validateShard(raw)
    if (!v.ok) {
      if (v.reason === "newer-schema") throw new NewerSchemaError()
      return false
    }
    const cache: RemoteShardCache = {
      fileId: file.id,
      device: file.device,
      shard: v.shard.shard,
      version: file.version,
      records: v.shard.records,
    }
    for (const r of cache.records) this.clock.observe(r.hlc)
    await this.store.putRemote(cache)
    this.remote.set(file.id, cache)
    return true
  }

  /**
   * 有人用本裝置 ID 寫入了雲端（從舊備份還原、複製了瀏覽器設定檔…）→ 本裝置換一個新 ID，
   * 舊 ID 的檔案改當成別台裝置的資料讀取，避免互相覆蓋（Codex 審查 #5）。
   */
  private async forkDevice(): Promise<void> {
    const id = newDeviceId()
    this.deviceId = id
    this.clock = new HlcClock(id, this.clock.current(), this.now)
    await this.store.setMeta("deviceId", id)
    await this.store.setMeta("ownFiles", {})
    await this.store.setMeta("deviceFileId", null)
    const shards = [...new Set([...this.own.values()].map(shardOf))]
    if (shards.length > 0) await this.store.markDirty(shards, this.now())
  }

  /**
   * 雲端出現「本裝置 ID」的檔案但不在 ownFiles：若它就是我們先前建立但回應遺失的檔案（ID 等於 pendingId），
   * 直接認領；否則才視為別人用了同一個裝置 ID → 換新 ID。回傳 true 代表已認領。
   */
  private async adoptPending(file: RemoteFile, ownFiles: Record<string, OwnFile>): Promise<boolean> {
    const key = `pendingId:${file.name}`
    const pending = await this.store.getMeta<string>(key)
    if (pending !== file.id) return false
    if (file.kind === "shard" && file.shard) {
      ownFiles[file.shard] = { id: file.id, version: file.version }
      await this.store.setMeta("ownFiles", ownFiles)
    } else if (file.kind === "device") {
      await this.store.setMeta("deviceFileId", file.id)
    }
    await this.store.setMeta(key, null)
    return true
  }

  private async bootstrapInner(): Promise<void> {
    const adapter = this.adapter!
    const token = await adapter.startToken()
    const files = await adapter.listFiles()
    const ownFiles = await this.ownFiles()
    const known = new Set(Object.values(ownFiles).map((f) => f.id))
    const deviceFileId = await this.store.getMeta<string | null>("deviceFileId")
    if (deviceFileId) known.add(deviceFileId)
    let forked = false
    for (const f of files) {
      if (forked || f.device !== this.deviceId || known.has(f.id)) continue
      if (await this.adoptPending(f, ownFiles)) continue
      await this.forkDevice()
      forked = true
    }

    const everSynced = await this.store.getMeta<boolean>("everSynced")
    if (everSynced && files.length === 0 && this.own.size > 0) {
      await this.store.setMeta("cloudWiped", true)
      this.setStatus({ kind: "error", error: "cloud-wiped", message: "雲端的筆記資料似乎被刪除了" })
      return
    }
    for (const f of files) {
      if (f.kind !== "shard" || f.device === this.deviceId) continue
      if (this.remote.get(f.id)?.version === f.version) continue
      await this.readRemote(f)
    }
    await this.store.setMeta("startPageToken", token)
    await this.store.setMeta("bootstrapped", true)
    await this.store.setMeta("everSynced", true)
    this.lastPullAt = this.now()
    this.rebuild()
  }

  private async pullInner(): Promise<void> {
    const adapter = this.adapter!
    const token = await this.store.getMeta<string>("startPageToken")
    if (!token) return this.bootstrapInner()
    const cs = await adapter.changes(token)
    const ownFiles = await this.ownFiles()
    const ownById = new Map(Object.values(ownFiles).map((f) => [f.id, f]))
    let changed = false
    let forked = false
    const deviceFileId = await this.store.getMeta<string | null>("deviceFileId")
    for (const f of cs.files) {
      if (f.device === this.deviceId && !forked) {
        if (f.kind === "device" && (f.id === deviceFileId || (await this.adoptPending(f, ownFiles)))) continue
        const mine = ownById.get(f.id)
        if (mine && mine.version === f.version) continue
        if (!mine && (await this.adoptPending(f, ownFiles))) continue
        await this.forkDevice()
        forked = true
      }
      if (f.kind !== "shard") continue
      if (this.remote.get(f.id)?.version === f.version) continue
      if (await this.readRemote(f)) changed = true
    }
    if (cs.removed.some((id) => ownById.has(id))) {
      await this.store.setMeta("cloudWiped", true)
      await this.store.setMeta("startPageToken", cs.token)
      this.setStatus({ kind: "error", error: "cloud-wiped", message: "雲端的筆記資料似乎被刪除了" })
      return
    }
    // 其他裝置的檔案被移除：保守起見保留本機快取（03 §4.2）
    await this.store.setMeta("startPageToken", cs.token)
    this.lastPullAt = this.now()
    if (changed) this.remoteRevision++
    if (changed || forked) this.rebuild()
  }

  private allowWrite(): boolean {
    const now = this.now()
    this.writeTimes = this.writeTimes.filter((t) => now - t < 60_000)
    return this.writeTimes.length < this.maxWritesPerMinute
  }

  private async takeId(): Promise<string> {
    let pool = (await this.store.getMeta<string[]>("idPool")) ?? []
    if (pool.length === 0) pool = await this.adapter!.generateIds(10)
    const id = pool.shift()!
    await this.store.setMeta("idPool", pool)
    return id
  }

  private async writeFile(existing: OwnFile | undefined, meta: Parameters<SyncAdapter["create"]>[1], body: unknown): Promise<RemoteFile | "wiped"> {
    const adapter = this.adapter!
    if (existing) {
      try {
        return await adapter.update(existing.id, body)
      } catch (e) {
        if (e instanceof AdapterError && e.kind === "notFound") return "wiped"
        throw e
      }
    }
    // 建立前先把要用的 ID 記下來；若建立「其實成功但回應遺失」，重試時沿用同一個 ID，
    // 會得到 409 fileIdInUse → 改用更新，不會產生重複檔（D-25）。
    const pendingKey = `pendingId:${meta.name}`
    let id = await this.store.getMeta<string>(pendingKey)
    if (!id) {
      id = await this.takeId()
      await this.store.setMeta(pendingKey, id)
    }
    let result: RemoteFile
    try {
      result = await adapter.create(id, meta, body)
    } catch (e) {
      if (!(e instanceof AdapterError && e.kind === "fileIdInUse")) throw e
      result = await adapter.update(id, body)
    }
    await this.store.setMeta(pendingKey, null)
    return result
  }

  private async pushInner(): Promise<void> {
    const outbox = await this.store.getOutbox()
    const ownFiles = await this.ownFiles()
    const remoteRecords = [...this.remote.values()].flatMap((c) => c.records)
    for (const entry of outbox) {
      if (!this.allowWrite()) break
      const shard = entry.shard
      const records = [...this.own.values()].filter((r) => shardOf(r) === shard)
      const ids = new Set(records.map((r) => r.id))
      const kept = pruneOwn(records, remoteRecords.filter((r) => ids.has(r.id)), this.now())
      const pruned = records.filter((r) => !kept.includes(r))
      const existing = ownFiles[shard]
      if (kept.length === 0 && !existing) {
        await this.store.clearDirty(shard, entry.dirtyAt)
        continue
      }
      const body: ShardFile = {
        schema: SCHEMA_VERSION,
        kind: "shard",
        app: APP_TAG,
        shard,
        device: this.deviceId,
        writtenAt: this.iso(),
        records: kept,
      }
      this.writeTimes.push(this.now())
      const result = await this.writeFile(
        existing,
        { name: shardFileName(shard, this.deviceId), kind: "shard", shard, device: this.deviceId },
        body,
      )
      if (result === "wiped") {
        await this.store.setMeta("cloudWiped", true)
        this.setStatus({ kind: "error", error: "cloud-wiped", message: "雲端的筆記資料似乎被刪除了" })
        return
      }
      ownFiles[shard] = { id: result.id, version: result.version }
      await this.store.setMeta("ownFiles", ownFiles)
      if (pruned.length > 0) {
        const deleted = await this.store.deleteOwnIfUnchanged(pruned.map((r) => ({ id: r.id, hlc: r.hlc })))
        for (const id of deleted) this.own.delete(id)
        if (deleted.length > 0) this.rebuild()
      }
      await this.store.clearDirty(shard, entry.dirtyAt)
    }
    await this.writeDeviceFile()
  }

  /** 裝置登記檔（03 §2）：首次建立，之後每天最多更新一次。 */
  private async writeDeviceFile(): Promise<void> {
    const fileId = await this.store.getMeta<string | null>("deviceFileId")
    const updatedAt = (await this.store.getMeta<number>("deviceFileUpdatedAt")) ?? 0
    if (fileId && this.now() - updatedAt < 24 * 60 * 60 * 1000) return
    if (!this.allowWrite()) return
    const body = { kind: "device", app: APP_TAG, device: this.deviceId, label: this.deviceLabel, appVersion: this.appVersion, lastSeen: this.iso() }
    this.writeTimes.push(this.now())
    const result = await this.writeFile(
      fileId ? { id: fileId, version: "" } : undefined,
      { name: deviceFileName(this.deviceId), kind: "device", shard: null, device: this.deviceId },
      body,
    )
    if (result === "wiped") return
    await this.store.setMeta("deviceFileId", result.id)
    await this.store.setMeta("deviceFileUpdatedAt", this.now())
  }

  /** 使用者確認「用這台裝置的資料重新上傳」（雲端被清空後）。 */
  async reuploadAfterWipe(): Promise<void> {
    await this.store.setMeta("cloudWiped", false)
    await this.store.setMeta("everSynced", false)
    await this.store.setMeta("ownFiles", {})
    await this.store.setMeta("deviceFileId", null)
    await this.store.setMeta("bootstrapped", false)
    await this.store.setMeta("startPageToken", null)
    // 其他裝置的快取版本也由本裝置重新保存，確保不遺失
    const remoteVersions = [...this.remote.values()].flatMap((c) => c.records)
    const adopt = remoteVersions.filter((r) => !this.own.has(r.id) && this.resolvedMap.get(r.id)?.winner.hlc === r.hlc)
    for (const r of adopt) this.own.set(r.id, r)
    if (adopt.length > 0) await this.store.saveOwn(adopt, adopt.map(shardOf), this.now())
    const shards = [...new Set([...this.own.values()].map(shardOf))]
    if (shards.length > 0) await this.store.markDirty(shards, this.now())
    this.rebuild()
    await this.sync()
  }

  /** 刪除雲端上本站的所有資料，並清空本機（使用者在「我的筆記」頁二次確認後）。 */
  async deleteEverything(): Promise<void> {
    await this.exclusive(async () => {
      if (this.adapter && this.hasToken()) {
        for (const f of await this.adapter.listFiles()) await this.adapter.remove(f.id)
      }
      await this.store.clearAll()
      await this.store.setMeta("deviceId", this.deviceId)
      this.own.clear()
      this.remote.clear()
      this.rebuild()
    })
  }
}

class CasConflict extends Error {}
class NewerSchemaError extends Error {}
