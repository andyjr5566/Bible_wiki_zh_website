// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { ENTRY_LANDING_KEY } from "../../../quartz/util/entryLanding"
import { startRecording } from "../src/lib/recorder"

const chapterSlug = "02-出埃及記/第12章"

afterEach(() => {
  document.body.innerHTML = ""
  sessionStorage.clear()
})

describe("章節頁的條目落點記錄", () => {
  it("在章節頁文章的條目連結點擊時記錄來源與目的地", () => {
    document.body.dataset.slug = chapterSlug
    document.body.innerHTML = `
      <article>
        <ol><li><a class="internal" data-slug="link_folder/原文/在黃昏的時候"
          href="/Bible_wiki_zh_website/link_folder/原文/在黃昏的時候">條目</a></li></ol>
      </article>`
    const stop = startRecording()
    document.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

    expect(JSON.parse(sessionStorage.getItem(ENTRY_LANDING_KEY)!)).toEqual({
      v: 1,
      fromSlug: chapterSlug,
      toSlug: "link_folder/原文/在黃昏的時候",
      t: expect.any(Number),
    })
    stop()
  })

  it("接受章節文章連結打開的預覽來源", () => {
    document.body.dataset.slug = chapterSlug
    document.body.innerHTML = `
      <article>
        <p><a class="internal" data-slug="link_folder/原文/預覽來源"
          href="/Bible_wiki_zh_website/link_folder/原文/預覽來源">預覽來源</a></p>
      </article>`
    const stop = startRecording()
    document.querySelector("article a")!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

    const popover = document.createElement("div")
    popover.className = "popover"
    popover.innerHTML = `<a class="internal" data-slug="link_folder/原文/在黃昏的時候"
      href="/Bible_wiki_zh_website/link_folder/原文/在黃昏的時候">預覽中的條目</a>`
    document.body.append(popover)
    popover.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

    expect(JSON.parse(sessionStorage.getItem(ENTRY_LANDING_KEY)!)).toMatchObject({
      v: 1,
      fromSlug: chapterSlug,
      toSlug: "link_folder/原文/在黃昏的時候",
    })
    stop()
  })
})
