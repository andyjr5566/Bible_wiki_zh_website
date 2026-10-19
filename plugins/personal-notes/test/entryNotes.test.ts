import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { Syncer } from "../src/client/sync/syncer"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { HighlightsService } from "../src/client/features/highlights/highlights"
import { NotesService, type NoteInput } from "../src/client/features/notes/notes"
import { exportBackup, importBackup } from "../src/client/repo/backup"
import { shardOf } from "../src/client/model/record"
import { chapterTarget, entryTarget } from "../src/client/features/notes/notesPanel"

let seq = 0
async function device(cloud?: MemoryCloud) {
  const store = await NotesStore.open(`en${++seq}`, new IDBFactory())
  const repo = await Repository.create({ store })
  const syncer = new Syncer({ repo, maxWritesPerMinute: 1000 })
  syncer.setAdapter(cloud ? new MemoryAdapter(cloud) : null)
  return { repo, syncer, notes: new NotesService(() => repo), hl: new HighlightsService(() => repo) }
}

const slug = "link_folder/人物/亞伯拉罕"
const title = "亞伯拉罕"
const node = { slug, title }

/** 條目筆記的輸入（慣例：book／chapter 填 ""、0）。 */
const entryInput = (over: Partial<NoteInput> = {}): NoteInput => ({
  node,
  book: "",
  chapter: 0,
  verseStart: null,
  verseEnd: null,
  title: "信心之父",
  body: "見 [[以撒]]",
  tags: ["人物"],
  ...over,
})
const chapterInput = (over: Partial<NoteInput> = {}): NoteInput => ({
  book: "GEN",
  chapter: 22,
  verseStart: 1,
  verseEnd: 14,
  title: "獻以撒",
  body: "章節筆記",
  tags: [],
  ...over,
})

const exactNodeAnchor = {
  kind: "node",
  ref: null,
  book: null,
  chapter: null,
  verseStart: null,
  verseEnd: null,
  endRef: null,
  quote: null,
  textHash: null,
  node,
}

describe("條目筆記（F5，D-47）", () => {
  it("建立：錨點是 node，章節與經文欄位全為 null，進 _NODE 分片", async () => {
    const d = await device()
    const n = await d.notes.create(entryInput())
    expect(n.type).toBe("note")
    expect(n.anchor).toEqual(exactNodeAnchor)
    expect(shardOf(n)).toBe("_NODE")
    expect(n.links).toEqual(["以撒"])
  })

  it("update 陷阱：改標題、內文、標籤後錨點完全不變（不會變成 _FREE 章節錨點）", async () => {
    const d = await device()
    const n = await d.notes.create(entryInput())
    const u1 = await d.notes.update(n.id, { title: "新標題" })
    expect(u1.anchor).toEqual(exactNodeAnchor)
    const u2 = await d.notes.update(n.id, { body: "新內文", tags: ["a", "a", " b "] })
    expect(u2.anchor).toEqual(exactNodeAnchor)
    expect(u2.tags).toEqual(["a", "b"])
    expect(shardOf(u2)).toBe("_NODE")
    expect(d.notes.get(n.id)!.winner.anchor).toEqual(exactNodeAnchor)
  })

  it("update：面板／草稿傳整份輸入（含 book 空字串、chapter 0）也不會動到條目錨點", async () => {
    const d = await device()
    const n = await d.notes.create(entryInput())
    const u = await d.notes.update(n.id, entryInput({ body: "整份輸入" }))
    expect(u.anchor).toEqual(exactNodeAnchor)
    // 就算有人誤傳章節欄位，條目筆記也不會被改成章節錨點
    const u2 = await d.notes.update(n.id, { book: "GEN", chapter: 1, verseStart: 3, verseEnd: null })
    expect(u2.anchor).toEqual(exactNodeAnchor)
  })

  it("update：章節筆記的行為不變（明確改節數才重建、沒帶位置欄位就原樣保留）", async () => {
    const d = await device()
    const c = await d.notes.create(chapterInput())
    const u1 = await d.notes.update(c.id, { title: "只改標題" })
    expect(u1.anchor).toEqual(c.anchor)
    const u2 = await d.notes.update(c.id, { verseStart: 5, verseEnd: null })
    expect(u2.anchor).toMatchObject({ kind: "chapter", ref: "GEN.22", book: "GEN", chapter: 22, verseStart: 5, verseEnd: null, node: null })
    const u3 = await d.notes.update(c.id, chapterInput({ chapter: 23 }))
    expect(u3.anchor).toMatchObject({ book: "GEN", chapter: 23, verseStart: 1, verseEnd: 14 })
  })

  it("forEntry 只回傳該條目的筆記；章節查詢與重點、書籤都看不到條目筆記", async () => {
    const d = await device()
    const a = await d.notes.create(entryInput())
    await d.notes.create(entryInput({ node: { slug: "link_folder/人物/摩西", title: "摩西" }, body: "別的條目" }))
    await d.notes.create(chapterInput())
    await d.hl.toggleNodeBookmark(slug, title) // 同一個條目的書籤不是筆記
    expect(d.notes.forEntry(slug).map((r) => r.id)).toEqual([a.id])
    expect(d.notes.forEntry("link_folder/人物/無此條目")).toEqual([])
    expect(d.notes.all()).toHaveLength(3)
    expect(d.notes.forChapter("GEN", 22)).toHaveLength(1)
    expect(d.notes.forChapter("GEN", 22)[0].winner.body).toBe("章節筆記")
    expect(d.hl.allBookmarks()).toHaveLength(1)
    // 條目筆記不會混進任何書卷的章節
    expect(d.repo.inChapter("GEN", 0)).toHaveLength(0)
    expect(d.notes.forChapter("_FREE", 0)).toHaveLength(0)
  })

  it("刪除條目筆記後 forEntry 不再列出", async () => {
    const d = await device()
    const n = await d.notes.create(entryInput())
    await d.notes.remove(n.id)
    expect(d.notes.forEntry(slug)).toHaveLength(0)
  })

  it("兩台裝置：在另一台改過的條目筆記仍然是條目筆記，且不影響章節筆記", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(entryInput())
    const c = await a.notes.create(chapterInput())
    await a.syncer.sync()
    await b.syncer.sync()
    expect(b.notes.forEntry(slug).map((r) => r.id)).toEqual([n.id])
    await b.notes.update(n.id, { title: "B 改的標題", body: "B 改的內文" })
    await b.notes.update(c.id, { body: "B 改的章節" })
    await b.syncer.sync()
    await a.syncer.sync()
    const got = a.notes.get(n.id)!.winner
    expect(got.title).toBe("B 改的標題")
    expect(got.anchor).toEqual(exactNodeAnchor)
    expect(a.notes.forEntry(slug)).toHaveLength(1)
    expect(a.notes.forChapter("GEN", 22).map((r) => r.winner.body)).toEqual(["B 改的章節"])
    const shard = [...cloud.files.values()].find((f) => f.meta.shard === "_NODE")
    expect(shard).toBeDefined()
    expect(JSON.parse(shard!.body).records[0].anchor.kind).toBe("node")
  })

  it("備份匯出再匯入，條目筆記仍是條目筆記", async () => {
    const a = await device()
    const n = await a.notes.create(entryInput())
    const b = await device()
    await importBackup(b.repo, JSON.parse(JSON.stringify(exportBackup(a.repo))))
    expect(b.notes.forEntry(slug).map((r) => r.id)).toEqual([n.id])
    expect(b.notes.get(n.id)!.winner.anchor).toEqual(exactNodeAnchor)
  })
})

describe("面板目標（chapterTarget／entryTarget）", () => {
  it("條目目標：不顯示節數、位置欄位是 node、按鈕與空狀態文字", async () => {
    const d = await device()
    const t = entryTarget(node)
    expect(t.verses).toBe(false)
    expect(t.addLabel).toBe("＋ 寫一則關於〈亞伯拉罕〉的筆記")
    expect(t.place()).toEqual({ book: "", chapter: 0, node })
    expect(t.acceptsCompose({ book: "GEN", chapter: 1, verseStart: 1, verseEnd: null })).toBe(false)
    const n = await d.notes.create({ ...entryInput(), ...t.place() })
    await d.notes.create(chapterInput())
    expect(t.notesOf(d.notes).map((r) => r.id)).toEqual([n.id])
  })

  it("章節目標：行為與以前相同", async () => {
    const d = await device()
    const t = chapterTarget("GEN", 22)
    expect(t.verses).toBe(true)
    expect(t.addLabel).toBe("＋ 新增筆記")
    expect(t.place()).toEqual({ book: "GEN", chapter: 22 })
    expect(t.acceptsCompose({ book: "GEN", chapter: 22, verseStart: 1, verseEnd: null })).toBe(true)
    expect(t.acceptsCompose({ book: "GEN", chapter: 23, verseStart: 1, verseEnd: null })).toBe(false)
    await d.notes.create(entryInput())
    const c = await d.notes.create(chapterInput())
    expect(t.notesOf(d.notes).map((r) => r.id)).toEqual([c.id])
  })
})

describe("錨點保持不變：Codex Sol 審查 F5a", () => {
  it("#2 章節筆記收到條目資訊或空書卷：錨點不變、不會掉進 _FREE", async () => {
    const d = await device()
    const n = await d.notes.create(chapterInput())
    const before = d.notes.get(n.id)!.winner.anchor
    await d.notes.update(n.id, entryInput({ body: "改內文" }))
    const after = d.notes.get(n.id)!.winner
    expect(after.anchor).toEqual(before)
    expect(shardOf(after)).toBe("GEN")
    expect(after.body).toBe("改內文")
  })

  it("#3 條目筆記：同一個條目但頁面標題不同時，錨點完全不變", async () => {
    const d = await device()
    const n = await d.notes.create(entryInput())
    const before = d.notes.get(n.id)!.winner.anchor
    await d.notes.update(n.id, entryInput({ node: { slug, title: "亞伯拉罕（信心之父）" }, body: "新內文" }))
    expect(d.notes.get(n.id)!.winner.anchor).toEqual(before)
  })

  it("#4 章節筆記帶 quote 等額外欄位：面板送出位置相同的完整輸入，錨點全欄位相等", async () => {
    const d = await device()
    const n = await d.notes.create(chapterInput())
    const r = d.repo.get(n.id)!
    const withQuote = { ...r.winner.anchor, quote: { exact: "亞伯拉罕", prefix: "", suffix: "" }, textHash: "abcd1234" }
    await d.repo.replace(d.repo.revise(r, { anchor: withQuote }))
    await d.notes.update(n.id, chapterInput({ body: "只改文字" }))
    expect(d.notes.get(n.id)!.winner.anchor).toEqual(withQuote)
    // 位置真的改了才重建
    await d.notes.update(n.id, chapterInput({ verseStart: 2, verseEnd: 3 }))
    expect(d.notes.get(n.id)!.winner.anchor).toMatchObject({ book: "GEN", chapter: 22, verseStart: 2, verseEnd: 3 })
  })
})
