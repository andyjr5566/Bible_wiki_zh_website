// Google 登入（GIS Token model，D-16、D-20）。同步只需要 drive.appdata（D-11）；
// 使用者第一次按「存一份到我的 Google Drive」時才加申請 drive.file，之後續期兩個一起要（D-45）。
// 重要（PoC 確認）：GIS 必須在按下「開啟 Google 視窗」的那一下之前就載入並初始化；點擊處理函式要同步呼叫 request()，
// 中間不能有 await，否則瀏覽器會失去使用者手勢、封鎖彈窗（03 §7）。
// 何時載入見 D-34：未登入的人按下「用 Google 同步」之前，本站不會連到 Google。

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata"
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

const GIS_SRC = "https://accounts.google.com/gsi/client"
const TOKEN_KEY = "bwz-notes-token" // sessionStorage：只在同一分頁內有效
const HINT_KEY = "bwz-notes-login-hint" // localStorage：上次登入的 email，用來跳過選帳號
const BACKUP_GRANT_PREFIX = "bwz-notes-drive-file-" // localStorage：這個帳號（permissionId 或 email）開過 drive.file
const EXPIRY_MARGIN_MS = 2 * 60 * 1000

type Listener = () => void

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

function grantKey(identity: string): string {
  return BACKUP_GRANT_PREFIX + encodeURIComponent(identity)
}

let gisPromise: Promise<void> | null = null

export function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisPromise = null
      reject(new Error("無法載入 Google 登入元件，請檢查網路"))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

/** Google 授權視窗回傳錯誤時給使用者看的說明（應用程式已是正式版，不再提試用名單，12 A4）。 */
export function tokenErrorMessage(error: string, description?: string): string {
  if (error === "access_denied") return "沒有完成 Google 授權（在授權視窗按了取消，或沒有勾選存取權限）。可以再按一次「用 Google 同步」重試。"
  return description || error
}

export type TokenResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "no-scope" | "popup-closed" | "popup-blocked" | "error"; message: string }

export class TokenManager {
  private client: any = null
  private accessToken: string | null = null
  private expiresAt = 0
  /** 目前 token 屬於哪個 Google 帳號（permissionId）。取得新 token 後為 null，直到用 about.get 確認（Codex 審查 #1、#7）。 */
  private owner: string | null = null
  /** 目前這個 token 有沒有 drive.file。 */
  private backupGranted = false
  private listeners = new Set<Listener>()
  private pending: ((r: TokenResult) => void) | null = null
  /** 這次請求是不是「一定要拿到 drive.file」（第一次手動備份）。 */
  private requestedBackup = false
  private preparing: Promise<void> | null = null

  constructor(private readonly clientId: string) {
    const saved = safe(() => JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null"), null) as {
      token: string
      expiresAt: number
      owner?: string | null
      backupGranted?: boolean
    } | null
    if (saved && saved.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      this.accessToken = saved.token
      this.expiresAt = saved.expiresAt
      this.owner = saved.owner ?? null
      this.backupGranted = saved.backupGranted === true
    }
  }

  get ready(): boolean {
    return this.client !== null
  }

  /**
   * 載入 GIS 並初始化（可重複呼叫）。何時呼叫由 session 決定（D-34）：
   * 曾登入過的裝置在啟動時；未登入的人要等按下「用 Google 同步」才載入。
   */
  prepare(): Promise<void> {
    if (this.client) return Promise.resolve()
    if (!this.preparing) {
      this.preparing = loadGis().then(
        () => {
          const g = (window as any).google
          this.client = g.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: DRIVE_APPDATA_SCOPE,
            prompt: "",
            include_granted_scopes: false,
            callback: (resp: any) => this.onToken(resp),
            error_callback: (err: any) => this.onError(err),
          })
        },
        (e: unknown) => {
          this.preparing = null
          throw e
        },
      )
    }
    return this.preparing
  }

  token(): string | null {
    if (this.accessToken && this.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return this.accessToken
    return null
  }

  hasToken(): boolean {
    return this.token() !== null
  }

  /** 只有在 token 已確認屬於指定帳號時才回傳（同步一律用這個）。 */
  tokenFor(permissionId: string): string | null {
    return this.owner === permissionId ? this.token() : null
  }

  /** 目前有效、已確認屬於這個帳號的 token 有沒有 drive.file（看這個 token，不是看以前開過沒有）。 */
  hasBackupScope(permissionId: string): boolean {
    return this.tokenFor(permissionId) !== null && this.backupGranted
  }

  /** 用 about.get 確認帳號後呼叫。 */
  setOwner(permissionId: string): void {
    this.owner = permissionId
    if (this.backupGranted) {
      // 換分頁或 token 過期後 owner 是空的，續期只能靠記住的 email 判斷要不要一起申請 drive.file（Gemini 審查 F3a #1）
      this.rememberBackupGrant(permissionId)
      const hint = safe(() => localStorage.getItem(HINT_KEY), null)
      if (hint) this.rememberBackupGrant(hint)
    }
    this.persist()
    this.emit()
  }

  private rememberBackupGrant(identity: string): void {
    safe(() => localStorage.setItem(grantKey(identity), "1"), undefined)
  }

  private hadBackupGrant(): boolean {
    const hint = safe(() => localStorage.getItem(HINT_KEY), null)
    return (
      (this.owner !== null && safe(() => localStorage.getItem(grantKey(this.owner!)), null) === "1") ||
      (hint !== null && safe(() => localStorage.getItem(grantKey(hint)), null) === "1")
    )
  }

  private persist(): void {
    safe(
      () =>
        sessionStorage.setItem(
          TOKEN_KEY,
          JSON.stringify({
            token: this.accessToken,
            expiresAt: this.expiresAt,
            owner: this.owner,
            backupGranted: this.backupGranted,
          }),
        ),
      undefined,
    )
  }

  /** 距離過期還有多久（毫秒），沒有 token 回傳 0。 */
  remainingMs(): number {
    return this.token() ? this.expiresAt - Date.now() : 0
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  /**
   * 要求 token（登入或續期）。必須在點擊事件中「同步」呼叫（不可先 await 別的東西）。
   * 回傳的 Promise 在使用者完成或關閉彈窗後才結束。曾開過 drive.file 的帳號兩個範圍一起申請，
   * 否則只申請 drive.appdata —— 只要 drive.file 的 token 不能同步，又會蓋掉唯一的 token。
   */
  request(): Promise<TokenResult> {
    return this.requestScopes(this.hadBackupGrant(), false)
  }

  /** 第一次按「存一份到我的 Google Drive」：在那一下點擊裡同步呼叫，兩個範圍一起申請。 */
  requestBackupScope(): Promise<TokenResult> {
    return this.requestScopes(true, true)
  }

  private requestScopes(includeBackup: boolean, requireBackup: boolean): Promise<TokenResult> {
    if (!this.client) {
      return Promise.resolve({ ok: false, reason: "error", message: "Google 登入元件尚未準備好，請稍候再按一次" })
    }
    const hint = safe(() => localStorage.getItem(HINT_KEY), null)
    this.requestedBackup = requireBackup
    const result = new Promise<TokenResult>((resolve) => {
      this.pending = resolve
    })
    this.client.requestAccessToken({
      prompt: "",
      scope: includeBackup ? `${DRIVE_APPDATA_SCOPE} ${DRIVE_FILE_SCOPE}` : DRIVE_APPDATA_SCOPE,
      ...(hint ? { login_hint: hint } : {}),
    })
    return result
  }

  private settle(r: TokenResult): void {
    const pending = this.pending
    this.pending = null
    pending?.(r)
  }

  private onToken(resp: any): void {
    const oauth2 = (window as any).google.accounts.oauth2
    if (resp.error) {
      this.settle({ ok: false, reason: "denied", message: tokenErrorMessage(resp.error, resp.error_description) })
      return
    }
    if (!oauth2.hasGrantedAllScopes(resp, DRIVE_APPDATA_SCOPE)) {
      this.settle({ ok: false, reason: "denied", message: "沒有同意存取筆記資料夾的權限" })
      return
    }

    const backupGranted = oauth2.hasGrantedAllScopes(resp, DRIVE_FILE_SCOPE)
    this.accessToken = resp.access_token
    this.expiresAt = Date.now() + Number(resp.expires_in) * 1000
    this.owner = null // 新 token 尚未確認屬於哪個帳號
    this.backupGranted = backupGranted
    this.persist()
    this.emit()

    // 使用者在同意畫面沒勾 drive.file：token 照樣保留給同步用，只回報這次沒拿到 Drive 權限
    if (this.requestedBackup && !backupGranted) {
      this.settle({ ok: false, reason: "no-scope", message: "沒有取得 Google Drive 權限" })
    } else {
      this.settle({ ok: true })
    }
  }

  private onError(err: any): void {
    const type = err?.type
    if (type === "popup_closed") this.settle({ ok: false, reason: "popup-closed", message: "登入視窗已關閉" })
    else if (type === "popup_failed_to_open") this.settle({ ok: false, reason: "popup-blocked", message: "登入視窗被瀏覽器擋住了" })
    else this.settle({ ok: false, reason: "error", message: err?.message || "登入失敗" })
  }

  rememberEmail(email: string): void {
    safe(() => localStorage.setItem(HINT_KEY, email), undefined)
    if (this.backupGranted) this.rememberBackupGrant(email)
  }

  /** 公用電腦登出並清除時，連同記住的 email 一起清掉（Antigravity 審閱 #6）。 */
  forgetEmail(): void {
    safe(() => localStorage.removeItem(HINT_KEY), undefined)
  }

  /** 忘記 token（登出）。 */
  clear(): void {
    this.accessToken = null
    this.expiresAt = 0
    this.owner = null
    this.backupGranted = false
    safe(() => sessionStorage.removeItem(TOKEN_KEY), undefined)
    this.emit()
  }

  /** 撤銷本網站的所有授權（中斷與 Google 的連線），也忘記「開過 drive.file」。 */
  revoke(): Promise<void> {
    const token = this.accessToken
    const owner = this.owner
    const hint = safe(() => localStorage.getItem(HINT_KEY), null)
    this.clear()
    this.forgetEmail()
    if (owner) safe(() => localStorage.removeItem(grantKey(owner)), undefined)
    if (hint) safe(() => localStorage.removeItem(grantKey(hint)), undefined)
    if (!token || !(window as any).google?.accounts?.oauth2) return Promise.resolve()
    return new Promise((resolve) => (window as any).google.accounts.oauth2.revoke(token, () => resolve()))
  }
}
