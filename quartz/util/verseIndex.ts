import fs from "node:fs"
import type { Element, ElementContent, Root } from "hast"
import type { ProcessedContent } from "../plugins/vfile"
import { parseBookSlug } from "./bookCatalog"

interface IndexedChapter {
  slug: string
  book: string
  chapter: number
  start: number
  verses: string[]
}

interface VerseIndex {
  version: 1
  chapters: IndexedChapter[]
}

/** [lemma, translit]（中文意思不放在資料裡，由前端用譯法統計組）。 */
export type OriginalLexiconTuple = [lemma: string, translit: string]

export interface VerseOriginalEntryLink {
  slug: string
  title: string
  /** 條目的主詞就是這個原文字（tier 1、2）：標「原文條目」；否則標「相關條目」。 */
  isHeadword: boolean
}

/**
 * [總處數（含和合本未直接譯出）, 未直接譯出的處數, 譯法 [[譯法, 處數], …]]
 * 譯法依處數由多到少，同處數依第一次出現的順序。Strong 編號是字義鍵「.」之前的部分。
 */
export type VerseOriginalSense = [
  total: number,
  none: number,
  renderings: Array<[rendering: string, count: number]>,
]

/** static/verseOriginal/index.json */
export interface VerseOriginalIndex {
  version: 2
  attribution: string
  shards: number
  senses: Record<string, VerseOriginalSense>
  lexicon: Record<string, OriginalLexiconTuple>
  entries: Record<string, VerseOriginalEntryLink>
  entryAliases: Record<string, string[]>
}

/** static/verseOriginal/s-<n>.json：只含有譯法的處（空譯法的處數記在 index 的 none）。 */
export type VerseOriginalShard = Record<
  string,
  Array<[slug: string, verse: number, rendering: string]>
>

export interface VerseOriginalBuild {
  index: VerseOriginalIndex
  shards: VerseOriginalShard[]
}

export interface RawOriginalSource {
  version: 2
  attribution: string
  lexicon: Record<string, OriginalLexiconTuple>
  chapters: Record<
    string,
    Record<string, Array<[sid: string, rendering: string, senseKey: string]>>
  >
}

export const SHARD_TARGET_BYTES = 150 * 1024
const MAX_SHARDS = 4096

/**
 * FNV-1a 32 位元，對字串的 UTF-16 code unit 逐個計算。前端分片必須用完全相同的函式。
 */
export function fnv1a32(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

export function shardOf(senseKey: string, shards: number): number {
  return fnv1a32(senseKey) % shards
}

/** 由內容大小決定分片數：先用總大小估，再增加到每片都不超過目標。 */
export function chooseShardCount(
  senseBytes: ReadonlyMap<string, number>,
  targetBytes = SHARD_TARGET_BYTES,
): number {
  let total = 0
  for (const n of senseBytes.values()) total += n
  let shards = Math.max(1, Math.ceil(total / targetBytes))
  for (; shards < MAX_SHARDS; shards++) {
    const sizes = new Array<number>(shards).fill(2)
    for (const [key, n] of senseBytes) sizes[shardOf(key, shards)]! += n + 1
    if (Math.max(...sizes) <= targetBytes) return shards
  }
  return MAX_SHARDS
}

const MAX_VERSE_ITEMS = 200
const NON_VERSE_TAGS = new Set(["ol", "ul", "rp", "rt", "script", "style", "template"])
const NON_BODY_TAGS = new Set(["rp", "rt", "script", "style", "template"])
const FALLBACK_ENTRY_CATEGORIES = new Set(["神學", "主題", "文化", "背景"])
const STRONG_TOKEN_RE = /(?<![A-Za-z0-9])([HG][1-9][0-9]{0,3})[A-Z]?(?![A-Za-z0-9])/g
const HELPER_STRONGS = new Set(["H3605"])

let cachedOriginalSource: RawOriginalSource | null = null

function loadOriginalSource(): RawOriginalSource {
  if (cachedOriginalSource) return cachedOriginalSource
  const fileUrl = new URL("../data/verse-original-terms.json", import.meta.url)
  const raw = JSON.parse(fs.readFileSync(fileUrl, "utf8")) as RawOriginalSource
  cachedOriginalSource = raw
  return raw
}

/** Matches the chapter reader: the first top-level ordered list before the first divider. */
function findVerseList(root: Root): { items: Element[]; start: number } | null {
  const list = root.children.find(
    (node): node is Element =>
      node.type === "element" && (node.tagName === "ol" || node.tagName === "hr"),
  )
  if (list?.tagName !== "ol" || list.properties.reversed === true) return null

  const items = list.children.filter(
    (node): node is Element => node.type === "element" && node.tagName === "li",
  )
  const start = Number(list.properties.start ?? 1)
  if (items.length === 0 || items.length > MAX_VERSE_ITEMS) return null
  if (!Number.isSafeInteger(start + items.length - 1) || !Number.isInteger(start) || start < 1) {
    return null
  }
  if (
    items.some((item, index) => Number(item.properties.value ?? start + index) !== start + index)
  ) {
    return null
  }

  return { items, start }
}

function verseText(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  const props = node.properties
  if (NON_VERSE_TAGS.has(node.tagName) || props.hidden === true || props.ariaHidden === "true") {
    return ""
  }
  if (props.dataFootnoteRef != null || props["data-footnote-ref"] != null) return ""
  if (node.tagName === "br") return " "
  return node.children.map(verseText).join("")
}

function plainHastText(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  const props = node.properties
  if (NON_BODY_TAGS.has(node.tagName) || props.hidden === true || props.ariaHidden === "true") {
    return ""
  }
  return node.children.map(plainHastText).join("")
}

function extractUniqueStrongs(text: string): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  STRONG_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = STRONG_TOKEN_RE.exec(text)) !== null) {
    const base = match[1]!
    if (!seen.has(base)) {
      seen.add(base)
      list.push(base)
    }
  }
  return list
}

function extractEntryStrongs(root: Root): { definitionStrongs: string[]; bodyStrongs: string[] } {
  const defParts: string[] = []
  const otherParts: string[] = []
  let inDefinition = false

  for (const child of root.children) {
    if (child.type === "element" && child.tagName === "h2") {
      const heading = plainHastText(child).trim()
      inDefinition = heading === "定義"
      continue
    }
    if (child.type === "element" || child.type === "text") {
      const text = plainHastText(child as ElementContent)
      if (!text) continue
      if (inDefinition) defParts.push(text)
      else otherParts.push(text)
    }
  }

  const definitionStrongs = extractUniqueStrongs(defParts.join("\n"))
  const allBodyStrongs = extractUniqueStrongs([...defParts, ...otherParts].join("\n"))
  return { definitionStrongs, bodyStrongs: allBodyStrongs }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function buildVerseIndex(content: readonly ProcessedContent[]): {
  index: VerseIndex
  malformed: string[]
} {
  const chapters = new Map<string, { bookNumber: number; row: IndexedChapter }>()
  const malformed: string[] = []

  for (const [tree, file] of content) {
    const { slug, unlisted, encrypted } = file.data
    if (!slug || unlisted === true || encrypted === true) continue
    const ref = parseBookSlug(slug)
    if (ref?.kind !== "chapter" || ref.chapter === undefined) continue

    const list = findVerseList(tree)
    const verses = list?.items.map((item) => verseText(item).replace(/\s+/gu, " ").trim())
    if (!list || !verses || verses.some((verse) => verse.length === 0)) {
      malformed.push(slug)
      continue
    }

    chapters.set(slug, {
      bookNumber: ref.book.num,
      row: { slug, book: ref.book.name, chapter: ref.chapter, start: list.start, verses },
    })
  }

  const sorted = Array.from(chapters.values()).sort(
    (a, b) => a.bookNumber - b.bookNumber || a.row.chapter - b.row.chapter,
  )
  return { index: { version: 1, chapters: sorted.map(({ row }) => row) }, malformed }
}

function chapterOrder(slug: string): [number, number] {
  const ref = parseBookSlug(slug)
  return [ref?.book.num ?? 999, ref?.chapter ?? 0]
}

/**
 * Crop the original-language data strictly to published chapters, group it by
 * sense, shard it, and attach already-published `link_folder` entries.
 */
export function buildVerseOriginalIndex(
  content: readonly ProcessedContent[],
  indexedChapterSlugs: ReadonlySet<string>,
  sourceOverride?: RawOriginalSource,
): VerseOriginalBuild {
  const source = sourceOverride ?? loadOriginalSource()
  const activeStrongs = new Set<string>()
  interface SenseAcc {
    sid: string
    none: number
    total: number
    counts: Map<string, number>
    verses: Array<[string, number, string]>
  }
  const acc = new Map<string, SenseAcc>()

  const slugs = Array.from(indexedChapterSlugs).sort((a, b) => {
    const [ab, ac] = chapterOrder(a)
    const [bb, bc] = chapterOrder(b)
    return ab - bb || ac - bc || a.localeCompare(b)
  })
  for (const slug of slugs) {
    const chData = source.chapters[slug]
    if (!chData) continue
    const verseNumbers = Object.keys(chData)
      .map(Number)
      .sort((a, b) => a - b)
    for (const verse of verseNumbers) {
      for (const [sid, rendering, senseKey] of chData[String(verse)]!) {
        activeStrongs.add(sid)
        let row = acc.get(senseKey)
        if (!row) {
          row = { sid, none: 0, total: 0, counts: new Map(), verses: [] }
          acc.set(senseKey, row)
        }
        row.total += 1
        if (!rendering) {
          row.none += 1
          continue
        }
        row.counts.set(rendering, (row.counts.get(rendering) ?? 0) + 1)
        row.verses.push([slug, verse, rendering])
      }
    }
  }

  const senses: Record<string, VerseOriginalSense> = {}
  const senseBytes = new Map<string, number>()
  const senseKeys = Array.from(acc.keys()).sort()
  for (const key of senseKeys) {
    const row = acc.get(key)!
    // Map 保留第一次出現的順序；Array.sort 是穩定排序，同處數維持該順序
    const renderings = Array.from(row.counts.entries()).sort((x, y) => y[1] - x[1])
    senses[key] = [row.total, row.none, renderings]
    senseBytes.set(key, Buffer.byteLength(JSON.stringify([key, row.verses])))
  }

  const shardCount = chooseShardCount(senseBytes)
  const shards: VerseOriginalShard[] = Array.from({ length: shardCount }, () => ({}))
  for (const key of senseKeys) {
    const row = acc.get(key)!
    if (row.verses.length > 0) shards[shardOf(key, shardCount)]![key] = row.verses
  }

  const lexicon: Record<string, OriginalLexiconTuple> = {}
  for (const sid of Array.from(activeStrongs).sort()) {
    const entry = source.lexicon[sid]
    if (entry) lexicon[sid] = entry
  }

  interface RankedEntryCandidate {
    tier: number
    slug: string
    title: string
    isOriginalEntry: boolean
  }

  const bestByStrong = new Map<string, RankedEntryCandidate>()
  const aliasMap = new Map<string, Set<string>>()

  const considerCandidate = (sid: string, candidate: RankedEntryCandidate) => {
    if (!activeStrongs.has(sid)) return
    const current = bestByStrong.get(sid)
    if (
      !current ||
      candidate.tier < current.tier ||
      (candidate.tier === current.tier && candidate.slug.localeCompare(current.slug, "zh-Hant") < 0)
    ) {
      bestByStrong.set(sid, candidate)
    }
  }

  for (const [tree, file] of content) {
    const { slug, unlisted, encrypted, frontmatter } = file.data
    if (!slug || unlisted === true || encrypted === true) continue
    const decoded = safeDecode(slug).replace(/\\/g, "/")
    const match = decoded.match(/^link_folder\/([^/]+)\/([^/]+)$/)
    if (!match) continue
    const [, category, rawStem] = match
    if (!category || !rawStem || rawStem.toLowerCase() === "index") continue

    const isOriginalEntry = category === "原文"
    if (!isOriginalEntry && !FALLBACK_ENTRY_CATEGORIES.has(category)) continue

    const { definitionStrongs, bodyStrongs } = extractEntryStrongs(tree)
    if (definitionStrongs.length === 0 && bodyStrongs.length === 0) continue

    const fmTitle = typeof frontmatter?.title === "string" ? frontmatter.title.trim() : ""
    const title = fmTitle || rawStem

    if (isOriginalEntry) {
      if (definitionStrongs.length === 1) {
        considerCandidate(definitionStrongs[0]!, { tier: 1, slug, title, isOriginalEntry: true })
      } else if (definitionStrongs.length > 1) {
        const firstSid = definitionStrongs[0]!
        if (!HELPER_STRONGS.has(firstSid)) {
          considerCandidate(firstSid, { tier: 2, slug, title, isOriginalEntry: true })
        }
        for (const sid of definitionStrongs.slice(1)) {
          if (!HELPER_STRONGS.has(sid)) {
            considerCandidate(sid, { tier: 3, slug, title, isOriginalEntry: true })
          }
        }
      }
      // Aliases bind only to the entry's head word (first non-helper Strong in 定義).
      const primaryStrongs = (
        definitionStrongs.length > 0
          ? definitionStrongs
              .filter((s) => !HELPER_STRONGS.has(s) || definitionStrongs.length === 1)
              .slice(0, 1)
          : bodyStrongs.filter((s) => !HELPER_STRONGS.has(s)).slice(0, 1)
      ).filter((s) => activeStrongs.has(s))

      const rawAliases = Array.isArray(frontmatter?.aliases) ? frontmatter.aliases : []
      if (primaryStrongs.length > 0 && rawAliases.length > 0) {
        for (const rawAlias of rawAliases) {
          if (typeof rawAlias !== "string") continue
          const cleanAlias = rawAlias.normalize("NFC").trim().toLowerCase()
          if (!cleanAlias) continue
          let set = aliasMap.get(cleanAlias)
          if (!set) {
            set = new Set()
            aliasMap.set(cleanAlias, set)
          }
          for (const sid of primaryStrongs) set.add(sid)
        }
      }
    } else {
      for (const sid of definitionStrongs) {
        if (!HELPER_STRONGS.has(sid)) {
          considerCandidate(sid, { tier: 5, slug, title, isOriginalEntry: false })
        }
      }
    }
  }

  const entries: Record<string, VerseOriginalEntryLink> = {}
  for (const sid of Array.from(bestByStrong.keys()).sort()) {
    const best = bestByStrong.get(sid)!
    entries[sid] = {
      slug: best.slug,
      title: best.title,
      isHeadword: best.tier <= 2,
    }
  }

  const entryAliases: Record<string, string[]> = {}
  for (const alias of Array.from(aliasMap.keys()).sort()) {
    entryAliases[alias] = Array.from(aliasMap.get(alias)!).sort()
  }

  return {
    index: {
      version: 2,
      attribution: source.attribution,
      shards: shardCount,
      senses,
      lexicon,
      entries,
      entryAliases,
    },
    shards,
  }
}

/** Add shareable verse links to the chapter itself, before resolving transcluded content. */
export function addVerseAnchors(root: Root, slug: string): void {
  if (parseBookSlug(slug)?.kind !== "chapter") return
  const list = findVerseList(root)
  if (!list) return

  list.items.forEach((item, index) => {
    const anchor = `v${list.start + index}`
    const oldId = item.properties.id
    if (typeof oldId === "string" && oldId && oldId !== anchor) {
      item.children.unshift({
        type: "element",
        tagName: "span",
        properties: { id: oldId },
        children: [],
      })
    }
    item.properties.id = anchor
  })
}
