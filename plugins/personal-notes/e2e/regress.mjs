// P1-16 既有功能回歸檢查：wiki-tour、搜尋、SPA 換頁、深色模式、我的筆記入口、PWA 檔案、筆記面板。
// 用法：node e2e/regress.mjs <baseUrl> <profileDir> [shotDir]
//   環境變數 INCOG=1：無痕模式（匯出改驗下載連結，見 fixcheck.mjs 的說明）。
import { setVal, startBrowser, sleep } from "./lib.mjs"

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
async function waitSearch(expression) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await ev(expression)) return true
    await sleep(100)
  }
  return false
}
await ev(`document.querySelector('.search-bar').dispatchEvent(new CompositionEvent('compositionstart'))`)
await ev(setVal(".search-bar", "天地"))
await sleep(180)
check("經文搜尋：中文輸入法組字時不更新結果", await ev(`!document.querySelector('.result-card[data-verse]')`))
await ev(`document.querySelector('.search-bar').dispatchEvent(new CompositionEvent('compositionend'))`)
check("經文搜尋：逐節顯示原句與節號連結", await waitSearch(`!!document.querySelector('.result-card[href$="#v1"]')?.textContent.includes('天地')`))
await ev(`document.querySelector('.search-bar').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`)
check("經文搜尋：方向鍵能移焦至經文連結", await ev(`document.activeElement?.matches('a.result-card[data-verse]')`))
await ev(`document.querySelector('.search-verse-add')?.click()`)
await ev(setVal(".search-bar", "思想"))
check("經文搜尋：換詞找到創世記 6:5", await waitSearch(`!!document.querySelector('.result-card[href$="#v5"]')?.textContent.includes('思想')`))
await ev(`document.querySelector('.search-verse-add')?.click()`)
await ev(`document.querySelector('.search-verse-list').open = true`)
check("經文搜尋：暫存清單保留兩輪選中的經文", await ev(`document.querySelectorAll('.search-verse-list .search-verse-remove').length === 2`))
await ev(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.testCopiedVerses = text } } }); document.querySelector('.search-verse-copy').click()`)
check("經文搜尋：一次複製清單的經文與出處", await waitSearch(`window.testCopiedVerses?.includes('創世記 1:1') && window.testCopiedVerses?.includes('創世記 6:5')`))
await ev(`document.querySelector('.search-verse-list').open = false`)

await ev(setVal(".search-bar", "神"))
check("經文搜尋：支援單字", await waitSearch(`document.querySelectorAll('.result-card[data-verse]').length > 3`))
await ev(setVal(".search-refine-input", "耶和華"))
await ev(`document.querySelector('.search-refine-add').click()`)
check("經文搜尋：加詞後每筆都在同一節含兩詞", await waitSearch(`(() => {
  const hits = [...document.querySelectorAll('.result-card[data-verse]')];
  return hits.length > 0 && hits.every(hit => hit.textContent.includes('神') && hit.textContent.includes('耶和華'));
})()`))
await ev(`document.querySelector('.search-refinement')?.click()`)
check("經文搜尋：刪除條件找回單字結果", await waitSearch(`[...document.querySelectorAll('.result-card[data-verse]')].some(hit => !hit.textContent.includes('耶和華'))`))
await ev(setVal(".search-bar", "塞特敬虔後裔說"))
check("經文搜尋：章內註解專用詞回傳零節", await waitSearch(`document.querySelectorAll('.result-card[data-verse]').length === 0 && document.querySelector('.search-result-count')?.textContent.includes('0')`))
await ev(setVal(".search-bar", "妳"))
check("經文搜尋：顯示可明確採用的用字建議", await waitSearch(`[...document.querySelectorAll('.search-suggestion')].some(button => button.textContent.includes('你'))`))

await ev(`document.querySelector(".search-mode[data-mode='knowledge']").click()`)
await ev(setVal(".search-bar", "亞伯拉罕"))
check("知識庫進階：找到人物條目，可使用分類篩選", await waitSearch(`!!document.querySelector('.result-card[data-category="人物"]') && !document.querySelector('.search-knowledge-category[data-category="章節"]')`))
await ev(`document.querySelector('.search-knowledge-clear').click()`)
check("知識庫進階：清除勾選後清空結果", await waitSearch(`!document.querySelector('.result-card[data-category="人物"]')`))
await ev(`document.querySelector('.search-knowledge-category[data-category="人物"]')?.click()`)
check("知識庫進階：只勾人物後找回該分類", await waitSearch(`[...document.querySelectorAll('.result-card[data-category]')].length > 0 && [...document.querySelectorAll('.result-card[data-category]')].every(hit => hit.dataset.category === '人物')`))
check("搜尋：經文與進階字詞查詢都只用本站索引", !urls.some((url) => url.includes("/api/search?")))
await shot("04-search")
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await sleep(500)

await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await ev(`document.querySelector('.search-button').click()`)
await ev(setVal(".search-bar", "天地"))
check("搜尋：手機開啟經文模式並可操作結果", await waitSearch(`(() => {
  const dialog = document.querySelector('.search-container.active');
  const first = dialog?.querySelector('.result-card[data-verse]');
  return first?.getClientRects().length > 0 && dialog.scrollWidth <= innerWidth + 1;
})()`))
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await s.setViewport(1280, 900)
await ev(`document.querySelector('.search-button').click()`)
await waitSearch(`!!document.querySelector('.result-card[href$="#v1"]')`)
await ev(`document.querySelector('.result-card[href$="#v1"]')?.click()`)
check("經文搜尋：點同章結果定位於該節", await waitSearch(`location.hash === '#v1' && !!document.querySelector('article li#v1') && !document.querySelector('.search-container.active')`))

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
