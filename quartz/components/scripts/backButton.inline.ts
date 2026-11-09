// backButton.inline.ts
// 聖經研讀知識庫 - 每一頁的「上一頁」按鈕（DOM 與 sessionStorage 的薄薄一層）
//
// 規則全在 backNav.ts（純函式，有單元測試）：
//   A. 讀者在站內一路點進來 → 「← 上一頁」，history.go(-n) 退到上一個「不同」頁面（不是同頁的上一個錨點）
//   B. 沒有站內上一頁（直接開連結、書籤、搜尋引擎、新分頁）→ 「↑ 創世記」（只寫上層標題），連到階層上一層
//   文字刻意不用「返回」二字，避免和 verse-return 的「↩ 返回」混淆。
//   首頁、以及沒有任何可返回目標的頁面不顯示。
// 桌機：文章標題上方、麵包屑那一區的一行小字；手機（<= 800px）：左下角浮動按鈕（樣式在 custom.scss）。
//
// 歷史怎麼記：Quartz 的 spa.inline.ts 換頁與同頁錨點都呼叫 history.pushState，這裡包一層 pushState，
// 在每個歷史項目的 state 寫上位置（bwzPos），並把「位置 → 頁面」的清單存在 sessionStorage（只活在這個分頁）。
// 返回／前進／重新整理不呼叫 pushState，但瀏覽器會還原該項目的 state，所以位置自然對得回來。

import { FullSlug, getFullSlug, resolveRelative } from "../../util/path"
import { NavHistory, decideBack, pushEntry, stepsToPreviousPage, syncHistory } from "./backNav"

const BTN_CLASS = "bwz-bb"
const STORAGE_KEY = "bwz-back-nav"
const POS_KEY = "bwzPos"

let hist: NavHistory | null = null

function load(): NavHistory | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as NavHistory) : null
  } catch {
    // 隱私模式或儲存空間被擋：照樣能用，只是重新整理後歷史會斷掉（退回 B 模式）
    return null
  }
}

function save(h: NavHistory) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h))
  } catch {}
}

function statePos(): number | undefined {
  const pos = (history.state as Record<string, unknown> | null)?.[POS_KEY]
  return typeof pos === "number" ? pos : undefined
}

/** 把記錄對回瀏覽器現況（返回、前進、重新整理之後位置會變），必要時在目前的歷史項目補上位置 */
function syncNow(): NavHistory {
  hist = syncHistory(hist ?? load(), statePos(), location.pathname)
  if (statePos() !== hist.pos) {
    history.replaceState({ ...(history.state ?? {}), [POS_KEY]: hist.pos }, "")
  }
  save(hist)
  return hist
}

/** 包住 pushState：換頁與同頁錨點都會經過這裡，在新項目的 state 寫上位置 */
function installPushStateHook() {
  const original = history.pushState.bind(history)
  history.pushState = (state: unknown, unused: string, url?: string | URL | null) => {
    const current = syncNow()
    const target = url == null ? location.pathname : new URL(String(url), location.href).pathname
    const next = pushEntry(current, target)
    original({ ...((state as object | null) ?? {}), [POS_KEY]: next.pos }, unused, url)
    hist = next
    save(next)
  }
}

function removeButtons() {
  document.querySelectorAll(`.${BTN_CLASS}`).forEach((el) => el.remove())
}

function fill(el: HTMLElement, arrowText: string, text: string, aria: string) {
  const arrow = document.createElement("span")
  arrow.setAttribute("aria-hidden", "true")
  arrow.textContent = arrowText
  const label = document.createElement("span")
  label.className = `${BTN_CLASS}-text`
  label.textContent = text
  el.append(arrow, label)
  el.setAttribute("aria-label", aria)
  el.title = aria
}

let token = 0

async function setupButton() {
  removeButtons()
  const mine = ++token
  const slug = document.body.dataset.slug ?? getFullSlug(window)
  if (slug === "index") return

  // 以 contentIndex 為準：只連到真的有頁面的上層（資料夾頁也在裡面）
  const index: Record<string, string> = {}
  try {
    const data = await fetchData
    for (const [key, value] of Object.entries(data)) index[key] = String(value?.title ?? "")
  } catch {}
  // 等待期間讀者又換頁了：交給新的那一次
  if (mine !== token) return

  const decision = decideBack(slug, syncNow(), index)
  if (!decision) return

  let btn: HTMLElement
  if (decision.kind === "history") {
    const b = document.createElement("button")
    b.type = "button"
    fill(b, "←", "上一頁", "回到上一頁")
    b.addEventListener("click", () => {
      // 按下時再算一次：中間可能已用瀏覽器的返回鍵退過
      const steps = stepsToPreviousPage(syncNow())
      if (steps === null) history.back()
      else history.go(-steps)
    })
    btn = b
  } else {
    const a = document.createElement("a")
    a.href = resolveRelative(slug as FullSlug, decision.slug as FullSlug)
    fill(a, "↑", decision.title, `回到${decision.title}`)
    btn = a
  }
  btn.className = `${BTN_CLASS} ${BTN_CLASS}-${decision.kind === "history" ? "history" : "parent"}`

  // 桌機放在麵包屑上方；找不到麵包屑就放到 body（手機是 position: fixed，放哪裡都一樣）
  const crumbs = document.querySelector(".breadcrumb-container")
  if (crumbs?.parentElement) crumbs.parentElement.insertBefore(btn, crumbs)
  else document.body.append(btn)

  window.addCleanup?.(removeButtons)
}

installPushStateHook()
syncNow()
document.addEventListener("nav", () => {
  void setupButton()
})
// 不確定第一次 nav 事件發在本檔載入前還是後，所以載入時自己跑一次（token 會讓重複的那次作廢）；之後每次換頁由 nav 事件觸發
void setupButton()
