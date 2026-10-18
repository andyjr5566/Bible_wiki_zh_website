import { describe, expect, it } from "vitest"
import { BOOKS, chapterSlug, isValidShard, parseChapterSlug } from "../src/client/model/books"
import { DEVICE_ID_PATTERN, NOTE_ID_PATTERN, newDeviceId, newNoteId, ulid } from "../src/client/model/ids"
import { HlcClock, compareHlc, formatHlc, parseHlc } from "../src/client/model/hlc"
import { vvDominatedBy, vvEquals, vvIncrement, vvLeq, vvMax } from "../src/client/model/vv"
import {
  SCHEMA_VERSION,
  chapterAnchor,
  extractLinks,
  shardOf,
  validateRecord,
  validateShard,
  type NoteRecord,
} from "../src/client/model/record"

function sampleRecord(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: newNoteId(),
    type: "note",
    anchor: chapterAnchor("GEN", 10, 5, 7),
    title: "列國",
    body: "看 [[寧錄]] 與 [[巴別|巴別塔]]",
    tags: ["列國表"],
    links: ["寧錄", "巴別"],
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    hlc: formatHlc({ wall: 1760745600000, counter: 0, device: "d_AAAAAAAA" }),
    vv: { d_AAAAAAAA: 1 },
    author: "d_AAAAAAAA",
    deleted: false,
    ...overrides,
  }
}

describe("books", () => {
  it("有 66 卷、合計 1189 章、代碼不重複", () => {
    expect(BOOKS).toHaveLength(66)
    expect(BOOKS.reduce((s, b) => s + b.chapters, 0)).toBe(1189)
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(66)
  })

  it("解析章節頁 slug（含編碼過的網址）", () => {
    expect(parseChapterSlug("01-創世記/第10章")).toMatchObject({ book: { code: "GEN" }, chapter: 10 })
    expect(parseChapterSlug(encodeURI("02-出埃及記/第12章"))).toMatchObject({ book: { code: "EXO" }, chapter: 12 })
    // 只看編號，不看名稱（content 仍在建置，名稱可能改）
    expect(parseChapterSlug("01-Genesis/第1章")).toMatchObject({ book: { code: "GEN" }, chapter: 1 })
  })

  it("認不出或超出章數時回傳 null", () => {
    expect(parseChapterSlug("01-創世記/第51章")).toBeNull()
    expect(parseChapterSlug("01-創世記/第0章")).toBeNull()
    expect(parseChapterSlug("01-創世記/全書目錄及綱要")).toBeNull()
    expect(parseChapterSlug("link_folder/人物/挪亞")).toBeNull()
    expect(parseChapterSlug("67-不存在/第1章")).toBeNull()
    expect(parseChapterSlug("%E0%A4%A")).toBeNull()
  })

  it("代碼與章 → slug", () => {
    expect(chapterSlug("GEN", 10)).toBe("01-創世記/第10章")
    expect(chapterSlug("REV", 23)).toBeNull()
    expect(isValidShard("MRK")).toBe(true)
    expect(isValidShard("_NODE")).toBe(true)
    expect(isValidShard("XYZ")).toBe(false)
  })
})

describe("ids", () => {
  it("格式正確且可依時間排序", () => {
    expect(newNoteId()).toMatch(NOTE_ID_PATTERN)
    expect(newDeviceId()).toMatch(DEVICE_ID_PATTERN)
    expect(ulid(1000) < ulid(2000)).toBe(true)
    const ids = new Set(Array.from({ length: 2000 }, () => newNoteId(5)))
    expect(ids.size).toBe(2000)
  })
})

describe("hlc", () => {
  it("同一毫秒內遞增 counter，且字串比較符合時間順序", () => {
    const clock = new HlcClock("d_AAAAAAAA", null, () => 1000)
    const a = clock.tick()
    const b = clock.tick()
    expect(compareHlc(a, b)).toBe(-1)
    expect(parseHlc(b)).toEqual({ wall: 1000, counter: 1, device: "d_AAAAAAAA" })
  })

  it("本機時鐘落後時，觀察到遠端後產生的時間仍更大", () => {
    const remote = formatHlc({ wall: 9_000_000, counter: 3, device: "d_BBBBBBBB" })
    const clock = new HlcClock("d_AAAAAAAA", null, () => 1000)
    clock.observe(remote)
    expect(compareHlc(clock.tick(), remote)).toBe(1)
  })

  it("counter 用完時推進 wall", () => {
    const clock = new HlcClock("d_AAAAAAAA", formatHlc({ wall: 5, counter: 9999, device: "d_AAAAAAAA" }), () => 1)
    expect(parseHlc(clock.tick())).toMatchObject({ wall: 6, counter: 0 })
  })
})

describe("vv", () => {
  it("比較、支配、最大值、遞增", () => {
    expect(vvLeq({ a: 1 }, { a: 1, b: 1 })).toBe(true)
    expect(vvLeq({ a: 2 }, { a: 1, b: 5 })).toBe(false)
    expect(vvDominatedBy({ a: 1 }, { a: 1, b: 1 })).toBe(true)
    expect(vvDominatedBy({ a: 1 }, { a: 1 })).toBe(false)
    expect(vvEquals({ a: 1, b: 0 }, { a: 1 })).toBe(true)
    expect(vvMax({ a: 2, b: 1 }, { a: 1, c: 3 })).toEqual({ a: 2, b: 1, c: 3 })
    expect(vvIncrement({ a: 1 }, "b")).toEqual({ a: 1, b: 1 })
  })
})

describe("record", () => {
  it("抽出 [[連結]]", () => {
    expect(extractLinks("看 [[寧錄]]、[[巴別|巴別塔]] 與 [[迦南#地界]]、[[寧錄]]")).toEqual(["寧錄", "巴別", "迦南"])
  })

  it("分片鍵", () => {
    expect(shardOf(sampleRecord())).toBe("GEN")
    expect(shardOf({ anchor: { ...chapterAnchor("GEN", 1), book: null, kind: "free" } })).toBe("_FREE")
  })

  it("驗證紀錄：合格者通過、壞資料被擋下、未知欄位保留", () => {
    const ok = sampleRecord({ futureField: { x: 1 } })
    expect(validateRecord(ok)?.futureField).toEqual({ x: 1 })
    expect(validateRecord({ ...ok, id: "bad" })).toBeNull()
    expect(validateRecord({ ...ok, vv: {} })).toBeNull()
    expect(validateRecord({ ...ok, hlc: "nope" })).toBeNull()
    expect(validateRecord({ ...ok, deleted: "no" })).toBeNull()
    expect(validateRecord(null)).toBeNull()
  })

  it("驗證分片：略過壞紀錄、拒絕較新 schema", () => {
    const base = { kind: "shard", app: "bwz-notes", shard: "GEN", device: "d_AAAAAAAA", writtenAt: "x" }
    const v = validateShard({ ...base, schema: SCHEMA_VERSION, records: [sampleRecord(), { junk: true }] })
    expect(v.ok && v.shard.records.length).toBe(1)
    expect(v.ok && v.skipped).toBe(1)
    expect(validateShard({ ...base, schema: SCHEMA_VERSION + 1, records: [] })).toMatchObject({ ok: false, reason: "newer-schema" })
    expect(validateShard({ ...base, app: "other", schema: 1, records: [] })).toMatchObject({ ok: false, reason: "not-shard" })
    expect(validateShard("text")).toMatchObject({ ok: false })
  })
})
