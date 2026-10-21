// 找出章節頁的「經文清單」：內文根節點的子節點由前往後看，遇到第一條分隔線（hr）就停，
// 停之前遇到的第一個有序清單（ol）就是經文清單；li 少於 1 個或多於 200 個就不當作經文清單。
// 規則和 plugins/personal-notes/src/client/model/verseList.ts 一致（外掛之間不互相引用，所以這裡複製一份）。

export const VERSE_LIST_CLASS = "bwz-ux-verses"
const MAX_VERSE_ITEMS = 200

export function findVerseListElement(root: ParentNode = document): HTMLOListElement | null {
  const article = root.querySelector("article")
  if (!article) return null
  const content = article.querySelector(":scope > .markdown-preview-view") ?? article

  let list: Element | null = null
  for (const child of Array.from(content.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag === "hr") return null
    if (tag === "ol") {
      list = child
      break
    }
  }
  if (!list) return null

  const items = Array.from(list.children).filter((c) => c.tagName.toLowerCase() === "li")
  if (items.length < 1 || items.length > MAX_VERSE_ITEMS) return null
  return list as HTMLOListElement
}

/** 在經文清單上加標記 class（CSS 靠這個 class 只影響經文清單），並清掉舊頁面殘留的標記。回傳標記的清單。 */
export function markVerseList(root: ParentNode = document): HTMLOListElement | null {
  const list = findVerseListElement(root)
  for (const old of Array.from(root.querySelectorAll(`.${VERSE_LIST_CLASS}`))) {
    if (old !== list) old.classList.remove(VERSE_LIST_CLASS)
  }
  list?.classList.add(VERSE_LIST_CLASS)
  return list
}
