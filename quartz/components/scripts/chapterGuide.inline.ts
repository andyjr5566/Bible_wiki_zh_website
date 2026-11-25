// chapterGuide.inline.ts
// 聖經研讀知識庫 - Stage C 章節頁「本章導覽」面板（桌機右欄 / 平板讓寬右側抽屜 / 手機快捷列底部抽屜）
import { parseBookSlug } from "../../util/bookCatalog"
import {
  activeOutlineIndex,
  activeVerseOutlineIndex,
  buildGuideSources,
  buildLegendItems,
  computeScrollTargetTop,
  extractTextOutline,
  type LegendFlags,
  type VerseOutlineItem,
} from "../../util/chapterGuide"
import { readChapterDom, verseElementByNumber, type ChapterDom } from "../../util/chapterDom"
import { selectHiddenSections, selectStudyRegion } from "../../util/chapterRegions"
import {
  dispatchGuideState,
  GUIDE_ATTR,
  GUIDE_TOGGLE_EVENT,
  requestTabSwitch,
  TAB_CHANGE_EVENT,
  type GuideViewport,
  type ReadingTab,
  type TabChangeDetail,
} from "../../util/readingTabEvent"

const DESKTOP_QUERY = "(min-width: 1201px)"
const TABLET_QUERY = "(min-width: 801px) and (max-width: 1200px)"
const DESKTOP_STORAGE_KEY = "bwz-guide-desktop-collapsed"
const SIDEBAR_STORAGE_KEY = "bwz-left-sidebar-collapsed"
const SIDEBAR_ATTR = "data-bwz-sidebar-collapsed"
const GUIDE_ID = "bwz-guide"
const GUIDE_BODY_ID = "bwz-guide-body"

interface StudyOutlineItem {
  id: string
  label: string
  level: 2 | 3 | 4
  target: Element
}

interface ResourceLinkItem {
  title: string
  countText?: string
  href?: string
  target?: Element
}

function getViewport(): GuideViewport {
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop"
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet"
  return "mobile"
}

function currentTab(): ReadingTab {
  return document.documentElement.getAttribute("data-ux-view") === "text" ? "text" : "study"
}

/** 讀標題純文字（略過右側錨點連結與外掛動態按鈕的字）。 */
function cleanHeadingText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll("a[role='anchor'], .bwz-rl-vx, .bwz-rl-vx-btn").forEach((n) => n.remove())
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim()
}

/** 區塊標題的字。收合起來的區塊（本章知識節點）是 <details>，只取 <summary> 裡的標題，
 *  不然整個區塊的條目名稱都會被串進目錄。 */
function sectionHeadingLabel(el: Element): string {
  if (el.tagName.toLowerCase() !== "details") return cleanHeadingText(el)
  const summary = el.querySelector(":scope > summary")
  if (!summary) return cleanHeadingText(el)
  const heading = summary.querySelector(".collapsible-title, h1, h2, h3, h4, h5, h6")
  if (heading) return cleanHeadingText(heading)
  const clone = summary.cloneNode(true) as Element
  clone.querySelectorAll("span, small").forEach((n) => n.remove())
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim()
}

/** 目前可視區域頂端的黏頂障礙高度，避免捲動後標題被分頁列或快捷列蓋住。 */
function topObstructionBottom(viewport: GuideViewport): number {
  let bottom = 0
  if (viewport === "mobile") {
    const left = document.querySelector<HTMLElement>(".sidebar.left")
    if (left && getComputedStyle(left).position === "sticky") {
      bottom = Math.max(bottom, left.getBoundingClientRect().bottom)
    }
    const cqb = document.querySelector<HTMLElement>(".bwz-cqb.is-shown")
    if (cqb) {
      bottom = Math.max(bottom, cqb.getBoundingClientRect().bottom)
    }
  } else {
    const tabs = document.querySelector<HTMLElement>(".bwz-tabs")
    if (tabs && getComputedStyle(tabs).position === "sticky") {
      bottom = Math.max(bottom, tabs.getBoundingClientRect().bottom)
    }
  }
  return Math.max(0, Math.round(bottom))
}

function syncLeftSidebarToggleUi(root: HTMLElement) {
  const toggle = document.querySelector<HTMLButtonElement>(".bwz-sidebar-toggle")
  if (!toggle) return
  const collapsed = root.hasAttribute(SIDEBAR_ATTR)
  toggle.setAttribute("aria-expanded", String(!collapsed))
  toggle.title = collapsed ? "展開左欄" : "收合左欄"
  toggle.setAttribute("aria-label", toggle.title)
}

function collectLegendFlags(dom: ChapterDom): LegendFlags {
  const scope = dom.root
  const origChips = Array.from(scope.querySelectorAll(".bwz-rl-orig-chip"))
  let hasH = false
  let hasG = false
  for (const chip of origChips) {
    const raw = chip.getAttribute("data-orig-raw") ?? chip.textContent ?? ""
    if (/\bH\d+/i.test(raw)) hasH = true
    if (/\bG\d+/i.test(raw)) hasG = true
  }
  const origScript: LegendFlags["origScript"] =
    hasG && !hasH ? "greek" : hasG && hasH ? "mixed" : "hebrew"

  return {
    hasQuotes: Boolean(scope.querySelector(".bwz-rl-quote, .bwz-rl-vref")),
    hasSources: Boolean(scope.querySelector(".bwz-rl-src")),
    hasOrigChips: origChips.length > 0,
    hasCards: Boolean(scope.querySelector(".bwz-rl-card")),
    origScript,
  }
}

function collectTextOutline(dom: ChapterDom): VerseOutlineItem[] {
  const studyRegion = selectStudyRegion(dom.descriptions)
  if (!studyRegion) return []

  const outlineListItems: string[] = []
  const outlineTableRows: string[][] = []
  const fallbackTableRows: string[][] = []
  const subHeadings: { id: string; text: string }[] = []

  let inOutlineSub = false
  for (let i = studyRegion.start + 1; i <= studyRegion.end; i += 1) {
    const el = dom.children[i]
    // 區段的索引是在知識節點被收進 <details> 之前算的，之後子元素變少，索引可能超出範圍（出33 實例：整個面板沒掛上）
    if (!el) continue
    const tag = el.tagName.toLowerCase()
    if (tag === "h3" || tag === "h4") {
      const text = cleanHeadingText(el)
      if (tag === "h3") {
        subHeadings.push({ id: el.id || "", text })
      }
      inOutlineSub = text.includes("經文大綱")
      continue
    }

    if (inOutlineSub) {
      if (tag === "ol" || tag === "ul") {
        for (const li of Array.from(el.querySelectorAll(":scope > li"))) {
          const text = (li.textContent ?? "").trim()
          if (text) outlineListItems.push(text)
        }
      } else if (tag === "table" || el.classList.contains("table-container")) {
        const table = tag === "table" ? el : el.querySelector("table")
        if (table) {
          for (const tr of Array.from(table.querySelectorAll("tr"))) {
            const cells = Array.from(tr.querySelectorAll("th, td")).map(
              (td) => td.textContent?.trim() ?? "",
            )
            if (cells.length > 0) outlineTableRows.push(cells)
          }
        }
      }
      continue
    }

    if (fallbackTableRows.length === 0 && (tag === "table" || el.classList.contains("table-container"))) {
      const table = tag === "table" ? el : el.querySelector("table")
      if (table) {
        for (const tr of Array.from(table.querySelectorAll("tr"))) {
          const cells = Array.from(tr.querySelectorAll("th, td")).map(
            (td) => td.textContent?.trim() ?? "",
          )
          if (cells.length > 0) fallbackTableRows.push(cells)
        }
      }
    }
  }

  return extractTextOutline({
    outlineListItems,
    tableRows: outlineTableRows.length > 0 ? outlineTableRows : fallbackTableRows,
    subHeadings,
  })
}

function collectStudyOutline(dom: ChapterDom): StudyOutlineItem[] {
  const items: StudyOutlineItem[] = []
  items.push({
    id: "verses",
    label: "經文",
    level: 2,
    target: dom.verseList,
  })

  const hiddenSections = selectHiddenSections(dom.descriptions)
  for (const sec of hiddenSections) {
    const headingEl = dom.children[sec.start]
    if (!headingEl) continue
    const headingLabel = sectionHeadingLabel(headingEl)
    if (headingLabel) {
      items.push({
        id: headingEl.id || `sec-${sec.start}`,
        label: headingLabel,
        level: 2,
        target: headingEl,
      })
    }

    // 本章知識節點在頁面上是收合的，裡面的分類小標（人物、地點……）讀者看不到，不列進目錄。
    // 面板可能在知識節點還沒被收進 <details> 前就建好，所以也用標題字判斷，不只看是不是 details。
    if (headingEl.tagName.toLowerCase() === "details" || headingLabel.includes("本章知識節點")) continue

    const isAppendix = headingLabel.includes("附錄")
    for (const idx of sec.indices) {
      if (idx === sec.start) continue
      const child = dom.children[idx]
      if (!child) continue
      const tag = child.tagName.toLowerCase()
      if (tag === "h3") {
        const subText = cleanHeadingText(child)
        if (subText) {
          items.push({
            id: child.id || `sub-${idx}`,
            label: subText,
            level: 3,
            target: child,
          })
        }
      } else if (tag === "h4" && !isAppendix) {
        const subText = cleanHeadingText(child)
        if (subText) {
          items.push({
            id: child.id || `sub4-${idx}`,
            label: subText,
            level: 4,
            target: child,
          })
        }
      }
    }
  }
  return items
}

function collectResources(dom: ChapterDom, sourcesHref: string): ResourceLinkItem[] {
  const items: ResourceLinkItem[] = []

  // 本章知識節點
  const detailsNode = dom.children.find(
    (el) =>
      el.tagName.toLowerCase() === "details" &&
      cleanHeadingText(el.querySelector(":scope > summary .collapsible-title") ?? el).includes(
        "本章知識節點",
      ),
  )
  const rawHeadingNode = dom.children.find(
    (el) => el.tagName.toLowerCase() === "h2" && cleanHeadingText(el).includes("本章知識節點"),
  )
  const knowledgeTarget = detailsNode ?? rawHeadingNode
  if (knowledgeTarget) {
    let count = 0
    if (detailsNode) {
      count = detailsNode.querySelectorAll(".collapsible-content li").length
    } else if (rawHeadingNode) {
      let cur = rawHeadingNode.nextElementSibling
      while (cur && cur.tagName.toLowerCase() !== "h2" && cur.tagName.toLowerCase() !== "hr") {
        count += cur.querySelectorAll("li").length
        cur = cur.nextElementSibling
      }
    }
    if (count > 0) {
      items.push({
        title: "本章知識節點",
        countText: `${count} 個條目`,
        target: knowledgeTarget,
      })
    }
  }

  // 附錄子項：相關地圖、互動網站
  for (let i = 0; i < dom.children.length; i += 1) {
    const el = dom.children[i]
    if (!el || el.tagName.toLowerCase() !== "h3") continue
    const label = cleanHeadingText(el)
    if (label === "相關地圖") {
      let count = 0
      let cur = el.nextElementSibling
      while (
        cur &&
        !["h2", "h3", "hr"].includes(cur.tagName.toLowerCase())
      ) {
        count += cur.querySelectorAll("li").length
        cur = cur.nextElementSibling
      }
      if (count > 0) {
        items.push({ title: "相關地圖", countText: `${count} 張`, target: el })
      }
    } else if (label.includes("互動網站")) {
      let count = 0
      let cur = el.nextElementSibling
      while (
        cur &&
        !["h2", "h3", "hr"].includes(cur.tagName.toLowerCase())
      ) {
        count +=
          cur.querySelectorAll(".bwz-ia-frame, li").length ||
          (cur.matches("a") ? 1 : cur.querySelectorAll("a").length)
        cur = cur.nextElementSibling
      }
      if (count > 0) {
        items.push({ title: "互動網站", countText: `${count} 個`, target: el })
      }
    }
  }

  items.push({
    title: "全部資料來源說明 →",
    href: sourcesHref,
  })
  return items
}

function removeExistingGuide() {
  document.querySelectorAll(`#${GUIDE_ID}, .bwz-guide-fab, .bwz-guide-backdrop`).forEach((el) => el.remove())
  document.documentElement.removeAttribute(GUIDE_ATTR)
}

function setupChapterGuide() {
  removeExistingGuide()

  const slug = document.body.dataset.slug ?? ""
  if (parseBookSlug(slug)?.kind !== "chapter") {
    dispatchGuideState({ open: false, viewport: getViewport(), available: false })
    return
  }

  const maybeDom = readChapterDom(document)
  if (!maybeDom) {
    dispatchGuideState({ open: false, viewport: getViewport(), available: false })
    return
  }
  const dom: ChapterDom = maybeDom

  const abort = new AbortController()
  const { signal } = abort
  const rootEl = document.documentElement

  const legendItems = buildLegendItems(collectLegendFlags(dom))
  const rawSourcesJson = dom.root
    .querySelector(".bwz-rl-meta")
    ?.getAttribute("data-rl-sources")
  const sourcesSummary = buildGuideSources(rawSourcesJson, slug)
  const verseOutline = collectTextOutline(dom)
  const studyOutline = collectStudyOutline(dom)
  const resourceItems = collectResources(dom, sourcesSummary.sourcesHref)

  const panel = document.createElement("aside")
  panel.id = GUIDE_ID
  panel.className = "bwz-guide"
  panel.setAttribute("aria-label", "本章導覽")

  const head = document.createElement("div")
  head.className = "bwz-guide-head"
  const title = document.createElement("h2")
  title.className = "bwz-guide-title"
  title.textContent = "本章導覽"

  const toggleBtn = document.createElement("button")
  toggleBtn.type = "button"
  toggleBtn.className = "bwz-guide-toggle"
  toggleBtn.setAttribute("aria-controls", GUIDE_BODY_ID)
  head.append(title, toggleBtn)

  const body = document.createElement("div")
  body.id = GUIDE_BODY_ID
  body.className = "bwz-guide-body"

  // ① 怎麼看這一頁（研讀頁限定，經文頁不顯示）
  const legendSec = document.createElement("section")
  legendSec.className = "bwz-guide-sec"
  legendSec.setAttribute("aria-label", "怎麼看這一頁")
  if (legendItems.length > 0) {
    const h = document.createElement("h3")
    h.className = "bwz-guide-sec-title"
    h.textContent = "怎麼看這一頁"
    const ul = document.createElement("ul")
    ul.className = "bwz-guide-legend-list"
    for (const item of legendItems) {
      const li = document.createElement("li")
      li.className = "bwz-guide-legend-item"
      const swatch = document.createElement("span")
      swatch.className = `bwz-guide-swatch is-${item.sampleKind}`
      swatch.setAttribute("aria-hidden", "true")
      swatch.textContent = item.sample
      const desc = document.createElement("span")
      desc.textContent = item.text
      li.append(swatch, desc)
      ul.append(li)
    }
    legendSec.append(h, ul)
    body.append(legendSec)
  }

  // ② 本章目錄（動態隨分頁切換）
  const tocSec = document.createElement("section")
  tocSec.className = "bwz-guide-sec"
  tocSec.setAttribute("aria-label", "本章目錄")
  const tocTitle = document.createElement("h3")
  tocTitle.className = "bwz-guide-sec-title"
  tocTitle.textContent = "本章目錄"
  const tocList = document.createElement("ul")
  tocList.className = "bwz-guide-toc-list"
  tocSec.append(tocTitle, tocList)
  body.append(tocSec)

  // ③ 本章引用的資料（沒有就不列）
  if (sourcesSummary.entries.length > 0) {
    const srcSec = document.createElement("section")
    srcSec.className = "bwz-guide-sec"
    srcSec.setAttribute("aria-label", "本章引用的資料")
    const srcTitle = document.createElement("h3")
    srcTitle.className = "bwz-guide-sec-title"
    srcTitle.textContent = "本章引用的資料"
    const ul = document.createElement("ul")
    ul.className = "bwz-guide-src-list"
    for (const entry of sourcesSummary.entries) {
      const li = document.createElement("li")
      li.className = "bwz-guide-src-item"
      const row = document.createElement("div")
      row.className = "bwz-guide-src-head"
      const nameSpan = document.createElement("span")
      nameSpan.className = "bwz-guide-src-name"
      nameSpan.textContent = entry.name
      row.append(nameSpan)
      if (entry.title && entry.title !== entry.name) {
        const titleSpan = document.createElement("span")
        titleSpan.className = "bwz-guide-src-title"
        titleSpan.textContent = entry.title
        row.append(titleSpan)
      }
      li.append(row)

      if (entry.note || (entry.url && /^https?:\/\//i.test(entry.url))) {
        const noteDiv = document.createElement("div")
        noteDiv.className = "bwz-guide-src-note"
        if (entry.note) noteDiv.append(document.createTextNode(entry.note))
        if (entry.url && /^https?:\/\//i.test(entry.url)) {
          const a = document.createElement("a")
          a.className = "bwz-guide-src-ext"
          a.href = entry.url
          a.target = "_blank"
          a.rel = "noopener noreferrer"
          a.textContent = "本章原文網頁 ↗"
          noteDiv.append(a)
        }
        li.append(noteDiv)
      }
      ul.append(li)
    }
    srcSec.append(srcTitle, ul)
    body.append(srcSec)
  }

  // ④ 相關資源
  if (resourceItems.length > 0) {
    const resSec = document.createElement("section")
    resSec.className = "bwz-guide-sec"
    resSec.setAttribute("aria-label", "相關資源")
    const resTitle = document.createElement("h3")
    resTitle.className = "bwz-guide-sec-title"
    resTitle.textContent = "相關資源"
    const ul = document.createElement("ul")
    ul.className = "bwz-guide-res-list"
    for (const res of resourceItems) {
      const li = document.createElement("li")
      if (res.href) {
        const a = document.createElement("a")
        a.className = "bwz-guide-res-link"
        a.href = res.href
        const span = document.createElement("span")
        span.textContent = res.title
        a.append(span)
        li.append(a)
      } else if (res.target) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "bwz-guide-res-btn"
        const label = document.createElement("span")
        label.textContent = res.title
        btn.append(label)
        if (res.countText) {
          const cnt = document.createElement("span")
          cnt.className = "bwz-guide-res-count"
          cnt.textContent = res.countText
          btn.append(cnt)
        }
        btn.addEventListener(
          "click",
          () => {
            jumpToElement(res.target!, { needsStudy: true })
          },
          { signal },
        )
        li.append(btn)
      }
      ul.append(li)
    }
    resSec.append(resTitle, ul)
    body.append(resSec)
  }

  panel.append(head, body)

  // 平板右上入口小按鈕 ＋ 手機遮罩
  const fab = document.createElement("button")
  fab.type = "button"
  fab.className = "bwz-guide-fab"
  fab.setAttribute("aria-controls", GUIDE_ID)
  fab.textContent = "本章導覽"

  const backdrop = document.createElement("div")
  backdrop.className = "bwz-guide-backdrop"
  backdrop.setAttribute("aria-hidden", "true")

  let viewport: GuideViewport = getViewport()
  let view: ReadingTab = currentTab()
  let desktopOpen = true
  try {
    desktopOpen = localStorage.getItem(DESKTOP_STORAGE_KEY) !== "true"
  } catch {
    desktopOpen = true
  }
  let tabletOpen = false
  let mobileOpen = false
  let autoCollapsedLeft = false
  let lastTrigger: HTMLElement | null = null
  let tocButtons: HTMLButtonElement[] = []

  function isOpen(): boolean {
    if (viewport === "desktop") return desktopOpen
    if (viewport === "tablet") return tabletOpen
    return mobileOpen
  }

  function restoreLeftIfAutoCollapsed() {
    if (!autoCollapsedLeft) return
    autoCollapsedLeft = false
    let userWantedCollapsed = false
    try {
      userWantedCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
    } catch {
      userWantedCollapsed = false
    }
    if (!userWantedCollapsed) {
      rootEl.removeAttribute(SIDEBAR_ATTR)
      syncLeftSidebarToggleUi(rootEl)
    }
  }

  function applyMount() {
    const rightSidebar = document.querySelector<HTMLElement>(".page > #quartz-body > .sidebar.right")
    const quartzBody = document.querySelector<HTMLElement>(".page > #quartz-body")
    if (viewport === "desktop" && rightSidebar) {
      if (panel.parentElement !== rightSidebar) rightSidebar.prepend(panel)
      if (!document.body.contains(backdrop)) document.body.append(backdrop)
      if (!document.body.contains(fab)) document.body.append(fab)
    } else if (viewport === "tablet" && quartzBody) {
      if (panel.parentElement !== quartzBody) quartzBody.append(panel)
      if (!document.body.contains(backdrop)) document.body.append(backdrop)
      if (!document.body.contains(fab)) document.body.append(fab)
    } else {
      if (panel.parentElement !== document.body) document.body.append(panel)
      if (!document.body.contains(backdrop)) document.body.append(backdrop)
      if (!document.body.contains(fab)) document.body.append(fab)
    }
  }

  function syncStateUi() {
    const open = isOpen()
    panel.classList.toggle("is-collapsed", viewport === "desktop" && !open)
    rootEl.setAttribute(GUIDE_ATTR, open ? "open" : "collapsed")

    if (viewport === "desktop") {
      toggleBtn.textContent = open ? "收起 ▾" : "展開 ▸"
      toggleBtn.setAttribute("aria-label", open ? "收起本章導覽" : "展開本章導覽")
    } else {
      toggleBtn.textContent = "收起 ✕"
      toggleBtn.setAttribute("aria-label", "關閉本章導覽")
    }
    toggleBtn.setAttribute("aria-expanded", String(open))
    fab.setAttribute("aria-expanded", String(open))
    dispatchGuideState({ open, viewport, available: true })
  }

  function setOpen(next: boolean, trigger?: HTMLElement | null) {
    if (next && trigger) lastTrigger = trigger
    if (viewport === "desktop") {
      desktopOpen = next
      try {
        localStorage.setItem(DESKTOP_STORAGE_KEY, String(!next))
      } catch {
        // 儲存失敗仍維持本頁開合
      }
      restoreLeftIfAutoCollapsed()
    } else if (viewport === "tablet") {
      tabletOpen = next
      if (next) {
        if (!rootEl.hasAttribute(SIDEBAR_ATTR)) {
          autoCollapsedLeft = true
          rootEl.setAttribute(SIDEBAR_ATTR, "true")
          syncLeftSidebarToggleUi(rootEl)
        }
      } else {
        restoreLeftIfAutoCollapsed()
      }
    } else {
      mobileOpen = next
    }
    syncStateUi()
    if (!next && lastTrigger && (viewport === "tablet" || viewport === "mobile")) {
      const target = lastTrigger
      lastTrigger = null
      if (document.contains(target) && typeof target.focus === "function") {
        target.focus()
      }
    }
  }

  function flashVerse(el: Element) {
    document
      .querySelectorAll(".bwz-guide-verse-flash")
      .forEach((n) => n.classList.remove("bwz-guide-verse-flash"))
    el.classList.add("bwz-guide-verse-flash")
    window.setTimeout(() => el.classList.remove("bwz-guide-verse-flash"), 1650)
  }

  function scrollSingleTo(target: Element) {
    const obstruction = topObstructionBottom(viewport)
    const rect = target.getBoundingClientRect()
    const top = computeScrollTargetTop({
      elementTop: rect.top,
      scrollY: window.scrollY,
      obstructionBottom: obstruction,
      margin: 14,
    })
    window.scrollTo({ top, behavior: "instant" as ScrollBehavior })
  }

  function jumpToVerse(verse: number) {
    const target = verseElementByNumber(dom, verse) ?? dom.verseList
    if (viewport === "mobile" && mobileOpen) {
      mobileOpen = false
      syncStateUi()
    }
    requestAnimationFrame(() => {
      scrollSingleTo(target)
      flashVerse(target)
      updateActiveHighlight()
    })
  }

  function resolveLiveTarget(target: Element): Element {
    if (document.contains(target)) return target
    if (target.id) {
      const live = document.getElementById(target.id)
      if (live) return live
    }
    return target
  }

  function jumpToElement(target: Element, opts: { needsStudy?: boolean } = {}) {
    if (viewport === "mobile" && mobileOpen) {
      mobileOpen = false
      syncStateUi()
    }
    if (opts.needsStudy && currentTab() !== "study") {
      requestTabSwitch("study")
    }
    const liveTarget = resolveLiveTarget(target)
    if (liveTarget instanceof HTMLDetailsElement && !liveTarget.open) {
      liveTarget.open = true
    }
    requestAnimationFrame(() => {
      const finalTarget = resolveLiveTarget(liveTarget)
      scrollSingleTo(finalTarget)
      updateActiveHighlight()
    })
  }

  function renderOutline() {
    tocList.replaceChildren()
    tocButtons = []
    legendSec.hidden = view !== "study" || legendItems.length === 0

    if (view === "text") {
      if (verseOutline.length === 0) {
        tocSec.hidden = true
        return
      }
      tocSec.hidden = false
      for (let i = 0; i < verseOutline.length; i += 1) {
        const item = verseOutline[i]
        const li = document.createElement("li")
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "bwz-guide-toc-btn is-lvl-3"
        btn.textContent = item.label
        btn.addEventListener("click", () => jumpToVerse(item.startVerse), { signal })
        li.append(btn)
        tocList.append(li)
        tocButtons.push(btn)
      }
    } else {
      if (studyOutline.length === 0) {
        tocSec.hidden = true
        return
      }
      tocSec.hidden = false
      for (let i = 0; i < studyOutline.length; i += 1) {
        const item = studyOutline[i]
        const li = document.createElement("li")
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = `bwz-guide-toc-btn is-lvl-${item.level}`
        btn.textContent = item.label
        btn.addEventListener("click", () => jumpToElement(item.target), { signal })
        li.append(btn)
        tocList.append(li)
        tocButtons.push(btn)
      }
    }
    updateActiveHighlight()
  }

  function updateActiveHighlight() {
    if (tocButtons.length === 0) return
    const probeY = topObstructionBottom(viewport) + 48
    let activeIdx = -1

    if (view === "text") {
      const verseItems = Array.from(dom.verseList.querySelectorAll<HTMLLIElement>(":scope > li"))
      let visibleVerse: number | null = null
      for (let i = 0; i < verseItems.length; i += 1) {
        const li = verseItems[i]
        if (li.getBoundingClientRect().bottom >= probeY) {
          const start = Number.isInteger(dom.verseList.start) ? dom.verseList.start : 1
          visibleVerse = start + i
          break
        }
      }
      activeIdx = activeVerseOutlineIndex(verseOutline, visibleVerse)
    } else {
      const tops = studyOutline.map((item) => resolveLiveTarget(item.target).getBoundingClientRect().top)
      activeIdx = activeOutlineIndex(tops, probeY)
    }

    for (let i = 0; i < tocButtons.length; i += 1) {
      const active = i === activeIdx
      tocButtons[i].classList.toggle("is-active", active)
      if (active) tocButtons[i].setAttribute("aria-current", "location")
      else tocButtons[i].removeAttribute("aria-current")
    }
  }

  applyMount()
  renderOutline()
  syncStateUi()

  toggleBtn.addEventListener("click", () => setOpen(!isOpen(), toggleBtn), { signal })
  fab.addEventListener("click", () => setOpen(true, fab), { signal })
  backdrop.addEventListener("click", () => setOpen(false), { signal })

  document.addEventListener(
    GUIDE_TOGGLE_EVENT,
    () => {
      const quickBarBtn = document.querySelector<HTMLElement>(".bwz-cqb-guide")
      setOpen(!isOpen(), quickBarBtn ?? fab)
    },
    { signal },
  )

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && (viewport === "mobile" || viewport === "tablet") && isOpen()) {
        event.preventDefault()
        setOpen(false)
      }
    },
    { signal },
  )

  // 平板互斥：使用者手動點開左欄時自動關掉右側導覽抽屜
  const sidebarObserver = new MutationObserver(() => {
    if (viewport === "tablet" && tabletOpen && !rootEl.hasAttribute(SIDEBAR_ATTR)) {
      autoCollapsedLeft = false
      tabletOpen = false
      syncStateUi()
    }
  })
  sidebarObserver.observe(rootEl, { attributes: true, attributeFilter: [SIDEBAR_ATTR] })

  document.addEventListener(
    TAB_CHANGE_EVENT,
    (event) => {
      const detail = (event as CustomEvent<TabChangeDetail>).detail
      if (!detail || detail.view === view) return
      view = detail.view
      renderOutline()
    },
    { signal },
  )

  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      updateActiveHighlight()
    })
  }
  window.addEventListener("scroll", onScroll, { passive: true, signal })

  const handleViewportChange = () => {
    const nextVp = getViewport()
    if (nextVp !== viewport) {
      if (viewport === "tablet" && tabletOpen && nextVp !== "tablet") {
        tabletOpen = false
        restoreLeftIfAutoCollapsed()
      }
      if (viewport === "mobile" && mobileOpen && nextVp !== "mobile") {
        mobileOpen = false
      }
      viewport = nextVp
      applyMount()
      syncStateUi()
    }
    updateActiveHighlight()
  }
  const desktopMql = window.matchMedia(DESKTOP_QUERY)
  const tabletMql = window.matchMedia(TABLET_QUERY)
  desktopMql.addEventListener("change", handleViewportChange, { signal })
  tabletMql.addEventListener("change", handleViewportChange, { signal })
  window.addEventListener("resize", handleViewportChange, { passive: true, signal })

  window.addCleanup?.(() => {
    abort.abort()
    sidebarObserver.disconnect()
    restoreLeftIfAutoCollapsed()
    removeExistingGuide()
  })
}

document.addEventListener("nav", setupChapterGuide)
