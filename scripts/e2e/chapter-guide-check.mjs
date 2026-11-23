// Stage C「本章導覽面板」瀏覽器全面檢查＋桌機／平板／手機截圖（淺色與深色，展開與收起）。
// 用法：node scripts/e2e/chapter-guide-check.mjs <siteRoot> <profileRoot> [shotDir]
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { startBrowser, sleep } from "../../plugins/personal-notes/e2e/lib.mjs"

const [ROOT, PROFILE_ROOT, SHOT_DIR] = process.argv.slice(2)
if (!ROOT || !PROFILE_ROOT || ROOT.endsWith("/")) {
  console.error("用法：node scripts/e2e/chapter-guide-check.mjs <siteRoot，不加結尾斜線> <profileRoot> [shotDir]")
  process.exit(2)
}

mkdirSync(PROFILE_ROOT, { recursive: true })
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true })

const GEN48 = "/" + encodeURI("01-創世記/第48章")
const NUM8 = "/" + encodeURI("04-民數記/第8章")
const GEN1 = "/" + encodeURI("01-創世記/第1章")
const ABRAHAM = "/" + encodeURI("link_folder/人物/亞伯拉罕")
const SOURCES = "/" + encodeURI("資料來源")
const PROFILE = join(PROFILE_ROOT, `guide-c-${Date.now()}-${Math.floor(Math.random() * 10000)}`)

let s
const errorsSeen = []

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
}

async function setTheme(theme) {
  await s.ev(`(() => {
    localStorage.setItem("theme", ${JSON.stringify(theme)})
    document.documentElement.setAttribute("saved-theme", ${JSON.stringify(theme)})
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: ${JSON.stringify(theme)} } }))
  })()`)
  await sleep(250)
}

async function setTab(tab) {
  await s.ev(`(() => {
    const b = document.querySelector('.bwz-tabs button[data-tab="${tab}"]')
    if (b && b.getAttribute("aria-selected") !== "true") b.click()
  })()`)
  await waitFor(`document.documentElement.getAttribute("data-ux-view") === ${JSON.stringify(tab)}`, 3000)
  await sleep(250)
}

async function saveShot(filename) {
  if (!SHOT_DIR) return
  await s.saveShot(join(SHOT_DIR, filename))
}

async function measureContrast() {
  return JSON.parse(
    await s.ev(`JSON.stringify((() => {
      function parseRgb(str) {
        const m = String(str).match(/rgba?\\((\\d+(?:\\.\\d+)?),\\s*(\\d+(?:\\.\\d+)?),\\s*(\\d+(?:\\.\\d+)?)(?:,\\s*(\\d+(?:\\.\\d+)?))?/i)
        if (!m) return null
        return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 }
      }
      function blend(fg, bg) {
        const a = fg.a ?? 1
        return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
      }
      function effectiveBg(el) {
        let cur = el
        const layers = []
        while (cur && cur.nodeType === 1) {
          const c = parseRgb(getComputedStyle(cur).backgroundColor)
          if (c && c.a > 0) layers.push(c)
          cur = cur.parentElement
        }
        let base = document.documentElement.getAttribute("saved-theme") === "dark" ? { r: 28, g: 25, b: 23, a: 1 } : { r: 250, g: 247, b: 240, a: 1 }
        for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base)
        return base
      }
      function lum(c) {
        const srgb = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
        return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
      }
      function ratio(a, b) {
        const l1 = lum(a), l2 = lum(b)
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      }
      const selectors = [".bwz-guide-title", ".bwz-guide-toc-btn", ".bwz-guide-toc-btn.is-active", ".bwz-guide-src-name", ".bwz-guide-src-note", ".bwz-guide-src-ext", ".bwz-guide-res-btn"]
      const out = []
      for (const sel of selectors) {
        const el = document.querySelector("#bwz-guide " + sel)
        if (!el) continue
        const fg = parseRgb(getComputedStyle(el).color)
        const bg = effectiveBg(el)
        if (!fg || !bg) continue
        out.push({ sel, ratio: Number(ratio(fg, bg).toFixed(2)) })
      }
      return out
    })())`),
  )
}

try {
  s = await startBrowser({ root: ROOT, profile: PROFILE, width: 1440, height: 900 })

  // 1. 非章節頁不受影響（原 .toc 維持、無 #bwz-guide）
  await go("/")
  const homeInfo = JSON.parse(
    await s.ev(`JSON.stringify({
      hasGuide: !!document.querySelector('#bwz-guide'),
      hasAttr: document.documentElement.hasAttribute('data-bwz-guide'),
      hasToc: !!document.querySelector('.sidebar.right > .toc'),
      tocDisplay: document.querySelector('.sidebar.right > .toc') ? getComputedStyle(document.querySelector('.sidebar.right > .toc')).display : null
    })`),
  )
  s.check("首頁無導覽面板且原 TOC 正常顯示", !homeInfo.hasGuide && !homeInfo.hasAttr && (!homeInfo.hasToc || homeInfo.tocDisplay !== "none"), JSON.stringify(homeInfo))

  await go(ABRAHAM)
  const entryInfo = JSON.parse(
    await s.ev(`JSON.stringify({
      hasGuide: !!document.querySelector('#bwz-guide'),
      hasAttr: document.documentElement.hasAttribute('data-bwz-guide'),
      tocDisplay: document.querySelector('.sidebar.right > .toc') ? getComputedStyle(document.querySelector('.sidebar.right > .toc')).display : null
    })`),
  )
  s.check("條目頁無導覽面板且原 TOC 未被隱藏", !entryInfo.hasGuide && !entryInfo.hasAttr && entryInfo.tocDisplay !== "none", JSON.stringify(entryInfo))

  await go(SOURCES)
  const srcPageHasGuide = await s.ev(`!!document.querySelector('#bwz-guide')`)
  s.check("資料來源頁無導覽面板", !srcPageHasGuide)

  // 2. 桌機 1440 — 創48（一般章節，無分層卡片、有經文大綱）
  await go(GEN48)
  await setTheme("light")
  await setTab("text")
  const gen48Text = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const g = document.querySelector('#bwz-guide')
      const graph = document.querySelector('.sidebar.right > .graph')
      const toc = document.querySelector('.sidebar.right > .toc')
      const legend = g?.querySelector('[aria-label="怎麼看這一頁"]')
      const outlineBtns = [...(g?.querySelectorAll('.bwz-guide-toc-btn') ?? [])].map(b => b.textContent.trim())
      const srcNames = [...(g?.querySelectorAll('.bwz-guide-src-name') ?? [])].map(n => n.textContent.trim())
      const resTitles = [...(g?.querySelectorAll('.bwz-guide-res-btn span:first-child, .bwz-guide-res-link span:first-child') ?? [])].map(n => n.textContent.trim())
      const rawText = g?.innerText ?? ""
      return {
        inRightSidebar: !!document.querySelector('.sidebar.right > #bwz-guide'),
        aboveGraph: !!(g && graph && g.getBoundingClientRect().top < graph.getBoundingClientRect().top),
        tocHidden: !toc || getComputedStyle(toc).display === 'none',
        legendHidden: !legend || legend.hidden || getComputedStyle(legend).display === 'none',
        outlineBtns,
        srcCount: srcNames.length,
        srcNames,
        resTitles,
        hasJargon: /\\b(yaml|json|callout|metadata|frontmatter|slug)\\b/i.test(rawText),
      }
    })())`),
  )
  s.check("桌機創48經文頁：面板在右欄關係圖上方、原 TOC 隱藏、圖例隱藏、目錄為經文大綱 5 項、無互動網站、無內部術語",
    gen48Text.inRightSidebar &&
      gen48Text.aboveGraph &&
      gen48Text.tocHidden &&
      gen48Text.legendHidden &&
      gen48Text.outlineBtns.length === 5 &&
      gen48Text.srcCount >= 5 &&
      gen48Text.resTitles.includes("本章知識節點") &&
      gen48Text.resTitles.includes("相關地圖") &&
      !gen48Text.resTitles.includes("互動網站") &&
      gen48Text.resTitles.some((t) => t.includes("全部資料來源說明")) &&
      !gen48Text.hasJargon,
    JSON.stringify(gen48Text))

  await saveShot("gen48-text-1440-light.png")

  // 經文頁點擊大綱第2項（3-7節）→ 留在經文頁，單次捲到 #v3 並標示
  await s.ev(`document.querySelectorAll('#bwz-guide .bwz-guide-toc-btn')[1]?.click()`)
  await sleep(300)
  const textJumpInfo = JSON.parse(
    await s.ev(`JSON.stringify({
      view: document.documentElement.getAttribute('data-ux-view'),
      v3Top: Math.round(document.getElementById('v3')?.getBoundingClientRect().top ?? -999),
      tabsBottom: Math.round(document.querySelector('.bwz-tabs')?.getBoundingClientRect().bottom ?? 0),
      activeIdx: [...document.querySelectorAll('#bwz-guide .bwz-guide-toc-btn')].findIndex(b => b.classList.contains('is-active')),
      flashed: document.getElementById('v3')?.classList.contains('bwz-guide-verse-flash') ?? false
    })`),
  )
  s.check("桌機創48經文頁點目錄第2項：留在經文頁、捲到第3節、不被分頁列遮住且標亮該項",
    textJumpInfo.view === "text" &&
      textJumpInfo.v3Top >= textJumpInfo.tabsBottom - 4 &&
      textJumpInfo.v3Top < 260 &&
      textJumpInfo.activeIdx === 1 &&
      textJumpInfo.flashed,
    JSON.stringify(textJumpInfo))

  // 切回研讀分頁
  await s.ev(`window.scrollTo({ top: 0, behavior: "instant" })`)
  await setTab("study")
  await sleep(250)
  const gen48Study = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const g = document.querySelector('#bwz-guide')
      const legend = g?.querySelector('[aria-label="怎麼看這一頁"]')
      const legendTexts = [...(legend?.querySelectorAll('.bwz-guide-legend-item') ?? [])].map(li => li.innerText.trim())
      const tocBtns = [...(g?.querySelectorAll('.bwz-guide-toc-btn') ?? [])].map(b => b.textContent.trim())
      return {
        legendVisible: !!legend && !legend.hidden && getComputedStyle(legend).display !== 'none',
        legendTexts,
        tocCount: tocBtns.length,
        hasVerses: tocBtns[0] === '經文',
        hasNodes: tocBtns.some(t => t.includes('本章知識節點')),
        hasStudy: tocBtns.some(t => t.includes('本章整理')),
        hasSub: tocBtns.some(t => t.includes('從伯特利的應許說起')),
        hasAppendix: tocBtns.some(t => t === '附錄'),
      }
    })())`),
  )
  s.check("桌機創48研讀頁：顯示圖例但無卡片項目；目錄含經文、知識節點、本章整理＋小節、附錄",
    gen48Study.legendVisible &&
      gen48Study.legendTexts.some((t) => t.includes("褐色字＝聖經原句")) &&
      gen48Study.legendTexts.some((t) => t.includes("虛線名字＝點了看是哪本註釋")) &&
      gen48Study.legendTexts.some((t) => t.includes("希伯來字與編號")) &&
      !gen48Study.legendTexts.some((t) => t.includes("卡片")) &&
      gen48Study.hasVerses &&
      gen48Study.hasNodes &&
      gen48Study.hasStudy &&
      gen48Study.hasSub &&
      gen48Study.hasAppendix,
    JSON.stringify(gen48Study))
  await saveShot("gen48-study-1440-light.png")

  const lightContrast = await measureContrast()
  s.check("淺色導覽面板實測對比全部 ≥ 4.5", lightContrast.length >= 5 && lightContrast.every((x) => x.ratio >= 4.5), JSON.stringify(lightContrast))

  await setTheme("dark")
  const darkContrast = await measureContrast()
  s.check("深色導覽面板實測對比全部 ≥ 4.5", darkContrast.length >= 5 && darkContrast.every((x) => x.ratio >= 4.5), JSON.stringify(darkContrast))
  await saveShot("gen48-study-1440-dark.png")

  // 桌機收合記憶檢查＋截圖
  await setTheme("light")
  await s.ev(`document.querySelector('#bwz-guide .bwz-guide-toggle')?.click()`)
  await sleep(200)
  const collapsedDesktop = await s.ev(`document.querySelector('#bwz-guide')?.classList.contains('is-collapsed') && localStorage.getItem('bwz-guide-desktop-collapsed') === 'true'`)
  s.check("桌機點收起：面板縮成標題列並記在 localStorage", collapsedDesktop)
  await saveShot("gen48-collapsed-1440-light.png")
  // 展開回來
  await s.ev(`document.querySelector('#bwz-guide .bwz-guide-toggle')?.click()`)
  await sleep(150)

  // 點相關資源「本章知識節點」→ 展開 details 且捲到定位
  await s.ev(`(() => {
    const b = [...document.querySelectorAll('#bwz-guide .bwz-guide-res-btn')].find(x => x.textContent.includes('本章知識節點'))
    b?.click()
  })()`)
  await sleep(300)
  const nodeJump = JSON.parse(
    await s.ev(`JSON.stringify({
      open: document.getElementById('本章知識節點')?.open ?? null,
      top: Math.round(document.getElementById('本章知識節點')?.getBoundingClientRect().top ?? -999),
      tabsBottom: Math.round(document.querySelector('.bwz-tabs')?.getBoundingClientRect().bottom ?? 0),
    })`),
  )
  s.check("點相關資源「本章知識節點」：展開收合區塊並捲到可視頂端", nodeJump.open === true && nodeJump.top >= nodeJump.tabsBottom - 4 && nodeJump.top < 260, JSON.stringify(nodeJump))

  // 3. 創1（含原文/背景/應用卡片、h4 子標題、互動網站）
  await go(GEN1)
  await setTab("study")
  await setTheme("light")
  const gen1Info = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const g = document.querySelector('#bwz-guide')
      const legendTexts = [...(g?.querySelectorAll('.bwz-guide-legend-item') ?? [])].map(li => li.innerText.trim())
      const lvl4 = [...(g?.querySelectorAll('.bwz-guide-toc-btn.is-lvl-4') ?? [])].map(b => b.textContent.trim())
      const resTitles = [...(g?.querySelectorAll('.bwz-guide-res-btn span:first-child, .bwz-guide-res-link span:first-child') ?? [])].map(n => n.textContent.trim())
      return { legendTexts, lvl4, resTitles }
    })())`),
  )
  s.check("桌機創1研讀頁：圖例列出卡片說明、目錄含 H4 標題、相關資源含互動網站",
    gen1Info.legendTexts.some((t) => t.includes("原文／背景／應用卡片＝想深入再點開")) &&
      gen1Info.lvl4.some((t) => t.includes("神的形像")) &&
      gen1Info.resTitles.includes("互動網站"),
    JSON.stringify(gen1Info))
  await saveShot("gen1-study-1440-light.png")

  await setTheme("dark")
  await saveShot("gen1-study-1440-dark.png")
  await setTheme("light")
  await s.ev(`document.querySelector('#bwz-guide .bwz-guide-toggle')?.click()`)
  await sleep(150)
  await saveShot("gen1-collapsed-1440-light.png")
  await s.ev(`document.querySelector('#bwz-guide .bwz-guide-toggle')?.click()`)
  await sleep(150)

  // 4. 民8（無卡片、無經文大綱→退回 ### 經節範圍）
  await go(NUM8)
  await setTab("text")
  const num8TextOutline = JSON.parse(
    await s.ev(`JSON.stringify([...document.querySelectorAll('#bwz-guide .bwz-guide-toc-btn')].map(b => b.textContent.trim()))`),
  )
  s.check("民8經文頁：無經文大綱改取 ### 經節範圍（4段，略過無節數原文層）",
    num8TextOutline.length === 4 && num8TextOutline[0].includes("v1-4") && !num8TextOutline.some((t) => t.includes("原文層")),
    JSON.stringify(num8TextOutline))
  await saveShot("num8-text-1440-light.png")

  await setTab("study")
  const num8LegendHasCard = await s.ev(`document.querySelector('#bwz-guide [aria-label="怎麼看這一頁"]')?.innerText.includes('卡片') ?? false`)
  s.check("民8研讀頁：無卡片則圖例不列卡片一項", !num8LegendHasCard)
  await saveShot("num8-study-1440-light.png")

  // 5. 平板 1180×820：右側讓出寬度抽屜＋與左欄互斥＋右上收合小鈕
  await s.setViewport(1180, 820)
  await go(GEN48)
  await setTab("study")
  await setTheme("light")
  await sleep(250)
  const tabInit = JSON.parse(
    await s.ev(`JSON.stringify({
      attr: document.documentElement.getAttribute('data-bwz-guide'),
      fabVisible: getComputedStyle(document.querySelector('.bwz-guide-fab')).display !== 'none',
      fabText: document.querySelector('.bwz-guide-fab')?.textContent.trim(),
      leftCollapsed: document.documentElement.hasAttribute('data-bwz-sidebar-collapsed'),
      overlapTabs: (() => {
        const f = document.querySelector('.bwz-guide-fab')?.getBoundingClientRect()
        const j = document.querySelector('.bwz-tabs-jump')?.getBoundingClientRect()
        if (!f || !j) return false
        return !(f.left >= j.right || f.right <= j.left || f.bottom <= j.top || f.top >= j.bottom)
      })(),
    })`),
  )
  s.check("平板 1180 預設收合：右上顯示「本章導覽」小鈕且不壓到分頁列",
    tabInit.attr === "collapsed" && tabInit.fabVisible && !tabInit.leftCollapsed && !tabInit.overlapTabs,
    JSON.stringify(tabInit))
  await saveShot("gen48-study-1180-collapsed-light.png")

  await s.ev(`document.querySelector('.bwz-guide-fab')?.click()`)
  await sleep(300)
  const tabOpen = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const c = document.querySelector('.center')?.getBoundingClientRect()
      const g = document.querySelector('#bwz-guide')?.getBoundingClientRect()
      const l = document.querySelector('.sidebar.left')?.getBoundingClientRect()
      return {
        attr: document.documentElement.getAttribute('data-bwz-guide'),
        leftCollapsed: document.documentElement.hasAttribute('data-bwz-sidebar-collapsed'),
        leftW: l ? Math.round(l.width) : 0,
        centerRight: c ? Math.round(c.right) : 0,
        guideLeft: g ? Math.round(g.left) : 0,
        guideW: g ? Math.round(g.width) : 0,
        noOverlapCenter: !!(c && g && c.right <= g.left + 2),
      }
    })())`),
  )
  s.check("平板打開導覽抽屜：自動收合左欄，導覽讓出網格寬度不蓋正文",
    tabOpen.attr === "open" && tabOpen.leftCollapsed && tabOpen.leftW <= 68 && tabOpen.noOverlapCenter && tabOpen.guideW >= 290,
    JSON.stringify(tabOpen))
  await saveShot("gen48-study-1180-open-light.png")

  await setTheme("dark")
  await saveShot("gen48-study-1180-open-dark.png")
  await setTheme("light")

  // 互斥測試：手動點開左欄 → 平板導覽自動收起
  await s.ev(`document.querySelector('.bwz-sidebar-toggle')?.click()`)
  await sleep(250)
  const mutex = JSON.parse(
    await s.ev(`JSON.stringify({
      attr: document.documentElement.getAttribute('data-bwz-guide'),
      leftCollapsed: document.documentElement.hasAttribute('data-bwz-sidebar-collapsed'),
    })`),
  )
  s.check("平板互斥：手動展開左欄時右側導覽自動收起", mutex.attr === "collapsed" && !mutex.leftCollapsed, JSON.stringify(mutex))

  // 民8、創1 平板開抽屜截圖
  await go(NUM8)
  await setTab("study")
  await s.ev(`document.querySelector('.bwz-guide-fab')?.click()`)
  await sleep(250)
  await saveShot("num8-study-1180-open-light.png")

  await go(GEN1)
  await setTab("study")
  await s.ev(`document.querySelector('.bwz-guide-fab')?.click()`)
  await sleep(250)
  await saveShot("gen1-study-1180-open-light.png")

  // 6. 手機 390×844：頁首分頁列單行不換行 ＋ 快捷列「目錄」開底部抽屜
  await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
  await go(GEN48)
  await setTab("study")
  await setTheme("light")
  await sleep(250)
  const mobTabs = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const t = document.querySelector('.bwz-tabs')
      const btns = [...(t?.querySelectorAll('button') ?? [])]
      const tops = btns.map(b => Math.round(b.getBoundingClientRect().top))
      const rights = btns.map(b => Math.round(b.getBoundingClientRect().right))
      return {
        btnCount: btns.length,
        sameRow: tops.length >= 2 && Math.max(...tops) - Math.min(...tops) <= 6,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        maxRight: rights.length ? Math.max(...rights) : 0,
        vw: window.innerWidth,
      }
    })())`),
  )
  s.check("手機 390 分頁列：經文｜研讀＋跳到本章整理單行不換行且不水平溢出",
    mobTabs.btnCount === 3 && mobTabs.sameRow && !mobTabs.overflowX && mobTabs.maxRight <= mobTabs.vw,
    JSON.stringify(mobTabs))
  await saveShot("gen48-study-390-collapsed-light.png")

  // 往下捲讓快捷列出現並檢查單行不溢出
  await s.ev(`window.scrollTo({ top: 750, behavior: "instant" })`)
  await sleep(300)
  const cqbInfo = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const bar = document.querySelector('.bwz-cqb')
      const gBtn = bar?.querySelector('.bwz-cqb-guide')
      const items = [...(bar?.children ?? [])].filter(c => getComputedStyle(c).display !== 'none' && !c.hidden)
      const tops = items.map(c => Math.round(c.getBoundingClientRect().top))
      return {
        shown: !!bar?.classList.contains('is-shown'),
        hasGuideBtn: !!gBtn && !gBtn.hidden,
        barWidth: bar ? Math.round(bar.getBoundingClientRect().width) : 0,
        barScrollW: bar ? Math.round(bar.scrollWidth) : 0,
        singleRow: tops.length >= 4 && Math.max(...tops) - Math.min(...tops) <= 6,
      }
    })())`),
  )
  s.check("手機 390 快捷列含「目錄」鈕，單行且不超寬",
    cqbInfo.shown && cqbInfo.hasGuideBtn && cqbInfo.barScrollW <= cqbInfo.barWidth + 1 && cqbInfo.singleRow,
    JSON.stringify(cqbInfo))

  // 點快捷列「目錄」開底部抽屜
  await s.ev(`document.querySelector('.bwz-cqb-guide')?.click()`)
  await sleep(250)
  const mobDrawerOpen = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const g = document.querySelector('#bwz-guide')
      const gr = g?.getBoundingClientRect()
      const bd = document.querySelector('.bwz-guide-backdrop')
      return {
        attr: document.documentElement.getAttribute('data-bwz-guide'),
        visible: !!gr && gr.height > 120 && gr.height < window.innerHeight - 60,
        atBottom: !!gr && Math.abs(gr.bottom - window.innerHeight) <= 2,
        hasBackdrop: !!bd && getComputedStyle(bd).display !== 'none',
      }
    })())`),
  )
  s.check("手機點快捷列「目錄」開底部抽屜（不蓋滿整頁、有遮罩）",
    mobDrawerOpen.attr === "open" && mobDrawerOpen.visible && mobDrawerOpen.atBottom && mobDrawerOpen.hasBackdrop,
    JSON.stringify(mobDrawerOpen))
  await saveShot("gen48-study-390-drawer-light.png")

  await setTheme("dark")
  await saveShot("gen48-study-390-drawer-dark.png")
  await setTheme("light")

  // 手機點目錄第3項跳轉後自動收起
  await s.ev(`document.querySelectorAll('#bwz-guide .bwz-guide-toc-btn')[2]?.click()`)
  await sleep(300)
  const mobAfterJump = await s.ev(`document.documentElement.getAttribute('data-bwz-guide') === 'collapsed'`)
  s.check("手機點導覽項目跳轉後抽屜自動收起", mobAfterJump)

  // Esc 鍵關閉＋焦點回到「目錄」鈕
  await s.ev(`document.querySelector('.bwz-cqb-guide')?.click()`)
  await sleep(150)
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await sleep(150)
  const mobEsc = JSON.parse(
    await s.ev(`JSON.stringify({
      attr: document.documentElement.getAttribute('data-bwz-guide'),
      focusedGuideBtn: document.activeElement?.classList.contains('bwz-cqb-guide') ?? false,
    })`),
  )
  s.check("手機按 Esc 關閉抽屜且焦點回到快捷列「目錄」鈕", mobEsc.attr === "collapsed" && mobEsc.focusedGuideBtn, JSON.stringify(mobEsc))

  // 民8、創1 手機截圖
  await go(NUM8)
  await setTab("study")
  await s.ev(`window.scrollTo({ top: 750, behavior: "instant" })`)
  await sleep(250)
  await s.ev(`document.querySelector('.bwz-cqb-guide')?.click()`)
  await sleep(250)
  await saveShot("num8-study-390-drawer-light.png")

  await go(GEN1)
  await setTab("study")
  await sleep(250)
  await saveShot("gen1-study-390-collapsed-light.png")
  await s.ev(`window.scrollTo({ top: 750, behavior: "instant" })`)
  await sleep(250)
  await s.ev(`document.querySelector('.bwz-cqb-guide')?.click()`)
  await sleep(250)
  await saveShot("gen1-study-390-drawer-light.png")

  s.check("無任何未捕捉的 JavaScript 例外", s.errors.length === 0, s.errors.slice(0, 3).join(" | "))
} finally {
  await s?.finish()
}
