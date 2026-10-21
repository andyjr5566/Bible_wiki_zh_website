import test, { describe } from "node:test"
import assert from "node:assert"
import { OpeningGateInput, shouldShowOpening } from "./openingGate"

const now = 1_700_000_000_000
const hour = 60 * 60 * 1000

const decide = (input: Partial<OpeningGateInput> = {}) =>
  shouldShowOpening({
    now,
    lastSeen: null,
    search: "",
    standalone: false,
    ...input,
  })

describe("shouldShowOpening", () => {
  test("第一次來時轉到序幕並標記", () => {
    assert.deepEqual(decide(), {
      redirect: true,
      forceIntro: false,
      markSeen: true,
    })
  })

  test("一小時內從新分頁再來時不轉址", () => {
    assert.deepEqual(decide({ lastSeen: String(now - hour) }), {
      redirect: false,
      forceIntro: false,
      markSeen: false,
    })
  })

  test("超過 24 小時後轉到序幕並標記", () => {
    assert.deepEqual(decide({ lastSeen: String(now - 25 * hour) }), {
      redirect: true,
      forceIntro: false,
      markSeen: true,
    })
  })

  test("lastSeen 是垃圾字串時視為無效", () => {
    assert.deepEqual(decide({ lastSeen: "not-a-timestamp" }), {
      redirect: true,
      forceIntro: false,
      markSeen: true,
    })
  })

  test("lastSeen 在未來時視為無效", () => {
    assert.deepEqual(decide({ lastSeen: String(now + hour) }), {
      redirect: true,
      forceIntro: false,
      markSeen: true,
    })
  })

  test("?skip=1 不轉址並標記", () => {
    assert.deepEqual(decide({ search: "?skip=1" }), {
      redirect: false,
      forceIntro: false,
      markSeen: true,
    })
  })

  test("?opening=0 不轉址並標記", () => {
    assert.deepEqual(decide({ search: "?opening=0" }), {
      redirect: false,
      forceIntro: false,
      markSeen: true,
    })
  })

  test("?opening=1 強制轉址並保留序幕參數", () => {
    assert.deepEqual(decide({ search: "?opening=1&source=test" }), {
      redirect: true,
      forceIntro: true,
      markSeen: true,
    })
  })

  test("?intro=1 強制轉址", () => {
    assert.deepEqual(decide({ search: "?intro=1" }), {
      redirect: true,
      forceIntro: true,
      markSeen: true,
    })
  })

  test("主畫面 App 第一次開啟時不轉址也不標記", () => {
    assert.deepEqual(decide({ standalone: true }), {
      redirect: false,
      forceIntro: false,
      markSeen: false,
    })
  })

  test("主畫面 App 超過 24 小時後仍不轉址也不標記", () => {
    assert.deepEqual(
      decide({ lastSeen: String(now - 25 * hour), standalone: true }),
      {
        redirect: false,
        forceIntro: false,
        markSeen: false,
      },
    )
  })
})
