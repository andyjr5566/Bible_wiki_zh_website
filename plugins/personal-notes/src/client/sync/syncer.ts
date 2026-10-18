// 雲端同步協定（03 §4、§5）：bootstrap／pull／push、同步狀態、錯誤分類。不碰 DOM，可在 Node 測試。
//
// 不變式：
// - 每台裝置只寫自己的分片檔（單一寫入者），讀取時合併所有裝置的版本（合併在 repo/）。
// - 本機修改在「確認上傳成功」前不會從 outbox 移除。
// - 狀態只用種類表示（SyncStatus），要給使用者看的文字在 ui/status.ts。

import { AdapterError, deviceFileName, shardFileName, type RemoteFile, type SyncAdapter } from "../adapter/types"
import { APP_TAG, SCHEMA_VERSION, shardOf, validateShard, type NoteRecord, type ShardFile } from "../model/record"
import { vvDominatedBy } from "../model/vv"
import { pruneOwn } from "../merge/merge"
import type { Repository } from "../repo/repository"
import type { RemoteShardCache } from "../store/db"

export type SyncErrorKind = "cloud-wiped" | "storage-full" | "admin" | "newer-schema" | "circuit-open" | "other"

export type SyncStatus =
  | { kind: "local-only" }
  | { kind: "needs-reconnect" }
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "ready"; lastSyncAt: number }
  | { kind: "offline"; since: number }
  | { kind: "error"; error: SyncErrorKind; detail?: string }

export type Freshness = "local" | "no-token" | "fresh" | "failed"

export interface SyncerOptions {
  repo: Repository
  maxWritesPerMinute?: number
  appVersion?: string
  deviceLabel?: string
}

interface OwnFile {
  id: string
  version: string
}

type Listener = () => void

const CLOUD_WIPED: SyncStatus = { kind: "error", error: "cloud-wiped" }

export class Syncer {
  private readonly repo: Repository
  private readonly maxWritesPerMinute: number
  private readonly appVersion: string
  private readonly deviceLabel: string

  private adapter: SyncAdapter | null = null
  private hasToken: () => boolean = () => false
  private statusValue: SyncStatus = { kind: "local-only" }
  private statusListeners = new Set<Listener>()
  private chain: Promise<unknown> = Promise.resolve()
  /** 執行同步的方式；排程器會換成「包在 Web Lock 裡」的版本，讓所有入口都跨分頁互斥（Codex 審查 #2）。 */
  private runner: () => Promise<void> = () => this.sync()
  private writeTimes: number[] = []
  private consecutiveFailures = 0
  private circuitUntil = 0
  lastPullAt = 0
  /** 每次從雲端收到其他裝置的新資料就 +1（排程器據此調整輪詢間隔）。 */
  remoteRevision = 0

  constructor(opts: SyncerOptions) {
    this.repo = opts.repo
    this.maxWritesPerMinute = opts.maxWritesPerMinute ?? 6
    this.appVersion = opts.appVersion ?? "0"
    this.deviceLabel = opts.deviceLabel ?? ""
  }

  private get store() {
    return this.repo.store
  }

  private now(): number {
    return this.repo.now()
  }

  // ---------- 狀態 ----------

  get status(): SyncStatus {
    return this.statusValue
  }

  onStatus(fn: Listener): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  private setStatus(s: SyncStatus) {
    this.statusValue = s
    for (const fn of this.statusListeners) {
      try {
        fn()
      } catch (e) {
        console.error("[personal-notes] listener error", e)
      }
    }
  }

  // ---------- 設定 ----------

  /** 設定雲端後端；adapter 為 null 代表僅本機模式。 */
  setAdapter(adapter: SyncAdapter | null, hasToken: () => boolean = () => true): void {
    this.adapter = adapter
    this.hasToken = hasToken
    if (!adapter) this.setStatus({ kind: "local-only" })
    else this.setStatus(hasToken() ? { kind: "idle" } : { kind: "needs-reconnect" })
  }

  setRunner(fn: () => Promise<void>): void {
    this.runner = fn
  }

  /** 授權狀態改變時由外部通知（取得新 token、token 過期）。 */
  authChanged(): void {
    if (!this.adapter) return
    if (!this.hasToken()) this.setStatus({ kind: "needs-reconnect" })
    else if (this.statusValue.kind === "needs-reconnect") this.setStatus({ kind: "idle" })
  }

  // ---------- 入口 ----------

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
        this.setStatus(CLOUD_WIPED)
        return
      }
      this.setStatus({ kind: "syncing" })
      try {
        // 先從 IndexedDB 重新載入：其他分頁可能剛寫入（多分頁時，排程器另用 Web Locks 確保一次只有一個分頁同步）
        await this.repo.reloadFromStore()
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
        await this.repo.reloadFromStore()
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
  async ensureFresh(maxAgeMs = 30_000, timeoutMs = 8_000): Promise<Freshness> {
    if (!this.adapter) return "local"
    if (!this.hasToken()) return "no-token"
    if (this.statusValue.kind === "ready" && this.now() - this.lastPullAt < maxAgeMs) return "fresh"
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs)
    })
    const r = await Promise.race([this.runner().then(() => "done" as const), timeout])
    if (timer) clearTimeout(timer)
    if (r === "timeout") return "failed"
    const kind = this.statusValue.kind as string
    if (kind === "ready") return "fresh"
    if (kind === "needs-reconnect") return "no-token"
    return "failed"
  }

  /** 使用者確認「用這台裝置的資料重新上傳」（雲端被清空後）。 */
  async reuploadAfterWipe(): Promise<void> {
    for (const key of ["cloudWiped", "everSynced", "bootstrapped"]) await this.store.setMeta(key, false)
    await this.store.setMeta("ownFiles", {})
    await this.store.setMeta("deviceFileId", null)
    await this.store.setMeta("startPageToken", null)
    await this.repo.rescueAllVersions()
    await this.runner()
  }

  /** 刪除雲端上本站的所有資料，並清空本機（使用者在「我的筆記」頁二次確認後）。 */
  async deleteEverything(): Promise<void> {
    await this.exclusive(async () => {
      if (this.adapter && this.hasToken()) {
        for (const f of await this.adapter.listFiles()) await this.adapter.remove(f.id)
      }
      await this.repo.clearAll()
    })
  }

  // ---------- 錯誤 ----------

  private handleError(e: unknown): void {
    const err = e instanceof AdapterError ? e : null
    if (err?.kind === "auth") return this.setStatus({ kind: "needs-reconnect" })
    if (err?.kind === "storageFull") return this.setStatus({ kind: "error", error: "storage-full" })
    if (err?.kind === "admin") return this.setStatus({ kind: "error", error: "admin" })
    if (e instanceof NewerSchemaError) return this.setStatus({ kind: "error", error: "newer-schema" })
    this.consecutiveFailures++
    if (this.consecutiveFailures >= 5) {
      this.circuitUntil = this.now() + 5 * 60_000
      return this.setStatus({ kind: "error", error: "circuit-open" })
    }
    if (err?.kind === "network" || err?.kind === "rateLimit" || err?.kind === "server") {
      return this.setStatus({ kind: "offline", since: this.now() })
    }
    console.error("[personal-notes] sync error", e)
    this.setStatus({ kind: "error", error: "other", detail: e instanceof Error ? e.message : String(e) })
  }

  // ---------- 讀取雲端 ----------

  private async ownFiles(): Promise<Record<string, OwnFile>> {
    return (await this.store.getMeta<Record<string, OwnFile>>("ownFiles")) ?? {}
  }

  private async readRemote(file: RemoteFile): Promise<boolean> {
    const v = validateShard(await this.adapter!.read(file.id))
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
    await this.repo.putRemote(cache)
    return true
  }

  /**
   * 有人用本裝置 ID 寫入了雲端（從舊備份還原、複製了瀏覽器設定檔…）→ 本裝置換一個新 ID，
   * 舊 ID 的檔案改當成別台裝置的資料讀取，避免互相覆蓋（Codex 審查 #5）。
   */
  private async forkDevice(): Promise<void> {
    await this.repo.changeDeviceId()
    await this.store.setMeta("ownFiles", {})
    await this.store.setMeta("deviceFileId", null)
    await this.repo.markAllDirty()
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

  /**
   * 雲端上「本裝置自己的檔案」版本和記錄的不同：可能是先前的更新其實成功、只是回應遺失。
   * 讀取內容核對：每筆紀錄都等於或已被本機看過 → 是自己寫的，更新版本記錄即可；否則才視為被別人寫入（Codex 審查 #3）。
   */
  private async verifyOwnFile(file: RemoteFile, ownFiles: Record<string, OwnFile>): Promise<boolean> {
    const v = validateShard(await this.adapter!.read(file.id))
    if (!v.ok) return false
    const known = (r: NoteRecord) => {
      if (this.repo.ownRecord(r.id)?.hlc === r.hlc) return true
      const res = this.repo.get(r.id)
      return !!res && [res.winner, ...res.conflicts].some((x) => x.hlc === r.hlc || vvDominatedBy(r.vv, x.vv))
    }
    if (!v.shard.records.every(known)) return false
    if (file.shard) {
      ownFiles[file.shard] = { id: file.id, version: file.version }
      await this.store.setMeta("ownFiles", ownFiles)
    }
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
      if (forked || f.device !== this.repo.deviceId || known.has(f.id)) continue
      if (await this.adoptPending(f, ownFiles)) continue
      await this.forkDevice()
      forked = true
    }

    const everSynced = await this.store.getMeta<boolean>("everSynced")
    if (everSynced && files.length === 0 && this.repo.ownRecords().length > 0) {
      await this.store.setMeta("cloudWiped", true)
      this.setStatus(CLOUD_WIPED)
      return
    }
    for (const f of files) {
      if (f.kind !== "shard" || f.device === this.repo.deviceId) continue
      if (this.repo.remoteVersion(f.id) === f.version) continue
      await this.readRemote(f)
    }
    await this.store.setMeta("startPageToken", token)
    await this.store.setMeta("bootstrapped", true)
    await this.store.setMeta("everSynced", true)
    this.lastPullAt = this.now()
    this.repo.rebuild()
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
      if (f.device === this.repo.deviceId && !forked) {
        if (f.kind === "device" && (f.id === deviceFileId || (await this.adoptPending(f, ownFiles)))) continue
        const mine = ownById.get(f.id)
        if (mine && mine.version === f.version) continue
        if (mine && f.kind === "shard" && (await this.verifyOwnFile(f, ownFiles))) continue
        if (!mine && (await this.adoptPending(f, ownFiles))) continue
        await this.forkDevice()
        forked = true
      }
      if (f.kind !== "shard") continue
      if (this.repo.remoteVersion(f.id) === f.version) continue
      if (await this.readRemote(f)) changed = true
    }
    if (cs.removed.some((id) => ownById.has(id))) {
      await this.store.setMeta("cloudWiped", true)
      await this.store.setMeta("startPageToken", cs.token)
      this.setStatus(CLOUD_WIPED)
      return
    }
    // 其他裝置的檔案被移除：保守起見保留本機快取（03 §4.2）
    await this.store.setMeta("startPageToken", cs.token)
    this.lastPullAt = this.now()
    if (changed) this.remoteRevision++
    if (changed || forked) this.repo.rebuild()
  }

  // ---------- 上傳 ----------

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

  private async writeFile(
    existing: OwnFile | undefined,
    meta: Parameters<SyncAdapter["create"]>[1],
    body: unknown,
    persistMapping: (file: RemoteFile) => Promise<void>,
  ): Promise<RemoteFile | "wiped"> {
    const adapter = this.adapter!
    if (existing) {
      try {
        const r = await adapter.update(existing.id, body)
        await persistMapping(r)
        return r
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
    // 先把檔案對應存好，才清除暫存的 ID；兩步之間關掉分頁，下次仍能從 pendingId 認領（Codex 審查 #4）
    await persistMapping(result)
    await this.store.setMeta(pendingKey, null)
    return result
  }

  private async pushInner(): Promise<void> {
    const outbox = await this.store.getOutbox()
    const ownFiles = await this.ownFiles()
    const remoteRecords = this.repo.remoteRecords()
    for (const entry of outbox) {
      if (!this.allowWrite()) break
      const shard = entry.shard
      const records = this.repo.ownRecords().filter((r) => shardOf(r) === shard)
      const ids = new Set(records.map((r) => r.id))
      const kept = pruneOwn(records, remoteRecords.filter((r) => ids.has(r.id)), this.now())
      const pruned = records.filter((r) => !kept.includes(r))
      const existing = ownFiles[shard]
      if (kept.length === 0 && !existing) {
        await this.store.clearDirty(shard, entry.dirtyAt)
        continue
      }
      const device = this.repo.deviceId
      const body: ShardFile = { schema: SCHEMA_VERSION, kind: "shard", app: APP_TAG, shard, device, writtenAt: this.repo.iso(), records: kept }
      this.writeTimes.push(this.now())
      const result = await this.writeFile(existing, { name: shardFileName(shard, device), kind: "shard", shard, device }, body, async (file) => {
        ownFiles[shard] = { id: file.id, version: file.version }
        await this.store.setMeta("ownFiles", ownFiles)
      })
      if (result === "wiped") {
        await this.store.setMeta("cloudWiped", true)
        this.setStatus(CLOUD_WIPED)
        return
      }
      await this.repo.dropOwnIfUnchanged(pruned.map((r) => ({ id: r.id, hlc: r.hlc })))
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
    const device = this.repo.deviceId
    const body = { kind: "device", app: APP_TAG, device, label: this.deviceLabel, appVersion: this.appVersion, lastSeen: this.repo.iso() }
    this.writeTimes.push(this.now())
    const result = await this.writeFile(
      fileId ? { id: fileId, version: "" } : undefined,
      { name: deviceFileName(device), kind: "device", shard: null, device },
      body,
      async (file) => {
        await this.store.setMeta("deviceFileId", file.id)
        await this.store.setMeta("deviceFileUpdatedAt", this.now())
      },
    )
    // 登記檔被刪除：清掉舊 ID，下次重建，不要每輪都重試不存在的檔案（Codex 審查 #11）
    if (result === "wiped") await this.store.setMeta("deviceFileId", null)
  }
}

class NewerSchemaError extends Error {}
