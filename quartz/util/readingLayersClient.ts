// 瀏覽器與測試共用的純函式（零外部依賴，避免把 yaml 或 bible-books.json 打包進前端腳本）：
//   1. 原文小卡的文字拆分（把開頭希伯來／希臘字拆到獨立行，其餘保留 Strong 編號標記）。
//   2. 說明卡標題與定位計算（確保在桌機、平板、手機都不超出視窗邊界）。

export interface OriginalScriptPart {
  readonly text: string
  readonly dir: "rtl" | "ltr"
  readonly lang: "he" | "el"
}

export interface OriginalDetailToken {
  readonly kind: "text" | "strong"
  readonly value: string
}

export interface ParsedOriginalContent {
  readonly script?: OriginalScriptPart
  readonly detailTokens: readonly OriginalDetailToken[]
}

export interface SourceCardEntry {
  readonly name: string
  readonly title: string
  readonly note: string
  readonly kind: "collection" | "work"
  readonly code?: string
  readonly url?: string
}

export interface PageSourcesPayload {
  readonly sourcesHref: string
  readonly entries: Record<string, SourceCardEntry>
  readonly order: readonly string[]
}

export interface PopoverPlacementInput {
  readonly anchorLeft: number
  readonly anchorTop: number
  readonly anchorBottom: number
  readonly popoverWidth: number
  readonly popoverHeight: number
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly scrollX: number
  readonly scrollY: number
  readonly gap?: number
  readonly margin?: number
}

export interface PopoverPlacement {
  readonly left: number
  readonly top: number
  readonly placedAbove: boolean
}

// 開頭若是純希伯來／希臘片語（中間允許空白、連字號、刪節號）接逗號、頓號或括號，才抽到上方大字列；
// 避免從句子中間硬挖希伯來字造成剩下句子缺字。
const LEADING_HEBREW_COMMA_RE =
  /^([\u0590-\u05FF][\u0590-\u05FF\s־\-./…·]*)([，、,]\s*([\s\S]*))?$/u
const LEADING_GREEK_COMMA_RE =
  /^([\u0370-\u03FF\u1F00-\u1FFF][\u0370-\u03FF\u1F00-\u1FFF\s\-./…·]*)([，、,]\s*([\s\S]*))?$/u
const LEADING_HEBREW_PARENS_RE =
  /^([\u0590-\u05FF][\u0590-\u05FF\s־\-./…·]*)\s*[（(]([^）)]+)[）)]$/u
const LEADING_GREEK_PARENS_RE =
  /^([\u0370-\u03FF\u1F00-\u1FFF][\u0370-\u03FF\u1F00-\u1FFF\s\-./…·]*)\s*[（(]([^）)]+)[）)]$/u
const STRONG_TOKEN_RE = /(?<![A-Za-z0-9])([HG]\d{1,4}[A-Z]?)(?![A-Za-z0-9])/gu

function tokenizeDetail(text: string): OriginalDetailToken[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const tokens: OriginalDetailToken[] = []
  let cursor = 0
  STRONG_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = STRONG_TOKEN_RE.exec(trimmed)) !== null) {
    if (match.index > cursor) {
      tokens.push({ kind: "text", value: trimmed.slice(cursor, match.index) })
    }
    tokens.push({ kind: "strong", value: match[1] })
    cursor = match.index + match[0].length
  }
  if (cursor < trimmed.length) {
    tokens.push({ kind: "text", value: trimmed.slice(cursor) })
  }
  return tokens
}

/** 把舊格式原文括號的純文字拆成「開頭原文詞（選用）」＋「其餘說明與 Strong 編號」。 */
export function parseOriginalContent(raw: string): ParsedOriginalContent {
  const cleaned = raw.trim()
  if (!cleaned) return { detailTokens: [] }

  const hebParens = LEADING_HEBREW_PARENS_RE.exec(cleaned)
  if (hebParens) {
    return {
      script: { text: hebParens[1].trim(), dir: "rtl", lang: "he" },
      detailTokens: tokenizeDetail(hebParens[2]),
    }
  }

  const grkParens = LEADING_GREEK_PARENS_RE.exec(cleaned)
  if (grkParens) {
    return {
      script: { text: grkParens[1].trim(), dir: "ltr", lang: "el" },
      detailTokens: tokenizeDetail(grkParens[2]),
    }
  }

  const heb = LEADING_HEBREW_COMMA_RE.exec(cleaned)
  if (heb) {
    const scriptText = heb[1].trim()
    const rest = (heb[3] ?? "").trim()
    return {
      script: { text: scriptText, dir: "rtl", lang: "he" },
      detailTokens: tokenizeDetail(rest),
    }
  }

  const grk = LEADING_GREEK_COMMA_RE.exec(cleaned)
  if (grk) {
    const scriptText = grk[1].trim()
    const rest = (grk[3] ?? "").trim()
    return {
      script: { text: scriptText, dir: "ltr", lang: "el" },
      detailTokens: tokenizeDetail(rest),
    }
  }

  return { detailTokens: tokenizeDetail(cleaned) }
}

const HEADING_PARENS_RE = /[（(]([^（）()]+)[）)]\s*$/u
const RANGE_SEGMENT_RE = /^(?:[vV]\s*|第\s*)?(\d+)(?:\s*[-–—~～]\s*(\d+))?$/u
const MAX_VERSE_NUMBER = 200

/**
 * 解析本章整理 ### 小節標題裡的經節範圍，供「看這段經文」原地展開對應經文；
 * （全章）、沒有帶經節範圍、或包含他卷章節的標題回傳 null。
 */
export function parseHeadingVerseRange(headingText: string): number[] | null {
  const normalized = headingText.normalize("NFKC").trim()
  const parenMatch = HEADING_PARENS_RE.exec(normalized)
  if (!parenMatch) return null

  const inside = parenMatch[1].trim()
  if (!inside || inside === "全章") return null

  const startsWithV = /^[vV](?=\s*\d)/u.test(inside)
  const endsWithVerseUnit = /節$/u.test(inside)
  if (!startsWithV && !endsWithVerseUnit) return null

  const body = inside
    .replace(/^[vV]\s*/u, "")
    .replace(/^第\s*/u, "")
    .replace(/節$/u, "")
    .trim()
  if (!body) return null

  const parts = body.split(/\s*[、,，]\s*/u)
  const verses: number[] = []
  const seen = new Set<number>()

  for (const part of parts) {
    const seg = RANGE_SEGMENT_RE.exec(part.trim())
    if (!seg) return null
    const start = Number(seg[1])
    const end = seg[2] ? Number(seg[2]) : start
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > MAX_VERSE_NUMBER
    ) {
      return null
    }
    for (let v = start; v <= end; v += 1) {
      if (!seen.has(v)) {
        seen.add(v)
        verses.push(v)
      }
    }
  }

  return verses.length > 0 ? verses : null
}

/** 決定來源說明卡的主標題與副標題：舊代號顯示「CT＝黃迦勒」，全名與名稱相同時不重複顯示。 */
export function formatSourceCardHeading(
  entry: Pick<SourceCardEntry, "name" | "title">,
  code?: string,
): { heading: string; subtitle?: string } {
  const heading = code && code !== entry.name ? `${code}＝${entry.name}` : entry.name
  const subtitle = entry.title && entry.title !== entry.name ? entry.title : undefined
  return { heading, subtitle }
}

/** 計算說明卡在文件座標（position: absolute）的位置：優先放下方，空間不夠翻上方，左右夾在視窗內。 */
export function computePopoverPlacement(input: PopoverPlacementInput): PopoverPlacement {
  const gap = input.gap ?? 8
  const margin = input.margin ?? 12

  const maxLeft = Math.max(margin, input.viewportWidth - input.popoverWidth - margin)
  const clampedViewportLeft = Math.max(margin, Math.min(input.anchorLeft, maxLeft))

  const fitsBelow = input.anchorBottom + gap + input.popoverHeight + margin <= input.viewportHeight
  const fitsAbove = input.anchorTop - gap - input.popoverHeight - margin >= 0
  const placedAbove = !fitsBelow && fitsAbove

  const viewportTop = placedAbove
    ? input.anchorTop - gap - input.popoverHeight
    : input.anchorBottom + gap

  return {
    left: Math.round(clampedViewportLeft + input.scrollX),
    top: Math.round(Math.max(margin, viewportTop + input.scrollY)),
    placedAbove,
  }
}
