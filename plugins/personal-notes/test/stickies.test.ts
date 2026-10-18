import { afterEach, describe, expect, it, vi } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { Syncer } from "../src/client/sync/syncer"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { StickiesService, stickyColor } from "../src/client/features/stickies/stickies"
import { getStickyMode, setStickyMode, onStickyModeChange } from "../src/client/features/stickies/settings"
import { ChapterStickies } from "../src/client/features/stickies/chapterView"
import { chapterAnchor } from "../src/client/model/record"

let seq = 0
async function device(cloud?: MemoryCloud) {
  const store = await NotesStore.open("sticky" + ++seq, new IDBFactory())
  const repo = await Repository.create({ store })
  const syncer = new Syncer({ repo, maxWritesPerMinute: 1000 })
  syncer.setAdapter(cloud ? new MemoryAdapter(cloud) : null)
  return { repo, syncer, service: new StickiesService(() => repo) }
}
afterEach(() => vi.unstubAllGlobals())

describe("便條資料與同步", () => {
  it("新增、改文字、改顏色、非法顏色及 300 字上限", async () => {
    const { service } = await device()
    const r = await service.add("GEN", 1, 3, "第一行\n第二行", "pink")
    expect(service.get(r.id)?.winner).toMatchObject({ type: "sticky", body: "第一行\n第二行", color: "pink", anchor: { kind: "verse", verseStart: 3 } })
    await service.update(r.id, { text: "新文字" })
    await service.update(r.id, { color: "blue" })
    expect(service.get(r.id)?.winner).toMatchObject({ body: "新文字", color: "blue" })
    expect(stickyColor({ ...r, color: "invalid" })).toBe("yellow")
    const long = await service.add("GEN", 1, 4, "🗒".repeat(301), "green")
    expect(Array.from(long.body)).toHaveLength(300)
    await service.update(r.id, { text: "字".repeat(301) })
    expect(service.get(r.id)?.winner.body).toHaveLength(300)
  })
  it("刪除後復原保留文字、顏色與錨點", async () => {
    const { service } = await device()
    const r = await service.add("GEN", 1, 3, "記得這段", "green")
    await service.remove(r.id)
    expect(service.all()).toHaveLength(0)
    await service.restore(r)
    expect(service.get(r.id)?.winner).toMatchObject({ body: r.body, color: r.color, anchor: r.anchor, deleted: false })
  })
  it("本章依節數排序，只含未刪除便條", async () => {
    const { repo, service } = await device()
    await service.add("GEN", 1, 9, "九", "yellow")
    await service.add("GEN", 1, 2, "二", "pink")
    const gone = await service.add("GEN", 1, 1, "刪掉", "blue")
    await service.remove(gone.id)
    await service.add("GEN", 2, 1, "別章", "yellow")
    await repo.insert(repo.draft({ type: "note", anchor: chapterAnchor("GEN", 1), title: "", body: "筆記", tags: [] }))
    expect(service.inChapter("GEN", 1).map(r => r.winner.anchor.verseStart)).toEqual([2, 9])
  })
  it("兩台裝置同步顏色，同時改文後選定版本，兩邊一致", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud), b = await device(cloud)
    const r = await a.service.add("GEN", 1, 3, "原文", "pink")
    await a.syncer.sync(); await b.syncer.sync()
    expect(b.service.get(r.id)?.winner).toMatchObject({ body: "原文", color: "pink" })
    await a.service.update(r.id, { text: "甲修改" })
    await b.service.update(r.id, { text: "乙修改" })
    await a.syncer.sync(); await b.syncer.sync(); await a.syncer.sync()
    const conflict = a.service.get(r.id)!
    expect(conflict.conflicts).toHaveLength(1)
    expect(b.service.get(r.id)?.conflicts).toHaveLength(1)
    await a.service.resolveConflict(r.id, { keep: conflict.conflicts[0].hlc })
    await a.syncer.sync(); await b.syncer.sync()
    expect(b.service.get(r.id)?.winner).toEqual(a.service.get(r.id)?.winner)
    expect(b.service.get(r.id)?.conflicts).toEqual([])
  })
})

describe("便條顯示偏好", () => {
  function setup() {
    const data = new Map<string, string>()
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
    vi.stubGlobal("window", new EventTarget())
    return data
  }
  it("預設展開、非法值回退、可以儲存與通知，解除後不再通知", () => {
    const data = setup()
    expect(getStickyMode()).toBe("open")
    data.set("bwz-sticky-mode", "wrong")
    expect(getStickyMode()).toBe("open")
    const run = vi.fn(), off = onStickyModeChange(run)
    setStickyMode("icon")
    expect(getStickyMode()).toBe("icon")
    expect(run).toHaveBeenLastCalledWith("icon")
    data.set("bwz-sticky-mode", "open")
    window.dispatchEvent(Object.assign(new Event("storage"), { key: "bwz-sticky-mode" }))
    expect(run).toHaveBeenLastCalledWith("open")
    off(); setStickyMode("icon")
    expect(run).toHaveBeenCalledTimes(2)
  })
  it("localStorage 不可用仍可操作", () => {
    setup()
    vi.stubGlobal("localStorage", { getItem: () => { throw Error("blocked") }, setItem: () => { throw Error("blocked") } })
    expect(getStickyMode()).toBe("open")
    const run = vi.fn(), off = onStickyModeChange(run)
    expect(() => setStickyMode("icon")).not.toThrow()
    expect(run).toHaveBeenCalledWith("icon")
    off()
  })
})

// 只測儲存生命週期，不假裝這是瀏覽器視覺測試。
// 不呼叫 View 建構式，讓真實 Repository 驗證重疊儲存與銷毀時的結果。
function persistence(repo: Repository) {
  const view = Object.create(ChapterStickies.prototype)
  Object.assign(view, { repo, service: new StickiesService(() => repo), book: "GEN", chapter: 1, queue: Promise.resolve(), writing: 0, dead: true, cards: new Set(), overrides: new Map(), cleanups: [], host: { replaceChildren() {} } })
  return view as {
    cards: Set<unknown>
    save(c: unknown, finish?: boolean): Promise<void>
    queue: Promise<void>
    destroy(): void
  }
}
function draft(text = "") {
  return { el: { dataset: {} as Record<string, string>, remove() {} }, verse: 3, editor: { value: text }, color: "pink", saved: "" }
}
describe("便條儲存生命週期", () => {
  it("空白草稿不建立；同時排隊的第一次儲存與後續輸入只產生一筆", async () => {
    const { repo, service } = await device()
    const view = persistence(repo), c = draft()
    await view.save(c)
    expect(service.all()).toHaveLength(0)
    c.editor.value = "第一版"
    const first = view.save(c)
    c.editor.value = "最新輸入"
    const second = view.save(c)
    await Promise.all([first, second])
    expect(service.all()).toHaveLength(1)
    expect(service.all()[0].winner).toMatchObject({ body: "最新輸入", color: "pink" })
  })
  it("完成空內容刪除既存便條；destroy 立即排入尚未儲存的文字", async () => {
    const { repo, service } = await device()
    const view = persistence(repo), c = draft("待儲存")
    view.cards.add(c)
    view.destroy()
    await view.queue
    expect(service.all()[0].winner.body).toBe("待儲存")
    c.editor.value = ""
    await view.save(c, true)
    expect(service.all()).toHaveLength(0)
  })
  it("儲存失敗後可重試，不會讓整條儲存佇列永久失效", async () => {
    const { repo, service } = await device()
    const view = persistence(repo), c = draft("重試保留")
    const insert = vi.spyOn(repo, "insert").mockRejectedValueOnce(new Error("full"))
    await expect(view.save(c)).rejects.toThrow("full")
    await view.save(c)
    expect(service.all()[0].winner.body).toBe("重試保留")
    insert.mockRestore()
  })
})
