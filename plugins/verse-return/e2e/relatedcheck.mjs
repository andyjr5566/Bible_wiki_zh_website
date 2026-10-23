// 用法：node plugins/verse-return/e2e/relatedcheck.mjs <root> <profileRoot> <shotDir>
import {
  clickSel,
  mouse,
  open,
  scrollY,
  sleep,
  urlPath,
  waitFor,
} from "./helpers.mjs"

const root = (process.argv[2] ?? "").replace(/\/+$/, "")
const profileRoot = process.argv[3] ?? ""
const shotDir = process.argv[4] ?? ""
const chapter12 = "/" + encodeURI("02-出埃及記/第12章")
const chapterJoshua3 = "/" + encodeURI("06-約書亞記/第3章")
const targetSlug = "02-出埃及記/第12章"
const targetAnchorSelector = `h4 > a[data-slug="${targetSlug}"]`
const targetAnchorExpr = `document.querySelector(${JSON.stringify(targetAnchorSelector)})`

const desktop = await open({
  root,
  profileRoot,
  shotDir,
  theme: "light",
  width: 1440,
  height: 900,
  detailMax: 1200,
})

const stateExpr = `(() => {
  const button = document.querySelector("button.bwz-vr-related")
  const anchor = ${targetAnchorExpr}
  const heading = anchor?.closest("h4")
  const rect = heading?.getBoundingClientRect()
  const sidebar = document.querySelector(".sidebar.left")
  const sr = sidebar?.getBoundingClientRect()
  const hr = heading?.getBoundingClientRect()
  const sidebarVisible = !!sidebar && getComputedStyle(sidebar).display !== "none" &&
    getComputedStyle(sidebar).visibility !== "hidden" && !!sr?.width && !!sr?.height
  const overlapsSidebar = !!sidebarVisible && !!hr &&
    hr.left < sr.right && sr.left < hr.right && hr.top < sr.bottom && sr.top < hr.bottom
  const details = []
  for (let d = heading?.closest("details"); d; d = d.parentElement?.closest("details")) {
    details.push(d.open)
  }
  return JSON.stringify({
    button: button ? { text: button.textContent.trim(), aria: button.getAttribute("aria-label") } : null,
    heading: heading ? { top: rect.top, flash: heading.classList.contains("bwz-vr-flash") } : null,
    details,
    overlapsSidebar,
  })
})()`

async function report(s, name, ok, extra = "") {
  const [path, y, state] = await Promise.all([
    urlPath(s).catch(() => "無法讀取網址"),
    scrollY(s).catch(() => "無法讀取"),
    s.ev(stateExpr).catch(() => "無法讀取相關元素"),
  ])
  s.check(name, Boolean(ok), `網址=${path} scrollY=${y} 狀態=${state}${extra ? ` ${extra}` : ""}`)
}

// 點擊前先移開游標，避免預覽層擋住目標。
async function clickElement(s, elementExpr) {
  await mouse(s, 2, 2, "move")
  await sleep(600)
  const point = await s.ev(`(() => {
    const el = ${elementExpr}
    if (!el) return null
    el.scrollIntoView({ block: "center", behavior: "instant" })
    const r = el.getClientRects()[0]
    return r && r.width && r.height
      ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      : null
  })()`)
  if (!point) return false
  await mouse(s, point.x, point.y)
  return true
}

const verseLinkExpr = `(() => {
  const article = document.querySelector("article")
  if (!article) return null
  const firstHr = article.querySelector("hr")
  const lists = [...article.querySelectorAll("ol")]
  const list = lists.find((ol) =>
    !firstHr || (ol.compareDocumentPosition(firstHr) & Node.DOCUMENT_POSITION_FOLLOWING)
  ) || lists[0]
  if (!list) return null
  const items = [...list.children].filter((el) => el.tagName === "LI")
  const sixthLink = items[5]?.querySelector("a.internal")
  if (sixthLink) return sixthLink
  return items.find((li) => li.querySelector("a.internal"))?.querySelector("a.internal") || null
})()`

async function goChapter(s, path = chapter12) {
  await s.go(path, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)
}

async function reachVerseEntry(s, scenario, device) {
  await goChapter(s)
  const clicked = await clickElement(s, verseLinkExpr)
  await report(s, `${scenario} ${device}：點擊經文連結`, clicked)
  const reached = clicked && Boolean(await waitFor(s, `location.pathname.includes("/link_folder/")`, 8000))
  await report(s, `${scenario} ${device}：到達條目頁`, reached)
  if (!reached) return null
  return s.ev(`location.pathname + location.search + location.hash`)
}

function relativePathFromRoot(rawUrl) {
  const current = new URL(rawUrl, root)
  const base = new URL(root).pathname.replace(/\/+$/, "")
  let path = current.pathname.startsWith(base) ? current.pathname.slice(base.length) : current.pathname
  if (!path.startsWith("/")) path = "/" + path
  return path + current.search + current.hash
}

async function checkRelatedButton(s, scenario, device, { detailed = false, screenshot = "" } = {}) {
  const buttonAppeared = Boolean(await waitFor(s, `!!document.querySelector("button.bwz-vr-related")`, 6000))
  await report(s, `${scenario} ${device}：相關內容按鈕出現`, buttonAppeared)

  const labels = await s.ev(`(() => {
    const b = document.querySelector("button.bwz-vr-related")
    return b ? JSON.stringify({ text: b.textContent.trim(), aria: b.getAttribute("aria-label") }) : "null"
  })()`)
  let parsedLabels = null
  try { parsedLabels = JSON.parse(labels) } catch {}
  await report(
    s,
    `${scenario} ${device}：按鈕文字正確`,
    parsedLabels?.text === "↓ 出埃及記 12 的相關內容",
  )
  if (detailed) {
    await report(
      s,
      `${scenario} ${device}：按鈕 aria-label 正確`,
      parsedLabels?.aria === "跳到本條目中出埃及記第 12 章的相關內容",
    )
    const placement = await s.ev(`(() => {
      const h1 = document.querySelector("article .markdown-rendered > h1:first-of-type")
      const button = document.querySelector("button.bwz-vr-related")
      const h2 = document.querySelector("article .markdown-rendered h2")
      if (!h1 || !button) return false
      const followsTitle = !!(h1.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)
      const beforeFirstH2 = !h2 ||
        !!(button.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING)
      return h1.nextElementSibling === button || (followsTitle && beforeFirstH2)
    })()`)
    await report(s, `${scenario} ${device}：按鈕位於標題下方`, placement)
    await report(s, `${scenario} ${device}：按鈕出現時位於頁首`, (await scrollY(s)) < 120)
  }

  if (!detailed) return
  const clicked = buttonAppeared && await clickElement(s, `document.querySelector("button.bwz-vr-related")`)
  await report(s, `${scenario} ${device}：按下相關內容按鈕`, clicked)

  const headingState = await s.ev(`(() => {
    const anchor = ${targetAnchorExpr}
    const heading = anchor?.closest("h4")
    if (!heading) return JSON.stringify({ found: false })
    const details = []
    for (let d = heading.closest("details"); d; d = d.parentElement?.closest("details")) details.push(d.open)
    const r = heading.getBoundingClientRect()
    const sidebar = document.querySelector(".sidebar.left")
    const sr = sidebar?.getBoundingClientRect()
    const sidebarVisible = !!sidebar && getComputedStyle(sidebar).display !== "none" &&
      getComputedStyle(sidebar).visibility !== "hidden" && !!sr?.width && !!sr?.height
    const overlapsSidebar = !!sidebarVisible &&
      r.left < sr.right && sr.left < r.right && r.top < sr.bottom && sr.top < r.bottom
    return JSON.stringify({
      found: true,
      top: r.top,
      height: innerHeight,
      details,
      flash: heading.classList.contains("bwz-vr-flash"),
      overlapsSidebar,
    })
  })()`)
  let heading = null
  try { heading = JSON.parse(headingState) } catch {}
  const detailsOpen = Boolean(heading?.found) && heading.details.every(Boolean)
  await report(s, `${scenario} ${device}：目標章節的 details 全部展開`, detailsOpen)

  const topInRange = Boolean(heading?.found) && heading.top >= 0 && heading.top <= heading.height * 0.4
  const visibleOnMobile = device !== "手機" || !heading?.overlapsSidebar
  await report(
    s,
    `${scenario} ${device}：章節標題位置正確`,
    topInRange && visibleOnMobile,
  )
  await report(s, `${scenario} ${device}：章節標題有閃示標記`, Boolean(heading?.flash))
  if (screenshot) await s.shot(screenshot)

  await sleep(3500)
  const flashRemoved = await s.ev(`!${targetAnchorExpr}?.closest("h4")?.classList.contains("bwz-vr-flash")`)
  await report(s, `${scenario} ${device}：閃示標記已移除`, flashRemoved)
}

async function findKnowledgeLink(s) {
  await goChapter(s)
  await s.ev(`(() => {
    const details = [...document.querySelectorAll("details")].find((d) =>
      d.querySelector("summary")?.textContent.includes("本章知識節點")
    )
    if (details) details.open = true
  })()`)
  return clickElement(s, `(() => {
    const details = [...document.querySelectorAll("details")].find((d) =>
      d.querySelector("summary")?.textContent.includes("本章知識節點")
    )
    // 標題旁的錨點（role=anchor，#主題）不會換頁，要挑連到條目頁的連結
    return details?.querySelector('a.internal[href*="link_folder"]:not([role="anchor"])') || null
  })()`)
}

async function summaryLinkExpr(s) {
  return s.ev(`(() => {
    const article = document.querySelector("article")
    if (!article) return null
    const structure = [...article.querySelectorAll("h2, details")]
    const matchesTitle = (el) => {
      const title = el.tagName === "H2" ? el.textContent : el.querySelector("summary")?.textContent
      return !!title && title.includes("本章整理")
    }
    const index = structure.findIndex(matchesTitle)
    if (index < 0) return false
    const boundary = structure[index + 1] || null
    const links = [...article.querySelectorAll('a.internal[href*="link_folder"]')]
    const link = links.find((a) => {
      if (!(structure[index].compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)) return false
      return !boundary || !!(a.compareDocumentPosition(boundary) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    return !!link
  })()`)
    .then((found) => found)
}

const summaryLinkElementExpr = `(() => {
  const article = document.querySelector("article")
  if (!article) return null
  const structure = [...article.querySelectorAll("h2, details")]
  const matchesTitle = (el) => {
    const title = el.tagName === "H2" ? el.textContent : el.querySelector("summary")?.textContent
    return !!title && title.includes("本章整理")
  }
  const index = structure.findIndex(matchesTitle)
  if (index < 0) return null
  const boundary = structure[index + 1] || null
  return [...article.querySelectorAll('a.internal[href*="link_folder"]')].find((a) => {
    if (!(structure[index].compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)) return false
    return !boundary || !!(a.compareDocumentPosition(boundary) & Node.DOCUMENT_POSITION_FOLLOWING)
  }) || null
})()`

async function scenario1(s, device, screenshot) {
  const entryUrl = await reachVerseEntry(s, "1", device)
  await checkRelatedButton(s, "1", device, { detailed: true, screenshot })
  return entryUrl ? relativePathFromRoot(entryUrl) : null
}

const desktopErrorsStart = desktop.errors.length
const entryPath = await scenario1(desktop, "桌機", "relatedcheck-desktop-01")

// 情境 2：展開本章知識節點，點第一個站內連結。
await goChapter(desktop)
const knowledgeClicked = await findKnowledgeLink(desktop)
await report(desktop, "2 桌機：點擊本章知識節點連結", knowledgeClicked)
const knowledgeReached = knowledgeClicked && Boolean(await waitFor(desktop, `location.pathname.includes("/link_folder/")`, 8000))
await report(desktop, "2 桌機：到達條目頁", knowledgeReached)
await checkRelatedButton(desktop, "2", "桌機")

// 情境 3：只找本章整理區塊到下一個標題／details 之間的連結。
await goChapter(desktop)
const summaryHasLink = await sValue(desktop, summaryLinkElementExpr)
if (!summaryHasLink) {
  console.log("SKIP  3 桌機：本章整理區塊沒有 link_folder 連結")
} else {
  const summaryClicked = await clickElement(desktop, summaryLinkElementExpr)
  await report(desktop, "3 桌機：點擊本章整理連結", summaryClicked)
  const summaryReached = summaryClicked && Boolean(await waitFor(desktop, `location.pathname.includes("/link_folder/")`, 8000))
  await report(desktop, "3 桌機：到達條目頁", summaryReached)
  await checkRelatedButton(desktop, "3", "桌機")
}

// 情境 4：直接開條目，不應帶有一次性落點。
if (entryPath) {
  await desktop.go(entryPath, 4000)
  await report(desktop, "4 桌機：直接開條目沒有相關內容按鈕", !(await desktop.ev(`!!document.querySelector("button.bwz-vr-related")`)))
} else {
  await report(desktop, "4 桌機：直接開條目沒有相關內容按鈕", false, "情境 1 未取得條目網址")
}

// 情境 5：重新整理會清掉一次性落點。
if (entryPath) {
  const reached = await reachVerseEntry(desktop, "5", "桌機")
  if (reached) {
    await desktop.send("Page.reload")
    await sleep(4000)
    await report(desktop, "5 桌機：重新整理後沒有相關內容按鈕", !(await desktop.ev(`!!document.querySelector("button.bwz-vr-related")`)))
  } else {
    await report(desktop, "5 桌機：重新整理後沒有相關內容按鈕", false, "無法再次由經文進入條目")
  }
} else {
  await report(desktop, "5 桌機：重新整理後沒有相關內容按鈕", false, "情境 1 未取得條目網址")
}

// 情境 6：從條目跳到另一個條目時，不沿用舊落點。
if (entryPath) {
  const reached = await reachVerseEntry(desktop, "6", "桌機")
  if (reached) {
    const oldPath = await desktop.ev("location.pathname")
    const otherLinkExpr = `(() => [...document.querySelectorAll("article a.internal[href]")].find((a) => {
      // 跳過章節小標題裡的連結、標題錨點和同頁連結（後兩者不會換頁）
      if (a.closest("h4") || a.getAttribute("role") === "anchor" || a.pathname === location.pathname) return false
      let href = a.href
      try { href = decodeURIComponent(href) } catch {}
      return href.includes("/link_folder/") || (a.dataset.slug || "").startsWith("link_folder/")
    }) || null)()`
    const clicked = await clickElement(desktop, otherLinkExpr)
    await report(desktop, "6 桌機：點擊條目內另一個條目連結", clicked)
    const navigated = clicked && Boolean(await waitFor(
      desktop,
      `location.pathname !== ${JSON.stringify(oldPath)} && location.pathname.includes("/link_folder/")`,
      8000,
    ))
    await report(desktop, "6 桌機：到達另一個條目頁", navigated)
    await sleep(4000)
    await report(desktop, "6 桌機：新條目沒有相關內容按鈕", !(await desktop.ev(`!!document.querySelector("button.bwz-vr-related")`)))
  } else {
    await report(desktop, "6 桌機：新條目沒有相關內容按鈕", false, "無法再次由經文進入條目")
  }
} else {
  await report(desktop, "6 桌機：新條目沒有相關內容按鈕", false, "情境 1 未取得條目網址")
}

// 情境 7：比利洗人條目裡約書亞記 3 章那一段沒有 accumulation 註解標記，但 h4 在，所以按鈕要出現
// （按鈕只看 h4 > a[data-slug]，不靠註解）。找不到連結就略過。
await goChapter(desktop, chapterJoshua3)
const peopleLinkExpr = `(() => [...document.querySelectorAll("article a.internal[href]")].find((a) => {
  let href = a.getAttribute("href") || ""
  try { href = decodeURIComponent(href) } catch {}
  return href.includes("比利洗人")
}) || null)()`
const peopleLinkExists = await desktop.ev(`!!(${peopleLinkExpr})`)
if (!peopleLinkExists) {
  console.log("SKIP  7 桌機：找不到 href 含比利洗人的文章連結")
} else {
  const clicked = await clickElement(desktop, peopleLinkExpr)
  await report(desktop, "7 桌機：點擊比利洗人文章連結", clicked)
  const navigated = clicked && Boolean(await waitFor(desktop, `location.pathname !== ${JSON.stringify(chapterJoshua3)} || location.pathname.includes("/link_folder/")`, 8000))
  await report(desktop, "7 桌機：離開 Joshua 3 頁面", navigated)
  await sleep(4000)
  await report(desktop, "7 桌機：沒有註解標記的章節段落也有相關內容按鈕", await desktop.ev(`document.querySelector("button.bwz-vr-related")?.textContent === "↓ 約書亞記 3 的相關內容"`))
}

// 情境 8：只封鎖 sessionStorage；其他外掛可能因此回報自己的 SecurityError。
const blockedStorageScript = `(() => {
  try {
    const original = window.sessionStorage
    const blocked = new Proxy(original, {
      get(target, key) {
        if (["getItem", "setItem", "removeItem"].includes(key)) {
          return () => { throw new DOMException("blocked", "SecurityError") }
        }
        const value = Reflect.get(target, key, target)
        return typeof value === "function" ? value.bind(target) : value
      },
      set(target, key, value) { return Reflect.set(target, key, value, target) },
    })
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => blocked })
  } catch {}
})()`
const blocked = await open({
  root,
  profileRoot,
  shotDir,
  theme: "light",
  width: 1440,
  height: 900,
  detailMax: 1200,
  extraScript: blockedStorageScript,
})
const blockedErrorsStart = blocked.errors.length
const blockedEntryUrl = await reachVerseEntry(blocked, "8", "桌機")
await sleep(4000)
await report(
  blocked,
  "8 桌機：封鎖儲存時沒有相關內容按鈕",
  !(await blocked.ev(`!!document.querySelector("button.bwz-vr-related")`)),
)
const relatedErrors = blocked.errors.slice(blockedErrorsStart).filter((error) =>
  /bwz-entry-landing|relatedButton/i.test(error),
)
await report(
  blocked,
  "8 桌機：落點相關腳本沒有例外",
  relatedErrors.length === 0,
  `相關例外=${JSON.stringify(relatedErrors)}`,
)

// 情境 9：Mermaid 解析錯誤是內容問題，其餘頁面例外都要回報。
const desktopErrors = desktop.errors.slice(desktopErrorsStart).filter((error) =>
  !String(error).includes("Parse error on line"),
)
await report(
  desktop,
  "9 桌機：情境 1～7 沒有 JavaScript 例外",
  desktopErrors.length === 0,
  `例外=${JSON.stringify(desktopErrors)}`,
)

// 手機使用獨立的深色 profile，只跑情境 1、2。
const mobile = await open({
  root,
  profileRoot,
  shotDir,
  theme: "dark",
  width: 390,
  height: 844,
  mobile: true,
  detailMax: 1200,
})
const mobileErrorsStart = mobile.errors.length
await scenario1(mobile, "手機", "relatedcheck-mobile-01")
await goChapter(mobile)
const mobileKnowledgeClicked = await findKnowledgeLink(mobile)
await report(mobile, "2 手機：點擊本章知識節點連結", mobileKnowledgeClicked)
const mobileKnowledgeReached = mobileKnowledgeClicked &&
  Boolean(await waitFor(mobile, `location.pathname.includes("/link_folder/")`, 8000))
await report(mobile, "2 手機：到達條目頁", mobileKnowledgeReached)
await checkRelatedButton(mobile, "2", "手機")

const mobileErrors = mobile.errors.slice(mobileErrorsStart).filter((error) =>
  !String(error).includes("Parse error on line"),
)
await report(
  mobile,
  "9 手機：情境 1～2 沒有 JavaScript 例外",
  mobileErrors.length === 0,
  `例外=${JSON.stringify(mobileErrors)}`,
)

// finish() 會直接 process.exit；攔下它才能逐一關閉每個 Chrome。
function finishAll(sessions) {
  const originalExit = process.exit
  let exitCode = 0
  process.exit = (code) => {
    if (code === 1) exitCode = 1
  }
  try {
    for (const s of sessions) s.finish()
  } finally {
    process.exit = originalExit
  }
  process.exitCode = exitCode
}

finishAll([desktop, blocked, mobile])

async function sValue(s, expression) {
  return s.ev(expression)
}
