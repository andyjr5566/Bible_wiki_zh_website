// knowledgeHub.inline.ts
// 知識節點（link_folder）類別頁的篩選：關鍵字、書卷，以及總入口的搜尋按鈕。
// HTML 是建置時由 quartz/util/knowledgeHast.ts 插進頁面的，沒有這支腳本時清單照常顯示，只是不能篩選。
// 篩選條件寫進網址（?q=、?book=），重新整理或分享連結時維持同一個畫面。

const FILTERED = "data-filtered"

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "")
}

function readParams(): { q: string; book: string } {
  try {
    const params = new URLSearchParams(location.search)
    return { q: params.get("q") ?? "", book: params.get("book") ?? "" }
  } catch {
    return { q: "", book: "" }
  }
}

function writeParams(q: string, book: string) {
  try {
    const url = new URL(location.href)
    if (q) url.searchParams.set("q", q)
    else url.searchParams.delete("q")
    if (book) url.searchParams.set("book", book)
    else url.searchParams.delete("book")
    // replaceState 不會觸發 popstate，Quartz 的 SPA 路由不會把它當成換頁
    history.replaceState(history.state, "", url)
  } catch {
    // 網址寫不回去就算了，篩選本身不受影響
  }
}

interface Chip {
  item: HTMLElement
  text: string
  books: string[]
}

function chipsOf(list: HTMLElement): Chip[] {
  return Array.from(list.querySelectorAll<HTMLAnchorElement>("a.bwz-kn-chip")).map((a) => {
    const title = a.querySelector(".bwz-kn-chip-t")?.textContent ?? a.textContent ?? ""
    const alias = a.dataset.alias ?? ""
    return {
      item: (a.closest("li") ?? a) as HTMLElement,
      text: normalize(`${title}|${alias}`),
      books: (a.dataset.books ?? "").split("|").filter(Boolean),
    }
  })
}

// SPA 換頁時 Quartz（micromorph）會把舊頁面的元素原地改成新頁面的內容，不一定換成新元素：
// 所以不能用「綁過了就略過」，舊的監聽器還握著上一頁的元素。每次 nav 先拆掉舊的、重新綁一次。
const bindings = new WeakMap<HTMLElement, AbortController>()

function rebind(el: HTMLElement): AbortSignal {
  bindings.get(el)?.abort()
  const controller = new AbortController()
  bindings.set(el, controller)
  return controller.signal
}

function bindCategory(page: HTMLElement) {
  const signal = rebind(page)

  const tools = page.querySelector<HTMLElement>("[data-kn-tools]")
  const list = page.querySelector<HTMLElement>("[data-kn-list]")
  const input = page.querySelector<HTMLInputElement>("[data-kn-filter]")
  const status = page.querySelector<HTMLElement>("[data-kn-status]")
  const clear = page.querySelector<HTMLButtonElement>("[data-kn-clear]")
  const empty = page.querySelector<HTMLElement>("[data-kn-empty]")
  const top = page.querySelector<HTMLElement>("[data-kn-top]")
  const panel = page.querySelector<HTMLElement>("[data-kn-books]")
  const toggle = page.querySelector<HTMLButtonElement>("[data-kn-books-toggle]")
  const toggleLabel = page.querySelector<HTMLElement>("[data-kn-books-label]")
  if (!tools || !list || !input || !status || !clear) return

  const toolsEl = tools
  const listEl = list
  const inputEl = input
  const statusEl = status
  const clearEl = clear

  const chips = chipsOf(listEl)
  const sections = Array.from(listEl.querySelectorAll<HTMLElement>(".bwz-kn-sec"))
  const buttons = Array.from(page.querySelectorAll<HTMLButtonElement>(".bwz-kn-book"))
  const total = chips.length
  const known = new Set(buttons.map((button) => button.dataset.book ?? ""))
  const category = page.dataset.cat ?? ""

  let book = ""
  let query = ""
  const toggleText = toggleLabel?.dataset.default ?? toggleLabel?.textContent ?? ""

  const setPanel = (open: boolean) => {
    if (!panel || !toggle) return
    panel.hidden = !open
    toggle.setAttribute("aria-expanded", String(open))
  }

  const apply = () => {
    const tokens = query.split(/\s+/u).map(normalize).filter(Boolean)
    let shown = 0
    for (const chip of chips) {
      const matchBook = !book || chip.books.includes(book)
      const matchText = tokens.every((token) => chip.text.includes(token))
      const visible = matchBook && matchText
      chip.item.hidden = !visible
      if (visible) shown++
    }
    for (const section of sections) {
      const visible = section.querySelectorAll("li:not([hidden])").length
      section.hidden = visible === 0
      const n = section.querySelector<HTMLElement>("[data-kn-sec-n]")
      if (n) n.textContent = String(visible)
    }

    const filtering = Boolean(book || tokens.length)
    if (filtering) listEl.setAttribute(FILTERED, book ? "book" : "text")
    else listEl.removeAttribute(FILTERED)
    if (top) top.hidden = filtering
    if (empty) empty.hidden = shown > 0

    for (const button of buttons) {
      button.setAttribute("aria-pressed", String((button.dataset.book ?? "") === book))
    }
    clearEl.hidden = !filtering
    if (toggleLabel) toggleLabel.textContent = book ? `書卷：${book}` : toggleText
    toggle?.setAttribute("data-active", book ? "1" : "0")

    const label = book ? `${book}裡出現過的${category}` : category
    statusEl.textContent = filtering
      ? `${label}：顯示 ${shown} / ${total} 個條目`
      : `共 ${total} 個條目`
    writeParams(query.trim(), book)
  }

  inputEl.addEventListener(
    "input",
    () => {
      query = inputEl.value
      apply()
    },
    { signal },
  )
  inputEl.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && inputEl.value) {
        inputEl.value = ""
        query = ""
        apply()
        event.stopPropagation()
      }
    },
    { signal },
  )
  for (const button of buttons) {
    button.addEventListener(
      "click",
      () => {
        book = button.dataset.book ?? ""
        apply()
        setPanel(false)
      },
      { signal },
    )
  }
  toggle?.addEventListener("click", () => setPanel(panel?.hidden ?? false), { signal })
  clearEl.addEventListener(
    "click",
    () => {
      inputEl.value = ""
      query = ""
      book = ""
      apply()
      inputEl.focus()
    },
    { signal },
  )

  // 搜尋框的字是元素的屬性（不是 HTML），SPA 換頁時原地複用的 <input> 會留著上一頁的字，所以每次都以網址為準重設
  const params = readParams()
  book = params.book && known.has(params.book) ? params.book : ""
  query = params.q
  inputEl.value = query
  setPanel(false)
  toolsEl.hidden = false
  apply()
  centerCurrentPill(page)
}

// 同層分類導航是一行橫向捲動；進頁面時把目前的分類捲到中間（不用 scrollIntoView，那會連頁面一起捲）
function centerCurrentPill(page: HTMLElement) {
  const strip = page.querySelector<HTMLElement>(".bwz-kn-pills")
  const current = strip?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!strip || !current) return
  strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2
}

function bindHub(hub: HTMLElement) {
  const button = hub.querySelector<HTMLElement>("[data-kn-search]")
  if (!button) return
  const signal = rebind(button)
  // 不重寫搜尋：直接按網站現有的搜尋鈕（手機上它在 ☰ 抽屜裡，程式點擊照樣有效）
  button.addEventListener(
    "click",
    () => {
      document.querySelector<HTMLElement>(".search-button")?.click()
    },
    { signal },
  )
  button.hidden = false
  const hint = hub.querySelector<HTMLElement>("[data-kn-kbd]")
  if (hint && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) hint.textContent = "⌘ K"
}

function mount() {
  for (const page of document.querySelectorAll<HTMLElement>(".bwz-kn-cat")) bindCategory(page)
  for (const hub of document.querySelectorAll<HTMLElement>(".bwz-kn-hub")) bindHub(hub)
}

document.addEventListener("nav", mount)
mount()

