// 探索目錄：收起時標題不被切掉；「全部收合」；手機抽屜裡也能用。
// 用法：node e2e/expcheck.mjs <siteRoot> <profile> <shotFile>
//   shotFile  截圖的檔案路徑（.png）；手機版截圖存成同名的 -mobile.png。
//   環境變數 DELAY_APP=毫秒：模擬線上網路較慢（同 tourcheck.mjs）。
import { startBrowser, ch1, sleep } from "./lib.mjs"

const [root, profile, shotPath] = process.argv.slice(2)
const sess = await startBrowser({ root, profile })
const { ev, send, check, go, saveShot, finish } = sess

// DELAY_APP=毫秒：模擬線上網路較慢，筆記 App 晚一點才載入
const delay = Number(process.env.DELAY_APP || 0)
sess.on("Fetch.requestPaused", (m) => setTimeout(() => send("Fetch.continueRequest", { requestId: m.params.requestId }), delay))

await go(ch1 + "?skip=1", 5000)
const E = `document.querySelector('.left.sidebar .explorer')`
const state = `JSON.stringify((() => { const e = ${E}; const h = e.querySelector('.desktop-explorer h2'); const btn = e.querySelector('.explorer-collapse-all'); return { collapsed: e.classList.contains('collapsed'), eH: Math.round(e.getBoundingClientRect().height), h2Bottom: Math.round(h.getBoundingClientRect().bottom - e.getBoundingClientRect().top), open: e.querySelectorAll('.folder-outer.open').length, btn: !!btn && getComputedStyle(btn).display !== 'none' && btn.getBoundingClientRect().height > 0, btnText: btn?.textContent } })())`
let cur = JSON.parse(await ev(state))
check("一開始（目前章節所在的資料夾展開）就有「全部收合」", cur.open > 0 && cur.btn && cur.btnText === "全部收合", JSON.stringify(cur))
// 再多展開一個資料夾
const other = await ev(`(() => { const f = [...${E}.querySelectorAll('.folder-container')].find(f => !f.nextElementSibling.classList.contains('open') && f.getBoundingClientRect().height > 0); f.querySelector('.folder-icon').dispatchEvent(new MouseEvent('click', { bubbles: true })); return f.dataset.folderpath })()`)
await sleep(500)
const before = JSON.parse(await ev(state)).open
await ev(`${E}.querySelector('.explorer-collapse-all').click()`)
await sleep(600)
cur = JSON.parse(await ev(state))
check("按「全部收合」：所有資料夾收起、按鈕消失", before >= 2 && cur.open === 0 && !cur.btn, `收合前 ${before} 個 → ${JSON.stringify(cur)}`)
await send("Page.reload")
await sleep(5000)
cur = JSON.parse(await ev(state))
const otherOpen = await ev(`document.querySelector('.folder-container[data-folderpath="${other}"]').nextElementSibling.classList.contains('open')`)
check("重新整理後剛才收起的資料夾仍收著（存進 fileTree；目前章節所在的資料夾照外掛原本的設計會再打開）", !otherOpen, `${other} open=${otherOpen} ${JSON.stringify(cur)}`)
await ev(`document.querySelector('.folder-container[data-folderpath="${other}"] .folder-icon').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
await sleep(500)
check("再展開一個資料夾，按鈕又出現", JSON.parse(await ev(state)).btn)
// SPA 換頁後只有一個按鈕
await ev(`[...document.querySelectorAll('article a.internal')].find(a => a.getAttribute('href')?.includes('2'))?.click() || window.location.reload()`)
await sleep(3500)
check("換頁後按鈕只有一個", (await ev(`${E}.querySelectorAll('.explorer-collapse-all').length`)) === 1)
// 探索收起：標題完整
await ev(`${E}.querySelector('.desktop-explorer').click()`)
await sleep(800)
cur = JSON.parse(await ev(state))
check("探索收起時「探索」兩個字完整顯示（不被切到）", cur.collapsed && cur.eH >= cur.h2Bottom, JSON.stringify(cur))
await saveShot(shotPath)
check("收起時看不到目錄內容", await ev(`${E}.querySelector('.explorer-content').getBoundingClientRect().height === 0`))
await ev(`${E}.querySelector('.desktop-explorer').click()`)
await sleep(800)
cur = JSON.parse(await ev(state))
check("再展開，目錄正常顯示", !cur.collapsed && cur.eH > 100, JSON.stringify(cur))
// 手機：抽屜打開後也能用
await sess.setViewport(390, 844, { dpr: 2, mobile: true })
await go(ch1 + "?skip=1", 5000)
await ev(`document.querySelector('.explorer .mobile-explorer').click()`)
await sleep(800)
await ev(`[...document.querySelectorAll('.explorer .folder-container')][0]?.querySelector('.folder-icon').click()`)
await sleep(500)
const mob = JSON.parse(await ev(`JSON.stringify((() => { const b = document.querySelector('.explorer .explorer-collapse-all'); const r = b?.getBoundingClientRect(); return { vis: !!r && r.height > 0 && r.right <= innerWidth, open: document.querySelectorAll('.explorer .folder-outer.open').length } })())`))
if (mob.vis) await ev(`document.querySelector('.explorer .explorer-collapse-all').click()`)
await sleep(500)
const mob2 = await ev(`document.querySelectorAll('.explorer .folder-outer.open').length`)
check("手機版抽屜裡也有「全部收合」且有效", mob.vis && mob.open > 0 && mob2 === 0, JSON.stringify(mob) + " → " + mob2)
await saveShot(shotPath.replace(".png", "-mobile.png"))
finish()
