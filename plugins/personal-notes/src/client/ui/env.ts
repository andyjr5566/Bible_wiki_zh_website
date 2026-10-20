// 瀏覽器環境偵測（內建瀏覽器、主畫面 App、裝置名稱）。只在瀏覽器端使用。

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** 主要輸入方式：觸控為主（手機、平板）→ "touch"；滑鼠／觸控板 → "desktop"（D-51）。觸控筆電的主要指標是觸控板，算 desktop。 */
export type InputKind = "touch" | "desktop"

export function primaryInput(): InputKind {
  return safe(() => (matchMedia("(pointer: coarse)").matches ? "touch" : "desktop"), "desktop")
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
  return safe(() => window.matchMedia("(display-mode: standalone)").matches, false) || (navigator as Navigator & { standalone?: boolean }).standalone === true
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
