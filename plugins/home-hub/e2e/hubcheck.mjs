// 首頁入口與繼續閱讀的端對端檢查（無頭 Chrome / CDP），對 test_content 建出的小站跑。
//   (1) 沒有紀錄：導覽卡在上、入口在下、沒有繼續閱讀卡；第一次繪製的每一格畫面順序都一樣（不跳動）
//   (2) 章節頁捲動後有記錄（證明 home-hub 的腳本在非首頁也有載入）
//   (3) 有紀錄：入口在上、卡片顯示「中段」、按「繼續」回到約同一位置（SPA 換頁與整頁載入兩種）
//   (4) 一般點進章節不捲動；搜尋鈕打開網站原本的搜尋；localStorage 被封鎖時首頁照常、沒有 JS 例外
//   (5) 截圖：首頁 × 有／無紀錄 × 淺深 × 1440／390／375，並檢查沒有橫向捲動
// 用法：node e2e/hubcheck.mjs <siteRoot，結尾不加 /> <profile> <shotDir>
//   例：node plugins/home-hub/e2e/hubcheck.mjs http://localhost:8190/Bible_wiki_zh_website C:/Obsidian/bwz-gb/prof-hub C:/.../hub-shots
import { mkdirSync } from "node:fs"
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"

const [root, profile, shotDir] = process.argv.slice(2)
if (!root || !profile || !shotDir) {
  console.error("用法：node e2e/hubcheck.mjs <siteRoot> <profile> <shotDir>")
  process.exit(2)
}
mkdirSync(shotDir, { recursive: true })

const CH2 = "/" + encodeURI("01-創世記/第2章")
const DAY = 86_400_000
const seedRecord = (ratio = 0.5, ageMs = DAY) =>
  JSON.stringify({ v: 1, books: { "01-創世記": { slug: "01-創世記/第2章", ratio, t: Date.now() - ageMs } } })

const s = await startBrowser({ root, profile, width: 1440, height: 900, shotDir, detailMax: Infinity })
const { ev, send, check, errors, finish } = s

async function waitFor(expr, timeoutMs = 15000, every = 200) {
  const end = Date.now() + timeoutMs
  let v
  while (Date.now() < end) {
    try { v = await ev(expr) } catch { v = undefined }
    if (v) return v
    await sleep(every)
  }
  return v
}
async function open(path, ready = "true", timeoutMs = 20000) {
  const target = new URL(root + path)
  await send("Page.navigate", { url: target.href })
  return waitFor(`location.pathname === ${JSON.stringify(target.pathname)} && document.readyState === 'complete' && !!document.querySelector('article') && (${ready})`, timeoutMs)
}
const HOME = "/index.html?skip=1"
const slug = () => ev(`document.body.dataset.slug`)
const range = `(document.documentElement.scrollHeight - window.innerHeight)`
const ratioNow = () => ev(`${range} > 0 ? window.scrollY / ${range} : 0`)
const readStored = () => ev(`localStorage.getItem('bwz-reading')`)
// 章節頁載入後高度會再變動（圖片、折疊段落），先等高度連續 1.5 秒不變再捲，記錄的比例才是對的
async function settle() {
  let last = -1, since = Date.now()
  while (Date.now() - since < 1500 && Date.now() - since < 20000) {
    const h = await ev(`document.documentElement.scrollHeight`)
    if (h !== last) { last = h; since = Date.now() }
    await sleep(150)
  }
}

// 每個畫面幀記下「導覽卡與入口誰在上面」與書卷區塊的位置，載入後取回
const SAMPLER = `(() => {
  window.__order = []; window.__booksTop = []
  const sample = () => {
    const t = document.querySelector('.wiki-tour-launcher'), h = document.querySelector('.bwz-hub'), b = document.querySelector('.bwz-hub-books')
    if (t && h) window.__order.push(t.getBoundingClientRect().top < h.getBoundingClientRect().top ? 'T' : 'H')
    if (b) window.__booksTop.push(Math.round(b.getBoundingClientRect().top + window.scrollY))
    if (performance.now() < 2500) requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)
})()`
let samplerId = null
async function enableSampler() {
  const r = await send("Page.addScriptToEvaluateOnNewDocument", { source: SAMPLER })
  samplerId = r?.identifier
}
async function disableSampler() {
  if (samplerId) await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: samplerId })
  samplerId = null
}

// ---------- (1) 沒有紀錄 ----------
await send("Network.enable")
await send("Network.clearBrowserCache")
await enableSampler()
check("首頁載入", !!(await open(HOME, `!!document.querySelector('.bwz-hub')`)))
await sleep(2800)
const order1 = await ev(`window.__order.join('')`)
const tops1 = await ev(`window.__booksTop`)
const attr1 = await ev(`document.documentElement.getAttribute('data-bwz-reading')`)
check("無紀錄：<html data-bwz-reading=none>", attr1 === "none", attr1)
check("無紀錄：導覽卡在入口上面", await ev(`document.querySelector('.wiki-tour-launcher').getBoundingClientRect().top < document.querySelector('.bwz-hub').getBoundingClientRect().top`))
check("無紀錄：每一幀（含第一次繪製）都是導覽卡在上", order1.length > 5 && /^T+$/.test(order1), `${order1.length} 幀`)
const shift1 = tops1.length ? Math.max(...tops1) - Math.min(...tops1) : -1
check("無紀錄：書卷區塊載入過程位移 ≤ 2px", shift1 >= 0 && shift1 <= 2, `位移 ${shift1}px，${tops1.length} 幀`)
check("無紀錄：沒有可見的繼續閱讀卡", await ev(`!document.querySelector('.bwz-resume') || document.querySelector('.bwz-hub-resume').offsetHeight === 0`))
await s.shot("home-none-1440-light")

// 搜尋鈕：打開網站原本的搜尋
await ev(`document.querySelector('.bwz-hub-search').click()`)
check("搜尋鈕：打開原本的搜尋視窗", !!(await waitFor(`!!document.querySelector('.search-container.active')`, 8000)))
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await sleep(300)
check("搜尋鈕沒有用 .search-button class", await ev(`!document.querySelector('.bwz-hub-search').classList.contains('search-button')`))

// 書卷格子（共用元件）在入口區塊裡
const gridInfo = await ev(`JSON.stringify({ n: document.querySelectorAll('.bwz-hub .bwz-bookgrid').length, links: [...document.querySelectorAll('.bwz-hub .bwz-bookgrid a')].map(a => a.textContent.trim()), ids: [...document.querySelectorAll('.bwz-hub .bwz-bookgrid [id]')].every(e => e.id.startsWith('bwz-hub')) })`)
const grid = JSON.parse(gridInfo)
check("入口區塊有一份書卷格子，連結含創世記", grid.n === 1 && grid.links.includes("創世記"), gridInfo.slice(0, 200))
check("格子元素 id 都用 bwz-hub 開頭", grid.ids)
// 灰色書卷與分頁（行為由 book-picker 的腳本處理，這裡只確認整合沒壞）
await ev(`document.querySelector('.bwz-hub .bwz-bg-tab[data-testament=nt]')?.click()`)
check("分頁：切到新約後新約面板顯示", !!(await waitFor(`!document.querySelector('.bwz-hub [role=tabpanel][id$=panel-nt]').hidden`, 3000)))
await ev(`document.querySelector('.bwz-hub .bwz-bg-tab[data-testament=ot]')?.click()`)

// ---------- (2) 章節頁有記錄 ----------
check("章節頁載入", !!(await open(CH2 + "?skip=1", `document.querySelector('h1.article-title')?.innerText.includes('第2章')`)))
const tall = await ev(`${range}`)
check("章節頁夠高可以捲動", tall > 300, `可捲 ${tall}px`)
await settle()
await ev(`window.scrollTo({ top: ${range} * 0.5, behavior: 'instant' })`)
await sleep(1500)
const stored = JSON.parse((await readStored()) ?? "null")
const rec = stored?.books?.["01-創世記"]
check("章節頁：捲動後 localStorage 有記錄（證明 home-hub 腳本在非首頁也載入）", !!rec && rec.slug === "01-創世記/第2章", JSON.stringify(rec))
check("記錄的比例約 0.5", !!rec && Math.abs(rec.ratio - 0.5) < 0.05, rec?.ratio)

// ---------- (3) SPA：回首頁看到卡片，按繼續回到同一位置 ----------
await ev(`document.querySelector('.page-title a').click()`)
check("SPA 換頁回首頁", !!(await waitFor(`document.body.dataset.slug === 'index' && !!document.querySelector('.bwz-resume')`, 10000)))
check("有紀錄：<html data-bwz-reading=has>（SPA 換頁後立即更新）", (await ev(`document.documentElement.getAttribute('data-bwz-reading')`)) === "has")
check("有紀錄：入口在導覽卡上面", await ev(`document.querySelector('.bwz-hub').getBoundingClientRect().top < document.querySelector('.wiki-tour-launcher').getBoundingClientRect().top`))
const card = await ev(`JSON.stringify({ kicker: document.querySelector('.bwz-resume-kicker')?.textContent, title: document.querySelector('.bwz-resume-title')?.textContent, meta: document.querySelector('.bwz-resume-meta')?.textContent, go: document.querySelector('.bwz-resume-go')?.textContent, aria: document.querySelector('.bwz-resume-go')?.getAttribute('aria-label') })`)
const c = JSON.parse(card)
check("卡片文案：小標／標題／按鈕／朗讀名稱", c.kicker === "繼續閱讀" && c.title === "創世記 第 2 章" && c.go === "繼續 ›" && c.aria === "繼續閱讀創世記第 2 章", card)
check("卡片說明含「中段」與「今天」", /中段/.test(c.meta) && /今天|剛剛/.test(c.meta), c.meta)
await ev(`window.scrollTo(0, 0)`)
await ev(`document.querySelector('.bwz-resume-go').click()`)
check("按繼續（SPA）→ 換到第 2 章", !!(await waitFor(`document.body.dataset.slug === '01-創世記/第2章'`, 10000)))
await sleep(2200)
const r1 = await ratioNow()
check("SPA：回到約同一位置（誤差 ±10%）", Math.abs(r1 - 0.5) <= 0.1, `比例 ${r1?.toFixed(3)}`)

// 整頁載入版：把「繼續」連結標成不走 SPA
await open(HOME, `!!document.querySelector('.bwz-resume')`)
await ev(`document.querySelector('.bwz-resume-go').setAttribute('data-router-ignore', 'true'); document.querySelector('.bwz-resume-go').click()`)
check("按繼續（整頁載入）→ 到第 2 章", !!(await waitFor(`location.pathname.endsWith(${JSON.stringify(encodeURI("第2章"))}) && document.readyState === 'complete' && !!document.querySelector('article')`, 15000)))
await sleep(2200)
const r2 = await ratioNow()
check("整頁載入：回到約同一位置（誤差 ±10%）", Math.abs(r2 - 0.5) <= 0.1, `比例 ${r2?.toFixed(3)}`)
const pendingLeft = await ev(`sessionStorage.getItem('bwz-resume-pending')`)
check("一次性旗標用完即清除", pendingLeft === null, pendingLeft)

// 一般點進章節不捲動
await open(HOME, `!!document.querySelector('.bwz-resume')`)
await ev(`[...document.querySelectorAll('.bwz-hub .bwz-bookgrid a')].find(a => a.textContent.trim() === '創世記').click()`)
await waitFor(`document.body.dataset.slug.startsWith('01-創世記')`, 10000)
await sleep(1200)
check("一般點書卷連結不會被捲動", (await ev(`window.scrollY`)) < 5, await ev(`window.scrollY`))

// ---------- (4) localStorage 被封鎖 ----------
await disableSampler()
// 找出 home-hub 的腳本檔名（postscript 會依序載入 static/scripts/script-N-hash.js），錯誤堆疊裡的檔名才分辨得出是誰丟的
const scriptFiles = await ev(`(async () => {
  const post = [...document.scripts].map((x) => x.src).find((u) => /postscript-/.test(u))
  const list = [...new Set((await (await fetch(post)).text()).match(new RegExp('static/scripts/script-[0-9]+-[a-z0-9]+[.]js', 'g')) ?? [])]
  const hits = []
  for (const f of list) if ((await (await fetch(new URL(f, post).href)).text()).includes('data-hub-search')) hits.push(f.split('/').pop())
  return hits
})()`)
const hubScriptFiles = scriptFiles ?? []
const BLOCK = `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } }); Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked') } })`
const blockId = (await send("Page.addScriptToEvaluateOnNewDocument", { source: BLOCK }))?.identifier
const errBefore = errors.length
check("儲存被封鎖：首頁照常載入", !!(await open(HOME, `!!document.querySelector('.bwz-hub')`)))
await sleep(1500)
check("儲存被封鎖：不顯示繼續閱讀卡、導覽卡在上", await ev(`!document.querySelector('.bwz-resume') && document.querySelector('.wiki-tour-launcher').getBoundingClientRect().top < document.querySelector('.bwz-hub').getBoundingClientRect().top`))
await open(CH2 + "?skip=1", `document.querySelector('h1.article-title')?.innerText.includes('第2章')`)
await ev(`window.scrollTo({ top: ${range} * 0.4, behavior: 'instant' })`)
await sleep(1500)
await ev(`document.querySelector('.page-title a').click()`)
await waitFor(`document.body.dataset.slug === 'index'`, 8000)
await sleep(800)
await ev(`document.querySelector('.bwz-hub-search').click()`)
check("儲存被封鎖：搜尋鈕仍可用", !!(await waitFor(`!!document.querySelector('.search-container.active')`, 8000)))
// 網站其他腳本（深色模式、外觀等，不是這個外掛）在儲存被封鎖時本來就會丟例外；這裡只檢查「來自 home-hub 腳本」的例外
const hubErrors = errors.slice(errBefore).filter((e) => hubScriptFiles.some((f) => e.includes(f)))
check("儲存被封鎖：home-hub 的腳本沒有丟 JavaScript 例外", hubScriptFiles.length > 0 && hubErrors.length === 0, `hub 腳本檔 ${hubScriptFiles.join(",")}；其他腳本的例外 ${errors.length - errBefore - hubErrors.length} 個（網站原本就有）；${hubErrors.join(" | ")}`)
check("儲存被封鎖：<head> 早期腳本照常設定屬性", (await ev(`document.documentElement.getAttribute('data-bwz-reading')`)) === "none")
await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: blockId })

// ---------- (5) 截圖：有紀錄 × 淺深 × 三種寬度，檢查橫向捲動 ----------
const VIEWS = [
  ["1440", 1440, 900, false],
  ["390", 390, 844, true],
  ["375", 375, 812, true],
]
async function seed(theme, withRecord) {
  await open(HOME, "true")
  await ev(`(() => { localStorage.clear(); localStorage.setItem('theme', ${JSON.stringify(theme)}); ${withRecord ? `localStorage.setItem('bwz-reading', ${JSON.stringify(seedRecord())});` : ""} })()`)
}
for (const [name, w, h, mobile] of VIEWS) {
  await s.setViewport(w, h, { dpr: mobile ? 2 : 1, mobile, touch: mobile })
  for (const theme of ["light", "dark"]) {
    for (const withRecord of [false, true]) {
      await seed(theme, withRecord)
      await open(HOME, `!!document.querySelector('.bwz-hub') && (${withRecord} ? !!document.querySelector('.bwz-resume') : true)`)
      await sleep(900)
      const tag = `${withRecord ? "has" : "none"}-${name}-${theme}`
      await s.shot(`home-${tag}`)
      const sw = await ev(`document.documentElement.scrollWidth`)
      check(`${tag}：沒有橫向捲動`, sw <= w, `scrollWidth ${sw}`)
    }
  }
}
// 手機：章節頁（窄視窗、觸控）捲動一樣會記錄，按繼續一樣回得去
await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await open(HOME, 'true')
await ev(`localStorage.clear()`)
await open(CH2 + '?skip=1', `document.querySelector('h1.article-title')?.innerText.includes('第2章')`)
await settle()
await ev(`window.scrollTo({ top: ${range} * 0.5, behavior: 'instant' })`)
await sleep(1500)
const mrec = JSON.parse((await readStored()) ?? 'null')?.books?.['01-創世記']
check('手機 390：章節頁捲動後有記錄（約 0.5）', !!mrec && Math.abs(mrec.ratio - 0.5) < 0.05, JSON.stringify(mrec))
await ev(`document.querySelector('.page-title a')?.click()`)
await waitFor(`document.body.dataset.slug === 'index' && !!document.querySelector('.bwz-resume')`, 10000)
await ev(`document.querySelector('.bwz-resume-go').click()`)
await waitFor(`document.body.dataset.slug.endsWith('第2章')`, 10000)
await sleep(2200)
const mr = await ratioNow()
check('手機 390：按繼續回到約同一位置（±10%）', Math.abs(mr - 0.5) <= 0.1, `比例 ${Number(mr).toFixed(3)}`)

// 導覽第一站（map）框住首頁入口的書卷格子（電腦與手機）
for (const [label, w, h, mobile] of [['電腦', 1440, 900, false], ['手機', 390, 844, true]]) {
  await s.setViewport(w, h, { dpr: mobile ? 2 : 1, mobile, touch: mobile })
  await open(HOME, `!!document.querySelector('.bwz-hub')`)
  await ev(`localStorage.clear()`)
  await open(HOME, `!!document.querySelector('.wiki-tour-launcher [data-tour-open]')`)
  await ev(`document.querySelector('.wiki-tour-launcher [data-tour-open]').click()`)
  await waitFor(`document.querySelector('.bwz-bubble')?.dataset.step === 'map'`, 8000)
  await sleep(900)
  const tour = JSON.parse(await ev(`JSON.stringify({ title: document.querySelector('.bwz-bubble h3')?.textContent, text: document.querySelector('.bwz-bubble')?.innerText, hole: (() => { const r = document.querySelector('.bwz-hole')?.getBoundingClientRect(); return r && { top: r.top, left: r.left, bottom: r.bottom, right: r.right } })(), grid: (() => { const r = document.querySelector('.bwz-hub .bwz-bookgrid')?.getBoundingClientRect(); return r && { top: r.top, left: r.left, bottom: r.bottom, right: r.right } })() })`))
  const slack = 24
  const framed = !!tour.hole && !!tour.grid && tour.hole.left <= tour.grid.left + slack && tour.hole.right >= tour.grid.right - slack && tour.hole.top <= tour.grid.top + slack
  check(`${label}：導覽第一站標題「從書卷開始」、文案為定稿`, tour.title === '從書卷開始' && tour.text.includes('先選書卷，再選章。灰色的書卷研讀頁還在整理中，會陸續開放。'), tour.title)
  check(`${label}：導覽第一站的聚光圈框住入口的書卷格子`, framed, JSON.stringify({ hole: tour.hole, grid: tour.grid }))
}
await s.setViewport(1440, 900)
finish()
