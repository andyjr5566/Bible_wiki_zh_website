import { describe, expect, it } from "vitest"
import {
  DAYS_AGO_BELOW,
  JUST_NOW_MS,
  POSITION_EARLY_BELOW,
  POSITION_MIDDLE_BELOW,
  POSITION_START_BELOW,
  bookDescription,
  chapterDescription,
  positionLabel,
  relativeTime,
} from "../src/lib/resumeText"

// 一律用本機時間組日期，測試才不會因為執行的時區而不同
const at = (m: number, d: number, h = 12, min = 0) => new Date(2026, m - 1, d, h, min).getTime()

describe("positionLabel", () => {
  it("依門檻分成開頭／前段／中段／後段", () => {
    expect(positionLabel(0)).toBe("開頭")
    expect(positionLabel(POSITION_START_BELOW - 0.001)).toBe("開頭")
    expect(positionLabel(POSITION_START_BELOW)).toBe("前段")
    expect(positionLabel(POSITION_EARLY_BELOW - 0.001)).toBe("前段")
    expect(positionLabel(POSITION_EARLY_BELOW)).toBe("中段")
    expect(positionLabel(POSITION_MIDDLE_BELOW - 0.001)).toBe("中段")
    expect(positionLabel(POSITION_MIDDLE_BELOW)).toBe("後段")
    expect(positionLabel(1)).toBe("後段")
  })
  it("壞數字退回開頭", () => {
    expect(positionLabel(Number.NaN)).toBe("開頭")
    expect(positionLabel(-1)).toBe("開頭")
  })
})

describe("relativeTime", () => {
  const now = at(10, 22, 15, 0)
  it("五分鐘內是剛剛，含時鐘比現在還晚的情況", () => {
    expect(relativeTime(now, now)).toBe("剛剛")
    expect(relativeTime(now - JUST_NOW_MS + 1, now)).toBe("剛剛")
    expect(relativeTime(now + 3_600_000, now)).toBe("剛剛")
  })
  it("同一天是今天、前一天是昨天", () => {
    expect(relativeTime(at(10, 22, 9, 0), now)).toBe("今天")
    expect(relativeTime(now - JUST_NOW_MS, now)).toBe("今天")
    expect(relativeTime(at(10, 21, 23, 50), now)).toBe("昨天")
  })
  it("跨午夜只差幾分鐘也算昨天（看日曆不看 24 小時）", () => {
    const early = at(10, 22, 0, 3)
    expect(relativeTime(at(10, 21, 23, 59), early)).toBe("剛剛")
    expect(relativeTime(at(10, 21, 23, 40), early)).toBe("昨天")
  })
  it("二天到未滿一週是 N 天前", () => {
    expect(relativeTime(at(10, 20), now)).toBe("2 天前")
    expect(relativeTime(at(10, 22 - (DAYS_AGO_BELOW - 1)), now)).toBe(`${DAYS_AGO_BELOW - 1} 天前`)
  })
  it("一週以上顯示 M 月 D 日（含跨月、跨年）", () => {
    expect(relativeTime(at(10, 22 - DAYS_AGO_BELOW), now)).toBe("10 月 15 日")
    expect(relativeTime(at(9, 3), now)).toBe("9 月 3 日")
    expect(relativeTime(new Date(2025, 11, 31, 8).getTime(), now)).toBe("12 月 31 日")
  })
  it("t 不是數字時當作剛剛，不丟錯", () => {
    expect(relativeTime(Number.NaN, now)).toBe("剛剛")
  })
})

describe("說明文字", () => {
  const now = at(10, 22, 15, 0)
  it("章節：位置加時間", () => {
    expect(chapterDescription(0.5, at(10, 21, 10), now)).toBe("上次讀到這一章的中段 · 昨天")
  })
  it("退回全書目錄時不說「這一章」", () => {
    expect(bookDescription(at(10, 22, 9), now)).toBe("上次讀過這一卷 · 今天")
  })
})
