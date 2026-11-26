// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { makeEntryLanding } from "../../../quartz/util/entryLanding"
import { FLASH_CLASS } from "../src/lib/jump"
import { RELATED_CARD_CLASS, startRelatedCard } from "../src/lib/relatedCard"

const chapterSlug = "02-出埃及記/第12章"

function chapterMarkup(): string {
  return `<h3 id="出埃及記">出埃及記</h3>
    <h4 id="第12章-1"><a data-slug="${chapterSlug}" href="../../02-出埃及記/第12章">第12章</a></h4>
    <ul><li id="source-item">本章重點：<strong id="source-strong">逾越節</strong></li>
      <li>與本章關聯：<a class="internal" href="/link_folder/原文/羔羊">羔羊</a></li></ul>`
}

function setPage({
  definition = true,
  converted = false,
  withChapter = true,
}: { definition?: boolean; converted?: boolean; withChapter?: boolean } = {}): void {
  document.body.dataset.slug = "link_folder/原文/在黃昏的時候"
  document.body.innerHTML = `
    <div class="page-header"></div>
    <article class="popover-hint"><div class="markdown-rendered">
      <h1 id="在黃昏的時候">在黃昏的時候</h1>
      ${definition ? `<h2 id="定義">定義</h2><p>第一段定義</p><blockquote>另一段定義</blockquote>` : ""}
      ${
        converted
          ? `<details class="collapsible-section"><summary>按書卷累積 1 卷書</summary>
              <details class="collapsible-subheading"><summary>出埃及記</summary>
                ${withChapter ? chapterMarkup() : ""}
              </details>
            </details>`
          : `<h2 id="按書卷累積">按書卷累積</h2>${withChapter ? chapterMarkup() : ""}`
      }
      <h2 id="主題發展">主題發展</h2>
    </div></article>`
}

function start(): () => void {
  const landing = makeEntryLanding(chapterSlug, "link_folder/原文/在黃昏的時候", Date.now())!
  return startRelatedCard(landing)
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("條目頁的本章摘要卡", () => {
  it("放在定義整段之後、下一個 h2 之前", () => {
    setPage()
    const stop = start()
    const card = document.querySelector<HTMLElement>(`aside.${RELATED_CARD_CLASS}`)!

    expect(card.getAttribute("aria-label")).toBe("本條目在出埃及記第 12 章的重點")
    expect(card.querySelector(".bwz-vr-card-title")?.textContent).toBe("出埃及記 12 章 · 與本條目")
    expect(card.previousElementSibling?.tagName).toBe("BLOCKQUOTE")
    expect(card.nextElementSibling?.id).toBe("按書卷累積")
    stop()
  })

  it("折疊區段已變成 details 時，仍放在 details 之前", () => {
    setPage({ converted: true })
    const stop = start()
    const card = document.querySelector<HTMLElement>(`aside.${RELATED_CARD_CLASS}`)!

    expect(card.previousElementSibling?.tagName).toBe("BLOCKQUOTE")
    expect(card.nextElementSibling?.classList.contains("collapsible-section")).toBe(true)
    stop()
  })

  it("找不到定義時退回標題後", () => {
    setPage({ definition: false })
    const stop = start()
    const card = document.querySelector<HTMLElement>(`aside.${RELATED_CARD_CLASS}`)!

    expect(document.querySelector("h1")?.nextElementSibling).toBe(card)
    stop()
  })

  it("複製 li 的連結與粗體，並移除複製品的 id", () => {
    setPage()
    const stop = start()
    const items = document.querySelectorAll<HTMLLIElement>(".bwz-vr-card-list > li")

    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain("逾越節")
    expect(items[0].querySelector("strong")?.textContent).toBe("逾越節")
    expect(items[1].querySelector("a")?.getAttribute("href")).toBe("/link_folder/原文/羔羊")
    expect(document.querySelectorAll("#source-item")).toHaveLength(1)
    expect(document.querySelectorAll("#source-strong")).toHaveLength(1)
    expect(document.querySelector(".bwz-vr-card-list [id]")).toBeNull()
    stop()
  })

  it("找不到該章 h4 時不插卡片，等到標題出現才插入", async () => {
    setPage({ withChapter: false })
    const stop = start()
    expect(document.querySelector(`aside.${RELATED_CARD_CLASS}`)).toBeNull()

    document.querySelector("#按書卷累積")?.insertAdjacentHTML("afterend", chapterMarkup())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector(`aside.${RELATED_CARD_CLASS}`)).not.toBeNull()
    stop()
  })

  it("只有摘要真的截斷才顯示展開全文，展開後可收起", async () => {
    setPage()
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0))
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id))
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.matches(".bwz-vr-card-list > li") ? 100 : 0
    })
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.matches(".bwz-vr-card-list > li") ? 40 : 0
    })

    const stop = start()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const toggle = document.querySelector<HTMLButtonElement>(".bwz-vr-card-toggle")!

    expect(toggle.hidden).toBe(false)
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    toggle.click()
    expect(toggle.textContent).toBe("收起")
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(document.querySelector(`.${RELATED_CARD_CLASS}`)?.classList.contains("bwz-vr-card-expanded")).toBe(true)
    toggle.click()
    expect(toggle.textContent).toBe("展開全文")
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    stop()
  })

  it("底部按鈕打開所有祖先 details、捲動與標示；cancel 移除卡片", () => {
    setPage({ converted: true })
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }))
    vi.stubGlobal("scrollY", 0)
    vi.stubGlobal("innerHeight", 800)
    const scrollTo = vi.fn()
    vi.stubGlobal("scrollTo", scrollTo)

    const stop = start()
    document.querySelector<HTMLButtonElement>(".bwz-vr-card-jump")!.click()

    const heading = document.querySelector("h4")!
    expect(document.querySelectorAll("details[open]")).toHaveLength(2)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" })
    expect(heading.classList.contains(FLASH_CLASS)).toBe(true)

    stop()
    expect(document.querySelector(`aside.${RELATED_CARD_CLASS}`)).toBeNull()
    expect(heading.classList.contains(FLASH_CLASS)).toBe(false)
  })
})
