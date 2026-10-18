import { describe, expect, it } from "vitest"
import { HlcClock } from "../src/client/model/hlc"
import { chapterAnchor, type NoteRecord } from "../src/client/model/record"
import { vvDominatedBy } from "../src/client/model/vv"
import { nextVv, pruneOwn, resolveAll, resolveVersions, type Resolved } from "../src/client/merge/merge"

// ---------- 小工具：模擬裝置 ----------

class Device {
  clock: HlcClock
  known = new Map<string, NoteRecord[]>() // id → 所有已知版本
  constructor(
    public id: string,
    now: () => number,
  ) {
    this.clock = new HlcClock(id, null, now)
  }

  learn(v: NoteRecord) {
    this.clock.observe(v.hlc)
    const list = this.known.get(v.id) ?? []
    if (!list.some((x) => x.hlc === v.hlc)) list.push(v)
    this.known.set(v.id, list)
  }

  resolved(id: string): Resolved | null {
    return resolveVersions(this.known.get(id) ?? [])
  }

  write(id: string, patch: Partial<NoteRecord>): NoteRecord {
    const r = this.resolved(id)
    const base = r?.winner
    const v: NoteRecord = {
      id,
      type: "note",
      anchor: chapterAnchor("GEN", 1),
      title: base?.title ?? "",
      body: base?.body ?? "",
      tags: [],
      links: [],
      createdAt: base?.createdAt ?? "2026-10-18T00:00:00.000Z",
      updatedAt: "2026-10-18T00:00:00.000Z",
      hlc: this.clock.tick(),
      vv: nextVv(r, this.id),
      author: this.id,
      deleted: false,
      ...patch,
    }
    this.learn(v)
    return v
  }

  syncFrom(other: Device) {
    for (const list of other.known.values()) for (const v of list) this.learn(v)
  }
}

const ID = "n_01JA8Z6Q3K9V7M2T4R5S6Y8X0W"

describe("resolveVersions：基本情境", () => {
  it("單一版本", () => {
    const a = new Device("d_AAAAAAAA", () => 1)
    const v = a.write(ID, { body: "x" })
    expect(resolveVersions([v])).toMatchObject({ winner: v, conflicts: [] })
  })

  it("同一台裝置連續編輯：只剩最新版", () => {
    const a = new Device("d_AAAAAAAA", () => 1)
    a.write(ID, { body: "1" })
    const v2 = a.write(ID, { body: "2" })
    expect(a.resolved(ID)).toMatchObject({ winner: v2, conflicts: [] })
  })

  it("看過對方版本後再編輯：取代對方，沒有衝突", () => {
    const a = new Device("d_AAAAAAAA", () => 10)
    const b = new Device("d_BBBBBBBB", () => 5) // B 的時鐘比較慢
    a.write(ID, { body: "A 寫的" })
    b.syncFrom(a)
    const vb = b.write(ID, { body: "B 看過後改的" })
    a.syncFrom(b)
    expect(a.resolved(ID)).toMatchObject({ winner: vb, conflicts: [] })
  })

  it("兩台同時修改：hlc 大者顯示，另一個列為衝突", () => {
    const a = new Device("d_AAAAAAAA", () => 100)
    const b = new Device("d_BBBBBBBB", () => 200)
    a.write(ID, { body: "原文" })
    b.syncFrom(a)
    const va = a.write(ID, { body: "A 改" })
    const vb = b.write(ID, { body: "B 改" })
    a.syncFrom(b)
    const r = a.resolved(ID)!
    expect(r.winner).toEqual(vb)
    expect(r.conflicts).toEqual([va])
  })

  it("兩台同時改成一樣的內容：不算衝突", () => {
    const a = new Device("d_AAAAAAAA", () => 100)
    const b = new Device("d_BBBBBBBB", () => 200)
    a.write(ID, { body: "原文" })
    b.syncFrom(a)
    a.write(ID, { body: "相同" })
    b.write(ID, { body: "相同" })
    a.syncFrom(b)
    expect(a.resolved(ID)!.conflicts).toEqual([])
  })

  it("刪除 vs 修改同時發生：列為衝突", () => {
    const a = new Device("d_AAAAAAAA", () => 100)
    const b = new Device("d_BBBBBBBB", () => 50)
    a.write(ID, { body: "原文" })
    b.syncFrom(a)
    const tomb = a.write(ID, { deleted: true, body: "" })
    const vb = b.write(ID, { body: "B 補充" })
    a.syncFrom(b)
    const r = a.resolved(ID)!
    // 誰顯示由 hlc 決定；重點是刪除與修改兩個版本都保留，交給使用者選
    expect([r.winner, ...r.conflicts].map((x) => x.hlc).sort()).toEqual([tomb.hlc, vb.hlc].sort())
    expect(r.conflicts).toHaveLength(1)
  })

  it("解決衝突的新版本取代所有衝突版本", () => {
    const a = new Device("d_AAAAAAAA", () => 100)
    const b = new Device("d_BBBBBBBB", () => 200)
    a.write(ID, { body: "原文" })
    b.syncFrom(a)
    a.write(ID, { body: "A 改" })
    b.write(ID, { body: "B 改" })
    a.syncFrom(b)
    const merged = a.write(ID, { body: "合併後" })
    b.syncFrom(a)
    expect(b.resolved(ID)).toMatchObject({ winner: merged, conflicts: [] })
  })

  it("反例：A 解決衝突後的版本，不會被只看過舊版本的 C 誤判為已取代", () => {
    // 若新版本只以勝出版本為基礎，A 的計數會倒退，C 的版本會誤蓋 A 的新版本。
    const a = new Device("d_AAAAAAAA", () => 100)
    const b = new Device("d_BBBBBBBB", () => 200)
    const c = new Device("d_CCCCCCCC", () => 300)
    a.write(ID, { body: "A 原版" })
    b.write(ID, { body: "B 同時寫" })
    a.syncFrom(b)
    c.syncFrom(a) // C 看過 A 原版與 B，但沒看過 A 接下來的版本
    const va2 = a.write(ID, { body: "A 選定後再改" })
    const vc = c.write(ID, { body: "C 改" })
    a.syncFrom(c)
    const r = a.resolved(ID)!
    expect(vvDominatedBy(va2.vv, vc.vv)).toBe(false)
    expect([r.winner.hlc, ...r.conflicts.map((x) => x.hlc)].sort()).toEqual([va2.hlc, vc.hlc].sort())
  })

  it("反例（D-26）：後寫者的 base 時間較大，但其實沒看過對方 → 仍判為衝突", () => {
    // 舊規則（baseHlc >= V.hlc 視為看過）會把 B 的版本誤判為已取代。
    let t = 0
    const a = new Device("d_AAAAAAAA", () => t)
    const b = new Device("d_BBBBBBBB", () => t)
    t = 1
    a.write(ID, { body: "原文" })
    b.syncFrom(a)
    t = 10
    const vb = b.write(ID, { body: "B 改（時間 10）" })
    t = 20
    a.write(ID, { body: "A 改（時間 20）" }) // A 沒看過 B
    t = 30
    a.write(ID, { body: "A 再改（base=20 > 10）" })
    a.syncFrom(b)
    const r = a.resolved(ID)!
    expect(r.conflicts.map((c) => c.hlc)).toContain(vb.hlc)
  })

  it("相同 hlc 的重複版本只算一次", () => {
    const a = new Device("d_AAAAAAAA", () => 1)
    const v = a.write(ID, { body: "x" })
    expect(resolveVersions([v, { ...v }, { ...v }])!.conflicts).toEqual([])
  })
})


describe("Codex 審查回歸測試", () => {
  it("#4 重啟後產生相同 hlc 的不同版本：不會被去重丟掉，較新的 vv 勝出", () => {
    const v1: NoteRecord = {
      id: ID, type: "note", anchor: chapterAnchor("GEN", 1), title: "", body: "z", tags: [], links: [],
      createdAt: "x", updatedAt: "x", hlc: "0000000000001000:0000:d_AAAAAAAA", vv: { d_AAAAAAAA: 1 }, author: "d_AAAAAAAA", deleted: false,
    }
    const v2: NoteRecord = { ...v1, body: "a", vv: { d_AAAAAAAA: 2 } }
    for (const order of [[v1, v2], [v2, v1]]) {
      const r = resolveVersions(order)!
      expect(r.winner.body).toBe("a")
      expect(r.conflicts).toEqual([])
    }
  })

  it("#6 相同 hlc、相同內容、不同 vv：輸入順序不同結果相同", () => {
    const base: NoteRecord = {
      id: ID, type: "note", anchor: chapterAnchor("GEN", 1), title: "", body: "same", tags: [], links: [],
      createdAt: "x", updatedAt: "x", hlc: "0000000000001000:0000:d_AAAAAAAA", vv: { d_AAAAAAAA: 1 }, author: "d_AAAAAAAA", deleted: false,
    }
    const other = { ...base, vv: { d_AAAAAAAA: 2 } }
    const r1 = resolveVersions([base, other])!
    const r2 = resolveVersions([other, base])!
    expect(r1.frontierVv).toEqual(r2.frontierVv)
    expect(r1.winner.vv).toEqual(r2.winner.vv)
  })

  it("#5 從舊備份還原後再寫：以時間戳記作為計數，不會被他人的版本誤判為看過", () => {
    const a = new Device("d_AAAAAAAA", () => 1)
    const b = new Device("d_BBBBBBBB", () => 2)
    const r0 = a.resolved(ID)
    const vx1: NoteRecord = { ...a.write(ID, { body: "第一版" }), vv: nextVv(r0, "d_AAAAAAAA", 1000) }
    a.known.set(ID, [vx1])
    const vx2: NoteRecord = { ...vx1, body: "X", hlc: a.clock.tick(), vv: nextVv(a.resolved(ID), "d_AAAAAAAA", 2000) }
    a.learn(vx2)
    b.syncFrom(a)
    const vb = b.write(ID, { body: "B 從 X 改" })
    // A 還原到只有第一版的備份，之後寫 Y（時間已經往前走）
    const restored = new Device("d_AAAAAAAA", () => 1)
    restored.learn(vx1)
    const vy: NoteRecord = { ...vx1, body: "Y", hlc: restored.clock.tick(), vv: nextVv(restored.resolved(ID), "d_AAAAAAAA", 3000) }
    const r = resolveVersions([vx1, vx2, vb, vy])!
    expect([r.winner, ...r.conflicts].map((x) => x.body).sort()).toEqual(["B 從 X 改", "Y"].sort())
  })

  it("#1 本機分片同 id 有舊版與墓碑（防呆）：不會只移除墓碑而讓舊版復活", () => {
    const a = new Device("d_AAAAAAAA", () => 1)
    const v1 = a.write(ID, { body: "原文" })
    const t2 = a.write(ID, { deleted: true, updatedAt: "2025-01-01T00:00:00.000Z" })
    const kept = pruneOwn([v1, t2], [], Date.parse("2027-01-01T00:00:00.000Z"))
    expect(kept).toEqual([t2])
  })

  it("#2 長期離線裝置的版本仍在雲端分片時，墓碑不會被回收", () => {
    const c = new Device("d_CCCCCCCC", () => 1)
    const b = new Device("d_BBBBBBBB", () => 2)
    const vc = c.write(ID, { body: "C 寫的原文" }) // 保存在 C 的雲端分片
    b.syncFrom(c)
    const tomb = b.write(ID, { deleted: true, updatedAt: "2025-01-01T00:00:00.000Z" })
    expect(pruneOwn([tomb], [vc], Date.parse("2027-06-01T00:00:00.000Z"))).toEqual([tomb])
  })
})

// ---------- 隨機模擬：收斂性與「同時修改不被默默丟掉」 ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function snapshot(results: Map<string, Resolved>) {
  return [...results.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, r]) => ({
      id,
      winner: r.winner.hlc,
      body: r.winner.body,
      deleted: r.winner.deleted,
      frontierVv: Object.entries(r.frontierVv).sort(),
      conflicts: r.conflicts.map((c) => `${c.hlc}|${c.body}|${c.deleted}`).sort(),
    }))
}

describe("隨機模擬（300 組種子）", () => {
  it("所有裝置交換完資料後結果完全一致；沒看過彼此的版本永遠不會互相取代", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rand = mulberry32(seed)
      const clocks = [0, 0, 0]
      // 各裝置時鐘偏差不同，最多差 50
      const skew = [0, Math.floor(rand() * 50), -Math.floor(rand() * 50)]
      const devices = ["d_AAAAAAAA", "d_BBBBBBBB", "d_CCCCCCCC"].map(
        (id, i) => new Device(id, () => clocks[i] + skew[i]),
      )
      const ids = ["n_01JA8Z6Q3K9V7M2T4R5S6Y8X0A", "n_01JA8Z6Q3K9V7M2T4R5S6Y8X0B"]
      // 建立當下各版本「看過哪些版本」（真實因果）
      const knownAtCreation = new Map<string, Set<string>>()

      for (let step = 0; step < 40; step++) {
        const d = Math.floor(rand() * 3)
        clocks[d] += 1 + Math.floor(rand() * 5)
        const dev = devices[d]
        const op = rand()
        if (op < 0.55) {
          const id = ids[Math.floor(rand() * ids.length)]
          const seen = new Set((dev.known.get(id) ?? []).map((v) => v.hlc))
          const deleted = rand() < 0.1
          const v = dev.write(id, { body: `${dev.id}-${step}`, deleted })
          knownAtCreation.set(v.hlc, seen)
        } else {
          const other = devices[(d + 1 + Math.floor(rand() * 2)) % 3]
          dev.syncFrom(other)
        }
      }
      // 全部交換
      for (const x of devices) for (const y of devices) x.syncFrom(y)
      for (const x of devices) for (const y of devices) x.syncFrom(y)

      const all = (dev: Device) => [...dev.known.values()].flat()
      const snaps = devices.map((dev) => JSON.stringify(snapshot(resolveAll(all(dev)))))
      expect(snaps[1], `seed ${seed}`).toBe(snaps[0])
      expect(snaps[2], `seed ${seed}`).toBe(snaps[0])

      // 交換順序不同，結果也相同
      const versions = all(devices[0])
      const shuffled = [...versions].sort(() => rand() - 0.5)
      expect(JSON.stringify(snapshot(resolveAll(shuffled))), `seed ${seed}`).toBe(snaps[0])

      // 因果正確：看過 → 被取代；沒看過彼此 → 互不取代
      for (const a of versions) {
        for (const b of versions) {
          if (a.id !== b.id || a.hlc === b.hlc) continue
          const bSawA = knownAtCreation.get(b.hlc)?.has(a.hlc) ?? false
          const aSawB = knownAtCreation.get(a.hlc)?.has(b.hlc) ?? false
          if (bSawA) expect(vvDominatedBy(a.vv, b.vv), `seed ${seed}`).toBe(true)
          if (!bSawA && !aSawB) {
            // 可能透過第三個版本間接看過；只有在完全沒有間接因果時才要求互不取代
            const indirect = [...(knownAtCreation.get(b.hlc) ?? [])].some((h) => knownAtCreation.get(h)?.has(a.hlc))
            if (!indirect) expect(vvDominatedBy(a.vv, b.vv), `seed ${seed}`).toBe(false)
          }
        }
      }
    }
  })
})

// ---------- 修剪 ----------

describe("pruneOwn", () => {
  const now = Date.parse("2027-12-01T00:00:00.000Z")

  it("被遠端版本取代的本機版本會被移除，未被取代的保留", () => {
    const a = new Device("d_AAAAAAAA", () => 1)
    const b = new Device("d_BBBBBBBB", () => 2)
    const va = a.write(ID, { body: "A" })
    b.syncFrom(a)
    const vb = b.write(ID, { body: "B 看過後改" })
    expect(pruneOwn([va], [vb], now)).toEqual([])
    expect(pruneOwn([vb], [va], now)).toEqual([vb])
  })

  it("墓碑：遠端還有同 id 版本時保留；遠端已無且超過期限才移除", () => {
    const a = new Device("d_AAAAAAAA", () => 1)
    const b = new Device("d_BBBBBBBB", () => 2)
    const va = a.write(ID, { body: "A" })
    b.syncFrom(a)
    const tomb = b.write(ID, { deleted: true, updatedAt: "2026-10-18T00:00:00.000Z" })
    expect(pruneOwn([tomb], [va], now)).toEqual([tomb])
    expect(pruneOwn([tomb], [], now)).toEqual([])
    expect(pruneOwn([tomb], [], Date.parse("2026-11-01T00:00:00.000Z"))).toEqual([tomb])
  })
})
