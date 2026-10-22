import { describe, expect, it } from "vitest"
import { buildCatalog } from "../../../quartz/util/bookCatalog"
import { EMPTY_READING, recordReading, type ReadingState } from "../../../quartz/util/readingPosition"
import { RECENT_LINK_COUNT, buildResumeView } from "../src/lib/resumeView"

const catalog = buildCatalog([
  "01-創世記/第1章",
  "01-創世記/第5章",
  "01-創世記/全書目錄及綱要",
  "02-出埃及記/第12章",
  "04-民數記/第3章",
  "04-民數記/全書目錄及綱要",
  "05-申命記/全書目錄及綱要",
])
const now = new Date(2026, 9, 22, 15, 0).getTime()
const day = 86_400_000

function stateOf(...updates: Array<[string, number, number]>): ReadingState {
  return updates.reduce((state, [slug, ratio, t]) => recordReading(state, { slug, ratio, t }), EMPTY_READING)
}

describe("buildResumeView", () => {
  it("沒有紀錄就沒有卡片", () => {
    expect(buildResumeView(EMPTY_READING, catalog, now)).toBeNull()
  })

  it("最近一筆是大卡，其後最多 2 筆是小連結，文案照定稿", () => {
    const state = stateOf(
      ["01-創世記/第5章", 0.2, now - 3 * day],
      ["04-民數記/第3章", 0.9, now - 2 * day],
      ["02-出埃及記/第12章", 0.5, now - day],
    )
    const view = buildResumeView(state, catalog, now)!
    expect(view.main.title).toBe("出埃及記 第 12 章")
    expect(view.main.meta).toBe("上次讀到這一章的中段 · 昨天")
    expect(view.main.ariaLabel).toBe("繼續閱讀出埃及記第 12 章")
    expect(view.main.slug).toBe("02-出埃及記/第12章")
    expect(view.main.ratio).toBe(0.5)
    expect(view.main.restoreScroll).toBe(true)
    expect(view.recent.map((r) => r.label)).toEqual(["民數記 第 3 章", "創世記 第 5 章"])
    expect(view.recent).toHaveLength(RECENT_LINK_COUNT)
  })

  it("章已不存在時退回全書目錄，不還原捲動、文案不說「這一章」", () => {
    const state = stateOf(["02-出埃及記/第40章", 0.5, now - 1000])
    const view = buildResumeView(state, buildCatalog(["02-出埃及記/全書目錄及綱要"]), now)!
    expect(view.main.slug).toBe("02-出埃及記/全書目錄及綱要")
    expect(view.main.title).toBe("出埃及記")
    expect(view.main.meta).toBe("上次讀過這一卷 · 剛剛")
    expect(view.main.ariaLabel).toBe("繼續閱讀出埃及記")
    expect(view.main.restoreScroll).toBe(false)
  })

  it("整卷都沒有頁面就不顯示那一筆", () => {
    const state = stateOf(["02-出埃及記/第12章", 0.5, now - 1000])
    expect(buildResumeView(state, buildCatalog([]), now)).toBeNull()
  })
})
