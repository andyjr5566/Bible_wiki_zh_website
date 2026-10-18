import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { ConflictPendingError, Repository } from "../src/client/repo/repository"
import { adoptRecords, exportBackup, importBackup } from "../src/client/repo/backup"
import { Syncer } from "../src/client/sync/syncer"
import { NotesService } from "../src/client/features/notes/notes"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { AdapterError, type SyncAdapter } from "../src/client/adapter/types"
import { vvDominatedBy } from "../src/client/model/vv"
import { chapterAnchor } from "../src/client/model/record"

// ---------- 測試環境：多台裝置共用一個雲端 ----------

let dbSeq = 0

interface Dev {
  repo: Repository
  syncer: Syncer
  notes: NotesService
  store: NotesStore
  adapter: SyncAdapter
  clock: { t: number }
  token: { ok: boolean }
}

async function device(cloud: MemoryCloud, opts: { t?: number; factory?: IDBFactory; dbName?: string; adapter?: SyncAdapter } = {}): Promise<Dev> {
  const factory = opts.factory ?? new IDBFactory()
  const store = await NotesStore.open(opts.dbName ?? `db${++dbSeq}`, factory)
  const clock = { t: opts.t ?? Date.parse("2026-10-18T00:00:00.000Z") }
  const repo = await Repository.create({ store, now: () => clock.t })
  const syncer = new Syncer({ repo, maxWritesPerMinute: 1000 })
  const adapter = opts.adapter ?? new MemoryAdapter(cloud)
  const token = { ok: true }
  syncer.setAdapter(adapter, () => token.ok)
  return { repo, syncer, notes: new NotesService(() => repo), store, adapter, clock, token }
}

/** 未登入（只存本機）的裝置。 */
async function localDevice(name: string) {
  const store = await NotesStore.open(name, new IDBFactory())
  const repo = await Repository.create({ store })
  const syncer = new Syncer({ repo })
  syncer.setAdapter(null)
  return { store, repo, syncer, notes: new NotesService(() => repo) }
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

function bodies(d: Pick<Dev, "notes">): string[] {
  return d.notes
    .all()
    .map((r) => r.winner.body)
    .sort()
}

describe("同步：多裝置同步", () => {
  it("未設定雲端時是本機模式，筆記照常可寫", async () => {
    const d = await localDevice("local1")
    await d.notes.create(note("本機筆記"))
    expect(d.syncer.status.kind).toBe("local-only")
    expect(d.notes.forChapter("GEN", 10)).toHaveLength(1)
    expect(await d.syncer.ensureFresh()).toBe("local")
  })

  it("A 寫、B 讀；B 改、A 讀：兩台看到同一份筆記", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("A 寫的"))
    await a.syncer.sync()
    expect(a.syncer.status.kind).toBe("ready")
    await b.syncer.sync()
    expect(bodies(b)).toEqual(["A 寫的"])
    await b.notes.update(n.id, { body: "B 改的" })
    await b.syncer.sync()
    await a.syncer.sync()
    expect(bodies(a)).toEqual(["B 改的"])
    expect(a.repo.get(n.id)!.conflicts).toEqual([])
  })

  it("離線時修改保留在本機，恢復連線後自動上傳", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.syncer.sync()
    cloud.offline = true
    await a.notes.create(note("離線寫的"))
    await a.syncer.sync()
    expect(a.syncer.status.kind).toBe("offline")
    expect(await a.repo.pendingShards()).toBe(1)
    expect(await a.syncer.ensureFresh(0, 1000)).toBe("failed")
    cloud.offline = false
    await a.syncer.sync()
    expect(await a.repo.pendingShards()).toBe(0)
    await b.syncer.sync()
    expect(bodies(b)).toEqual(["離線寫的"])
  })

  it("兩台都離線改同一則：兩邊都看到衝突、不能直接編輯；選定後兩邊一致", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("原文"))
    await a.syncer.sync()
    await b.syncer.sync()
    await a.notes.update(n.id, { body: "A 改" })
    b.clock.t += 5
    await b.notes.update(n.id, { body: "B 改" })
    await a.syncer.sync()
    await b.syncer.sync()
    await a.syncer.sync()
    for (const d of [a, b]) {
      const r = d.repo.get(n.id)!
      expect([r.winner.body, ...r.conflicts.map((c) => c.body)].sort()).toEqual(["A 改", "B 改"])
    }
    await expect(a.notes.update(n.id, { body: "直接改" })).rejects.toBeInstanceOf(ConflictPendingError)
    await expect(a.notes.remove(n.id)).rejects.toBeInstanceOf(ConflictPendingError)
    const keepA = a.repo.get(n.id)!
    const aVersion = [keepA.winner, ...keepA.conflicts].find((v) => v.body === "A 改")!
    await a.notes.resolveConflict(n.id, { keep: aVersion.hlc })
    await a.syncer.sync()
    await b.syncer.sync()
    for (const d of [a, b]) {
      expect(d.repo.get(n.id)).toMatchObject({ winner: { body: "A 改" }, conflicts: [] })
    }
  })

  it("兩個都保留：另一個版本另存為新筆記", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("原文"))
    await a.syncer.sync()
    await b.syncer.sync()
    await a.notes.update(n.id, { body: "A 改" })
    await b.notes.update(n.id, { body: "B 改" })
    await a.syncer.sync()
    await b.syncer.sync()
    await a.syncer.sync()
    await a.notes.resolveConflict(n.id, { keepBoth: true })
    await a.syncer.sync()
    await b.syncer.sync()
    expect(bodies(b)).toEqual(["A 改", "B 改"])
    expect(b.repo.visible().every((r) => r.conflicts.length === 0)).toBe(true)
  })

  it("刪除 vs 修改同時發生：列為衝突，不會默默消失", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("原文"))
    await a.syncer.sync()
    await b.syncer.sync()
    await a.notes.remove(n.id)
    await b.notes.update(n.id, { body: "B 補充" })
    await a.syncer.sync()
    await b.syncer.sync()
    await a.syncer.sync()
    const r = a.repo.get(n.id)!
    expect(r.conflicts).toHaveLength(1)
    expect(a.repo.visible().map((x) => x.id)).toContain(n.id)
  })

  it("時鐘慢一天的裝置：看過新版本後的修改仍然勝出", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud, { t: Date.parse("2026-10-17T00:00:00.000Z") })
    const n = await a.notes.create(note("A"))
    await a.syncer.sync()
    await b.syncer.sync()
    await b.notes.update(n.id, { body: "B（時鐘慢）" })
    await b.syncer.sync()
    await a.syncer.sync()
    expect(a.repo.get(n.id)).toMatchObject({ winner: { body: "B（時鐘慢）" }, conflicts: [] })
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
    await a.notes.create(note("x"))
    await a.syncer.sync()
    expect(a.syncer.status.kind).toBe("offline")
    await a.syncer.sync()
    expect(a.syncer.status.kind).toBe("ready")
    const shardFiles = [...cloud.files.values()].filter((f) => f.meta.kind === "shard")
    expect(shardFiles).toHaveLength(1)
  })

  it("雲端資料被刪除：偵測並停止自動上傳；使用者確認後重新上傳", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.notes.create(note("重要筆記"))
    await a.syncer.sync()
    cloud.wipe()
    await a.syncer.sync()
    expect(a.syncer.status).toMatchObject({ kind: "error", error: "cloud-wiped" })
    expect(cloud.files.size).toBe(0)
    await a.syncer.reuploadAfterWipe()
    expect(a.syncer.status.kind).toBe("ready")
    await b.syncer.sync()
    expect(bodies(b)).toEqual(["重要筆記"])
  })

  it("同一台裝置兩個分頁同時改同一則：後者自動重新載入後再寫，不互相覆蓋", async () => {
    const cloud = new MemoryCloud()
    const factory = new IDBFactory()
    const tab1 = await device(cloud, { factory, dbName: "shared" })
    const n = await tab1.notes.create(note("原文"))
    const tab2 = await device(cloud, { factory, dbName: "shared" })
    await tab1.notes.update(n.id, { body: "分頁 1" })
    tab2.clock.t += 1
    const v2 = await tab2.notes.update(n.id, { body: "分頁 2" }) // tab2 的記憶體還是舊的 → CAS 失敗 → 重新載入再寫
    const v1 = tab1.repo.get(n.id)!.winner
    expect(vvDominatedBy(v1.vv, v2.vv)).toBe(true)
    await tab1.repo.reloadFromStore()
    expect(tab1.repo.get(n.id)).toMatchObject({ winner: { body: "分頁 2" }, conflicts: [] })
  })

  it("用同一個裝置 ID 的另一份資料（例如還原舊備份）：自動換新 ID，不覆蓋對方的檔案", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    await a.notes.create(note("A 的筆記"))
    await a.syncer.sync()
    const clone = await device(cloud)
    await clone.store.setMeta("deviceId", a.repo.deviceId)
    await clone.repo.reloadFromStore()
    await clone.notes.create(note("複本寫的"))
    await clone.syncer.sync()
    expect(clone.repo.deviceId).not.toBe(a.repo.deviceId)
    await a.syncer.sync()
    expect(bodies(a)).toEqual(["A 的筆記", "複本寫的"])
  })

  it("雲端檔案是較新版本的格式：停止同步並提示更新網頁", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    await a.notes.create(note("x"))
    await a.syncer.sync()
    const f = [...cloud.files.values()].find((x) => x.meta.kind === "shard")!
    f.body = JSON.stringify({ ...JSON.parse(f.body), schema: 99 })
    await b.syncer.sync()
    expect(b.syncer.status).toMatchObject({ kind: "error", error: "newer-schema" })
  })

  it("被他人新版本取代的本機版本，下次上傳時從自己的分片移除", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("A"))
    await a.syncer.sync()
    await b.syncer.sync()
    await b.notes.update(n.id, { body: "B" })
    await b.syncer.sync()
    await a.syncer.sync()
    await a.notes.create(note("觸發 A 重寫分片"))
    await a.syncer.sync()
    const aShard = [...cloud.files.values()].find((f) => f.meta.kind === "shard" && f.meta.device === a.repo.deviceId)!
    const ids = JSON.parse(aShard.body).records.map((r: { id: string }) => r.id)
    expect(ids).not.toContain(n.id)
    expect(a.repo.get(n.id)!.winner.body).toBe("B")
  })

  it("沒有 token 時：狀態為需要重新連線，ensureFresh 回 no-token", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    a.token.ok = false
    a.syncer.authChanged()
    expect(a.syncer.status.kind).toBe("needs-reconnect")
    expect(await a.syncer.ensureFresh()).toBe("no-token")
  })

  it("連續失敗 5 次會暫停同步（熔斷），避免狂打 API", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    cloud.failures.push({ kind: "server", count: 100 })
    for (let i = 0; i < 5; i++) await a.syncer.sync()
    expect(a.syncer.status).toMatchObject({ kind: "error", error: "circuit-open" })
    const before = cloud.calls.startToken ?? 0
    await a.syncer.sync()
    expect(cloud.calls.startToken ?? 0).toBe(before)
  })

  it("匯出再匯入：重複匯入無害；同時修改的內容另存，不覆蓋", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const n = await a.notes.create(note("原文"))
    const exported = JSON.parse(JSON.stringify(exportBackup(a.repo)))
    expect(await importBackup(a.repo, exported)).toMatchObject({ skipped: 1, added: 0 })
    const b = await device(cloud)
    expect(await importBackup(b.repo, exported)).toMatchObject({ added: 1 })
    await b.notes.update(n.id, { body: "B 改" })
    await a.notes.update(n.id, { body: "A 改" })
    const fromB = JSON.parse(JSON.stringify(exportBackup(b.repo)))
    const res = await importBackup(a.repo, fromB)
    expect(res.copied).toBe(1)
    expect(bodies(a)).toEqual(["A 改", "B 改"])
    await expect(importBackup(a.repo, { nope: true })).rejects.toThrow()
  })

  it("未登入時寫的筆記，登入後可加入帳號", async () => {
    const anon = await localDevice("anon")
    await anon.notes.create(note("未登入時寫的"))
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const records = await anon.store.getAllOwn()
    expect(await adoptRecords(a.repo, records)).toBe(1)
    await a.syncer.sync()
    const b = await device(cloud)
    await b.syncer.sync()
    expect(bodies(b)).toEqual(["未登入時寫的"])
  })

  it("刪除全部：雲端清空、本機清空", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    await a.notes.create(note("x"))
    await a.syncer.sync()
    await a.syncer.deleteEverything()
    expect(cloud.files.size).toBe(0)
    expect(a.repo.visible()).toHaveLength(0)
  })
})

describe("同步：Codex 審查回歸測試", () => {
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
    const n = await a.notes.create(note("v1"))
    await a.syncer.sync()
    const id1 = a.repo.deviceId
    await a.notes.update(n.id, { body: "v2" })
    lose = true
    await a.syncer.sync()
    expect(a.syncer.status.kind).toBe("offline")
    await a.syncer.sync()
    expect(a.repo.deviceId).toBe(id1)
    expect([...cloud.files.values()].filter((f) => f.meta.kind === "shard")).toHaveLength(1)
  })

  it("#5 雲端清空後重新上傳：其他裝置的較新版本與衝突版本都保住", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("原文"))
    const m = await a.notes.create(note("第二則"))
    await a.syncer.sync()
    await b.syncer.sync()
    await b.notes.update(n.id, { body: "B 的較新版本" })
    await b.notes.update(m.id, { body: "B 同時改" })
    await a.notes.update(m.id, { body: "A 同時改" })
    await b.syncer.sync()
    await a.syncer.sync()
    cloud.wipe()
    await a.syncer.sync()
    await a.syncer.reuploadAfterWipe()
    const c = await device(cloud)
    await c.syncer.sync()
    expect(bodies(c)).toEqual(["A 同時改", "B 同時改", "B 的較新版本"].sort())
  })

  it("#6 未登入時的筆記和帳號裡同 id 但內容不同：另存，不丟棄", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const n = await a.notes.create(note("帳號裡的版本"))
    const anon = await localDevice("anon6")
    await importBackup(anon.repo, JSON.parse(JSON.stringify(exportBackup(a.repo))))
    await anon.notes.update(n.id, { body: "未登入時改的" })
    await a.notes.update(n.id, { body: "帳號裡又改了" })
    const added = await adoptRecords(a.repo, await anon.store.getAllOwn())
    expect(added).toBe(1)
    expect(bodies(a)).toEqual(["帳號裡又改了", "未登入時改的"].sort())
  })
})

describe("同步：Codex 重構審查回歸測試", () => {
  it("B1 備份檔裡同一則有兩個衝突版本：匯入到新裝置兩個都保住；再匯入一次不會重複", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("原文"))
    await a.syncer.sync()
    await b.syncer.sync()
    await a.notes.update(n.id, { body: "A 改" })
    await b.notes.update(n.id, { body: "B 改" })
    await a.syncer.sync()
    await b.syncer.sync()
    await a.syncer.sync()
    const backup = JSON.parse(JSON.stringify(exportBackup(a.repo)))
    expect(backup.records.filter((r: { id: string }) => r.id === n.id)).toHaveLength(2)
    const c = await localDevice("restore-b1")
    await importBackup(c.repo, backup)
    expect(bodies(c)).toEqual(["A 改", "B 改"])
    const again = await importBackup(c.repo, backup)
    expect(again.added + again.updated).toBe(0)
    expect(bodies(c)).toEqual(["A 改", "B 改"])
  })

  it("B1 同一次寫入有重複 id 時拒絕（不讓後者默默蓋掉前者）", async () => {
    const d = await localDevice("dup-b1")
    const r = d.repo.draft({ type: "note", anchor: chapterAnchor("GEN", 1), title: "", body: "x", tags: [] })
    await expect(d.repo.commit([{ record: r, expectedHlc: null, previous: undefined }, { record: { ...r, body: "y" }, expectedHlc: null, previous: undefined }])).rejects.toThrow()
  })

  it("B4 別台裝置的檔案被移除後，不再用它的快取刪掉自己的版本", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    const b = await device(cloud)
    const n = await a.notes.create(note("A"))
    await a.syncer.sync()
    await b.syncer.sync()
    await b.notes.update(n.id, { body: "B" })
    await b.syncer.sync()
    await a.syncer.sync()
    const bFile = [...cloud.files.values()].find((f) => f.meta.kind === "shard" && f.meta.device === b.repo.deviceId)!
    cloud.files.delete(bFile.meta.id)
    cloud.record(bFile.meta.id)
    await a.syncer.sync()
    await a.notes.create(note("觸發 A 重寫分片"))
    await a.syncer.sync()
    const c = await device(cloud)
    await c.syncer.sync()
    expect(c.repo.get(n.id)).toBeDefined()
  })

  it("B5 有雲端但授權到期時，「刪除全部」失敗且不清本機", async () => {
    const cloud = new MemoryCloud()
    const a = await device(cloud)
    await a.notes.create(note("x"))
    await a.syncer.sync()
    a.token.ok = false
    await expect(a.syncer.deleteEverything()).rejects.toThrow()
    expect(a.notes.all()).toHaveLength(1)
    expect(cloud.files.size).toBeGreaterThan(0)
  })
})
