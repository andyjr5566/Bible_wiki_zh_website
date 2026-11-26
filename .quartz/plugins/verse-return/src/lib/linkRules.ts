// 哪些點擊「算數」：只有真的會在這個分頁換到別頁的站內連結才記返回點。
// 純函式，DOM 層（recorder.ts）只把事件與連結的值丟進來；這樣規則可以直接單元測試。

export interface ClickLike {
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export interface LinkLike {
  /** 已解析成絕對網址的 href（a.href） */
  href: string
  target?: string | null
  download?: boolean
}

/** 一般的左鍵點擊。按住修飾鍵（新分頁、新視窗、下載）不會在這個分頁換頁，所以不記。 */
export function isPlainLeftClick(event: ClickLike): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
}

/** 站內換頁連結：同網站、不同頁面。外部連結、同頁錨點、另開分頁、下載都不算。 */
export function isInternalPageLink(link: LinkLike, pageHref: string): boolean {
  if (link.download) return false
  if (link.target && link.target !== "_self") return false
  let to: URL
  let here: URL
  try {
    to = new URL(link.href)
    here = new URL(pageHref)
  } catch {
    return false
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") return false
  if (to.origin !== here.origin) return false
  return to.pathname !== here.pathname
}

// 懸停預覽：讀者從經文某一節的連結打開預覽，再點預覽裡的連結離開。預覽是掛在 body 底下的獨立元素，
// 點擊時已經不知道「是從哪一節打開的」，所以滑過連結時先記下來源，點預覽時再取用。
// 預覽關掉之後這個來源不該再生效，但關掉預覽沒有事件可聽，所以用時限當保險。
export const POPOVER_SOURCE_TTL_MS = 45 * 1000

export interface TimedSource<T> {
  point: T
  t: number
}

export function popoverSourceValid<T>(source: TimedSource<T> | null | undefined, now: number): source is TimedSource<T> {
  if (!source) return false
  const age = now - source.t
  return age >= 0 && age <= POPOVER_SOURCE_TTL_MS
}
