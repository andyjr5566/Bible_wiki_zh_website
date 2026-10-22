// 純經文模式的無頭 Chrome 檢查；用法：node plugins/site-ux/e2e/purecheck.mjs <siteRoot> <profileRoot> [shotDir]
// siteRoot 不加結尾斜線；Chrome 設定檔與可選截圖都放在命令列指定的資料夾。
// 依附檔的選擇器：.site-ux-btn、#site-ux-panel、[data-name="view"]、#site-ux-note-view、
// html[data-ux-view]、html[data-ux-marked]、.bwz-ux-hide、.bwz-ux-reveal、.bwz-cqb-summary。
// 區塊依 article 內文第一層標題辨認；前後章導覽依 .table-container 的文字辨認。
// 附檔定義的事件有 nav、prenav、hashchange、bwz:reveal；此檢查以換頁及錨點行為驗證其效果。
// 條件式項目：內容區塊、導覽表格、朗讀列、筆記區、快捷列、整理小標題 id、首頁 link_folder 連結。
// 這些項目依測試站實際 DOM 判定；找不到時會記為條件式略過並說明原因。

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"
import { chapterPath, mouse } from "../../verse-return/e2e/helpers.mjs"

const [ROOT, PROFILE_ROOT, SHOT_DIR] = process.argv.slice(2)
if (!ROOT || !PROFILE_ROOT || ROOT.endsWith("/")) {
  console.error("用法：node plugins/site-ux/e2e/purecheck.mjs <siteRoot，不加結尾斜線> <profileRoot> [shotDir]")
  process.exit(2)
}

mkdirSync(PROFILE_ROOT, { recursive: true })
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true })

const SECTION_LABELS = ["本章知識節點", "本章整理", "附錄"]
const NOTE_TEXT = "只看經文，暫時隱藏本章知識節點、本章整理和附錄；只在這個分頁有效，關掉就恢復研讀。"
const CHROME_PROFILE = join(PROFILE_ROOT, `purecheck-${Date.now()}-${Math.floor(Math.random() * 100000)}`)
const RELEVANT_URL = /site-ux|verse-return|appearance\.inline|early\.inline|pureMode|readingView|verseReturn/i

let s
const conditionalItems = []
const pluginExceptions = []

function skip(name, reason) {
  conditionalItems.push(`${name}：${reason}`)
  s.check(`${name}（條件式略過）`, true, reason)
}

function visibleExpression(element) {
  return `(() => {
    if (!${element}) return false
    const e = ${element}
    const cs = getComputedStyle(e)
    return cs.display !== "none" && cs.visibility !== "hidden" &&
      Number(cs.opacity || "1") > 0 && (e.offsetWidth > 0 || e.offsetHeight > 0 || e.getClientRects().length > 0)
  })()`
}

async function waitFor(expression, ms = 6000) {
  let value
  for (let elapsed = 0; elapsed < ms; elapsed += 150) {
    value = await s.ev(expression)
    if (value) return value
    await sleep(150)
  }
  return value
}

async function go(path, wait = 3500) {
  await s.send("Page.navigate", { url: ROOT + path })
  await sleep(wait)
}

async function goUrl(url, wait = 3500) {
  await s.send("Page.navigate", { url })
  await sleep(wait)
}

async function openPanel() {
  const button = await s.ev(`document.querySelector(".site-ux-btn")`)
  if (!button) return false
  if (!(await s.ev(`!!document.querySelector("#site-ux-panel")`))) {
    await s.ev(`document.querySelector(".site-ux-btn")?.click()`)
  }
  return !!(await waitFor(`!!document.querySelector("#site-ux-panel")`, 2500))
}

async function closePanel() {
  if (await s.ev(`!!document.querySelector("#site-ux-panel")`)) {
    await s.ev(`document.querySelector(".site-ux-btn")?.click()`)
    await sleep(150)
  }
}

async function choose(name, value) {
  if (!(await openPanel())) return false
  // 選擇器本身含雙引號，所以用 JSON.stringify 包成字串常值，不能直接嵌進另一對雙引號
  const selector = JSON.stringify(`#site-ux-panel [data-name="${name}"][data-value="${value}"]`)
  const exists = await s.ev(`!!document.querySelector(${selector})`)
  if (!exists) return false
  await s.ev(`document.querySelector(${selector})?.click()`)
  await sleep(250)
  return true
}

function sectionSnapshotExpression() {
  return `(() => {
    const article = document.querySelector("article")
    const root = article?.querySelector(":scope > .markdown-preview-view") || article
    if (!root) return JSON.stringify({ sections: {}, hidden: [], hrs: [] })
    const children = [...root.children]
    const labels = ${JSON.stringify(SECTION_LABELS)}
    const norm = (v) => (v || "").replace(/\\s+/g, "").trim()
    const titleOf = (el) => {
      if (el.matches("h2")) return el.textContent
      if (el.matches("details")) return el.querySelector(":scope > summary .collapsible-title")?.textContent ||
        el.querySelector(":scope > summary")?.textContent || ""
      return ""
    }
    const shown = (el) => {
      const cs = getComputedStyle(el)
      return cs.display !== "none" && cs.visibility !== "hidden" &&
        Number(cs.opacity || "1") > 0 && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
    }
    const sections = {}
    for (const label of labels) {
      const wanted = norm(label)
      const el = children.find((node) => norm(titleOf(node)).includes(wanted))
      sections[label] = el ? {
        found: true,
        visible: shown(el),
        display: getComputedStyle(el).display,
        tag: el.tagName.toLowerCase(),
        hiddenClass: el.classList.contains("bwz-ux-hide"),
        revealClass: el.classList.contains("bwz-ux-reveal"),
      } : { found: false }
    }
    const hidden = [...document.querySelectorAll(".bwz-ux-hide")].map((el) => ({
      tag: el.tagName.toLowerCase(),
      display: getComputedStyle(el).display,
      reveal: el.classList.contains("bwz-ux-reveal"),
      text: (el.textContent || "").trim().slice(0, 60),
    }))
    const hrs = [...document.querySelectorAll(".bwz-ux-hide hr, hr.bwz-ux-hide")].map((el) => ({
      display: getComputedStyle(el).display,
      reveal: el.classList.contains("bwz-ux-reveal"),
    }))
    return JSON.stringify({ sections, hidden, hrs })
  })()`
}

async function sectionSnapshot() {
  const value = await s.ev(sectionSnapshotExpression())
  return value ? JSON.parse(value) : { sections: {}, hidden: [], hrs: [] }
}

function chapterReadyExpression() {
  return `!!document.querySelector("article ol")`
}

async function waitChapter() {
  await waitFor(chapterReadyExpression(), 8000)
  // 只有純經文才會有 data-ux-marked（研讀模式不在 <html> 留屬性）
  await waitFor(`document.documentElement.getAttribute("data-ux-view") !== "pure" || document.documentElement.hasAttribute("data-ux-marked")`, 6000)
  await sleep(250)
}

async function checkSections(mode, snapshot) {
  for (const label of SECTION_LABELS) {
    const state = snapshot.sections[label]
    if (!state?.found) {
      skip(`${mode}：${label}`, "這個章節頁沒有找到對應區塊")
      continue
    }
    s.check(
      `${mode}：${label}${mode === "純經文" ? " 隱藏" : " 看得到"}`,
      mode === "純經文" ? state.display === "none" : state.visible,
      JSON.stringify(state),
    )
  }
}

async function checkChapterParts(mode) {
  const verse = await s.ev(`(() => {
    const e = document.querySelector("article ol")
    if (!e) return { found: false }
    const cs = getComputedStyle(e)
    return { found: true, visible: cs.display !== "none" && cs.visibility !== "hidden" && e.getClientRects().length > 0 }
  })()`)
  if (!verse?.found) skip(`${mode}：經文清單仍看得到`, "頁面沒有 article ol")
  else s.check(`${mode}：經文清單仍看得到`, verse.visible, JSON.stringify(verse))

  const navTables = await s.ev(`(() => {
    const shown = (e) => {
      const cs = getComputedStyle(e)
      return cs.display !== "none" && cs.visibility !== "hidden" && e.getClientRects().length > 0
    }
    return JSON.stringify([...document.querySelectorAll("article .table-container")]
      .filter((e) => /前一章/.test(e.textContent) && /下一章/.test(e.textContent))
      .map((e) => ({ visible: shown(e), display: getComputedStyle(e).display })))
  })()`).then((v) => v ? JSON.parse(v) : [])
  if (navTables.length < 2) {
    skip(`${mode}：上下兩份前一章／下一章表格仍看得到`, `找到 ${navTables.length} 份同時含前一章與下一章的表格`)
  } else {
    s.check(`${mode}：上下兩份前一章／下一章表格仍看得到`, navTables.every((x) => x.visible), JSON.stringify(navTables))
  }

  const readingBar = await s.ev(`(() => {
    const visible = (e) => {
      const cs = getComputedStyle(e)
      return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity || "1") > 0 &&
        (e.offsetWidth > 0 || e.offsetHeight > 0 || e.getClientRects().length > 0)
    }
    const selectors = ".bwz-reading-bar, .bwz-reader-bar, .bwz-audio-player, .bwz-read-aloud, [data-reading-bar]"
    const known = [...document.querySelectorAll(selectors)]
    const labelled = [...document.querySelectorAll("button, [role=button], audio")]
      .filter((e) => /朗讀|播放經文|停止朗讀/.test((e.textContent || "") + " " + (e.getAttribute("aria-label") || "")))
    const e = known[0] || labelled[0]
    return e ? JSON.stringify({ found: true, visible: visible(e), tag: e.tagName.toLowerCase(), className: String(e.className || "") }) :
      JSON.stringify({ found: false })
  })()`).then((v) => v ? JSON.parse(v) : { found: false })
  if (!readingBar.found) skip(`${mode}：朗讀列仍看得到`, "頁面沒有找到已知朗讀列選擇器或朗讀控制")
  else s.check(`${mode}：朗讀列仍看得到`, readingBar.visible, JSON.stringify(readingBar))

  const notes = await s.ev(`(() => {
    const e = document.querySelector(".bwz-notes, #after-body, .after-body")
    if (!e) return JSON.stringify({ found: false })
    const cs = getComputedStyle(e)
    return JSON.stringify({ found: true, visible: cs.display !== "none" && cs.visibility !== "hidden" &&
      (e.offsetWidth > 0 || e.offsetHeight > 0 || e.getClientRects().length > 0), selector: e.className || e.id })
  })()`).then((v) => v ? JSON.parse(v) : { found: false })
  if (!notes.found) skip(`${mode}：筆記區仍看得到`, "afterBody 沒有 .bwz-notes、#after-body 或 .after-body")
  else s.check(`${mode}：筆記區仍看得到`, notes.visible, JSON.stringify(notes))
}

async function findNextChapterTarget(chapterNumber) {
  const value = await s.ev(`(() => {
    const links = [...document.querySelectorAll(".table-container a[href], article a[href]")]
    const target = links.find((a) => {
      let decoded = a.href
      try { decoded = decodeURIComponent(a.href) } catch {}
      const label = (a.textContent || "").trim()
      const context = a.closest(".table-container")?.textContent || ""
      return decoded.includes("第${chapterNumber}章") && (/下一章/.test(label) || /下一章/.test(context))
    })
    if (!target) return null
    // 暫時顯示後頁面已捲到本章整理，連結可能在畫面外；用座標點擊前先捲進畫面
    // 網站預設是平滑捲動：不指定 instant 的話，量到的座標是捲動途中的位置，點下去會點空
    target.scrollIntoView({ block: "center", behavior: "instant" })
    const r = target.getBoundingClientRect()
    return JSON.stringify({ href: target.href, x: r.left + r.width / 2, y: r.top + r.height / 2, label: target.textContent.trim() })
  })()`)
  return value ? JSON.parse(value) : null
}

async function clickNextChapter(chapterNumber) {
  const target = await findNextChapterTarget(chapterNumber)
  if (!target) return false
  await mouse(s, target.x, target.y)
  return !!(await waitFor(`location.pathname.endsWith(${JSON.stringify(encodeURI(`第${chapterNumber}章`))})`, 8000))
}

async function testNonChapter(pageName) {
  await waitChapterOrDocument()
  const count = await s.ev(`document.querySelectorAll(".bwz-ux-hide").length`)
  s.check(`${pageName}：沒有 .bwz-ux-hide`, count === 0, count)

  if (!(await openPanel())) {
    skip(`${pageName}：Aa 沒有閱讀模式選項`, "頁面沒有 .site-ux-btn，無法開啟 Aa 面板")
    return
  }
  const state = await s.ev(`(() => {
    const radios = [...document.querySelectorAll('#site-ux-panel [data-name="view"]')]
    return JSON.stringify({
      offered: radios.length > 0,
      disabled: radios.length > 0 && radios.every((e) => e.disabled || e.getAttribute("aria-disabled") === "true"),
      count: radios.length,
    })
  })()`).then((v) => v ? JSON.parse(v) : { offered: false, disabled: false, count: 0 })
  s.check(`${pageName}：Aa 沒有閱讀模式選項或選項停用`, !state.offered || state.disabled, JSON.stringify(state))
  await closePanel()
}

async function waitChapterOrDocument() {
  await waitFor(`document.readyState === "complete"`, 8000)
  await sleep(500)
}

async function setTheme(theme) {
  await s.ev(`try { localStorage.setItem("theme", ${JSON.stringify(theme)}) } catch (e) {}`)
  await s.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: theme }],
  })
}

async function setModeAndClose(mode) {
  const value = mode === "純經文" ? "pure" : "study"
  const selected = await choose("view", value)
  await closePanel()
  return selected
}

async function saveShot(name) {
  if (!SHOT_DIR) return
  const image = await s.capture()
  if (!image) {
    s.check(`截圖：${name}`, false, "Chrome 沒有回傳截圖資料")
    return
  }
  writeFileSync(join(SHOT_DIR, `${name}.png`), image)
  s.check(`截圖：${name}`, true)
}

async function testMobileQuickbar() {
  console.log("\n== 5. 手機 390：純經文隱藏快捷列整理鈕 ==")
  await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
  await go(chapterPath(1))
  await waitChapter()

  const exists = await s.ev(`!!document.querySelector(".bwz-cqb-summary")`)
  if (!exists) {
    skip("手機：.bwz-cqb-summary", "第 1 章沒有快捷列整理鈕")
    return
  }

  await setModeAndClose("純經文")
  await s.ev(`window.scrollTo(0, Math.max(800, document.documentElement.scrollHeight * 0.65))`)
  await sleep(700)
  const pure = await s.ev(`(() => {
    const e = document.querySelector(".bwz-cqb-summary")
    const cs = e && getComputedStyle(e)
    return !!e && cs.display === "none"
  })()`)
  s.check("手機純經文：快捷列整理鈕 display:none", pure)

  await setModeAndClose("研讀")
  await s.ev(`window.scrollTo(0, Math.max(800, document.documentElement.scrollHeight * 0.65))`)
  await sleep(900)
  const study = await s.ev(visibleExpression(`document.querySelector(".bwz-cqb-summary")`))
  s.check("手機研讀：捲動後快捷列整理鈕看得到", study)
}

async function testReveal() {
  console.log("\n== 6. 純經文錨點：暫時顯示整理區塊，換頁後恢復 ==")
  await s.setViewport(1440, 900)
  await go(chapterPath(1))
  await waitChapter()
  await setModeAndClose("純經文")

  const id = await s.ev(`(() => {
    const article = document.querySelector("article")
    const root = article?.querySelector(":scope > .markdown-preview-view") || article
    if (!root) return null
    const children = [...root.children]
    const norm = (v) => (v || "").replace(/\\s+/g, "").trim()
    const titleOf = (el) => el.matches("h2") ? el.textContent :
      el.matches("details") ? (el.querySelector(":scope > summary .collapsible-title")?.textContent ||
        el.querySelector(":scope > summary")?.textContent || "") : ""
    const index = children.findIndex((e) => norm(titleOf(e)).includes("本章整理"))
    if (index < 0) return null
    for (let i = index + 1; i < children.length; i++) {
      const node = children[i]
      if (node.matches("h2, details")) break
      const heading = node.matches("h3") ? node : node.querySelector("h3")
      if (heading?.id) return heading.id
    }
    return null
  })()`)

  if (!id) {
    skip("純經文錨點暫時顯示", "本章整理沒有帶 id 的 h3 小標題")
    return
  }

  await go(chapterPath(1) + "#" + encodeURIComponent(id), 4000)
  await waitChapter()
  await waitFor(`!!document.querySelector(".bwz-ux-reveal")`, 3000)
  const revealed = await s.ev(`(() => {
    const target = document.getElementById(${JSON.stringify(id)})
    if (!target) return { found: false }
    const root = target.closest(".bwz-ux-reveal")
    const cs = root && getComputedStyle(root)
    return {
      found: true,
      revealClass: !!root,
      visible: !!root && cs.display !== "none" && cs.visibility !== "hidden" && root.getClientRects().length > 0,
      id: target.id,
    }
  })()`)
  s.check("純經文：直接開本章整理 h3 錨點會暫時顯示該區塊", revealed?.found && revealed.revealClass && revealed.visible, JSON.stringify(revealed))

  const otherHidden = await s.ev(`(() => {
    const rest = [...document.querySelectorAll(".bwz-ux-hide:not(.bwz-ux-reveal)")]
    return JSON.stringify({ count: rest.length, allHidden: rest.every((e) => getComputedStyle(e).display === "none") })
  })()`).then((v) => v ? JSON.parse(v) : { count: 0, allHidden: false })
  if (!otherHidden.count) skip("純經文：其他被藏區塊仍藏著", "頁面沒有其他未 reveal 的 .bwz-ux-hide")
  else s.check("純經文：其他被藏區塊仍藏著", otherHidden.allHidden, JSON.stringify(otherHidden))

  const navigated = await clickNextChapter(2)
  s.check("暫時顯示後以 SPA 換到第 2 章", navigated, await s.ev(`location.pathname`))
  if (navigated) {
    await waitChapter()
    const reset = await s.ev(`(() => ({
      pure: document.documentElement.getAttribute("data-ux-view") === "pure",
      reveals: document.querySelectorAll(".bwz-ux-reveal").length,
      hiddenVisible: [...document.querySelectorAll(".bwz-ux-hide:not(.bwz-ux-reveal)")]
        .some((e) => getComputedStyle(e).display !== "none")
    }))()`)
    s.check("SPA 換頁後仍是純經文、暫時顯示已清除", reset?.pure && reset.reveals === 0 && !reset.hiddenVisible, JSON.stringify(reset))
  }
}

async function testSettingsCombination() {
  console.log("\n== 7. Aa 字級與經文連結設定在兩種閱讀模式一致 ==")
  await s.setViewport(1440, 900)
  await go(chapterPath(1))
  await waitChapter()
  await setModeAndClose("研讀")

  const hasLink = await s.ev(`!!(document.querySelector("article ol")?.querySelector("a"))`)
  if (!hasLink) {
    skip("Aa 設定組合比較", "第 1 章經文清單沒有可比較的連結")
    return
  }

  const measure = async () => {
    const raw = await s.ev(`(() => {
      const list = document.querySelector("article ol.bwz-ux-verses") || document.querySelector("article ol")
      const link = list?.querySelector("a")
      if (!list || !link) return null
      const ls = getComputedStyle(list)
      const as = getComputedStyle(link)
      return JSON.stringify({
        fontSize: ls.fontSize,
        link: {
          color: as.color,
          fontSize: as.fontSize,
          textDecorationLine: as.textDecorationLine,
          opacity: as.opacity,
          visibility: as.visibility,
          display: as.display,
        },
      })
    })()`)
    return raw ? JSON.parse(raw) : null
  }

  for (const fontSize of ["s", "m", "l"]) {
    for (const links of ["normal", "quiet", "hidden"]) {
      const fontOk = await choose("fontSize", fontSize)
      const linksOk = await choose("links", links)
      const studyModeOk = await choose("view", "study")
      const study = await measure()
      const pureModeOk = await choose("view", "pure")
      const pure = await measure()
      const ok = fontOk && linksOk && studyModeOk && pureModeOk && !!study && !!pure &&
        JSON.stringify(study) === JSON.stringify(pure)
      s.check(
        `字級 ${fontSize}／經文連結 ${links}：純經文與研讀的計算樣式一致`,
        ok,
        JSON.stringify({ study, pure, choices: { fontOk, linksOk, studyModeOk, pureModeOk } }),
      )
    }
  }
  await setModeAndClose("研讀")
}

async function testNonChapterPages() {
  console.log("\n== 8. 首頁與 link_folder 條目頁不提供純經文 ==")
  await s.setViewport(1440, 900)
  await setModeAndClose("研讀")
  await go("/", 3500)
  await waitChapterOrDocument()
  await testNonChapter("首頁")

  const entry = await s.ev(`(() => {
    const links = [...document.querySelectorAll("a[href]")]
    const decodedPath = (a) => {
      try { return decodeURIComponent(new URL(a.href, location.href).pathname) }
      catch { return a.href }
    }
    const target = links.find((a) => {
      const path = decodedPath(a)
      return /(?:^|\\/)link_folder\\//i.test(path) && new URL(a.href, location.href).origin === location.origin
    })
    return target ? JSON.stringify({ href: target.href, text: target.textContent.trim() }) : null
  })()`)

  if (!entry) {
    skip("link_folder 條目頁 Aa 與隱藏標記檢查", "首頁沒有找到同站的 link_folder/ 連結")
    return
  }

  const target = JSON.parse(entry)
  await goUrl(target.href, 3500)
  await waitChapterOrDocument()
  const slug = await s.ev(`document.body?.dataset.slug || ""`)
  const isChapter = await s.ev(`document.body?.dataset.slug?.includes("/第") && document.body?.dataset.slug?.endsWith("章")`)
  if (isChapter) {
    skip("link_folder 條目頁 Aa 與隱藏標記檢查", `連結目標看起來是章節頁：${slug}`)
    return
  }
  await testNonChapter("link_folder 條目頁")
}

async function testBlockedSessionStorage() {
  console.log("\n== 9. sessionStorage 被封鎖時頁面仍可操作 ==")
  await s.setViewport(1440, 900)
  await setModeAndClose("研讀")
  const blocked = `Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    get() { throw new DOMException("blocked", "SecurityError") }
  });`
  const installed = await s.send("Page.addScriptToEvaluateOnNewDocument", { source: blocked })
  await s.send("Page.reload", { ignoreCache: true })
  await waitChapter()
  await sleep(350)
  const available = await s.ev(`!!document.querySelector('#site-ux-panel [data-name="view"][data-value="pure"]')`)
    .then((v) => !!v)
  if (available) {
    await setModeAndClose("純經文")
    const applied = await waitFor(`document.documentElement.getAttribute("data-ux-view") === "pure"`, 2500)
    s.check("sessionStorage 被封鎖：仍可在本頁切換純經文", !!applied)
  } else {
    s.check("sessionStorage 被封鎖：頁面可用且閱讀模式選項優雅不提供", true)
  }

  await sleep(700)
  const relevant = pluginExceptions.filter((x) => RELEVANT_URL.test(x.url))
  s.check("sessionStorage 被封鎖：site-ux／verse-return 沒有可辨識來源的 JS 例外", relevant.length === 0, JSON.stringify(relevant))
  if (installed?.identifier) {
    await s.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: installed.identifier })
  }
}

async function testFreshTab() {
  console.log("\n== 4. 新分頁回到研讀 ==")
  const browser = await s.openBrowserSocket()
  const created = await browser.send("Target.createTarget", { url: "about:blank" })
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true })
  const sessionId = attached.sessionId
  await browser.send("Page.enable", {}, sessionId)
  await browser.send("Runtime.enable", {}, sessionId)
  await browser.send("Page.navigate", { url: ROOT + chapterPath(1) }, sessionId)

  const evaluate = async (expression) => {
    const result = await browser.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId)
    return result?.result?.value
  }
  let state
  for (let i = 0; i < 60; i++) {
    const raw = await evaluate(`(() => {
      const ready = !!document.querySelector("article ol") && (document.documentElement.getAttribute("data-ux-view") !== "pure" || document.documentElement.hasAttribute("data-ux-marked"))
      return ready ? JSON.stringify({
        attr: document.documentElement.getAttribute("data-ux-view"),
        storage: (() => { try { return sessionStorage.getItem("bwz-ux-view") } catch { return "ERR" } })(),
        studyVisible: (() => {
          const article = document.querySelector("article")
          const root = article?.querySelector(":scope > .markdown-preview-view") || article
          const children = [...(root?.children || [])]
          const title = (e) => e.matches("h2") ? e.textContent :
            e.matches("details") ? (e.querySelector(":scope > summary .collapsible-title")?.textContent ||
              e.querySelector(":scope > summary")?.textContent || "") : ""
          const e = children.find((x) => (title(x) || "").replace(/\\s+/g, "").includes("本章整理"))
          if (!e) return null
          const cs = getComputedStyle(e)
          return cs.display !== "none" && cs.visibility !== "hidden" && e.getClientRects().length > 0
        })()
      }) : null
    })()`)
    if (raw) {
      state = JSON.parse(raw)
      break
    }
    await sleep(150)
  }
  s.check("同一 Chrome 新分頁沒有繼承純經文，回到研讀", !!state && state.attr === null && state.storage === null && state.studyVisible === true, JSON.stringify(state))

  await browser.send("Target.closeTarget", { targetId: created.targetId })
}

async function testFirstPaintAndNavigation() {
  console.log("\n== 3. SPA 換頁、重新整理與第一次繪製 ==")
  const moved = await clickNextChapter(2)
  s.check("純經文時以 SPA 連到第 2 章", moved, await s.ev(`location.pathname`))
  if (!moved) return
  await waitChapter()
  s.check("SPA 換到第 2 章仍是純經文", await s.ev(`document.documentElement.getAttribute("data-ux-view") === "pure"`))

  const captureFirstPaint = `(() => {
    window.__purecheckFirstPaint = null
    document.addEventListener("DOMContentLoaded", () => {
      const article = document.querySelector("article")
      const root = article?.querySelector(":scope > .markdown-preview-view") || article
      const children = [...(root?.children || [])]
      const title = (e) => e.matches("h2") ? e.textContent :
        e.matches("details") ? (e.querySelector(":scope > summary .collapsible-title")?.textContent ||
          e.querySelector(":scope > summary")?.textContent || "") : ""
      const study = children.find((e) => (title(e) || "").replace(/\\s+/g, "").includes("本章整理"))
      let studyVisible = null
      if (study) {
        const cs = getComputedStyle(study)
        studyVisible = cs.display !== "none" && cs.visibility !== "hidden" &&
          (study.offsetWidth > 0 || study.offsetHeight > 0 || study.getClientRects().length > 0)
      }
      window.__purecheckFirstPaint = {
        view: document.documentElement.getAttribute("data-ux-view"),
        studyFound: !!study,
        studyVisible,
      }
    }, { once: true })
  })()`
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: captureFirstPaint })
  await s.send("Page.reload", { ignoreCache: true })
  await waitChapter()
  await waitFor(`!!window.__purecheckFirstPaint`, 6000)
  const snapshot = await s.ev(`window.__purecheckFirstPaint || null`)
  s.check("重新整理第一次 DOMContentLoaded 已是 pure", snapshot?.view === "pure", JSON.stringify(snapshot))
  if (!snapshot?.studyFound) skip("第一次繪製：本章整理不可見", "DOM 上沒有找到本章整理標題")
  else s.check("重新整理第一次 DOMContentLoaded 本章整理不可見", snapshot.studyVisible === false, JSON.stringify(snapshot))
}

async function testScreenshots() {
  if (!SHOT_DIR) return
  console.log("\n== 截圖：研讀與純經文 × 1440／390 × 淺深 ==")
  for (const [width, height, mobile] of [[1440, 900, false], [390, 844, true]]) {
    await s.setViewport(width, height, { dpr: mobile ? 2 : 1, mobile, touch: mobile })
    for (const theme of ["light", "dark"]) {
      await setTheme(theme)
      await go(chapterPath(1), 3500)
      await waitChapter()
      for (const mode of ["研讀", "純經文"]) {
        const selected = await setModeAndClose(mode)
        await sleep(400)
        if (!selected) {
          s.check(`截圖前選取 ${mode}（${width} ${theme}）`, false, "Aa 面板沒有對應選項")
          continue
        }
        await saveShot(`${mode === "研讀" ? "study" : "pure"}-${width}-${theme}`)
      }
    }
  }
}

async function main() {
  s = await startBrowser({
    root: ROOT,
    profile: CHROME_PROFILE,
    width: 1440,
    height: 900,
    mobile: false,
    incognito: false,
    shotDir: SHOT_DIR ?? null,
  })
  s.on("Runtime.exceptionThrown", (event) => {
    const details = event.params?.exceptionDetails ?? {}
    const frames = details.stackTrace?.callFrames ?? []
    const url = [details.url, ...frames.map((frame) => frame.url)].filter(Boolean).join(" | ")
    if (RELEVANT_URL.test(url)) {
      pluginExceptions.push({
        url,
        text: details.exception?.description ?? details.text ?? "未知例外",
      })
    }
  })
  await s.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try {
      localStorage.setItem("theme", "light")
      localStorage.wikiTourCompleted = "1"
      localStorage.setItem("bwz-tour-v2", JSON.stringify({ v: 2, status: "dismissed", step: 0, skills: [], skipped: [] }))
      localStorage.setItem("pwa_install_guide_dismissed_v1", "1")
    } catch (e) {}`,
  })
  await s.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  })

  console.log("\n== 1–2. 研讀預設、Aa 切純經文與保留可見內容 ==")
  await go(chapterPath(1))
  await waitChapter()
  s.check("第 1 章預設為研讀", !(await s.ev(`document.documentElement.hasAttribute("data-ux-view")`)))

  const studySnapshot = await sectionSnapshot()
  await checkSections("研讀", studySnapshot)

  const panelOpened = await openPanel()
  s.check("章節頁 Aa 面板可開啟", panelOpened)
  if (!panelOpened) {
    s.check("Aa 提供「閱讀模式：純經文」", false, "找不到 Aa 面板")
  } else {
    const radio = await s.ev(`!!document.querySelector('#site-ux-panel [data-name="view"][data-value="pure"]')`)
    s.check("Aa 提供「閱讀模式：純經文」", radio)
    const note = await s.ev(`document.querySelector("#site-ux-note-view")?.textContent ?? null`)
    s.check("閱讀模式說明文字是定稿", note === NOTE_TEXT, note)
  }

  const selectedPure = await choose("view", "pure")
  await closePanel()
  s.check("選取純經文後套用到 html", selectedPure && await s.ev(`document.documentElement.getAttribute("data-ux-view") === "pure"`))
  await waitChapter()
  const pureSnapshot = await sectionSnapshot()
  await checkSections("純經文", pureSnapshot)

  const hidden = pureSnapshot.hidden.filter((item) => !item.reveal)
  s.check(
    "純經文：所有未暫時顯示的 .bwz-ux-hide 都是 display:none",
    hidden.length > 0 && hidden.every((item) => item.display === "none"),
    JSON.stringify(hidden),
  )
  const hiddenHrs = pureSnapshot.hrs.filter((item) => !item.reveal)
  if (!hiddenHrs.length) skip("純經文：區塊之間的 hr 隱藏", "這個章節沒有被標記為隱藏的 hr")
  else s.check("純經文：區塊之間的 hr 是 display:none", hiddenHrs.every((item) => item.display === "none"), JSON.stringify(hiddenHrs))

  await checkChapterParts("純經文")

  await testFirstPaintAndNavigation()
  await testFreshTab()
  await testMobileQuickbar()
  await testReveal()
  await testSettingsCombination()
  await testNonChapterPages()
  await testBlockedSessionStorage()
  await testScreenshots()

  const relevant = pluginExceptions.filter((x) => RELEVANT_URL.test(x.url))
  s.check("全程沒有 site-ux／verse-return 可辨識來源的 JS 例外", relevant.length === 0, JSON.stringify(relevant))

  if (conditionalItems.length) {
    console.log("\n條件式略過項目：")
    for (const item of conditionalItems) console.log(`- ${item}`)
  }

  s.finish()
}

main().catch((error) => {
  console.error(`purecheck 執行流程失敗：${error?.stack ?? error}`)
  if (s) {
    s.check("檢查流程未發生未處理錯誤", false, error?.message ?? String(error))
    s.finish()
  }
  process.exitCode = 1
})
