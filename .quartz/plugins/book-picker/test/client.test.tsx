// @vitest-environment jsdom
import { render } from "preact"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BIBLE_BOOKS } from "../../../quartz/util/bibleBooks"
import { buildCatalog } from "../../../quartz/util/bookCatalog"
import { READING_STORAGE_KEY } from "../../../quartz/util/readingPosition"
import { BookGrid } from "../src/components/BookGrid"
import { ChapterGrid } from "../src/components/ChapterGrid"
import { initBookGrids } from "../src/lib/client/bookGridBehavior"
import { initChapterEnd } from "../src/lib/client/chapterEnd"
import { initModes, setBooksOpen } from "../src/lib/client/pickerModes"
import { recentReadBook } from "../src/lib/client/readingRecent"

const folder = (name: string) => {
  const b = BIBLE_BOOKS.find((x) => x.name === name)!
  return String(b.num).padStart(2, "0") + "-" + b.name
}
const catalog = buildCatalog([`${folder("創世記")}/第1章`, `${folder("創世記")}/第2章`, `${folder("創世記")}/全書目錄及綱要`])

let cleanup: (() => void) | undefined

beforeEach(() => {
  document.body.innerHTML = ""
  localStorage.clear()
})
afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.useRealTimers()
})

function mountGrid(props: Partial<Parameters<typeof BookGrid>[0]> = {}): HTMLElement {
  const host = document.createElement("div")
  document.body.append(host)
  render(<BookGrid catalog={catalog} fromSlug="index" idPrefix="t" {...props} />, host)
  return host
}

describe("書卷格子行為", () => {
  it("點分頁切換面板；方向鍵與 Home／End 切換並移動焦點", () => {
    const host = mountGrid()
    cleanup = initBookGrids()
    const [ot, nt] = Array.from(host.querySelectorAll<HTMLElement>("[role=tab]"))
    nt.click()
    expect(nt.getAttribute("aria-selected")).toBe("true")
    expect(host.querySelector("#t-panel-ot")?.hasAttribute("hidden")).toBe(true)
    expect(host.querySelector("#t-panel-nt")?.hasAttribute("hidden")).toBe(false)
    nt.focus()
    nt.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
    expect(ot.getAttribute("aria-selected")).toBe("true")
    expect(document.activeElement).toBe(ot)
    ot.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }))
    expect(nt.getAttribute("aria-selected")).toBe("true")
    expect(nt.tabIndex).toBe(0)
    expect(ot.tabIndex).toBe(-1)
  })

  it("沒有目前書卷時依閱讀紀錄選預設的約；紀錄壞掉就維持預設", () => {
    localStorage.setItem(
      READING_STORAGE_KEY,
      JSON.stringify({ v: 1, books: { [folder("羅馬書")]: { slug: `${folder("羅馬書")}/第1章`, ratio: 0.2, t: 5 } } }),
    )
    expect(recentReadBook()?.name).toBe("羅馬書")
    const host = mountGrid()
    cleanup = initBookGrids()
    expect(host.querySelector("#t-tab-nt")?.getAttribute("aria-selected")).toBe("true")

    localStorage.setItem(READING_STORAGE_KEY, "{壞掉")
    expect(recentReadBook()).toBeUndefined()
  })

  it("localStorage 丟例外時退回預設、不丟例外", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(recentReadBook()).toBeUndefined()
    spy.mockRestore()
  })

  it("有目前書卷時不被閱讀紀錄改選", () => {
    localStorage.setItem(
      READING_STORAGE_KEY,
      JSON.stringify({ v: 1, books: { [folder("羅馬書")]: { slug: `${folder("羅馬書")}/第1章`, ratio: 0.2, t: 5 } } }),
    )
    const host = mountGrid({ currentBookNum: 1, defaultTestament: "ot" })
    cleanup = initBookGrids()
    expect(host.querySelector("#t-tab-ot")?.getAttribute("aria-selected")).toBe("true")
  })

  it("灰色書卷有 title，點了出現 role=status 提示並在 3 秒後消失", () => {
    vi.useFakeTimers()
    const host = mountGrid()
    cleanup = initBookGrids()
    const locked = host.querySelector<HTMLElement>(".is-locked")!
    expect(locked.title).toBe("出埃及記的研讀頁還在整理中，目前已開放創世記。")
    locked.click()
    vi.advanceTimersByTime(20)
    // requestAnimationFrame 在假計時器下由 advanceTimers 驅動
    const toast = document.querySelector(".bwz-toast")
    expect(toast?.getAttribute("role")).toBe("status")
    vi.advanceTimersByTime(3100)
    expect(document.querySelector(".bwz-toast")).toBeNull()
  })
})

describe("左欄展開／收起與章末", () => {
  function mountPicker(mode: "book" | "home"): HTMLElement {
    const picker = document.createElement("div")
    picker.className = "bwz-picker"
    picker.dataset.mode = mode
    picker.dataset.kind = "chapter"
    picker.dataset.bookName = "創世記"
    document.body.innerHTML = '<article><p>內文</p></article>'
    document.body.append(picker)
    const entry = catalog.find((e) => e.book.name === "創世記")!
    render(
      <>
        <button class="bwz-pk-switch" aria-expanded="false" />
        <a class="bwz-pk-link" href="../01-創世記/全書目錄及綱要">
          全書目錄及綱要
        </a>
        <div class="bwz-pk-current">
          <ChapterGrid entry={entry} fromSlug="01-創世記/第1章" currentChapter={1} />
        </div>
        <div class="bwz-pk-books" hidden />
      </>,
      picker,
    )
    return picker
  }

  it("按「換卷」展開書卷格子、本卷章號收起，再按一次復原", () => {
    const picker = mountPicker("book")
    cleanup = initModes(picker)
    const books = picker.querySelector<HTMLElement>(".bwz-pk-books")!
    picker.querySelector<HTMLElement>(".bwz-pk-switch")!.click()
    expect(books.hidden).toBe(false)
    expect(picker.classList.contains("is-books-open")).toBe(true)
    expect(picker.querySelector(".bwz-pk-switch")?.getAttribute("aria-expanded")).toBe("true")
    picker.querySelector<HTMLElement>(".bwz-pk-switch")!.click()
    expect(books.hidden).toBe(true)
    expect(picker.classList.contains("is-books-open")).toBe(false)
  })

  it("setBooksOpen 對「其他頁」（本來就展開）不動作", () => {
    const picker = mountPicker("book")
    picker.dataset.mode = "other"
    setBooksOpen(picker, true)
    expect(picker.classList.contains("is-books-open")).toBe(false)
  })

  it("章末加入章號格複本，且不重複加入、不複製 id", () => {
    const picker = mountPicker("book")
    initChapterEnd(picker)
    initChapterEnd(picker)
    const sections = document.querySelectorAll("article > section.bwz-chend")
    expect(sections).toHaveLength(1)
    expect(sections[0].querySelector(".bwz-chend-title")?.textContent).toBe("創世記・本卷章節")
    expect(sections[0].querySelectorAll("a.bwz-ch")).toHaveLength(2)
    expect(sections[0].querySelector(".bwz-chend-change")?.textContent).toBe("換一卷書")
    expect(sections[0].querySelector(".bwz-chend-toc")?.getAttribute("href")).toBe("../01-創世記/全書目錄及綱要")
  })

  it("全書目錄、書卷導論頁（不是章節頁）不加章末", () => {
    const picker = mountPicker("book")
    picker.dataset.kind = "toc"
    initChapterEnd(picker)
    expect(document.querySelector(".bwz-chend")).toBeNull()
  })

  it("章末的「換一卷書」發出 bwz:open-picker（showBooks）", () => {
    const picker = mountPicker("book")
    initChapterEnd(picker)
    const handler = vi.fn()
    document.addEventListener("bwz:open-picker", handler)
    document.querySelector<HTMLElement>(".bwz-chend-change")!.click()
    document.removeEventListener("bwz:open-picker", handler)
    expect(handler).toHaveBeenCalledTimes(1)
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ showBooks: true })
  })
})
