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

const MAX_VERSE_ITEMS = 200
const NON_VERSE_TAGS = new Set(["ol", "ul", "rp", "rt", "script", "style", "template"])

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
