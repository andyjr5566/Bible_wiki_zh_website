import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  BIBLE_BOOKS,
  BOOK_GROUPS,
  bookByFolderSlug,
  folderName,
  folderSlug,
  groupBooks,
} from "./bibleBooks"

const ranges = [
  ["torah", "摩西五經", 1, 5, "ot"],
  ["history", "歷史書", 6, 17, "ot"],
  ["wisdom", "詩歌智慧書", 18, 22, "ot"],
  ["prophets", "先知書", 23, 39, "ot"],
  ["gospels", "福音書", 40, 43, "nt"],
  ["acts", "使徒行傳", 44, 44, "nt"],
  ["epistles", "書信", 45, 65, "nt"],
  ["revelation", "啟示錄", 66, 66, "nt"],
] as const

test("contains 66 consecutive books with unique short names", () => {
  assert.equal(BIBLE_BOOKS.length, 66)
  assert.deepEqual(BIBLE_BOOKS.map((book) => book.num), Array.from({ length: 66 }, (_, i) => i + 1))
  assert.equal(new Set(BIBLE_BOOKS.map((book) => book.short)).size, 66)
})

test("groups cover the right ranges once and use the right testament", () => {
  assert.deepEqual(
    BOOK_GROUPS.map((group) => [group.id, group.name, BIBLE_BOOKS.filter((book) => book.group === group.id)[0]?.num, BIBLE_BOOKS.filter((book) => book.group === group.id).at(-1)?.num, group.testament]),
    ranges,
  )
  assert.deepEqual(BOOK_GROUPS.map((group) => group.id), ranges.map(([id]) => id))

  const groupedBooks = groupBooks().flatMap(({ books }) => books)
  assert.deepEqual(groupedBooks.map((book) => book.num).sort((a, b) => a - b), BIBLE_BOOKS.map((book) => book.num))
  assert.equal(new Set(groupedBooks.map((book) => book.num)).size, 66)

  for (const book of BIBLE_BOOKS) {
    const group = BOOK_GROUPS.find((candidate) => candidate.id === book.group)
    assert.ok(group, "book " + book.num + " has a known group")
    assert.equal(group.testament, book.num <= 39 ? "ot" : "nt")
  }
  assert.deepEqual(
    groupBooks("ot").flatMap(({ books }) => books).map((book) => book.num),
    Array.from({ length: 39 }, (_, i) => i + 1),
  )
  assert.deepEqual(
    groupBooks("nt").flatMap(({ books }) => books).map((book) => book.num),
    Array.from({ length: 27 }, (_, i) => i + 40),
  )
})

test("folder helpers accept slug, spaced folder name, and encoded forms", () => {
  const exodus = BIBLE_BOOKS[1]
  assert.equal(folderName(exodus), "02 出埃及記")
  assert.equal(folderSlug(exodus), "02-出埃及記")
  assert.equal(bookByFolderSlug("02-出埃及記"), exodus)
  assert.equal(bookByFolderSlug("02 出埃及記"), exodus)
  assert.equal(bookByFolderSlug("02-%E5%87%BA%E5%9F%83%E5%8F%8A%E8%A8%98/"), exodus)
})

test("the canonical list matches the sync script and existing plugin book tables", () => {
  const syncText = readFileSync(new URL("../../sync_content.ps1", import.meta.url), "utf8")
  const syncSpec = syncText.match(/\$bookSpec\s*=\s*'([^']+)'/)
  assert.ok(syncSpec, "sync_content.ps1 defines $bookSpec")
  const syncBooks = syncSpec[1]
    .trim()
    .split(/\s+/)
    .map((entry) => {
      const match = /^(\D+?)(\d+)$/.exec(entry)
      assert.ok(match, "parse sync book item " + entry)
      return { name: match[1], chapters: Number(match[2]) }
    })
  assert.deepEqual(
    BIBLE_BOOKS.map(({ name, chapters }) => ({ name, chapters })),
    syncBooks,
  )

  const personalNotes = readFileSync(
    new URL("../../plugins/personal-notes/src/client/model/books.ts", import.meta.url),
    "utf8",
  )
  const personalBooks = [...personalNotes.matchAll(/\{\s*num:\s*"(\d+)",\s*name:\s*"([^"]+)",\s*code:\s*"[^"]+",\s*chapters:\s*(\d+)\s*\}/g)].map(
    (match) => ({ num: Number(match[1]), name: match[2], chapters: Number(match[3]) }),
  )
  assert.equal(personalBooks.length, 66)
  assert.deepEqual(
    BIBLE_BOOKS.map(({ num, name, chapters }) => ({ num, name, chapters })),
    personalBooks,
  )

  const scriptureRef = readFileSync(
    new URL("../../plugins/semantic-search/src/components/scriptureRef.ts", import.meta.url),
    "utf8",
  )
  const semanticBooks = [...scriptureRef.matchAll(/\{\s*number:\s*(\d+),([\s\S]*?)\n\s*\},/g)].map(
    (match) => {
      const name = /\bzh:\s*"([^"]+)"/.exec(match[2])
      const slug = /\bslugFolder:\s*"([^"]+)"/.exec(match[2])
      const chapters = /\bchapters:\s*(\d+)/.exec(match[2])
      assert.ok(name, "semantic-search entry has a Chinese name")
      assert.ok(slug, "semantic-search entry has a folder slug")
      return {
        num: Number(match[1]),
        name: name[1],
        slug: slug[1],
        chapters: chapters ? Number(chapters[1]) : undefined,
      }
    },
  )
  assert.equal(semanticBooks.length, 66)
  assert.deepEqual(
    semanticBooks.map(({ num, name, slug }) => ({ num, name, slug })),
    BIBLE_BOOKS.map((book) => ({ num: book.num, name: book.name, slug: folderSlug(book) })),
  )
  for (const [index, book] of BIBLE_BOOKS.entries()) {
    const exportedCount = semanticBooks[index].chapters
    if (exportedCount !== undefined) assert.equal(exportedCount, book.chapters)
  }
})
