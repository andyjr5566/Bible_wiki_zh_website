import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { Syncer } from "../src/client/sync/syncer"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { HighlightsService } from "../src/client/features/highlights/highlights"
import { healNodeRecords, locateNodeRecords, movedHere, nodeRecords } from "../src/client/repo/nodeHeal"
import type { LinkPage } from "../src/client/model/linkIndex"

let seq = 0
async function device(cloud?: MemoryCloud) {
  const store = await NotesStore.open(`heal${++seq}`, new IDBFactory())
  const repo = await Repository.create({ store })
  const syncer = new Syncer({ repo, maxWritesPerMinute: 1000 })
  syncer.setAdapter(cloud ? new MemoryAdapter(cloud) : null)
  return { repo, syncer, hl: new HighlightsService(() => repo) }
}

// 條目「亞伯拉罕」從 link_folder/舊/ 搬到 link_folder/人物/；「同名」有兩個（找不到）
const pages: LinkPage[] = [
  { s: "link_folder/人物/亞伯拉罕", t: "亞伯拉罕" },
  { s: "link_folder/人物/摩西", t: "摩西" },
  { s: "link_folder/人物/同名", t: "同名" },
  { s: "link_folder/地點/同名", t: "同名" },
]

describe("條目搬移或改名後找回紀錄（D-46）", () => {
  it("找得到新網址的書籤會改到新網址，內容與其他欄位不變；找不到、網址沒變的不動", async () => {
    const d = await device()
    await d.hl.toggleNodeBookmark("link_folder/舊/亞伯拉罕", "亞伯拉罕")
    await d.hl.toggleNodeBookmark("link_folder/人物/摩西", "摩西")
    await d.hl.toggleNodeBookmark("link_folder/舊/同名", "同名")
    const before = d.hl.findNodeBookmark("link_folder/舊/亞伯拉罕")!
    const loc = locateNodeRecords(nodeRecords(d.repo), pages)
    expect([...loc.values()].map((l) => l.kind).sort()).toEqual(["missing", "moved", "same"])

    expect(await healNodeRecords(d.repo, pages, { slug: "link_folder/人物/亞伯拉罕", title: "亞伯拉罕" })).toBe(1)
    const after = d.hl.findNodeBookmark("link_folder/人物/亞伯拉罕")!
    expect(after.id).toBe(before.id)
    expect(after.winner.type).toBe("bookmark")
    expect(after.winner.anchor).toEqual({ ...before.winner.anchor, node: { slug: "link_folder/人物/亞伯拉罕", title: "亞伯拉罕" } })
    expect(d.hl.findNodeBookmark("link_folder/舊/亞伯拉罕")).toBeUndefined()
    expect(d.hl.findNodeBookmark("link_folder/人物/摩西")).toBeDefined()
    expect(d.hl.findNodeBookmark("link_folder/舊/同名")).toBeDefined()
    expect(d.hl.allBookmarks()).toHaveLength(3)
    // 再做一次不會重複修改
    expect(await healNodeRecords(d.repo, pages, { slug: "link_folder/人物/亞伯拉罕", title: "亞伯拉罕" })).toBe(0)
  })

  it("只修「找回的就是這一頁」的紀錄", async () => {
    const d = await device()
    await d.hl.toggleNodeBookmark("link_folder/舊/亞伯拉罕", "亞伯拉罕")
    expect(movedHere(nodeRecords(d.repo), pages, "link_folder/人物/摩西")).toEqual([])
    expect(await healNodeRecords(d.repo, pages, { slug: "link_folder/人物/摩西", title: "摩西" })).toBe(0)
    expect(d.hl.findNodeBookmark("link_folder/舊/亞伯拉罕")).toBeDefined()
  })

  it("修改會同步到另一台裝置，不會變成兩筆", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.hl.toggleNodeBookmark("link_folder/舊/亞伯拉罕", "亞伯拉罕")
    await a.syncer.sync()
    await b.syncer.sync()
    await healNodeRecords(b.repo, pages, { slug: "link_folder/人物/亞伯拉罕", title: "亞伯拉罕" })
    await b.syncer.sync()
    await a.syncer.sync()
    expect(a.hl.allBookmarks()).toHaveLength(1)
    expect(a.hl.findNodeBookmark("link_folder/人物/亞伯拉罕")).toBeDefined()
    expect(a.hl.findNodeBookmark("link_folder/人物/亞伯拉罕")!.conflicts).toHaveLength(0)
  })
})
