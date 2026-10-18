import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { RETIRE_AFTER_MS, RETIRE_GRACE_MS, Syncer } from "../src/client/sync/syncer"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { chapterAnchor, type NoteRecord } from "../src/client/model/record"
import { NotesService } from "../src/client/features/notes/notes"

// 所有裝置與雲端共用一個時鐘，方便快轉半年
let seq = 0
const DAY = 24 * 60 * 60 * 1000
const STALE = RETIRE_AFTER_MS + DAY
const GRACE = RETIRE_GRACE_MS + DAY

function world() {
  const clock = { t: Date.parse("2026-01-01T00:00:00.000Z") }
  const cloud = new MemoryCloud()
  cloud.now = () => clock.t
  /** skew：這台裝置的本機時鐘比真實時間快多少 */
  const device = async (opts: { skew?: number } = {}) => {
    const store = await NotesStore.open(`rt${++seq}`, new IDBFactory())
    const repo = await Repository.create({ store, now: () => clock.t + (opts.skew ?? 0) })
    const syncer = new Syncer({ repo, maxWritesPerMinute: 1000 })
    syncer.setAdapter(new MemoryAdapter(cloud), () => true)
    return { repo, syncer, store, notes: new NotesService(() => repo) }
  }
  return { clock, cloud, device }
}

type W = ReturnType<typeof world>
const note = (body: string, chapter = 1) => ({ book: "GEN", chapter, verseStart: null, verseEnd: null, title: "", body, tags: [] })
const bodies = (d: { notes: NotesService }) => d.notes.all().map((r) => r.winner.body).sort()
const filesOf = (w: W, device: string) => [...w.cloud.files.values()].filter((f) => f.meta.device === device && f.meta.kind !== "retired")
const marked = (w: W, device: string) => [...w.cloud.files.values()].some((f) => f.meta.kind === "retired" && f.meta.device === device)

describe("裝置整理（12 C7，兩階段）", () => {
  it("半年沒用：先接手並寫標記（不刪檔）；兩週後才刪除它的檔案；新裝置看得到全部筆記", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    await old.notes.create(note("舊手機寫的"))
    await old.notes.create(note("舊手機寫的第二則", 2))
    await old.syncer.sync()
    await a.notes.create(note("電腦寫的"))
    await a.syncer.sync()

    w.clock.t += STALE
    await a.syncer.sync()
    expect(marked(w, old.repo.deviceId)).toBe(true)
    expect(filesOf(w, old.repo.deviceId).length).toBeGreaterThan(0) // 第一階段不刪
    w.clock.t += 3 * DAY
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId).length).toBeGreaterThan(0) // 還沒滿兩週也不刪

    w.clock.t += GRACE
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId)).toHaveLength(0)
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["舊手機寫的", "舊手機寫的第二則", "電腦寫的"])
  })

  it("最近有在用的裝置不整理", async () => {
    const w = world()
    const other = await w.device()
    const a = await w.device()
    await other.notes.create(note("最近寫的"))
    await other.syncer.sync()
    w.clock.t += 30 * DAY
    await a.syncer.sync()
    expect(marked(w, other.repo.deviceId)).toBe(false)
  })

  it("每天都有同步、只是沒寫筆記的裝置（登記檔每天更新）不整理（Codex 第二輪 #6）", async () => {
    const w = world()
    const reader = await w.device()
    const a = await w.device()
    await reader.notes.create(note("很久以前寫的"))
    await reader.syncer.sync()
    for (let i = 0; i < 8; i++) {
      w.clock.t += 30 * DAY
      await reader.syncer.sync()
      await a.syncer.sync()
    }
    expect(marked(w, reader.repo.deviceId)).toBe(false)
    expect(filesOf(w, reader.repo.deviceId).length).toBeGreaterThan(0)
  })

  it("舊裝置有同時修改造成的衝突：先不整理；使用者選好版本後才整理，兩個版本都保住", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    const n = await old.notes.create(note("原文"))
    await old.syncer.sync()
    await a.syncer.sync()
    await old.notes.update(n.id, { body: "舊手機改的" })
    await a.notes.update(n.id, { body: "電腦同時改的" })
    await old.syncer.sync()
    await a.syncer.sync()
    w.clock.t += STALE
    await a.syncer.sync()
    expect(marked(w, old.repo.deviceId)).toBe(false)
    await a.notes.resolveConflict(n.id, { keepBoth: true })
    await a.syncer.sync()
    w.clock.t += 2 * DAY
    await a.syncer.sync()
    expect(marked(w, old.repo.deviceId)).toBe(true)
    w.clock.t += GRACE
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId)).toHaveLength(0)
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["舊手機改的", "電腦同時改的"].sort())
  })

  it("舊裝置在兩階段之間回來、而且有沒上傳的修改：換新 ID 重新上傳；之後舊檔案照常刪除，修改不遺失", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    const n = await old.notes.create(note("舊手機寫的"))
    await old.syncer.sync()
    await a.syncer.sync()
    w.clock.t += STALE
    await old.notes.update(n.id, { body: "舊手機離線時又改了" }) // 本機修改，還沒上傳
    await a.syncer.sync() // 第一階段
    const oldId = old.repo.deviceId
    await old.syncer.sync()
    expect(old.syncer.status.kind).toBe("ready")
    expect(old.repo.deviceId).not.toBe(oldId)
    w.clock.t += GRACE
    await a.syncer.sync() // 第二階段：舊 ID 的檔案在標記之後沒有寫入 → 刪除
    expect(filesOf(w, oldId)).toHaveLength(0)
    await old.syncer.sync()
    expect(old.syncer.status.kind).toBe("ready") // 舊檔案被刪不算雲端被清空
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["舊手機離線時又改了"])
  })

  it("舊裝置在檔案刪除之後才回來：換新 ID 重新上傳，不會誤判雲端被清空", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    const n = await old.notes.create(note("舊手機寫的"))
    await old.syncer.sync()
    w.clock.t += STALE
    await a.syncer.sync()
    w.clock.t += GRACE
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId)).toHaveLength(0)
    await old.notes.update(n.id, { body: "回來後改的" })
    await old.syncer.sync()
    expect(old.syncer.status.kind).toBe("ready")
    await a.syncer.sync()
    expect(bodies(a)).toEqual(["回來後改的"])
  })

  it("被整理的裝置只做上傳、而且是新章節的筆記：先換新 ID，不會用舊身分建立檔案（Codex 整理審查 #3）", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    await old.notes.create(note("舊的"))
    await old.syncer.sync()
    w.clock.t += STALE
    await a.syncer.sync()
    const oldId = old.repo.deviceId
    const before = filesOf(w, oldId).length
    await old.notes.create(note("新章節", 7))
    await old.syncer.push()
    expect(old.syncer.status.kind).not.toBe("error")
    expect(old.repo.deviceId).not.toBe(oldId)
    expect(filesOf(w, oldId)).toHaveLength(before)
    await old.syncer.sync()
    await a.syncer.sync()
    expect(bodies(a)).toEqual(["新章節", "舊的"].sort())
  })

  it("標記之後舊 ID 的檔案又有寫入：第二階段不刪除", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    await old.notes.create(note("舊的"))
    await old.syncer.sync()
    w.clock.t += STALE
    await a.syncer.sync()
    w.clock.t += DAY
    const f = filesOf(w, old.repo.deviceId).find((x) => x.meta.kind === "shard")!
    f.meta = { ...f.meta, version: String(Number(f.meta.version) + 2), modified: w.clock.t } // 模擬標記之後的寫入
    w.clock.t += GRACE
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId).length).toBeGreaterThan(0)
    // 之後又閒置半年：重新寫標記、從頭等兩週，最後照常整理（Codex 第三輪：不會永遠卡住）
    w.clock.t += STALE
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId).length).toBeGreaterThan(0)
    w.clock.t += GRACE
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId)).toHaveLength(0)
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["舊的"])
  })

  it("標記在更早一批變更裡、舊檔案在之後才被刪：舊裝置換新 ID，不誤判雲端被清空（Codex 第三輪 #8）", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    await old.notes.create(note("舊手機寫的"))
    await old.syncer.sync()
    w.clock.t += STALE
    await a.syncer.sync() // 第一階段：寫標記
    await old.store.setMeta("startPageToken", w.cloud.token()) // 模擬標記那一批已經被跳過
    w.clock.t += GRACE
    await a.syncer.sync() // 第二階段：刪除舊檔案
    const oldId = old.repo.deviceId
    await old.syncer.sync()
    expect(old.syncer.status.kind).toBe("ready")
    expect(old.repo.deviceId).not.toBe(oldId)
    await a.syncer.sync()
    expect(bodies(a)).toEqual(["舊手機寫的"])
  })

  it("本機時鐘快了半年，不會把還在用的裝置判定為閒置（Codex 整理審查 #9）", async () => {
    const w = world()
    const other = await w.device()
    const skewed = await w.device({ skew: STALE })
    await other.notes.create(note("最近寫的"))
    await other.syncer.sync()
    await skewed.syncer.sync()
    expect(marked(w, other.repo.deviceId)).toBe(false)
  })

  it("舊裝置的分片讀不到（內容壞掉）就不整理（Codex 整理審查 #7）", async () => {
    const w = world()
    const old = await w.device()
    await old.notes.create(note("舊的"))
    await old.syncer.sync()
    const a = await w.device()
    w.clock.t += STALE
    const shard = filesOf(w, old.repo.deviceId).find((f) => f.meta.kind === "shard")!
    shard.body = JSON.stringify({ bad: true })
    shard.meta = { ...shard.meta, version: "99" }
    await a.syncer.sync()
    expect(marked(w, old.repo.deviceId)).toBe(false)
  })

  it("兩台裝置同時整理同一台舊裝置：結果一致、沒有重複筆記", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    const b = await w.device()
    await old.notes.create(note("舊手機寫的"))
    await old.syncer.sync()
    await a.syncer.sync()
    await b.syncer.sync()
    w.clock.t += STALE
    await Promise.all([a.syncer.sync(), b.syncer.sync()])
    w.clock.t += GRACE
    await Promise.all([a.syncer.sync(), b.syncer.sync()])
    await a.syncer.sync()
    await b.syncer.sync()
    expect(filesOf(w, old.repo.deviceId)).toHaveLength(0)
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["舊手機寫的"])
    expect(bodies(a)).toEqual(["舊手機寫的"])
    expect(bodies(b)).toEqual(["舊手機寫的"])
  })

  it("第二階段由別台裝置執行：其他裝置的快取被它的分片涵蓋，直接丟掉、沒有重複", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    const c = await w.device()
    await old.notes.create(note("舊手機寫的"))
    await old.syncer.sync()
    await c.syncer.sync()
    w.clock.t += STALE
    await a.syncer.sync()
    w.clock.t += GRACE
    await a.syncer.sync()
    await c.syncer.sync()
    expect(bodies(c)).toEqual(["舊手機寫的"])
    expect(c.repo.removedCaches()).toHaveLength(0)
  })
})

describe("雲端被清空或原因不明的刪除（Codex 整理審查 #5、第二輪 #7）", () => {
  it("另一台裝置「刪除全部」：只有別人快取的裝置不自動傳回，改為詢問；選「清除」後畫面清空，雲端維持空的", async () => {
    const w = world()
    const a = await w.device()
    const reader = await w.device() // 只看、沒寫過
    await a.notes.create(note("要刪掉的"))
    await a.syncer.sync()
    await reader.syncer.sync()
    await a.syncer.deleteEverything()
    await reader.syncer.sync()
    expect(reader.syncer.status).toMatchObject({ kind: "error", error: "cloud-wiped" })
    expect(bodies(reader)).toEqual(["要刪掉的"]) // 沒有自動丟掉（也可能是意外清空）
    expect(w.cloud.files.size).toBe(0) // 等使用者決定：連登記檔都不建立（Codex 第三輪）
    await reader.syncer.sync()
    expect(w.cloud.files.size).toBe(0)
    await reader.syncer.acceptWipe()
    expect(bodies(reader)).toEqual([])
    expect(reader.syncer.status.kind).not.toBe("error")
    expect([...w.cloud.files.values()].filter((f) => f.meta.kind === "shard")).toHaveLength(0)
  })

  it("判定雲端被清空的那次同步，不會把本機還沒上傳的筆記傳上去（等使用者決定，Codex 第三輪）", async () => {
    const w = world()
    const a = await w.device()
    const reader = await w.device()
    await a.notes.create(note("要刪掉的"))
    await a.syncer.sync()
    await reader.syncer.sync()
    await a.syncer.deleteEverything()
    await reader.notes.create(note("離線時新寫的"))
    await reader.syncer.sync()
    expect(reader.syncer.status).toMatchObject({ kind: "error", error: "cloud-wiped" })
    expect(w.cloud.files.size).toBe(0)
    await reader.syncer.reuploadAfterWipe()
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["要刪掉的", "離線時新寫的"].sort())
  })

  it("只有別人快取的裝置選「重新上傳」：筆記傳回雲端，之後不會一直跳出詢問（Codex 第三輪）", async () => {
    const w = world()
    const a = await w.device()
    const reader = await w.device()
    await a.notes.create(note("要救回的"))
    await a.syncer.sync()
    await reader.syncer.sync()
    await a.syncer.deleteEverything()
    await reader.syncer.sync()
    expect(reader.syncer.status).toMatchObject({ kind: "error", error: "cloud-wiped" })
    await reader.syncer.reuploadAfterWipe()
    expect(reader.syncer.status.kind).toBe("ready")
    await reader.syncer.sync()
    expect(reader.syncer.status.kind).toBe("ready")
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["要救回的"])
  })

  it("雲端被清空、本機快取只剩已刪除的紀錄：不打擾使用者，也保留刪除紀錄（Codex 第三輪 #7）", async () => {
    const w = world()
    const a = await w.device()
    const reader = await w.device()
    const n = await a.notes.create(note("後來刪掉的"))
    await a.syncer.sync()
    await reader.syncer.sync()
    await a.notes.remove(n.id)
    await a.syncer.sync()
    await reader.syncer.sync()
    expect(bodies(reader)).toEqual([])
    await a.syncer.deleteEverything()
    await reader.syncer.sync()
    expect(reader.syncer.status.kind).toBe("ready")
    expect(reader.repo.removedCaches().length).toBeGreaterThan(0)
    expect(w.cloud.files.size).toBe(0)
  })

  it("雲端清空後有裝置重建了登記檔：其他還看得到筆記的裝置仍會被詢問（Codex 第四輪）", async () => {
    const w = world()
    const a = await w.device()
    const reader = await w.device()
    await a.notes.create(note("要刪掉的"))
    await a.syncer.sync()
    await reader.syncer.sync()
    await a.syncer.deleteEverything()
    const newcomer = await w.device() // 清空之後才加入的裝置：會建立登記檔
    await newcomer.syncer.sync()
    expect([...w.cloud.files.values()].some((f) => f.meta.kind === "device")).toBe(true)
    await reader.syncer.sync()
    expect(reader.syncer.status).toMatchObject({ kind: "error", error: "cloud-wiped" })
  })

  it("其他裝置的檔案原因不明地被刪除（沒有退役標記）：不自動傳回雲端，本機保留顯示", async () => {
    const w = world()
    const b = await w.device()
    const a = await w.device()
    await a.notes.create(note("a 的筆記"))
    await b.notes.create(note("只在 b 的檔案裡"))
    await b.syncer.sync()
    await a.syncer.sync()
    for (const f of filesOf(w, b.repo.deviceId)) {
      w.cloud.files.delete(f.meta.id)
      w.cloud.record(f.meta.id)
    }
    await a.syncer.sync()
    expect(bodies(a)).toEqual(["a 的筆記", "只在 b 的檔案裡"])
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual(["a 的筆記"])
  })
})

describe("整理與墓碑保存期限（Codex 第三輪 #4）", () => {
  it("舊裝置的刪除紀錄超過一年：整理時接手、上傳，舊檔案刪除後新裝置也看不到那則筆記", async () => {
    const w = world()
    const old = await w.device()
    const a = await w.device()
    const n = await old.notes.create(note("早就刪掉的"))
    await old.syncer.sync()
    await a.syncer.sync()
    await old.notes.remove(n.id)
    await old.syncer.sync()
    w.clock.t += 400 * DAY // 超過墓碑保存期限，也超過閒置門檻
    await a.syncer.sync()
    expect(marked(w, old.repo.deviceId)).toBe(true)
    w.clock.t += GRACE
    await a.syncer.sync()
    expect(filesOf(w, old.repo.deviceId)).toHaveLength(0)
    await a.syncer.sync()
    expect(bodies(a)).toEqual([])
    const fresh = await w.device()
    await fresh.syncer.sync()
    expect(bodies(fresh)).toEqual([])
  })
})

describe("接手版本的規則（12 C7）", () => {
  const rec = (vv: Record<string, number>, over: Partial<NoteRecord> = {}): NoteRecord => ({
    id: "n_01JABCDEFGHJKMNPQRSTVWXYZ0",
    type: "note",
    anchor: chapterAnchor("GEN", 1),
    title: "",
    body: "內容",
    tags: [],
    links: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hlc: "0000001760000000001:0000:d_x",
    vv,
    author: "d_x",
    deleted: false,
    ...over,
  })
  const repoOnly = async () => {
    const store = await NotesStore.open(`ad${++seq}`, new IDBFactory())
    return Repository.create({ store })
  }

  it("同一則的兩個並行版本：回報衝突、不做任何修改（不自動另存，Codex 第二輪 #3、#5）", async () => {
    const repo = await repoOnly()
    expect(await repo.adoptVersions([rec({ d_a: 2 }, { body: "a" }), rec({ d_b: 2 }, { body: "b" })], new Set())).toBe("conflict")
    expect(repo.ownRecords()).toHaveLength(0)
  })

  it("刪除與修改並行：一樣回報衝突，不自動丟掉任何一邊", async () => {
    const repo = await repoOnly()
    const live = rec({ d_a: 2 }, { body: "內容" })
    const tomb = rec({ d_b: 2 }, { body: "", deleted: true })
    expect(await repo.adoptVersions([live, tomb], new Set())).toBe("conflict")
    expect(repo.ownRecords()).toHaveLength(0)
  })

  it("已被本機版本看過的不接手；看過所有候選的較新版本直接取代", async () => {
    const repo = await repoOnly()
    const older = rec({ d_a: 1 }, { body: "舊" })
    const newer = rec({ d_a: 2 }, { body: "新" })
    expect(await repo.adoptVersions([older, newer], new Set())).toBe("adopted")
    expect(repo.ownRecords().map((r) => r.body)).toEqual(["新"])
    expect(await repo.adoptVersions([older], new Set())).toBe("none")
  })

  it("onlyOwnCovers：別的檔案也有這個版本，整理時仍要接手（不依賴可能也會被整理掉的檔案，Codex 第二輪 #2）", async () => {
    const repo = await repoOnly()
    const v = rec({ d_a: 1 })
    await repo.putRemote({ fileId: "f_other", device: "d_other", shard: "GEN", version: "1", records: [v] })
    expect(await repo.adoptVersions([v], new Set())).toBe("none")
    expect(await repo.adoptVersions([v], new Set(), { onlyOwnCovers: true })).toBe("adopted")
  })
})
