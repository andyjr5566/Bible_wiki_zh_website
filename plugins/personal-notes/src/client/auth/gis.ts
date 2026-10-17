// Google 登入（GIS Token model，D-16、D-20）。只申請 drive.appdata（D-11）。
//
// 重要（PoC 確認）：GIS 必須「預先」載入並初始化；點擊處理函式要同步呼叫 request()，
// 中間不能有 await，否則瀏覽器會失去使用者手勢、封鎖彈窗（03 §7）。

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata"
const GIS_SRC = "https://accounts.google.com/gsi/client"
const TOKEN_KEY = "bwz-notes-token" // sessionStorage：只在同一分頁內有效
const HINT_KEY = "bwz-notes-login-hint" // localStorage：上次登入的 email，用來跳過選帳號
const EXPIRY_MARGIN_MS = 2 * 60 * 1000

type Listener = () => void

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
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

export type TokenResult = { ok: true } | { ok: false; reason: "denied" | "popup-closed" | "popup-blocked" | "error"; message: string }

export class TokenManager {
  private client: any = null
  private accessToken: string | null = null
  private expiresAt = 0
  private listeners = new Set<Listener>()
  private pending: ((r: TokenResult) => void) | null = null

  constructor(private readonly clientId: string) {
    const saved = safe(() => JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null"), null) as {
      token: string
      expiresAt: number
    } | null
    if (saved && saved.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      this.accessToken = saved.token
      this.expiresAt = saved.expiresAt
    }
  }

  get ready(): boolean {
    return this.client !== null
  }

  /** 預先載入 GIS 並初始化（在筆記面板出現時呼叫）。 */
  async prepare(): Promise<void> {
    if (this.client) return
    await loadGis()
    const g = (window as any).google
    this.client = g.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: DRIVE_APPDATA_SCOPE,
      prompt: "",
      include_granted_scopes: false,
      callback: (resp: any) => this.onToken(resp),
      error_callback: (err: any) => this.onError(err),
    })
  }

  token(): string | null {
    if (this.accessToken && this.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return this.accessToken
    return null
  }

  hasToken(): boolean {
    return this.token() !== null
  }

  /** 距離過期還有多久（毫秒），沒有 token 回傳 0。 */
  remainingMs(): number {
    return this.token() ? this.expiresAt - Date.now() : 0
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  /**
   * 要求 token。必須在點擊事件中「同步」呼叫（不可先 await 別的東西）。
   * 回傳的 Promise 在使用者完成或關閉彈窗後才結束。
   */
  request(): Promise<TokenResult> {
    if (!this.client) {
      return Promise.resolve({ ok: false, reason: "error", message: "Google 登入元件尚未準備好，請稍候再按一次" })
    }
    const hint = safe(() => localStorage.getItem(HINT_KEY), null)
    const result = new Promise<TokenResult>((resolve) => {
      this.pending = resolve
    })
    this.client.requestAccessToken({ prompt: "", ...(hint ? { login_hint: hint } : {}) })
    return result
  }

  private settle(r: TokenResult) {
    const p = this.pending
    this.pending = null
    p?.(r)
  }

  private onToken(resp: any) {
    const g = (window as any).google
    if (resp.error) {
      this.settle({ ok: false, reason: "denied", message: resp.error_description || resp.error })
      return
    }
    if (!g.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_APPDATA_SCOPE)) {
      this.settle({ ok: false, reason: "denied", message: "沒有同意存取筆記資料夾的權限" })
      return
    }
    this.accessToken = resp.access_token
    this.expiresAt = Date.now() + Number(resp.expires_in) * 1000
    safe(() => sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: this.accessToken, expiresAt: this.expiresAt })), undefined)
    this.emit()
    this.settle({ ok: true })
  }

  private onError(err: any) {
    const type = err?.type
    if (type === "popup_closed") this.settle({ ok: false, reason: "popup-closed", message: "登入視窗已關閉" })
    else if (type === "popup_failed_to_open") this.settle({ ok: false, reason: "popup-blocked", message: "登入視窗被瀏覽器擋住了" })
    else this.settle({ ok: false, reason: "error", message: err?.message || "登入失敗" })
  }

  rememberEmail(email: string): void {
    safe(() => localStorage.setItem(HINT_KEY, email), undefined)
  }

  /** 忘記 token（登出）。 */
  clear(): void {
    this.accessToken = null
    this.expiresAt = 0
    safe(() => sessionStorage.removeItem(TOKEN_KEY), undefined)
    this.emit()
  }

  /** 撤銷本網站的所有授權（中斷與 Google 的連線）。 */
  revoke(): Promise<void> {
    const token = this.accessToken
    this.clear()
    safe(() => localStorage.removeItem(HINT_KEY), undefined)
    if (!token || !(window as any).google?.accounts?.oauth2) return Promise.resolve()
    return new Promise((resolve) => (window as any).google.accounts.oauth2.revoke(token, () => resolve()))
  }
}

/** 內建瀏覽器偵測（D-21）：Google 會拒絕在這些環境登入。 */
export function detectInAppBrowser(ua: string = navigator.userAgent): string | null {
  if (/\bLine\//i.test(ua)) return "LINE"
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "Facebook"
  if (/Instagram/i.test(ua)) return "Instagram"
  if (/MicroMessenger/i.test(ua)) return "WeChat"
  return null
}

export function isStandalone(): boolean {
  return safe(() => window.matchMedia("(display-mode: standalone)").matches, false) || (navigator as any).standalone === true
}

export function isIOS(ua: string = navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

/** 裝置顯示名稱（寫進裝置登記檔，方便日後辨認）。 */
export function deviceLabel(ua: string = navigator.userAgent): string {
  const os = isIOS(ua) ? (/iPad/.test(ua) ? "iPad" : "iPhone") : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : "其他"
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "瀏覽器"
  return `${os} ${browser}${isStandalone() ? "（主畫面）" : ""}`
}
