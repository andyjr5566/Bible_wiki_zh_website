import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { NotesEngine, ConflictPendingError } from "../src/client/sync/engine"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { AdapterError, type SyncAdapter } from "../src/client/adapter/types"
import { vvDominatedBy } from "../src/client/model/vv"

// ---------- 測試環境：多台裝置共用一個雲端 ----------

let dbSeq = 0

interface Dev {
  engine: NotesEngine
  store: NotesStore
  adapter: SyncAdapter
  clock: { t: number }
  token: { ok: boolean }
}

async function device(cloud: MemoryCloud, opts: { t?: number; factory?: IDBFactory; dbName?: string; adapter?: SyncAdapter } = {}): Promise<Dev> {
  const factory = opts.factory ?? new IDBFactory()
  const store = await NotesStore.open(opts.dbName ?? `db${++dbSeq}`, factory)
  const clock = { t: opts.t ?? Date.parse("2026-10-18T00:00:00.000Z") }
  const engine = await NotesEngine.create({ store, now: () => clock.t, maxWritesPerMinute: 1000 })
  const adapter = opts.adapter ?? new MemoryAdapter(cloud)
  const token = { ok: true }
  engine.setAdapter(adapter, () => token.ok)
  return { engine, store, adapter, clock, token }
}

const note = (body: string, extra: Partial<{ chapter: number; book: string; verseStart: number | null }> = {}) => ({
  book: extra.book ?? "GEN",
  chapter: extra.chapter ?? 10,
  verseStart: extra.verseStart ?? null,
  verseEnd: null,
  title: "標題",
  body,
  tags: [],
})

function bodies(d: Dev): string[] {
  return d.engine
    .visible()
    .map((r) => r.winner.body)
    .sort()
}

describe("NotesEngine：多裝置同步", () => {
  it("未設定雲端時是本機模式，筆記照常可寫", async () => {
    const store = await NotesStore.open("local1", new IDBFactory())
    const engine = await NotesEngine.create({ store })
    engine.setAdapter(null)
    await engine.create(note("本機筆記"))
    expect(engine.status.kind).toBe("local-only")
    expect(engine.forChapter("GEN", 10)).toHaveLength(1)
    expect(await engine.ensureFresh()).toBe("local")
  })

  it("A 寫、B 讀；B 改、A 讀：兩台看到同一份筆記", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.engine.create(note("A 寫的"))
    await a.engine.sync()
    expect(a.engine.status.kind).toBe("ready")
    await b.engine.sync()
    expect(bodies(b)).toEqual(["A 寫的"])
    await b.engine.update(n.id, { body: "B 改的" })
    await b.engine.sync()
    await a.engine.sync()
    expect(bodies(a)).toEqual(["B 改的"])
    expect(a.engine.get(n.id)!.conflicts).toEqual([])
  })

  it("離線時修改保留在本機，恢復連線後自動上傳", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.engine.sync()
    cloud.offline = true
    await a.engine.create(note("離線寫的"))
    await a.engine.sync()
    expect(a.engine.status.kind).toBe("offline")
    expect(await a.engine.pendingShards()).toBe(1)
    expect(await a.engine.ensureFresh(0, 1000)).toBe("failed")
    cloud.offline = false
    await a.engine.sync()
    expect(await a.engine.pendingShards()).toBe(0)
    await b.engine.sync()
    expect(bodies(b)).toEqual(["離線寫的"])
  })

  it("兩台都離線改同一則：兩邊都看到衝突、不能直接編輯；選定後兩邊一致", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.engine.create(note("原文"))
    await a.engine.sync()
    await b.engine.sync()
    await a.engine.update(n.id, { body: "A 改" })
    b.clock.t += 5
    await b.engine.update(n.id, { body: "B 改" })
    await a.engine.sync()
    await b.engine.sync()
    await a.engine.sync()
    for (const d of [a, b]) {
      const r = d.engine.get(n.id)!
      expect([r.winner.body, ...r.conflicts.map((c) => c.body)].sort()).toEqual(["A 改", "B 改"])
    }
    await expect(a.engine.update(n.id, { body: "直接改" })).rejects.toBeInstanceOf(ConflictPendingError)
    await expect(a.engine.remove(n.id)).rejects.toBeInstanceOf(ConflictPendingError)
    const keepA = a.engine.get(n.id)!
    const aVersion = [keepA.winner, ...keepA.conflicts].find((v) => v.body === "A 改")!
    await a.engine.resolveConflict(n.id, { keep: aVersion.hlc })
    await a.engine.sync()
    await b.engine.sync()
    for (const d of [a, b]) {
      expect(d.engine.get(n.id)).toMatchObject({ winner: { body: "A 改" }, conflicts: [] })
    }
  })

  it("兩個都保留：另一個版本另存為新筆記", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.engine.create(note("原文"))
    await a.engine.sync()
    await b.engine.sync()
    await a.engine.update(n.id, { body: "A 改" })
    await b.engine.update(n.id, { body: "B 改" })
    await a.engine.sync()
    await b.engine.sync()
    await a.engine.sync()
    await a.engine.resolveConflict(n.id, { keepBoth: true })
    await a.engine.sync()
    await b.engine.sync()
    expect(bodies(b)).toEqual(["A 改", "B 改"])
    expect(b.engine.visible().every((r) => r.conflicts.length === 0)).toBe(true)
  })

  it("刪除 vs 修改同時發生：列為衝突，不會默默消失", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.engine.create(note("原文"))
    await a.engine.sync()
    await b.engine.sync()
    await a.engine.remove(n.id)
    await b.engine.update(n.id, { body: "B 補充" })
    await a.engine.sync()
    await b.engine.sync()
    await a.engine.sync()
    const r = a.engine.get(n.id)!
    expect(r.conflicts).toHaveLength(1)
    expect(a.engine.visible().map((x) => x.id)).toContain(n.id)
  })

  it("時鐘慢一天的裝置：看過新版本後的修改仍然勝出", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud, { t: Date.parse("2026-10-17T00:00:00.000Z") })
    const n = await a.engine.create(note("A"))
    await a.engine.sync()
    await b.engine.sync()
    await b.engine.update(n.id, { body: "B（時鐘慢）" })
    await b.engine.sync()
    await a.engine.sync()
    expect(a.engine.get(n.id)).toMatchObject({ winner: { body: "B（時鐘慢）" }, conflicts: [] })
  })

  it("建立檔案成功但回應遺失：重試時沿用同一 ID，不產生重複檔", async () => {
    const cloud = new MemoryCloud()
    const inner = new MemoryAdapter(cloud)
    let lose = true
    const flaky: SyncAdapter = Object.assign(Object.create(inner), {
      create: async (...args: Parameters<SyncAdapter["create"]>) => {
        const r = await inner.create(...args)
        if (lose) {
          lose = false
          throw new AdapterError("network", "response lost")
        }
        return r
      },
    })
    const a = await device(cloud, { adapter: flaky })
    await a.engine.create(note("x"))
    await a.engine.sync()
    expect(a.engine.status.kind).toBe("offline")
    await a.engine.sync()
    expect(a.engine.status.kind).toBe("ready")
    const shardFiles = [...cloud.files.values()].filter((f) => f.meta.kind === "shard")
    expect(shardFiles).toHaveLength(1)
  })

  it("雲端資料被刪除：偵測並停止自動上傳；使用者確認後重新上傳", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.engine.create(note("重要筆記"))
    await a.engine.sync()
    cloud.wipe()
    await a.engine.sync()
    expect(a.engine.status).toMatchObject({ kind: "error", error: "cloud-wiped" })
    expect(cloud.files.size).toBe(0)
    await a.engine.reuploadAfterWipe()
    expect(a.engine.status.kind).toBe("ready")
    await b.engine.sync()
    expect(bodies(b)).toEqual(["重要筆記"])
  })

  it("同一台裝置兩個分頁同時改同一則：後者自動重新載入後再寫，不互相覆蓋", async () => {
    const cloud = new MemoryCloud()
    const factory = new IDBFactory()
    const tab1 = await device(cloud, { factory, dbName: "shared" })
    const n = await tab1.engine.create(note("原文"))
    const tab2 = await device(cloud, { factory, dbName: "shared" })
    await tab1.engine.update(n.id, { body: "分頁 1" })
    tab2.clock.t += 1
    const v2 = await tab2.engine.update(n.id, { body: "分頁 2" }) // tab2 的記憶體還是舊的 → CAS 失敗 → 重新載入再寫
    const v1 = tab1.engine.get(n.id)!.winner
    expect(vvDominatedBy(v1.vv, v2.vv)).toBe(true)
    await tab1.engine.reloadFromStore()
    expect(tab1.engine.get(n.id)).toMatchObject({ winner: { body: "分頁 2" }, conflicts: [] })
  })

  it("用同一個裝置 ID 的另一份資料（例如還原舊備份）：自動換新 ID，不覆蓋對方的檔案", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    await a.engine.create(note("A 的筆記"))
    await a.engine.sync()
    const clone = await device(cloud)
    await clone.store.setMeta("deviceId", a.engine.deviceId)
    await clone.engine.reloadFromStore()
    await clone.engine.create(note("複本寫的"))
    await clone.engine.sync()
    expect(clone.engine.deviceId).not.toBe(a.engine.deviceId)
    await a.engine.sync()
    expect(bodies(a)).toEqual(["A 的筆記", "複本寫的"])
  })

  it("雲端檔案是較新版本的格式：停止同步並提示更新網頁", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.engine.create(note("x"))
    await a.engine.sync()
    const f = [...cloud.files.values()].find((x) => x.meta.kind === "shard")!
    f.body = JSON.stringify({ ...JSON.parse(f.body), schema: 99 })
    await b.engine.sync()
    expect(b.engine.status).toMatchObject({ kind: "error", error: "newer-schema" })
  })

  it("被他人新版本取代的本機版本，下次上傳時從自己的分片移除", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.engine.create(note("A"))
    await a.engine.sync()
    await b.engine.sync()
    await b.engine.update(n.id, { body: "B" })
    await b.engine.sync()
    await a.engine.sync()
    await a.engine.create(note("觸發 A 重寫分片"))
    await a.engine.sync()
    const aShard = [...cloud.files.values()].find((f) => f.meta.kind === "shard" && f.meta.device === a.engine.deviceId)!
    const ids = JSON.parse(aShard.body).records.map((r: { id: string }) => r.id)
    expect(ids).not.toContain(n.id)
    expect(a.engine.get(n.id)!.winner.body).toBe("B")
  })

  it("沒有 token 時：狀態為需要重新連線，ensureFresh 回 no-token", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    a.token.ok = false
    a.engine.authChanged()
    expect(a.engine.status.kind).toBe("needs-reconnect")
    expect(await a.engine.ensureFresh()).toBe("no-token")
  })

  it("連續失敗 5 次會暫停同步（熔斷），避免狂打 API", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    cloud.failures.push({ kind: "server", count: 100 })
    for (let i = 0; i < 5; i++) await a.engine.sync()
    expect(a.engine.status).toMatchObject({ kind: "error", error: "circuit-open" })
    const before = cloud.calls.startToken ?? 0
    await a.engine.sync()
    expect(cloud.calls.startToken ?? 0).toBe(before)
  })

  it("匯出再匯入：重複匯入無害；同時修改的內容另存，不覆蓋", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const n = await a.engine.create(note("原文"))
    const exported = JSON.parse(JSON.stringify(a.engine.exportData()))
    expect(await a.engine.importData(exported)).toMatchObject({ skipped: 1, added: 0 })
    const b = await device(cloud)
    expect(await b.engine.importData(exported)).toMatchObject({ added: 1 })
    await b.engine.update(n.id, { body: "B 改" })
    await a.engine.update(n.id, { body: "A 改" })
    const fromB = JSON.parse(JSON.stringify(b.engine.exportData()))
    const res = await a.engine.importData(fromB)
    expect(res.copied).toBe(1)
    expect(bodies(a)).toEqual(["A 改", "B 改"])
    await expect(a.engine.importData({ nope: true })).rejects.toThrow()
  })

  it("未登入時寫的筆記，登入後可加入帳號", async () => {
    const anonStore = await NotesStore.open("anon", new IDBFactory())
    const anon = await NotesEngine.create({ store: anonStore })
    await anon.create(note("未登入時寫的"))
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const records = await anonStore.getAllOwn()
    expect(await a.engine.adoptRecords(records)).toBe(1)
    await a.engine.sync()
    const b = await device(cloud)
    await b.engine.sync()
    expect(bodies(b)).toEqual(["未登入時寫的"])
  })

  it("刪除全部：雲端清空、本機清空", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    await a.engine.create(note("x"))
    await a.engine.sync()
    await a.engine.deleteEverything()
    expect(cloud.files.size).toBe(0)
    expect(a.engine.visible()).toHaveLength(0)
  })
})

describe("NotesEngine：Codex 審查回歸測試", () => {
  it("#3 更新其實成功但回應遺失：不會誤判成別人用了同一裝置 ID", async () => {
    const cloud = new MemoryCloud()
    const inner = new MemoryAdapter(cloud)
    let lose = false
    const flaky: SyncAdapter = Object.assign(Object.create(inner), {
      update: async (...args: Parameters<SyncAdapter["update"]>) => {
        const r = await inner.update(...args)
        if (lose) {
          lose = false
          throw new AdapterError("network", "response lost")
        }
        return r
      },
    })
    const a = await device(cloud, { adapter: flaky })
    const n = await a.engine.create(note("v1"))
    await a.engine.sync()
    const id1 = a.engine.deviceId
    await a.engine.update(n.id, { body: "v2" })
    lose = true
    await a.engine.sync()
    expect(a.engine.status.kind).toBe("offline")
    await a.engine.sync()
    expect(a.engine.deviceId).toBe(id1)
    expect([...cloud.files.values()].filter((f) => f.meta.kind === "shard")).toHaveLength(1)
  })

  it("#5 雲端清空後重新上傳：其他裝置的較新版本與衝突版本都保住", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.engine.create(note("原文"))
    const m = await a.engine.create(note("第二則"))
    await a.engine.sync()
    await b.engine.sync()
    await b.engine.update(n.id, { body: "B 的較新版本" })
    await b.engine.update(m.id, { body: "B 同時改" })
    await a.engine.update(m.id, { body: "A 同時改" })
    await b.engine.sync()
    await a.engine.sync()
    cloud.wipe()
    await a.engine.sync()
    await a.engine.reuploadAfterWipe()
    const c = await device(cloud)
    await c.engine.sync()
    expect(bodies(c)).toEqual(["A 同時改", "B 同時改", "B 的較新版本"].sort())
  })

  it("#6 未登入時的筆記和帳號裡同 id 但內容不同：另存，不丟棄", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const n = await a.engine.create(note("帳號裡的版本"))
    const anonStore = await NotesStore.open("anon6", new IDBFactory())
    const anon = await NotesEngine.create({ store: anonStore })
    await anon.importData(JSON.parse(JSON.stringify(a.engine.exportData())))
    await anon.update(n.id, { body: "未登入時改的" })
    await a.engine.update(n.id, { body: "帳號裡又改了" })
    const added = await a.engine.adoptRecords(await anonStore.getAllOwn())
    expect(added).toBe(1)
    expect(bodies(a)).toEqual(["帳號裡又改了", "未登入時改的"].sort())
  })
})
