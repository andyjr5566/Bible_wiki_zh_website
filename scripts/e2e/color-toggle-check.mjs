// Stage E2「原句上色開關放進 Aa 面板」瀏覽器驗證＋桌機 1440／手機 390 淺深色（開／關各一）截圖：
// 用法：node scripts/e2e/color-toggle-check.mjs <siteRoot> <profileRoot> [shotDir]
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { startBrowser, sleep } from "../../plugins/personal-notes/e2e/lib.mjs"

const [ROOT, PROFILE_ROOT, SHOT_DIR] = process.argv.slice(2)
if (!ROOT || !PROFILE_ROOT || ROOT.endsWith("/")) {
  console.error("用法：node scripts/e2e/color-toggle-check.mjs <siteRoot，不加結尾斜線> <profileRoot> [shotDir]")
  process.exit(2)
}

mkdirSync(PROFILE_ROOT, { recursive: true })
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true })

const GEN1 = "/" + encodeURI("01-創世記/第1章")
const GEN2 = "/" + encodeURI("01-創世記/第2章")
const EXO8 = "/" + encodeURI("02-出埃及記/第8章")
const PROFILE = join(PROFILE_ROOT, `stage-e2-${Date.now()}-${Math.floor(Math.random() * 10000)}`)

let s
const allChecks = []

async function openBrowser(opts) {
  const b = await startBrowser(opts)
  const origCheck = b.check
  b.check = (name, ok, detail = "") => {
    allChecks.push(Boolean(ok))
    origCheck(name, ok, detail)
  }
  return b
}

async function waitFor(expr, ms = 6000) {
  let v
  for (let t = 0; t < ms; t += 150) {
    v = await s.ev(expr)
    if (v) return v
    await sleep(150)
  }
  return v
}

async function go(path, wait = 2600) {
  await s.go(path, wait)
  await waitFor(`document.readyState === "complete"`, 3000)
  await s.ev(`(() => {
    const dismiss = [...document.querySelectorAll('button')].find(b => /不再提示|之後再說/.test(b.textContent || ''))
    if (dismiss) dismiss.click()
  })()`)
  await sleep(200)
}

async function setTheme(theme) {
  await s.ev(`(() => {
    localStorage.setItem("theme", ${JSON.stringify(theme)})
    document.documentElement.setAttribute("saved-theme", ${JSON.stringify(theme)})
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: ${JSON.stringify(theme)} } }))
  })()`)
  await sleep(250)
}

async function ensureStudyTab() {
  await s.ev(`(() => {
    const b = document.querySelector('.bwz-tabs button[data-tab="study"]')
    if (b && b.getAttribute("aria-selected") !== "true") b.click()
  })()`)
  await waitFor(`document.documentElement.getAttribute("data-ux-view") === "study"`, 3000)
  await sleep(200)
}

async function openAaPanel() {
  const already = await s.ev(`!!document.querySelector('#site-ux-panel')`)
  if (!already) {
    await s.ev(`document.querySelector('.site-ux-btn')?.click()`)
    await waitFor(`!!document.querySelector('#site-ux-panel')`, 2500)
    await sleep(180)
  }
}

async function closeAaPanel() {
  if (await s.ev(`!!document.querySelector('#site-ux-panel')`)) {
    await s.ev(`document.querySelector('#site-ux-panel .site-ux-close')?.click()`)
    await sleep(150)
  }
}

async function toggleColorSwitch() {
  await openAaPanel()
  await s.ev(`document.querySelector('#site-ux-panel [role=switch][data-name="quoteColor"]')?.click()`)
  await sleep(220)
}

async function scrollToBothQuotes() {
  await s.ev(`(() => {
    const cq = [...document.querySelectorAll('article .bwz-rl-cquote')].find(el => {
      const p = el.closest('p')
      return p && p.querySelector('.bwz-rl-quote, .bwz-rl-vref, .bwz-rl-src')
    }) || document.querySelector('article .bwz-rl-cquote') || document.querySelector('article .bwz-rl-quote')
    if (cq) {
      const p = cq.closest('p, li') || cq
      window.scrollTo({ top: Math.max(0, window.scrollY + p.getBoundingClientRect().top - 120), behavior: "instant" })
    }
  })()`)
  await sleep(220)
}

async function measureSampleStyles() {
  return JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const q = document.querySelector('article .bwz-rl-quote')
      const cq = document.querySelector('article .bwz-rl-cquote')
      const p = cq?.closest('p') || q?.closest('p') || document.querySelector('article .bwz-ux-hide p')
      const vref = document.querySelector('article .bwz-rl-vref')
      const src = document.querySelector('article .bwz-rl-src')
      const csQ = q ? getComputedStyle(q) : null
      const csCq = cq ? getComputedStyle(cq) : null
      const csP = p ? getComputedStyle(p) : null
      const csV = vref ? getComputedStyle(vref) : null
      const csS = src ? getComputedStyle(src) : null
      const guideQuote = document.querySelector('#bwz-guide .bwz-guide-legend-item.is-quote')
      const guideCquote = document.querySelector('#bwz-guide .bwz-guide-legend-item.is-cquote')
      const guideSrc = document.querySelector('#bwz-guide .bwz-guide-legend-item.is-src')
      const vis = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none'
      return {
        attr: document.documentElement.getAttribute('data-ux-qcolor'),
        ls: localStorage.getItem('bwz-ux-quotecolor'),
        pColor: csP?.color ?? null,
        qColor: csQ?.color ?? null,
        qBg: csQ?.backgroundColor ?? null,
        qBorderW: csQ?.borderBottomWidth ?? null,
        cqColor: csCq?.color ?? null,
        cqBg: csCq?.backgroundColor ?? null,
        cqBorderW: csCq?.borderBottomWidth ?? null,
        cqPadL: csCq?.paddingLeft ?? null,
        vrefBg: csV?.backgroundColor ?? null,
        vrefColor: csV?.color ?? null,
        srcBorderStyle: csS?.borderBottomStyle ?? null,
        guideQuoteVisible: vis(guideQuote),
        guideCquoteVisible: vis(guideCquote),
        guideSrcVisible: vis(guideSrc),
      }
    })())`),
  )
}

async function runKey(key, code, vk, text = "") {
  await s.send("Input.dispatchKeyEvent", {
    type: text ? "keyDown" : "rawKeyDown",
    key,
    code,
    windowsVirtualKeyCode: vk,
    text,
  })
  await s.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode: vk,
  })
  await sleep(140)
}

async function main() {
  // ---- 1. 桌機 1440：預設開、切換關、功能保留、記憶、SPA 換頁、列印、鍵盤、恢復預設 ----
  s = await openBrowser({ root: ROOT, profile: PROFILE, shotDir: SHOT_DIR, width: 1440, height: 900 })
  await s.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      try { localStorage.wikiTourCompleted = '1' } catch {}
      new MutationObserver(() => {
        if (document.documentElement.getAttribute('data-ux-qcolor') === 'off' && !window.__qcolorAt) {
          window.__qcolorAt = document.body ? 'body' : 'head'
        }
      }).observe(document, { attributes: true, subtree: true })
    `,
  })

  await go(GEN1)
  await setTheme("light")
  await ensureStudyTab()

  await openAaPanel()
  const swMeta = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const sw = document.querySelector('#site-ux-panel [role=switch][data-name="quoteColor"]')
      if (!sw) return { found: false }
      const r = sw.getBoundingClientRect()
      const groups = document.querySelectorAll('#site-ux-panel .site-ux-group').length
      const switches = document.querySelectorAll('#site-ux-panel [role=switch]').length
      return {
        found: true,
        groups,
        switches,
        checked: sw.getAttribute('aria-checked'),
        text: sw.textContent.replace(/\\s+/g, ' ').trim(),
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    })())`),
  )
  s.check(
    "Aa 面板只有一個原句上色開關、預設開啟、文案無內部詞",
    swMeta.found &&
      swMeta.switches === 1 &&
      swMeta.groups === 4 &&
      swMeta.checked === "true" &&
      swMeta.text.includes("原句上色") &&
      !/bwz|qcolor|yaml|slug|callout/i.test(swMeta.text) &&
      swMeta.h >= 44,
    JSON.stringify(swMeta),
  )

  await closeAaPanel()
  await scrollToBothQuotes()
  const onLight = await measureSampleStyles()
  s.check(
    "淺色預設（開）：經文原句褐色、註釋原話青色、圖例兩列都顯示、html 不留屬性",
    onLight.attr === null &&
      onLight.qColor !== onLight.pColor &&
      onLight.cqColor !== onLight.pColor &&
      onLight.qColor !== onLight.cqColor &&
      onLight.cqBg !== "rgba(0, 0, 0, 0)" &&
      onLight.guideQuoteVisible &&
      onLight.guideCquoteVisible &&
      onLight.guideSrcVisible,
    JSON.stringify(onLight),
  )
  if (SHOT_DIR) await s.saveShot(join(SHOT_DIR, "desktop-1440-light-on.png"))

  // 切換為關閉，拍含 Aa 面板＋導覽圖例＋內文的畫面，再關閉面板
  await toggleColorSwitch()
  const swCheckedOff = await s.ev(`document.querySelector('#site-ux-panel [role=switch][data-name="quoteColor"]')?.getAttribute('aria-checked')`)
  const offLight = await measureSampleStyles()
  if (SHOT_DIR) await s.saveShot(join(SHOT_DIR, "desktop-1440-light-panel-off.png"))
  await closeAaPanel()
  await scrollToBothQuotes()
  s.check(
    "淺色切關閉：經文與註釋原句一起改為內文樣式（色／底色／底線全拿掉），導覽兩列隱藏",
    swCheckedOff === "false" &&
      offLight.attr === "off" &&
      offLight.ls === "off" &&
      offLight.qColor === offLight.pColor &&
      offLight.cqColor === offLight.pColor &&
      offLight.cqBg === "rgba(0, 0, 0, 0)" &&
      offLight.cqBorderW === "0px" &&
      offLight.cqPadL === "0px" &&
      !offLight.guideQuoteVisible &&
      !offLight.guideCquoteVisible &&
      offLight.guideSrcVisible,
    JSON.stringify(offLight),
  )
  s.check(
    "關閉上色後：經節小標籤與來源說明卡仍正常顯示",
    offLight.vrefBg === onLight.vrefBg &&
      offLight.vrefColor === onLight.vrefColor &&
      offLight.srcBorderStyle === onLight.srcBorderStyle &&
      offLight.srcBorderStyle !== "none",
    JSON.stringify({ vrefBg: offLight.vrefBg, srcBorderStyle: offLight.srcBorderStyle }),
  )
  if (SHOT_DIR) await s.saveShot(join(SHOT_DIR, "desktop-1440-light-off.png"))

  // 說明卡仍可點開、出8 英文註釋中的站內連結仍維持連結樣式
  await s.ev(`document.querySelector('article .bwz-rl-src')?.click()`)
  await sleep(160)
  const popOpenOff = await s.ev(`!!document.querySelector('.bwz-rl-popover')`)
  await s.ev(`document.querySelector('.bwz-rl-popover .bwz-rl-pop-close')?.click()`)
  s.check("關閉上色後點擊來源名字仍可開說明卡", popOpenOff === true)

  // 重新整理：head 階段即套用 data-ux-qcolor=off，設定保留
  await go(GEN1)
  await ensureStudyTab()
  await scrollToBothQuotes()
  const reloadedOff = await measureSampleStyles()
  const qcolorHead = await s.ev(`window.__qcolorAt`)
  s.check(
    "重新整理後設定保留且在 <body> 出現前已套用（無閃爍）",
    reloadedOff.attr === "off" &&
      reloadedOff.cqColor === reloadedOff.pColor &&
      reloadedOff.qColor === reloadedOff.pColor &&
      !reloadedOff.guideQuoteVisible &&
      !reloadedOff.guideCquoteVisible &&
      qcolorHead === "head",
    JSON.stringify({ qcolorHead, attr: reloadedOff.attr, p: reloadedOff.pColor, cq: reloadedOff.cqColor }),
  )

  // SPA 換頁到第 2 章：設定與隱藏狀態維持
  await s.ev(`window.__sameDoc = "alive"`)
  await s.ev(`[...document.querySelectorAll('a')].find(a => decodeURIComponent(a.getAttribute('href') || '').endsWith('第2章'))?.click()`)
  await waitFor(`decodeURIComponent(location.pathname).endsWith("第2章")`, 4000)
  await sleep(450)
  await ensureStudyTab()
  await scrollToBothQuotes()
  const spaOff = await measureSampleStyles()
  const sameDoc = await s.ev(`window.__sameDoc`)
  s.check(
    "SPA 換頁（創1 → 創2）後設定與圖例隱藏皆維持",
    sameDoc === "alive" &&
      spaOff.attr === "off" &&
      spaOff.qColor === spaOff.pColor &&
      spaOff.cqColor === spaOff.pColor &&
      !spaOff.guideQuoteVisible &&
      !spaOff.guideCquoteVisible,
    JSON.stringify({ sameDoc, ...spaOff }),
  )

  // SPA 跳去出8：註釋原話內嵌連結仍保有連結樣式
  await s.ev(`[...document.querySelectorAll('a')].find(a => decodeURIComponent(a.getAttribute('href') || '').includes('第8章'))?.click()`)
  await sleep(300)
  await go(EXO8)
  await ensureStudyTab()
  const exoNestedLink = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const cq = [...document.querySelectorAll('article .bwz-rl-cquote')].find(c => c.querySelector('a.internal-link'))
      const a = cq?.querySelector('a.internal-link')
      const p = cq?.closest('p')
      if (!a || !p) return { found: false }
      return { found: true, aColor: getComputedStyle(a).color, pColor: getComputedStyle(p).color, cqColor: getComputedStyle(cq).color }
    })())`),
  )
  s.check(
    "關閉上色後：出8 註釋原話內嵌連結仍保持可辨識連結樣式",
    exoNestedLink.found && exoNestedLink.cqColor === exoNestedLink.pColor && exoNestedLink.aColor !== exoNestedLink.pColor,
    JSON.stringify(exoNestedLink),
  )

  // 列印模式驗證（關閉時與開啟時）
  await s.send("Emulation.setEmulatedMedia", { media: "print" })
  await sleep(200)
  const printOff = await measureSampleStyles()
  await s.ev(`document.documentElement.removeAttribute("data-ux-qcolor"); localStorage.setItem("bwz-ux-quotecolor", "on")`)
  await sleep(200)
  const printOn = await measureSampleStyles()
  await s.send("Emulation.setEmulatedMedia", { media: "" })
  s.check(
    "列印模式照設定：關閉為一般內文（無底線無色）；開啟恢復褐色與青色底線",
    printOff.qColor === printOff.pColor &&
      printOff.cqColor === printOff.pColor &&
      printOff.cqBorderW === "0px" &&
      printOn.qColor !== printOn.pColor &&
      printOn.cqColor !== printOn.pColor &&
      printOn.cqBorderW !== "0px",
    JSON.stringify({ printOff, printOn }),
  )

  // 深色模式（桌機 1440）：開／關截圖＋檢查
  await go(GEN1)
  await setTheme("dark")
  await ensureStudyTab()
  await scrollToBothQuotes()
  const onDark = await measureSampleStyles()
  s.check(
    "深色模式預設（開）：經文亮褐、註釋亮青，與深色內文清楚區分",
    onDark.attr === null &&
      onDark.qColor !== onDark.pColor &&
      onDark.cqColor !== onDark.pColor &&
      onDark.guideQuoteVisible &&
      onDark.guideCquoteVisible,
    JSON.stringify(onDark),
  )
  if (SHOT_DIR) await s.saveShot(join(SHOT_DIR, "desktop-1440-dark-on.png"))

  await toggleColorSwitch()
  await closeAaPanel()
  await scrollToBothQuotes()
  const offDark = await measureSampleStyles()
  s.check(
    "深色模式切關閉：經文與註釋原句改為深色內文樣式（色／底色／底線拿掉）、圖例兩列隱藏",
    offDark.attr === "off" &&
      offDark.qColor === offDark.pColor &&
      offDark.cqColor === offDark.pColor &&
      offDark.cqBg === "rgba(0, 0, 0, 0)" &&
      offDark.cqBorderW === "0px" &&
      !offDark.guideQuoteVisible &&
      !offDark.guideCquoteVisible,
    JSON.stringify(offDark),
  )
  if (SHOT_DIR) await s.saveShot(join(SHOT_DIR, "desktop-1440-dark-off.png"))

  // 鍵盤操作開關 + 恢復預設
  await openAaPanel()
  await s.ev(`document.querySelector('#site-ux-panel [role=switch][data-name="quoteColor"]')?.focus()`)
  await sleep(100)
  await runKey(" ", "Space", 32, " ")
  const afterKeyOn = await s.ev(`document.documentElement.getAttribute('data-ux-qcolor')`)
  await runKey("Enter", "Enter", 13, "\r")
  const afterKeyOff = await s.ev(`document.documentElement.getAttribute('data-ux-qcolor')`)
  await s.ev(`document.querySelector('#site-ux-panel .site-ux-reset')?.click()`)
  await sleep(180)
  const afterReset = await measureSampleStyles()
  await runKey("Escape", "Escape", 27)
  s.check(
    "鍵盤（Space／Enter）可切換開關，「恢復預設」回到開啟狀態",
    afterKeyOn === null &&
      afterKeyOff === "off" &&
      afterReset.attr === null &&
      afterReset.ls === "on" &&
      afterReset.guideQuoteVisible &&
      afterReset.guideCquoteVisible,
    JSON.stringify({ afterKeyOn, afterKeyOff, attr: afterReset.attr, ls: afterReset.ls }),
  )

  await s.send("Browser.close").catch(() => {})
  await sleep(300)

  // ---- 2. 手機 390×844（淺／深 × 開／關） ----
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
  s = await openBrowser({
    root: ROOT,
    profile: `${PROFILE}-m`,
    shotDir: SHOT_DIR,
    width: 390,
    height: 844,
    mobile: true,
    userAgent: UA,
  })
  await s.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "try { localStorage.wikiTourCompleted = '1' } catch {}",
  })

  for (const theme of ["light", "dark"]) {
    await go(GEN2)
    await setTheme(theme)
    await ensureStudyTab()
    await s.ev(`localStorage.setItem("bwz-ux-quotecolor", "on"); document.documentElement.removeAttribute("data-ux-qcolor")`)
    await sleep(150)
    await scrollToBothQuotes()
    const mOn = await measureSampleStyles()
    const overflowOn = await s.ev(`document.documentElement.scrollWidth > window.innerWidth`)
    s.check(`手機 390（${theme}／開）：樣式正常且不水平溢出`, mOn.qColor !== mOn.pColor && mOn.cqColor !== mOn.pColor && !overflowOn)
    if (SHOT_DIR) await s.saveShot(join(SHOT_DIR, `mobile-390-${theme}-on.png`))

    await toggleColorSwitch()
    if (theme === "light" && SHOT_DIR) {
      await s.saveShot(join(SHOT_DIR, "mobile-390-light-panel.png"))
    }
    const touchRect = JSON.parse(
      await s.ev(`JSON.stringify((() => {
        const b = document.querySelector('#site-ux-panel [role=switch][data-name="quoteColor"]').getBoundingClientRect()
        return { w: Math.round(b.width), h: Math.round(b.height), sw: document.documentElement.scrollWidth, iw: window.innerWidth }
      })())`),
    )
    await closeAaPanel()
    await scrollToBothQuotes()
    const mOff = await measureSampleStyles()
    s.check(
      `手機 390（${theme}／關）：原句變內文樣式、開關觸控 ≥ 44px、不水平溢出`,
      mOff.qColor === mOff.pColor &&
        mOff.cqColor === mOff.pColor &&
        touchRect.w >= 44 &&
        touchRect.h >= 44 &&
        touchRect.sw <= touchRect.iw,
      JSON.stringify(touchRect),
    )
    if (SHOT_DIR) await s.saveShot(join(SHOT_DIR, `mobile-390-${theme}-off.png`))
  }

  await s.send("Browser.close").catch(() => {})
  const passed = allChecks.filter(Boolean).length
  console.log(`\n總計 ${passed}/${allChecks.length} 通過`)
  process.exit(allChecks.every(Boolean) ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
