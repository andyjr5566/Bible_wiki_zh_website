// Stage E「註釋原話有自己的樣子」瀏覽器驗證＋桌機 1440／手機 390 淺深色截圖：
// 用法：node scripts/e2e/commentary-quote-check.mjs <siteRoot> <profileRoot> [shotDir]
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { startBrowser, sleep } from "../../plugins/personal-notes/e2e/lib.mjs"

const [ROOT, PROFILE_ROOT, SHOT_DIR] = process.argv.slice(2)
if (!ROOT || !PROFILE_ROOT || ROOT.endsWith("/")) {
  console.error("用法：node scripts/e2e/commentary-quote-check.mjs <siteRoot，不加結尾斜線> <profileRoot> [shotDir]")
  process.exit(2)
}

mkdirSync(PROFILE_ROOT, { recursive: true })
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true })

const GEN1 = "/" + encodeURI("01-創世記/第1章")
const GEN2 = "/" + encodeURI("01-創世記/第2章")
const EXO8 = "/" + encodeURI("02-出埃及記/第8章")
const GEN48 = "/" + encodeURI("01-創世記/第48章")
const ENTRY_HOUSEHOLD = "/" + encodeURI("link_folder/主題/一家一隻")
const PROFILE = join(PROFILE_ROOT, `stage-e-${Date.now()}-${Math.floor(Math.random() * 10000)}`)

let s

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
  await sleep(150)
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

async function scrollFirst(selector, offset = 110) {
  await s.ev(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return
    const p = el.closest('p, li') || el
    window.scrollTo({ top: Math.max(0, window.scrollY + p.getBoundingClientRect().top - ${offset}), behavior: "instant" })
  })()`)
  await sleep(200)
}

async function scrollToText(needle, offset = 110) {
  await s.ev(`(() => {
    const el = [...document.querySelectorAll('article p, article li')].find(p => p.textContent.includes(${JSON.stringify(needle)}) && p.getBoundingClientRect().height > 0)
    if (!el) return
    window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - ${offset}), behavior: "instant" })
  })()`)
  await sleep(200)
}

async function measureContrastOf(selector) {
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
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.getBoundingClientRect().height > 0).slice(0, 6)
      return els.map(el => ({
        text: el.textContent.trim().slice(0, 18),
        color: getComputedStyle(el).color,
        ratio: Number(ratio(parseRgb(getComputedStyle(el).color), effectiveBg(el)).toFixed(2)),
      }))
    })())`),
  )
}

async function saveShot(name) {
  if (!SHOT_DIR) return
  await s.saveShot(join(SHOT_DIR, name))
}

try {
  s = await startBrowser({ root: ROOT, profile: PROFILE, width: 1440, height: 900 })

  // 1. 創世記第1章（新寫法：經文＋來源＋英文/中譯註釋原話＋一般散文同頁出現）
  await go(GEN1)
  await ensureStudyTab()
  await setTheme("light")

  const gen1Check = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const cqs = [...document.querySelectorAll('article .bwz-rl-cquote')].map(e => e.textContent)
      const qs = [...document.querySelectorAll('article .bwz-rl-quote')].map(e => e.textContent)
      const overlap = document.querySelectorAll('article .bwz-rl-quote .bwz-rl-cquote, article .bwz-rl-cquote .bwz-rl-quote, article .bwz-rl-cquote .bwz-rl-src, article .bwz-rl-src .bwz-rl-cquote').length
      const hasShortTerm = cqs.some(t => t === '「是」' || t === '「創造」')
      const hasEnglishPaired = cqs.some(t => t.includes('sovereign over chaos')) && !cqs.some(t => t.includes('聖經的記述獨特地呈現'))
      const hasChained = cqs.some(t => t.includes('在聖經裡面，整個宇宙都是為人類而造'))
      const qColor = getComputedStyle(document.querySelector('article .bwz-rl-quote')).color
      const cColor = getComputedStyle(document.querySelector('article .bwz-rl-cquote')).color
      const pColor = getComputedStyle(document.querySelector('article p')).color
      const guideText = document.querySelector('#bwz-guide')?.innerText ?? ''
      const guideHasLegend = guideText.includes('青色字＝註釋書的原話（後面括號是哪一本）')
      return { count: cqs.length, qsCount: qs.length, overlap, hasShortTerm, hasEnglishPaired, hasChained, distinctColors: qColor !== cColor && cColor !== pColor && qColor !== pColor, qColor, cColor, pColor, guideHasLegend }
    })())`),
  )
  s.check(
    "桌機創1：註釋原話數量合理、英文+中譯合併、又說續句合併、與經文與散文色調清楚區分且導覽圖例列出青色字說明",
    gen1Check.count >= 12 &&
      gen1Check.qsCount >= 5 &&
      gen1Check.overlap === 0 &&
      !gen1Check.hasShortTerm &&
      gen1Check.hasEnglishPaired &&
      gen1Check.hasChained &&
      gen1Check.distinctColors &&
      gen1Check.guideHasLegend,
    JSON.stringify(gen1Check),
  )

  const gen1LightContrast = await measureContrastOf("article .bwz-rl-cquote")
  s.check("淺色創1 註釋原話對比全部 ≥ 4.5", gen1LightContrast.length > 0 && gen1LightContrast.every((x) => x.ratio >= 4.5), JSON.stringify(gen1LightContrast))
  const guideSwatchLightContrast = await measureContrastOf("#bwz-guide .bwz-guide-swatch.is-cquote")
  s.check("淺色導覽面板「註釋原話」圖例樣本對比 ≥ 4.5", guideSwatchLightContrast.length === 1 && guideSwatchLightContrast[0].ratio >= 4.5, JSON.stringify(guideSwatchLightContrast))

  await scrollToText("創世記的記述與")
  await saveShot("gen1-study-1440-light.png")

  await setTheme("dark")
  const gen1DarkContrast = await measureContrastOf("article .bwz-rl-cquote")
  s.check("深色創1 註釋原話對比全部 ≥ 4.5", gen1DarkContrast.length > 0 && gen1DarkContrast.every((x) => x.ratio >= 4.5), JSON.stringify(gen1DarkContrast))
  const guideSwatchDarkContrast = await measureContrastOf("#bwz-guide .bwz-guide-swatch.is-cquote")
  s.check("深色導覽面板「註釋原話」圖例樣本對比 ≥ 4.5", guideSwatchDarkContrast.length === 1 && guideSwatchDarkContrast[0].ratio >= 4.5, JSON.stringify(guideSwatchDarkContrast))
  await saveShot("gen1-study-1440-dark.png")

  // 2. 出埃及記第8章（含嵌套括號＋wikilink 的英文中譯、[!note]/[!background] 內原話）
  await go(EXO8)
  await ensureStudyTab()
  await setTheme("light")
  const exo8Check = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const cqs = [...document.querySelectorAll('article .bwz-rl-cquote')].map(e => e.textContent)
      const nestedLink = [...document.querySelectorAll('article .bwz-rl-cquote')].find(e => e.textContent.includes('Four times he proposes'))?.querySelector('a')
      const tailCiteMarked = cqs.some(t => t.includes('他們不但沒有除滅災禍'))
      return { count: cqs.length, hasNestedLink: !!nestedLink, tailCiteMarked }
    })())`),
  )
  s.check(
    "桌機出8：註釋原話正確標記（含句尾括號《串珠》引用）、英文中譯內的站內連結保留",
    exo8Check.count >= 10 && exo8Check.hasNestedLink && exo8Check.tailCiteMarked,
    JSON.stringify(exo8Check),
  )
  await scrollToText("古代埃及人視青蛙為神聖動物")
  await saveShot("exo8-study-1440-light.png")
  await setTheme("dark")
  await saveShot("exo8-study-1440-dark.png")

  // 2b. 創世記第2章（2026-11-26 補充新寫法：原話在前、來源在句尾括號）
  await go(GEN2)
  await ensureStudyTab()
  await setTheme("light")
  const gen2Check = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const cqs = [...document.querySelectorAll('article .bwz-rl-cquote')].map(e => e.textContent)
      const hasDust = cqs.some(t => t === '「也要歸於塵土」')
      const hasHomophone = cqs.some(t => t.includes('同音詞'))
      const hasSideEn = cqs.some(t => t.includes('He forms her from his side'))
      const trailingTransColored = cqs.some(t => t.includes('神取自他的肋旁'))
      const hasParallel = cqs.some(t => t.includes('男女的人格平等')) && cqs.some(t => t.includes('女人當為男人所親愛'))
      const hasSeparatedProseQuote = cqs.some(t => t === '「表明神心的親切、體貼」') && cqs.some(t => t === '「乃在於人有靈」') && cqs.some(t => t === '「表明神給予人有自由自主的權利」') && cqs.some(t => t === '「理應逾越父母與子女之間的關係」')
      return { count: cqs.length, hasDust, hasHomophone, hasSideEn, trailingTransColored, hasParallel, hasSeparatedProseQuote }
    })())`),
  )
  s.check(
    "桌機創2（句尾括號來源寫法）：三種範例均標記、英文括號內「名稱：中譯」附屬不另上色、並列與散文隔開同句原話皆標記",
    gen2Check.count >= 25 &&
      gen2Check.hasDust &&
      gen2Check.hasHomophone &&
      gen2Check.hasSideEn &&
      !gen2Check.trailingTransColored &&
      gen2Check.hasParallel &&
      gen2Check.hasSeparatedProseQuote,
    JSON.stringify(gen2Check),
  )
  await scrollToText("死時「也要歸於塵土」")
  await saveShot("gen2-study-1440-light.png")
  await setTheme("dark")
  await saveShot("gen2-study-1440-dark.png")

  // 3. 創世記第48章（舊寫法）
  await go(GEN48)
  await ensureStudyTab()
  await setTheme("light")
  const gen48Check = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const cqs = [...document.querySelectorAll('article .bwz-rl-cquote')].map(e => e.textContent)
      const falseEye = cqs.some(t => t.includes('在我眼前'))
      return { count: cqs.length, sample: cqs.slice(0, 3), falseEye }
    })())`),
  )
  s.check("桌機創48（舊寫法）：只標真實直接引句、不誤標散文與『』重點詞", gen48Check.count >= 1 && !gen48Check.falseEye, JSON.stringify(gen48Check))
  await scrollFirst("article .bwz-rl-cquote")
  await saveShot("gen48-study-1440-light.png")
  await setTheme("dark")
  await saveShot("gen48-study-1440-dark.png")

  // 4. 條目頁 ## 定義 / ## 主題發展 適用，## 按書卷累積 / ## 來源依據 不碰
  await go(ENTRY_HOUSEHOLD)
  await setTheme("light")
  const entryCheck = JSON.parse(
    await s.ev(`JSON.stringify((() => {
      const cqs = [...document.querySelectorAll('article .bwz-rl-cquote')].map(e => e.textContent)
      const hasShortTerm = cqs.some(t => t === '「按父家」')
      const hasSrc = document.querySelectorAll('article .bwz-rl-src').length
      const insideAccum = [...document.querySelectorAll('article .bwz-rl-cquote')].some(e => {
        let cur = e.closest('p, li')
        while (cur && cur.previousElementSibling) {
          cur = cur.previousElementSibling
          if (cur.tagName === 'H2') return /按書卷累積|來源依據/.test(cur.textContent)
        }
        return false
      })
      return { count: cqs.length, hasShortTerm, hasSrc, insideAccum, sample: cqs.slice(0, 3) }
    })())`),
  )
  s.check("條目頁（一家一隻）：## 主題發展標記註釋原話、略過「按父家」短詞、不加來源說明卡、不碰其他段落",
    entryCheck.count >= 3 && !entryCheck.hasShortTerm && entryCheck.hasSrc === 0 && !entryCheck.insideAccum,
    JSON.stringify(entryCheck))
  await scrollFirst("article .bwz-rl-cquote")
  await saveShot("entry-household-1440-light.png")

  // 5. 手機 390×844（淺深色：創1、出8、創48）
  await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
  await go(GEN1)
  await ensureStudyTab()
  await setTheme("light")
  await scrollToText("創世記的記述與")
  const mobNoOverflow1 = await s.ev(`document.documentElement.scrollWidth <= window.innerWidth`)
  s.check("手機 390 創1 不水平溢出", mobNoOverflow1)
  await saveShot("gen1-study-390-light.png")
  await setTheme("dark")
  await saveShot("gen1-study-390-dark.png")

  await go(EXO8)
  await ensureStudyTab()
  await setTheme("light")
  await scrollToText("古代埃及人視青蛙為神聖動物")
  const mobNoOverflow2 = await s.ev(`document.documentElement.scrollWidth <= window.innerWidth`)
  s.check("手機 390 出8 不水平溢出", mobNoOverflow2)
  await saveShot("exo8-study-390-light.png")
  await setTheme("dark")
  await saveShot("exo8-study-390-dark.png")

  await go(GEN48)
  await ensureStudyTab()
  await setTheme("light")
  await scrollFirst("article .bwz-rl-cquote")
  await saveShot("gen48-study-390-light.png")
  await setTheme("dark")
  await saveShot("gen48-study-390-dark.png")

  await go(GEN2)
  await ensureStudyTab()
  await setTheme("light")
  await scrollToText("死時「也要歸於塵土」")
  await saveShot("gen2-study-390-light.png")
  await setTheme("dark")
  await saveShot("gen2-study-390-dark.png")

  s.check("無任何未捕捉的 JavaScript 例外", s.errors.length === 0, s.errors.slice(0, 3).join(" | "))
} finally {
  await s?.finish()
}
