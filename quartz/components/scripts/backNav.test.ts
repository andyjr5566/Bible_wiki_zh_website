import test, { describe } from "node:test"
import assert from "node:assert"
import {
  freshHistory,
  syncHistory,
  pushEntry,
  stepsToPreviousPage,
  stripOrderPrefix,
  parentOf,
  decideBack,
  pagePath,
  type NavHistory,
} from "./backNav"

const INDEX: Record<string, string> = {
  index: "index",
  "01-創世記/index": "01 創世記",
  "01-創世記/第1章": "第1章",
  "link_folder/index": "知識節點",
  "link_folder/人物/index": "人物",
  "link_folder/人物/大衛王": "大衛王",
  readme: "本站簡介",
}

describe("pagePath", () => {
  test("去掉錨點與查詢字串", () => {
    assert.strictEqual(pagePath("/a/b#x"), "/a/b")
    assert.strictEqual(pagePath("/a/b?q=1#x"), "/a/b")
  })
})

describe("歷史堆疊", () => {
  test("一路點進來：A → B → C，上一頁是 B（1 步）", () => {
    let h = freshHistory("/A")
    h = pushEntry(h, "/B")
    h = pushEntry(h, "/C")
    assert.strictEqual(stepsToPreviousPage(h), 1)
  })

  test("剛進站沒有上一頁", () => {
    assert.strictEqual(stepsToPreviousPage(freshHistory("/A")), null)
  })

  test("同頁錨點不算換頁：A → B → B#x → B#y，退 3 步回到 A（退 1 步只會到 B#x）", () => {
    let h = freshHistory("/A")
    h = pushEntry(h, "/B")
    h = pushEntry(h, "/B#x")
    h = pushEntry(h, "/B#y")
    assert.strictEqual(stepsToPreviousPage(h), 3)
  })

  test("上一頁自己有錨點：A → A#x → B，落在 A#x（讀者離開時的位置）", () => {
    let h = freshHistory("/A")
    h = pushEntry(h, "/A#x")
    h = pushEntry(h, "/B")
    assert.strictEqual(stepsToPreviousPage(h), 1)
  })

  test("只有同頁錨點（A → A#x）沒有上一頁", () => {
    const h = pushEntry(freshHistory("/A"), "/A#x")
    assert.strictEqual(stepsToPreviousPage(h), null)
  })

  test("返回之後再前進新頁會捨棄前進那一半", () => {
    let h = freshHistory("/A")
    h = pushEntry(h, "/B")
    h = pushEntry(h, "/C")
    h = { ...h, pos: 1 } // 返回到 B
    h = pushEntry(h, "/D")
    assert.deepStrictEqual(h, { entries: ["/A", "/B", "/D"], pos: 2 })
    assert.strictEqual(stepsToPreviousPage(h), 1)
  })

  test("A → B → A（回到先前看過的頁）上一頁是 B", () => {
    let h = freshHistory("/A")
    h = pushEntry(h, "/B")
    h = pushEntry(h, "/A")
    assert.strictEqual(stepsToPreviousPage(h), 1)
  })
})

describe("syncHistory", () => {
  const saved: NavHistory = { entries: ["/A", "/B", "/C"], pos: 2 }

  test("重新整理：位置與頁面都對得上就沿用", () => {
    assert.deepStrictEqual(syncHistory(saved, 2, "/C"), saved)
  })

  test("返回：瀏覽器位置變 1，沿用記錄並移動位置", () => {
    assert.deepStrictEqual(syncHistory(saved, 1, "/B"), { entries: saved.entries, pos: 1 })
  })

  test("外部進入（歷史項目沒有我們的位置）重開", () => {
    assert.deepStrictEqual(syncHistory(saved, undefined, "/X"), freshHistory("/X"))
  })

  test("沒有記錄（新分頁、sessionStorage 清掉）重開", () => {
    assert.deepStrictEqual(syncHistory(null, 3, "/C"), freshHistory("/C"))
  })

  test("位置超出範圍或該格頁面對不上，重開", () => {
    assert.deepStrictEqual(syncHistory(saved, 9, "/C"), freshHistory("/C"))
    assert.deepStrictEqual(syncHistory(saved, 1, "/C"), freshHistory("/C"))
    assert.deepStrictEqual(syncHistory(saved, -1, "/C"), freshHistory("/C"))
    assert.deepStrictEqual(syncHistory(saved, 1.5, "/B"), freshHistory("/B"))
  })

  test("錨點不影響對照", () => {
    assert.deepStrictEqual(syncHistory(saved, 2, "/C#v3"), saved)
  })
})

describe("stripOrderPrefix", () => {
  test("去掉數字前綴", () => {
    assert.strictEqual(stripOrderPrefix("01 創世記"), "創世記")
    assert.strictEqual(stripOrderPrefix("01-創世記"), "創世記")
    assert.strictEqual(stripOrderPrefix("知識節點"), "知識節點")
  })
  test("去完是空的就維持原樣；章名不被誤砍", () => {
    assert.strictEqual(stripOrderPrefix("12"), "12")
    assert.strictEqual(stripOrderPrefix("第1章"), "第1章")
  })
})

describe("parentOf", () => {
  test("章節頁 → 書卷資料夾頁，標題去掉前綴", () => {
    assert.deepStrictEqual(parentOf("01-創世記/第1章", INDEX), {
      slug: "01-創世記/index",
      title: "創世記",
    })
  })
  test("條目頁 → 它的資料夾頁", () => {
    assert.deepStrictEqual(parentOf("link_folder/人物/大衛王", INDEX), {
      slug: "link_folder/人物/index",
      title: "人物",
    })
  })
  test("資料夾頁 → 再上一層", () => {
    assert.deepStrictEqual(parentOf("link_folder/人物/index", INDEX), {
      slug: "link_folder/index",
      title: "知識節點",
    })
  })
  test("中間層沒有頁面就跳過，找最近真的存在的", () => {
    assert.deepStrictEqual(parentOf("link_folder/地點/聖殿/某條目", INDEX), {
      slug: "link_folder/index",
      title: "知識節點",
    })
  })
  test("最上層檔案 → 首頁；首頁沒有上層", () => {
    assert.deepStrictEqual(parentOf("readme", INDEX), { slug: "index", title: "首頁" })
    assert.strictEqual(parentOf("index", INDEX), null)
  })
  test("上層頁面都不存在就回傳 null", () => {
    assert.strictEqual(parentOf("a/b", {}), null)
  })
  test("資料夾頁標題缺漏時退回資料夾名", () => {
    assert.deepStrictEqual(parentOf("02-出埃及記/第1章", { "02-出埃及記/index": "" }), {
      slug: "02-出埃及記/index",
      title: "出埃及記",
    })
  })
})

describe("decideBack", () => {
  test("首頁不顯示", () => {
    assert.strictEqual(decideBack("index", pushEntry(freshHistory("/x"), "/"), INDEX), null)
  })
  test("有站內上一頁：A", () => {
    const h = pushEntry(freshHistory("/"), "/01-創世記/第1章")
    assert.deepStrictEqual(decideBack("01-創世記/第1章", h, INDEX), { kind: "history", steps: 1 })
  })
  test("沒有站內上一頁：B", () => {
    assert.deepStrictEqual(decideBack("01-創世記/第1章", freshHistory("/x"), INDEX), {
      kind: "parent",
      slug: "01-創世記/index",
      title: "創世記",
    })
  })
  test("兩者都沒有：不顯示", () => {
    assert.strictEqual(decideBack("a/b", freshHistory("/a/b"), {}), null)
  })
})
