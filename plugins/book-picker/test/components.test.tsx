// @vitest-environment jsdom
import { render } from "preact"
import { describe, expect, it } from "vitest"
import { BIBLE_BOOKS } from "../../../quartz/util/bibleBooks"
import { buildCatalog } from "../../../quartz/util/bookCatalog"
import { BookGrid } from "../src/components/BookGrid"
import { ChapterGrid } from "../src/components/ChapterGrid"

const folder = (name: string) => {
  const b = BIBLE_BOOKS.find((x) => x.name === name)!
  return String(b.num).padStart(2, "0") + "-" + b.name
}

// 創世記有 1、2、4 章（缺 3）和全書目錄；其餘書卷沒有頁面
const catalog = buildCatalog([
  `${folder("創世記")}/第1章`,
  `${folder("創世記")}/第2章`,
  `${folder("創世記")}/第4章`,
  `${folder("創世記")}/全書目錄及綱要`,
])

function mount(node: preact.VNode): HTMLElement {
  const host = document.createElement("div")
  render(node, host)
  return host
}

describe("BookGrid", () => {
  const host = mount(
    <BookGrid catalog={catalog} fromSlug="link_folder/亞伯拉罕" idPrefix="t" currentBookNum={1} defaultTestament="ot" />,
  )

  it("66 卷都出現，分成 8 組小標與兩個分頁", () => {
    expect(host.querySelectorAll(".bwz-bg-book")).toHaveLength(66)
    expect(host.querySelectorAll(".bwz-bg-gh")).toHaveLength(8)
    const tabs = Array.from(host.querySelectorAll("[role=tab]"))
    expect(tabs.map((t) => t.textContent)).toEqual(["舊約 39 卷", "新約 27 卷"])
    expect(tabs[0].getAttribute("aria-selected")).toBe("true")
    expect(host.querySelector("#t-panel-nt")?.hasAttribute("hidden")).toBe(true)
    expect(host.querySelector("#t-panel-ot")?.hasAttribute("hidden")).toBe(false)
  })

  it("開放的書卷是連結（相對連結，目前這卷 aria-current），灰色書卷是 aria-disabled 按鈕", () => {
    const gen = host.querySelector("a.bwz-bg-book")!
    expect(gen.getAttribute("href")).toBe("../01-創世記/全書目錄及綱要")
    expect(gen.getAttribute("aria-current")).toBe("true")
    expect(host.querySelectorAll("a.bwz-bg-book")).toHaveLength(1)
    const locked = host.querySelectorAll("button.bwz-bg-book.is-locked[aria-disabled=true]")
    expect(locked).toHaveLength(65)
    expect(locked[0].getAttribute("data-book")).toBe("出埃及記")
  })

  it("開放書卷摘要放在根節點，供用戶端組提示句", () => {
    expect(host.querySelector(".bwz-bookgrid")?.getAttribute("data-open-summary")).toBe("創世記")
  })

  it("有目前書卷時不啟用依閱讀紀錄改選分頁；沒有才啟用", () => {
    expect(host.querySelector(".bwz-bookgrid")?.hasAttribute("data-auto-tab")).toBe(false)
    const other = mount(<BookGrid catalog={catalog} fromSlug="index" idPrefix="u" layout="grid" />)
    expect(other.querySelector(".bwz-bookgrid")?.getAttribute("data-auto-tab")).toBe("true")
    expect(other.querySelector(".bwz-bookgrid--grid")).not.toBeNull()
  })

  it("defaultTestament 為新約時，新約分頁是選取的", () => {
    const nt = mount(<BookGrid catalog={catalog} fromSlug="index" idPrefix="n" defaultTestament="nt" />)
    expect(nt.querySelector("#n-tab-nt")?.getAttribute("aria-selected")).toBe("true")
    expect(nt.querySelector("#n-panel-ot")?.hasAttribute("hidden")).toBe(true)
  })
})

describe("ChapterGrid", () => {
  const entry = catalog.find((e) => e.book.name === "創世記")!
  const host = mount(<ChapterGrid entry={entry} fromSlug="01-創世記/第2章" currentChapter={2} />)

  it("列出整卷 50 章：有的是連結、缺號灰掉", () => {
    expect(host.querySelectorAll("li")).toHaveLength(50)
    expect(host.querySelectorAll("a.bwz-ch")).toHaveLength(3)
    expect(host.querySelectorAll(".bwz-ch.is-missing")).toHaveLength(47)
    expect(host.querySelector(".is-missing")?.textContent).toBe("3（尚未開放）")
  })

  it("目前章 aria-current=page，螢幕閱讀器念「第 2 章（目前這一章）」", () => {
    const current = host.querySelector("a[aria-current=page]")!
    expect(current.textContent).toBe("2")
    expect(current.getAttribute("aria-label")).toBe("第 2 章（目前這一章）")
    expect(host.querySelector("a[href$='第4章']")?.getAttribute("aria-label")).toBe("第 4 章")
    expect(current.getAttribute("href")).toBe("../01-創世記/第2章")
  })
})
