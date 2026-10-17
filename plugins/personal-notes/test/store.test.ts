import "fake-indexeddb/auto"
import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { chapterAnchor, type NoteRecord } from "../src/client/model/record"

function rec(id: string, body = "x"): NoteRecord {
  return {
    id,
    type: "note",
    anchor: chapterAnchor("GEN", 1),
    title: "",
    body,
    tags: [],
    links: [],
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    hlc: "0000000000000001:0000:d_AAAAAAAA",
    vv: { d_AAAAAAAA: 1 },
    author: "d_AAAAAAAA",
    deleted: false,
  }
}

const ID1 = "n_01JA8Z6Q3K9V7M2T4R5S6Y8X0A"
const ID2 = "n_01JA8Z6Q3K9V7M2T4R5S6Y8X0B"

describe("NotesStore", () => {
  it("own 與 outbox 在同一交易中寫入", async () => {
    const s = await NotesStore.open("t1", new IDBFactory())
    await s.saveOwn([rec(ID1)], ["GEN"], 100)
    expect(await s.getAllOwn()).toHaveLength(1)
    expect(await s.getOutbox()).toEqual([{ shard: "GEN", dirtyAt: 100 }])
  })

  it("上傳期間有新修改時，clearDirty 不清除", async () => {
    const s = await NotesStore.open("t2", new IDBFactory())
    await s.markDirty(["GEN"], 100)
    await s.markDirty(["GEN"], 200) // 上傳中又改了
    expect(await s.clearDirty("GEN", 100)).toBe(false)
    expect(await s.getOutbox()).toHaveLength(1)
    expect(await s.clearDirty("GEN", 200)).toBe(true)
    expect(await s.getOutbox()).toHaveLength(0)
  })

  it("remote 快取、meta、刪除與清空", async () => {
    const f = new IDBFactory()
    const s = await NotesStore.open("t3", f)
    await s.putRemote({ fileId: "f1", device: "d_BBBBBBBB", shard: "GEN", version: "3", records: [rec(ID2)] })
    await s.setMeta("deviceId", "d_AAAAAAAA")
    await s.saveOwn([rec(ID1)], ["GEN"], 1)
    expect((await s.getAllRemote())[0].records[0].id).toBe(ID2)
    expect(await s.getMeta("deviceId")).toBe("d_AAAAAAAA")
    await s.deleteOwn([ID1])
    expect(await s.getAllOwn()).toHaveLength(0)
    await s.clearAll()
    expect(await s.getAllRemote()).toHaveLength(0)
    expect(await s.getMeta("deviceId")).toBeUndefined()
    s.close()
    // 重新開啟仍可用
    const s2 = await NotesStore.open("t3", f)
    expect(await s2.getOutbox()).toHaveLength(0)
  })
})
