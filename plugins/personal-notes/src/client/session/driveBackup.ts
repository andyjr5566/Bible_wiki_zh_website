// 「存一份到我的 Google Drive」的流程（D-45、13 §2.3）：申請 drive.file → 匯出 → 上傳到看得到的資料夾 → 只保留最新 10 份
// （舊的移到垃圾桶）→ 記錄上次備份時間。每次同步成功後檢查要不要自動備份。瀏覽器儲存與 Drive 實作都由 SessionDeps 注入。

import type { TokenResult } from "../auth/gis"
import type { BackupListing, DriveFilesLike } from "../adapter/driveFiles"
import { AdapterError } from "../adapter/types"
import { backupsToTrash, dueForAutoBackup, needsReminder } from "../model/backupPolicy"
import { exportBackup, importBackup, type ImportResult } from "../repo/backup"
import type { Repository } from "../repo/repository"
import type { NotesStore } from "../store/db"
import type { AccountInfo, KeyValueStore, TokenSource } from "./session"

const LAST_AT = "lastBackupAt"
const LAST_KIND = "lastBackupKind"
const FAILURES = "backupFailures"
const AUTO_PREFIX = "bwz-notes-auto-backup-" // 每週自動備份開關（每台裝置、每個帳號各自記；沒設定過＝開）

const SNOOZE_KEY = "bwz-notes-backup-snooze" // 「之後再說」到什麼時候（這台裝置）
const DAY_MS = 24 * 60 * 60 * 1000

/** 〈我的筆記〉頁頂端的備份提醒（D-45：30 天沒備份且有改過；未登入也提醒）。 */
export interface BackupReminder {
  show: boolean
  /** 距上次備份幾天；從沒備份過是 null。 */
  daysSince: number | null
  /** 自動備份連續失敗幾次（3 次以上畫面另外提醒）。 */
  failures: number
}

export type BackupFailureReason = "signed-out" | "no-scope" | "denied" | "offline" | "auth" | "quota" | "unknown"

export type BackupResult =
  | { ok: true; id: string; records: number; createdTime: string }
  | { ok: false; reason: BackupFailureReason }

export interface LastBackup {
  at: number | null
  kind: "drive" | "file" | null
  autoEnabled: boolean
  failures: number
}

export interface BackupWorkspace {
  store: NotesStore
  repo: Repository
}

export interface DriveBackupDeps {
  current: () => { account: AccountInfo | null; ws: BackupWorkspace }
  tokens: TokenSource | null
  storage: KeyValueStore
  createDriveFiles?: (getToken: () => string | null) => DriveFilesLike
  identifyToken: () => Promise<{ permissionId: string }>
  now: () => number
}

function failureReason(error: unknown): BackupFailureReason {
  if (error instanceof AdapterError) {
    if (error.kind === "network" || error.kind === "server") return "offline"
    if (error.kind === "auth") return "auth"
    if (error.kind === "rateLimit" || error.kind === "storageFull") return "quota"
  }
  return "unknown"
}

function backupName(time: number): string {
  const date = new Date(time)
  const day = date.toISOString().slice(0, 10)
  const hhmm = date.toISOString().slice(11, 16).replace(":", "")
  return `聖經筆記備份 ${day} ${hhmm}.json`
}

function changeTimes(repo: Repository): { lastChangeAt: number | null; firstRecordAt: number | null } {
  const records = exportBackup(repo).records
  let lastChangeAt: number | null = null
  let firstRecordAt: number | null = null
  for (const record of records) {
    const changed = Date.parse(String(record.updatedAt))
    const created = Date.parse(String(record.createdAt ?? record.updatedAt))
    if (Number.isFinite(changed)) lastChangeAt = Math.max(lastChangeAt ?? changed, changed)
    if (Number.isFinite(created)) firstRecordAt = Math.min(firstRecordAt ?? created, created)
  }
  return { lastChangeAt, firstRecordAt }
}

export class DriveBackup {
  private running: Promise<BackupResult> | null = null
  private autoRunning = false

  constructor(private readonly deps: DriveBackupDeps) {}

  private autoKey(account: AccountInfo | null): string {
    return AUTO_PREFIX + (account?.permissionId ?? "anon")
  }

  setAutoEnabled(enabled: boolean): void {
    const { account } = this.deps.current()
    this.deps.storage.set(this.autoKey(account), enabled ? "1" : "0")
  }

  async lastBackup(): Promise<LastBackup> {
    const { account, ws } = this.deps.current()
    const [at, kind, failures] = await Promise.all([
      ws.store.getMeta<number>(LAST_AT),
      ws.store.getMeta<"drive" | "file">(LAST_KIND),
      ws.store.getMeta<number>(FAILURES),
    ])
    return {
      at: typeof at === "number" && Number.isFinite(at) ? at : null,
      kind: kind === "drive" || kind === "file" ? kind : null,
      // 沒設定過就算開著：開過 drive.file 的帳號，每台裝置預設都會自動備份（多台同時到期時，自動備份前會先看 Drive 上最新一份）
      autoEnabled: this.deps.storage.get(this.autoKey(account)) !== "0",
      failures: typeof failures === "number" ? failures : 0,
    }
  }

  async reminder(): Promise<BackupReminder> {
    const { account, ws } = this.deps.current()
    const status = await this.lastBackup()
    const { lastChangeAt, firstRecordAt } = changeTimes(ws.repo)
    const now = this.deps.now()
    const granted = !!account && !!this.deps.tokens?.hasBackupScope?.(account.permissionId)
    const snooze = Number(this.deps.storage.get(SNOOZE_KEY))
    const show = needsReminder({
      lastBackupAt: status.at,
      lastChangeAt,
      firstRecordAt,
      now,
      autoHealthy: granted && status.autoEnabled && status.failures < 3,
      snoozedUntil: Number.isFinite(snooze) && snooze > 0 ? snooze : null,
    })
    return { show, daysSince: status.at === null ? null : Math.floor((now - status.at) / DAY_MS), failures: status.failures }
  }

  /** 「之後再說」：這台裝置幾天內不再提醒。 */
  snoozeReminder(days = 7): void {
    this.deps.storage.set(SNOOZE_KEY, String(this.deps.now() + days * DAY_MS))
  }

  async markDownloaded(): Promise<void> {
    const { ws } = this.deps.current()
    await ws.store.setMeta(LAST_AT, this.deps.now())
    await ws.store.setMeta(LAST_KIND, "file")
  }

  /**
   * 不是 async：第一次手動備份時，requestBackupScope 在 click 的同步呼叫鏈內執行。
   */
  backupNow(fromClick: boolean): Promise<BackupResult> {
    const { account, ws } = this.deps.current()
    if (!account) return Promise.resolve({ ok: false, reason: "signed-out" })
    if (this.running) return this.running

    const tokens = this.deps.tokens
    if (!tokens || !this.deps.createDriveFiles) return Promise.resolve({ ok: false, reason: "auth" })

    let request: Promise<TokenResult> | null = null
    if (!tokens.hasBackupScope?.(account.permissionId)) {
      if (!fromClick) {
        return Promise.resolve({
          ok: false,
          reason: tokens.tokenFor(account.permissionId) ? "no-scope" : "auth",
        })
      }
      if (!tokens.ready || !tokens.requestBackupScope) return Promise.resolve({ ok: false, reason: "auth" })
      request = tokens.requestBackupScope()
    }

    const work = this.performBackup(account, ws, request)
    this.running = work
    void work.finally(() => {
      if (this.running === work) this.running = null
    })
    return work
  }

  private async performBackup(
    account: AccountInfo,
    ws: BackupWorkspace,
    request: Promise<TokenResult> | null,
  ): Promise<BackupResult> {
    const tokens = this.deps.tokens!
    try {
      if (request) {
        const result = await request
        if (!result.ok && result.reason !== "no-scope") {
          return { ok: false, reason: result.reason === "denied" || result.reason === "popup-closed" ? "denied" : "auth" }
        }
        // 即使只取得 appdata，也確認 token 擁有者，讓原本的同步繼續使用。
        if (!tokens.token()) return { ok: false, reason: "auth" }
        const identified = await this.deps.identifyToken()
        if (identified.permissionId !== account.permissionId) return { ok: false, reason: "auth" }
        tokens.setOwner(account.permissionId)
        if (!tokens.hasBackupScope?.(account.permissionId)) return { ok: false, reason: "no-scope" }
      }

      if (!tokens.tokenFor(account.permissionId) || !tokens.hasBackupScope?.(account.permissionId)) {
        return { ok: false, reason: "auth" }
      }
      const files = this.deps.createDriveFiles!(() => tokens.tokenFor(account.permissionId))
      const data = exportBackup(ws.repo)
      const now = this.deps.now()
      const folderId = await files.ensureFolder()
      const id = await files.createBackup(folderId, backupName(now), JSON.stringify(data), data.records.length)
      const list = await files.listBackups()
      for (const oldId of backupsToTrash(list)) await files.trash(oldId)

      // 切換帳號期間完成的請求不可寫進新工作區。
      if (this.deps.current().ws === ws) {
        await ws.store.setMeta(LAST_AT, now)
        await ws.store.setMeta(LAST_KIND, "drive")
        await ws.store.setMeta(FAILURES, 0)
      }
      return { ok: true, id, records: data.records.length, createdTime: new Date(now).toISOString() }
    } catch (error) {
      return { ok: false, reason: failureReason(error) }
    }
  }

  private files(): DriveFilesLike {
    const { account } = this.deps.current()
    const tokens = this.deps.tokens
    if (!account || !tokens?.hasBackupScope?.(account.permissionId) || !this.deps.createDriveFiles) {
      throw new AdapterError("auth", "沒有 Drive 備份權限")
    }
    return this.deps.createDriveFiles(() => tokens.tokenFor(account.permissionId))
  }

  private async reconcile(list: BackupListing[], ws: BackupWorkspace): Promise<void> {
    const newest = Date.parse(list[0]?.createdTime ?? "")
    if (!Number.isFinite(newest)) return
    const local = await ws.store.getMeta<number>(LAST_AT)
    if (this.deps.current().ws !== ws || (typeof local === "number" && local >= newest)) return
    await ws.store.setMeta(LAST_AT, newest)
    await ws.store.setMeta(LAST_KIND, "drive")
  }

  async listBackups(): Promise<BackupListing[]> {
    const ws = this.deps.current().ws
    const list = await this.files().listBackups()
    await this.reconcile(list, ws)
    return list
  }

  async restore(fileId: string): Promise<ImportResult> {
    const ws = this.deps.current().ws
    const json = await this.files().read(fileId)
    if (this.deps.current().ws !== ws) throw new Error("工作區已切換")
    return importBackup(ws.repo, JSON.parse(json) as unknown)
  }

  async autoBackupIfDue(): Promise<void> {
    if (this.autoRunning || this.running) return
    this.autoRunning = true
    const { account, ws } = this.deps.current()
    try {
      if (!account || !this.deps.tokens?.hasBackupScope?.(account.permissionId)) return
      const status = await this.lastBackup()
      const { lastChangeAt } = changeTimes(ws.repo)
      const state = {
        lastBackupAt: status.at,
        lastChangeAt,
        now: this.deps.now(),
        autoEnabled: status.autoEnabled,
        granted: true,
      }
      if (!dueForAutoBackup(state)) return

      // 另一台裝置可能剛備份；先讀 Drive 建立時間，再判斷一次。
      await this.listBackups()
      if (this.deps.current().ws !== ws) return
      const refreshed = await this.lastBackup()
      if (!dueForAutoBackup({ ...state, lastBackupAt: refreshed.at })) return

      const result = await this.backupNow(false)
      if (!result.ok) await ws.store.setMeta(FAILURES, refreshed.failures + 1)
    } catch (error) {
      try {
        const failures = (await ws.store.getMeta<number>(FAILURES)) ?? 0
        if (this.deps.current().ws === ws) await ws.store.setMeta(FAILURES, failures + 1)
      } catch {
        // 工作區已切換或本機儲存暫時失敗；同步本身不受影響。
      }
      console.warn("[personal-notes] 自動備份失敗", error)
    } finally {
      this.autoRunning = false
    }
  }
}
