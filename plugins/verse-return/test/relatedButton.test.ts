// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { makeEntryLanding } from "../../../quartz/util/entryLanding"
import { FLASH_CLASS } from "../src/lib/jump"
import { startRelatedButton } from "../src/lib/relatedButton"

const chapterSlug = "02-出埃及記/第12章"

function setPage(withChapter = true): void {
  document.body.dataset.slug = "link_folder/原文/在黃昏的時候"
  document.body.innerHTML = `
    <div class="page-header"></div>
    <article class="popover-hint"><div class="markdown-rendered">
      <h1 id="在黃昏的時候">在黃昏的時候</h1>
      <h2 id="定義">定義</h2>
      ${
        withChapter
          ? `<details class="collapsible-section"><summary>按書卷累積 1 卷書</summary>
              <details class="collapsible-subheading"><summary>出埃及記</summary>
                <h4 id="第12章"><a class="internal" data-slug="${chapterSlug}" href="../../02-出埃及記/第12章">第12章</a></h4>
              </details>
            </details>`
          : ""
      }
    </div></article>`
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("條目頁的章節相關內容按鈕", () => {
  it("放在內容標題後，展開折疊並瞬間捲動與標示章節", () => {
    setPage()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 })
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
    const scrollTo = vi.fn()
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo })

    const landing = makeEntryLanding(chapterSlug, "link_folder/原文/在黃昏的時候", Date.now())!
    const stop = startRelatedButton(landing)
    const button = document.querySelector<HTMLButtonElement>(".bwz-vr-related")!

    expect(button.textContent).toBe("↓ 出埃及記 12 的相關內容")
    expect(button.getAttribute("aria-label")).toBe("跳到本條目中出埃及記第 12 章的相關內容")
    expect(document.querySelector("h1")!.nextElementSibling).toBe(button)

    button.click()

    const heading = document.querySelector("h4")!
    expect(document.querySelectorAll("details[open]")).toHaveLength(2)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" })
    expect(heading.classList.contains(FLASH_CLASS)).toBe(true)

    stop()
    expect(document.querySelector(".bwz-vr-related")).toBeNull()
  })

  it("等到章節標題出現才插入按鈕", async () => {
    setPage(false)
    const landing = makeEntryLanding(chapterSlug, "link_folder/原文/在黃昏的時候", Date.now())!
    const stop = startRelatedButton(landing)
    expect(document.querySelector(".bwz-vr-related")).toBeNull()

    const article = document.querySelector("article .markdown-rendered")!
    article.insertAdjacentHTML(
      "beforeend",
      `<details><summary>按書卷累積 1 卷書</summary><details><summary>出埃及記</summary>
        <h4><a data-slug="${chapterSlug}" href="../../02-出埃及記/第12章">第12章</a></h4>
      </details></details>`,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector(".bwz-vr-related")).not.toBeNull()
    stop()
  })
})
