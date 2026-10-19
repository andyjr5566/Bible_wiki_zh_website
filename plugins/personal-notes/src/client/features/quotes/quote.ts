// 引用到筆記（F6）的純函式：引文格式、能不能引用的判斷、在游標位置插入。不碰 DOM，方便單元測試。（在游標位置插入的 insertAtCaret 在 ui/textInsert.ts，筆記編輯器也要用。）

/** 引文最多取幾個字。 */
export const MAX_QUOTE_CHARS = 1000

/** 選取位置之前的小標題候選（依文件順序，最後一個最近）。id 為 null＝畫面上有標題文字但沒有可跳的 id（例如被改成可收合區塊的 h2）。 */
export interface HeadingCandidate {
  text: string
  id: string | null
}

export interface QuoteSource {
  /** 頁面 slug（[[slug#id|label]] 的 slug） */
  slug: string
  /** 頁面的顯示名稱，例如「創世記 1」或條目標題 */
  pageLabel: string
  /** 選取位置之前的小標題，依文件順序 */
  headings: readonly HeadingCandidate[]
}

export interface FormattedQuote {
  markdown: string
  truncated: boolean
}

/** 正規化選取文字：統一換行、去掉每行尾端空白、連續空行縮成一行、頭尾去空白；超過上限只取前 1000 字（以字元計）。 */
export function normalizeQuoteText(raw: string): { text: string; truncated: boolean } {
  let text = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t 　]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  const chars = Array.from(text)
  const truncated = chars.length > MAX_QUOTE_CHARS
  if (truncated) text = chars.slice(0, MAX_QUOTE_CHARS).join("").trimEnd()
  return { text, truncated }
}

/** [[ ]] 裡不能有的字元換成空白。 */
const wikiSafe = (s: string) => s.replace(/[[\]|\r\n]+/g, " ").replace(/\s+/g, " ").trim()

/**
 * 決定出處：標題文字用最近的那個（畫面上看到的區段名稱）；連結的 id 用最近一個有 id 的標題
 * （最近的沒有 id 時往前找，都沒有就只連到頁面）。沒有任何有文字的標題回傳 null。
 */
export function pickSource(headings: readonly HeadingCandidate[]): { text: string; id: string | null } | null {
  const named = headings.filter((h) => wikiSafe(h.text))
  const nearest = named[named.length - 1]
  if (!nearest) return null
  let id: string | null = null
  for (let i = headings.length - 1; i >= 0; i--) {
    const cand = headings[i].id?.replace(/[[\]|\s]/g, "")
    if (cand) {
      id = cand
      break
    }
  }
  return { text: wikiSafe(nearest.text), id }
}

/**
 * 組出要放進筆記的引文：
 *   > 選取的文字（每行都加 "> "）
 *   > —— [[slug#id|頁面 · 小標題]]
 *   （空行）
 * 選取文字是空的回傳 null。
 */
export function formatQuote(raw: string, source: QuoteSource): FormattedQuote | null {
  const { text, truncated } = normalizeQuoteText(raw)
  if (!text) return null
  const lines = text.split("\n").map((l) => (l ? `> ${l}` : ">"))
  const pick = pickSource(source.headings)
  const page = wikiSafe(source.pageLabel) || wikiSafe(source.slug)
  const label = pick ? `${page} · ${pick.text}` : page
  const target = pick?.id ? `${source.slug}#${pick.id}` : source.slug
  lines.push(`> —— [[${target}|${label}]]`)
  return { markdown: `${lines.join("\n")}\n\n`, truncated }
}

export interface QuotableFlags {
  /** 選取範圍是空的或只有空白 */
  empty: boolean
  /** 兩端都在 article 內 */
  inArticle: boolean
  /** 任一端在本外掛自己的畫面裡（.bwz-*、筆記面板、便條、輸入框、浮出預覽） */
  inOwnUi: boolean
  /** 範圍碰到經文清單（那是經文工具列的範圍） */
  touchesVerses: boolean
}

/** 這個選取要不要顯示「引用到筆記」。 */
export function isQuotable(f: QuotableFlags): boolean {
  return !f.empty && f.inArticle && !f.inOwnUi && !f.touchesVerses
}
