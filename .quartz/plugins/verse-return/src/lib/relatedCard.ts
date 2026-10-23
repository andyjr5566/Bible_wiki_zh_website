// 條目頁的本章摘要卡：等目標章節出現在 DOM，再複製摘要；讀者按下連結時展開、捲動與標示。
import { canonicalSlugPath } from "../../../../quartz/util/bibleBooks"
import { entryLandingLabels, type EntryLanding } from "../../../../quartz/util/entryLanding"
import { FLASH_CLASS, topObstruction } from "./jump"
import { headingScrollTop } from "./scrollPlan"

export const RELATED_CARD_CLASS = "bwz-vr-card"
const EXPANDED_CLASS = "bwz-vr-card-expanded"
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

function placeCard(card: HTMLElement): void {
  const article = document.querySelector<HTMLElement>("article")
  if (!article) return

  const content = article.querySelector<HTMLElement>(".markdown-rendered") ?? article
  const definition = Array.from(content.children).find(
    (child) => child.tagName.toLowerCase() === "h2" && child.textContent?.replace(/\s/g, "") === "定義",
  )
  if (definition) {
    let next = definition.nextElementSibling
    while (next) {
      const isSection = next.tagName.toLowerCase() === "h2"
      const isCollapsible = next.tagName.toLowerCase() === "details" &&
        Array.from(next.classList).some((name) => name.includes("collapsible"))
      if (isSection || isCollapsible) break
      next = next.nextElementSibling
    }
    if (next) next.insertAdjacentElement("beforebegin", card)
    else content.append(card)
    return
  }

  const title = Array.from(content.children).find((child) => child.tagName.toLowerCase() === "h1")
  if (title) {
    title.insertAdjacentElement("afterend", card)
  } else {
    article.prepend(card)
  }
}

function chapterItems(heading: HTMLElement): HTMLLIElement[] {
  const list = heading.nextElementSibling
  if (list?.tagName.toLowerCase() !== "ul") return []
  return Array.from(list.children).filter((child): child is HTMLLIElement => child.tagName.toLowerCase() === "li")
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

export function startRelatedCard(landing: EntryLanding): () => void {
  for (const old of Array.from(document.querySelectorAll(`.${RELATED_CARD_CLASS}`))) old.remove()

  const labels = entryLandingLabels(landing.fromSlug)
  if (!labels) return () => {}

  let active = true
  let observer: MutationObserver | null = null
  let deadline = 0
  let card: HTMLElement | null = null
  let measureFrame: number | null = null
  let measureTimer = 0
  let flashedHeading: HTMLElement | null = null
  let flashTimer = 0

  const stopWaiting = () => {
    observer?.disconnect()
    observer = null
    window.clearTimeout(deadline)
    deadline = 0
  }

  const measureOverflow = () => {
    if (!card) return
    const list = card.querySelector<HTMLUListElement>(".bwz-vr-card-list")
    const toggle = card.querySelector<HTMLButtonElement>(".bwz-vr-card-toggle")
    if (!list || !toggle) return

    // 展開時先量折疊後的高度，才不會把「收起」誤判為不需要。
    const wasExpanded = card.classList.contains(EXPANDED_CLASS)
    if (wasExpanded) card.classList.remove(EXPANDED_CLASS)
    const clipped = Array.from(list.children).some(
      (item) => item.scrollHeight > item.clientHeight + 1,
    )
    if (wasExpanded && clipped) card.classList.add(EXPANDED_CLASS)
    if (!clipped) {
      toggle.textContent = "展開全文"
      toggle.setAttribute("aria-expanded", "false")
    }
    toggle.hidden = !clipped
  }

  const scheduleMeasure = () => {
    if (!active || !card || measureFrame !== null || measureTimer) return
    if (typeof window.requestAnimationFrame === "function") {
      measureFrame = window.requestAnimationFrame(() => {
        measureFrame = null
        measureOverflow()
      })
    } else {
      measureTimer = window.setTimeout(() => {
        measureTimer = 0
        measureOverflow()
      }, 0)
    }
  }

  const cancel = () => {
    if (!active) return
    active = false
    stopWaiting()
    window.removeEventListener("resize", scheduleMeasure)
    if (measureFrame !== null) window.cancelAnimationFrame(measureFrame)
    window.clearTimeout(measureTimer)
    window.clearTimeout(flashTimer)
    flashedHeading?.classList.remove(FLASH_CLASS)
    flashedHeading = null
    card?.remove()
    card = null
  }

  const mountIfReady = (): boolean => {
    if (!active || card) return Boolean(card)
    const heading = targetHeading(landing.fromSlug)
    if (!heading) return false

    card = document.createElement("aside")
    card.className = RELATED_CARD_CLASS
    card.setAttribute("aria-label", labels.ariaLabel)

    const title = document.createElement("div")
    title.className = "bwz-vr-card-title"
    title.textContent = labels.cardTitle
    card.append(title)

    const list = document.createElement("ul")
    list.className = "bwz-vr-card-list"
    for (const item of chapterItems(heading)) {
      const copy = item.cloneNode(true) as HTMLLIElement
      // 複製摘要時保留連結與粗體，但 id 不能在同一頁重複。
      copy.removeAttribute("id")
      for (const descendant of Array.from(copy.querySelectorAll("[id]"))) descendant.removeAttribute("id")
      list.append(copy)
    }
    card.append(list)

    const toggle = document.createElement("button")
    toggle.type = "button"
    toggle.className = "bwz-vr-card-toggle bwz-vr-card-action"
    toggle.textContent = "展開全文"
    toggle.setAttribute("aria-expanded", "false")
    toggle.hidden = true
    toggle.addEventListener("click", () => {
      if (!card) return
      const expanded = card.classList.toggle(EXPANDED_CLASS)
      toggle.textContent = expanded ? "收起" : "展開全文"
      toggle.setAttribute("aria-expanded", String(expanded))
    })
    card.append(toggle)

    const jump = document.createElement("button")
    jump.type = "button"
    jump.className = "bwz-vr-card-jump bwz-vr-card-action"
    jump.textContent = "看本條目在其他章節的記載 ↓"
    jump.addEventListener("click", () => {
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
    card.append(jump)

    placeCard(card)
    stopWaiting()
    window.addEventListener("resize", scheduleMeasure)
    scheduleMeasure()
    // 字型稍後載入可能改變換行，載入完成後再量一次。
    void document.fonts?.ready.then(scheduleMeasure)
    return true
  }

  if (!mountIfReady()) {
    observer = new MutationObserver(() => mountIfReady())
    observer.observe(document.body, { childList: true, subtree: true })
    deadline = window.setTimeout(stopWaiting, WAIT_MS)
  }

  return cancel
}
