export interface Verse {
  number: number
  el: HTMLLIElement
  text: string
}

/** 找到第一條分隔線之前的第一個有序清單，並回傳其中每一節；不修改 DOM。 */
export function findScriptureVerses(root: ParentNode = document): Verse[] | null {
  const article = root.querySelector("article")
  if (!article) return null

  const content =
    article.querySelector(":scope > .markdown-preview-view") ?? article

  let list: HTMLOListElement | null = null
  for (const child of Array.from(content.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag === "hr") return null
    if (tag === "ol") {
      list = child as HTMLOListElement
      break
    }
  }
  if (!list) return null

  const items = Array.from(list.children).filter(
    (child): child is HTMLLIElement => child.tagName.toLowerCase() === "li",
  )
  if (items.length < 1 || items.length > 200) return null

  const start = Number(list.getAttribute("start") ?? "1") || 1
  return items.map((el, index) => ({
    number: start + index,
    el,
    text: verseText(el),
  }))
}

const SKIP_TEXT_SELECTOR = ".bwz-v-ui, [hidden], [aria-hidden='true'], script, style"

function collectText(node: Node, output: string[]): void {
  if (node.nodeType === 3) {
    output.push(node.nodeValue ?? "")
    return
  }
  if (node.nodeType !== 1) return

  const element = node as Element
  if (element.matches(SKIP_TEXT_SELECTOR)) return

  for (const child of Array.from(element.childNodes)) {
    collectText(child, output)
  }
}

/** 取得一節經文的純文字，略過介面與隱藏元素並整理空白。 */
export function verseText(li: Element): string {
  const text: string[] = []
  collectText(li, text)
  return text.join("").replace(/\s+/g, " ").trim()
}
