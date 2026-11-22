// readingLayers.inline.ts
// 章節頁「分層閱讀」正文互動層（薄外層）：
//   1. 來源名稱（.bwz-rl-src）點／鍵盤開啟說明卡，附本章原文網頁與「全部資料來源 →」。
//   2. 舊格式原文標籤（.bwz-rl-orig-chip）點／鍵盤開啟原文小卡。
//   3. 分層卡片（.bwz-rl-card）補上鍵盤操作（Enter／Space）並維持 aria-expanded 同步。
//   4. 同章經節小標籤（.bwz-rl-vref[data-rl-verse]）單次捲動到該節並短暫標示（保留 bwz:verse-jump 供 B 階段分頁接手）。
// SPA 換頁時比照 knowledgeHub.inline.ts 用 AbortController 拆掉舊監聽器重綁，並在 prenav 時關閉已開的浮動卡片。
import {
  computePopoverPlacement,
  formatSourceCardHeading,
  parseOriginalContent,
  type PageSourcesPayload,
  type SourceCardEntry,
} from "../../util/readingLayersClient"

interface ActivePopover {
  trigger: HTMLElement
  element: HTMLElement
}

let activePopover: ActivePopover | null = null
let mountController: AbortController | null = null
let cardObservers: MutationObserver[] = []

function closePopover(restoreFocus = false): void {
  if (!activePopover) return
  const { trigger, element } = activePopover
  activePopover = null
  trigger.setAttribute("aria-expanded", "false")
  trigger.classList.remove("is-open")
  element.remove()
  if (restoreFocus && trigger.isConnected) {
    trigger.focus()
  }
}

function readPageSources(): PageSourcesPayload | null {
  const meta = document.querySelector<HTMLElement>("article .bwz-rl-meta[data-rl-sources]")
  const raw = meta?.dataset.rlSources
  if (!raw) return null
  try {
    return JSON.parse(raw) as PageSourcesPayload
  } catch {
    return null
  }
}

function positionPopover(popover: HTMLElement, trigger: HTMLElement): void {
  const rect = trigger.getBoundingClientRect()
  const popRect = popover.getBoundingClientRect()
  const placement = computePopoverPlacement({
    anchorLeft: rect.left,
    anchorTop: rect.top,
    anchorBottom: rect.bottom,
    popoverWidth: popRect.width || 320,
    popoverHeight: popRect.height || 160,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  })
  popover.style.left = `${placement.left}px`
  popover.style.top = `${placement.top}px`
  popover.dataset.placement = placement.placedAbove ? "top" : "bottom"
}

function createCloseButton(label: string): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "bwz-rl-pop-close"
  btn.setAttribute("aria-label", label)
  btn.textContent = "×"
  btn.addEventListener("click", (event) => {
    event.stopPropagation()
    closePopover(true)
  })
  return btn
}

function openSourcePopover(
  trigger: HTMLElement,
  entry: SourceCardEntry,
  sourcesHref: string,
  code?: string,
): void {
  if (activePopover?.trigger === trigger) {
    closePopover(false)
    return
  }
  closePopover(false)

  const { heading, subtitle } = formatSourceCardHeading(entry, code)
  const pop = document.createElement("div")
  pop.className = "bwz-rl-popover bwz-rl-popover-src"
  pop.setAttribute("role", "dialog")
  pop.setAttribute("aria-label", `${heading} 說明`)

  const head = document.createElement("div")
  head.className = "bwz-rl-pop-head"
  const titleEl = document.createElement("div")
  titleEl.className = "bwz-rl-pop-title"
  titleEl.textContent = heading
  head.append(titleEl, createCloseButton("關閉說明卡"))
  pop.appendChild(head)

  if (subtitle) {
    const sub = document.createElement("div")
    sub.className = "bwz-rl-pop-sub"
    sub.textContent = subtitle
    pop.appendChild(sub)
  }

  if (entry.note) {
    const note = document.createElement("div")
    note.className = "bwz-rl-pop-note"
    note.textContent = entry.note
    pop.appendChild(note)
  }

  if (entry.url || sourcesHref) {
    const foot = document.createElement("div")
    foot.className = "bwz-rl-pop-foot"
    if (entry.url) {
      const ext = document.createElement("a")
      ext.className = "bwz-rl-pop-link"
      ext.href = entry.url
      ext.target = "_blank"
      ext.rel = "noopener noreferrer"
      ext.textContent = "本章原文網頁 ↗"
      foot.appendChild(ext)
    }
    if (sourcesHref) {
      const all = document.createElement("a")
      all.className = "bwz-rl-pop-link internal"
      all.href = sourcesHref
      all.textContent = "全部資料來源 →"
      all.addEventListener("click", () => closePopover(false))
      foot.appendChild(all)
    }
    pop.appendChild(foot)
  }

  document.body.appendChild(pop)
  positionPopover(pop, trigger)
  trigger.setAttribute("aria-expanded", "true")
  trigger.classList.add("is-open")
  activePopover = { trigger, element: pop }
}

function openOriginalPopover(trigger: HTMLElement, raw: string): void {
  if (activePopover?.trigger === trigger) {
    closePopover(false)
    return
  }
  closePopover(false)

  const parsed = parseOriginalContent(raw)
  const pop = document.createElement("div")
  pop.className = "bwz-rl-popover bwz-rl-popover-orig"
  pop.setAttribute("role", "dialog")
  pop.setAttribute("aria-label", "原文細節")

  const head = document.createElement("div")
  head.className = "bwz-rl-pop-head"
  const titleEl = document.createElement("div")
  titleEl.className = "bwz-rl-pop-title"
  titleEl.textContent = "原文細節"
  head.append(titleEl, createCloseButton("關閉原文小卡"))
  pop.appendChild(head)

  if (parsed.script) {
    const scriptEl = document.createElement("div")
    scriptEl.className = "bwz-rl-orig-script"
    scriptEl.dir = parsed.script.dir
    scriptEl.lang = parsed.script.lang
    scriptEl.textContent = parsed.script.text
    pop.appendChild(scriptEl)
  }

  if (parsed.detailTokens.length > 0) {
    const detail = document.createElement("div")
    detail.className = "bwz-rl-orig-detail"
    for (const token of parsed.detailTokens) {
      if (token.kind === "strong") {
        const span = document.createElement("span")
        span.className = "strong-no"
        span.title = `Strong 編號 ${token.value}`
        span.textContent = token.value
        detail.appendChild(span)
      } else {
        detail.appendChild(document.createTextNode(token.value))
      }
    }
    pop.appendChild(detail)
  }

  const attrib = document.createElement("div")
  attrib.className = "bwz-rl-orig-attrib"
  attrib.textContent = "出處：STEP Bible（CC BY 4.0）"
  pop.appendChild(attrib)

  document.body.appendChild(pop)
  positionPopover(pop, trigger)
  trigger.setAttribute("aria-expanded", "true")
  trigger.classList.add("is-open")
  activePopover = { trigger, element: pop }
}

function jumpToVerse(verse: number): void {
  // 預留可取消事件給 B 階段的「經文｜研讀」分頁接手切換
  const event = new CustomEvent("bwz:verse-jump", { cancelable: true, detail: { verse } })
  document.dispatchEvent(event)
  if (event.defaultPrevented) return

  const target = document.getElementById(`v${verse}`)
  if (!target) return
  // 不用 scrollIntoView 避免連側欄或外層一起捲動；只計算一次位置並捲到該節
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 96)
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" })

  target.classList.remove("bwz-rl-vflash")
  void target.offsetWidth
  target.classList.add("bwz-rl-vflash")
  window.setTimeout(() => target.classList.remove("bwz-rl-vflash"), 2500)
}

function bindCards(article: HTMLElement, signal: AbortSignal): void {
  for (const card of article.querySelectorAll<HTMLElement>(".bwz-rl-card.is-collapsible")) {
    const title = card.querySelector<HTMLElement>(":scope > .callout-title")
    if (!title) continue

    const syncAria = () => {
      title.setAttribute("aria-expanded", String(!card.classList.contains("is-collapsed")))
    }
    syncAria()

    // 監看 class 變動，不論 callout.inline.ts 先跑或後跑都能同步 aria-expanded
    const observer = new MutationObserver(syncAria)
    observer.observe(card, { attributes: true, attributeFilter: ["class"] })
    cardObservers.push(observer)

    title.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          title.click()
        }
      },
      { signal },
    )
  }
}

function cleanup(): void {
  closePopover(false)
  mountController?.abort()
  mountController = null
  for (const observer of cardObservers) observer.disconnect()
  cardObservers = []
}

function mount(): void {
  cleanup()

  const article = document.querySelector<HTMLElement>("article")
  if (!article) return

  const hasLayerFeatures = Boolean(
    article.querySelector(".bwz-rl-src, .bwz-rl-orig-chip, .bwz-rl-card, .bwz-rl-vref[data-rl-verse]"),
  )
  if (!hasLayerFeatures) return

  const controller = new AbortController()
  mountController = controller
  const { signal } = controller
  const payload = readPageSources()

  bindCards(article, signal)

  const activateTrigger = (target: HTMLElement): boolean => {
    const src = target.closest<HTMLElement>(".bwz-rl-src")
    if (src && article.contains(src)) {
      const id = src.dataset.rlSrc
      const entry = id ? payload?.entries[id] : undefined
      if (entry && payload) {
        openSourcePopover(src, entry, payload.sourcesHref, src.dataset.rlCode)
      }
      return true
    }

    const orig = target.closest<HTMLElement>(".bwz-rl-orig-chip")
    if (orig && article.contains(orig)) {
      const raw = orig.dataset.rlOrig ?? ""
      if (raw) openOriginalPopover(orig, raw)
      return true
    }

    return false
  }

  article.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const vref = target.closest<HTMLElement>(".bwz-rl-vref[data-rl-verse]")
      if (vref && article.contains(vref)) {
        const verse = Number(vref.dataset.rlVerse)
        if (Number.isInteger(verse) && verse > 0) {
          event.preventDefault()
          closePopover(false)
          jumpToVerse(verse)
        }
        return
      }

      if (activateTrigger(target)) {
        event.stopPropagation()
      }
    },
    { signal },
  )

  article.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") return
      const target = event.target as HTMLElement | null
      if (!target) return
      // 原生 <button>（.bwz-rl-orig-chip）按 Enter/Space 會自己觸發 click，這裡只補 role="button" 的 span
      if (!target.classList.contains("bwz-rl-src")) return
      event.preventDefault()
      activateTrigger(target)
    },
    { signal },
  )

  document.addEventListener(
    "click",
    (event) => {
      if (!activePopover) return
      const target = event.target as Node | null
      if (!target) return
      if (activePopover.element.contains(target) || activePopover.trigger.contains(target)) return
      closePopover(false)
    },
    { signal },
  )

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && activePopover) {
        event.preventDefault()
        closePopover(true)
      }
    },
    { signal },
  )

  window.addEventListener(
    "resize",
    () => {
      if (activePopover) positionPopover(activePopover.element, activePopover.trigger)
    },
    { signal },
  )
}

document.addEventListener("prenav", cleanup)
document.addEventListener("nav", mount)
mount()
