import { describe, expect, it } from "vitest"
import { relatedNotes } from "../src/client/features/notes/related"
import type { Anchor, NoteRecord } from "../src/client/model/record"
import type { Resolved } from "../src/client/merge/merge"

const entry = {
  slug: "link_folder/人物/亞伯拉罕",
  title: "亞伯拉罕",
  aliases: ["亞伯蘭"],
}

const emptyAnchor: Anchor = {
  kind: "free",
  ref: null,
  book: null,
  chapter: null,
  verseStart: null,
  verseEnd: null,
  endRef: null,
  quote: null,
  textHash: null,
  node: null,
}

function makeRecord(
  id: string,
  overrides: Partial<NoteRecord> = {},
  anchor: Anchor = emptyAnchor,
): Resolved {
  const winner: NoteRecord = {
    id,
    type: "note",
    anchor,
    title: "",
    body: "",
    tags: [],
    links: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hlc: "20260101000000000-0000-test",
    vv: {},
    author: "test",
    deleted: false,
    ...overrides,
  }

  return {
    id,
    winner,
    conflicts: [],
    frontierVv: {},
  }
}

function verseAnchor(book: string, chapter: number, verseStart: number | null): Anchor {
  return { ...emptyAnchor, kind: "verse", book, chapter, verseStart, verseEnd: verseStart }
}

function nodeAnchor(slug: string, title: string): Anchor {
  return { ...emptyAnchor, kind: "node", node: { slug, title } }
}

const resolve = (name: string): string | null => {
  if (name === "亞伯拉罕" || name === "亞伯蘭") return entry.slug
  return null
}

describe("relatedNotes", () => {
  it("places links resolving to the entry in linked", () => {
    const result = relatedNotes(
      [makeRecord("link", { links: ["亞伯拉罕"] })],
      entry,
      resolve,
    )

    expect(result.linked.map(({ id }) => id)).toEqual(["link"])
    expect(result.mentioned).toEqual([])
  })

  it("places alias links resolving to the entry in linked", () => {
    const result = relatedNotes([makeRecord("alias", { links: ["亞伯蘭"] })], entry, resolve)

    expect(result.linked.map(({ id }) => id)).toEqual(["alias"])
  })

  it("places body mentions in mentioned", () => {
    const result = relatedNotes([makeRecord("mention", { body: "亞伯拉罕離開吾珥。" })], entry, resolve)

    expect(result.mentioned.map(({ id }) => id)).toEqual(["mention"])
  })

  it("lists a note with both a matching link and mention only in linked", () => {
    const result = relatedNotes(
      [makeRecord("both", { links: ["亞伯拉罕"], body: "亞伯拉罕離開吾珥。" })],
      entry,
      resolve,
    )

    expect(result.linked.map(({ id }) => id)).toEqual(["both"])
    expect(result.mentioned).toEqual([])
  })

  it("ignores one-character aliases", () => {
    const result = relatedNotes(
      [makeRecord("short", { title: "甲", body: "提到甲" })],
      { ...entry, title: "", aliases: ["甲"] },
      resolve,
    )

    expect(result.mentioned).toEqual([])
  })

  it("excludes notes anchored to this entry", () => {
    const result = relatedNotes(
      [
        makeRecord(
          "anchored",
          { links: ["亞伯拉罕"], body: "亞伯拉罕" },
          nodeAnchor(entry.slug, entry.title),
        ),
      ],
      entry,
      resolve,
    )

    expect(result.linked).toEqual([])
    expect(result.mentioned).toEqual([])
  })

  it("excludes non-note records and deleted notes", () => {
    const result = relatedNotes(
      [
        makeRecord("sticky", { type: "sticky", body: "亞伯拉罕" }),
        makeRecord("bookmark", { type: "bookmark", body: "亞伯拉罕" }),
        makeRecord("deleted", { deleted: true, body: "亞伯拉罕" }),
      ],
      entry,
      resolve,
    )

    expect(result.linked).toEqual([])
    expect(result.mentioned).toEqual([])
  })

  it("sorts by canonical book, chapter, whole chapter, verse, then node notes", () => {
    const result = relatedNotes(
      [
        makeRecord("exodus", { links: ["亞伯拉罕"] }, verseAnchor("EXO", 1, 1)),
        makeRecord("gen12v3", { links: ["亞伯拉罕"] }, verseAnchor("GEN", 12, 3)),
        makeRecord("gen12whole", { links: ["亞伯拉罕"] }, verseAnchor("GEN", 12, null)),
        makeRecord("node", { links: ["亞伯拉罕"] }, nodeAnchor("other", "其他條目")),
      ],
      entry,
      resolve,
    )

    expect(result.linked.map(({ id }) => id)).toEqual([
      "gen12whole",
      "gen12v3",
      "exodus",
      "node",
    ])
  })
})
