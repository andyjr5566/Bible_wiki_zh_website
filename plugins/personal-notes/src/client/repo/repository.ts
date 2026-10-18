// 本機資料核心（03 §4）：本裝置的版本＋其他裝置的快取 → 合併結果；CAS 寫入；查詢；事件。
//
// - 與「紀錄種類」無關：筆記、畫重點、書籤都是同一種紀錄（model/record.ts），欄位怎麼用由 features/ 決定。
// - 不碰 DOM、不碰網路，可在 Node 測試。雲端同步在 sync/syncer.ts，透過本檔「同步層使用」一節的方法讀寫。
//
// 不變式：
// - UI 只透過這裡（→ IndexedDB）讀寫；雲端是同步與備份層。
// - 本機修改與 outbox 標記在同一個 IndexedDB 交易裡完成（store.saveOwnIfUnchanged）。
// - 有衝突的紀錄不能一般修改，必須先選定版本（Codex 審查 #3）。

import { HlcClock, parseHlc } from "../model/hlc"
import { newDeviceId, newNoteId } from "../model/ids"
import { extractLinks, shardOf, type Anchor, type NoteRecord, type RecordType } from "../model/record"
import { nextVv, resolveAll, type Resolved } from "../merge/merge"
import type { NotesStore, RemoteShardCache } from "../store/db"

export class ConflictPendingError extends Error {
  constructor(readonly id: string) {
    super(`紀錄 ${id} 有尚未選定的版本`)
    this.name = "ConflictPendingError"
  }
}

/** 同裝置其他分頁先改了同一則（CAS 失敗）。 */
export class CasConflict extends Error {}

/** 新紀錄的內容欄位；id、時間、版本資訊由 Repository 填。 */
export interface RecordFields {
  type: RecordType
  anchor: Anchor
  title: string
  body: string
  tags: string[]
  [extra: string]: unknown
}

export interface CommitEntry {
  record: NoteRecord
  /** 寫入前本機 own 裡應該是哪個版本（CAS）；null＝應該還沒有。 */
  expectedHlc: string | null
  previous: NoteRecord | undefined
}

/** 解決衝突：保留指定 hlc 的版本，或保留顯示中的版本並把其他版本另存。 */
export type ConflictChoice = { keep: string } | { keepBoth: true }

export interface RepositoryOptions {
  store: NotesStore
  now?: () => number
}

type Listener = () => void

const CAS_RETRIES = 3

export class Repository {
  deviceId: string
  readonly store: NotesStore
  readonly now: () => number

  private own = new Map<string, NoteRecord>()
  private remote = new Map<string, RemoteShardCache>()
  private resolvedMap = new Map<string, Resolved>()
  private clock: HlcClock
  private changeListeners = new Set<Listener>()
  private localWriteListeners = new Set<Listener>()

  private constructor(store: NotesStore, deviceId: string, now: () => number) {
    this.store = store
    this.deviceId = deviceId
    this.now = now
    this.clock = new HlcClock(deviceId, null, now)
  }

  static async create(opts: RepositoryOptions): Promise<Repository> {
    let deviceId = await opts.store.getMeta<string>("deviceId")
    if (!deviceId) {
      deviceId = newDeviceId()
      await opts.store.setMeta("deviceId", deviceId)
    }
    const repo = new Repository(opts.store, deviceId, opts.now ?? Date.now)
    await repo.reloadFromStore()
    // 啟動時從所有已知版本與上次保存的值恢復時鐘（Codex 審查 #4）
    const hlcLast = await opts.store.getMeta<string>("hlcLast")
    if (hlcLast) repo.clock.observe(hlcLast)
    return repo
  }

  // ---------- 事件 ----------

  /** 合併結果改變（本機修改、收到雲端資料、其他分頁通知）。 */
  onChange(fn: Listener): () => void {
    this.changeListeners.add(fn)
    return () => this.changeListeners.delete(fn)
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

  // ---------- 載入 ----------

  /** 從 IndexedDB 重新載入（啟動時、同步前、其他分頁通知有變更時）。 */
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

  /** 重新計算合併結果並通知畫面。 */
  rebuild(): void {
    const all: NoteRecord[] = [...this.own.values()]
    for (const c of this.remote.values()) all.push(...c.records)
    this.resolvedMap = resolveAll(all)
    this.emit(this.changeListeners)
  }

  // ---------- 查詢 ----------

  get(id: string): Resolved | undefined {
    return this.resolvedMap.get(id)
  }

  /** 要顯示的紀錄（所有種類）：勝出版本未刪除，或有待處理的衝突。 */
  visible(): Resolved[] {
    return [...this.resolvedMap.values()].filter((r) => !r.winner.deleted || r.conflicts.length > 0)
  }

  /** 錨定在某一章的紀錄（所有種類），依節數、建立時間排序。 */
  inChapter(book: string, chapter: number): Resolved[] {
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

  // ---------- 產生新版本 ----------

  iso(): string {
    return new Date(this.now()).toISOString()
  }

  tick(): string {
    return this.clock.tick()
  }

  observe(hlc: string): void {
    this.clock.observe(hlc)
  }

  /** HLC 的牆上時間，用來讓 vv 計數也帶時間資訊（03 §4.4）。 */
  stampOf(hlc: string): number {
    return parseHlc(hlc)?.wall ?? this.now()
  }

  /** 全新紀錄（尚未寫入）。 */
  draft(fields: RecordFields): NoteRecord {
    const hlc = this.tick()
    const now = this.iso()
    return {
      ...fields,
      id: newNoteId(this.now()),
      links: extractLinks(fields.body),
      createdAt: now,
      updatedAt: now,
      hlc,
      vv: nextVv(null, this.deviceId, this.stampOf(hlc)),
      author: this.deviceId,
      deleted: false,
    }
  }

  /** 以目前合併結果為基礎的新版本（尚未寫入）。changes 裡值為 undefined 的欄位沿用原值。 */
  revise(r: Resolved, changes: Partial<RecordFields> & { deleted?: boolean } = {}): NoteRecord {
    const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) as Partial<NoteRecord>
    const body = defined.body ?? r.winner.body
    const hlc = this.tick()
    return {
      ...r.winner,
      ...defined,
      links: extractLinks(body),
      updatedAt: this.iso(),
      hlc,
      vv: nextVv(r, this.deviceId, this.stampOf(hlc)),
      author: this.deviceId,
      deleted: defined.deleted ?? false,
    }
  }

  /** 取得可修改的紀錄；找不到或有待選定的衝突就丟例外。 */
  editable(id: string): Resolved {
    const r = this.resolvedMap.get(id)
    if (!r) throw new Error(`找不到紀錄 ${id}`)
    if (r.conflicts.length > 0) throw new ConflictPendingError(id)
    return r
  }

  // ---------- 寫入 ----------

  /** 寫入一筆全新紀錄。 */
  async insert(record: NoteRecord): Promise<NoteRecord> {
    await this.commit([{ record, expectedHlc: null, previous: undefined }])
    return record
  }

  /** 以新版本取代本裝置目前保存的版本（CAS）。 */
  async replace(record: NoteRecord): Promise<NoteRecord> {
    const previous = this.own.get(record.id)
    await this.commit([{ record, expectedHlc: previous?.hlc ?? null, previous }])
    return record
  }

  /** 一次寫入多筆（同一個交易）；CAS 失敗丟 CasConflict。 */
  async commit(entries: CommitEntry[]): Promise<void> {
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
  async withCas<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await fn()
      } catch (e) {
        if (!(e instanceof CasConflict) || i >= CAS_RETRIES) throw e
        await this.reloadFromStore()
      }
    }
  }

  /** 刪除（留下墓碑，讓其他裝置也知道被刪了）。 */
  async remove(id: string): Promise<void> {
    await this.withCas(async () => {
      const r = this.editable(id)
      return this.replace(this.revise(r, { title: "", body: "", tags: [], deleted: true }))
    })
  }

  /** 解決衝突。新版本以前緣最大值為基礎，會一次取代所有衝突版本。 */
  async resolveConflict(id: string, choice: ConflictChoice): Promise<void> {
    await this.withCas(async () => {
      const r = this.resolvedMap.get(id)
      if (!r) throw new Error(`找不到紀錄 ${id}`)
      const versions = [r.winner, ...r.conflicts]
      const chosen = "keep" in choice ? versions.find((v) => v.hlc === choice.keep) : r.winner
      if (!chosen) throw new Error("找不到要保留的版本")
      const hlc = this.tick()
      const resolution: NoteRecord = {
        ...chosen,
        updatedAt: this.iso(),
        hlc,
        vv: nextVv(r, this.deviceId, this.stampOf(hlc)),
        author: this.deviceId,
      }
      const copies =
        "keepBoth" in choice
          ? r.conflicts.filter((c) => !c.deleted).map((c) => this.copyAsNew(c, "（另一個版本）", { createdAt: this.iso(), updatedAt: this.iso() }))
          : []
      await this.commit([
        { record: resolution, expectedHlc: this.own.get(id)?.hlc ?? null, previous: this.own.get(id) },
        ...copies.map((c) => ({ record: c, expectedHlc: null, previous: undefined })),
      ])
    })
  }

  /** 把某個版本複製成一則新紀錄（衝突時「兩個都保留」、匯入衝突、雲端清空後搶救）。 */
  copyAsNew(version: NoteRecord, titleSuffix: string, extra: Partial<NoteRecord> = {}): NoteRecord {
    const hlc = this.tick()
    return {
      ...version,
      id: newNoteId(this.now()),
      title: `${version.title || "筆記"}${titleSuffix}`,
      ...extra,
      hlc,
      vv: nextVv(null, this.deviceId, this.stampOf(hlc)),
      author: this.deviceId,
    }
  }

  // ---------- 同步層使用（sync/syncer.ts、repo/backup.ts） ----------

  ownRecord(id: string): NoteRecord | undefined {
    return this.own.get(id)
  }

  ownRecords(): NoteRecord[] {
    return [...this.own.values()]
  }

  remoteRecords(): NoteRecord[] {
    return [...this.remote.values()].flatMap((c) => c.records)
  }

  remoteVersion(fileId: string): string | undefined {
    return this.remote.get(fileId)?.version
  }

  /** 存入其他裝置分片的快取（呼叫端負責之後 rebuild）。 */
  async putRemote(cache: RemoteShardCache): Promise<void> {
    for (const r of cache.records) this.clock.observe(r.hlc)
    await this.store.putRemote(cache)
    this.remote.set(cache.fileId, cache)
  }

  /** 移除已被取代的本機版本（若期間沒被改過）。 */
  async dropOwnIfUnchanged(list: { id: string; hlc: string }[]): Promise<void> {
    if (list.length === 0) return
    const deleted = await this.store.deleteOwnIfUnchanged(list)
    for (const id of deleted) this.own.delete(id)
    if (deleted.length > 0) this.rebuild()
  }

  /** 本裝置換一個新 ID（偵測到別人用了同一個 ID 時，Codex 審查 #5）。 */
  async changeDeviceId(): Promise<void> {
    const id = newDeviceId()
    this.deviceId = id
    this.clock = new HlcClock(id, this.clock.current(), this.now)
    await this.store.setMeta("deviceId", id)
  }

  /** 把本裝置所有分片標記為待上傳。 */
  async markAllDirty(): Promise<void> {
    const shards = [...new Set([...this.own.values()].map(shardOf))]
    if (shards.length > 0) await this.store.markDirty(shards, this.now())
  }

  /**
   * 雲端上所有裝置的檔案都沒了：由本裝置重新保存「目前看得到的每一個版本」（Codex 審查 #5）。
   * 每則的顯示版本存為本裝置版本；同時修改的其他版本另存為新紀錄，內容一個都不丟。
   */
  async rescueAllVersions(): Promise<void> {
    const rescue: NoteRecord[] = []
    for (const r of this.resolvedMap.values()) {
      if (this.own.get(r.id)?.hlc !== r.winner.hlc) rescue.push(r.winner)
      for (const c of r.conflicts) if (!c.deleted) rescue.push(this.copyAsNew(c, "（另一個版本）"))
    }
    for (const r of rescue) this.own.set(r.id, r)
    if (rescue.length > 0) await this.store.saveOwn(rescue, rescue.map(shardOf), this.now())
    await this.markAllDirty()
    this.rebuild()
  }

  /** 清空本機（保留裝置 ID）。 */
  async clearAll(): Promise<void> {
    await this.store.clearAll()
    await this.store.setMeta("deviceId", this.deviceId)
    this.own.clear()
    this.remote.clear()
    this.rebuild()
  }
}
