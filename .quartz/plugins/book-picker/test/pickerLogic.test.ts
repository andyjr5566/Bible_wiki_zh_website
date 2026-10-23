import { describe, expect, it } from "vitest"
import { BIBLE_BOOKS } from "../../../quartz/util/bibleBooks"
import { buildCatalog } from "../../../quartz/util/bookCatalog"
import {
  bookLinkSlug,
  currentBookOf,
  defaultTestament,
  isBookOpen,
  lockedMessage,
  openBooksSummary,
  pickerMode,
  relativeHref,
  scrollTopToReveal,
  testamentOf,
} from "../src/lib/pickerLogic"

const book = (name: string) => BIBLE_BOOKS.find((b) => b.name === name)!

/** 用資料夾名＋章號組出 slug 清單，模擬建置時的 allFiles。 */
function slugsFor(...items: Array<[string, number[], { toc?: boolean; intro?: boolean }?]>): string[] {
  const slugs: string[] = []
  for (const [name, chapters, extra] of items) {
    const b = book(name)
    const folder = String(b.num).padStart(2, "0") + "-" + b.name
    for (const n of chapters) slugs.push(`${folder}/第${n}章`)
    if (extra?.toc) slugs.push(`${folder}/全書目錄及綱要`)
    if (extra?.intro) slugs.push(`${folder}/書卷導論`)
  }
  return slugs
}

describe("pickerMode", () => {
  it("章節頁、全書目錄、書卷導論是 book", () => {
    expect(pickerMode("02-出埃及記/第12章")).toBe("book")
    expect(pickerMode("02-出埃及記/全書目錄及綱要")).toBe("book")
    expect(pickerMode("02-出埃及記/書卷導論")).toBe("book")
  })
  it("首頁是 home，其他頁是 other", () => {
    expect(pickerMode("index")).toBe("home")
    expect(pickerMode("link_folder/亞伯拉罕")).toBe("other")
    expect(pickerMode("my-notes")).toBe("other")
    // 章號超過本卷章數、或不是書卷的資料夾，都不算書卷頁
    expect(pickerMode("02-出埃及記/第99章")).toBe("other")
  })
})

describe("defaultTestament", () => {
  it("目前書卷優先，其次是最近讀的，都沒有就舊約", () => {
    expect(defaultTestament(book("馬太福音"), book("創世記"))).toBe("nt")
    expect(defaultTestament(undefined, book("羅馬書"))).toBe("nt")
    expect(defaultTestament(undefined, undefined)).toBe("ot")
    expect(defaultTestament(book("創世記"), book("羅馬書"))).toBe("ot")
  })
  it("testamentOf 對 66 卷都有答案，且 39／27", () => {
    const counts = { ot: 0, nt: 0 }
    for (const b of BIBLE_BOOKS) counts[testamentOf(b)]++
    expect(counts).toEqual({ ot: 39, nt: 27 })
  })
})

describe("currentBookOf", () => {
  it("書卷頁回傳書卷，其他回傳 undefined", () => {
    expect(currentBookOf("01-創世記/第1章")?.name).toBe("創世記")
    expect(currentBookOf("index")).toBeUndefined()
  })
})

describe("openBooksSummary / lockedMessage", () => {
  it("連續的書卷合成「到」", () => {
    const catalog = buildCatalog(
      slugsFor(["創世記", [1]], ["出埃及記", [1]], ["利未記", [1]], ["民數記", [1]], ["申命記", [1]], ["約書亞記", [1]]),
    )
    expect(openBooksSummary(catalog)).toBe("創世記到約書亞記")
    expect(lockedMessage("士師記", openBooksSummary(catalog))).toBe(
      "士師記的研讀頁還在整理中，目前已開放創世記到約書亞記。",
    )
  })
  it("不連續就分段列出，單卷不加「到」", () => {
    const catalog = buildCatalog(slugsFor(["創世記", [1]], ["利未記", [1]], ["民數記", [1]], ["馬太福音", [1]]))
    expect(openBooksSummary(catalog)).toBe("創世記、利未記到民數記、馬太福音")
  })
  it("只有全書目錄的書卷也算開放", () => {
    const catalog = buildCatalog(slugsFor(["創世記", [1]], ["出埃及記", [], { toc: true }]))
    expect(openBooksSummary(catalog)).toBe("創世記到出埃及記")
  })
  it("沒有任何開放書卷時不說「已開放」", () => {
    expect(lockedMessage("士師記", openBooksSummary(buildCatalog([])))).toBe(
      "士師記的研讀頁還在整理中，會陸續開放。",
    )
  })
})

describe("isBookOpen / bookLinkSlug", () => {
  it("有全書目錄就去目錄，沒有就去第一章，只有導論就去導論，什麼都沒有回傳 undefined", () => {
    const catalog = buildCatalog(
      slugsFor(["創世記", [2, 3], { toc: true }], ["出埃及記", [5, 7]], ["利未記", [], { intro: true }]),
    )
    const byName = (name: string) => catalog.find((e) => e.book.name === name)!
    expect(bookLinkSlug(byName("創世記"))).toBe("01-創世記/全書目錄及綱要")
    expect(bookLinkSlug(byName("出埃及記"))).toBe("02-出埃及記/第5章")
    expect(bookLinkSlug(byName("利未記"))).toBe("03-利未記/書卷導論")
    expect(bookLinkSlug(byName("民數記"))).toBeUndefined()
    expect(isBookOpen(byName("民數記"))).toBe(false)
    expect(isBookOpen(byName("利未記"))).toBe(true)
  })
})

describe("relativeHref", () => {
  it("依目前頁的資料夾深度往上", () => {
    expect(relativeHref("index", "01-創世記/第1章")).toBe("./01-創世記/第1章")
    expect(relativeHref("02-出埃及記/第12章", "01-創世記/第1章")).toBe("../01-創世記/第1章")
    expect(relativeHref("a/b/c", "x/y")).toBe("../../x/y")
  })
})

describe("scrollTopToReveal", () => {
  it("已經在可視範圍就不動", () => {
    expect(scrollTopToReveal(0, 300, 100, 34, 1000)).toBe(0)
  })
  it("在下方看不到時捲到中間", () => {
    expect(scrollTopToReveal(0, 300, 800, 34, 1000)).toBe(800 - (300 - 34) / 2)
  })
  it("不會捲過內容尾端或低於 0", () => {
    expect(scrollTopToReveal(0, 300, 990, 34, 1000)).toBe(700)
    expect(scrollTopToReveal(500, 300, 10, 34, 1000)).toBe(0)
  })
})
