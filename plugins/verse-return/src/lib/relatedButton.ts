// 條目頁的章節相關內容按鈕：等目標章節出現在 DOM，再展開、捲動與標示。
import { canonicalSlugPath } from "../../../../quartz/util/bibleBooks"
import { entryLandingLabels, type EntryLanding } from "../../../../quartz/util/entryLanding"
import { FLASH_CLASS, topObstruction } from "./jump"
import { headingScrollTop } from "./scrollPlan"

export const RELATED_BUTTON_CLASS = "bwz-vr-related"
const WAIT_MS = 5000
const FLASH_MS = 2600

function targetHeading(fromSlug: string): HTMLElement | null {
  const article = document.querySelector("article")
  if (!article) return null

  const expected = canonicalSlugPath(fromSlug)
  for (const anchor of Array.from(article.querySelectorAll<HTMLAnchorElement>("h4 > a[data-slug]"))) {
    if (canonicalSlugPath(anchor.dataset.slug ?? "") === expected) return anchor.closest("h4")
  }
  return null
}

function placeButton(button: HTMLButtonElement): void {
  const article = document.querySelector<HTMLElement>("article")
  if (!article) return

  const content = article.querySelector<HTMLElement>(".markdown-rendered") ?? article
  const title = Array.from(content.children).find((child) => child.tagName.toLowerCase() === "h1")
  if (title) {
    title.insertAdjacentElement("afterend", button)
  } else {
    article.prepend(button)
  }
}

function revealHeading(heading: HTMLElement): void {
  let details = heading.closest("details")
  while (details) {
    details.open = true
    details = details.parentElement?.closest("details") ?? null
  }

  const rect = heading.getBoundingClientRect()
  const scrollTop = headingScrollTop(
    { top: rect.top, height: 0 },
    { scrollY: window.scrollY, viewportHeight: window.innerHeight, topObstruction: topObstruction() },
  )
  // 站台預設平滑捲動會打斷補位，這裡直接捲到章節標題。
  window.scrollTo({ top: scrollTop, behavior: "instant" })
  // 標示的移除時機由呼叫端管（連按兩次時要先取消上一次的計時）
  heading.classList.add(FLASH_CLASS)
}

export function startRelatedButton(landing: EntryLanding): () => void {
  for (const old of Array.from(document.querySelectorAll(`.${RELATED_BUTTON_CLASS}`))) old.remove()

  const labels = entryLandingLabels(landing.fromSlug)
  if (!labels) return () => {}

  let active = true
  let observer: MutationObserver | null = null
  let deadline = 0
  let button: HTMLButtonElement | null = null
  let flashedHeading: HTMLElement | null = null
  let flashTimer = 0

  const stopWaiting = () => {
    observer?.disconnect()
    observer = null
    window.clearTimeout(deadline)
    deadline = 0
  }

  const cancel = () => {
    if (!active) return
    active = false
    stopWaiting()
    window.clearTimeout(flashTimer)
    flashedHeading?.classList.remove(FLASH_CLASS)
    flashedHeading = null
    button?.remove()
    button = null
  }

  const mountIfReady = (): boolean => {
    if (!active || button) return Boolean(button)
    const heading = targetHeading(landing.fromSlug)
    if (!heading) return false

    button = document.createElement("button")
    button.type = "button"
    button.className = RELATED_BUTTON_CLASS
    button.textContent = labels.buttonText
    button.setAttribute("aria-label", labels.ariaLabel)
    button.addEventListener("click", () => {
      const currentHeading = targetHeading(landing.fromSlug)
      if (!currentHeading) return
      window.clearTimeout(flashTimer)
      flashedHeading?.classList.remove(FLASH_CLASS)
      revealHeading(currentHeading)
      flashedHeading = currentHeading
      flashTimer = window.setTimeout(() => {
        currentHeading.classList.remove(FLASH_CLASS)
        flashedHeading = null
      }, FLASH_MS)
    })
    placeButton(button)
    stopWaiting()
    return true
  }

  if (!mountIfReady()) {
    observer = new MutationObserver(() => mountIfReady())
    observer.observe(document.body, { childList: true, subtree: true })
    deadline = window.setTimeout(stopWaiting, WAIT_MS)
  }

  return cancel
}
