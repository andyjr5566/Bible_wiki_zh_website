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
