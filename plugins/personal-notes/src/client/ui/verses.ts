// 章節頁的經節工具（12 C2、C3）：在頁面上找到經文清單、替每一節標上節數、把選取範圍換成節數、
// 在經文裡找回畫過重點的那段文字並標示。
//
// 防禦式：章節頁的經文目前是「導覽表之後、第一條分隔線之前的有序清單」（content 仍在建置中，D-14）。
// 認不出這個結構就什麼都不做，不影響頁面與筆記功能。

export interface Quote {
  exact: string
  prefix: string
  suffix: string
}

const SKIP = ".bwz-v-ui" // 我們自己加在經文裡的元素（標記、按鈕），取文字時略過

/** 找到經文清單並替每一節標上 data-v 與 id="v節數"；找不到回傳 null。可重複呼叫。 */
export function annotateVerses(root: ParentNode = document): HTMLOListElement | null {
  const article = root.querySelector("article")
  if (!article) return null
  // 網站主題會把內文包在 .markdown-preview-view 裡；沒有這一層就直接看 article
  const content = article.querySelector(":scope > .markdown-preview-view") ?? article
  let list: HTMLOListElement | null = null
  for (const el of Array.from(content.children)) {
    if (el.tagName === "HR") break // 經文清單一定在第一條分隔線之前
    if (el.tagName === "OL") {
      list = el as HTMLOListElement
      break
    }
  }
  if (!list) return null
  const items = Array.from(list.children).filter((c): c is HTMLLIElement => c.tagName === "LI")
  if (items.length === 0 || items.length > 200) return null
  const start = Number(list.getAttribute("start") ?? "1") || 1
  items.forEach((li, i) => {
    const v = String(start + i)
    if (li.dataset.v !== v) {
      li.dataset.v = v
      li.id = `v${v}`
    }
  })
  list.classList.add("bwz-verses")
  return list
}

export function verseElement(list: HTMLElement, v: number): HTMLLIElement | null {
  return list.querySelector<HTMLLIElement>(`:scope > li[data-v="${v}"]`)
}

/** 一節經文的文字節點（略過我們加的元素）。 */
function textNodes(el: Element): Text[] {
  const out: Text[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => ((n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)),
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text)
  return out
}

export function verseText(li: Element): string {
  return textNodes(li)
    .map((t) => t.data)
    .join("")
}

/** 選取範圍落在哪幾節；不在經文裡回傳 null。單一節時另外回傳選取的文字與前後文（畫重點用）。 */
export function selectionToVerses(sel: Selection | null, list: HTMLElement): { start: number; end: number; quote: Quote | null } | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  const liOf = (n: Node) => (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest<HTMLLIElement>("li[data-v]")
  const a = liOf(range.startContainer)
  const b = liOf(range.endContainer)
  if (!a || !b || a.parentElement !== list || b.parentElement !== list) return null
  const va = Number(a.dataset.v)
  const vb = Number(b.dataset.v)
  const start = Math.min(va, vb)
  const end = Math.max(va, vb)
  if (start !== end) return { start, end, quote: null }
  // 單一節：算出選取文字在這一節裡的位置
  const nodes = textNodes(a)
  let offset = 0
  let from = -1
  let to = -1
  for (const t of nodes) {
    if (t === range.startContainer) from = offset + range.startOffset
    if (t === range.endContainer) to = offset + range.endOffset
    offset += t.data.length
  }
  const text = nodes.map((t) => t.data).join("")
  if (from < 0) from = 0
  if (to < 0) to = text.length
  const exact = text.slice(from, to)
  if (!exact.trim()) return null
  return { start, end, quote: { exact, prefix: text.slice(Math.max(0, from - 16), from), suffix: text.slice(to, to + 16) } }
}

/**
 * 在一段經文裡找回畫重點的位置（純函式）：exact 出現多次時，用前後文比對最像的那一個。
 * 找不到回傳 null（經文改過了）。
 */
export function locateQuote(text: string, q: Quote): [number, number] | null {
  if (!q.exact) return null
  let best: [number, number] | null = null
  let bestScore = -1
  for (let i = text.indexOf(q.exact); i >= 0; i = text.indexOf(q.exact, i + 1)) {
    const before = text.slice(Math.max(0, i - q.prefix.length), i)
    const after = text.slice(i + q.exact.length, i + q.exact.length + q.suffix.length)
    let score = 0
    for (let k = 1; k <= Math.min(before.length, q.prefix.length) && before[before.length - k] === q.prefix[q.prefix.length - k]; k++) score++
    for (let k = 0; k < Math.min(after.length, q.suffix.length) && after[k] === q.suffix[k]; k++) score++
    if (score > bestScore) {
      bestScore = score
      best = [i, i + q.exact.length]
    }
  }
  return best
}

/** 把一節經文裡 [start, end) 的文字包上 <mark>（跨過連結等元素時分段包）；回傳建立的 mark。 */
export function wrapText(li: Element, start: number, end: number, className: string, data: Record<string, string> = {}): HTMLElement[] {
  const marks: HTMLElement[] = []
  let offset = 0
  for (const t of textNodes(li)) {
    // 先記下長度：splitText 會把 t 本身截短，之後不能再用 t.data.length
    const len = t.data.length
    const s = Math.max(start, offset)
    const e = Math.min(end, offset + len)
    if (s < e) {
      let node = t
      if (s > offset) node = node.splitText(s - offset)
      if (e < offset + len) node.splitText(e - s)
      const mark = document.createElement("mark")
      mark.className = className
      for (const [k, v] of Object.entries(data)) mark.dataset[k] = v
      node.parentNode!.insertBefore(mark, node)
      mark.append(node)
      marks.push(mark)
    }
    offset += len
  }
  return marks
}

/** 移除之前包上的 mark（把文字放回原處）。 */
export function unwrapAll(root: Element, selector: string): void {
  for (const m of Array.from(root.querySelectorAll(selector))) {
    const parent = m.parentNode
    if (!parent) continue
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    m.remove()
    parent.normalize()
  }
}

/** 簡單的字串雜湊（FNV-1a），記錄畫重點時的經文版本。 */
export function textHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}
