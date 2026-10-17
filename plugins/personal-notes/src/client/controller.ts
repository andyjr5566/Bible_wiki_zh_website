// 控制中心：帳號／登入／同步／「先同步再編輯」流程（03 §5、§7、§8；D-03、D-04、D-05、D-21、D-22、D-23）。
// 頁面上的各個畫面（章節面板、我的筆記頁）都透過這裡操作，不直接碰引擎與 Google。

import { DriveAdapter } from "./adapter/drive"
import { TokenManager, detectInAppBrowser, deviceLabel } from "./auth/gis"
import { NotesEngine, type EngineStatus } from "./sync/engine"
import { SyncScheduler } from "./sync/scheduler"
import { ANON_DB, NotesStore, accountDbName } from "./store/db"
import { dialog, h, toast } from "./ui/dom"

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

const ACCOUNT_KEY = "bwz-notes-account" // localStorage：這台裝置上次登入的帳號
const PERMISSION_EXPLAINED_KEY = "bwz-notes-permission-explained"

function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 私密瀏覽等情況無法寫入，不影響本次使用
  }
}

type Listener = () => void

export class Controller {
  engine!: NotesEngine
  account: AccountInfo | null = null
  readonly tokens: TokenManager | null
  readonly inAppBrowser = detectInAppBrowser()
  private store!: NotesStore
  private scheduler: SyncScheduler | null = null
  private listeners = new Set<Listener>()
  private unsubscribe: (() => void)[] = []
  /** 本次工作階段已確認過離線提示（D-04：不要每開一則就跳一次）。 */
  private offlineAcknowledged = false

  constructor(readonly config: ClientConfig) {
    this.tokens = config.syncEnabled && config.clientId ? new TokenManager(config.clientId) : null
  }

  get syncAvailable(): boolean {
    return this.tokens !== null
  }

  async init(): Promise<void> {
    const saved = this.syncAvailable ? readJson<AccountInfo>(ACCOUNT_KEY) : null
    await this.openNamespace(saved)
    this.tokens?.onChange(() => {
      this.engine.authChanged()
      this.emit()
    })
    // 預先載入 Google 登入元件，之後點擊才能同步開啟彈窗（03 §7）
    if (this.tokens && !this.inAppBrowser) this.tokens.prepare().catch(() => undefined)
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  get status(): EngineStatus {
    return this.engine.status
  }

  /** 切換到某個帳號（或未登入）的本機資料庫，並視情況啟動同步。 */
  private async openNamespace(account: AccountInfo | null): Promise<void> {
    this.scheduler?.stop()
    this.scheduler = null
    for (const fn of this.unsubscribe) fn()
    this.unsubscribe = []
    this.store?.close()

    this.account = account
    this.store = await NotesStore.open(account ? accountDbName(account.permissionId) : ANON_DB)
    this.engine = await NotesEngine.create({
      store: this.store,
      maxWritesPerMinute: this.config.maxWritesPerMinute,
      appVersion: this.config.appVersion,
      deviceLabel: deviceLabel(),
    })
    this.unsubscribe.push(this.engine.onChange(() => this.emit()))
    this.unsubscribe.push(this.engine.onStatus(() => this.emit()))

    if (account && this.tokens) {
      const tokens = this.tokens
      const adapter = new DriveAdapter({ getToken: () => tokens.token(), maxCallsPerMinute: 60 })
      this.engine.setAdapter(adapter, () => tokens.hasToken())
      this.scheduler = new SyncScheduler({
        engine: this.engine,
        namespace: account.permissionId,
        minPollSeconds: this.config.minPollSeconds,
      })
      this.scheduler.start()
    } else {
      this.engine.setAdapter(null)
    }
    this.emit()
  }

  // ---------- 登入 ----------

  /**
   * 「用 Google 同步」或「點一下繼續同步」按鈕的點擊處理。必須在點擊事件中直接呼叫（不可先 await）。
   * 第一次登入會先說明權限，使用者在說明視窗按「繼續」時才開啟 Google 彈窗。
   */
  signInFromClick(): void {
    if (!this.tokens) return
    if (this.inAppBrowser) {
      void this.showInAppGuidance()
      return
    }
    if (!this.tokens.ready) {
      toast("Google 登入元件載入中，請稍候再按一次")
      this.tokens.prepare().catch((e) => toast(e instanceof Error ? e.message : "無法載入 Google 登入"))
      return
    }
    let explained = false
    try {
      explained = localStorage.getItem(PERMISSION_EXPLAINED_KEY) === "1"
    } catch {
      // 忽略
    }
    if (explained || this.account) {
      void this.finishSignIn(this.tokens.request())
      return
    }
    let pending: ReturnType<TokenManager["request"]> | null = null
    const tokens = this.tokens
    void dialog({
      title: "用 Google 帳號同步筆記",
      message: h(
        "div",
        null,
        h("p", { text: "登入後，你的筆記會存到你自己的 Google 雲端硬碟裡一個「隱藏的筆記資料夾」，在手機、平板、電腦都能看到同一份筆記。" }),
        h("p", { text: "本站只能存取它自己建立的這個資料夾，看不到你雲端硬碟裡的任何其他檔案。筆記不會經過本站的伺服器。" }),
      ),
      buttons: [
        { id: "go", label: "繼續", kind: "primary", run: () => (pending = tokens.request()) },
        { id: "cancel", label: "取消" },
      ],
    }).then((id) => {
      if (id === "go" && pending) {
        try {
          localStorage.setItem(PERMISSION_EXPLAINED_KEY, "1")
        } catch {
          // 忽略
        }
        void this.finishSignIn(pending)
      }
    })
  }

  private async finishSignIn(request: ReturnType<TokenManager["request"]>): Promise<void> {
    const result = await request
    if (!result.ok) {
      if (result.reason !== "popup-closed") toast(result.message)
      return
    }
    try {
      const probe = new DriveAdapter({ getToken: () => this.tokens!.token() })
      const acc = await probe.account()
      this.tokens!.rememberEmail(acc.email)
      const info: AccountInfo = { permissionId: acc.permissionId, email: acc.email, displayName: acc.displayName }
      if (this.account?.permissionId !== info.permissionId) {
        const anonRecords = this.account ? [] : await this.store.getAllOwn()
        const anonStore = this.account ? null : this.store
        writeJson(ACCOUNT_KEY, info)
        await this.openNamespace(info)
        if (anonStore && anonRecords.length > 0) await this.offerAdoption(anonRecords.length)
      } else {
        this.engine.authChanged()
        void this.scheduler?.syncNow()
      }
      void navigator.storage?.persist?.().catch(() => undefined)
      toast(`已登入：${info.displayName}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : "登入後讀取帳號資料失敗")
    }
  }

  /** D-05：第一次登入時詢問是否把未登入時寫的筆記加入帳號。 */
  private async offerAdoption(count: number): Promise<void> {
    const choice = await dialog({
      title: "加入未登入時寫的筆記？",
      message: `這台裝置上有 ${count} 則未登入時寫的筆記。要把它們加入這個 Google 帳號、一起同步嗎？（如果這是公用電腦，請選「先不要」）`,
      buttons: [
        { id: "adopt", label: "加入", kind: "primary" },
        { id: "skip", label: "先不要" },
      ],
      dismissible: false,
    })
    if (choice !== "adopt") return
    const anon = await NotesStore.open(ANON_DB)
    try {
      const n = await this.engine.adoptRecords(await anon.getAllOwn())
      await anon.clearAll()
      toast(`已加入 ${n} 則筆記`)
      void this.scheduler?.syncNow()
    } finally {
      anon.close()
    }
  }

  /** D-21：LINE 等內建瀏覽器無法登入，引導改用 Safari／Chrome。 */
  async showInAppGuidance(): Promise<void> {
    const url = new URL(location.href)
    url.searchParams.set("openExternalBrowser", "1")
    const choice = await dialog({
      title: `請用 Safari 或 Chrome 開啟`,
      message: `${this.inAppBrowser} 內建的瀏覽器無法登入 Google。請改用 Safari 或 Chrome 開啟本頁，就能同步筆記。在這裡寫的筆記仍會先存在這個瀏覽器裡。`,
      buttons: [
        { id: "open", label: "用外部瀏覽器開啟", kind: "primary", run: () => location.assign(url.toString()) },
        { id: "copy", label: "複製網址" },
        { id: "close", label: "關閉" },
      ],
    })
    if (choice === "copy") {
      try {
        await navigator.clipboard.writeText(location.href)
        toast("已複製網址")
      } catch {
        toast(location.href)
      }
    }
  }

  // ---------- 同步 ----------

  syncNow(): void {
    void this.scheduler?.syncNow()
  }

  /**
   * 「先同步再編輯」（D-03、D-04）。回傳 true 代表可以開始編輯。
   * - 未登入：直接可編輯（本機模式）。
   * - 需要重新連線：詢問〔連線 Google 同步〕〔先離線編輯〕。
   * - 同步失敗：顯示離線提示，使用者確認後才可編輯。
   */
  async gateEdit(): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await this.engine.ensureFresh()
      if (r === "local" || r === "fresh") return true
      if (r === "no-token") {
        const tokens = this.tokens
        let pending: ReturnType<TokenManager["request"]> | null = null
        const choice = await dialog({
          title: "要先連線 Google 同步嗎？",
          message: "為了確保你看到的是最新的筆記，編輯前會先和雲端同步。",
          buttons: [
            {
              id: "connect",
              label: "連線 Google 同步",
              kind: "primary",
              run: () => {
                if (tokens?.ready && !this.inAppBrowser) pending = tokens.request()
              },
            },
            { id: "offline", label: "先離線編輯" },
            { id: "cancel", label: "取消" },
          ],
        })
        if (choice === "cancel" || choice === null) return false
        if (choice === "connect") {
          if (this.inAppBrowser) {
            await this.showInAppGuidance()
            return false
          }
          if (!pending) {
            toast("Google 登入元件載入中，請稍候再試")
            return false
          }
          const res = await (pending as ReturnType<TokenManager["request"]>)
          if (!res.ok) {
            if (res.reason !== "popup-closed") toast(res.message)
            return false
          }
          continue
        }
        return this.confirmOffline()
      }
      // failed
      if (this.offlineAcknowledged && this.engine.status.kind !== "ready") return true
      const ok = await this.confirmOffline(true)
      if (ok === "retry") continue
      return ok
    }
    return this.confirmOffline()
  }

  private async confirmOffline(): Promise<boolean>
  private async confirmOffline(withRetry: true): Promise<boolean | "retry">
  private async confirmOffline(withRetry = false): Promise<boolean | "retry"> {
    if (this.offlineAcknowledged) return true
    const choice = await dialog({
      title: "目前無法與雲端同步",
      message: h(
        "div",
        null,
        h("p", { text: "（沒有網路或尚未連線 Google）" }),
        h("p", { text: "你現在的修改會先存在這台裝置，恢復連線後會自動合併。" }),
        h("p", { text: "如果其他裝置也修改過同一則筆記，系統會保留兩個版本讓你選擇。" }),
      ),
      buttons: [
        ...(withRetry ? [{ id: "retry", label: "重試同步" }] : []),
        { id: "ok", label: "我知道了，繼續編輯", kind: "primary" as const },
        { id: "cancel", label: "取消" },
      ],
    })
    if (choice === "retry") return "retry"
    if (choice === "ok") {
      this.offlineAcknowledged = true
      return true
    }
    return false
  }

  /** 狀態回到「已同步」後，下次失敗要重新提示（03 §5）。 */
  resetOfflineAcknowledgement(): void {
    if (this.engine.status.kind === "ready") this.offlineAcknowledged = false
  }

  // ---------- 登出、中斷連線、刪除 ----------

  async signOut(): Promise<void> {
    if (!this.account) return
    const pending = await this.engine.pendingShards()
    const choice = await dialog({
      title: "登出",
      message: h(
        "div",
        null,
        pending > 0 ? h("p", { class: "bwz-n-warn", text: "注意：還有修改尚未上傳到雲端。如果清除這台裝置上的筆記，這些修改會遺失。" }) : null,
        h("p", { text: "「保留」：筆記留在這台裝置，下次登入同一個帳號時繼續使用。" }),
        h("p", { text: "「清除」：刪除這台裝置上的筆記（雲端上的不受影響）。公用電腦請選清除。" }),
      ),
      buttons: [
        { id: "keep", label: "保留這台裝置上的筆記", kind: "primary" },
        { id: "clear", label: "清除這台裝置上的筆記", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    if (choice !== "keep" && choice !== "clear") return
    const name = accountDbName(this.account.permissionId)
    this.tokens?.clear()
    writeJson(ACCOUNT_KEY, null)
    await this.openNamespace(null)
    if (choice === "clear") await NotesStore.deleteDatabase(name)
    toast("已登出")
  }

  async disconnect(): Promise<void> {
    const choice = await dialog({
      title: "中斷與 Google 的連線",
      message: "這會撤銷本站存取你 Google 雲端硬碟筆記資料夾的授權並登出。雲端上的筆記不會被刪除，之後重新登入即可繼續使用。",
      buttons: [
        { id: "ok", label: "中斷連線", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    if (choice !== "ok") return
    await this.tokens?.revoke()
    writeJson(ACCOUNT_KEY, null)
    await this.openNamespace(null)
    toast("已中斷連線")
  }

  async deleteEverything(): Promise<void> {
    const first = await dialog({
      title: "刪除全部筆記",
      message: "這會刪除你在 Google 雲端硬碟上本站的所有筆記，以及這台裝置上的筆記，無法復原。建議先按「匯出備份」。",
      buttons: [
        { id: "next", label: "我了解，繼續", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    if (first !== "next") return
    const second = await dialog({
      title: "最後確認",
      message: "真的要刪除全部筆記嗎？",
      buttons: [
        { id: "delete", label: "刪除全部", kind: "danger" },
        { id: "cancel", label: "取消", kind: "primary" },
      ],
    })
    if (second !== "delete") return
    if (this.account && !this.tokens?.hasToken()) {
      toast("請先「連線 Google 同步」，才能刪除雲端上的筆記")
      return
    }
    try {
      await this.engine.deleteEverything()
      toast("已刪除全部筆記")
    } catch (e) {
      toast(e instanceof Error ? e.message : "刪除失敗，請稍後再試")
    }
  }

  async confirmReupload(): Promise<void> {
    const choice = await dialog({
      title: "雲端的筆記資料似乎被刪除了",
      message:
        "可能是在 Google 雲端硬碟的「管理應用程式」中刪除了本站的隱藏資料。這台裝置上還有筆記，要用這台裝置的資料重新上傳嗎？",
      buttons: [
        { id: "reupload", label: "重新上傳", kind: "primary" },
        { id: "later", label: "稍後再說" },
      ],
    })
    if (choice === "reupload") await this.engine.reuploadAfterWipe()
  }
}
