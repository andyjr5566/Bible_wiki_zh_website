// 聖經研讀知識庫 - 互動導覽引擎
// 三層教學：
//   1. 第一次來訪時，右下角的邀請卡（不遮擋內容）
//   2. 「逾越節之旅」主線：聚光燈 + 指向泡泡，部分步驟要讀者實際操作才前進，可跨頁延續
//   3. `?` 說明中心、右下角問號按鈕，以及〈全書目錄及綱要〉的「互動網站」情境提示點
//
// 所有 UI 掛在 <html> 底下（不是 <body>），SPA 換頁時 body 被替換也不會被清掉。

type Status = "new" | "active" | "paused" | "done" | "dismissed"

interface TourState {
  status: Status
  step: number
  skills: string[]
  skipped: string[]
}

interface Step {
  id: string
  page: string // slug，或 "any"
  skill?: string
  gate?: boolean // 需要讀者操作才前進
  desktopOnly?: boolean // 需要滑鼠懸停
  side?: boolean // 泡泡優先放在目標旁邊（避開連結預覽）
  match?: (slug: string) => boolean // 多個頁面都算「在這一站」，例如任何一張地圖
  ensure?: () => void // 進站後（每次重新對位時）呼叫，用來展開折疊區之類
  then?: string // 按「下一步」後直接帶到這一頁
  nextLabel?: string
  targets: () => Element[]
  title: () => string
  text: () => string
  done?: () => boolean
  onSkip?: () => void
}

const KEY = "bwz-tour-v2"
const LEGACY_KEY = "wikiTourCompleted"
const LATER_KEY = "bwz-tour-later" // sessionStorage：「之後再說」
const HINT_KEY = "bwz-hint-website"

const SLUG = {
  home: "index",
  ch12: "02-出埃及記/第12章",
  entry: "link_folder/歷史/逾越節羔羊",
  outline: "02-出埃及記/全書目錄及綱要",
  maps: "appendix/fhl_maps/地圖索引",
  map: "appendix/fhl_maps/maps/018",
}

const MAP_PREFIX = "appendix/fhl_maps/maps/"

const PAGE_TITLE: Record<string, string> = {
  [SLUG.home]: "首頁",
  [SLUG.ch12]: "出埃及記 第12章",
  [SLUG.entry]: "逾越節羔羊",
  [SLUG.map]: "聖經地圖",
}

const TUTORIALS = [
  "快速入門",
  "如何查一個主題",
  "如何跨書卷找相關條目",
  "熱鍵與功能速查",
  "註釋來源怎麼讀",
]

/* ---------------- 小工具 ---------------- */

function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector(sel) as T | null
}

function $$<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[]
}

function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

const local = {
  get<T>(key: string, fallback: T): T {
    return attempt(() => {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    }, fallback)
  },
  set(key: string, value: unknown) {
    attempt(() => localStorage.setItem(key, JSON.stringify(value)), undefined)
  },
}

const session = {
  get: (key: string) => attempt(() => sessionStorage.getItem(key), null),
  set: (key: string, value: string) => attempt(() => sessionStorage.setItem(key, value), undefined),
}

const isMobile = () => window.matchMedia("(max-width: 800px)").matches
const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
const MOD = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl"

const currentSlug = () => document.body?.dataset.slug ?? ""

function visible<T extends Element>(el: T | null | undefined): el is T {
  return !!el && el.getClientRects().length > 0
}

function withNext(el: Element | null): Element[] {
  if (!el) return []
  return el.nextElementSibling ? [el, el.nextElementSibling] : [el]
}

function slugUrl(slug: string): URL {
  const base = (document.body?.dataset.basepath ?? "").replace(/\/+$/, "")
  const path = slug === "index" ? "/" : "/" + slug.split("/").map(encodeURIComponent).join("/")
  return new URL(base + path, window.location.origin)
}

let afterNav: (() => void) | null = null

function go(slug: string, then?: () => void) {
  afterNav = then ?? null
  if (currentSlug() === slug) {
    runAfterNav()
    return
  }
  const url = slugUrl(slug)
  const spaNavigate = (window as unknown as { spaNavigate?: (url: URL) => void }).spaNavigate
  if (typeof spaNavigate === "function") spaNavigate(url)
  else window.location.assign(url)
}

function runAfterNav() {
  const fn = afterNav
  afterNav = null
  if (fn) setTimeout(fn, 120)
}

function websiteHeading(): HTMLElement | null {
  return ($$<HTMLElement>("article h2").find((h) => h.textContent?.includes("互動網站")) ?? null)
}

function scrollToWebsite() {
  const h = websiteHeading()
  h?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" })
}

/* ---------------- 頁面狀態 ---------------- */

const searchOpen = () => !!$(".search-container.active")
const searchQuery = () => $<HTMLInputElement>(".search-bar")?.value ?? ""
const lambLink = () =>
  $$<HTMLAnchorElement>(`article a.internal[data-slug="${SLUG.entry}"]`).find(visible) ?? null

// 折疊區（本章知識節點、來源依據、按書卷累積）由 collapsible.inline.ts 包成 <details>，標題 h2 會被收進去
const collapsible = (title: string) =>
  $$<HTMLDetailsElement>("article details.collapsible-section").find(
    (d) => $(".collapsible-title", d)?.textContent?.trim() === title,
  ) ?? null

const flowchart = () =>
  $$("article code.mermaid")
    .map((c) => c.closest("pre") ?? c)
    .find(visible) ?? null

const comparisonTable = () =>
  $$("article .table-container").find((c) => visible(c) && !/前一章/.test(c.textContent ?? "")) ?? null

const refsBlock = () =>
  $$("article strong")
    .find((x) => x.textContent?.trim() === "參考資料")
    ?.closest("p") ?? null

const onMapPage = (slug: string) => slug.startsWith(MAP_PREFIX)

let nodesOpened = false
let toolTouched = false
let lambHovered = false
let navSinceStep = false
let wasSearchOpen = false

/* ---------------- 主線步驟 ---------------- */

const STEPS: Step[] = [
  {
    id: "map",
    page: SLUG.home,
    skill: "書卷結構",
    targets: () => $$("article .table-container").slice(0, 1),
    title: () => "從書卷開始",
    text: () =>
      "每卷書先進「全書目錄及綱要」，再選章。✓ 代表整卷已完成，進度條是正在建置的書卷。",
  },
  {
    id: "search",
    page: "any",
    skill: "搜尋",
    gate: true,
    targets: () => (searchOpen() ? $$(".search-container.active .search-bar") : $$(".search-button")),
    title: () => "找一個主題",
    text: () =>
      searchOpen()
        ? "輸入「逾越節」。"
        : isMobile()
          ? "點上方的搜尋。"
          : `按 ${MOD} + K，或點這個搜尋框。`,
    done: () => searchOpen() && /逾越/.test(searchQuery()),
  },
  {
    id: "result",
    page: "any",
    gate: true,
    targets: () => {
      if (!searchOpen()) return $$(".search-button")
      const layout = $(".search-container.active .search-layout.display-results")
      return layout ? [layout] : $$(".search-container.active .search-bar")
    },
    title: () => "字面和語意，一次搜",
    text: () =>
      searchOpen()
        ? "標「AI 語意」的結果，是字面不同、意思相近的條目；「精準比對」則是字面相符。點一個結果，建議選〈出埃及記 第12章〉。"
        : "搜尋框關掉了。再打開一次，搜「逾越節」並點一個結果。",
    done: () => navSinceStep,
  },
  {
    id: "links",
    page: SLUG.ch12,
    skill: "經文連結",
    targets: () => {
      const ol = $("article ol")
      return ol ? Array.from(ol.children).slice(0, 3) : []
    },
    title: () => "有底色的詞都可以點",
    text: () =>
      "經文裡的人名、地名、原文詞和概念，各自連到一個知識條目。光是這一章就有 60 多個。",
  },
  {
    id: "hover",
    page: SLUG.ch12,
    skill: "懸停預覽",
    gate: true,
    desktopOnly: true,
    side: true,
    targets: () => [lambLink()].filter(visible),
    title: () => "先看一眼，不用離開",
    text: () => "把滑鼠停在第 6 節的「羊羔」上，等一下預覽就會浮出來。",
    done: () => lambHovered,
  },
  {
    id: "open",
    page: SLUG.ch12,
    skill: "條目頁",
    gate: true,
    side: true,
    targets: () => [lambLink()].filter(visible),
    title: () => (isMobile() ? "點進條目" : "想看完整內容就點下去"),
    text: () =>
      isMobile()
        ? "點第 6 節的「羊羔」。看完按瀏覽器的返回，就回到原本讀的那節。"
        : "點「羊羔」打開條目。看完按瀏覽器的返回，就回到原本讀的那節。",
    done: () => currentSlug() === SLUG.entry,
    onSkip: () => go(SLUG.entry),
  },
  {
    id: "entry",
    page: SLUG.entry,
    targets: () => [$(".center .article-title"), ...withNext(document.getElementById("定義"))].filter(visible),
    title: () => "條目頁怎麼讀",
    text: () =>
      "最上面是標題和屬性，接著是定義。往下的「按書卷累積」依書卷列出這個主題出現過的每一章。",
  },
  {
    id: "backlinks",
    page: SLUG.entry,
    skill: "反向連結",
    targets: () => $$(".backlinks").filter(visible),
    title: () => "誰提到了它",
    text: () =>
      $$(".graph").some(visible)
        ? "反向連結列出所有提到這個條目的頁面；上方的關係圖顯示它連到哪些條目。想從出埃及記追到民數記、新約，就從這裡開始。"
        : "反向連結列出所有提到這個條目的頁面。想從出埃及記追到民數記、新約，就從這裡開始。",
  },
  {
    id: "sources",
    page: SLUG.entry,
    skill: "來源查證",
    targets: () => {
      const d = collapsible("來源依據")
      return (d ? [d] : withNext(document.getElementById("來源依據"))).filter(visible)
    },
    title: () => "每句話都有出處",
    text: () =>
      "條目最後的「來源依據」列出經文出處和原始網址（CT、GT、KC、BH、STEP），可以自己回去核對。這一區平常是收起來的，點標題就能展開。",
    nextLabel: "回到第12章",
    then: SLUG.ch12,
  },
  {
    id: "nodes",
    page: SLUG.ch12,
    skill: "知識節點",
    ensure: () => {
      if (nodesOpened) return
      const d = collapsible("本章知識節點")
      if (!d) return
      d.open = true
      nodesOpened = true
    },
    targets: () => {
      const d = collapsible("本章知識節點")
      if (!d) return []
      const h3 = $("h3", d)
      return [$("summary", d), h3, h3?.nextElementSibling].filter(visible)
    },
    title: () => "這一章連到的條目，全收在這裡",
    text: () =>
      "「本章知識節點」把經文裡的連結依主題、歷史、原文、神學、人物、地點、文化、解經爭議、互文分類，一次看完。跟條目頁的「來源依據」一樣，平常是收起來的，點標題可以展開或收合。",
  },
  {
    id: "digest",
    page: SLUG.ch12,
    skill: "本章整理",
    targets: () => {
      const h = document.getElementById("本章整理")
      if (!h) return []
      const paras: Element[] = []
      for (let n = h.nextElementSibling; n && n.tagName === "P" && paras.length < 2; n = n.nextElementSibling)
        paras.push(n)
      return [h, ...paras].filter(visible)
    },
    title: () => "一章讀下來的重點",
    text: () =>
      "「本章整理」先交代 CT、GT、KC 怎麼切分這一章，再依經文分段（標題後面的 v1-14 是節數）。每段都標明是哪一家的說法，原文詞旁邊附 Strong 編號。",
  },
  {
    id: "diagram",
    page: SLUG.ch12,
    skill: "圖表",
    targets: () => [flowchart()].filter(visible),
    title: () => "事件順序，畫成流程圖",
    text: () =>
      "有些段落附上流程圖，把先後次序畫出來：正月初十取羊、十四日黃昏宰羊、當夜塗血吃羊、半夜擊殺長子、十五日出埃及。",
  },
  {
    id: "table",
    page: SLUG.ch12,
    targets: () => [comparisonTable()].filter(visible),
    title: () => "看法不同，並排比一比",
    text: () =>
      "註釋家意見分歧的地方，會整理成比較表。例如「以色列人在埃及住了多久」，不同主張、算法和憑據並排對照。表格較寬時可以左右捲動。",
  },
  {
    id: "refs",
    page: SLUG.ch12,
    skill: "參考資料",
    targets: () => [refsBlock()].filter(visible),
    title: () => "想看原文，從這裡點過去",
    text: () =>
      "每章整理的最後附上這一章用到的 CT、GT、KC、BH 原始網址。想讀註釋全文，或核對上面整理的內容，就從這裡點過去。",
  },
  {
    id: "maps",
    page: SLUG.ch12,
    skill: "相關地圖",
    gate: true,
    targets: () => {
      const h2 = document.getElementById("附錄")
      const h3 = document.getElementById("相關地圖")
      return [h2, h3, h3?.nextElementSibling].filter(visible)
    },
    title: () => "章節附的地圖",
    text: () => "章節最下方的「附錄」放著這一章的相關地圖。點一張進去看看。",
    done: () => onMapPage(currentSlug()),
  },
  {
    id: "mapview",
    page: SLUG.map,
    match: onMapPage,
    targets: () => $$("article img").filter(visible).slice(0, 1),
    title: () => "附錄裡的聖經地圖",
    text: () =>
      "這是信望愛聖經地圖。圖下面的「地圖解說」依經文逐段說明，並連回相關章節。附錄目前還在整理中，內容和位置之後可能調整。",
  },
  {
    id: "comfort",
    page: "any",
    skill: "閱讀設定",
    gate: true,
    targets: () => $$(".darkmode, .puremode, .readermode").filter(visible),
    title: () => "調成你習慣的樣子",
    text: () => "明暗模式、紙質／素色底色、閱讀模式（淡出側欄）。點一個試試。",
    done: () => toolTouched,
  },
  {
    id: "extras",
    page: "any",
    targets: () => {
      if (isMobile()) return $$(".explorer-toggle.mobile-explorer").filter(visible)
      const folder = $('.folder-container[data-folderpath="appendix"]')
      return visible(folder) ? [folder] : []
    },
    title: () => "還有更多可以探索",
    text: () =>
      "每卷書〈全書目錄及綱要〉的最下方有<b>互動網站</b>和導讀影片，例如出埃及記的「照山上的樣式」。" +
      `${isMobile() ? "選單裡" : "左邊"}的 appendix（附錄）除了剛剛看到的地圖，之後還會放進其他延伸資料，目前還在整理中。`,
  },
]

const hiddenStep = (s: Step) => !!s.desktopOnly && (isMobile() || !canHover())

/* ---------------- DOM ---------------- */

const ROOT_ID = "bwz-tour-root"

function ensureDom(): HTMLElement {
  let root = document.getElementById(ROOT_ID)
  if (root) return root
  root = document.createElement("div")
  root.id = ROOT_ID
  root.innerHTML = `
    <div class="bwz-layer" hidden>
      <div class="bwz-hole"></div>
      <div class="bwz-block"></div><div class="bwz-block"></div><div class="bwz-block"></div><div class="bwz-block"></div>
      <div class="bwz-bubble" role="dialog" aria-live="polite" aria-label="互動導覽"></div>
    </div>
    <div class="bwz-welcome" role="dialog" aria-label="第一次來訪提示" hidden>
      <div class="bwz-welcome-head">
        <span class="bwz-seal" aria-hidden="true">導</span>
        <div><h3>第一次來嗎？</h3><div class="bwz-kicker">約 4 分鐘 · 可以隨時暫停</div></div>
      </div>
      <p>跟著讀一段〈出埃及記 12 章〉，順手學會搜尋、連結預覽、追主題、查來源，還有一章的整理與地圖。</p>
      <div class="bwz-row">
        <button class="bwz-btn primary" type="button" data-w="start">開始導覽</button>
        <button class="bwz-btn" type="button" data-w="later">之後再說</button>
        <button class="bwz-btn link" type="button" data-w="never">不再提示</button>
      </div>
    </div>
    <button class="bwz-fab" type="button" aria-label="打開說明中心（快捷鍵 ?）" title="說明中心（?）">?<span class="bwz-fab-dot" hidden></span></button>
    <div class="bwz-modal" data-modal="help" hidden><div class="bwz-modal-card" role="dialog" aria-label="說明中心"></div></div>
    <div class="bwz-modal" data-modal="finish" hidden><div class="bwz-modal-card bwz-center" role="dialog" aria-label="導覽完成"></div></div>
    <div class="bwz-toast" role="status" hidden></div>
  `
  document.documentElement.appendChild(root)

  $(".bwz-bubble", root)!.addEventListener("click", onBubbleClick)
  $(".bwz-welcome", root)!.addEventListener("click", onWelcomeClick)
  $(".bwz-fab", root)!.addEventListener("click", () => (helpOpen() ? closeHelp() : openHelp()))
  $('[data-modal="help"]', root)!.addEventListener("click", onHelpClick)
  $('[data-modal="finish"]', root)!.addEventListener("click", onFinishClick)
  return root
}

const el = <T extends HTMLElement = HTMLElement>(sel: string) => $<T>(sel, ensureDom())!
const helpOpen = () => !el('[data-modal="help"]').hidden
const finishOpen = () => !el('[data-modal="finish"]').hidden

let toastTimer: ReturnType<typeof setTimeout> | undefined
function toast(msg: string) {
  const t = el(".bwz-toast")
  t.textContent = msg
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (t.hidden = true), 3000)
}

/* ---------------- 導覽引擎 ---------------- */

function loadState(): TourState {
  const saved = local.get<TourState | null>(KEY, null)
  if (saved) return saved
  // 看過舊版導覽的讀者不再主動打擾，但問號按鈕會提示有新導覽
  const legacyDone = attempt(() => localStorage.getItem(LEGACY_KEY) === "1", false)
  return { status: legacyDone ? "dismissed" : "new", step: 0, skills: [], skipped: [] }
}

let st: TourState = loadState()
let lastStepId = ""
let busy = false
let ticker: ReturnType<typeof setInterval> | undefined

function save() {
  local.set(KEY, st)
  updateFab()
}

const visibleSteps = () => STEPS.filter((s) => !hiddenStep(s))
const skillTotal = () => visibleSteps().filter((s) => s.skill).length

function curIndex(): number {
  let i = st.step
  while (i < STEPS.length && hiddenStep(STEPS[i])) i++
  return i
}

const cur = (): Step | undefined => STEPS[curIndex()]

function startTour(fresh: boolean) {
  if (fresh || st.status === "done") st = { status: "active", step: 0, skills: [], skipped: [] }
  else st.status = "active"
  toolTouched = false
  lastStepId = ""
  hideWelcome()
  closeHelp()
  el('[data-modal="finish"]').hidden = true
  save()
  startTicker()
  const first = cur()
  if (fresh && first && first.page !== "any" && first.page !== currentSlug()) go(first.page)
  else show()
}

function pauseTour(msg?: string) {
  if (st.status !== "active") return
  st.status = "paused"
  save()
  hideLayer()
  toast(msg ?? "導覽已暫停。按 ? 或右下角的問號可以繼續。")
}

function advance(skipped: boolean) {
  const s = cur()
  if (!s) return
  if (s.skill) {
    const list = skipped ? st.skipped : st.skills
    if (!list.includes(s.skill)) list.push(s.skill)
  }
  st.step = curIndex() + 1
  if (curIndex() >= STEPS.length) {
    finishTour()
    return
  }
  save()
  const dest = !skipped && s.then ? s.then : null
  const next = cur()
  if (dest && next && currentSlug() !== dest) {
    renderLeaving(next)
    go(dest)
    return
  }
  show()
}

function back() {
  let i = curIndex() - 1
  while (i >= 0 && hiddenStep(STEPS[i])) i--
  if (i < 0) return
  st.step = i
  save()
  show()
}

function finishTour() {
  st.status = "done"
  save()
  hideLayer()
  showFinish()
}

function check() {
  if (st.status !== "active" || busy) return
  const s = cur()
  if (!s) return
  if (s.id !== lastStepId) resetStepFlags(s)
  // 完成條件不限頁面：像「點進條目」這一步，完成時人已經在下一頁了
  if (s.done && s.done()) {
    busy = true
    place(s)
    setTimeout(() => {
      busy = false
      advance(false)
    }, 380)
    return
  }
  place(s)
}

function resetStepFlags(s: Step) {
  lastStepId = s.id
  navSinceStep = false
  lambHovered = false
  nodesOpened = false
}

const onPage = (s: Step) =>
  s.match ? s.match(currentSlug()) : s.page === "any" || s.page === currentSlug()

function show() {
  if (st.status !== "active") return
  const s = cur()
  if (!s) return
  if (s.id !== lastStepId) resetStepFlags(s)
  document.documentElement.classList.add("bwz-touring")
  el(".bwz-layer").hidden = false

  if (s.done?.()) {
    check()
    return
  }

  if (!onPage(s)) {
    renderDetour(s)
    return
  }

  renderBubble(s)
  s.ensure?.()
  bringIntoView(s.targets()[0])
  place(s)
}

function hideLayer() {
  el(".bwz-layer").hidden = true
  document.documentElement.classList.remove("bwz-touring")
  stopTicker()
}

// 搜尋結果、預覽卡等內容是非同步出現的，導覽進行中定期重新對位
function startTicker() {
  stopTicker()
  ticker = setInterval(check, 350)
}

function stopTicker() {
  if (ticker) clearInterval(ticker)
  ticker = undefined
}

function bringIntoView(target: Element | undefined) {
  if (!target) return
  const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth"
  const inSidebar = target.closest(".sidebar")
  if (target.closest(".search-container")) return
  if (inSidebar && !isMobile()) {
    target.scrollIntoView({ block: "nearest", behavior })
    return
  }
  const r = target.getBoundingClientRect()
  const bubbleH = isMobile() ? el(".bwz-bubble").offsetHeight + 40 : 60
  // 手機版頂部有固定的工具列，目標要留在它下方
  const topLimit = isMobile() ? 130 : 20
  if (r.top < topLimit || r.bottom > window.innerHeight - bubbleH) {
    const offset = isMobile() ? 150 : Math.max(80, window.innerHeight * 0.22)
    window.scrollTo({ top: window.scrollY + r.top - offset, behavior })
  }
}

function dotsHtml(steps: Step[], n: number) {
  return steps
    .map((v, i) => {
      let cls = ""
      if (i === n - 1) cls = "now"
      else if (i < n - 1) cls = v.skill && st.skipped.includes(v.skill) ? "skip" : "done"
      return `<i class="${cls}"></i>`
    })
    .join("")
}

function renderBubble(s: Step) {
  const steps = visibleSteps()
  const n = steps.indexOf(s) + 1
  const N = steps.length
  const prev = steps[n - 2]
  const canBack = !!prev && !prev.gate && !s.gate && (prev.page === s.page || prev.page === "any")
  const last = n === N
  const b = el(".bwz-bubble")
  b.innerHTML = `
    <span class="bwz-arrow" hidden></span>
    <div class="bwz-head">
      <span class="bwz-seal" aria-hidden="true">${n}</span>
      <div><div class="bwz-kicker">逾越節之旅 · 第 ${n} / ${N} 站 · 已掌握 ${st.skills.length} 項</div><h3>${s.title()}</h3></div>
      <button class="bwz-x" type="button" data-t="pause" aria-label="暫停導覽" title="暫停導覽（Esc）">✕</button>
    </div>
    <p class="bwz-text">${s.text()}</p>
    ${s.gate ? `<p class="bwz-todo"><i></i>換你操作，完成後自動進到下一站</p>` : ""}
    <div class="bwz-foot">
      <div class="bwz-dots" aria-hidden="true">${dotsHtml(steps, n)}</div>
      <div class="bwz-btns">
        ${canBack ? `<button class="bwz-btn" type="button" data-t="back">上一步</button>` : ""}
        ${
          s.gate
            ? `<button class="bwz-btn" type="button" data-t="skip">跳過這步</button>`
            : `<button class="bwz-btn primary" type="button" data-t="next">${last ? "完成" : (s.nextLabel ?? "下一步")}</button>`
        }
      </div>
    </div>`
  b.dataset.step = s.id
  if (!s.gate) setTimeout(() => $<HTMLButtonElement>("[data-t=next]", b)?.focus({ preventScroll: true }), 30)
}

function renderDetour(s: Step) {
  setHole(null, true)
  const steps = visibleSteps()
  const n = steps.indexOf(s) + 1
  const b = el(".bwz-bubble")
  b.className = "bwz-bubble bwz-dock"
  b.style.left = ""
  b.style.top = ""
  b.dataset.step = "detour"
  b.innerHTML = `
    <div class="bwz-head">
      <span class="bwz-seal" aria-hidden="true">${n}</span>
      <div><div class="bwz-kicker">逾越節之旅 · 第 ${n} / ${steps.length} 站</div><h3>下一站在〈${PAGE_TITLE[s.page] ?? s.page}〉</h3></div>
      <button class="bwz-x" type="button" data-t="pause" aria-label="暫停導覽">✕</button>
    </div>
    <p class="bwz-text">你逛到別頁了，沒關係。準備好就回來繼續。</p>
    <div class="bwz-foot"><div class="bwz-btns">
      <button class="bwz-btn" type="button" data-t="pause">先暫停</button>
      <button class="bwz-btn primary" type="button" data-t="goto" data-page="${s.page}">帶我過去</button>
    </div></div>`
}

// 按「下一步」就要換頁時，先把泡泡換成過場，避免舊的聚光圈停在原地
function renderLeaving(s: Step) {
  setHole(null, true)
  const b = el(".bwz-bubble")
  b.className = "bwz-bubble bwz-dock"
  b.style.left = ""
  b.style.top = ""
  b.dataset.step = "detour"
  b.innerHTML = `<p class="bwz-text">正在回到〈${PAGE_TITLE[s.page] ?? s.page}〉…</p>`
}

function unionRect(els: Element[]) {
  const rs = els.map((e) => e.getBoundingClientRect())
  const top = Math.min(...rs.map((r) => r.top))
  const left = Math.min(...rs.map((r) => r.left))
  const bottom = Math.max(...rs.map((r) => r.bottom))
  const right = Math.max(...rs.map((r) => r.right))
  return { top, left, bottom, right }
}

type Box = { top: number; left: number; bottom: number; right: number }

function setHole(rect: Box | null, passthrough = false): Box {
  const hole = el(".bwz-hole")
  const blocks = $$<HTMLElement>(".bwz-block", ensureDom())
  const W = window.innerWidth
  const H = window.innerHeight
  if (passthrough) {
    hole.style.display = "none"
    blocks.forEach((b) => (b.style.display = "none"))
    return { top: 0, left: 0, bottom: 0, right: 0 }
  }
  const pad = rect ? 6 : 0
  const r = rect ?? { top: H / 2, left: W / 2, bottom: H / 2, right: W / 2 }
  const t = Math.max(0, r.top - pad)
  const l = Math.max(0, r.left - pad)
  const b = Math.min(H, r.bottom + pad)
  const rr = Math.min(W, r.right + pad)
  hole.style.cssText = `top:${t}px;left:${l}px;width:${Math.max(0, rr - l)}px;height:${Math.max(0, b - t)}px`
  hole.classList.toggle("bwz-none", !rect)
  const boxes = [
    [0, 0, W, t],
    [b, 0, W, H - b],
    [t, 0, l, b - t],
    [t, rr, W - rr, b - t],
  ]
  blocks.forEach((blk, i) => {
    const [top, left, w, h] = boxes[i]
    blk.style.cssText = `top:${top}px;left:${left}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`
  })
  return { top: t, left: l, bottom: b, right: rr }
}

function place(s: Step) {
  if (st.status !== "active" || !onPage(s)) return
  const b = el(".bwz-bubble")
  if (b.dataset.step !== s.id) renderBubble(s)
  s.ensure?.()
  // 文字會隨搜尋框開關而變，順手更新
  const textEl = $(".bwz-text", b)
  if (textEl && textEl.innerHTML !== s.text()) textEl.innerHTML = s.text()

  const targets = s.targets().filter(visible)
  const rect = targets.length ? unionRect(targets) : null
  const hr = setHole(rect)
  el(".bwz-hole").classList.toggle("bwz-gate", !!s.gate && !!rect)
  const arrow = $<HTMLElement>(".bwz-arrow", b)

  if (isMobile()) {
    if (arrow) arrow.hidden = true
    const bh = b.offsetHeight
    // 目標被底部導覽卡蓋住時，導覽卡改放到目標上方
    if (rect && hr.bottom > window.innerHeight - bh - 24 && hr.top > bh + 80) {
      b.className = "bwz-bubble bwz-float"
      b.style.top = `${Math.max(60, hr.top - bh - 14)}px`
    } else {
      b.className = "bwz-bubble bwz-dock"
      b.style.top = ""
    }
    b.style.left = ""
    return
  }

  b.className = "bwz-bubble"
  const bw = b.offsetWidth
  const bh = b.offsetHeight
  const W = window.innerWidth
  const H = window.innerHeight
  const m = 14
  if (!rect) {
    b.style.left = `${(W - bw) / 2}px`
    b.style.top = `${(H - bh) / 2}px`
    if (arrow) arrow.hidden = true
    return
  }
  const cx = (hr.left + hr.right) / 2
  let left = Math.min(Math.max(16, cx - bw / 2), W - bw - 16)
  let top: number
  let dir: "up" | "down" | null = null
  if (s.side && W - hr.right >= bw + m + 16) {
    // 連結預覽會浮在連結上方或下方，泡泡改放旁邊避開
    left = hr.right + m
    top = Math.min(Math.max(16, hr.top - 24), H - bh - 16)
  } else if (H - hr.bottom >= bh + m + 12) {
    top = hr.bottom + m
    dir = "up"
  } else if (hr.top >= bh + m + 12) {
    top = hr.top - bh - m
    dir = "down"
  } else if (W - hr.right >= bw + m + 16) {
    left = hr.right + m
    top = Math.min(Math.max(16, hr.top), H - bh - 16)
  } else if (hr.left >= bw + m + 16) {
    left = hr.left - bw - m
    top = Math.min(Math.max(16, hr.top), H - bh - 16)
  } else {
    left = W - bw - 20
    top = H - bh - 20
  }
  b.style.left = `${left}px`
  b.style.top = `${top}px`
  if (arrow) {
    arrow.hidden = !dir
    arrow.className = `bwz-arrow ${dir ?? ""}`
    arrow.style.left = `${Math.min(Math.max(16, cx - left - 7), bw - 30)}px`
  }
}

function onBubbleClick(e: Event) {
  const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-t]")
  if (!btn) return
  const s = cur()
  switch (btn.dataset.t) {
    case "next":
      advance(false)
      break
    case "back":
      back()
      break
    case "pause":
      pauseTour()
      break
    case "goto":
      go(btn.dataset.page!)
      break
    case "skip":
      if (!s) return
      if (s.id === "search" || s.id === "result") {
        // 搜尋兩步一起跳過，直接帶到出埃及記 12 章
        advance(true)
        if (cur()?.id === "result") advance(true)
        go(SLUG.ch12)
      } else if (s.id === "maps") {
        // 沒點地圖就不必看地圖頁，直接跳到下一個主題
        advance(true)
        if (cur()?.id === "mapview") advance(true)
      } else {
        advance(true)
        s.onSkip?.()
      }
      break
  }
}

/* ---------------- 歡迎卡 ---------------- */

let welcomeVisible = false

// 頁面上已有導覽入口（首頁啟動卡、快速入門的按鈕）時不再跳歡迎卡，
// 歡迎卡主要照顧從搜尋引擎直接進到某一章的讀者
const onHome = () => !!$("[data-tour-launcher], article [data-tour-open]")

function maybeShowWelcome(delay = 1200) {
  if (st.status !== "new" || session.get(LATER_KEY) || onHome()) return
  setTimeout(function tryShow() {
    if (st.status !== "new" || session.get(LATER_KEY) || onHome()) return
    // 手機的「加入主畫面」引導優先，等它關掉再出現
    if (document.getElementById("pwa-install-guide")) {
      setTimeout(tryShow, 1500)
      return
    }
    if (helpOpen() || searchOpen()) {
      setTimeout(tryShow, 1500)
      return
    }
    el(".bwz-welcome").hidden = false
    welcomeVisible = true
  }, delay)
}

function hideWelcome() {
  el(".bwz-welcome").hidden = true
  welcomeVisible = false
}

function onWelcomeClick(e: Event) {
  const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-w]")
  if (!btn) return
  const w = btn.dataset.w
  if (w === "start") startTour(true)
  if (w === "later") {
    session.set(LATER_KEY, "1")
    hideWelcome()
    toast("好的，這次瀏覽不會再提醒。需要時按 ? 就能打開。")
  }
  if (w === "never") {
    st.status = "dismissed"
    save()
    hideWelcome()
    toast("不會再主動提示了。右下角的問號隨時可以打開教學。")
  }
}

function updateFab() {
  const dot = el(".bwz-fab-dot")
  dot.hidden = st.status === "done" || st.status === "active"
}

/* ---------------- 說明中心 ---------------- */

function openHelp() {
  if (st.status === "active") {
    st.status = "paused"
    save()
    hideLayer()
  }
  hideWelcome()
  const total = skillTotal()
  const got = st.skills.length
  const pct = Math.round((got / total) * 100)
  const pausedAt = visibleSteps().indexOf(cur()!) + 1
  const status =
    st.status === "done"
      ? `已完成 · 掌握 ${got} / ${total} 項技能`
      : st.status === "paused"
        ? `暫停在第 ${pausedAt} 站 · 已掌握 ${got} 項`
        : `約 4 分鐘 · ${total} 項核心技能`
  const actions =
    st.status === "paused"
      ? `<button class="bwz-btn primary" type="button" data-h="resume">繼續</button><button class="bwz-btn" type="button" data-h="restart">從頭開始</button>`
      : `<button class="bwz-btn primary" type="button" data-h="restart">${st.status === "done" ? "再走一次" : "開始"}</button>`
  const pwaGuide = (window as any).__pwaInstallGuide
  const pwaGuideBlock = pwaGuide?.isMobile
    ? `<h4>加入主畫面</h4>
    <div class="bwz-route">
      <div class="bwz-route-body">
        <div class="bwz-route-title">把網站變成手機 App</div>
        <div class="bwz-route-meta">加入主畫面後，像一般 App 一樣從桌面直接打開，不用再透過瀏覽器。</div>
      </div>
      <div class="bwz-row"><button class="bwz-btn primary" type="button" data-h="install-guide">查看教學</button></div>
    </div>`
    : ""
  const card = $(".bwz-modal-card", el('[data-modal="help"]'))!
  card.innerHTML = `
    <div class="bwz-modal-head">
      <span class="bwz-seal bwz-big" aria-hidden="true">助</span>
      <div><h2>說明中心</h2><div class="bwz-kicker">隨時按 <kbd>?</kbd> 打開或關閉</div></div>
      <button class="bwz-x" type="button" data-h="close" aria-label="關閉">✕</button>
    </div>
    ${pwaGuideBlock}
    <h4>互動導覽</h4>
    <div class="bwz-route">
      <div class="bwz-route-body">
        <div class="bwz-route-title">逾越節之旅</div>
        <div class="bwz-route-meta">搜尋、經文連結、預覽、條目頁、反向連結、來源查證、本章整理、參考資料、相關地圖、閱讀設定。${status}</div>
        ${st.status === "paused" || st.status === "done" ? `<div class="bwz-meter"><span class="bwz-meter-fill" style="width:${pct}%"></span></div>` : ""}
      </div>
      <div class="bwz-row">${actions}</div>
    </div>
    <h4>延伸探索</h4>
    <dl class="bwz-keys">
      <dt>互動網站</dt><dd>在各卷〈全書目錄及綱要〉最下方，把某一章的場景做成可以操作的網頁。<a data-h="outline">看出埃及記的例子 →</a></dd>
      <dt>聖經地圖</dt><dd>章節頁最下方的「附錄 · 相關地圖」，或從 <a data-h="maps">地圖索引</a> 進入。</dd>
      <dt>導讀影片</dt><dd>大衛鮑森舊約縱覽，同樣放在各卷〈全書目錄及綱要〉。</dd>
    </dl>
    <p class="bwz-note">附錄（appendix）還在整理中，內容和位置之後可能會調整。</p>
    <h4>快捷鍵</h4>
    <dl class="bwz-keys">
      <dt><kbd>${MOD}</kbd> + <kbd>K</kbd></dt><dd>開啟搜尋</dd>
      <dt><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></dt><dd>在搜尋結果中選擇並前往</dd>
      <dt><kbd>?</kbd></dt><dd>打開或關閉說明中心</dd>
      <dt><kbd>Esc</kbd></dt><dd>關閉面板；導覽進行中則暫停導覽</dd>
    </dl>
    <h4>教學文章</h4>
    <ul class="bwz-docs">${TUTORIALS.map((t) => `<li><a data-h="doc" data-slug="教學/${t}">${t}</a></li>`).join("")}</ul>`
  el('[data-modal="help"]').hidden = false
  setTimeout(() => $<HTMLButtonElement>("[data-h=resume], [data-h=restart]", card)?.focus(), 30)
}

function closeHelp() {
  el('[data-modal="help"]').hidden = true
}

function onHelpClick(e: Event) {
  const target = e.target as HTMLElement
  if (target.matches(".bwz-modal")) {
    closeHelp()
    return
  }
  const btn = target.closest<HTMLElement>("[data-h]")
  if (!btn) return
  e.preventDefault()
  switch (btn.dataset.h) {
    case "close":
      closeHelp()
      break
    case "resume":
      startTour(false)
      break
    case "restart":
      startTour(true)
      break
    case "outline":
      closeHelp()
      go(SLUG.outline, scrollToWebsite)
      break
    case "maps":
      closeHelp()
      go(SLUG.maps)
      break
    case "doc":
      closeHelp()
      go(btn.dataset.slug!)
      break
    case "install-guide":
      closeHelp()
      ;(window as any).__pwaInstallGuide?.show?.()
      break
  }
}

/* ---------------- 完成畫面 ---------------- */

function showFinish() {
  const all = visibleSteps()
    .filter((s) => s.skill)
    .map((s) => s.skill!)
  const got = st.skills
  const card = $(".bwz-modal-card", el('[data-modal="finish"]'))!
  card.innerHTML = `
    <span class="bwz-seal bwz-big" aria-hidden="true">成</span>
    <h2>導覽完成</h2>
    <p>你已掌握 <b>${got.length} / ${all.length}</b> 項研讀技能</p>
    <ul class="bwz-skills">${all.map((k) => `<li class="${got.includes(k) ? "" : "miss"}">${k}</li>`).join("")}</ul>
    ${got.length < all.length ? `<p class="bwz-note">跳過的項目，之後可以在說明中心重新走一次。</p>` : ""}
    <div class="bwz-more"><b>還想多看一點？</b>各卷〈全書目錄及綱要〉最下方有互動網站和導讀影片，附錄裡也有聖經地圖（整理中）。</div>
    <blockquote class="bwz-verse">你的話是我腳前的燈，是我路上的光。<cite>詩篇 119:105</cite></blockquote>
    <div class="bwz-row">
      <button class="bwz-btn primary" type="button" data-f="close">開始讀經</button>
      <button class="bwz-btn" type="button" data-f="outline">看出埃及記的互動網站</button>
      <button class="bwz-btn" type="button" data-f="help">打開說明中心</button>
    </div>`
  el('[data-modal="finish"]').hidden = false
  setTimeout(() => $<HTMLButtonElement>("[data-f=close]", card)?.focus(), 30)
}

function onFinishClick(e: Event) {
  const target = e.target as HTMLElement
  const btn = target.closest<HTMLElement>("[data-f]")
  const modal = el('[data-modal="finish"]')
  if (target === modal || btn?.dataset.f === "close") modal.hidden = true
  else if (btn?.dataset.f === "help") {
    modal.hidden = true
    openHelp()
  } else if (btn?.dataset.f === "outline") {
    modal.hidden = true
    go(SLUG.outline, scrollToWebsite)
  }
}

/* ---------------- 情境提示點 ---------------- */

// 第一次到任何一卷的〈全書目錄及綱要〉時，在「互動網站」標題旁出現跳動的小圓點
function mountHints() {
  if (!/^\d{2}-[^/]+\/全書目錄及綱要$/.test(currentSlug())) return
  if (local.get(HINT_KEY, false)) return
  const h = websiteHeading()
  if (!h || $(".bwz-hint-dot", h)) return
  const dot = document.createElement("button")
  dot.type = "button"
  dot.className = "bwz-hint-dot"
  dot.setAttribute("aria-label", "互動網站是什麼？")
  h.appendChild(dot)
  dot.addEventListener("click", () => {
    if (h.nextElementSibling?.classList.contains("bwz-hint-tip")) return
    const tip = document.createElement("div")
    tip.className = "bwz-hint-tip"
    tip.innerHTML = `
      <span class="bwz-seal" aria-hidden="true">新</span>
      <div><p><b>每卷書的互動網站都收在這裡。</b>把某一章的場景做成可以操作的網頁，例如方舟、會幕、曠野的路線。點了會在新分頁開啟。</p>
      <button class="bwz-btn" type="button">知道了</button></div>`
    h.after(tip)
    $("button", tip)!.addEventListener("click", () => {
      local.set(HINT_KEY, true)
      tip.remove()
      dot.remove()
    })
  })
}

/* ---------------- 全域事件 ---------------- */

function onKeydownCapture(e: KeyboardEvent) {
  // 在搜尋外掛處理 Esc 之前記下狀態
  wasSearchOpen = searchOpen()
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") setTimeout(check, 60)
}

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const typing = !!target?.closest?.("input, textarea, select, [contenteditable='true']")
  if (e.key === "Escape") {
    if (helpOpen()) return closeHelp()
    if (finishOpen()) {
      el('[data-modal="finish"]').hidden = true
      return
    }
    if (wasSearchOpen || $(".popover.active-popover")) return
    if (st.status === "active") pauseTour()
    return
  }
  if (typing) return
  if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    helpOpen() ? closeHelp() : openHelp()
  }
}

function onClickCapture(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest(".darkmode, .puremode, .readermode")) {
    toolTouched = true
    setTimeout(check, 60)
  }
  if (target.closest(".search-button")) setTimeout(check, 60)
  const opener = target.closest<HTMLElement>("[data-tour-open]")
  if (opener) {
    e.preventDefault()
    startTour(true)
    return
  }
  if (target.closest("[data-tour-help]")) {
    e.preventDefault()
    openHelp()
  }
}

let hoverTimer: ReturnType<typeof setTimeout> | undefined
function onMouseOver(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest?.<HTMLAnchorElement>(`a.internal[data-slug="${SLUG.entry}"]`)
  if (!a) return
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    lambHovered = true
    check()
  }, 700)
}

function onMouseOut(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest?.(`a.internal[data-slug="${SLUG.entry}"]`)
  if (a && !(e.relatedTarget instanceof Node && a.contains(e.relatedTarget))) clearTimeout(hoverTimer)
}

let raf = 0
function reposition() {
  if (st.status !== "active") return
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const s = cur()
    if (s && onPage(s)) place(s)
  })
}

function onNav() {
  ensureDom()
  navSinceStep = true
  runAfterNav()
  mountHints()
  if (welcomeVisible && !onHome()) el(".bwz-welcome").hidden = false
  else if (st.status === "new" && !welcomeVisible) maybeShowWelcome()
  else el(".bwz-welcome").hidden = true
  if (st.status === "active") {
    startTicker()
    setTimeout(show, 120)
  }
}

function init() {
  const w = window as unknown as { __bwzTourBound?: boolean }
  ensureDom()
  updateFab()
  if (w.__bwzTourBound) return
  w.__bwzTourBound = true

  document.addEventListener("keydown", onKeydownCapture, true)
  document.addEventListener("keydown", onKeydown)
  document.addEventListener("click", onClickCapture, true)
  document.addEventListener("input", (e) => {
    if ((e.target as HTMLElement).matches?.(".search-bar")) setTimeout(check, 0)
  })
  document.addEventListener("mouseover", onMouseOver)
  document.addEventListener("mouseout", onMouseOut)
  window.addEventListener("scroll", reposition, { passive: true })
  document.addEventListener("scroll", reposition, { passive: true, capture: true })
  window.addEventListener("resize", () => st.status === "active" && show())
  document.addEventListener("nav", onNav)

  mountHints()
  if (st.status === "active") {
    startTicker()
    setTimeout(show, 400)
  } else {
    maybeShowWelcome()
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
