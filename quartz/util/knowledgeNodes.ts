// 知識節點（link_folder）入口頁的資料層：從建置時的頁面清單算出「有哪些類別、每類有哪些條目、
// 每個條目出現在哪幾卷書的哪幾章」。HTML 由 knowledgeHast.ts 產生。
//
// 為什麼不手寫一份 index.md：條目有三千多條、每天都在長，手寫的清單一定過期；而且 index.md 若用
// [[連結]] 列出所有條目，每個條目的關係圖譜都會多出一個「知識節點」節點。這裡只在渲染時產生
// 一般的 <a>，不進 crawl-links 的連結資料，關係圖譜不受影響。
import type { Element, ElementContent, Root } from "hast"
import { BIBLE_BOOKS } from "./bibleBooks"

export const ROOT_FOLDER = "link_folder"
export const HUB_SLUG = `${ROOT_FOLDER}/index`

/** 其他出處（條目沒有出現在任何一卷書的「按書卷累積」裡）的分組名稱。 */
export const OTHER_SOURCE = "其他出處"

/** 建置時頁面資料裡本模組會用到的欄位（QuartzPluginData 的子集，測試時可以直接給假資料）。 */
export interface KnowledgeFile {
  slug?: string
  frontmatter?: Record<string, unknown>
  htmlAst?: Root
}

export interface KnowledgeEntry {
  slug: string
  title: string
  category: string
  /** frontmatter 的 secondary_types，沒有就是空陣列 */
  secondary: string[]
  aliases: string[]
  /** 出現過的書卷，依聖經順序 */
  books: string[]
  /** 最早出現的書卷；沒有任何一卷書就是 null */
  firstBook: string | null
  /** 在 firstBook 裡最早出現的章（沒有章號時是 0） */
  firstChapter: number
  /** 出現過的章數（所有書卷加總），用來找「最常讀到」的條目 */
  chapterCount: number
}

export interface KnowledgeCategory {
  name: string
  entries: KnowledgeEntry[]
}

export interface KnowledgeIndex {
  total: number
  categories: KnowledgeCategory[]
}

export interface CategoryInfo {
  /** 入口頁的分組標題 */
  group: string
  /** 一句話說明這一類收什麼 */
  blurb: string
  /** 顏色旁邊的形狀符號，與關係圖譜的形狀對應（顏色在 knowledge.scss） */
  glyph: string
}

/** 已知類別的順序、分組與說明；新出現的資料夾排在這些之後，用預設說明。 */
export const GROUPS = ["認識人與地", "讀懂當時的世界", "領會神學與主題", "深入原文與經文互證"] as const

export const CATEGORY_INFO: Readonly<Record<string, CategoryInfo>> = {
  人物: { group: GROUPS[0], glyph: "●", blurb: "聖經裡的人物與族群：他是誰、做了什麼、和誰相關、在哪幾章出現。" },
  地點: { group: GROUPS[0], glyph: "■", blurb: "城邑、山河、地區與聖所：位置、特色，以及在經文裡扮演的角色。" },
  事件: { group: GROUPS[0], glyph: "▼", blurb: "經文記載的事件與個別律例：發生了什麼、前因後果，以及各家怎麼看。" },
  歷史: { group: GROUPS[0], glyph: "◆", blurb: "以色列歷史中的時期與轉折：時間先後、前後銜接與歷史脈絡。" },
  背景: { group: GROUPS[1], glyph: "□", blurb: "古代近東的處境：地理、制度、器物與考古線索，幫助讀懂當時的場景。" },
  文化: { group: GROUPS[1], glyph: "★", blurb: "古代以色列人的生活與習俗：禮儀、制度與日常，讀經時常需要的文化常識。" },
  神學: { group: GROUPS[2], glyph: "▲", blurb: "從經文整理出來的神學概念：約、獻祭、神的屬性與作為。" },
  主題: { group: GROUPS[2], glyph: "◇", blurb: "貫穿多章經文的主題、象徵與器物，看一個概念怎麼一路發展。" },
  解經爭議: { group: GROUPS[2], glyph: "⬡", blurb: "各家解經看法不同的地方：把不同說法與依據並列，方便自己比較。" },
  原文: { group: GROUPS[3], glyph: "⬢", blurb: "希伯來文與希臘文的詞彙：字根、字義，以及在經文裡的用法。" },
  互文: { group: GROUPS[3], glyph: "✚", blurb: "經文之間的引用與呼應：舊約如何被新約引用、不同書卷的平行與預表。" },
}

export const DEFAULT_GROUP = "其他分類"
export const DEFAULT_GLYPH = "●"

const CATEGORY_ORDER = Object.keys(CATEGORY_INFO)

export function categoryInfo(name: string): CategoryInfo {
  return CATEGORY_INFO[name] ?? { group: DEFAULT_GROUP, glyph: DEFAULT_GLYPH, blurb: "" }
}

const BOOK_ORDER = new Map<string, number>(BIBLE_BOOKS.map((book) => [book.name, book.num]))

/** 書卷在聖經裡的順序；不是書卷的名稱回傳 undefined。 */
export function bookOrder(name: string): number | undefined {
  return BOOK_ORDER.get(name)
}

function nodeText(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  return node.children.map(nodeText).join("")
}

function headingText(node: Element): string {
  return nodeText(node).normalize("NFKC").replace(/\s+/gu, "")
}

const ACCUMULATION_HEADING = "按書卷累積"
const CHAPTER_PATTERN = /第(\d+)章/u

/**
 * 讀條目最底下的「按書卷累積」：## 之下每個 ### 是書卷名，書卷下每個 #### 是一章（「第12章」）。
 * 「觸發來源」「聖經出現」之類不是書卷的 ### 一律略過。回傳書卷 → 章號清單（沒有章號的書卷是空陣列）。
 */
export function readAccumulation(root: Root | undefined): Map<string, number[]> {
  const books = new Map<string, number[]>()
  if (!root) return books

  let inSection = false
  let current: number[] | null = null
  for (const node of root.children) {
    if (node.type !== "element") continue
    if (node.tagName === "h2") {
      inSection = headingText(node) === ACCUMULATION_HEADING
      current = null
      continue
    }
    if (!inSection) continue
    if (node.tagName === "h3") {
      const name = headingText(node)
      if (bookOrder(name) === undefined) {
        current = null
        continue
      }
      current = books.get(name) ?? []
      books.set(name, current)
    } else if (node.tagName === "h4" && current) {
      const match = CHAPTER_PATTERN.exec(headingText(node))
      if (match) current.push(Number(match[1]))
    }
  }
  return books
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
}

/** link_folder/<類別>/<條目> → 類別；其他頁面（含類別資料夾自己的 index）回傳 null。 */
export function categoryOfSlug(slug: string): string | null {
  const parts = slug.split("/")
  if (parts.length < 3 || parts[0] !== ROOT_FOLDER) return null
  if (parts[parts.length - 1] === "index") return null
  return parts[1] || null
}

export function toEntry(file: KnowledgeFile): KnowledgeEntry | null {
  const slug = file.slug ?? ""
  const category = categoryOfSlug(slug)
  if (!category) return null

  const accumulation = readAccumulation(file.htmlAst)
  const books = [...accumulation.keys()].sort((a, b) => (bookOrder(a) ?? 0) - (bookOrder(b) ?? 0))
  const firstBook = books[0] ?? null
  const firstChapters = firstBook ? accumulation.get(firstBook) ?? [] : []
  let chapterCount = 0
  for (const chapters of accumulation.values()) chapterCount += chapters.length

  const fmTitle = file.frontmatter?.title
  const fallbackTitle = slug.split("/").at(-1) ?? slug
  return {
    slug,
    title: typeof fmTitle === "string" && fmTitle.trim() ? fmTitle.trim() : fallbackTitle,
    category,
    secondary: stringList(file.frontmatter?.secondary_types),
    aliases: stringList(file.frontmatter?.aliases),
    books,
    firstBook,
    firstChapter: firstChapters.length ? Math.min(...firstChapters) : 0,
    chapterCount,
  }
}

const collator = new Intl.Collator("zh-Hant")

/** 組內排序：先依最早出現的章，同一章再依名稱（注音順序）。 */
export function compareEntries(a: KnowledgeEntry, b: KnowledgeEntry): number {
  return a.firstChapter - b.firstChapter || collator.compare(a.title, b.title)
}

function compareCategories(a: string, b: string): number {
  const ia = CATEGORY_ORDER.indexOf(a)
  const ib = CATEGORY_ORDER.indexOf(b)
  if (ia >= 0 && ib >= 0) return ia - ib
  if (ia >= 0) return -1
  if (ib >= 0) return 1
  return collator.compare(a, b)
}

export function buildKnowledgeIndex(files: readonly KnowledgeFile[]): KnowledgeIndex {
  const byCategory = new Map<string, KnowledgeEntry[]>()
  let total = 0
  for (const file of files) {
    const entry = toEntry(file)
    if (!entry) continue
    const list = byCategory.get(entry.category) ?? []
    list.push(entry)
    byCategory.set(entry.category, list)
    total++
  }
  const categories = [...byCategory.keys()].sort(compareCategories).map((name) => ({
    name,
    entries: byCategory.get(name)!.sort(compareEntries),
  }))
  return { total, categories }
}

/** 不在 CATEGORY_INFO 的類別資料夾：入口頁會把它放進「其他分類」、沒有說明與印章顏色，要補上才完整。 */
export function unknownCategories(index: KnowledgeIndex): string[] {
  return index.categories.map((category) => category.name).filter((name) => !(name in CATEGORY_INFO))
}

function warnUnknownCategories(index: KnowledgeIndex) {
  const names = unknownCategories(index)
  if (!names.length) return
  const message =
    `知識節點出現新類別「${names.join("、")}」：入口頁先放在「${DEFAULT_GROUP}」。` +
    `到 quartz/util/knowledgeNodes.ts 的 CATEGORY_INFO 補上分組與說明，` +
    `到 quartz/styles/knowledge.scss 補上印章顏色。`
  // GitHub Actions 看得到的註解格式；本機建置就是一行普通警告
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=知識節點::${message}` : `[knowledge] ${message}`)
}

// 同一次建置裡每一頁拿到的是同一個頁面陣列，算一次就好（類別頁與入口頁共用）
const cache = new WeakMap<readonly KnowledgeFile[], KnowledgeIndex>()

export function knowledgeIndexFor(files: readonly KnowledgeFile[]): KnowledgeIndex {
  let index = cache.get(files)
  if (!index) {
    index = buildKnowledgeIndex(files)
    cache.set(files, index)
    warnUnknownCategories(index)
  }
  return index
}

export interface BookSection {
  /** 書卷名稱；沒有出處的條目用 OTHER_SOURCE */
  name: string
  entries: KnowledgeEntry[]
}

/** 依「最早出現的書卷」分組，書卷依聖經順序，沒有出處的放最後。 */
export function sectionsByFirstBook(entries: readonly KnowledgeEntry[]): BookSection[] {
  const groups = new Map<string, KnowledgeEntry[]>()
  for (const entry of entries) {
    const key = entry.firstBook ?? OTHER_SOURCE
    const list = groups.get(key) ?? []
    list.push(entry)
    groups.set(key, list)
  }
  const rank = (name: string) => bookOrder(name) ?? Number.MAX_SAFE_INTEGER
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([name, list]) => ({ name, entries: [...list].sort(compareEntries) }))
}

/** 每卷書有幾個條目出現過（一個條目出現在幾卷書就算幾次）。依聖經順序。 */
export function bookCounts(entries: readonly KnowledgeEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const book of entry.books) counts.set(book, (counts.get(book) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (bookOrder(a) ?? 0) - (bookOrder(b) ?? 0))
    .map(([name, count]) => ({ name, count }))
}

/** 出現章數最多的條目（章數相同時依名稱）；章數是 0 的不算。 */
export function mostRead(entries: readonly KnowledgeEntry[], limit: number): KnowledgeEntry[] {
  return entries
    .filter((entry) => entry.chapterCount > 0)
    .sort((a, b) => b.chapterCount - a.chapterCount || collator.compare(a.title, b.title))
    .slice(0, limit)
}

