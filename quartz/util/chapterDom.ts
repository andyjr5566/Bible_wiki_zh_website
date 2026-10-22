// 章節頁的 DOM 轉接層：把文章第一層子節點描述成 chapterRegions.ts 看得懂的簡化資料，
// 再把規則算出的索引換回元素。site-ux（純經文）與 verse-return（回到剛才的經節）共用這一份，
// 因為兩邊都要回答「經文清單是哪個、本章整理在哪裡」，只能有一個來源；判斷規則本身仍全在 chapterRegions.ts。
import { parseBookSlug } from "./bookCatalog"
import {
  ChapterNodeDescription,
  selectChapterRegions,
  selectHiddenSections,
  selectStudyRegion,
  studyAnchorIndex,
} from "./chapterRegions"

export interface ChapterDom {
  /** 內文根節點（.markdown-preview-view，沒有就是 article 本身） */
  root: Element
  children: Element[]
  descriptions: ChapterNodeDescription[]
  verseList: HTMLOListElement
  verseListIndex: number
}

export interface HiddenSectionElements {
  /** 區塊標題的文字（例如「本章整理」），用來在 collapsible 換掉元素之後還認得是同一個區塊 */
  title: string
  heading: Element
  elements: Element[]
}

const MAX_VERSE_ITEMS = 200

function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim()
}

export function describeNode(el: Element): ChapterNodeDescription {
  const tag = el.tagName.toLowerCase()
  const description: ChapterNodeDescription = { tag }
  if (el.className && typeof el.className === "string") description.className = el.className
  // 只有表格容器需要看文字（認前後章表格），其他節點不要複製大段文字
  if (el.classList.contains("table-container")) description.text = textOf(el)
  if (tag === "h2") description.headingText = textOf(el)
  if (tag === "details") {
    const title = el.querySelector(":scope > summary .collapsible-title") ?? el.querySelector(":scope > summary")
    description.headingText = textOf(title)
  }
  return description
}

/** 目前頁面是章節頁、而且認得出經文清單就回傳描述；否則 null（呼叫端因此什麼都不做）。 */
export function readChapterDom(doc: Document = document): ChapterDom | null {
  if (parseBookSlug(doc.body?.dataset.slug ?? "")?.kind !== "chapter") return null
  const article = doc.querySelector("article")
  if (!article) return null
  const root = article.querySelector(":scope > .markdown-preview-view") ?? article

  const children = Array.from(root.children)
  const descriptions = children.map(describeNode)
  const { verseListIndex } = selectChapterRegions(descriptions)
  if (verseListIndex === null) return null
  const verseList = children[verseListIndex] as HTMLOListElement
  const items = Array.from(verseList.children).filter((c) => c.tagName.toLowerCase() === "li")
  if (items.length < 1 || items.length > MAX_VERSE_ITEMS) return null
  return { root, children, descriptions, verseList, verseListIndex }
}

/** 純經文模式要藏的區塊（每個區塊一組元素）。 */
export function hiddenSectionElements(dom: ChapterDom): HiddenSectionElements[] {
  return selectHiddenSections(dom.descriptions).map((section) => ({
    title: dom.descriptions[section.start].headingText ?? "",
    heading: dom.children[section.start],
    elements: section.indices.map((index) => dom.children[index]),
  }))
}

/** 某個元素在文章第一層的哪個子節點裡（不在內文根節點底下回傳 -1）。 */
export function topLevelIndex(dom: ChapterDom, node: Node): number {
  let current: Node | null = node
  while (current && current.parentNode !== dom.root) current = current.parentNode
  return current ? dom.children.indexOf(current as Element) : -1
}

/** 經文清單裡某個元素屬於第幾節（用 li 的順序加上 ol 的 start，不依賴別的外掛有沒有加 id）；不在經文裡回傳 null。 */
export function verseNumberOf(dom: ChapterDom, node: Node): number | null {
  let current: Node | null = node
  while (current && current.parentNode !== dom.verseList) current = current.parentNode
  if (!current) return null
  const items = Array.from(dom.verseList.children).filter((c) => c.tagName.toLowerCase() === "li")
  const position = items.indexOf(current as Element)
  if (position === -1) return null
  const start = Number.isInteger(dom.verseList.start) ? dom.verseList.start : 1
  return start + position
}

/** 元素在「本章整理」裡時，回傳最近的上一個小標題的 id（沒有 h3 就是本章整理標題的 id）；不在整理裡或沒有 id 回傳 null。 */
export function studyHeadingIdOf(dom: ChapterDom, node: Node): string | null {
  const region = selectStudyRegion(dom.descriptions)
  if (!region) return null
  const index = topLevelIndex(dom, node)
  if (index === -1) return null
  const anchor = studyAnchorIndex(dom.descriptions, region, index)
  if (anchor === null) return null
  return dom.children[anchor].id || null
}
