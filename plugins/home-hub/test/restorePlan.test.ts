import { describe, expect, it } from "vitest"
import { RESTORE_MAX_MS, RESTORE_STABLE_MS, restoreAction, type RestoreTick } from "../src/lib/restorePlan"

const base: RestoreTick = { now: 1000, startedAt: 1000, height: 5000, lastHeight: undefined, lastChangeAt: 1000 }

describe("restoreAction", () => {
  it("第一輪一定要捲", () => {
    expect(restoreAction(base)).toBe("apply")
  })
  it("高度變了就再捲一次", () => {
    expect(restoreAction({ ...base, now: 1200, height: 4000, lastHeight: 5000 })).toBe("apply")
  })
  it("高度沒變但還沒穩定夠久就等", () => {
    expect(restoreAction({ ...base, now: 1000 + RESTORE_STABLE_MS - 1, lastHeight: 5000, lastChangeAt: 1000 })).toBe("wait")
  })
  it("高度穩定夠久就收手", () => {
    expect(restoreAction({ ...base, now: 1000 + RESTORE_STABLE_MS, lastHeight: 5000, lastChangeAt: 1000 })).toBe("done")
  })
  it("超過上限一律收手，即使高度還在變", () => {
    expect(restoreAction({ ...base, now: 1000 + RESTORE_MAX_MS, height: 4000, lastHeight: 5000 })).toBe("done")
  })
})
