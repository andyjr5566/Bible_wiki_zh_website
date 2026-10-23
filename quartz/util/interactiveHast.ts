// 互動網站探索中心的建置時 HAST 轉換（U-24）。建置時插入內容，沒有瀏覽器腳本也看得到，
// SPA 換頁時也不會先顯示舊清單再閃成新卡片。放置規則依 U-24 的章節附錄與總入口規格。
import type { Element, ElementContent, Root } from "hast"
import type { FullSlug } from "./path"
import { joinSegments, pathToRoot } from "./path"
import { chapterSlug, parseBookSlug } from "./bookCatalog"
import { selectChapterRegions } from "./chapterRegions"
import type { ChapterNodeDescription } from "./chapterRegions"
import {
  axisGroups,
  chaptersInBook,
  coverageByBook,
  deepLinkFor,
  formatRanges,
  sitesForChapter,
  wideSites,
} from "./interactiveSites"
import type { ChapterRef, InteractiveRegistry, InteractiveSite } from "./interactiveSites"

export const HUB_SLUG = "appendix/website/index"

export interface InteractiveHastContext {
  slug: string
  registry: InteractiveRegistry
  existingSlugs: ReadonlySet<string>
}

const WORDS = {
  appendix: "附錄",
  interactive: "互動網站",
  linePrefix: "🕹️ 本章有 ",
  lineSuffix: " 個互動網站",
  allSites: "全部互動網站 →",
  intro: "方舟有多大？十二支派怎麼圍著會幕紮營？這些網站把經文畫成場景和地圖，可以自己動手看。點了會開新分頁。",
  wideHeading: "貫穿好幾卷書",
  axisHeading: "依經文的位置",
  sourceHeading: "依章節的清單",
  coverageLabel: "涵蓋的書卷",
  legend: "數字是涵蓋的章數",
  newTab: "（在新分頁開啟）",
  chapterUnit: " 章",
  previous: "前一章",
  next: "下一章",
} as const

type DescribedNodes = {
  descriptions: ChapterNodeDescription[]
  rootIndices: number[]
}

type CardPlacement =
  | { kind: "replace"; start: number; end: number }
  | { kind: "appendix"; index: number }
  | { kind: "newAppendix"; index: number }

function txt(value: string): ElementContent {
  return { type: "text", value }
}

/** 小型 HAST 建構器；所有文字都維持為文字節點，避免把網站資料當 HTML 解析。 */
export function el(
  tag: string,
  props: Element["properties"] = {},
  children: Array<ElementContent | string> = [],
): Element {
  return {
    type: "element",
    tagName: tag,
    properties: props,
    children: children.map((child) => typeof child === "string" ? txt(child) : child),
  }
}

function elementAt(root: Root, index: number): Element | null {
  const node = root.children[index]
  return node?.type === "element" ? node : null
}

function nodeText(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  return node.children.map(nodeText).join("")
}

function classNames(node: Element): string[] {
  const value = node.properties.className
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") return value.split(/\s+/u).filter(Boolean)
  return []
}

function hasClass(node: Element, name: string): boolean {
  return classNames(node).includes(name)
}

function normalizedHeading(node: Element): string {
  return nodeText(node).normalize("NFKC").replace(/\s+/gu, "")
}

function detailsHeading(node: Element): string {
  const summary = node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "summary",
  )
  return summary ? nodeText(summary) : ""
}

/** 描述陣列只含 element，因此另外保留到 root.children 的索引表。 */
export function describeChapterNodes(root: Root): DescribedNodes {
  const descriptions: ChapterNodeDescription[] = []
  const rootIndices: number[] = []

  root.children.forEach((node, index) => {
    if (node.type !== "element") return

    const className = classNames(node).join(" ")
    const description: ChapterNodeDescription = {
      tag: node.tagName,
      ...(className ? { className } : {}),
      ...(hasClass(node, "table-container") ? { text: nodeText(node) } : {}),
      ...(node.tagName === "h2" || node.tagName === "details"
        ? { headingText: node.tagName === "details" ? detailsHeading(node) : nodeText(node) }
        : {}),
    }
    descriptions.push(description)
    rootIndices.push(index)
  })

  return { descriptions, rootIndices }
}

function isNavigationTable(node: Element): boolean {
  if (!hasClass(node, "table-container")) return false
  const text = nodeText(node)
  return text.includes(WORDS.previous) || text.includes(WORDS.next)
}

function hasTopLevelClass(root: Root, name: string): boolean {
  return root.children.some((node) => node.type === "element" && hasClass(node, name))
}

function relativePath(slug: string, path: string): string {
  return joinSegments(pathToRoot(slug as FullSlug), path)
}

function externalProps(href: string): Element["properties"] {
  return { href, target: "_blank", rel: ["noopener"] }
}

function newTabText(): Element {
  return el("span", { className: ["bwz-ia-sr"] }, [WORDS.newTab])
}

function typeCover(site: InteractiveSite): Element {
  const reference = coverageByBook(site)
    .slice(0, 2)
    .map(({ book }) => `${book.short} ${formatRanges(chaptersInBook(site, book.num))}`)
    .join("・")

  return el("span", { className: ["bwz-ia-tcover"] }, [
    el("span", { className: ["bwz-ia-tcover-title"] }, [site.title]),
    el("span", { className: ["bwz-ia-tcover-ref"] }, [reference]),
  ])
}

function coverArt(site: InteractiveSite, slug: string): Element {
  if (!site.hasCover) return typeCover(site)

  return el("img", {
    src: relativePath(slug, site.coverPath),
    alt: "",
    loading: "lazy",
    decoding: "async",
    width: 640,
    height: 400,
  })
}

function coverageCells(site: InteractiveSite): Element[] {
  const cells = coverageByBook(site).map(({ book, count }) =>
    el("span", { className: ["bwz-ia-cell"], role: "listitem" }, [
      el("span", { className: ["bwz-ia-cell-b"] }, [book.short]),
      el("span", { className: ["bwz-ia-cell-n"] }, [String(count)]),
    ]),
  )

  return [
    el("div", {
      className: ["bwz-ia-cells"],
      role: "list",
      "aria-label": WORDS.coverageLabel,
    }, cells),
    el("p", { className: ["bwz-ia-legend"] }, [WORDS.legend]),
  ]
}

/** frame 的連結只在章節頁套用該章 deep link。 */
export function buildFrame(
  site: InteractiveSite,
  slug: string,
  options: { chapter?: ChapterRef; wide?: boolean } = {},
): Element {
  const deep = options.chapter ? deepLinkFor(site, options.chapter) : null
  const href = `${relativePath(slug, site.entryPath)}${deep?.hash ?? ""}`
  const artChildren: ElementContent[] = [coverArt(site, slug)]
  if (site.type) {
    artChildren.push(el("span", { className: ["bwz-ia-type"] }, [site.type]))
  }

  const titleLink = el("a", externalProps(href), [
    site.title,
    el("span", { className: ["bwz-ia-ext"], "aria-hidden": "true" }, ["↗"]),
    newTabText(),
  ])
  const titleTag = options.chapter ? "h4" : "h3"
  const plaqueChildren: ElementContent[] = [
    el(titleTag, { className: ["bwz-ia-title"] }, [titleLink]),
    el("p", { className: ["bwz-ia-desc"] }, [site.description]),
  ]
  if (deep) {
    plaqueChildren.push(el("p", { className: ["bwz-ia-deep"] }, [deep.label]))
  }
  if (options.wide) {
    plaqueChildren.push(...coverageCells(site))
  }

  return el("article", { className: ["bwz-ia-frame"] }, [
    el("a", {
      ...externalProps(href),
      className: ["bwz-ia-art"],
      tabIndex: -1,
      "aria-hidden": "true",
    }, artChildren),
    el("div", { className: ["bwz-ia-plaque"] }, plaqueChildren),
  ])
}

export function buildTopLine(sites: readonly InteractiveSite[]): Element {
  return el("a", { className: ["bwz-ia-line"], href: `#${WORDS.interactive}` }, [
    el("span", { className: ["bwz-ia-line-label"] }, [
      `${WORDS.linePrefix}${sites.length}${WORDS.lineSuffix}`,
    ]),
    el("span", { className: ["bwz-ia-line-names"] }, [
      sites.map((site) => site.title).join("、"),
    ]),
    el("span", { className: ["bwz-ia-line-arrow"], "aria-hidden": "true" }, ["↓"]),
  ])
}

export function buildChapterCard(
  sites: readonly InteractiveSite[],
  slug: string,
  ref: ChapterRef,
): ElementContent[] {
  const heading = el("h3", { id: WORDS.interactive }, [
    el("span", { "aria-hidden": "true" }, ["🕹️ "]),
    WORDS.interactive,
  ])
  const section = el("section", {
    className: ["bwz-ia-chapter"],
    "aria-labelledby": WORDS.interactive,
  }, [
    el("div", { className: ["bwz-ia-wall"] }, [
      ...sites.map((site) => buildFrame(site, slug, { chapter: ref })),
    ]),
    el("a", {
      className: ["bwz-ia-all"],
      href: relativePath(slug, "appendix/website/"),
    }, [WORDS.allSites]),
  ])
  return [heading, txt("\n"), section]
}

function appendixBounds(root: Root): { start: number; end: number } | null {
  for (let index = 0; index < root.children.length; index += 1) {
    const node = elementAt(root, index)
    if (!node || node.tagName !== "h2" || normalizedHeading(node) !== WORDS.appendix) continue

    let end = index + 1
    while (end < root.children.length) {
      const candidate = elementAt(root, end)
      if (
        candidate &&
        (candidate.tagName === "h2" || candidate.tagName === "details" || isNavigationTable(candidate))
      ) break
      end += 1
    }
    return { start: index, end }
  }
  return null
}

function oldInteractiveListEnd(root: Root, headingIndex: number, limit: number): number {
  let next = headingIndex + 1
  while (next < limit) {
    const node = root.children[next]
    if (node.type === "text" && !node.value.trim()) {
      next += 1
      continue
    }
    return node.type === "element" && node.tagName === "ul" ? next + 1 : headingIndex + 1
  }
  return headingIndex + 1
}

/**
 * 舊格式（例如 test_content）把「互動網站」放在附錄以外的段落（「相關資源」底下）。
 * 決策是小卡取代筆記庫的清單、兩者不同時出現，所以附錄外的那一份也拿掉；小卡仍放在附錄。
 */
function removeStrayInteractiveList(root: Root): void {
  const appendix = appendixBounds(root)
  for (let index = 0; index < root.children.length; index += 1) {
    if (appendix && index > appendix.start && index < appendix.end) continue
    const node = elementAt(root, index)
    if (node?.tagName !== "h3" || normalizedHeading(node) !== WORDS.interactive) continue
    root.children.splice(index, oldInteractiveListEnd(root, index, root.children.length) - index)
    return
  }
}

function bottomNavigationIndex(root: Root, verseIndex: number | null): number | null {
  for (let index = root.children.length - 1; index >= 0; index -= 1) {
    if (verseIndex !== null && index <= verseIndex) break
    const node = elementAt(root, index)
    if (node && isNavigationTable(node)) return index
  }
  return null
}

function findCardPlacement(root: Root, verseIndex: number | null): CardPlacement {
  const appendix = appendixBounds(root)
  if (appendix) {
    for (let index = appendix.start + 1; index < appendix.end; index += 1) {
      const node = elementAt(root, index)
      if (node?.tagName === "h3" && normalizedHeading(node) === WORDS.interactive) {
        return {
          kind: "replace",
          start: index,
          end: oldInteractiveListEnd(root, index, appendix.end),
        }
      }
    }
    return { kind: "appendix", index: appendix.end }
  }

  return {
    kind: "newAppendix",
    index: bottomNavigationIndex(root, verseIndex) ?? root.children.length,
  }
}

function insertChapterCard(
  root: Root,
  placement: CardPlacement,
  card: ElementContent[],
): void {
  if (placement.kind === "replace") {
    root.children.splice(placement.start, placement.end - placement.start, ...card)
    return
  }

  if (placement.kind === "appendix") {
    root.children.splice(placement.index, 0, ...card, txt("\n"))
    return
  }

  root.children.splice(
    placement.index,
    0,
    el("h2", { id: WORDS.appendix }, [WORDS.appendix]),
    txt("\n"),
    ...card,
    txt("\n"),
  )
}

function verseListRootIndex(root: Root): number | null {
  const { descriptions, rootIndices } = describeChapterNodes(root)
  const selected = selectChapterRegions(descriptions)
  return selected.verseListIndex === null ? null : rootIndices[selected.verseListIndex]
}

function hallHeading(title: string): Element {
  return el("h2", { className: ["bwz-ia-hall"], id: title }, [
    el("span", {}, [title]),
  ])
}

function chapterMarker(
  slug: string,
  existingSlugs: ReadonlySet<string>,
  book: ReturnType<typeof axisGroups>[number]["book"],
  chapters: number[],
): Element {
  const firstSlug = chapterSlug(book, chapters[0])
  const label = `${book.name} ${formatRanges(chapters)}${WORDS.chapterUnit}`
  const props: Element["properties"] = { className: ["bwz-ia-ch"] }
  if (!existingSlugs.has(firstSlug)) return el("span", props, [label])
  return el("a", { ...props, href: relativePath(slug, firstSlug) }, [label])
}

function buildAxis(
  sites: readonly InteractiveSite[],
  slug: string,
  existingSlugs: ReadonlySet<string>,
): Element | null {
  const groups = axisGroups(sites)
  if (!groups.length) return null

  const items: Element[] = []
  let stopIndex = 0
  for (const group of groups) {
    items.push(el("li", { className: ["bwz-ia-book"] }, [
      el("span", { className: ["bwz-ia-book-name"] }, [group.book.name]),
    ]))
    for (const item of group.items) {
      const side = stopIndex % 2 === 0 ? "bwz-ia-l" : "bwz-ia-r"
      items.push(el("li", { className: ["bwz-ia-stop", side] }, [
        chapterMarker(slug, existingSlugs, group.book, item.chapters),
        buildFrame(item.site, slug),
      ]))
      stopIndex += 1
    }
  }

  return el("div", { className: ["bwz-ia-scroll"] }, [
    el("span", { className: ["bwz-ia-rod"], "aria-hidden": "true" }),
    el("ol", { className: ["bwz-ia-axis"] }, items),
    el("span", { className: ["bwz-ia-rod"], "aria-hidden": "true" }),
  ])
}

export function buildHub(
  sites: readonly InteractiveSite[],
  slug: string,
  existingSlugs: ReadonlySet<string>,
): Element {
  const children: ElementContent[] = [
    el("p", { className: ["bwz-ia-intro"] }, [WORDS.intro]),
  ]
  const wide = wideSites(sites)
  if (wide.length) {
    children.push(
      hallHeading(WORDS.wideHeading),
      el("div", { className: ["bwz-ia-wall"] }, [
        ...wide.map((site) => buildFrame(site, slug, { wide: true })),
      ]),
    )
  }

  const axis = buildAxis(sites, slug, existingSlugs)
  if (axis) children.push(hallHeading(WORDS.axisHeading), axis)

  return el("div", { className: ["bwz-ia-hub"] }, children)
}

function applyHub(root: Root, ctx: InteractiveHastContext): boolean {
  if (hasTopLevelClass(root, "bwz-ia-hub")) return false

  const firstH1 = root.children.findIndex(
    (node) => node.type === "element" && node.tagName === "h1",
  )
  const sourceStart = firstH1 < 0 ? 0 : firstH1 + 1
  const preserved = root.children.slice(0, sourceStart)
  // 文章的第一層是 ElementContent；保留原節點實體與順序，供折疊後的來源清單使用。
  const sourceChildren = root.children.slice(sourceStart) as ElementContent[]
  const source = el("details", { className: ["bwz-ia-source"] }, [
    el("summary", {}, [WORDS.sourceHeading]),
    ...sourceChildren,
  ])

  root.children = [
    ...preserved,
    buildHub(ctx.registry.sites, ctx.slug, ctx.existingSlugs),
    source,
  ]
  return true
}

function applyChapter(
  root: Root,
  ctx: InteractiveHastContext,
  ref: ChapterRef,
): boolean {
  const sites = sitesForChapter(ctx.registry.sites, ref)
  if (!sites.length) return false
  if (hasTopLevelClass(root, "bwz-ia-line") || hasTopLevelClass(root, "bwz-ia-chapter")) {
    return false
  }

  removeStrayInteractiveList(root)
  const verseIndex = verseListRootIndex(root)
  const placement = findCardPlacement(root, verseIndex)
  insertChapterCard(root, placement, buildChapterCard(sites, ctx.slug, ref))

  // 小卡插入會改變索引，重新描述節點才能把上方一行緊貼經文清單。
  const currentVerseIndex = verseListRootIndex(root)
  if (currentVerseIndex !== null) {
    root.children.splice(currentVerseIndex, 0, buildTopLine(sites))
  }
  return true
}

/** 依頁面種類就地修改 root.children；其他頁面完全不動。 */
export function applyInteractiveSites(root: Root, ctx: InteractiveHastContext): boolean {
  if (ctx.slug === HUB_SLUG) return applyHub(root, ctx)

  const parsed = parseBookSlug(ctx.slug)
  if (!parsed || parsed.kind !== "chapter" || parsed.chapter === undefined) return false
  return applyChapter(root, ctx, { book: parsed.book.num, chapter: parsed.chapter })
}
