// B5-2 冒煙測試（CI 用，也可在本機跑）：只確認「網站還活著」的最基本功能，不是完整回歸。
//   (1) 首頁載入  (2) 章節上一章／下一章  (3) 搜尋有結果  (4) 個人筆記可以開（本機模式、不登入）
//   (5) 手機 390x844 四個頁面不左右捲  (6) 全程沒有 JavaScript 例外
//   另有首頁入口（home-hub）：沒有紀錄時導覽卡在上、沒有繼續閱讀卡；讀一章回首頁有卡片、按「繼續」回到位置
// 用法：node e2e/smoke.mjs <siteRoot，結尾不加 /> <profile>
//   例：node e2e/smoke.mjs http://localhost:8090/Bible_wiki_zh_website prof/smoke
// 建議對 test_content 建出的小站跑（章節頁的上一章／下一章表格在 test_content 的第 1、2 章）。
// CI 上 Chrome 要加 --no-sandbox 時，用環境變數 CHROME_FLAGS（見 lib.mjs）。
// CI 機器比較慢，所以等待都用輪詢（waitFor），不靠固定 sleep。
import { startBrowser, ch1, clickText, setVal, sleep } from "./lib.mjs"

const [root, profile] = process.argv.slice(2)
if (!root || !profile) {
  console.error("用法：node e2e/smoke.mjs <siteRoot，結尾不加 /> <profile>")
  process.exit(2)
}

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const ch2 = "/" + encodeURI("01-創世記/第2章")
const abraham = "/" + encodeURI("link_folder/人物/亞伯拉罕")

const s = await startBrowser({ root, profile, detailMax: Infinity })
const { ev, send, check, errors, finish } = s

// 記下全程發出的網路請求，最後確認沒有連到 Google 帳號／雲端硬碟
const urls = []
s.on("Network.requestWillBeSent", (m) => urls.push(m.params.request.url))
await send("Network.enable")

// 輪詢到 expr（在頁面裡計算）為真值，最多等 timeoutMs；回傳最後一次的值（逾時回傳該值，通常是 false）
async function waitFor(expr, timeoutMs = 15000, every = 250) {
  const end = Date.now() + timeoutMs
  let v
  while (Date.now() < end) {
    try { v = await ev(expr) } catch { v = undefined }
    if (v) return v
    await sleep(every)
  }
  return v
}

// 導航到 root + path，輪詢到網址確實換過去、文件載入完成、而且 ready（選填，頁面裡的運算式）成立
async function open(path, ready = "true", timeoutMs = 20000) {
  const target = new URL(root + path)
  await send("Page.navigate", { url: target.href })
  return waitFor(
    `location.pathname === ${JSON.stringify(target.pathname)} && document.readyState === 'complete' && !!document.querySelector('article') && (${ready})`,
    timeoutMs,
  )
}

// 目前頁面所在章（從路徑最後一段取出）
const curPath = () => ev(`decodeURIComponent(location.pathname)`)
const h1Text = `(document.querySelector('h1.article-title')?.innerText ?? '')`
// 頁首表格裡指定文字的連結（上一章／下一章表格是內容 md 開頭的區塊）
const navLink = (label) => `[...document.querySelectorAll('article table a')].find((a) => a.textContent.trim() === ${JSON.stringify(label)})`

// ---------- (1) 首頁載入 ----------
const homeOk = await open("/index.html?skip=1")
const status = await ev(`(performance.getEntriesByType('navigation')[0]?.responseStatus) ?? 0`)
const title = await ev(`document.title`)
check("首頁：載入成功（HTTP 200、有 article）", !!homeOk && status === 200, `status=${status}`)
check("首頁：標題含「聖經研讀知識庫」", String(title).includes("聖經研讀知識庫"), title)
// 首頁入口（home-hub）：沒有閱讀紀錄時導覽卡在最上面、入口在下面、沒有繼續閱讀卡
const hubTopOrder = await ev(`(() => { const t = document.querySelector('.wiki-tour-launcher'), h = document.querySelector('.bwz-hub'); return t && h ? t.getBoundingClientRect().top < h.getBoundingClientRect().top : null })()`)
check("首頁入口：有入口區塊（搜尋鈕＋書卷格子）", !!(await ev(`!!document.querySelector('.bwz-hub .bwz-hub-search') && !!document.querySelector('.bwz-hub .bwz-bookgrid')`)))
check("首頁入口：沒有紀錄時導覽卡在上、沒有繼續閱讀卡", hubTopOrder === true && !(await ev(`!!document.querySelector('.bwz-resume')`)), `導覽卡在上=${hubTopOrder}`)

// ---------- (2) 章節上一章／下一章 ----------
const ch1Ok = await open(ch1 + "?skip=1", `${h1Text}.includes('第1章')`)
check("章節：第 1 章載入", !!ch1Ok, await curPath())
const hasNext = await ev(`!!${navLink("下一章")}`)
check("章節：第 1 章頁首表格有「下一章」連結", hasNext)
await ev(`${navLink("下一章")}?.click()`)
const toCh2 = await waitFor(`decodeURIComponent(location.pathname).endsWith('第2章') && ${h1Text}.includes('第2章')`)
check("章節：點「下一章」→ 網址與內容換成第 2 章", !!toCh2, `${await curPath()}｜${await ev(h1Text)}`)
check("章節：第 2 章頁首表格有「前一章」連結", await waitFor(`!!${navLink("前一章")}`, 5000))
await ev(`${navLink("前一章")}?.click()`)
const backCh1 = await waitFor(`decodeURIComponent(location.pathname).endsWith('第1章') && ${h1Text}.includes('第1章')`)
check("章節：點「前一章」→ 回到第 1 章", !!backCh1, `${await curPath()}｜${await ev(h1Text)}`)

// ---------- (2b) 繼續閱讀：讀第 2 章捲到一半 → 回首頁有卡片 → 按「繼續」回到約同一位置 ----------
await open(ch2 + "?skip=1", `${h1Text}.includes('第2章')`)
const pageRange = `(document.documentElement.scrollHeight - window.innerHeight)`
await ev(`window.scrollTo({ top: ${pageRange} * 0.5, behavior: 'instant' })`)
await sleep(1500)
await ev(`document.querySelector('.page-title a')?.click()`)
const hasCard = await waitFor(`document.body.dataset.slug === 'index' && !!document.querySelector('.bwz-resume')`, 10000)
check("首頁入口：讀過一章後回首頁有「繼續閱讀」卡（入口在導覽卡上面）", !!hasCard && (await ev(`document.querySelector('.bwz-hub').getBoundingClientRect().top < document.querySelector('.wiki-tour-launcher').getBoundingClientRect().top`)), await ev(`document.querySelector('.bwz-resume-title')?.textContent + ' ' + document.querySelector('.bwz-resume-meta')?.textContent`))
await ev(`document.querySelector('.bwz-resume-go')?.click()`)
await waitFor(`document.body.dataset.slug.endsWith('第2章')`, 10000)
await sleep(2200)
const resumedRatio = await ev(`${pageRange} > 0 ? window.scrollY / ${pageRange} : 0`)
check("首頁入口：按「繼續」回到約同一位置（±10%）", Math.abs(resumedRatio - 0.5) <= 0.1, `比例 ${Number(resumedRatio).toFixed(2)}`)

// ---------- (3) 搜尋 ----------
await ev(`document.querySelector('.search-button')?.click()`)
check("搜尋：按鈕打開搜尋框", !!(await waitFor(`!!document.querySelector('.search-container.active')`, 8000)))
await ev(`(() => { const i = document.querySelector('.search-bar'); i.value = '亞伯拉罕'; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
const hits = await waitFor(`document.querySelectorAll('.result-card:not(.no-match)').length`, 15000)
check("搜尋：輸入「亞伯拉罕」有結果", hits > 0, `${hits || 0} 筆`)
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)

// ---------- (4) 個人筆記（本機模式、不登入） ----------
await open(ch1 + "?skip=1", `${h1Text}.includes('第1章')`)
const panel = await waitFor(`!!document.querySelector('.bwz-notes .bwz-n-head h2')`, 20000)
check("筆記：章節頁的筆記面板畫出", !!panel)
const hasAdd = await ev(`[...document.querySelectorAll('.bwz-notes button')].some((b) => b.textContent.includes('新增筆記'))`)
check("筆記：面板有「新增筆記」按鈕", hasAdd)
await ev(clickText(".bwz-notes button", "新增筆記"))
const editing = await waitFor(`!!document.querySelector('.bwz-n-card.editing textarea')`, 8000)
check("筆記：按「新增筆記」後出現編輯中的卡片", !!editing)
if (editing) {
  await ev(setVal(".bwz-n-card.editing textarea", "冒煙測試的筆記"))
  const typed = await waitFor(`document.querySelector('.bwz-n-card.editing textarea')?.value === '冒煙測試的筆記'`, 5000)
  check("筆記：編輯卡片可以輸入文字", !!typed)
}
const google = urls.filter((u) => /accounts\.google\.com|googleapis\.com\/drive/.test(u))
check("筆記：不登入，沒有連到 Google 帳號／雲端硬碟", google.length === 0, google.join(", "))

// ---------- (5) 手機 390x844：整頁不左右捲 ----------
await send("Emulation.setUserAgentOverride", { userAgent: IPHONE_UA })
await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
// 不能拿 window.innerWidth 當標準：手機模擬下頁面一旦比螢幕寬，瀏覽器會把版面視窗（innerWidth）一起撐寬，
// 於是 scrollWidth <= innerWidth 永遠成立（實測注入 800px 寬的元素，兩者都變 816）。所以固定拿螢幕寬度 390 當標準。
const PHONE_W = 390
// 失敗時要看得出是誰撐寬：列出右緣超過 390 最多的前 3 個元素
const overflowInfo = `(() => {
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 3).map((c) => '.' + c).join('')
  const wide = [...document.querySelectorAll('body *')].map((el) => ({ el, r: Math.round(el.getBoundingClientRect().right) })).filter((x) => x.r > ${PHONE_W}).sort((a, b) => b.r - a.r).slice(0, 3)
  return JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, wide: wide.map((x) => sel(x.el) + ' right=' + x.r) })
})()`
const mobilePages = [
  ["首頁", "/index.html?skip=1", "true"],
  ["第 1 章", ch1 + "?skip=1", `${h1Text}.includes('第1章')`],
  ["人物「亞伯拉罕」", abraham + "?skip=1", "true"],
  ["我的筆記", "/my-notes", `!!document.querySelector('[data-bwz-notes=mynotes] .bwz-n-status')`],
]
for (const [name, path, ready] of mobilePages) {
  const loaded = await open(path, ready)
  await sleep(800) // 版面穩定（圖片、字型、面板）後再量
  const ok = await ev(`document.documentElement.scrollWidth <= ${PHONE_W}`)
  const info = JSON.parse(await ev(overflowInfo))
  check(`手機 390 寬：${name}不左右捲`, !!loaded && ok === true, ok ? `scrollWidth=${info.scrollWidth}` : `${loaded ? "" : "（頁面沒載入完成）"}scrollWidth=${info.scrollWidth} innerWidth=${info.innerWidth} 最寬：${info.wide.join("；")}`)
}

// ---------- 全程 ----------
check("全程沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 3).join(" | "))
finish()
