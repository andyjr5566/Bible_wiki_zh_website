// 帳號工作階段（03 §5、§7、§8；D-03、D-04、D-05、D-21、D-22、D-23、D-34）：
// 目前用哪個帳號（或未登入）的本機資料、登入／登出、「先同步再編輯」。
//
// - 畫面（features/）透過這裡操作，不直接碰 Google、IndexedDB 或同步層。
// - 需要問使用者的地方一律透過 Prompts（session/prompts.ts），瀏覽器相關的東西由 app.ts 注入（SessionDeps），
//   所以這裡沒有 DOM 程式碼，可在 Node 測試。

import type { TokenResult } from "../auth/gis"
import type { SyncAdapter } from "../adapter/types"
import { adoptRecords } from "../repo/backup"
import { Repository } from "../repo/repository"
import { ANON_DB, accountDbName, type NotesStore } from "../store/db"
import { Syncer, type SyncStatus } from "../sync/syncer"
import type { Prompts } from "./prompts"

export interface ClientConfig {
  clientId: string
  syncEnabled: boolean
  minPollSeconds: number
  maxWritesPerMinute: number
  notice: string
  appVersion: string
}

export interface AccountInfo {
  permissionId: string
  email: string
  displayName: string
}

/** Google 授權（瀏覽器版是 auth/gis.ts 的 TokenManager）。 */
export interface TokenSource {
  readonly ready: boolean
  prepare(): Promise<void>
  /** 必須在點擊事件中同步呼叫。 */
  request(): Promise<TokenResult>
  token(): string | null
  tokenFor(permissionId: string): string | null
  hasToken(): boolean
  setOwner(permissionId: string): void
  onChange(fn: () => void): () => void
  rememberEmail(email: string): void
  forgetEmail(): void
  clear(): void
  revoke(): Promise<void>
}

/** 同步排程（瀏覽器版是 sync/scheduler.ts）。 */
export interface SchedulerLike {
  start(): void
  stop(): void
  syncNow(): Promise<void>
  withLock<T>(fn: () => Promise<T>): Promise<T>
  broadcastChanged(): void
}

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string | null): void
}

/** 一個帳號（或未登入）的本機資料與同步元件。 */
export interface Workspace {
  store: NotesStore
  repo: Repository
  syncer: Syncer
  scheduler: SchedulerLike | null
}

export interface SessionDeps {
  config: ClientConfig
  prompts: Prompts
  /** null＝未開放雲端同步（沒有 clientId 或遠端開關關閉）。 */
  tokens: TokenSource | null
  inAppBrowser: string | null
  deviceLabel: string
  storage: KeyValueStore
  openStore(name: string): Promise<NotesStore>
  deleteStore(name: string): Promise<void>
  createAdapter(getToken: () => string | null): SyncAdapter
  createScheduler(parts: { repo: Repository; syncer: Syncer }, namespace: string): SchedulerLike
  requestPersistence?(): void
  /** 測試用：控制時間。 */
  now?: () => number
}

const ACCOUNT_KEY = "bwz-notes-account" // 這台裝置上次登入的帳號

/** 切換帳號前的存檔失敗（畫面丟出），這次不切換。 */
class SwitchBlockedError extends Error {}

type Listener = () => void

export class Session {
  account: AccountInfo | null = null
  ws!: Workspace
  private listeners = new Set<Listener>()
  private beforeSwitchListeners = new Set<() => Promise<void>>()
  private unsubscribe: (() => void)[] = []
  /** 本次工作階段已確認過離線提示（D-04：不要每開一則就跳一次）。 */
  private offlineAcknowledged = false

  constructor(private readonly deps: SessionDeps) {}

  get config(): ClientConfig {
    return this.deps.config
  }

  get syncAvailable(): boolean {
    return this.deps.tokens !== null
  }

  get inAppBrowser(): string | null {
    return this.deps.inAppBrowser
  }

  get repo(): Repository {
    return this.ws.repo
  }

  get status(): SyncStatus {
    return this.ws.syncer.status
  }

  private get prompts(): Prompts {
    return this.deps.prompts
  }

  async init(): Promise<void> {
    const tokens = this.deps.tokens
    const saved = tokens ? this.readAccount() : null
    await this.openNamespace(saved)
    tokens?.onChange(() => {
      this.ws.syncer.authChanged()
      this.emit()
    })
    // D-34：只有「曾在這台裝置登入過」才預先載入 Google 登入元件（之後「繼續同步」才能直接開視窗）。
    // 沒登入過的人，要等按下「用 Google 同步」才會連到 Google。
    if (tokens && saved && !this.inAppBrowser) tokens.prepare().catch(() => undefined)
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /**
   * 切換帳號（登入、登出、中斷連線）之前呼叫，等它完成才切換。
   * 畫面用來把編輯中的內容存進「原本的」帳號資料（Codex 畫面審查 #3）。
   * 同一次切換可能呼叫不只一次，fn 必須可以重複呼叫（例如存完就關閉編輯器）。
   * fn 丟出錯誤代表「現在切換會遺失資料」，這次就不切換（Codex 第二輪 #7）。
   */
  onBeforeSwitch(fn: () => Promise<void>): () => void {
    this.beforeSwitchListeners.add(fn)
    return () => this.beforeSwitchListeners.delete(fn)
  }

  private async runBeforeSwitch(): Promise<void> {
    for (const fn of [...this.beforeSwitchListeners]) {
      try {
        await fn()
      } catch (e) {
        console.error("[personal-notes] 切換帳號前存檔失敗", e)
        throw new SwitchBlockedError(errorMessage(e))
      }
    }
  }

  /** 切換前存檔；失敗時通知使用者並回傳 false。 */
  private async readyToSwitch(): Promise<boolean> {
    try {
      await this.runBeforeSwitch()
      return true
    } catch {
      this.prompts.notify({ type: "switch-blocked" })
      return false
    }
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  private readAccount(): AccountInfo | null {
    try {
      return JSON.parse(this.deps.storage.get(ACCOUNT_KEY) ?? "null") as AccountInfo | null
    } catch {
      return null
    }
  }

  private writeAccount(info: AccountInfo | null): void {
    this.deps.storage.set(ACCOUNT_KEY, info ? JSON.stringify(info) : null)
  }

  /** 切換到某個帳號（或未登入）的本機資料庫，並視情況啟動同步。 */
  private async openNamespace(account: AccountInfo | null): Promise<void> {
    if (this.ws) await this.runBeforeSwitch()
    this.ws?.scheduler?.stop()
    for (const fn of this.unsubscribe) fn()
    this.unsubscribe = []
    this.ws?.store.close()

    this.account = account
    const { config, tokens } = this.deps
    const store = await this.deps.openStore(account ? accountDbName(account.permissionId) : ANON_DB)
    const repo = await Repository.create({ store, now: this.deps.now })
    const syncer = new Syncer({ repo, maxWritesPerMinute: config.maxWritesPerMinute, appVersion: config.appVersion, deviceLabel: this.deps.deviceLabel })
    let scheduler: SchedulerLike | null = null
    if (account && tokens) {
      const pid = account.permissionId
      // 只有「已確認屬於這個帳號」的 token 才能用來同步，避免把 A 帳號的筆記寫進 B 帳號（Codex 審查 #1、#7）
      syncer.setAdapter(this.deps.createAdapter(() => tokens.tokenFor(pid)), () => tokens.tokenFor(pid) !== null)
      scheduler = this.deps.createScheduler({ repo, syncer }, pid)
    } else {
      syncer.setAdapter(null)
    }
    // 先換好工作區再接上事件：畫面收到通知時讀到的一定是新帳號的資料（Codex 重構審查 A1）
    this.ws = { store, repo, syncer, scheduler }
    this.unsubscribe.push(repo.onChange(() => this.emit()), syncer.onStatus(() => this.emit()))
    scheduler?.start()
    this.emit()
  }

  // ---------- 登入 ----------

  /**
   * 「用 Google 同步」「繼續同步」按鈕的點擊處理。必須在點擊事件中直接呼叫（開 Google 視窗前不可有 await）。
   * 回傳的 Promise 在整個登入流程結束後完成。
   */
  signInFromClick(): Promise<void> {
    const tokens = this.deps.tokens
    if (!tokens) return Promise.resolve()
    if (this.inAppBrowser) return this.prompts.inAppBrowser(this.inAppBrowser)
    if (this.account) {
      // 已登入過、只是授權到期：Google 元件在 init 時已載入，直接開視窗
      if (!tokens.ready) {
        this.prompts.notify({ type: "google-loading" })
        tokens.prepare().catch((e: unknown) => this.prompts.notify({ type: "google-load-failed", message: errorMessage(e) }))
        return Promise.resolve()
      }
      return this.finishSignIn(tokens.request())
    }
    // 未登入：現在才開始載入 Google 元件（D-34），同時說明權限；載入完成前「繼續」不能按
    const box: { request: Promise<TokenResult> | null } = { request: null }
    const ready = tokens.prepare()
    ready.catch(() => undefined) // 載入失敗由說明視窗顯示
    return this.prompts
      .explainSignIn(
        ready,
        () => {
          box.request = tokens.request()
        },
        this.config.notice,
      )
      .then((ok) => (ok && box.request ? this.finishSignIn(box.request) : undefined))
  }

  private async finishSignIn(request: Promise<TokenResult>): Promise<void> {
    const tokens = this.deps.tokens!
    const result = await request
    if (!result.ok) {
      if (result.reason !== "popup-closed") this.prompts.notify({ type: "sign-in-failed", reason: result.reason, message: result.message })
      return
    }
    try {
      const acc = await this.deps.createAdapter(() => tokens.token()).account()
      tokens.rememberEmail(acc.email)
      const info: AccountInfo = { permissionId: acc.permissionId, email: acc.email, displayName: acc.displayName }
      // 先標記 token 的擁有者再切換資料庫：舊帳號的同步從此拿不到這個 token
      tokens.setOwner(info.permissionId)
      if (this.account?.permissionId !== info.permissionId) {
        await this.runBeforeSwitch() // 編輯中的未登入筆記先存好，才算得進「要不要加入帳號」
        const anonCount = this.account ? 0 : (await this.ws.store.getAllOwn()).filter((r) => !r.deleted).length
        this.writeAccount(info)
        await this.openNamespace(info)
        if (anonCount > 0) await this.offerAdoption(anonCount)
      } else {
        this.ws.syncer.authChanged()
        void this.ws.scheduler?.syncNow()
      }
      this.deps.requestPersistence?.()
      this.prompts.notify({ type: "signed-in", name: info.displayName })
    } catch (e) {
      if (e instanceof SwitchBlockedError) this.prompts.notify({ type: "switch-blocked" })
      else this.prompts.notify({ type: "account-read-failed", message: errorMessage(e) })
    }
  }

  /** D-05：第一次登入時詢問是否把未登入時寫的紀錄加入帳號。 */
  private async offerAdoption(count: number): Promise<void> {
    const target = this.ws
    if (!(await this.prompts.adoptAnonymous(count))) return
    // 等待回答期間帳號被切換了：不加入、也不清除匿名筆記（Codex 重構審查 B2）
    if (this.ws !== target || !this.account) return
    await this.adoptAnonymousInto(target)
  }

  /** 登入中時，這台裝置還有幾則未登入時寫、尚未加入帳號的紀錄（選了「先不要」的人可以之後再加入）。 */
  async pendingAnonymousCount(): Promise<number> {
    if (!this.account) return 0
    const anon = await this.deps.openStore(ANON_DB)
    try {
      return (await anon.getAllOwn()).filter((r) => !r.deleted).length
    } finally {
      anon.close()
    }
  }

  /** 把未登入時寫的紀錄加入目前帳號（「我的筆記」頁的按鈕；Antigravity 審查 H-02）。 */
  async adoptAnonymousNow(): Promise<void> {
    if (this.account) await this.adoptAnonymousInto(this.ws)
  }

  private async adoptAnonymousInto(target: Workspace): Promise<void> {
    const anon = await this.deps.openStore(ANON_DB)
    try {
      const n = await adoptRecords(target.repo, await anon.getAllOwn())
      await anon.clearAll()
      this.prompts.notify({ type: "adopted", count: n })
      void target.scheduler?.syncNow()
    } finally {
      anon.close()
    }
  }

  /** 未登入時清除這台裝置上的所有紀錄（公用電腦用；已登入請用登出或刪除全部）。 */
  async clearLocal(): Promise<void> {
    if (this.account) return
    await this.ws.repo.clearAll()
  }

  // ---------- 同步 ----------

  syncNow(): void {
    void this.ws.scheduler?.syncNow()
  }

  /**
   * 「先同步再編輯」（D-03、D-04）。回傳 true 代表可以開始編輯。
   * - 未登入：直接可編輯（本機模式）。
   * - 需要重新連線：詢問〔連線 Google 同步〕〔先離線編輯〕。
   * - 同步失敗：顯示離線提示，使用者確認後才可編輯。
   */
  async gateEdit(): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await this.ws.syncer.ensureFresh()
      if (r === "local" || r === "fresh") return true
      if (r === "no-token") {
        const tokens = this.deps.tokens
        const box: { request: Promise<TokenResult> | null } = { request: null }
        const choice = await this.prompts.reconnectBeforeEdit(() => {
          if (tokens?.ready && !this.inAppBrowser) box.request = tokens.request()
        })
        if (choice === "cancel") return false
        if (choice === "offline") return this.confirmOffline(false)
        if (this.inAppBrowser) {
          await this.prompts.inAppBrowser(this.inAppBrowser)
          return false
        }
        if (!box.request) {
          this.prompts.notify({ type: "google-loading" })
          return false
        }
        // 走完整登入流程：確認帳號；若選了另一個帳號就切換資料庫，這次先不開編輯器（Codex 審查 #1）
        const before = this.account?.permissionId
        await this.finishSignIn(box.request)
        if (this.account?.permissionId !== before) {
          this.prompts.notify({ type: "switched-account" })
          return false
        }
        if (!tokens?.tokenFor(before ?? "")) return false
        continue
      }
      // failed
      if (this.offlineAcknowledged && this.status.kind !== "ready") return true
      const ok = await this.confirmOffline(true)
      if (ok === "retry") continue
      return ok
    }
    return this.confirmOffline(false)
  }

  private async confirmOffline(withRetry: false): Promise<boolean>
  private async confirmOffline(withRetry: true): Promise<boolean | "retry">
  private async confirmOffline(withRetry: boolean): Promise<boolean | "retry"> {
    if (this.offlineAcknowledged) return true
    const choice = await this.prompts.offline(withRetry)
    if (choice === "retry") return "retry"
    if (choice === "ok") {
      this.offlineAcknowledged = true
      return true
    }
    return false
  }

  /** 狀態回到「已同步」後，下次失敗要重新提示（03 §5）。 */
  resetOfflineAcknowledgement(): void {
    if (this.status.kind === "ready") this.offlineAcknowledged = false
  }

  // ---------- 登出、中斷連線、刪除 ----------

  async signOut(): Promise<void> {
    if (!this.account) return
    const choice = await this.prompts.signOut((await this.repo.pendingShards()) > 0)
    if (choice !== "keep" && choice !== "clear") return
    if (!(await this.readyToSwitch())) return
    const name = accountDbName(this.account.permissionId)
    this.deps.tokens?.clear()
    // 主動登出就忘記帳號提示，下次登入可以選別的帳號（Antigravity 審查 M-09）
    this.deps.tokens?.forgetEmail()
    this.writeAccount(null)
    await this.openNamespace(null)
    if (choice === "clear") {
      // 先清空內容（其他分頁開著也能清），再盡量刪除資料庫（Codex 審查 #9）
      const s = await this.deps.openStore(name)
      await s.clearAll()
      s.close()
      await this.deps.deleteStore(name).catch(() => undefined)
    }
    this.prompts.notify({ type: "signed-out", cleared: choice === "clear" })
  }

  async disconnect(): Promise<void> {
    // 沒有有效連線時無法向 Google 撤銷授權，要先講清楚（Antigravity 審查 H-03）
    const canRevoke = !!this.account && this.deps.tokens?.tokenFor(this.account.permissionId) != null
    const hasUnsyncedChanges = (await this.repo.pendingShards()) > 0
    if (!(await this.prompts.disconnect({ canRevoke, hasUnsyncedChanges }))) return
    if (!(await this.readyToSwitch())) return
    await this.deps.tokens?.revoke()
    this.writeAccount(null)
    await this.openNamespace(null)
    this.prompts.notify({ type: "disconnected", revoked: canRevoke })
  }

  async deleteEverything(): Promise<void> {
    // 先檢查連線再問兩次確認，不要讓人按完確認才說不行（Antigravity 審查 M-03）
    if (this.account && !this.deps.tokens?.tokenFor(this.account.permissionId)) {
      this.prompts.notify({ type: "connect-before-delete" })
      return
    }
    if (!(await this.prompts.deleteAll())) return
    try {
      // 與其他分頁的同步互斥，完成後通知它們重新載入（Codex 審查 #8）
      const { syncer, scheduler } = this.ws
      if (scheduler) await scheduler.withLock(() => syncer.deleteEverything())
      else await syncer.deleteEverything()
      scheduler?.broadcastChanged()
      this.prompts.notify({ type: "deleted-all" })
    } catch (e) {
      this.prompts.notify({ type: "delete-failed", message: errorMessage(e) })
    }
  }

  async confirmReupload(): Promise<void> {
    const choice = await this.prompts.reupload()
    if (choice === "reupload") await this.ws.syncer.reuploadAfterWipe()
    else if (choice === "clear") await this.ws.syncer.acceptWipe()
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
