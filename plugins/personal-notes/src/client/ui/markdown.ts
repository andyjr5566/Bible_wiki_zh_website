// 筆記內文的 Markdown（常用的子集）：標題、段落與換行、清單、引用、程式碼、分隔線、粗體、斜體、
// 行內程式碼、[[條目]]、[文字](網址)、網址自動連結（D-37，取代 D-27 的純文字顯示）。
//
// 安全性：parseMarkdown 只產生資料結構；renderMarkdown 一律用 createElement／textContent 建立畫面，
// 從不把筆記內容當 HTML 解析。連結只接受 http(s) 與站內頁面。

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "i"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "wiki"; target: string; label: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "br" }

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "quote"; c: Block[] }
  | { t: "code"; v: string }
  | { t: "hr" }

// 依序：行內程式碼、[[條目]]、[文字](網址)、粗體、斜體、網址
const INLINE =
  /`([^`\n]+)`|\[\[([^\]\n]+)\]\]|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+?)\*\*|\*([^*\s][^*\n]*?)\*|(https?:\/\/[^\s<>"'「」『』（）()]+[^\s<>"'「」『』（）().,;:!?。，、；：！？])/g

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  const pushText = (v: string) => {
    if (!v) return
    const lines = v.split("\n")
    lines.forEach((line, i) => {
      if (i > 0) out.push({ t: "br" })
      if (line) out.push({ t: "text", v: line })
    })
  }
  for (const m of text.matchAll(INLINE)) {
    pushText(text.slice(last, m.index))
    last = (m.index ?? 0) + m[0].length
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] })
    else if (m[2] !== undefined) {
      const [target, label] = m[2].split("|")
      const t = target.trim()
      out.push({ t: "wiki", target: t, label: (label ?? t.split("#")[0]).trim() || t })
    } else if (m[3] !== undefined) out.push({ t: "link", href: m[4], c: parseInline(m[3]) })
    else if (m[5] !== undefined) out.push({ t: "b", c: parseInline(m[5]) })
    else if (m[6] !== undefined) out.push({ t: "i", c: parseInline(m[6]) })
    else if (m[7] !== undefined) out.push({ t: "link", href: m[7], c: [{ t: "text", v: m[7] }] })
  }
  pushText(text.slice(last))
  return out
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join("\n")) })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^```/.test(line)) {
      flush()
      const code: string[] = []
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i])
      blocks.push({ t: "code", v: code.join("\n") })
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      flush()
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, c: parseInline(h[2]) })
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush()
      blocks.push({ t: "hr" })
      continue
    }
    const listRe = { ul: /^\s*[-*•]\s+(.*)$/, ol: /^\s*\d+[.)]\s+(.*)$/ }
    const kind = listRe.ul.test(line) ? "ul" : listRe.ol.test(line) ? "ol" : null
    if (kind) {
      flush()
      const items: Inline[][] = []
      for (; i < lines.length && listRe[kind].test(lines[i]); i++) items.push(parseInline(listRe[kind].exec(lines[i])![1]))
      i--
      blocks.push({ t: kind, items })
      continue
    }
    if (/^>\s?/.test(line)) {
      flush()
      const quoted: string[] = []
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) quoted.push(lines[i].replace(/^>\s?/, ""))
      i--
      blocks.push({ t: "quote", c: parseMarkdown(quoted.join("\n")) })
      continue
    }
    para.push(line)
  }
  flush()
  return blocks
}

export interface RenderOptions {
  /** [[條目]] 對應的站內 slug；null 代表找不到。沒給（索引還沒載入）時顯示成一般文字、不提示找不到。 */
  resolveWiki?: (target: string) => string | null
}

function renderInline(nodes: Inline[], parent: HTMLElement, opts: RenderOptions): void {
  const base = document.body.dataset.basepath ?? ""
  for (const n of nodes) {
    if (n.t === "text") parent.append(document.createTextNode(n.v))
    else if (n.t === "br") parent.append(document.createElement("br"))
    else if (n.t === "code") {
      const el = document.createElement("code")
      el.textContent = n.v
      parent.append(el)
    } else if (n.t === "b" || n.t === "i") {
      const el = document.createElement(n.t === "b" ? "strong" : "em")
      renderInline(n.c, el, opts)
      parent.append(el)
    } else if (n.t === "link") {
      const a = document.createElement("a")
      a.href = n.href
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      a.className = "external"
      renderInline(n.c, a, opts)
      parent.append(a)
    } else if (n.t === "wiki") {
      const slug = opts.resolveWiki?.(n.target) ?? null
      if (slug) {
        const a = document.createElement("a")
        const section = n.target.includes("#") ? `#${encodeURIComponent(n.target.split("#")[1].trim())}` : ""
        a.href = `${base}/${encodeURI(slug)}${section}`
        a.className = "internal bwz-n-wiki"
        a.textContent = n.label
        parent.append(a)
      } else {
        const span = document.createElement("span")
        span.className = opts.resolveWiki ? "bwz-n-wiki missing" : "bwz-n-wiki"
        if (opts.resolveWiki) span.title = "知識庫裡找不到這個條目"
        span.textContent = n.label
        parent.append(span)
      }
    }
  }
}

function renderBlocks(blocks: Block[], parent: HTMLElement, opts: RenderOptions): void {
  for (const b of blocks) {
    if (b.t === "p" || b.t === "h") {
      const el = document.createElement(b.t === "p" ? "p" : (`h${b.level + 2}` as "h3" | "h4" | "h5"))
      renderInline(b.c, el, opts)
      parent.append(el)
    } else if (b.t === "ul" || b.t === "ol") {
      const list = document.createElement(b.t)
      for (const item of b.items) {
        const li = document.createElement("li")
        renderInline(item, li, opts)
        list.append(li)
      }
      parent.append(list)
    } else if (b.t === "quote") {
      const q = document.createElement("blockquote")
      renderBlocks(b.c, q, opts)
      parent.append(q)
    } else if (b.t === "code") {
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.textContent = b.v
      pre.append(code)
      parent.append(pre)
    } else if (b.t === "hr") parent.append(document.createElement("hr"))
  }
}

/** 把筆記內文畫成畫面元素（容器 class：bwz-n-body bwz-n-md）。 */
export function renderMarkdown(src: string, opts: RenderOptions = {}): HTMLElement {
  const root = document.createElement("div")
  root.className = "bwz-n-body bwz-n-md"
  renderBlocks(parseMarkdown(src), root, opts)
  return root
}
