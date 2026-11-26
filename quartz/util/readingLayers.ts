// 建置時的章節正文處理（分層閱讀 Stage A / B2）：
// 只在章節頁的「## 本章整理」範圍內執行，不碰經文清單、知識節點、附錄與任何非章節頁。
// 處理四件事：
//   1. 分層卡片（[!original] / [!background] / [!application]）：類別標籤、原文出處頁尾、無障礙按鈕屬性（收起時不顯示第一句摘要）。
//   2. 經文原句（「…」緊接經節括號）：深褐色引文＋經節小標籤（同章跳 #vN，他卷已有頁連去該章，原有 wikilink 保留）。
//   3. 舊格式原文括號備援：卡片外含希伯來／希臘字或 Strong 編號的括號（含緊接在括號前面的希伯來／希臘字）收成「原文」按鈕（卡片內不收）。
//   4. 來源名稱：照 config/source-names.yaml 標成點狀底線按鈕，附本頁用到的來源說明與參考網址給前端說明卡。
import type { Element, ElementContent, Root, RootContent } from "hast"
import { BIBLE_BOOKS, type BibleBook } from "./bibleBooks"
import { chapterSlug, parseBookSlug } from "./bookCatalog"
import { selectStudyRegion } from "./chapterRegions"
import { describeChapterNodes, el } from "./interactiveHast"
import { type FullSlug, joinSegments, pathToRoot } from "./path"
import type { PageSourcesPayload, SourceCardEntry } from "./readingLayersClient"
import {
  matchReferenceUrls,
  matchSourceNames,
  type SourceEntry,
  type SourceNamesRegistry,
} from "./sourceNames"

export interface ReadingLayersContext {
  slug: string
  registry: SourceNamesRegistry
  existingSlugs: ReadonlySet<string>
}

export type LayerCardKind = "original" | "background" | "application"

export interface ParsedVerseReference {
  readonly kind: "same-chapter" | "cross-book"
  readonly label: string
  readonly verse: number
  readonly book?: BibleBook
  readonly chapter?: number
  readonly rest?: string
}

const LAYER_CARDS: Readonly<Record<LayerCardKind, { label: string }>> = {
  original: { label: "原文" },
  background: { label: "背景" },
  application: { label: "應用" },
}

const STEP_ATTRIBUTION = "出處：STEP Bible（CC BY 4.0）"
const SOURCES_PAGE_SLUG = "資料來源"
const LEGACY_ORIG_MAX_CHARS = 120

const SKIPPED_SOURCE_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "th",
  "thead",
  "code",
  "pre",
  "script",
  "style",
  "svg",
  "math",
  "textarea",
])

const SKIPPED_INLINE_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "th",
  "thead",
  "code",
  "pre",
  "script",
  "style",
  "svg",
  "math",
  "textarea",
])

const INLINE_CONTAINER_TAGS = new Set(["p", "li", "td"])
const BLOCK_CHILD_TAGS = new Set(["p", "ul", "ol", "li", "blockquote", "div", "table", "section"])
const ENTRY_COMMENTARY_HEADINGS = new Set(["定義", "主題發展"])
const SAFE_QUOTE_INLINE_TAGS = new Set(["a", "em", "strong", "span", "b", "i", "sup", "sub", "mark"])
const SAFE_ORIG_INLINE_TAGS = new Set(["em", "strong", "span", "code", "b", "i", "sup", "sub"])
const SAFE_CQUOTE_DESCENT_TAGS = new Set(["em", "strong", "span", "b", "i", "sup", "sub", "mark"])

const HEBREW_RE = /[\u0590-\u05FF]/u
const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/u
const STRONG_RE = /(?<![A-Za-z0-9])[HG]\d{1,4}[A-Z]?(?![A-Za-z0-9])/u
const HANZI_RE = /[\u4E00-\u9FFF]/gu
const LATIN_VERBATIM_RE = /[A-Za-z]{3,}/u
const CLAUSE_PUNCT_RE = /[，、；：。！？…,.!?;:]/u
const TERM_FOLLOW_RE = /^\s*(?:的(?:意思|原文字義|原文|含義|用法|重點|區別|譯法)|[這此]個?[詞字])/u

// 依縮寫長度由長到短排序，避免「約」搶先吃掉「約一」「約二」「約三」
const BOOK_TOKENS = [...BIBLE_BOOKS]
  .flatMap((book) => [
    { token: book.short, book },
    { token: book.name, book },
  ])
  .sort((a, b) => b.token.length - a.token.length)

const BOOK_BY_TOKEN = new Map<string, BibleBook>(BOOK_TOKENS.map(({ token, book }) => [token, book]))

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

const BOOK_ALT = BOOK_TOKENS.map(({ token }) => escapeRegex(token)).join("|")

const SAME_CHAPTER_REF_RE =
  /^(?:第\s*)?(\d+)(?:\s*[-–—~～]\s*\d+)?(?:\s*[、,，]\s*\d+(?:\s*[-–—~～]\s*\d+)?)*\s*節(?:\s*[；;]\s*([\s\S]*))?$/u

const CROSS_BOOK_REF_RE = new RegExp(
  `^(${BOOK_ALT})\\s*(\\d+)\\s*[:：]\\s*(\\d+)(?:\\s*[-–—~～]\\s*\\d+)?(?:\\s*[、,，]\\s*\\d+(?:\\s*[-–—~～]\\s*\\d+)?)*(?:\\s*[；;]\\s*([\\s\\S]*))?$`,
  "u",
)

/** 解析經文原句後面括號內的經節參照（同章「1節」「11-12節」「第27節」，或他卷「詩33:9」「出12:13,23」）。 */
export function parseVerseReference(raw: string): ParsedVerseReference | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const same = SAME_CHAPTER_REF_RE.exec(trimmed)
  if (same) {
    const verse = Number(same[1])
    if (!Number.isInteger(verse) || verse < 1 || verse > 200) return null
    const rest = same[2]?.trim() || undefined
    const refPart = trimmed.split(/[；;]/u, 1)[0].trim().replace(/^第\s*/u, "")
    return { kind: "same-chapter", label: refPart, verse, rest }
  }

  const cross = CROSS_BOOK_REF_RE.exec(trimmed)
  if (cross) {
    const book = BOOK_BY_TOKEN.get(cross[1])
    const chapter = Number(cross[2])
    const verse = Number(cross[3])
    if (!book) return null
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null
    if (!Number.isInteger(verse) || verse < 1 || verse > 200) return null
    const rest = cross[4]?.trim() || undefined
    const refPart = trimmed.split(/[；;]/u, 1)[0].trim()
    return { kind: "cross-book", label: refPart, book, chapter, verse, rest }
  }

  return null
}

/** 判斷一個括號內的內容是否屬於舊格式散在句子裡的原文標註（含希伯來／希臘字或 Strong 編號）。 */
export function isLegacyOriginalContent(plainText: string, hasStrongSpan = false): boolean {
  const trimmed = plainText.trim()
  if (!trimmed || [...trimmed].length > LEGACY_ORIG_MAX_CHARS) return false
  return hasStrongSpan || HEBREW_RE.test(trimmed) || GREEK_RE.test(trimmed) || STRONG_RE.test(trimmed)
}

function classList(node: Element): string[] {
  const value = node.properties?.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") return value.split(/\s+/u).filter(Boolean)
  return []
}

function hasClass(node: Element, name: string): boolean {
  return classList(node).includes(name)
}

function addClasses(node: Element, ...names: string[]): void {
  const set = new Set(classList(node))
  for (const name of names) set.add(name)
  node.properties = { ...node.properties, className: [...set] }
}

function nodeText(node: RootContent | ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  if (node.tagName === "br") return " "
  return node.children.map(nodeText).join("")
}

function elementDataCallout(node: Element): LayerCardKind | null {
  if (!hasClass(node, "callout")) return null
  const raw = node.properties?.dataCallout ?? node.properties?.["data-callout"]
  if (typeof raw !== "string") return null
  const normalized = raw.toLowerCase()
  if (normalized === "original" || normalized === "background" || normalized === "application") {
    return normalized
  }
  return null
}

function isMermaidElement(node: Element): boolean {
  if (hasClass(node, "mermaid")) return true
  if (node.tagName === "pre") {
    return node.children.some(
      (child) => child.type === "element" && child.tagName === "code" && hasClass(child, "mermaid"),
    )
  }
  return false
}

/* ---------------------- 參考資料偵測與網址提取 ---------------------- */

function isReferenceParagraph(node: Element): boolean {
  if (node.tagName !== "p") return false
  const firstEl = node.children.find((child) => {
    if (child.type === "text") return child.value.trim().length > 0
    return child.type === "element"
  })
  if (!firstEl || firstEl.type !== "element" || firstEl.tagName !== "strong") return false
  const text = nodeText(firstEl).replace(/[：:\s]+/gu, "")
  return text === "參考資料" || text === "參考來源"
}

function isReferenceHeading(node: Element): boolean {
  if (node.tagName !== "h3" && node.tagName !== "h4") return false
  const text = nodeText(node).replace(/[：:\s]+/gu, "")
  return text === "參考資料" || text === "參考來源"
}

function collectExternalUrls(node: RootContent | ElementContent, out: string[]): void {
  if (node.type !== "element") return
  if (node.tagName === "a") {
    const href = node.properties?.href
    if (typeof href === "string" && /^https?:\/\//i.test(href)) {
      out.push(href)
    }
  }
  for (const child of node.children) collectExternalUrls(child, out)
}

function findReferenceRegion(
  root: Root,
  startRootIdx: number,
  endRootIdx: number,
): { refIndices: Set<number>; urls: string[] } {
  const refIndices = new Set<number>()
  const urls: string[] = []

  for (let i = startRootIdx; i < endRootIdx; i += 1) {
    const node = root.children[i]
    if (node?.type !== "element") continue

    if (isReferenceParagraph(node)) {
      refIndices.add(i)
      collectExternalUrls(node, urls)
    } else if (isReferenceHeading(node)) {
      refIndices.add(i)
      for (let j = i + 1; j < endRootIdx; j += 1) {
        const next = root.children[j]
        if (next?.type === "element" && (next.tagName === "h2" || next.tagName === "h3" || next.tagName === "hr")) {
          break
        }
        if (next?.type === "element") {
          refIndices.add(j)
          collectExternalUrls(next, urls)
        }
      }
    }
  }

  return { refIndices, urls }
}

/* ---------------------- 1. 分層卡片處理 ---------------------- */

function extractCalloutTitleChildren(titleDiv: Element): ElementContent[] {
  const inner = titleDiv.children.find(
    (child): child is Element => child.type === "element" && hasClass(child, "callout-title-inner"),
  )
  if (!inner) return []
  // OFM 會把標題包在一層 <p> 裡，且結尾常多出一個空白；拆出來放進 <span> 才能和徽章、摘要排成同一行
  const firstP = inner.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "p",
  )
  const raw = firstP ? firstP.children : inner.children
  const cloned: ElementContent[] = raw.map((node) => ({ ...node }))
  // 去掉最後一個文字節點多餘的尾端空白
  for (let i = cloned.length - 1; i >= 0; i -= 1) {
    const node = cloned[i]
    if (node.type === "text") {
      const trimmed = node.value.replace(/\s+$/u, "")
      if (trimmed) {
        cloned[i] = { type: "text", value: trimmed }
        break
      }
      cloned.splice(i, 1)
    } else {
      break
    }
  }
  return cloned
}

function transformLayerCard(card: Element, kind: LayerCardKind): void {
  if (hasClass(card, "bwz-rl-card")) return
  const meta = LAYER_CARDS[kind]

  const titleDiv = card.children.find(
    (child): child is Element => child.type === "element" && hasClass(child, "callout-title"),
  )
  const contentDiv = card.children.find(
    (child): child is Element => child.type === "element" && hasClass(child, "callout-content"),
  )
  if (!titleDiv || !contentDiv) return

  const titleNodes = extractCalloutTitleChildren(titleDiv)
  const collapsed = hasClass(card, "is-collapsed")
  const collapsible = hasClass(card, "is-collapsible")

  addClasses(card, "bwz-rl-card", `bwz-rl-card-${kind}`)

  if (collapsible) {
    titleDiv.properties = {
      ...titleDiv.properties,
      role: "button",
      tabIndex: 0,
      ariaExpanded: collapsed ? "false" : "true",
    }
  }

  const titleChildren: ElementContent[] = [
    el("span", { className: ["bwz-rl-card-badge"] }, [meta.label]),
    el("span", { className: ["bwz-rl-card-title"] }, titleNodes.length ? titleNodes : [meta.label]),
  ]
  if (collapsible) {
    titleChildren.push(
      el("span", { className: ["bwz-rl-card-toggle"], ariaHidden: "true" }, [
        el("span", { className: ["bwz-rl-toggle-open"] }, ["展開 ▾"]),
        el("span", { className: ["bwz-rl-toggle-close"] }, ["收起 ▴"]),
      ]),
    )
  }
  titleDiv.children = titleChildren

  // 把內容包進單一內層 div，讓 callout.inline.ts 切換 grid-template-rows: 0fr/1fr 時多段內容也能乾淨收合
  const bodyChildren: ElementContent[] = [...contentDiv.children]
  if (kind === "original" && !nodeText(contentDiv).includes("STEP Bible（CC BY 4.0）")) {
    bodyChildren.push(el("div", { className: ["bwz-rl-card-attrib"] }, [STEP_ATTRIBUTION]))
  }
  contentDiv.children = [el("div", { className: ["bwz-rl-card-body"] }, bodyChildren)]
}

/* ---------------------- 2. 經文原句＋經節小標籤 ---------------------- */

function sliceInlineChildren(
  children: readonly ElementContent[],
  startIdx: number,
  startOff: number,
  endIdx: number,
  endOff: number,
): ElementContent[] {
  const result: ElementContent[] = []
  for (let i = startIdx; i <= endIdx; i += 1) {
    const node = children[i]
    if (node.type === "text") {
      const from = i === startIdx ? startOff : 0
      const to = i === endIdx ? endOff : node.value.length
      if (to > from) result.push({ type: "text", value: node.value.slice(from, to) })
    } else {
      result.push(node)
    }
  }
  return result
}

function buildVersePillNodes(
  parsed: ParsedVerseReference,
  parenNodes: readonly ElementContent[],
  ctx: ReadingLayersContext,
): ElementContent[] {
  const out: ElementContent[] = []

  // 若括號開頭本身就是 wikilink（例如（[[詩篇33篇神話語創造|詩33:9]]；另見詩33:6）），保留原本連結並套用小標籤樣式
  const firstNonEmptyIdx = parenNodes.findIndex((node) => node.type !== "text" || node.value.trim().length > 0)
  const firstNode = firstNonEmptyIdx >= 0 ? parenNodes[firstNonEmptyIdx] : undefined

  if (firstNode && firstNode.type === "element" && firstNode.tagName === "a") {
    const link: Element = {
      ...firstNode,
      properties: {
        ...firstNode.properties,
        dataRlRef: parsed.label,
        ...(parsed.kind === "same-chapter" ? { dataRlVerse: String(parsed.verse) } : {}),
      },
    }
    addClasses(link, "bwz-rl-vref")
    out.push(link)

    const trailing = parenNodes.slice(firstNonEmptyIdx + 1)
    const cleanedTrailing = stripLeadingSemicolon(trailing)
    if (cleanedTrailing.length > 0) {
      out.push({ type: "text", value: "（" }, ...cleanedTrailing, { type: "text", value: "）" })
    }
    return out
  }

  if (parsed.kind === "same-chapter") {
    out.push(
      el(
        "a",
        {
          className: ["bwz-rl-vref"],
          href: `#v${parsed.verse}`,
          dataRlVerse: String(parsed.verse),
          dataNoPopover: "true",
          ariaLabel: `跳到第 ${parsed.verse} 節`,
        },
        [parsed.label],
      ),
    )
  } else if (parsed.book && parsed.chapter !== undefined) {
    const targetSlug = chapterSlug(parsed.book, parsed.chapter)
    if (ctx.existingSlugs.has(targetSlug)) {
      const href = `${joinSegments(pathToRoot(ctx.slug as FullSlug), targetSlug)}#v${parsed.verse}`
      out.push(
        el(
          "a",
          {
            className: ["bwz-rl-vref", "internal", "internal-link"],
            href,
            dataSlug: targetSlug,
            dataRlRef: parsed.label,
          },
          [parsed.label],
        ),
      )
    } else {
      out.push(
        el(
          "span",
          {
            className: ["bwz-rl-vref", "bwz-rl-vref-static"],
            dataRlRef: parsed.label,
          },
          [parsed.label],
        ),
      )
    }
  }

  if (parsed.rest) {
    out.push({ type: "text", value: `（${parsed.rest}）` })
  }
  return out
}

function stripLeadingSemicolon(nodes: readonly ElementContent[]): ElementContent[] {
  const result: ElementContent[] = []
  let stripped = false
  for (const node of nodes) {
    if (!stripped && node.type === "text") {
      const next = node.value.replace(/^\s*[；;]\s*/u, "")
      stripped = true
      if (next.length > 0) result.push({ type: "text", value: next })
    } else {
      stripped = true
      result.push(node)
    }
  }
  const hasVisible = result.some((node) => node.type !== "text" || node.value.trim().length > 0)
  return hasVisible ? result : []
}

interface InlinePosition {
  idx: number
  off: number
}

/** 從給定位置往後找成對的括號（…），不可跨不安全標籤或巢狀開括號。 */
function findMatchingParens(
  children: readonly ElementContent[],
  startIdx: number,
  startOff: number,
): { open: InlinePosition; close: InlinePosition } | null {
  let idx = startIdx
  let off = startOff

  // 跳過「」與（ 之間可有可無的空白
  while (idx < children.length) {
    const node = children[idx]
    if (node.type !== "text") return null
    while (off < node.value.length && (node.value[off] === " " || node.value[off] === "\t")) {
      off += 1
    }
    if (off < node.value.length) break
    idx += 1
    off = 0
  }

  if (idx >= children.length) return null
  const openNode = children[idx]
  if (openNode.type !== "text" || openNode.value[off] !== "（") return null
  const open: InlinePosition = { idx, off }

  let scanIdx = idx
  let scanOff = off + 1
  while (scanIdx < children.length) {
    const node = children[scanIdx]
    if (node.type === "text") {
      for (let k = scanOff; k < node.value.length; k += 1) {
        const ch = node.value[k]
        if (ch === "（") return null
        if (ch === "）") return { open, close: { idx: scanIdx, off: k } }
      }
    } else if (node.type === "element") {
      if (!SAFE_QUOTE_INLINE_TAGS.has(node.tagName)) return null
    } else {
      return null
    }
    scanIdx += 1
    scanOff = 0
  }
  return null
}

/**
 * 處理「<strong>②「我觀看你指頭所造的天」</strong>（詩8:3）」這種粗體剛好包住引句、經節括號緊接在粗體後面的情況。
 */
function trySplitBoldTrailingQuote(
  strongEl: Element,
  nextChildren: readonly ElementContent[],
  nextIdx: number,
  ctx: ReadingLayersContext,
): { replacement: ElementContent[]; resumePos: InlinePosition } | null {
  if (strongEl.tagName !== "strong" || strongEl.children.length === 0) return null
  const lastChild = strongEl.children[strongEl.children.length - 1]
  if (lastChild.type !== "text" || !lastChild.value.endsWith("」")) return null

  const openIdxInStrong = lastChild.value.lastIndexOf("「")
  if (openIdxInStrong < 0) return null

  const parens = findMatchingParens(nextChildren, nextIdx, 0)
  if (!parens) return null
  const parenNodes = sliceInlineChildren(
    nextChildren,
    parens.open.idx,
    parens.open.off + 1,
    parens.close.idx,
    parens.close.off,
  )
  const parsed = parseVerseReference(parenNodes.map(nodeText).join(""))
  if (!parsed) return null

  const beforeText = lastChild.value.slice(0, openIdxInStrong)
  const quoteText = lastChild.value.slice(openIdxInStrong)
  const updatedStrongChildren: ElementContent[] = [
    ...strongEl.children.slice(0, -1),
    ...(beforeText ? [{ type: "text" as const, value: beforeText }] : []),
    el("span", { className: ["bwz-rl-quote"] }, [quoteText]),
  ]

  const updatedStrong: Element = { ...strongEl, children: updatedStrongChildren }
  const pills = buildVersePillNodes(parsed, parenNodes, ctx)
  return {
    replacement: [updatedStrong, ...pills],
    resumePos: { idx: parens.close.idx, off: parens.close.off + 1 },
  }
}

function transformScriptureQuotesInChildren(
  children: readonly ElementContent[],
  ctx: ReadingLayersContext,
): ElementContent[] {
  const out: ElementContent[] = []
  let emitIdx = 0
  let emitOff = 0
  let openQuote: InlinePosition | null = null

  const flushUpTo = (targetIdx: number, targetOff: number) => {
    if (targetIdx < emitIdx || (targetIdx === emitIdx && targetOff <= emitOff)) return
    out.push(...sliceInlineChildren(children, emitIdx, emitOff, targetIdx, targetOff))
    emitIdx = targetIdx
    emitOff = targetOff
  }

  let idx = 0
  let off = 0
  while (idx < children.length) {
    const node = children[idx]
    if (node.type === "text") {
      let matchedHere = false
      for (let k = off; k < node.value.length; k += 1) {
        const ch = node.value[k]
        if (ch === "「") {
          // 遇到新的「就改以最內層的「為起點，避免把前面的非經文引號整段包進來
          openQuote = { idx, off: k }
        } else if (ch === "」" && openQuote) {
          const parens = findMatchingParens(children, idx, k + 1)
          if (parens) {
            const parenNodes = sliceInlineChildren(
              children,
              parens.open.idx,
              parens.open.off + 1,
              parens.close.idx,
              parens.close.off,
            )
            const parsed = parseVerseReference(parenNodes.map(nodeText).join(""))
            if (parsed) {
              flushUpTo(openQuote.idx, openQuote.off)
              const quoteNodes = sliceInlineChildren(children, openQuote.idx, openQuote.off, idx, k + 1)
              out.push(el("span", { className: ["bwz-rl-quote"] }, quoteNodes))
              out.push(...buildVersePillNodes(parsed, parenNodes, ctx))
              emitIdx = parens.close.idx
              emitOff = parens.close.off + 1
              idx = parens.close.idx
              off = parens.close.off + 1
              openQuote = null
              matchedHere = true
              break
            }
          }
          // 「…」後面不是經節括號：是一般引句，重置候選起點
          openQuote = null
        }
      }
      if (!matchedHere) {
        idx += 1
        off = 0
      }
    } else if (node.type === "element") {
      if (!openQuote && node.tagName === "strong" && idx + 1 < children.length) {
        const split = trySplitBoldTrailingQuote(node, children, idx + 1, ctx)
        if (split) {
          flushUpTo(idx, 0)
          out.push(...split.replacement)
          emitIdx = split.resumePos.idx
          emitOff = split.resumePos.off
          idx = split.resumePos.idx
          off = split.resumePos.off
          continue
        }
      }
      if (!SAFE_QUOTE_INLINE_TAGS.has(node.tagName)) {
        openQuote = null
      }
      idx += 1
      off = 0
    } else {
      openQuote = null
      idx += 1
      off = 0
    }
  }

  // 把剩餘未輸出的節點補齊
  if (emitIdx < children.length) {
    const lastIdx = children.length - 1
    const lastNode = children[lastIdx]
    const lastOff = lastNode.type === "text" ? lastNode.value.length : 0
    for (let i = emitIdx; i < children.length; i += 1) {
      const node = children[i]
      if (node.type === "text") {
        const from = i === emitIdx ? emitOff : 0
        if (from < node.value.length) out.push({ type: "text", value: node.value.slice(from) })
      } else {
        out.push(node)
      }
    }
    void lastOff
  }

  // 遞迴處理內層一般行內包裝（例如 <strong> 裡的完整「…」（N節）），但不碰已標記的引句與連結
  return out.map((child) => {
    if (child.type !== "element") return child
    if (
      SKIPPED_INLINE_TAGS.has(child.tagName) ||
      child.tagName === "a" ||
      hasClass(child, "bwz-rl-quote") ||
      hasClass(child, "bwz-rl-vref")
    ) {
      return child
    }
    if (child.tagName === "strong" || child.tagName === "em" || child.tagName === "span") {
      return { ...child, children: transformScriptureQuotesInChildren(child.children, ctx) }
    }
    return child
  })
}

/* ---------------------- 3. 舊格式原文括號收合為「原文」標籤 ---------------------- */

function containsStrongSpan(nodes: readonly ElementContent[]): boolean {
  for (const node of nodes) {
    if (node.type !== "element") continue
    if (hasClass(node, "strong-no")) return true
    if (containsStrongSpan(node.children)) return true
  }
  return false
}

function findLegacyOriginalParens(
  children: readonly ElementContent[],
  openIdx: number,
  openOff: number,
): InlinePosition | null {
  let scanIdx = openIdx
  let scanOff = openOff + 1
  while (scanIdx < children.length) {
    const node = children[scanIdx]
    if (node.type === "text") {
      for (let k = scanOff; k < node.value.length; k += 1) {
        const ch = node.value[k]
        if (ch === "（") return null
        if (ch === "）") return { idx: scanIdx, off: k }
      }
    } else if (node.type === "element") {
      // 若括號內含站內連結或非安全行內標籤則不收合，避免把可點擊連結藏起來
      if (!SAFE_ORIG_INLINE_TAGS.has(node.tagName)) return null
    } else {
      return null
    }
    scanIdx += 1
    scanOff = 0
  }
  return null
}

const SCRIPT_WORD_SRC =
  "(?:[\\u0590-\\u05FF\\u0370-\\u03FF\\u1F00-\\u1FFF]+(?:[־\\-·'’][\\u0590-\\u05FF\\u0370-\\u03FF\\u1F00-\\u1FFF]+)*)"
const SCRIPT_PHRASE_BODY_SRC = `${SCRIPT_WORD_SRC}(?:[ \\t]+(?:\\.{2,3}|…)?[ \\t]*${SCRIPT_WORD_SRC})*`
const TRAILING_SCRIPT_RE = new RegExp(`(${SCRIPT_PHRASE_BODY_SRC})[ \\t]*$`, "u")
const ONLY_SCRIPT_PHRASE_RE = new RegExp(`^${SCRIPT_PHRASE_BODY_SRC}$`, "u")

/** 檢查緊接在「（」前面的緊鄰希伯來／希臘字片語，一併收進原文小標籤，避免希伯來字散在中文句子裡。 */
function findPrecedingOriginalScript(
  children: readonly ElementContent[],
  emitIdx: number,
  emitOff: number,
  openIdx: number,
  openOff: number,
): { startIdx: number; startOff: number; plain: string } | null {
  const openNode = children[openIdx]
  if (openNode?.type !== "text") return null
  const minOff = openIdx === emitIdx ? emitOff : 0
  const prefix = openNode.value.slice(minOff, openOff)

  if (prefix.trim().length > 0) {
    const match = TRAILING_SCRIPT_RE.exec(prefix)
    if (!match) return null
    return {
      startIdx: openIdx,
      startOff: minOff + match.index,
      plain: match[1].trim(),
    }
  }

  // 若開括號緊接在行內包裝標籤（例如 <em>בָּרָא</em>）之後，只收純希伯來／希臘字且不含連結的包裝節點
  const prevIdx = openIdx - 1
  if (prevIdx >= emitIdx && !(prevIdx === emitIdx && emitOff > 0)) {
    const prev = children[prevIdx]
    if (
      prev?.type === "element" &&
      SAFE_ORIG_INLINE_TAGS.has(prev.tagName) &&
      !hasClass(prev, "strong-no")
    ) {
      const text = nodeText(prev).trim()
      if (text && ONLY_SCRIPT_PHRASE_RE.test(text)) {
        return { startIdx: prevIdx, startOff: 0, plain: text }
      }
    }
  }

  return null
}

function transformLegacyOriginalsInChildren(children: readonly ElementContent[]): ElementContent[] {
  const out: ElementContent[] = []
  let emitIdx = 0
  let emitOff = 0

  const flushUpTo = (targetIdx: number, targetOff: number) => {
    if (targetIdx < emitIdx || (targetIdx === emitIdx && targetOff <= emitOff)) return
    out.push(...sliceInlineChildren(children, emitIdx, emitOff, targetIdx, targetOff))
    emitIdx = targetIdx
    emitOff = targetOff
  }

  let idx = 0
  let off = 0
  while (idx < children.length) {
    const node = children[idx]
    if (node.type === "text") {
      let matchedHere = false
      for (let k = off; k < node.value.length; k += 1) {
        if (node.value[k] !== "（") continue
        const close = findLegacyOriginalParens(children, idx, k)
        if (!close) continue
        const inside = sliceInlineChildren(children, idx, k + 1, close.idx, close.off)
        const plain = inside.map(nodeText).join("").replace(/\s+/gu, " ").trim()
        if (!isLegacyOriginalContent(plain, containsStrongSpan(inside))) continue

        const preceding = findPrecedingOriginalScript(children, emitIdx, emitOff, idx, k)
        const combined = preceding ? `${preceding.plain}（${plain}）` : plain
        flushUpTo(preceding ? preceding.startIdx : idx, preceding ? preceding.startOff : k)
        out.push(
          el(
            "button",
            {
              type: "button",
              className: ["bwz-rl-orig-chip"],
              dataRlOrig: combined,
              ariaHaspopup: "dialog",
              ariaExpanded: "false",
              ariaLabel: "原文（查看原文與編號）",
            },
            ["原文"],
          ),
        )
        emitIdx = close.idx
        emitOff = close.off + 1
        idx = close.idx
        off = close.off + 1
        matchedHere = true
        break
      }
      if (!matchedHere) {
        idx += 1
        off = 0
      }
    } else {
      idx += 1
      off = 0
    }
  }

  for (let i = emitIdx; i < children.length; i += 1) {
    const node = children[i]
    if (node.type === "text") {
      const from = i === emitIdx ? emitOff : 0
      if (from < node.value.length) out.push({ type: "text", value: node.value.slice(from) })
    } else {
      out.push(node)
    }
  }

  return out.map((child) => {
    if (child.type !== "element") return child
    if (
      SKIPPED_INLINE_TAGS.has(child.tagName) ||
      child.tagName === "a" ||
      hasClass(child, "bwz-rl-quote") ||
      hasClass(child, "bwz-rl-vref") ||
      hasClass(child, "bwz-rl-orig-chip")
    ) {
      return child
    }
    if (child.tagName === "strong" || child.tagName === "em" || child.tagName === "span") {
      return { ...child, children: transformLegacyOriginalsInChildren(child.children) }
    }
    return child
  })
}

/* ---------------------- 4. 來源名稱標記 ---------------------- */

function transformSourcesInNode(
  node: ElementContent,
  registry: SourceNamesRegistry,
  usedEntries: Map<string, SourceEntry>,
): ElementContent[] {
  if (node.type === "text") {
    const matches = matchSourceNames(node.value, registry)
    if (matches.length === 0) return [node]

    const parts: ElementContent[] = []
    let cursor = 0
    for (const m of matches) {
      if (m.start > cursor) {
        parts.push({ type: "text", value: node.value.slice(cursor, m.start) })
      }
      usedEntries.set(m.entry.id, m.entry)
      // 用 <span role="button" tabindex="0"> 而非 <button>：長書名（例如《聖經精讀本──創世記註解》）在手機上才能自然跨行折行
      const props: Element["properties"] = {
        className: ["bwz-rl-src"],
        role: "button",
        tabIndex: 0,
        dataRlSrc: m.entry.id,
        ariaHaspopup: "dialog",
        ariaExpanded: "false",
        ariaLabel: `${m.matched}（查看來源說明）`,
      }
      if (m.isCode) props.dataRlCode = m.matched
      parts.push(el("span", props, [m.matched]))
      cursor = m.end
    }
    if (cursor < node.value.length) {
      parts.push({ type: "text", value: node.value.slice(cursor) })
    }
    return parts
  }

  if (node.type !== "element") return [node]
  if (
    SKIPPED_SOURCE_TAGS.has(node.tagName) ||
    isMermaidElement(node) ||
    hasClass(node, "callout-title") ||
    hasClass(node, "bwz-rl-quote") ||
    hasClass(node, "bwz-rl-vref") ||
    hasClass(node, "bwz-rl-orig-chip") ||
    hasClass(node, "bwz-rl-src") ||
    hasClass(node, "bwz-rl-card-attrib")
  ) {
    return [node]
  }

  const nextChildren: ElementContent[] = []
  for (const child of node.children) {
    nextChildren.push(...transformSourcesInNode(child, registry, usedEntries))
  }
  return [{ ...node, children: nextChildren }]
}

/* ---------------------- 5. 註釋原話標記（Stage E） ---------------------- */

interface CommentaryQuoteState {
  seenSource: boolean
  parenDepth: number
  onResetPending?: () => void
}

function hasAnyReadingLayerClass(node: Element): boolean {
  return (
    hasClass(node, "bwz-rl-quote") ||
    hasClass(node, "bwz-rl-vref") ||
    hasClass(node, "bwz-rl-orig-chip") ||
    hasClass(node, "bwz-rl-src") ||
    hasClass(node, "bwz-rl-cquote") ||
    hasClass(node, "strong-no")
  )
}

function countHanziChars(text: string): number {
  const m = text.match(HANZI_RE)
  return m ? m.length : 0
}

function isPureEnglishVerbatim(text: string): boolean {
  return LATIN_VERBATIM_RE.test(text) && !/[\u4E00-\u9FFF]/u.test(text)
}

function isShortTermMention(
  plain: string,
  hasPairedTranslation: boolean,
  followingText: string,
): boolean {
  if (hasPairedTranslation || isPureEnglishVerbatim(plain)) return false
  const trimmed = plain.trim()
  if (!trimmed) return true
  if ([...trimmed].length <= 3 && !CLAUSE_PUNCT_RE.test(trimmed)) return true
  if (countHanziChars(trimmed) <= 4 && TERM_FOLLOW_RE.test(followingText)) return true
  return false
}

function textStartsWithSentenceBreak(
  text: string,
  pos: number,
): boolean {
  const ch = text[pos]
  return ch === "。" || ch === "！" || ch === "？" || ch === "!" || ch === "?"
}

/** 掃描「外面的純文字切片」：依句界重置，並在括號外命中來源名稱時標記 seenSource；若出現來源或句界亦通知重置待定引句。 */
function updateStateFromOutsideText(
  slice: string,
  registry: SourceNamesRegistry,
  state: CommentaryQuoteState,
): void {
  if (!slice) return
  let segStart = 0
  let i = 0
  while (i < slice.length) {
    const ch = slice[i]
    if (ch === "（" || ch === "(") {
      if (i > segStart) {
        if (matchSourceNames(slice.slice(segStart, i), registry).length > 0) {
          if (state.parenDepth === 0) state.seenSource = true
          state.onResetPending?.()
        }
      }
      state.parenDepth += 1
      segStart = i + 1
    } else if (ch === "）" || ch === ")") {
      if (i > segStart) {
        if (matchSourceNames(slice.slice(segStart, i), registry).length > 0) {
          if (state.parenDepth === 0) state.seenSource = true
          state.onResetPending?.()
        }
      }
      state.parenDepth = Math.max(0, state.parenDepth - 1)
      segStart = i + 1
    } else if (state.parenDepth === 0 && textStartsWithSentenceBreak(slice, i)) {
      state.seenSource = false
      state.onResetPending?.()
      segStart = i + 1
    }
    i += 1
  }
  if (slice.length > segStart) {
    if (matchSourceNames(slice.slice(segStart), registry).length > 0) {
      if (state.parenDepth === 0) state.seenSource = true
      state.onResetPending?.()
    }
  }
}

/** 從「後面找成對的 」；若遇到未閉合的內部 「 或不安全元素就放棄。 */
function findClosingCornerQuote(
  children: readonly ElementContent[],
  openIdx: number,
  openOff: number,
): InlinePosition | null {
  let scanIdx = openIdx
  let scanOff = openOff + 1
  while (scanIdx < children.length) {
    const node = children[scanIdx]
    if (node.type === "text") {
      for (let k = scanOff; k < node.value.length; k += 1) {
        const ch = node.value[k]
        if (ch === "「") return null
        if (ch === "」") return { idx: scanIdx, off: k }
      }
    } else if (node.type === "element") {
      if (
        SKIPPED_INLINE_TAGS.has(node.tagName) ||
        isMermaidElement(node) ||
        hasClass(node, "bwz-rl-quote") ||
        hasClass(node, "bwz-rl-vref") ||
        hasClass(node, "bwz-rl-cquote") ||
        !SAFE_QUOTE_INLINE_TAGS.has(node.tagName)
      ) {
        return null
      }
    } else {
      return null
    }
    scanIdx += 1
    scanOff = 0
  }
  return null
}

/** 從給定位置往後找成對的 （…），支援內部巢狀括號（如（出8:25、28））與連結。 */
function findBalancedFullwidthParens(
  children: readonly ElementContent[],
  startIdx: number,
  startOff: number,
): { open: InlinePosition; close: InlinePosition } | null {
  let idx = startIdx
  let off = startOff

  while (idx < children.length) {
    const node = children[idx]
    if (node.type !== "text") return null
    while (off < node.value.length && (node.value[off] === " " || node.value[off] === "\t")) {
      off += 1
    }
    if (off < node.value.length) break
    idx += 1
    off = 0
  }

  if (idx >= children.length) return null
  const openNode = children[idx]
  if (openNode.type !== "text" || openNode.value[off] !== "（") return null
  const open: InlinePosition = { idx, off }

  let depth = 1
  let scanIdx = idx
  let scanOff = off + 1
  while (scanIdx < children.length) {
    const node = children[scanIdx]
    if (node.type === "text") {
      for (let k = scanOff; k < node.value.length; k += 1) {
        const ch = node.value[k]
        if (ch === "（" || ch === "(") depth += 1
        else if (ch === "）" || ch === ")") {
          depth -= 1
          if (depth === 0) return { open, close: { idx: scanIdx, off: k } }
        }
      }
    } else if (node.type === "element") {
      if (!SAFE_QUOTE_INLINE_TAGS.has(node.tagName) && !hasClass(node, "strong-no")) return null
    } else {
      return null
    }
    scanIdx += 1
    scanOff = 0
  }
  return null
}

function collectFollowingText(
  children: readonly ElementContent[],
  idx: number,
  off: number,
): string {
  let acc = ""
  for (let i = idx; i < children.length && acc.length < 32; i += 1) {
    const n = children[i]
    if (n.type === "text") {
      acc += i === idx ? n.value.slice(off) : n.value
    } else if (n.type === "element") {
      acc += nodeText(n)
    }
  }
  return acc
}

/** 判斷句尾括號 （...） 裡第一個名稱是否為 yaml 來源名稱（含 .bwz-rl-src 或未標記原文案字）。 */
function startsWithSourceInParens(
  parenNodes: readonly ElementContent[],
  registry: SourceNamesRegistry,
): boolean {
  for (const node of parenNodes) {
    if (node.type === "text") {
      const trimmed = node.value.trimStart()
      if (!trimmed) continue
      const matches = matchSourceNames(trimmed, registry)
      return matches.some((m) => m.start === 0)
    }
    if (node.type === "element") {
      if (hasClass(node, "bwz-rl-src")) return true
      return false
    }
    return false
  }
  return false
}

/** 把同一句內、句尾括號來源之前且中間沒出現其他來源名稱的候選「…」一併標成註釋原話。 */
function promotePrecedingSentenceQuotes(
  out: ElementContent[],
  pendingQuoteIndices: number[],
): void {
  if (pendingQuoteIndices.length === 0) return
  for (const qIdx of pendingQuoteIndices) {
    const existing = out[qIdx]
    if (existing?.type === "element" && hasClass(existing, "bwz-rl-cquote-pending")) {
      out[qIdx] = el("span", { className: ["bwz-rl-cquote"] }, existing.children)
    }
  }
  pendingQuoteIndices.length = 0
}

function stripPendingQuotes(out: ElementContent[], pendingQuoteIndices: number[]): void {
  for (let i = pendingQuoteIndices.length - 1; i >= 0; i -= 1) {
    const qIdx = pendingQuoteIndices[i]
    const n = out[qIdx]
    if (n?.type === "element" && hasClass(n, "bwz-rl-cquote-pending")) {
      // 由後往前還原成未包裹的原始子節點，避免 splice 位移影響前面索引
      out.splice(qIdx, 1, ...n.children)
    }
  }
  pendingQuoteIndices.length = 0
}

function transformCommentaryQuotesInChildren(
  children: readonly ElementContent[],
  registry: SourceNamesRegistry,
  parentState?: CommentaryQuoteState,
): ElementContent[] {
  const out: ElementContent[] = []
  const pendingQuoteIndices: number[] = []
  const resetPending = () => stripPendingQuotes(out, pendingQuoteIndices)
  const state: CommentaryQuoteState = parentState ?? {
    seenSource: false,
    parenDepth: 0,
    onResetPending: resetPending,
  }
  const prevOnReset = parentState?.onResetPending
  if (parentState) {
    parentState.onResetPending = () => {
      prevOnReset?.()
      resetPending()
    }
  }
  let emitIdx = 0
  let emitOff = 0

  const flushRawUpTo = (targetIdx: number, targetOff: number) => {
    if (targetIdx < emitIdx || (targetIdx === emitIdx && targetOff <= emitOff)) return
    let endIdx = targetIdx
    let endOff = targetOff
    if (endOff === 0) {
      endIdx = targetIdx - 1
      if (endIdx < emitIdx) return
      const prevNode = children[endIdx]
      endOff = prevNode.type === "text" ? prevNode.value.length : 1
    }
    const sliced = sliceInlineChildren(children, emitIdx, emitOff, endIdx, endOff)
    for (const part of sliced) {
      if (part.type === "text") {
        updateStateFromOutsideText(part.value, registry, state)
        out.push(part)
      } else {
        out.push(part)
      }
    }
    emitIdx = targetIdx
    emitOff = targetOff
  }

  let idx = 0
  let off = 0
  while (idx < children.length) {
    const node = children[idx]
    if (node.type === "text") {
      let handled = false
      for (let k = off; k < node.value.length; k += 1) {
        if (node.value[k] !== "「") continue
        // 先結算開引號之前的文字狀態，確認句中前面是否真有來源名稱
        flushRawUpTo(idx, k)
        const close = findClosingCornerQuote(children, idx, k)
        if (!close) continue

        const innerPlain = sliceInlineChildren(
          children,
          idx,
          k + 1,
          close.idx,
          close.off,
        )
          .map(nodeText)
          .join("")

        let wrapEnd: InlinePosition = { idx: close.idx, off: close.off + 1 }
        let hasPairedTranslation = false
        let isScriptureRef = false
        let trailingStartsWithSource = false

        const trailingParens = findBalancedFullwidthParens(children, close.idx, close.off + 1)
        if (trailingParens) {
          const parenNodes = sliceInlineChildren(
            children,
            trailingParens.open.idx,
            trailingParens.open.off + 1,
            trailingParens.close.idx,
            trailingParens.close.off,
          )
          const parenPlain = parenNodes.map(nodeText).join("")
          if (startsWithSourceInParens(parenNodes, registry)) {
            trailingStartsWithSource = true
          } else if (
            state.seenSource &&
            isPureEnglishVerbatim(innerPlain) &&
            /[\u4E00-\u9FFF]/u.test(parenPlain) &&
            parseVerseReference(parenPlain) === null
          ) {
            wrapEnd = { idx: trailingParens.close.idx, off: trailingParens.close.off + 1 }
            hasPairedTranslation = true
          } else if (parseVerseReference(parenPlain) !== null) {
            isScriptureRef = true
          }
        }

        const shouldMark = state.parenDepth === 0 && (state.seenSource || trailingStartsWithSource)
        const afterText = collectFollowingText(children, wrapEnd.idx, wrapEnd.off)
        const invalidQuote =
          isScriptureRef || isShortTermMention(innerPlain, hasPairedTranslation, afterText)
        const qualifiesRetroactive = !invalidQuote && [...innerPlain.trim()].length >= 4

        if (!shouldMark) {
          const rawSlice = sliceInlineChildren(children, idx, k, close.idx, close.off + 1)
          if (qualifiesRetroactive && state.parenDepth === 0) {
            // 暫存同句候選（含散文隔開的多個「…」），若句尾括號出現來源且中間無別的來源才一併標記
            pendingQuoteIndices.push(out.length)
            out.push(el("span", { className: ["bwz-rl-cquote-pending"] }, rawSlice))
          } else {
            out.push(...rawSlice)
          }
          emitIdx = close.idx
          emitOff = close.off + 1
          idx = close.idx
          off = close.off + 1
          handled = true
          break
        }

        if (invalidQuote) {
          const skipped = sliceInlineChildren(children, idx, k, wrapEnd.idx, wrapEnd.off)
          out.push(...skipped)
          emitIdx = wrapEnd.idx
          emitOff = wrapEnd.off
          idx = wrapEnd.idx
          off = wrapEnd.off
          handled = true
          break
        }

        if (trailingStartsWithSource) {
          promotePrecedingSentenceQuotes(out, pendingQuoteIndices)
        } else {
          resetPending()
        }

        const wrappedNodes = sliceInlineChildren(children, idx, k, wrapEnd.idx, wrapEnd.off)
        out.push(el("span", { className: ["bwz-rl-cquote"] }, wrappedNodes))
        emitIdx = wrapEnd.idx
        emitOff = wrapEnd.off
        idx = wrapEnd.idx
        off = wrapEnd.off
        handled = true
        break
      }
      if (!handled) {
        idx += 1
        off = 0
      }
    } else if (node.type === "element") {
      flushRawUpTo(idx, 0)
      if (hasClass(node, "bwz-rl-src")) {
        if (state.parenDepth === 0) state.seenSource = true
        // 中間出現來源名稱 → 清除前面的待定引句，避免跨來源誤認
        state.onResetPending?.()
        out.push(node)
      } else if (
        SKIPPED_INLINE_TAGS.has(node.tagName) ||
        node.tagName === "a" ||
        isMermaidElement(node) ||
        hasAnyReadingLayerClass(node)
      ) {
        out.push(node)
      } else if (BLOCK_CHILD_TAGS.has(node.tagName)) {
        resetPending()
        // 鬆散清單 <li> 底下的巢狀區塊獨立一句狀態，不跨越 <p>/<ul>
        out.push({
          ...node,
          children: transformCommentaryQuotesInChildren(node.children, registry),
        })
      } else if (SAFE_CQUOTE_DESCENT_TAGS.has(node.tagName)) {
        out.push({
          ...node,
          children: transformCommentaryQuotesInChildren(node.children, registry, state),
        })
      } else {
        out.push(node)
      }
      idx += 1
      off = 0
      emitIdx = idx
      emitOff = 0
    } else {
      flushRawUpTo(idx, 0)
      out.push(node)
      idx += 1
      off = 0
      emitIdx = idx
      emitOff = 0
    }
  }

  resetPending()
  if (parentState) {
    parentState.onResetPending = prevOnReset
  }
  for (let i = emitIdx; i < children.length; i += 1) {
    const restNode = children[i]
    if (restNode.type === "text") {
      const from = i === emitIdx ? emitOff : 0
      if (from < restNode.value.length) {
        const tailText = restNode.value.slice(from)
        updateStateFromOutsideText(tailText, registry, state)
        out.push({ type: "text", value: tailText })
      }
    } else {
      out.push(restNode)
    }
  }

  return out
}

/** 條目頁只有「## 定義」與「## 主題發展」兩個段落適用註釋原話標記。 */
export function selectEntryCommentaryRegions(root: Root): { start: number; end: number }[] {
  const regions: { start: number; end: number }[] = []
  let activeStart: number | null = null

  for (let i = 0; i < root.children.length; i += 1) {
    const node = root.children[i]
    if (node?.type !== "element") continue
    if (node.tagName === "h2") {
      if (activeStart !== null) {
        regions.push({ start: activeStart, end: i })
        activeStart = null
      }
      const title = nodeText(node).replace(/\s+/gu, "").trim()
      if (ENTRY_COMMENTARY_HEADINGS.has(title)) {
        activeStart = i
      }
    } else if (node.tagName === "hr" && activeStart !== null) {
      regions.push({ start: activeStart, end: i })
      activeStart = null
    }
  }

  if (activeStart !== null) {
    regions.push({ start: activeStart, end: root.children.length })
  }
  return regions
}

function transformEntryCommentaryBlock(node: Element, registry: SourceNamesRegistry): Element {
  if (isMermaidElement(node) || SKIPPED_INLINE_TAGS.has(node.tagName)) {
    return node
  }
  if (INLINE_CONTAINER_TAGS.has(node.tagName)) {
    return {
      ...node,
      children: transformCommentaryQuotesInChildren(node.children, registry),
    }
  }
  const nextChildren = node.children.map((child) => {
    if (child.type !== "element" || hasClass(child, "callout-title")) return child
    return transformEntryCommentaryBlock(child, registry)
  })
  return { ...node, children: nextChildren }
}

/* ---------------------- 樹走訪整合 ---------------------- */

function transformStudyBlock(
  node: Element,
  ctx: ReadingLayersContext,
  insideLayerCard: boolean,
  usedEntries: Map<string, SourceEntry>,
): Element {
  if (isMermaidElement(node) || SKIPPED_INLINE_TAGS.has(node.tagName)) {
    // 只有問題式 h4（例如「「起初」是什麼時候？」）需要補上問題標記 class，內容不動
    if (node.tagName === "h4" && !insideLayerCard) {
      const heading = nodeText(node).trim()
      if (/[？?]$/u.test(heading)) addClasses(node, "bwz-rl-q")
    }
    return node
  }

  const cardKind = elementDataCallout(node)
  if (cardKind) {
    transformLayerCard(node, cardKind)
    const contentDiv = node.children.find(
      (child): child is Element => child.type === "element" && hasClass(child, "callout-content"),
    )
    if (contentDiv) {
      const nextContent = transformStudyBlock(contentDiv, ctx, true, usedEntries)
      node.children = node.children.map((child) => (child === contentDiv ? nextContent : child))
    }
    return node
  }

  if (INLINE_CONTAINER_TAGS.has(node.tagName)) {
    let children: ElementContent[] = transformScriptureQuotesInChildren(node.children, ctx)
    // 新格式卡片內的原文保留完整顯示，不收成「原文」標籤
    if (!insideLayerCard) {
      children = transformLegacyOriginalsInChildren(children)
    }
    const withSources: ElementContent[] = []
    for (const child of children) {
      withSources.push(...transformSourcesInNode(child, ctx.registry, usedEntries))
    }
    const withCommentaryQuotes = transformCommentaryQuotesInChildren(withSources, ctx.registry)
    return { ...node, children: withCommentaryQuotes }
  }

  const nextChildren = node.children.map((child) => {
    if (child.type !== "element") return child
    if (hasClass(child, "callout-title") || hasClass(child, "bwz-rl-card-attrib")) return child
    return transformStudyBlock(child, ctx, insideLayerCard, usedEntries)
  })
  return { ...node, children: nextChildren }
}

function buildSourcesMetaElement(
  slug: string,
  usedEntries: Map<string, SourceEntry>,
  pageUrls: Record<string, string>,
): Element {
  const entries: Record<string, SourceCardEntry> = {}
  const order: string[] = []
  for (const [id, entry] of usedEntries) {
    order.push(id)
    const url = pageUrls[entry.urlOwnerId]
    entries[id] = {
      name: entry.name,
      title: entry.title,
      note: entry.note,
      kind: entry.kind,
      ...(entry.code ? { code: entry.code } : {}),
      ...(url ? { url } : {}),
    }
  }
  const payload: PageSourcesPayload = {
    sourcesHref: joinSegments(pathToRoot(slug as FullSlug), SOURCES_PAGE_SLUG),
    entries,
    order,
  }
  return el("div", {
    hidden: true,
    className: ["bwz-rl-meta"],
    dataRlSources: JSON.stringify(payload),
  })
}

/**
 * 對章節頁的「## 本章整理」執行建置時分層正文處理，並對條目頁的「## 定義／## 主題發展」標記註釋原話。
 * 其餘頁面或沒有對應段落的頁面完全不動，回傳 false。
 */
export function applyReadingLayers(root: Root, ctx: ReadingLayersContext): boolean {
  if (parseBookSlug(ctx.slug)?.kind !== "chapter") {
    const entryRegions = selectEntryCommentaryRegions(root)
    if (entryRegions.length === 0) return false
    for (const region of entryRegions) {
      for (let i = region.start + 1; i < region.end; i += 1) {
        const node = root.children[i]
        if (node?.type !== "element") continue
        root.children[i] = transformEntryCommentaryBlock(node, ctx.registry)
      }
    }
    return true
  }

  const { descriptions, rootIndices } = describeChapterNodes(root)
  const region = selectStudyRegion(descriptions)
  if (!region) return false

  const startRootIdx = rootIndices[region.start]
  const endRootIdx =
    region.end < rootIndices.length ? rootIndices[region.end] : root.children.length

  const { refIndices, urls } = findReferenceRegion(root, startRootIdx + 1, endRootIdx)
  const pageUrls = matchReferenceUrls(urls, ctx.registry)
  const usedEntries = new Map<string, SourceEntry>()

  for (let i = startRootIdx + 1; i < endRootIdx; i += 1) {
    if (refIndices.has(i)) continue
    const node = root.children[i]
    if (node?.type !== "element") continue
    root.children[i] = transformStudyBlock(node, ctx, false, usedEntries)
  }

  if (usedEntries.size > 0) {
    const meta = buildSourcesMetaElement(ctx.slug, usedEntries, pageUrls)
    // 緊接在「本章整理」標題後插入隱藏資料節點，讓純經文切換與 SPA 換頁時一併跟著本章整理存在
    root.children.splice(startRootIdx + 1, 0, meta)
  }

  return true
}
