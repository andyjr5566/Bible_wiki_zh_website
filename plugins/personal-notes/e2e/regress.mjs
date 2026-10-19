// P1-16 既有功能回歸檢查：wiki-tour、搜尋、SPA 換頁、深色模式、我的筆記入口、PWA 檔案、筆記面板。
// 用法：node e2e/regress.mjs <baseUrl> <profileDir> [shotDir]
//   環境變數 INCOG=1：無痕模式（匯出改驗下載連結，見 fixcheck.mjs 的說明）。
import { startBrowser, sleep } from "./lib.mjs"

const [base, profile, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root: base, profile, incognito: !!process.env.INCOG, shotDir, detailMax: Infinity })
const { ev, check, send, errors, shot, finish } = s
const go = (path, wait = 5000) => s.go(path, wait)

const urls = []
s.on("Network.requestWillBeSent", (m) => urls.push(m.params.request.url))
await send("Network.enable")

// 1. 首頁 + wiki-tour
await go("/?skip=1")
check("首頁：wiki-tour 啟動卡片存在", await ev(`!!document.querySelector('.wiki-tour-launcher [data-tour-open]')`))
await ev(`document.querySelector('.wiki-tour-launcher [data-tour-open]').click()`)
await sleep(2500)
const tour = await ev(`JSON.stringify({ touring: document.documentElement.classList.contains('bwz-touring'), bubble: (document.querySelector('.bwz-bubble')?.innerText || '').slice(0, 40) })`)
const t = JSON.parse(tour)
check("wiki-tour：按「開始互動導覽」後出現導覽泡泡", t.touring && t.bubble.length > 0, t.bubble.replace(/\s+/g, " "))
await shot("01-tour")
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await sleep(800)

// 2. 章節頁：筆記面板、深色模式、閱讀模式
await go("/01-創世記/第1章?skip=1")
check("章節頁：筆記面板已畫出", await ev(`!!document.querySelector('.bwz-notes .bwz-n-head h2')`))
await ev(`document.querySelector('.bwz-notes').scrollIntoView()`)
await sleep(500)
await shot("02a-notes-default-theme")
await ev(`window.scrollTo(0, 0)`)
const theme0 = await ev(`document.documentElement.getAttribute('saved-theme')`)
await ev(`document.querySelector('.darkmode').click()`)
await sleep(500)
const theme1 = await ev(`document.documentElement.getAttribute('saved-theme')`)
check("深色模式：切換按鈕會改變主題", theme0 !== theme1, `${theme0} → ${theme1}`)
await ev(`document.querySelector('.bwz-notes').scrollIntoView()`)
await sleep(500)
await shot("02-notes-dark")
await ev(`window.scrollTo(0, 0)`)
// 閱讀模式按鈕已由「我的筆記」入口取代（2026-10-18 使用者決定）
const entry = await ev(`(() => { const a = document.querySelector('.left.sidebar a.bwz-notes-entry'); return !document.querySelector('.readermode') && !!a && a.getBoundingClientRect().width > 0 })()`)
check("工具列：閱讀模式已移除、「我的筆記」入口看得到", entry)
await shot("03-toolbar")

// 3. 搜尋
await ev(`document.querySelector('.search-button').click()`)
await sleep(500)
check("搜尋：按鈕打開搜尋框", await ev(`!!document.querySelector('.search-container.active')`))
await ev(`(() => { const i = document.querySelector('.search-bar'); i.value = '亞伯拉罕'; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
await sleep(4000)
const hits = await ev(`document.querySelectorAll('.result-card:not(.no-match)').length`)
check("搜尋：輸入關鍵字有結果", hits > 0, `${hits} 筆`)
await shot("04-search")
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await sleep(500)

// 4. SPA 換頁（深色模式應保持，筆記面板跟著換章）
const before = await ev(`location.pathname`)
await ev(`window.spaNavigate(new URL('../01-創世記/第2章', location.href))`)
await sleep(4000)
const after = JSON.parse(await ev(`JSON.stringify({ path: decodeURIComponent(location.pathname), title: document.querySelector('h1.article-title')?.innerText ?? document.title, theme: document.documentElement.getAttribute('saved-theme'), chapter: document.querySelector('[data-bwz-notes]')?.dataset.chapter, panel: !!document.querySelector('.bwz-notes .bwz-n-head h2') })`))
check("SPA 換頁：網址與標題換到第 2 章", after.path.endsWith("第2章") && before !== after.path, `${after.path}｜${after.title}`)
check("SPA 換頁：深色模式保持", after.theme === theme1, after.theme)
check("SPA 換頁：筆記面板換成第 2 章並畫出", after.chapter === "2" && after.panel)
await ev(`history.back()`)
await sleep(3000)
check("SPA 上一頁：回到第 1 章且面板正常", await ev(`decodeURIComponent(location.pathname).endsWith('第1章') && document.querySelector('[data-bwz-notes]')?.dataset.chapter === '1' && !!document.querySelector('.bwz-notes .bwz-n-head h2')`))

// 5. PWA 檔案
const pwa = JSON.parse(await ev(`(async () => {
  const link = document.querySelector('link[rel=manifest]')
  const m = link ? await fetch(link.href) : null
  const sw = await fetch((document.body.dataset.basepath || '') + '/static/sw.js')
  const mj = m && m.ok ? await m.json() : null
  return JSON.stringify({ manifest: !!mj, name: mj?.name, sw: sw.ok })
})()`))
check("PWA：manifest 與 sw.js 可取得", pwa.manifest && pwa.sw, pwa.name ?? "")

// 6. 我的筆記頁
await go("/my-notes")
check("我的筆記頁：畫出內容", await ev(`!!document.querySelector('[data-bwz-notes=mynotes] .bwz-n-status')`))

const google = urls.filter((u) => /accounts\.google\.com|googleapis\.com\/drive/.test(u))
check("全程未登入：沒有連到 Google 帳號／雲端硬碟", google.length === 0, google.join(", "))
check("全程沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 3).join(" | "))
finish()
