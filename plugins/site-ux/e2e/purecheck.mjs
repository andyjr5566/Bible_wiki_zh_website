// 「經文｜研讀」分頁與〈2026-11-23 修正〉的無頭 Chrome 檢查（B2 階段）；
// 用法：node plugins/site-ux/e2e/purecheck.mjs <siteRoot> <profileRoot> [shotDir]
// siteRoot 不加結尾斜線；Chrome 設定檔與可選截圖都放在命令列指定的資料夾。
// 驗證項目：
//   1. 首次造訪預設「經文」分頁（藏知識節點、本章整理、附錄；保留經文、朗讀列、上下導覽、筆記區、互動提示）；Aa 面板已拿掉純經文一列
//   2. 切換「研讀」分頁：完整一整頁（經文、朗讀列、知識節點、本章整理、附錄全部都在）；旁有「↓ 跳到本章整理」鈕，點了單次捲到 ## 本章整理
//   3. localStorage 全站記憶：SPA 換頁、重新整理（不閃爍）、新分頁皆延續上次選擇
//   4. 研讀頁點擊同章經節小標籤（.bwz-rl-vref[data-rl-verse]）→ 留在研讀頁直接單次捲到該節並以 .bwz-vr-flash 短暫標示
//   5. 「看這段經文」：本章整理帶經節範圍的 ###（例如（v3-13）、（v1, 21, 27）、（1-7節）；（全章）除外）標題下出現按鈕，原地展開／收起、不跳頁不捲動
//   6. 分層卡片（創1）收起時只顯示標籤＋標題，不放第一句摘要；舊格式（創48、出8、民8）括號前緊鄰的希伯來字一併收進「原文」小標籤，點開顯示希伯來字與 Strong 編號
//   7. 手機 390×844：頁首分頁列＋跳轉鈕不溢出、捲動後快捷列以 .bwz-cqb-tabs 同步切換、看這段經文可用
//   8. 經文分頁點指向被藏區塊的錨點／互動網站提示 → 暫時顯示該段，換頁後清除
//   9. 鍵盤操作（ArrowRight／ArrowLeft）、平板 1180 黏頂與淺深色對比實測（≥ 4.5:1）
//  10. 非章節頁（首頁、條目頁、全書目錄）不受影響；localStorage 被封鎖時不出錯
//  11. 截圖（1440、1180×820、390 × 淺深色；創48、民8 為主，加創1與互動情境）

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
const GEN48 = "/" + encodeURI("01-創世記/第48章")
const NUM8 = "/" + encodeURI("04-民數記/第8章")
const EXO8 = "/" + encodeURI("02-出埃及記/第8章")
const GEN6 = "/" + encodeURI("01-創世記/第6章")
const TOC = "/" + encodeURI("01-創世記/全書目錄及綱要")
const CHROME_PROFILE = join(PROFILE_ROOT, `tabcheck-b2-${Date.now()}-${Math.floor(Math.random() * 100000)}`)
const RELEVANT_URL = /site-ux|verse-return|appearance\.inline|early\.inline|pureMode|readingView|chapterQuickBar|readingLayers/i

let s
const conditionalItems = []
const pluginExceptions = []
const contrastReport = []

function skip(name, reason) {
  conditionalItems.push(`${name}：${reason}`)
  s.check(`${name}（條件式略過）`, true, reason)
}

function visibleExpression(element) {
  return `(() => {
    const e = ${element}
    if (!e) return false
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

async function go(path, wait = 2800) {
  await s.send("Page.navigate", { url: ROOT + path })
  await sleep(wait)
}

async function waitChapter() {
  await waitFor(`!!document.querySelector("article ol") && document.documentElement.hasAttribute("data-ux-marked")`, 8000)
  await sleep(250)
}

async function waitDocument() {
  await waitFor(`document.readyState === "complete"`, 8000)
  await sleep(400)
}

async function clickTab(tab) {
  const ok = await s.ev(`(() => {
    const btn = document.querySelector('.bwz-tabs [data-tab="${tab}"]')
    if (!btn) return false
    btn.click()
    return true
  })()`)
  await sleep(250)
  return !!ok
}

async function openPanel() {
  if (!(await s.ev(`!!document.querySelector(".site-ux-btn")`))) return false
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

async function sectionSnapshot() {
  const raw = await s.ev(`(() => {
    const article = document.querySelector("article")
    const root = article?.querySelector(":scope > .markdown-preview-view") || article
    if (!root) return JSON.stringify({ sections: {}, olVisible: false, raVisible: null, iaVisible: null })
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
      if (!el) return false
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
        top: Math.round(el.getBoundingClientRect().top),
      } : { found: false }
    }
    const ol = root.querySelector(":scope > ol")
    const ra = root.querySelector(":scope > .bwz-ra")
    const ia = root.querySelector(":scope > .bwz-ia-line")
    const jump = document.querySelector(".bwz-tabs-jump")
    return JSON.stringify({
      view: document.documentElement.getAttribute("data-ux-view"),
      hasTabsAttr: document.documentElement.hasAttribute("data-ux-tabs"),
      sections,
      olVisible: shown(ol),
      raFound: !!ra,
      raVisible: ra ? shown(ra) : null,
      iaFound: !!ia,
      iaVisible: ia ? shown(ia) : null,
      jumpVisible: shown(jump),
    })
  })()`)
  return raw ? JSON.parse(raw) : { sections: {}, olVisible: false }
}

async function checkSections(expectedVisible, labelPrefix, snap) {
  for (const label of SECTION_LABELS) {
    const state = snap.sections[label]
    if (!state?.found) {
      skip(`${labelPrefix}：${label}`, "此章節沒有該區塊")
      continue
    }
    s.check(
      `${labelPrefix}：${label}${expectedVisible ? " 看得到" : " 隱藏"}`,
      expectedVisible ? state.visible : state.display === "none",
      JSON.stringify(state),
    )
  }
}

async function setTheme(theme) {
  // 直接透過 Quartz darkmode 使用的 localStorage("theme") 與 saved-theme 切換主題
  await s.ev(`(() => {
    try { localStorage.setItem("theme", ${JSON.stringify(theme)}) } catch (e) {}
    document.documentElement.setAttribute("saved-theme", ${JSON.stringify(theme)})
    document.body?.classList.remove("theme-light", "theme-dark")
    document.body?.classList.add("theme-" + ${JSON.stringify(theme)})
  })()`)
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

function srgbContrastExpr(fgSel, bgSel) {
  return `(() => {
    const parse = (c) => {
      const nums = (c.match(/[\\d.]+/g) || []).map(Number)
      if (/^color\\(\\s*srgb/i.test(c)) return [nums[0] * 255, nums[1] * 255, nums[2] * 255]
      return [nums[0], nums[1], nums[2]]
    }
    const lum = ([r, g, b]) => {
      const f = (v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const fgEl = document.querySelector(${JSON.stringify(fgSel)})
    const bgEl = document.querySelector(${JSON.stringify(bgSel)})
    if (!fgEl || !bgEl) return 0
    const fg = parse(getComputedStyle(fgEl).color)
    const bg = parse(getComputedStyle(bgEl).backgroundColor)
    const a = lum(fg), b = lum(bg)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })()`
}

async function measureContrast(themeLabel) {
  const activeSel = '.bwz-tabs [role="tab"][aria-selected="true"]'
  const inactiveSel = '.bwz-tabs [role="tab"][aria-selected="false"]'
  const hintSel = ".bwz-tabs-hint"
  const jumpSel = ".bwz-tabs-jump"
  const vxBtnSel = ".bwz-rl-vx-btn"
  const dbg = await s.ev(`JSON.stringify({ attr: document.documentElement.getAttribute("saved-theme"), ls: localStorage.getItem("theme"), href: location.pathname })`).then(JSON.parse)
  const actualTheme = dbg.attr
  const activeRatio = await s.ev(srgbContrastExpr(activeSel, activeSel))
  const inactiveRatio = await s.ev(srgbContrastExpr(inactiveSel, ".bwz-tabs-seg"))
  const hintRatio = await s.ev(srgbContrastExpr(hintSel, ".bwz-tabs"))
  const jumpRatio = await s.ev(srgbContrastExpr(jumpSel, jumpSel))
  const vxRatio = await s.ev(srgbContrastExpr(vxBtnSel, vxBtnSel))
  contrastReport.push(
    `${themeLabel} (saved-theme=${actualTheme}): active=${Number(activeRatio).toFixed(2)}:1, inactive=${Number(inactiveRatio).toFixed(2)}:1, jump=${Number(jumpRatio).toFixed(2)}:1, hint=${Number(hintRatio).toFixed(2)}:1, verseBoxBtn=${Number(vxRatio).toFixed(2)}:1`,
  )
  s.check(`[${themeLabel}] 頁面主題確實為 ${themeLabel.endsWith("dark") ? "dark" : "light"}`, actualTheme === (themeLabel.endsWith("dark") ? "dark" : "light"), JSON.stringify(dbg))
  s.check(`[${themeLabel}] 分頁選中按鈕文字對比 ≥ 4.5:1`, activeRatio >= 4.5, `${Number(activeRatio).toFixed(2)}:1`)
  s.check(`[${themeLabel}] 分頁未選中按鈕文字對比 ≥ 4.5:1`, inactiveRatio >= 4.5, `${Number(inactiveRatio).toFixed(2)}:1`)
  s.check(`[${themeLabel}] 「跳到本章整理」按鈕文字對比 ≥ 4.5:1`, jumpRatio >= 4.5, `${Number(jumpRatio).toFixed(2)}:1`)
  s.check(`[${themeLabel}] 分頁列說明文字對比 ≥ 4.5:1`, hintRatio >= 4.5, `${Number(hintRatio).toFixed(2)}:1`)
  s.check(`[${themeLabel}] 「看這段經文」按鈕文字對比 ≥ 4.5:1`, vxRatio >= 4.5, `${Number(vxRatio).toFixed(2)}:1`)
}

async function clickNextChapter(chapterNumber) {
  const target = await s.ev(`(() => {
    const links = [...document.querySelectorAll(".table-container a[href], article a[href]")]
    const el = links.find((a) => {
      let decoded = a.href
      try { decoded = decodeURIComponent(a.href) } catch {}
      const label = (a.textContent || "").trim()
      const context = a.closest(".table-container")?.textContent || ""
      return decoded.includes("第${chapterNumber}章") && (/下一章/.test(label) || /下一章/.test(context))
    })
    if (!el) return null
    el.scrollIntoView({ block: "center", behavior: "instant" })
    const r = el.getBoundingClientRect()
    return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  })()`).then((v) => (v ? JSON.parse(v) : null))
  if (!target) return false
  await mouse(s, target.x, target.y)
  return !!(await waitFor(`location.pathname.endsWith(${JSON.stringify(encodeURI(`第${chapterNumber}章`))})`, 8000))
}

async function testPersistenceAndNewTab() {
  console.log("\n== 3. SPA 換頁、重新整理（不閃爍）與新分頁（localStorage 記憶） ==")
  await go(chapterPath(1))
  await waitChapter()
  const moved = await clickNextChapter(2)
  s.check("研讀分頁下以 SPA 換到第 2 章", moved, await s.ev(`location.pathname`))
  if (moved) {
    await waitChapter()
    const snap2 = await sectionSnapshot()
    s.check(
      "SPA 換到第 2 章仍維持研讀分頁（完整一整頁：經文與本章整理皆可見）",
      snap2.view === "study" && snap2.olVisible && snap2.sections["本章整理"]?.visible && snap2.jumpVisible,
      JSON.stringify(snap2),
    )
  }

  // 重新整理：DOMContentLoaded 時就已是 study，經文與整理都看得到（完整一整頁）
  const captureFirstPaint = `(() => {
    window.__tabFirstPaint = null
    document.addEventListener("DOMContentLoaded", () => {
      const ol = document.querySelector("article .markdown-preview-view > ol") || document.querySelector("article ol")
      const h2 = document.querySelector("#本章整理")
      window.__tabFirstPaint = {
        view: document.documentElement.getAttribute("data-ux-view"),
        olVisible: !!ol && getComputedStyle(ol).visibility !== "hidden" && getComputedStyle(ol).display !== "none",
        h2Visible: !!h2 && getComputedStyle(h2).visibility !== "hidden" && getComputedStyle(h2).display !== "none",
      }
    }, { once: true })
  })()`
  const fpScript = await s.send("Page.addScriptToEvaluateOnNewDocument", { source: captureFirstPaint })
  await s.send("Page.reload", { ignoreCache: true })
  await waitChapter()
  await waitFor(`!!window.__tabFirstPaint`, 6000)
  const fp = await s.ev(`window.__tabFirstPaint || null`)
  s.check("重新整理第一次 DOMContentLoaded 已是 study 且完整頁面皆可見", fp?.view === "study" && fp?.olVisible === true && fp?.h2Visible === true, JSON.stringify(fp))
  if (fpScript?.identifier) {
    await s.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: fpScript.identifier })
  }

  // 開新分頁延續 "study"
  const browser = await s.openBrowserSocket()
  const created = await browser.send("Target.createTarget", { url: "about:blank" })
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true })
  const sessionId = attached.sessionId
  await browser.send("Page.enable", {}, sessionId)
  await browser.send("Runtime.enable", {}, sessionId)
  await browser.send("Page.navigate", { url: ROOT + GEN48 }, sessionId)

  const evaluate = async (expression) => {
    const result = await browser.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    )
    return result?.result?.value
  }
  let state
  for (let i = 0; i < 60; i++) {
    const raw = await evaluate(`(() => {
      const ready = !!document.querySelector(".bwz-tabs") && document.documentElement.hasAttribute("data-ux-marked")
      return ready ? JSON.stringify({
        view: document.documentElement.getAttribute("data-ux-view"),
        ls: (() => { try { return localStorage.getItem("bwz-ux-view") } catch { return "ERR" } })(),
        olDisplay: getComputedStyle(document.querySelector("article ol")).display,
      }) : null
    })()`)
    if (raw) {
      state = JSON.parse(raw)
      break
    }
    await sleep(150)
  }
  s.check("新分頁延續 localStorage「研讀」分頁且經文完整顯示", !!state && state.view === "study" && state.ls === "study" && state.olDisplay !== "none", JSON.stringify(state))
  await browser.send("Target.closeTarget", { targetId: created.targetId })
}

async function testVerseTagJumpAndJumpToStudy() {
  console.log("\n== 4. 研讀頁：「跳到本章整理」＋同頁經節小標籤跳轉（不切分頁） ==")
  await s.setViewport(1440, 900)
  await go(GEN48)
  await waitChapter()
  await clickTab("study")
  await s.ev(`window.scrollTo(0, 0)`)
  await sleep(250)

  await s.ev(`document.querySelector(".bwz-tabs-jump")?.click()`)
  await sleep(250)
  const jumpedStudy = await s.ev(`(() => {
    const h2 = document.getElementById("本章整理")
    const r = h2?.getBoundingClientRect()
    const tabs = document.querySelector(".bwz-tabs")?.getBoundingClientRect()
    return JSON.stringify({
      view: document.documentElement.getAttribute("data-ux-view"),
      scrollY: Math.round(window.scrollY),
      top: r ? Math.round(r.top) : null,
      tabsBottom: tabs ? Math.round(tabs.bottom) : 0,
    })
  })()`).then((v) => (v ? JSON.parse(v) : null))
  s.check(
    "點「跳到本章整理」→ 單次捲到 ## 本章整理且不被黏頂分頁列遮住",
    !!jumpedStudy &&
      jumpedStudy.view === "study" &&
      jumpedStudy.scrollY > 200 &&
      jumpedStudy.top >= jumpedStudy.tabsBottom - 2 &&
      jumpedStudy.top <= jumpedStudy.tabsBottom + 40,
    JSON.stringify(jumpedStudy),
  )

  const vrefInfo = await s.ev(`(() => {
    const el = [...document.querySelectorAll('.bwz-rl-vref[data-rl-verse]')].find((a) => Number(a.dataset.rlVerse) >= 5)
      || document.querySelector('.bwz-rl-vref[data-rl-verse]')
    if (!el) return null
    const verse = Number(el.dataset.rlVerse)
    el.click()
    return JSON.stringify({ verse, text: (el.textContent || "").trim() })
  })()`).then((v) => (v ? JSON.parse(v) : null))

  if (!vrefInfo) {
    skip("研讀頁經節小標籤同頁跳轉", "創48 沒有帶 data-rl-verse 的 .bwz-rl-vref")
    return
  }

  await sleep(250)
  const after = await s.ev(`(() => {
    const li = document.getElementById("v${vrefInfo.verse}")
    const r = li?.getBoundingClientRect()
    const tabs = document.querySelector(".bwz-tabs")?.getBoundingClientRect()
    return JSON.stringify({
      view: document.documentElement.getAttribute("data-ux-view"),
      flashed: !!li?.classList.contains("bwz-vr-flash"),
      belowTabs: !!r && r.top >= (tabs?.bottom ?? 0) - 2 && r.bottom <= window.innerHeight,
      top: r ? Math.round(r.top) : null,
      tabsBottom: tabs ? Math.round(tabs.bottom) : 0,
    })
  })()`).then((v) => (v ? JSON.parse(v) : null))

  s.check(
    `研讀頁點「${vrefInfo.text}」（第 ${vrefInfo.verse} 節）→ 留在研讀頁、捲到同頁該節且標示 .bwz-vr-flash`,
    !!after && after.view === "study" && after.flashed && after.belowTabs,
    JSON.stringify(after),
  )
}

async function testVerseBoxesCardsAndOrigChips() {
  console.log("\n== 5. 「看這段經文」原地展開、無摘要卡片、原文小標籤吸收前置希伯來字 ==")
  await s.setViewport(1440, 900)

  // 5a. 創世記第 48 章：（1-7節）有按鈕，（全章）與 經文大綱 無按鈕，點擊原地展開且不捲動，原文標籤吸收前置希伯來字
  await go(GEN48)
  await waitChapter()
  await clickTab("study")
  await s.ev(`window.scrollTo(0, 0)`)
  await sleep(200)

  const gen48Check = await s.ev(`(() => {
    const h3s = [...document.querySelectorAll("article h3")]
    const withBtn = h3s.filter((h) => h.nextElementSibling?.classList.contains("bwz-rl-vx")).map((h) => h.textContent.trim())
    const noBtnFull = h3s.find((h) => h.textContent.includes("全章"))
    const noBtnOutline = h3s.find((h) => h.textContent.includes("經文大綱"))
    const firstVx = document.querySelector(".bwz-rl-vx")
    const btn = firstVx?.querySelector(".bwz-rl-vx-btn")
    const box = firstVx?.querySelector(".bwz-rl-vx-box")
    btn?.scrollIntoView({ block: "center", behavior: "instant" })
    const scrollBefore = Math.round(window.scrollY)
    btn?.click()
    const scrollAfter = Math.round(window.scrollY)
    const items = [...(box?.querySelectorAll(".bwz-rl-vx-item") || [])].map((li) => ({
      num: li.querySelector(".bwz-rl-vx-num")?.textContent,
      txt: li.querySelector(".bwz-rl-vx-txt")?.textContent?.slice(0, 18),
    }))
    const openLabel = btn?.textContent?.trim()
    const openExpanded = btn?.getAttribute("aria-expanded")
    btn?.click()
    const collapsedHidden = !!box?.hidden
    const collapsedExpanded = btn?.getAttribute("aria-expanded")
    const origPayloads = [...document.querySelectorAll(".bwz-rl-orig-chip")].map((c) => c.dataset.rlOrig)
    // 檢查「剪搭」「一分」兩處不再留裸希伯來字
    const studyPs = [...document.querySelectorAll("article p")].filter((p) => p.textContent.includes("一分」的原文使用") || p.textContent.includes("「剪搭」原文動詞"))
    const bareHebrewLeft = studyPs.some((p) => /[\u0590-\u05FF]/.test(p.textContent))
    return JSON.stringify({
      withBtnCount: withBtn.length,
      fullHasNoBtn: !!noBtnFull && !noBtnFull.nextElementSibling?.classList.contains("bwz-rl-vx"),
      outlineHasNoBtn: !!noBtnOutline && !noBtnOutline.nextElementSibling?.classList.contains("bwz-rl-vx"),
      scrollUnchanged: scrollBefore === scrollAfter,
      itemCount: items.length,
      firstNum: items[0]?.num,
      lastNum: items[items.length - 1]?.num,
      openLabel,
      openExpanded,
      collapsedHidden,
      collapsedExpanded,
      origCount: origPayloads.length,
      hasShekhem: origPayloads.some((x) => x.startsWith("שְׁכֶם（H7926")),
      hasSikkel: origPayloads.some((x) => x.startsWith("שִׂכֵּל（")),
      bareHebrewLeft,
    })
  })()`).then(JSON.parse)

  s.check(
    "創48：4 個帶節數小節都有「看這段經文」、（全章）與經文大綱沒有按鈕",
    gen48Check.withBtnCount === 4 && gen48Check.fullHasNoBtn && gen48Check.outlineHasNoBtn,
    JSON.stringify(gen48Check),
  )
  s.check(
    "創48：點「看這段經文」（1-7節）原地展開 7 節、不捲動，再點收起",
    gen48Check.scrollUnchanged &&
      gen48Check.itemCount === 7 &&
      gen48Check.firstNum === "1" &&
      gen48Check.lastNum === "7" &&
      gen48Check.openExpanded === "true" &&
      gen48Check.collapsedHidden &&
      gen48Check.collapsedExpanded === "false",
    JSON.stringify(gen48Check),
  )
  s.check(
    "創48：括號前緊鄰希伯來字（如 שְׁכֶם、שִׂכֵּל）已收進「原文」小標籤，正文不留裸希伯來字",
    gen48Check.hasShekhem && gen48Check.hasSikkel && !gen48Check.bareHebrewLeft,
    JSON.stringify(gen48Check),
  )

  // 點開原文小標籤檢查小卡顯示大字希伯來文與 Strong 編號
  const popCheck = await s.ev(`(() => {
    const chip = [...document.querySelectorAll(".bwz-rl-orig-chip")].find((c) => (c.dataset.rlOrig || "").startsWith("שְׁכֶם"))
    if (!chip) return null
    chip.click()
    const pop = document.querySelector(".bwz-rl-popover-orig")
    const out = {
      open: !!pop,
      script: pop?.querySelector(".bwz-rl-orig-script")?.textContent,
      detail: pop?.querySelector(".bwz-rl-orig-detail")?.textContent,
    }
    pop?.querySelector(".bwz-rl-pop-close")?.click()
    return JSON.stringify(out)
  })()`).then((v) => (v ? JSON.parse(v) : null))
  s.check(
    "創48：點「原文」小標籤展開小卡，分列希伯來字（שְׁכֶם）與 H7926 說明",
    !!popCheck && popCheck.open && popCheck.script === "שְׁכֶם" && popCheck.detail.includes("H7926"),
    JSON.stringify(popCheck),
  )

  // 5b. 民數記第 8 章：(v1-4) 等 4 個小節有「看這段經文」、原文層小節沒有
  await go(NUM8)
  await waitChapter()
  await clickTab("study")
  const num8Check = await s.ev(`(() => {
    const h3s = [...document.querySelectorAll("article h3")]
    const withBtn = h3s.filter((h) => h.nextElementSibling?.classList.contains("bwz-rl-vx")).map((h) => h.textContent.trim())
    const origSec = h3s.find((h) => h.textContent.includes("原文層"))
    return JSON.stringify({
      withBtnCount: withBtn.length,
      origHasNoBtn: !!origSec && !origSec.nextElementSibling?.classList.contains("bwz-rl-vx"),
    })
  })()`).then(JSON.parse)
  s.check("民8：v1-4 等 4 個帶經節範圍小節有「看這段經文」、無範圍小節沒有", num8Check.withBtnCount === 4 && num8Check.origHasNoBtn, JSON.stringify(num8Check))

  // 5c. 創世記第 1 章：卡片收起無摘要、跳躍節數（v1, 21, 27）正確展開 1／21／27 節
  await go(chapterPath(1))
  await waitChapter()
  await clickTab("study")
  const gen1Check = await s.ev(`(() => {
    const cardSummaries = document.querySelectorAll(".bwz-rl-card-summary").length
    const cards = document.querySelectorAll(".bwz-rl-card").length
    const leapH3 = [...document.querySelectorAll("article h3")].find((h) => h.textContent.includes("v1, 21, 27"))
    const vx = leapH3?.nextElementSibling
    vx?.querySelector(".bwz-rl-vx-btn")?.click()
    const nums = [...(vx?.querySelectorAll(".bwz-rl-vx-num") || [])].map((e) => e.textContent)
    vx?.querySelector(".bwz-rl-vx-btn")?.click()
    const fullH3 = [...document.querySelectorAll("article h3")].find((h) => h.textContent.includes("全章"))
    return JSON.stringify({
      cards,
      cardSummaries,
      leapNums: nums,
      fullHasNoBtn: !!fullH3 && !fullH3.nextElementSibling?.classList.contains("bwz-rl-vx"),
    })
  })()`).then(JSON.parse)
  s.check("創1：分層卡片收起時不顯示摘要（只留標籤＋標題＋展開）", gen1Check.cards >= 3 && gen1Check.cardSummaries === 0, JSON.stringify(gen1Check))
  s.check("創1：（v1, 21, 27）展開剛好 1、21、27 節；（全章）無按鈕", JSON.stringify(gen1Check.leapNums) === JSON.stringify(["1", "21", "27"]) && gen1Check.fullHasNoBtn, JSON.stringify(gen1Check))
}

async function testMobileQuickbarAndTabs() {
  console.log("\n== 6. 手機 390×844：頁首分頁＋跳轉鈕、快捷列同步、原地看經文 ==")
  await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
  await go(GEN48)
  await waitChapter()
  await clickTab("study")
  await s.ev(`window.scrollTo(0, 0)`)
  await sleep(250)

  const topState = await s.ev(`(() => ({
    hasOldSummaryBtn: !!document.querySelector(".bwz-cqb-summary"),
    tabsVisible: ${visibleExpression('document.querySelector(".bwz-tabs")')},
    jumpVisible: ${visibleExpression('document.querySelector(".bwz-tabs-jump")')},
    tabsPos: getComputedStyle(document.querySelector(".bwz-tabs")).position,
    noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
  }))()`)
  s.check(
    "手機頁首：無舊 .bwz-cqb-summary、流內分頁與「跳到本章整理」皆可見、無橫向捲動",
    !!topState && !topState.hasOldSummaryBtn && topState.tabsVisible && topState.jumpVisible && topState.tabsPos === "static" && topState.noOverflow,
    JSON.stringify(topState),
  )

  await s.ev(`document.querySelector(".bwz-tabs-jump")?.click()`)
  await sleep(450)
  const mobileJump = await s.ev(`(() => {
    const h2 = document.getElementById("本章整理")?.getBoundingClientRect()
    const bar = document.querySelector(".bwz-cqb")?.getBoundingClientRect()
    return JSON.stringify({
      barShown: !!document.querySelector(".bwz-cqb")?.classList.contains("is-shown"),
      h2Top: h2 ? Math.round(h2.top) : null,
      barBottom: bar ? Math.round(bar.bottom) : null,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    })
  })()`).then(JSON.parse)
  s.check(
    "手機點「跳到本章整理」：快捷列浮出且 ## 本章整理不被快捷列蓋住、無橫向溢出",
    mobileJump.barShown && mobileJump.h2Top >= mobileJump.barBottom - 2 && mobileJump.noOverflow,
    JSON.stringify(mobileJump),
  )

  await s.ev(`document.querySelector('.bwz-cqb [data-tab="text"]')?.click()`)
  await sleep(300)
  const switched = await s.ev(`(() => ({
    view: document.documentElement.getAttribute("data-ux-view"),
    cqbText: document.querySelector('.bwz-cqb [data-tab="text"]')?.getAttribute("aria-selected"),
    topText: document.querySelector('.bwz-tabs [data-tab="text"]')?.getAttribute("aria-selected"),
  }))()`)
  s.check(
    "手機點快捷列「經文」：切回經文並同步頁首與快捷列狀態",
    switched?.view === "text" && switched.cqbText === "true" && switched.topText === "true",
    JSON.stringify(switched),
  )
}

async function testRevealAndInteractiveLine() {
  console.log("\n== 7. 經文分頁：錨點暫時顯示與互動網站提示 ==")
  await s.setViewport(1440, 900)
  await go(chapterPath(1))
  await waitChapter()
  await clickTab("text")

  const headingId = await s.ev(`(() => {
    const article = document.querySelector("article")
    const root = article?.querySelector(":scope > .markdown-preview-view") || article
    const children = [...(root?.children || [])]
    const norm = (v) => (v || "").replace(/\\s+/g, "").trim()
    const idx = children.findIndex((e) => e.matches("h2") && norm(e.textContent).includes("本章整理"))
    if (idx < 0) return null
    for (let i = idx + 1; i < children.length; i++) {
      if (children[i].matches("h2, details")) break
      if (children[i].matches("h3") && children[i].id) return children[i].id
    }
    return null
  })()`)

  if (!headingId) {
    skip("經文分頁錨點暫時顯示", "第 1 章沒有帶 id 的本章整理 h3")
  } else {
    await go(chapterPath(1) + "#" + encodeURIComponent(headingId), 3200)
    await waitChapter()
    const rev = await s.ev(`(() => {
      const target = document.getElementById(${JSON.stringify(headingId)})
      const box = target?.closest(".bwz-ux-reveal")
      const others = [...document.querySelectorAll(".bwz-ux-hide:not(.bwz-ux-reveal)")]
      return JSON.stringify({
        view: document.documentElement.getAttribute("data-ux-view"),
        revealed: !!box && getComputedStyle(box).display !== "none",
        othersHidden: others.every((e) => getComputedStyle(e).display === "none"),
      })
    })()`).then((v) => (v ? JSON.parse(v) : null))
    s.check(
      "經文分頁直接開本章整理錨點：暫時顯示該段、其他段仍藏著、不改變分頁偏好",
      !!rev && rev.view === "text" && rev.revealed && rev.othersHidden,
      JSON.stringify(rev),
    )

    const moved = await clickNextChapter(2)
    if (moved) {
      await waitChapter()
      const cleared = await s.ev(`document.querySelectorAll(".bwz-ux-reveal").length === 0`)
      s.check("SPA 換頁後暫時顯示自動清除", !!cleared)
    }
  }

  await go(GEN6)
  await waitChapter()
  const iaOk = await s.ev(`(() => {
    const line = document.querySelector(".bwz-ia-line")
    if (!line || getComputedStyle(line).display === "none") return false
    line.click()
    return true
  })()`)
  await sleep(400)
  const iaAfter = await s.ev(`(() => {
    const h = document.querySelector('h3[id="互動網站"]')
    const card = document.querySelector(".bwz-ia-chapter")
    return JSON.stringify({
      clicked: ${Boolean(iaOk)},
      headingVisible: !!h && getComputedStyle(h).display !== "none" && h.getClientRects().length > 0,
      cardVisible: !!card && getComputedStyle(card).display !== "none" && card.getClientRects().length > 0,
    })
  })()`).then((v) => (v ? JSON.parse(v) : null))
  s.check("經文分頁點互動網站提示（.bwz-ia-line）：暫時顯示附錄與互動網站小卡", !!iaAfter && iaAfter.clicked && iaAfter.headingVisible && iaAfter.cardVisible, JSON.stringify(iaAfter))
}

async function testKeyboardAndContrast() {
  console.log("\n== 8. 鍵盤操作、平板 1180 黏頂與淺深色對比實測 ==")
  await s.setViewport(1180, 820)
  for (const theme of ["light", "dark"]) {
    await go(GEN48)
    await waitChapter()
    await setTheme(theme)
    await clickTab("study")
    await sleep(250)
    await measureContrast(`1180-${theme}`)

    await s.ev(`window.scrollTo(0, 700)`)
    await sleep(300)
    const sticky = await s.ev(`(() => {
      const bar = document.querySelector(".bwz-tabs")
      const r = bar?.getBoundingClientRect()
      return JSON.stringify({ pos: bar ? getComputedStyle(bar).position : null, top: r ? Math.round(r.top) : null })
    })()`).then((v) => (v ? JSON.parse(v) : null))
    s.check(`[1180 ${theme}] 平板捲動時分頁列黏在視窗頂端`, sticky?.pos === "sticky" && sticky.top >= -1 && sticky.top <= 2, JSON.stringify(sticky))
    await s.ev(`window.scrollTo(0, 0)`)
  }

  await s.setViewport(1440, 900)
  await go(GEN48)
  await waitChapter()
  await setTheme("light")
  await clickTab("text")
  await s.ev(`document.querySelector('.bwz-tabs [data-tab="text"]').focus()`)
  await s.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 })
  await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 })
  await sleep(250)
  const kbStudy = await s.ev(`document.documentElement.getAttribute("data-ux-view") === "study" && document.activeElement?.dataset?.tab === "study"`)
  await s.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 })
  await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 })
  await sleep(250)
  const kbText = await s.ev(`document.documentElement.getAttribute("data-ux-view") === "text" && document.activeElement?.dataset?.tab === "text"`)
  s.check("鍵盤方向鍵（ArrowRight／ArrowLeft）可切換分頁並移動焦點", !!kbStudy && !!kbText, `kbStudy=${kbStudy} kbText=${kbText}`)
}

async function testNonChapterPages() {
  console.log("\n== 9. 首頁、全書目錄與條目頁不顯示分頁且不隱藏內容 ==")
  await s.setViewport(1440, 900)
  const pages = [
    ["首頁", "/?skip=1"],
    ["全書目錄及綱要", TOC],
    ["條目頁（亞伯拉罕）", "/" + encodeURI("link_folder/人物/亞伯拉罕")],
  ]
  for (const [label, path] of pages) {
    await go(path, 2500)
    await waitDocument()
    const st = await s.ev(`(() => ({
      tabs: document.querySelectorAll(".bwz-tabs").length,
      hide: document.querySelectorAll(".bwz-ux-hide").length,
      hasAttr: document.documentElement.hasAttribute("data-ux-tabs"),
    }))()`)
    s.check(`${label}：沒有分頁列與隱藏標記`, st?.tabs === 0 && st.hide === 0 && !st.hasAttr, JSON.stringify(st))
  }
}

async function testBlockedLocalStorage() {
  console.log("\n== 10. localStorage 被封鎖時不出錯且本頁仍可切換分頁 ==")
  await s.setViewport(1440, 900)
  const blocked = `Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() { throw new DOMException("blocked", "SecurityError") }
  });`
  const installed = await s.send("Page.addScriptToEvaluateOnNewDocument", { source: blocked })
  await go(GEN48, 3000)
  await waitChapter()
  const initView = await s.ev(`document.documentElement.getAttribute("data-ux-view")`)
  await clickTab("study")
  const afterClick = await s.ev(`document.documentElement.getAttribute("data-ux-view")`)
  s.check("localStorage 被封鎖：預設經文，且本頁仍可點擊切到研讀", initView === "text" && afterClick === "study", `init=${initView} after=${afterClick}`)
  if (installed?.identifier) {
    await s.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: installed.identifier })
  }
  await go("/?skip=1", 1500)
}

async function captureScreenshots() {
  if (!SHOT_DIR) return
  console.log("\n== 11. 截圖（1440、1180×820、390 × 淺深色；創48、民8 為主，加創1） ==")
  const viewports = [
    { name: "1440", w: 1440, h: 900, mobile: false },
    { name: "1180", w: 1180, h: 820, mobile: false },
    { name: "390", w: 390, h: 844, mobile: true },
  ]
  const matrix = [
    { prefix: "gen48", path: GEN48, tabs: ["text", "study"] },
    { prefix: "num8", path: NUM8, tabs: ["study"] },
    { prefix: "gen1", path: chapterPath(1), tabs: ["study"] },
  ]
  for (const ch of matrix) {
    for (const vp of viewports) {
      await s.setViewport(vp.w, vp.h, { dpr: vp.mobile ? 2 : 1, mobile: vp.mobile, touch: vp.mobile })
      for (const theme of ["light", "dark"]) {
        await go(ch.path, 2800)
        await waitChapter()
        await setTheme(theme)
        for (const tab of ch.tabs) {
          await clickTab(tab)
          if (tab === "study") {
            // 捲到 ## 本章整理（創48／民8／創1 重點在看一般章節與新元件：跳轉鈕、看這段經文、原文標籤、無摘要卡片）
            await s.ev(`document.querySelector(".bwz-tabs-jump")?.click()`)
          } else {
            await s.ev(`window.scrollTo(0, 0)`)
          }
          await sleep(300)
          await saveShot(`${ch.prefix}-${tab}-${vp.name}-${theme}`)
        }
      }
    }
  }

  // 額外拍「創48」1440 淺色研讀頁頂端（展示 經文｜研讀 ＋ ↓ 跳到本章整理 與完整經文在同一頁）
  await s.setViewport(1440, 900)
  await go(GEN48, 2800)
  await waitChapter()
  await setTheme("light")
  await clickTab("study")
  await s.ev(`window.scrollTo(0, 0)`)
  await sleep(300)
  await saveShot("gen48-studytop-1440-light")

  // 額外拍「創48」1440 淺／深色：展開「看這段經文（1-7節）」與原文小卡
  for (const theme of ["light", "dark"]) {
    await go(GEN48, 2800)
    await waitChapter()
    await setTheme(theme)
    await clickTab("study")
    await s.ev(`(() => {
      const vx = document.querySelector(".bwz-rl-vx")
      const btn = vx?.querySelector(".bwz-rl-vx-btn")
      if (btn && vx.querySelector(".bwz-rl-vx-box")?.hidden) btn.click()
      const h2 = vx?.previousElementSibling
      if (h2) {
        const y = h2.getBoundingClientRect().top + window.scrollY - 76
        window.scrollTo({ top: Math.max(0, y), behavior: "instant" })
      }
    })()`)
    await sleep(300)
    await saveShot(`gen48-versebox-1440-${theme}`)
  }

  // 額外拍「創48」1440 淺色：原文小標籤小卡展開（שְׁכֶם）＋ 研讀頁經節跳轉標示
  await go(GEN48, 2800)
  await waitChapter()
  await setTheme("light")
  await clickTab("study")
  await s.ev(`(() => {
    const chip = [...document.querySelectorAll(".bwz-rl-orig-chip")].find((c) => (c.dataset.rlOrig || "").startsWith("שְׁכֶם"))
    if (chip) {
      const y = chip.getBoundingClientRect().top + window.scrollY - 220
      window.scrollTo({ top: Math.max(0, y), behavior: "instant" })
      chip.click()
    }
  })()`)
  await sleep(300)
  await saveShot("gen48-origpop-1440-light")

  // 額外拍「創48」390 手機快捷列（淺深色）＋「看這段經文」展開（淺色）
  await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
  await go(GEN48, 2800)
  await waitChapter()
  await setTheme("light")
  await clickTab("study")
  await s.ev(`(() => {
    const vx = document.querySelector(".bwz-rl-vx")
    const btn = vx?.querySelector(".bwz-rl-vx-btn")
    if (btn && vx.querySelector(".bwz-rl-vx-box")?.hidden) btn.click()
    const h3 = vx?.previousElementSibling
    if (h3) {
      const y = h3.getBoundingClientRect().top + window.scrollY - 122
      window.scrollTo({ top: Math.max(0, y), behavior: "instant" })
    }
  })()`)
  await sleep(450)
  await saveShot("gen48-versebox-390-light")

  await go(GEN48, 2800)
  await waitChapter()
  await setTheme("dark")
  await clickTab("study")
  await s.ev(`document.querySelector(".bwz-tabs-jump")?.click()`)
  await sleep(450)
  await saveShot("gen48-quickbar-390-dark")
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
      if (!localStorage.getItem("theme")) localStorage.setItem("theme", "light")
      localStorage.wikiTourCompleted = "1"
      localStorage.setItem("bwz-tour-v2", JSON.stringify({ v: 2, status: "dismissed", step: 0, skills: [], skipped: [] }))
      localStorage.setItem("pwa_install_guide_dismissed_v1", "1")
    } catch (e) {}`,
  })

  console.log("\n== 1. 首次造訪預設為「經文」分頁，Aa 面板已拿掉純經文切換 ==")
  await go(GEN48)
  await waitChapter()
  const textSnap = await sectionSnapshot()
  s.check("首次造訪預設 data-ux-view=text 且有分頁標記", textSnap.view === "text" && textSnap.hasTabsAttr, JSON.stringify(textSnap))
  s.check("經文分頁：經文清單可見", textSnap.olVisible, JSON.stringify(textSnap))
  if (textSnap.raFound) s.check("經文分頁：朗讀列可見", textSnap.raVisible === true, JSON.stringify(textSnap))
  s.check("經文分頁：不顯示「跳到本章整理」按鈕", textSnap.jumpVisible === false, JSON.stringify(textSnap))
  await checkSections(false, "經文分頁", textSnap)

  const notesVisible = await s.ev(visibleExpression('document.querySelector(".bwz-notes, #after-body, .after-body")'))
  s.check("經文分頁：筆記區仍看得到", !!notesVisible)

  const aaOpened = await openPanel()
  s.check("Aa 面板可開啟", aaOpened)
  if (aaOpened) {
    const hasViewRow = await s.ev(`!!document.querySelector('#site-ux-panel [data-name="view"]')`)
    const groupsCount = await s.ev(`document.querySelectorAll('#site-ux-panel .site-ux-group').length`)
    s.check("Aa 面板已拿掉「研讀｜純經文」那一列，保留其餘 4 組外觀設定", !hasViewRow && groupsCount === 4, `hasViewRow=${hasViewRow} groups=${groupsCount}`)
    await closePanel()
  }

  console.log("\n== 2. 切到「研讀」分頁：完整一整頁（經文、朗讀列、知識節點、本章整理、附錄全都在） ==")
  await clickTab("study")
  const studySnap = await sectionSnapshot()
  s.check("切到研讀：data-ux-view=study 且寫入 localStorage", studySnap.view === "study" && (await s.ev(`localStorage.getItem("bwz-ux-view") === "study"`)), JSON.stringify(studySnap))
  s.check("研讀分頁：經文清單仍可見（完整一整頁）", studySnap.olVisible, JSON.stringify(studySnap))
  if (studySnap.raFound) s.check("研讀分頁：朗讀列仍可見（完整一整頁）", studySnap.raVisible === true, JSON.stringify(studySnap))
  s.check("研讀分頁：分頁旁顯示「↓ 跳到本章整理」按鈕", studySnap.jumpVisible === true, JSON.stringify(studySnap))
  await checkSections(true, "研讀分頁", studySnap)

  await testPersistenceAndNewTab()
  await testVerseTagJumpAndJumpToStudy()
  await testVerseBoxesCardsAndOrigChips()
  await testMobileQuickbarAndTabs()
  await testRevealAndInteractiveLine()
  await testKeyboardAndContrast()
  await testNonChapterPages()
  await testBlockedLocalStorage()
  await captureScreenshots()

  const relevant = pluginExceptions.filter((x) => RELEVANT_URL.test(x.url))
  s.check("全程沒有 site-ux／verse-return／chapterQuickBar／readingLayers 可辨識來源的 JS 例外", relevant.length === 0, JSON.stringify(relevant))

  if (contrastReport.length) {
    console.log("\n對比實測：")
    for (const line of contrastReport) console.log(`- ${line}`)
  }
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
