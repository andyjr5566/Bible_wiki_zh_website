// D-47、13 §4.3：比對條目頁的相關筆記，並依經文位置排序。
import { BOOKS } from "../../model/books"
import type { Resolved } from "../../merge/merge"

export interface EntryInfo {
  slug: string
  title: string
  aliases: string[]
}

export interface RelatedNotes {
  linked: Resolved[]
  mentioned: Resolved[]
}

const BOOK_ORDER = new Map(BOOKS.map((book, index) => [book.code, index]))

function mentionsEntry(record: Resolved, terms: string[]): boolean {
  const content = `${record.winner.title}\n${record.winner.body}`.toLocaleLowerCase()

  return terms.some((term) => content.includes(term.toLocaleLowerCase()))
}

function compareNotes(a: Resolved, b: Resolved): number {
  const left = a.winner.anchor
  const right = b.winner.anchor

  const leftIsNode = left.kind === "node"
  const rightIsNode = right.kind === "node"
  if (leftIsNode !== rightIsNode) return leftIsNode ? 1 : -1

  if (!leftIsNode && !rightIsNode) {
    const leftBook = left.book ? (BOOK_ORDER.get(left.book) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
    const rightBook = right.book ? (BOOK_ORDER.get(right.book) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
    if (leftBook !== rightBook) return leftBook - rightBook

    const leftChapter = left.chapter ?? Number.MAX_SAFE_INTEGER
    const rightChapter = right.chapter ?? Number.MAX_SAFE_INTEGER
    if (leftChapter !== rightChapter) return leftChapter - rightChapter

    const leftVerse = left.verseStart ?? -1
    const rightVerse = right.verseStart ?? -1
    if (leftVerse !== rightVerse) return leftVerse - rightVerse
  } else {
    const titleOrder = left.node?.title.localeCompare(right.node?.title ?? "") ?? 0
    if (titleOrder !== 0) return titleOrder
  }

  return b.winner.updatedAt.localeCompare(a.winner.updatedAt)
}

export function relatedNotes(
  records: Resolved[],
  entry: EntryInfo,
  resolve: (name: string) => string | null,
): RelatedNotes {
  const terms = [entry.title, ...entry.aliases]
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)

  const linked: Resolved[] = []
  const mentioned: Resolved[] = []

  for (const record of records) {
    const winner = record.winner
    if (winner.type !== "note" || winner.deleted === true) continue

    if (winner.anchor.kind === "node" && winner.anchor.node?.slug === entry.slug) continue

    const linksToEntry = winner.links.some((name) => resolve(name) === entry.slug)
    if (linksToEntry) {
      linked.push(record)
    } else if (terms.length > 0 && mentionsEntry(record, terms)) {
      mentioned.push(record)
    }
  }

  linked.sort(compareNotes)
  mentioned.sort(compareNotes)

  return { linked, mentioned }
}
