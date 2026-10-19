// 章節頁「經文清單」的判斷規則（13 §3.2）：瀏覽器端（ui/verses.ts）與建置檢查（src/verseCheck.ts）共用，
// 規則只寫這一份。純函式，不碰 DOM；用最小的節點介面，瀏覽器傳 DOM 元素的轉接器、建置時傳 hast 節點的轉接器。
//
// 規則：在內文根節點的子節點裡由前往後看，遇到第一條分隔線（hr）就停；停之前遇到的第一個有序清單（ol）就是經文清單。
// 清單裡的 li 少於 1 個或多於 200 個就不當作經文清單。節數從 ol 的 start 屬性開始算（沒有就是 1）。

/** 最小的節點介面。非元素節點（文字、註解）的 tag 回傳 null；tag 一律小寫。 */
export interface NodeAdapter<N> {
  tag(n: N): string | null
  children(n: N): readonly N[]
  /** 屬性值；沒有這個屬性回傳 null 或 undefined。 */
  attr(n: N, name: string): string | null | undefined
}

/** 認得出的經文清單。 */
export interface VerseList<N> {
  list: N
  items: N[]
  /** 第一節的節數（ol 的 start，預設 1）。 */
  start: number
}

/** 用戶端放寬的上限：超過就當作不是經文清單。 */
export const MAX_VERSE_ITEMS = 200
/** 建置檢查的合理範圍：全本聖經最長的一章（詩篇 119）有 176 節。 */
export const MAX_CHAPTER_VERSES = 176

function startOf<N>(a: NodeAdapter<N>, ol: N): number {
  return Number(a.attr(ol, "start") ?? "1") || 1
}

function itemsOf<N>(a: NodeAdapter<N>, ol: N): N[] {
  return a.children(ol).filter((c) => a.tag(c) === "li")
}

/** 第一條分隔線之前的第一個有序清單（不管幾個 li）；沒有就是 null。 */
function firstOl<N>(content: N, a: NodeAdapter<N>): N | null {
  for (const el of a.children(content)) {
    const tag = a.tag(el)
    if (tag === "hr") return null // 經文清單一定在第一條分隔線之前
    if (tag === "ol") return el
  }
  return null
}

/** 找經文清單；認不出（沒有清單、清單是空的或超過 200 個 li）回傳 null。 */
export function findVerseList<N>(content: N, a: NodeAdapter<N>): VerseList<N> | null {
  const list = firstOl(content, a)
  if (!list) return null
  const items = itemsOf(a, list)
  if (items.length === 0 || items.length > MAX_VERSE_ITEMS) return null
  return { list, items, start: startOf(a, list) }
}

/**
 * 建置檢查：回傳這一章經文清單的問題（繁體中文）；空陣列＝通過。只做基本檢查（D-46）：
 * 認不出清單、節數不在 1–176、清單在中間被分成兩段、不是從第 1 節開始。
 */
export function checkVerseList<N>(content: N, a: NodeAdapter<N>): string[] {
  const kids = a.children(content)
  const firstIndex = kids.findIndex((el) => a.tag(el) === "hr" || a.tag(el) === "ol")
  if (firstIndex < 0 || a.tag(kids[firstIndex]) !== "ol") {
    return ["找不到經文清單（第一條分隔線之前沒有有序清單）"]
  }
  const list = kids[firstIndex]
  const count = itemsOf(a, list).length
  const problems: string[] = []
  if (count < 1 || count > MAX_CHAPTER_VERSES) {
    problems.push(`經文清單有 ${count} 節（應為 1 到 ${MAX_CHAPTER_VERSES} 節）`)
  }
  const start = startOf(a, list)
  if (start !== 1) problems.push(`經文從第 ${start} 節開始`)

  // 分隔線之前若還有別的有序清單，而且編號剛好接在前一段後面，就是同一章的經文被分成了兩段
  let end = start + count - 1
  for (const el of kids.slice(firstIndex + 1)) {
    const tag = a.tag(el)
    if (tag === "hr") break
    if (tag !== "ol") continue
    const nextCount = itemsOf(a, el).length
    if (startOf(a, el) === end + 1) {
      problems.push(`清單在第 ${end} 節之後被分成兩段`)
      end += nextCount
    }
  }
  return problems
}
