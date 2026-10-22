// 首頁刊頭：把筆記庫 index.md 開頭的「標題（h1）」與緊接的引言（blockquote）在建置時取出，畫在首頁入口與導覽卡的上面。
// 為什麼要搬：標題和介紹是首頁的門面，一進來就該先看到；但入口與導覽卡在文章的上面，
// 不搬的話新訪客得先捲過整個入口才看到網站名稱。
// 為什麼從內容樹取、不寫死：這些話屬於筆記庫（單一來源），日後改文字只改 index.md，不用動程式。
//
// 取出規則（唯一的定義；masthead.scss 的隱藏規則是它的 CSS 版本，兩邊要一起改）：
//   內容樹根的子節點，略過空白文字與註解之後，第一個必須是有內容（有字或有圖）的 h1 → 取出它。
//   h1 後面緊接的 blockquote（有內容）也一起取出，是可選的。
//   最後一個取出的元素後面緊接的 hr（分隔線）也記下來（h1＋hr 或 h1＋引言＋hr）：
//   搬走之後文章最上面不能剩一條孤線。
//   第一個不是 h1（或 h1 是空的）就整個不取出，回傳 null；這時不畫刊頭、也不隱藏文章裡的任何東西，頁面維持原狀。
//   CSS 的鄰接選擇器（h1:first-child [+ blockquote] [+ hr]）只認元素、略過文字與註解，所以這裡取出的元素，
//   在 DOM 裡一定也符合；CSS 要有刊頭的 data 屬性（值記錄取出了哪些）才生效，所以取出沒有包含的元素
//   （例如 h1 後面隔了別的元素的引言）不會被藏。
//
// 為什麼刊頭的 h1 要帶和原件相同的 id：右欄目錄第一項（以及 #標題 網址）連到那個 id。原件被 CSS 藏起來，
// 捲不到；刊頭在 DOM 裡排在文章前面，getElementById 與瀏覽器的 #fragment 都取第一個，所以會捲到刊頭。
// 代價是整頁有兩個相同 id（原件是 display:none，不在無障礙樹裡）；沒有 aria 屬性指向它（ordercheck 會檢查）。
// 其餘元素（引言裡的）的 id 一律拿掉，沒有東西會指向它們。
import type { Element, ElementContent, Root, RootContent } from "hast"

/** 刊頭的 data 屬性：值記錄取出了哪些元素（空白分隔），CSS 靠它決定隱藏哪些（見 masthead.scss） */
export const MASTHEAD_ATTR = "data-bwz-masthead"
/** h1 後面直接接 hr（沒有引言） */
export const PATTERN_HEADING_RULE = "h1 hr"
/** h1、引言、引言後面的 hr */
export const PATTERN_FULL = "h1 blockquote hr"

export interface Masthead {
  /** 要畫的節點：h1（可選再加引言）的複本，不動到原本的內容樹 */
  nodes: Element[]
  /** 取出了緊接在 h1 後面的引言 */
  hasIntro: boolean
  /** 最後取出的元素後面緊接著 hr：原文章裡的分隔線也要隱藏 */
  hasRule: boolean
}

const isBlankText = (node: RootContent): boolean => node.type === "text" && node.value.trim() === ""

// 能看到、會影響版面的子節點：元素或有字的文字；空白文字與註解都不算（CSS 的鄰接選擇器也看不到它們）
const isSignificant = (node: RootContent): boolean => node.type !== "comment" && !isBlankText(node)

const isElement = (node: RootContent | undefined, tagName: string): node is Element =>
  node?.type === "element" && node.tagName === tagName

// 有字或有圖才算有內容；空的 h1 畫出來會是螢幕閱讀器念到的「空標題」，寧可退回原狀
const hasContent = (node: RootContent): boolean => {
  if (node.type === "text") return node.value.trim() !== ""
  if (node.type !== "element") return false
  return node.tagName === "img" || node.children.some(hasContent)
}

/** 深複製；子孫的 id 一律拿掉（見檔頭），只有 h1 本身保留 id。Quartz 的標題錨點連結留著，指向的 id 現在在刊頭。 */
function clone(node: ElementContent, keepId: boolean): ElementContent {
  if (node.type !== "element") return structuredClone(node)
  const { id, ...rest } = node.properties ?? {}
  return {
    ...node,
    properties: keepId && id !== undefined ? { id, ...rest } : rest,
    children: node.children.map((child) => clone(child, false)),
  }
}

// 元件拿到的 tree 型別是 unknown（外掛型別套件的定義）；不是 root 或形狀不對一律當作沒有刊頭
const isRoot = (tree: unknown): tree is Root =>
  typeof tree === "object" && tree !== null && (tree as Root).type === "root" && Array.isArray((tree as Root).children)

export function extractMasthead(tree: unknown): Masthead | null {
  if (!isRoot(tree)) return null
  const [first, second, third] = tree.children.filter(isSignificant)
  if (!isElement(first, "h1") || !hasContent(first)) return null
  const hasIntro = isElement(second, "blockquote") && hasContent(second)
  const last = hasIntro ? third : second
  return {
    nodes: (hasIntro ? [first, second] : [first]).map((node) => clone(node, node === first) as Element),
    hasIntro,
    hasRule: isElement(last, "hr"),
  }
}

/** 刊頭 data 屬性的值：取出了哪幾個元素，例如 "h1"、"h1 hr"、"h1 blockquote"、"h1 blockquote hr" */
export const mastheadPattern = (masthead: Masthead): string =>
  ["h1", masthead.hasIntro && "blockquote", masthead.hasRule && "hr"].filter(Boolean).join(" ")
