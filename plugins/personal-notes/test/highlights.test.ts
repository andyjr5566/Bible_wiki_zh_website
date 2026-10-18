import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { Syncer } from "../src/client/sync/syncer"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { HighlightsService } from "../src/client/features/highlights/highlights"
import { NotesService } from "../src/client/features/notes/notes"
import { exportBackup, importBackup } from "../src/client/repo/backup"

let seq = 0
async function device(cloud?: MemoryCloud) {
  const store = await NotesStore.open(`hl${++seq}`, new IDBFactory())
  const repo = await Repository.create({ store })
  const syncer = new Syncer({ repo, maxWritesPerMinute: 1000 })
  syncer.setAdapter(cloud ? new MemoryAdapter(cloud) : null)
  return { repo, syncer, hl: new HighlightsService(() => repo), notes: new NotesService(() => repo) }
}

const quote = { exact: "要有光", prefix: "神說：", suffix: "，就有" }

describe("畫重點與書籤（C3）", () => {
  it("畫重點：單一節記下引文；跨多節一律整節", async () => {
    const d = await device()
    await d.hl.addHighlight({ book: "GEN", chapter: 1, verseStart: 3, verseEnd: null, quote, hash: "abcd1234" })
    await d.hl.addHighlight({ book: "GEN", chapter: 1, verseStart: 4, verseEnd: 6, quote, hash: null })
    const [one, many] = d.hl.highlightsIn("GEN", 1).map((r) => r.winner.anchor)
    expect(one).toMatchObject({ kind: "verse", verseStart: 3, verseEnd: null, quote, textHash: "abcd1234" })
    expect(many).toMatchObject({ verseStart: 4, verseEnd: 6, quote: null })
  })

  it("重點與書籤不會出現在筆記清單裡；筆記也不會出現在重點裡", async () => {
    const d = await device()
    await d.hl.addHighlight({ book: "GEN", chapter: 1, verseStart: 3, verseEnd: null, quote, hash: null })
    await d.hl.toggleBookmark("GEN", 1, null, null)
    await d.notes.create({ book: "GEN", chapter: 1, verseStart: null, verseEnd: null, title: "", body: "筆記", tags: [] })
    expect(d.notes.all()).toHaveLength(1)
    expect(d.notes.forChapter("GEN", 1)).toHaveLength(1)
    expect(d.hl.allHighlights()).toHaveLength(1)
    expect(d.hl.allBookmarks()).toHaveLength(1)
  })

  it("書籤：按一次加上、再按一次移除；整章與某幾節分開", async () => {
    const d = await device()
    expect(await d.hl.toggleBookmark("GEN", 1, null, null)).toBe("added")
    expect(await d.hl.toggleBookmark("GEN", 1, 3, 5)).toBe("added")
    expect(d.hl.bookmarksIn("GEN", 1)).toHaveLength(2)
    expect(await d.hl.toggleBookmark("GEN", 1, null, null)).toBe("removed")
    expect(d.hl.findBookmark("GEN", 1, 3, 5)).toBeDefined()
    expect(d.hl.findBookmark("GEN", 1, null, null)).toBeUndefined()
  })

  it("跨裝置同步、移除也同步；匯出入保留", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const h = await a.hl.addHighlight({ book: "EXO", chapter: 12, verseStart: 7, verseEnd: null, quote, hash: null })
    await a.hl.toggleBookmark("EXO", 12, null, null)
    await a.syncer.sync()
    await b.syncer.sync()
    expect(b.hl.highlightsIn("EXO", 12).map((r) => r.id)).toEqual([h.id])
    expect(b.hl.bookmarksIn("EXO", 12)).toHaveLength(1)
    await b.hl.remove(h.id)
    await b.syncer.sync()
    await a.syncer.sync()
    expect(a.hl.highlightsIn("EXO", 12)).toHaveLength(0)
    const c = await device()
    await importBackup(c.repo, JSON.parse(JSON.stringify(exportBackup(a.repo))))
    expect(c.hl.allBookmarks()).toHaveLength(1)
  })
})

describe("知識庫條目書籤（N2）", () => {
  const slug = "link_folder/人物/亞伯拉罕"
  const title = "亞伯拉罕"

  it("依 slug 查找，加入與移除不影響其他條目及經文書籤", async () => {
    const d = await device()
    expect(d.hl.findNodeBookmark(slug)).toBeUndefined()
    await d.hl.toggleBookmark("GEN", 1, null, null)
    await d.hl.toggleBookmark("GEN", 1, 3, 5)
    expect(await d.hl.toggleNodeBookmark(slug, title)).toBe("added")
    await d.hl.toggleNodeBookmark("link_folder/人物/摩西", "摩西")
    expect(d.hl.findNodeBookmark(slug)?.winner).toMatchObject({
      type: "bookmark",
      anchor: {
        kind: "node", ref: null, book: null, chapter: null,
        verseStart: null, verseEnd: null, endRef: null,
        quote: null, textHash: null, node: { slug, title },
      },
    })
    expect(d.hl.allBookmarks()).toHaveLength(4)
    expect(d.hl.bookmarksIn("GEN", 1)).toHaveLength(2)
    expect(await d.hl.toggleNodeBookmark(slug, title)).toBe("removed")
    expect(d.hl.findNodeBookmark(slug)).toBeUndefined()
    expect(d.hl.findNodeBookmark("link_folder/人物/摩西")).toBeDefined()
    expect(d.hl.findBookmark("GEN", 1, null, null)).toBeDefined()
    expect(d.hl.findBookmark("GEN", 1, 3, 5)).toBeDefined()
    expect(await d.hl.toggleNodeBookmark(slug, title)).toBe("added")
    await d.hl.toggleBookmark("GEN", 1, null, null)
    await d.hl.toggleBookmark("GEN", 1, 3, 5)
    expect(d.hl.findNodeBookmark(slug)).toBeDefined()
    expect(d.hl.allBookmarks()).toHaveLength(2)
  })

  it("寫入 _NODE 分片，兩台裝置可看到加入與移除", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.hl.toggleNodeBookmark(slug, title)
    const id = a.hl.findNodeBookmark(slug)!.id
    await a.syncer.sync()
    const shard = [...cloud.files.values()].find((f) => f.meta.shard === "_NODE")
    expect(shard).toBeDefined()
    expect(JSON.parse(shard!.body)).toMatchObject({
      shard: "_NODE", records: [expect.objectContaining({ id, type: "bookmark" })],
    })
    await b.syncer.sync()
    expect(b.hl.findNodeBookmark(slug)?.id).toBe(id)
    expect(b.hl.findNodeBookmark(slug)?.winner.anchor.node).toEqual({ slug, title })
    expect(await b.hl.toggleNodeBookmark(slug, title)).toBe("removed")
    await b.syncer.sync()
    await a.syncer.sync()
    expect(a.hl.findNodeBookmark(slug)).toBeUndefined()
    expect(b.hl.findNodeBookmark(slug)).toBeUndefined()
    expect(a.hl.allBookmarks()).toHaveLength(0)
  })
})
