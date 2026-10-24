// 知識節點入口頁的建置時 HAST 轉換：
//   1. link_folder/index（知識節點總入口）：十一類條目依用途分四組，每類一張卡。
//   2. link_folder/<類別>/index（類別頁，folder-page 外掛自動產生、內容是空的）：
//      類別說明、同層分類、依書卷篩選與關鍵字篩選、最常讀到、依最早出現的書卷分組的條目清單。
// 與 interactiveHast.ts 同一個做法：建置時插入內容，沒有瀏覽器腳本也看得到，SPA 換頁不會先顯示舊內容。
// 篩選互動在 components/scripts/knowledgeHub.inline.ts；樣式在 styles/knowledge.scss；class 一律 bwz-kn- 開頭，
// 改 class 名稱要三邊一起改。
import type { Element, ElementContent, Root } from "hast"
import type { FullSlug } from "./path"
import { joinSegments, pathToRoot } from "./path"
import { BOOK_GROUPS, BIBLE_BOOKS } from "./bibleBooks"
import { el } from "./interactiveHast"
import {
  GROUPS,
  DEFAULT_GROUP,
  HUB_SLUG,
  ROOT_FOLDER,
  bookCounts,
  categoryInfo,
  knowledgeIndexFor,
  mostRead,
  sectionsByFirstBook,
} from "./knowledgeNodes"
import type { KnowledgeCategory, KnowledgeEntry, KnowledgeFile } from "./knowledgeNodes"

export interface KnowledgeHastContext {
  slug: string
  files: readonly KnowledgeFile[]
}

const WORDS = {
  lead: "讀經時點到的人物、地點、原文和主題，都收在這裡。每一條會隨著讀過的章節逐章累積，也可以直接從這裡查。",
  searchButton: "搜尋所有條目",
  searchHint: "例如「逾越節」「摩西」「亞伯拉罕之約」",
  helpPrefix: "不知道怎麼找？看",
  helpSecond: "也可以學",
  helpFirstLink: "如何查一個主題",
  helpSecondLink: "如何跨書卷找相關條目",
  hubTitle: "知識節點",
  allCategories: "全部分類",
  categoryNav: "知識節點分類",

  filterPlaceholder: "輸入名稱或別名",
  booksToggle: "依書卷篩選",
  allBooks: "全部書卷",
  booksLabel: "出現過的書卷",
  clear: "清除篩選",
  mostRead: "最常讀到",
  mostReadNote: "出現在最多章的條目",
  listNote: "依最早出現的書卷與章排列。選上面的書卷，可以看那一卷出現過的所有條目。",
  noResult: "沒有符合的條目。換個關鍵字，或選「全部書卷」再找一次。",
  chapterUnit: " 章",
} as const

const CATEGORY_INDEX_PATTERN = new RegExp(`^${ROOT_FOLDER}/([^/]+)/index$`, "u")

const TOP_LIMIT = 10
const TOP_MIN_ENTRIES = 30
const EXAMPLE_COUNT = 3
const EXAMPLE_MAX_LENGTH = 10

function hasTopLevelClass(root: Root, name: string): boolean {
  return root.children.some((node) => {
    if (node.type !== "element") return false
    const value = node.properties.className
    return Array.isArray(value) && value.map(String).includes(name)
  })
}

function relativePath(slug: string, path: string): string {
  return joinSegments(pathToRoot(slug as FullSlug), path)
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

/** 括號後面的註記（拈鬮分地（go.ral））留給條目頁，卡片上的例子只放名稱。 */
function shortTitle(title: string): string {
  return title.replace(/（[^）]*）$/u, "").trim() || title
}

function categoryHref(slug: string, name: string): string {
  return relativePath(slug, `${ROOT_FOLDER}/${name}/`)
}

function glyph(name: string): Element {
  return el("span", { className: ["bwz-kn-glyph"], ariaHidden: "true" }, [categoryInfo(name).glyph])
}

/** 印章上的字：類別名的第一個字（人物 → 人）。 */
function sealChar(name: string): string {
  return [...name][0] ?? ""
}

function seal(name: string, large = false): Element {
  const classes = large ? ["bwz-kn-seal", "bwz-kn-seal-lg"] : ["bwz-kn-seal"]
  return el("span", { className: classes, ariaHidden: "true" }, [sealChar(name)])
}

/** 頁面標題：內容的第一個標題是 h1 時，Quartz 的小字頁名會藏起來，標題沿用互動網站總入口的置中與花飾。 */
function pageTitle(title: string): Element {
  return el("h1", { id: title }, [title])
}

function hasTopLevelH1(root: Root): boolean {
  return root.children.some((node) => node.type === "element" && node.tagName === "h1")
}

function titleLength(entry: KnowledgeEntry): number {
  return [...entry.title].length
}

/**
 * 條目名稱的長短決定清單的欄寬（knowledge.scss 的 [data-wide]）：
 *   "1"：名稱很長（例如解經爭議的整句標題），單欄為主；
 *   "2"：名稱偏長，兩欄；
 *   空：短名稱（人名、地名），三欄。
 * 看第 75 百分位而不是中位數：互文、事件這類類別有一半是短名稱（「逃城」）、另一大塊是整句，
 * 欄寬要照得下長的那一批，不然長的每條都折成三四行。
 */
export function columnTier(entries: readonly KnowledgeEntry[]): "1" | "2" | null {
  if (!entries.length) return null
  const lengths = entries.map(titleLength).sort((a, b) => a - b)
  const p75 = lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * 0.75))]
  if (p75 > 12) return "1"
  if (p75 > 8) return "2"
  return null
}

/* ---------------------------- 總入口 ---------------------------- */

function hallHeading(title: string): Element {
  // 沿用互動網站總入口的段落標題（兩側花飾）。樣式在 interactive.scss 的 .bwz-ia-hall。
  return el("h2", { className: ["bwz-ia-hall"], id: title }, [el("span", {}, [title])])
}

function exampleTitles(category: KnowledgeCategory): string[] {
  return mostRead(category.entries, 40)
    .map((entry) => shortTitle(entry.title))
    .filter((title) => [...title].length <= EXAMPLE_MAX_LENGTH)
    .slice(0, EXAMPLE_COUNT)
}

function categoryCard(slug: string, category: KnowledgeCategory): Element {
  const info = categoryInfo(category.name)
  const examples = exampleTitles(category)
  const children: ElementContent[] = [
    seal(category.name),
    el("span", { className: ["bwz-kn-name"] }, [category.name]),
    el("span", { className: ["bwz-kn-count"] }, [`${formatCount(category.entries.length)} 條`]),
  ]
  if (info.blurb) children.push(el("span", { className: ["bwz-kn-blurb"] }, [info.blurb]))
  if (examples.length) {
    children.push(el("span", { className: ["bwz-kn-eg"] }, [`常讀到：${examples.join("、")}`]))
  }
  return el(
    "a",
    {
      className: ["internal", "bwz-kn-card"],
      href: categoryHref(slug, category.name),
      dataCat: category.name,
    },
    children,
  )
}

function groupedCategories(categories: readonly KnowledgeCategory[]): { group: string; items: KnowledgeCategory[] }[] {
  const order: string[] = [...GROUPS, DEFAULT_GROUP]
  return order
    .map((group) => ({
      group,
      items: categories.filter((category) => categoryInfo(category.name).group === group),
    }))
    .filter(({ items }) => items.length > 0)
}

function usedBooks(categories: readonly KnowledgeCategory[]): number {
  const books = new Set<string>()
  for (const category of categories) {
    for (const entry of category.entries) for (const book of entry.books) books.add(book)
  }
  return books.size
}

function buildHub(slug: string, files: readonly KnowledgeFile[]): Element {
  const { total, categories } = knowledgeIndexFor(files)
  const bookCount = usedBooks(categories)

  const children: ElementContent[] = [
    el("div", { className: ["bwz-kn-lead"] }, [WORDS.lead]),
    el("div", { className: ["bwz-kn-stats"] }, [
      `目前共 ${formatCount(total)} 個條目，分成 ${categories.length} 類` +
        (bookCount ? `，涵蓋 ${bookCount} 卷書。` : "。"),
    ]),
    el("button", { type: "button", className: ["bwz-kn-search"], hidden: true, dataKnSearch: "" }, [
      el("span", { className: ["bwz-kn-search-text"] }, [
        WORDS.searchButton,
        el("span", { className: ["bwz-kn-search-hint"] }, [`　${WORDS.searchHint}`]),
      ]),
      el("kbd", { ariaHidden: "true", dataKnKbd: "" }, ["Ctrl K"]),
    ]),
  ]

  for (const { group, items } of groupedCategories(categories)) {
    children.push(
      hallHeading(group),
      el("div", { className: ["bwz-kn-cards"] }, items.map((category) => categoryCard(slug, category))),
    )
  }

  children.push(
    el("div", { className: ["bwz-kn-help"] }, [
      WORDS.helpPrefix,
      el("a", { className: ["internal"], href: relativePath(slug, "教學/如何查一個主題") }, [WORDS.helpFirstLink]),
      `，${WORDS.helpSecond}`,
      el("a", { className: ["internal"], href: relativePath(slug, "教學/如何跨書卷找相關條目") }, [
        WORDS.helpSecondLink,
      ]),
      "。",
    ]),
  )

  return el("div", { className: ["bwz-kn", "bwz-kn-hub"] }, children)
}

/* ---------------------------- 類別頁 ---------------------------- */

function chip(slug: string, entry: KnowledgeEntry, extra?: ElementContent): Element {
  const props: Element["properties"] = {
    className: ["internal", "bwz-kn-chip"],
    href: relativePath(slug, entry.slug),
    dataBooks: entry.books.join("|"),
  }
  if (entry.aliases.length) props.dataAlias = entry.aliases.join("|")
  const children: ElementContent[] = [el("span", { className: ["bwz-kn-chip-t"] }, [entry.title])]
  if (extra) children.push(extra)
  return el("a", props, children)
}

function siblingNav(slug: string, current: string, categories: readonly KnowledgeCategory[]): Element {
  const pills: ElementContent[] = [
    el("a", { className: ["internal", "bwz-kn-pill", "bwz-kn-pill-all"], href: relativePath(slug, `${ROOT_FOLDER}/`) }, [
      WORDS.allCategories,
    ]),
  ]
  for (const category of categories) {
    const props: Element["properties"] = {
      className: ["internal", "bwz-kn-pill"],
      href: categoryHref(slug, category.name),
      dataCat: category.name,
    }
    if (category.name === current) props.ariaCurrent = "page"
    pills.push(
      el("a", props, [
        glyph(category.name),
        el("span", {}, [category.name]),
        el("span", { className: ["bwz-kn-pill-n"] }, [formatCount(category.entries.length)]),
      ]),
    )
  }
  return el("nav", { className: ["bwz-kn-pills"], ariaLabel: WORDS.categoryNav }, pills)
}

const BOOKS_PANEL_ID = "bwz-kn-books"

function bookFilter(entries: readonly KnowledgeEntry[]): Element | null {
  const counts = bookCounts(entries)
  if (!counts.length) return null
  const count = new Map(counts.map(({ name, count }) => [name, count]))

  const bookButton = (name: string, label: string, n: number, pressed: boolean): Element =>
    el(
      "button",
      { type: "button", className: ["bwz-kn-book"], dataBook: name, ariaPressed: pressed ? "true" : "false" },
      [label, el("span", { className: ["bwz-kn-book-n"] }, [formatCount(n)])],
    )

  const groups: ElementContent[] = [
    el("div", { className: ["bwz-kn-bgroup"] }, [bookButton("", WORDS.allBooks, entries.length, true)]),
  ]
  for (const group of BOOK_GROUPS) {
    const present = BIBLE_BOOKS.filter((book) => book.group === group.id && count.has(book.name))
    if (!present.length) continue
    groups.push(
      el("div", { className: ["bwz-kn-bgroup"] }, [
        el("span", { className: ["bwz-kn-bgroup-h"] }, [group.name]),
        ...present.map((book) => bookButton(book.name, book.name, count.get(book.name) ?? 0, false)),
      ]),
    )
  }
  // 書卷多（三十幾顆）時預設收起來，按「依書卷篩選」才展開，條目清單才不會被推到下面
  return el(
    "div",
    { className: ["bwz-kn-books"], id: BOOKS_PANEL_ID, role: "group", ariaLabel: WORDS.booksLabel, hidden: true, dataKnBooks: "" },
    groups,
  )
}

function toolbar(category: KnowledgeCategory): Element {
  const label = `在 ${formatCount(category.entries.length)} 個「${category.name}」條目中尋找`
  const books = bookFilter(category.entries)
  const bar: ElementContent[] = [
    el("label", { className: ["bwz-kn-find"] }, [
      el("span", { className: ["bwz-kn-sr"] }, [label]),
      el("input", {
        type: "search",
        className: ["bwz-kn-input"],
        placeholder: WORDS.filterPlaceholder,
        autoComplete: "off",
        spellCheck: "false",
        dataKnFilter: "",
      }),
    ]),
  ]
  if (books) {
    bar.push(
      el(
        "button",
        {
          type: "button",
          className: ["bwz-kn-books-toggle"],
          ariaExpanded: "false",
          ariaControls: BOOKS_PANEL_ID,
          dataKnBooksToggle: "",
        },
        [
          el("span", { className: ["bwz-kn-books-label"], dataKnBooksLabel: "", dataDefault: WORDS.booksToggle }, [
            WORDS.booksToggle,
          ]),
          el("span", { className: ["bwz-kn-chev"], ariaHidden: "true" }, ["▾"]),
        ],
      ),
    )
  }
  const children: ElementContent[] = [el("div", { className: ["bwz-kn-bar"] }, bar)]
  if (books) children.push(books)
  children.push(
    el("div", { className: ["bwz-kn-state"] }, [
      el("div", { className: ["bwz-kn-status"], ariaLive: "polite", ariaAtomic: "true", dataKnStatus: "" }, [
        `共 ${formatCount(category.entries.length)} 個條目`,
      ]),
      el("button", { type: "button", className: ["bwz-kn-clear"], hidden: true, dataKnClear: "" }, [WORDS.clear]),
    ]),
  )
  // 沒有 JavaScript 時篩選用不了，整列藏起來（清單本身照常顯示）；腳本載入後才拿掉 hidden
  return el("div", { className: ["bwz-kn-tools"], hidden: true, dataKnTools: "" }, children)
}

function mostReadStrip(slug: string, entries: readonly KnowledgeEntry[]): Element | null {
  if (entries.length < TOP_MIN_ENTRIES) return null
  const top = mostRead(entries, TOP_LIMIT)
  if (top.length < 4) return null
  return el("section", { className: ["bwz-kn-top"], dataKnTop: "" }, [
    el("div", { className: ["bwz-kn-top-h"] }, [
      el("span", { className: ["bwz-kn-top-t"] }, [WORDS.mostRead]),
      el("span", { className: ["bwz-kn-top-note"] }, [WORDS.mostReadNote]),
    ]),
    el(
      "ul",
      { className: ["bwz-kn-chips"] },
      top.map((entry) =>
        el("li", {}, [
          chip(slug, entry, el("span", { className: ["bwz-kn-chip-n"] }, [`${entry.chapterCount}${WORDS.chapterUnit}`])),
        ]),
      ),
    ),
  ])
}

function entryList(slug: string, entries: readonly KnowledgeEntry[]): Element {
  const sections = sectionsByFirstBook(entries).map((section) =>
    el("section", { className: ["bwz-kn-sec"], dataBook: section.name }, [
      el("h2", { className: ["bwz-kn-sec-h"], id: `book-${section.name}` }, [
        el("span", {}, [section.name]),
        el("span", { className: ["bwz-kn-sec-n"], dataKnSecN: "" }, [formatCount(section.entries.length)]),
      ]),
      el(
        "ul",
        { className: ["bwz-kn-chips"] },
        section.entries.map((entry) => el("li", {}, [chip(slug, entry)])),
      ),
    ]),
  )
  return el("div", { className: ["bwz-kn-list"], dataKnList: "" }, [
    el("div", { className: ["bwz-kn-note"] }, [WORDS.listNote]),
    ...sections,
    el("div", { className: ["bwz-kn-empty"], hidden: true, dataKnEmpty: "" }, [WORDS.noResult]),
  ])
}

function categoryHeader(category: KnowledgeCategory): Element {
  const info = categoryInfo(category.name)
  const books = bookCounts(category.entries).length
  const stats =
    `共 ${formatCount(category.entries.length)} 個條目` + (books ? `，出現在 ${books} 卷書裡` : "")
  const text: ElementContent[] = []
  if (info.blurb) text.push(el("div", { className: ["bwz-kn-blurb"] }, [info.blurb]))
  text.push(el("div", { className: ["bwz-kn-meta"] }, [stats]))
  return el("header", { className: ["bwz-kn-head"] }, [
    seal(category.name, true),
    el("div", { className: ["bwz-kn-head-text"] }, text),
  ])
}

function buildCategory(slug: string, category: KnowledgeCategory, categories: readonly KnowledgeCategory[]): Element {
  const props: Element["properties"] = { className: ["bwz-kn", "bwz-kn-cat"], dataCat: category.name }
  const tier = columnTier(category.entries)
  if (tier) props.dataWide = tier
  const children: ElementContent[] = [
    categoryHeader(category),
    siblingNav(slug, category.name, categories),
    toolbar(category),
  ]
  const top = mostReadStrip(slug, category.entries)
  if (top) children.push(top)
  children.push(entryList(slug, category.entries))
  return el("div", props, children)
}

/** 依頁面種類就地加入內容；其他頁面完全不動。 */
export function applyKnowledgeHub(root: Root, ctx: KnowledgeHastContext): boolean {
  if (!ctx.slug.startsWith(`${ROOT_FOLDER}/`)) return false
  if (hasTopLevelClass(root, "bwz-kn")) return false

  if (ctx.slug === HUB_SLUG) {
    if (!hasTopLevelH1(root)) root.children.push(pageTitle(WORDS.hubTitle))
    root.children.push(buildHub(ctx.slug, ctx.files))
    return true
  }

  const match = CATEGORY_INDEX_PATTERN.exec(ctx.slug)
  if (!match) return false
  const { categories } = knowledgeIndexFor(ctx.files)
  const category = categories.find((candidate) => candidate.name === match[1])
  if (!category) return false
  if (!hasTopLevelH1(root)) root.children.push(pageTitle(category.name))
  root.children.push(buildCategory(ctx.slug, category, categories))
  return true
}
