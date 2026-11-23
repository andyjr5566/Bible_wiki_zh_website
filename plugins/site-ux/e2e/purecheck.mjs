// 「經文｜研讀」分頁的無頭 Chrome 檢查（B 階段，取代原純經文模式檢查）；
// 用法：node plugins/site-ux/e2e/purecheck.mjs <siteRoot> <profileRoot> [shotDir]
// siteRoot 不加結尾斜線；Chrome 設定檔與可選截圖都放在命令列指定的資料夾。
// 驗證項目：
//   1. 首次造訪預設「經文」分頁（藏知識節點、本章整理、附錄；保留經文、朗讀列、上下導覽、筆記區、互動提示）
//   2. Aa 面板已拿掉「閱讀模式（研讀｜純經文）」，其餘四組設定照常運作
//   3. 切換「研讀」分頁（藏經文清單與朗讀列，直接從知識節點與本章整理開始；桌機／平板捲動黏頂）
//   4. localStorage 全站記憶：SPA 換頁、重新整理（首次繪製不閃爍）、新分頁皆延續上次選擇
//   5. 研讀頁點擊同章經節小標籤（.bwz-rl-vref[data-rl-verse]）→ 切回經文分頁、捲到該節並以 .bwz-vr-flash 短暫標示
//   6. 手機 390×844：頁首流內分頁列、捲動後快捷列以 .bwz-cqb-tabs 取代原「本章整理」鈕且可切換、無橫向捲動
//   7. 經文分頁點指向被藏區塊的錨點／URL hash／互動網站提示 → 暫時顯示該段，換頁後清除
//   8. 鍵盤操作（ArrowRight／ArrowLeft）與淺深色對比實測（≥ 4.5:1）
//   9. 非章節頁（首頁、條目頁、全書目錄）不受影響
//  10. localStorage 被封鎖時不丟例外、本頁仍可切換
//  11. 截圖（1440、1180×820、390 × 淺深色 × 經文／研讀，涵蓋創世記第 1 章與出埃及記第 8 章）

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
const EXO8 = "/" + encodeURI("02-出埃及記/第8章")
const GEN6 = "/" + encodeURI("01-創世記/第6章")
const TOC = "/" + encodeURI("01-創世記/全書目錄及綱要")
const CHROME_PROFILE = join(PROFILE_ROOT, `tabcheck-${Date.now()}-${Math.floor(Math.random() * 100000)}`)
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

async function go(path, wait = 3000) {
  await s.send("Page.navigate", { url: ROOT + path })
  await sleep(wait)
}

async function goUrl(url, wait = 3000) {
  await s.send("Page.navigate", { url })
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
    return JSON.stringify({
      view: document.documentElement.getAttribute("data-ux-view"),
      hasTabsAttr: document.documentElement.hasAttribute("data-ux-tabs"),
      sections,
      olVisible: shown(ol),
      raFound: !!ra,
      raVisible: ra ? shown(ra) : null,
      iaFound: !!ia,
      iaVisible: ia ? shown(ia) : null,
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
  // 直接透過 Quartz darkmode 使用的 localStorage("theme") 與 saved-theme 切換主題，
  // 避免 CDP Emulation.setEmulatedMedia 在換頁時觸發 prefers-color-scheme change 事件把 theme 寫回系統深色。
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
    const fg = parse(getComputedStyle(document.querySelector(${JSON.stringify(fgSel)})).color)
    const bg = parse(getComputedStyle(document.querySelector(${JSON.stringify(bgSel)})).backgroundColor)
    const a = lum(fg), b = lum(bg)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })()`
}

async function measureContrast(themeLabel) {
  const activeSel = '.bwz-tabs [role="tab"][aria-selected="true"]'
  const inactiveSel = '.bwz-tabs [role="tab"][aria-selected="false"]'
  const hintSel = ".bwz-tabs-hint"
  const dbg = await s.ev(`JSON.stringify({ attr: document.documentElement.getAttribute("saved-theme"), ls: localStorage.getItem("theme"), mqDark: matchMedia("(prefers-color-scheme: dark)").matches, href: location.pathname })`).then(JSON.parse)
  const actualTheme = dbg.attr
  const activeRatio = await s.ev(srgbContrastExpr(activeSel, activeSel))
  const inactiveRatio = await s.ev(srgbContrastExpr(inactiveSel, ".bwz-tabs-seg"))
  const hintRatio = await s.ev(srgbContrastExpr(hintSel, ".bwz-tabs"))
  contrastReport.push(
    `${themeLabel} (saved-theme=${actualTheme}): active=${Number(activeRatio).toFixed(2)}:1, inactive=${Number(inactiveRatio).toFixed(2)}:1, hint=${Number(hintRatio).toFixed(2)}:1`,
  )
  s.check(`[${themeLabel}] 頁面主題確實為 ${themeLabel.endsWith("dark") ? "dark" : "light"}`, actualTheme === (themeLabel.endsWith("dark") ? "dark" : "light"), JSON.stringify(dbg))
  s.check(`[${themeLabel}] 分頁選中按鈕文字對比 ≥ 4.5:1`, activeRatio >= 4.5, `${Number(activeRatio).toFixed(2)}:1`)
  s.check(`[${themeLabel}] 分頁未選中按鈕文字對比 ≥ 4.5:1`, inactiveRatio >= 4.5, `${Number(inactiveRatio).toFixed(2)}:1`)
  s.check(`[${themeLabel}] 分頁列說明文字對比 ≥ 4.5:1`, hintRatio >= 4.5, `${Number(hintRatio).toFixed(2)}:1`)
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
  const moved = await clickNextChapter(2)
  s.check("研讀分頁下以 SPA 換到第 2 章", moved, await s.ev(`location.pathname`))
  if (moved) {
    await waitChapter()
    const snap2 = await sectionSnapshot()
    s.check("SPA 換到第 2 章仍維持研讀分頁（藏經文、顯示本章整理）", snap2.view === "study" && !snap2.olVisible && snap2.sections["本章整理"]?.visible, JSON.stringify(snap2))
  }

  // 重新整理：驗證 DOMContentLoaded 第一次繪製前就已是 study、經文清單不可見
  const captureFirstPaint = `(() => {
    window.__tabFirstPaint = null
    document.addEventListener("DOMContentLoaded", () => {
      const ol = document.querySelector("article .markdown-preview-view > ol") || document.querySelector("article ol")
      let olVisible = null
      if (ol) {
        const cs = getComputedStyle(ol)
        olVisible = cs.display !== "none" && cs.visibility !== "hidden"
      }
      window.__tabFirstPaint = {
        view: document.documentElement.getAttribute("data-ux-view"),
        olVisible,
      }
    }, { once: true })
  })()`
  const fpScript = await s.send("Page.addScriptToEvaluateOnNewDocument", { source: captureFirstPaint })
  await s.send("Page.reload", { ignoreCache: true })
  await waitChapter()
  await waitFor(`!!window.__tabFirstPaint`, 6000)
  const fp = await s.ev(`window.__tabFirstPaint || null`)
  s.check("重新整理第一次 DOMContentLoaded 已是 study 且經文不可見", fp?.view === "study" && fp?.olVisible === false, JSON.stringify(fp))
  if (fpScript?.identifier) {
    await s.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: fpScript.identifier })
  }

  // 同一瀏覽器開新分頁：localStorage 記憶應延續 "study"
  const browser = await s.openBrowserSocket()
  const created = await browser.send("Target.createTarget", { url: "about:blank" })
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true })
  const sessionId = attached.sessionId
  await browser.send("Page.enable", {}, sessionId)
  await browser.send("Runtime.enable", {}, sessionId)
  await browser.send("Page.navigate", { url: ROOT + chapterPath(1) }, sessionId)

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
  s.check("新分頁延續 localStorage 上次選擇的「研讀」分頁", !!state && state.view === "study" && state.ls === "study" && state.olDisplay === "none", JSON.stringify(state))
  await browser.send("Target.closeTarget", { targetId: created.targetId })
}

async function testVerseTagJump() {
  console.log("\n== 4. 研讀頁點擊經節小標籤 → 切回經文頁、捲到該節並短暫標示 ==")
  await s.setViewport(1440, 900)
  await go(chapterPath(1))
  await waitChapter()
  await clickTab("study")
  await sleep(300)

  const vrefInfo = await s.ev(`(() => {
    const el = [...document.querySelectorAll('.bwz-rl-vref[data-rl-verse]')].find((a) => Number(a.dataset.rlVerse) >= 3)
      || document.querySelector('.bwz-rl-vref[data-rl-verse]')
    if (!el) return null
    const verse = Number(el.dataset.rlVerse)
    el.click()
    return JSON.stringify({ verse, text: (el.textContent || "").trim() })
  })()`).then((v) => (v ? JSON.parse(v) : null))

  if (!vrefInfo) {
    skip("研讀頁經節小標籤跳轉", "第 1 章沒有帶 data-rl-verse 的 .bwz-rl-vref")
    return
  }

  await sleep(300)
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
    `點研讀頁經節標籤「${vrefInfo.text}」（第 ${vrefInfo.verse} 節）→ 切回經文、捲到該節且不被分頁列遮住並標示 .bwz-vr-flash`,
    !!after && after.view === "text" && after.flashed && after.belowTabs,
    JSON.stringify(after),
  )
}

async function testMobileQuickbarAndTabs() {
  console.log("\n== 5. 手機 390×844：頁首分頁列 ＋ 捲動後快捷列分頁取代「本章整理」 ==")
  await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
  await go(chapterPath(1))
  await waitChapter()
  await clickTab("text")
  await sleep(250)

  const topState = await s.ev(`(() => ({
    hasOldSummaryBtn: !!document.querySelector(".bwz-cqb-summary"),
    tabsVisible: ${visibleExpression('document.querySelector(".bwz-tabs")')},
    tabsPos: getComputedStyle(document.querySelector(".bwz-tabs")).position,
    noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
  }))()`)
  s.check(
    "手機頁首：無舊 .bwz-cqb-summary、頁首流內分頁列可見、無橫向捲動",
    !!topState && !topState.hasOldSummaryBtn && topState.tabsVisible && topState.tabsPos === "static" && topState.noOverflow,
    JSON.stringify(topState),
  )

  await s.ev(`window.scrollTo(0, Math.max(700, document.documentElement.scrollHeight * 0.55))`)
  await sleep(600)
  const barState = await s.ev(`(() => {
    const bar = document.querySelector(".bwz-cqb")
    const tabs = bar?.querySelector(".bwz-cqb-tabs")
    const br = bar?.getBoundingClientRect()
    return JSON.stringify({
      shown: !!bar?.classList.contains("is-shown"),
      tabsVisible: ${visibleExpression('document.querySelector(".bwz-cqb .bwz-cqb-tabs")')},
      barRight: br ? Math.round(br.right) : 9999,
      innerW: window.innerWidth,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    })
  })()`).then((v) => (v ? JSON.parse(v) : null))
  s.check(
    "手機捲動後：快捷列浮出並內含「經文｜研讀」分頁、無橫向溢出",
    !!barState && barState.shown && barState.tabsVisible && barState.barRight <= barState.innerW + 1 && barState.noOverflow,
    JSON.stringify(barState),
  )

  await s.ev(`document.querySelector('.bwz-cqb [data-tab="study"]')?.click()`)
  await sleep(350)
  const switched = await s.ev(`(() => ({
    view: document.documentElement.getAttribute("data-ux-view"),
    cqbStudy: document.querySelector('.bwz-cqb [data-tab="study"]')?.getAttribute("aria-selected"),
    topStudy: document.querySelector('.bwz-tabs [data-tab="study"]')?.getAttribute("aria-selected"),
  }))()`)
  s.check(
    "手機點快捷列「研讀」：切換分頁並同步頁首與快捷列狀態",
    switched?.view === "study" && switched.cqbStudy === "true" && switched.topStudy === "true",
    JSON.stringify(switched),
  )

  await s.ev(`document.querySelector('.bwz-cqb [data-tab="text"]')?.click()`)
  await sleep(250)
}

async function testRevealAndInteractiveLine() {
  console.log("\n== 6. 經文分頁：錨點暫時顯示與互動網站提示 ==")
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
    await go(chapterPath(1) + "#" + encodeURIComponent(headingId), 3500)
    await waitChapter()
    const rev = await s.ev(`(() => {
      const target = document.getElementById(${JSON.stringify(headingId)})
      const box = target?.closest(".bwz-ux-reveal")
      const others = [...document.querySelectorAll(".bwz-ux-hide:not(.bwz-ux-reveal)")]
      return JSON.stringify({
        view: document.documentElement.getAttribute("data-ux-view"),
        revealed: !!box && getComputedStyle(box).display !== "none",
        otherHiddenCount: others.length,
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

  // 創世記第 6 章：經文分頁點互動網站提示（.bwz-ia-line）→ 暫時顯示附錄並看得到小卡
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
  console.log("\n== 7. 鍵盤操作、平板 1180 黏頂與淺深色對比實測 ==")
  await s.setViewport(1180, 820)
  for (const theme of ["light", "dark"]) {
    await setTheme(theme)
    await go(chapterPath(1))
    await waitChapter()
    await clickTab("text")
    await sleep(250)
    await measureContrast(`1180-${theme}`)

    // 捲動確認分頁列黏在頂端
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

  // 鍵盤 ArrowRight / ArrowLeft
  await s.setViewport(1440, 900)
  await setTheme("light")
  await go(chapterPath(1))
  await waitChapter()
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
  console.log("\n== 8. 首頁、全書目錄與條目頁不顯示分頁且不隱藏內容 ==")
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
      hide: document.querySelectorAll(".bwz-ux-hide, .bwz-ux-text-only").length,
      hasAttr: document.documentElement.hasAttribute("data-ux-tabs"),
    }))()`)
    s.check(`${label}：沒有分頁列與隱藏標記`, st?.tabs === 0 && st.hide === 0 && !st.hasAttr, JSON.stringify(st))
  }
}

async function testBlockedLocalStorage() {
  console.log("\n== 9. localStorage 被封鎖時不出錯且本頁仍可切換分頁 ==")
  await s.setViewport(1440, 900)
  const blocked = `Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() { throw new DOMException("blocked", "SecurityError") }
  });`
  const installed = await s.send("Page.addScriptToEvaluateOnNewDocument", { source: blocked })
  await go(chapterPath(1), 3000)
  await waitChapter()
  const initView = await s.ev(`document.documentElement.getAttribute("data-ux-view")`)
  await clickTab("study")
  const afterClick = await s.ev(`document.documentElement.getAttribute("data-ux-view")`)
  s.check("localStorage 被封鎖：預設經文，且本頁仍可點擊切到研讀", initView === "text" && afterClick === "study", `init=${initView} after=${afterClick}`)
  if (installed?.identifier) {
    await s.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: installed.identifier })
  }
  // 離開被封鎖 localStorage 的文件，讓後續截圖能正常切換主題
  await go("/?skip=1", 1500)
}

async function captureScreenshots() {
  if (!SHOT_DIR) return
  console.log("\n== 10. 截圖（1440、1180×820、390 × 淺深色 × 經文／研讀） ==")
  const viewports = [
    { name: "1440", w: 1440, h: 900, mobile: false },
    { name: "1180", w: 1180, h: 820, mobile: false },
    { name: "390", w: 390, h: 844, mobile: true },
  ]
  const chapters = [
    { prefix: "gen1", path: chapterPath(1) },
    { prefix: "exo8", path: EXO8 },
  ]
  for (const ch of chapters) {
    for (const vp of viewports) {
      await s.setViewport(vp.w, vp.h, { dpr: vp.mobile ? 2 : 1, mobile: vp.mobile, touch: vp.mobile })
      for (const theme of ["light", "dark"]) {
        await setTheme(theme)
        await go(ch.path, 3000)
        await waitChapter()
        for (const tab of ["text", "study"]) {
          await clickTab(tab)
          await s.ev(`window.scrollTo(0, 0)`)
          await sleep(300)
          await saveShot(`${ch.prefix}-${tab}-${vp.name}-${theme}`)
        }
      }
    }
  }

  // 額外拍手機捲動後的快捷列（淺色與深色，創世記第 1 章研讀分頁）
  await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
  for (const theme of ["light", "dark"]) {
    await setTheme(theme)
    await go(chapterPath(1), 3000)
    await waitChapter()
    await clickTab("study")
    await s.ev(`window.scrollTo(0, 750)`)
    await sleep(500)
    await saveShot(`gen1-quickbar-390-${theme}`)
  }

  // 額外拍桌機經節跳轉標示（創世記第 1 章，點 11-12節讓第 11 節置中並顯示標示框）
  await s.setViewport(1440, 900)
  await setTheme("light")
  await go(chapterPath(1), 3000)
  await waitChapter()
  await clickTab("study")
  await sleep(250)
  await s.ev(`([...document.querySelectorAll('.bwz-rl-vref[data-rl-verse]')].find((a) => Number(a.dataset.rlVerse) >= 3) || document.querySelector('.bwz-rl-vref[data-rl-verse]'))?.click()`)
  await sleep(250)
  await saveShot(`gen1-versejump-1440-light`)
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
  await go(chapterPath(1))
  await waitChapter()
  const textSnap = await sectionSnapshot()
  s.check("首次造訪預設 data-ux-view=text 且有分頁標記", textSnap.view === "text" && textSnap.hasTabsAttr, JSON.stringify(textSnap))
  s.check("經文分頁：經文清單可見", textSnap.olVisible, JSON.stringify(textSnap))
  if (textSnap.raFound) s.check("經文分頁：朗讀列可見", textSnap.raVisible === true, JSON.stringify(textSnap))
  if (textSnap.iaFound) s.check("經文分頁：互動網站提示可見", textSnap.iaVisible === true, JSON.stringify(textSnap))
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

  console.log("\n== 2. 切到「研讀」分頁：藏經文清單與朗讀列，直接看知識節點與本章整理 ==")
  await clickTab("study")
  const studySnap = await sectionSnapshot()
  s.check("切到研讀：data-ux-view=study 且寫入 localStorage", studySnap.view === "study" && (await s.ev(`localStorage.getItem("bwz-ux-view") === "study"`)), JSON.stringify(studySnap))
  s.check("研讀分頁：經文清單隱藏", !studySnap.olVisible, JSON.stringify(studySnap))
  if (studySnap.raFound) s.check("研讀分頁：朗讀列隱藏", studySnap.raVisible === false, JSON.stringify(studySnap))
  await checkSections(true, "研讀分頁", studySnap)
  s.check("研讀分頁：本章知識節點／本章整理直接出現在首屏上方（不需下捲）", (studySnap.sections["本章知識節點"]?.top ?? 9999) < 600, JSON.stringify(studySnap.sections))

  await testPersistenceAndNewTab()
  await testVerseTagJump()
  await testMobileQuickbarAndTabs()
  await testRevealAndInteractiveLine()
  await testKeyboardAndContrast()
  await testNonChapterPages()
  await testBlockedLocalStorage()
  await captureScreenshots()

  const relevant = pluginExceptions.filter((x) => RELEVANT_URL.test(x.url))
  s.check("全程沒有 site-ux／verse-return／chapterQuickBar 可辨識來源的 JS 例外", relevant.length === 0, JSON.stringify(relevant))

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
