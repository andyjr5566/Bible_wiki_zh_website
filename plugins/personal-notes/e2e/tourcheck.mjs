// 導覽的「個人筆記」一站：泡泡出現、框住筆記面板；說明中心列出這項技能。
// 用法：node e2e/tourcheck.mjs <siteRoot> <profile> <shotFile>
//   shotFile  截圖的檔案路徑（.png）。
//   環境變數 DELAY_APP=毫秒：模擬線上網路較慢，筆記 App 晚一點才載入。
import { startBrowser, sleep } from "./lib.mjs"

const [root, profile, shotPath] = process.argv.slice(2)
const s = await startBrowser({ root, profile })
const { ev, send, check, saveShot, finish } = s

// DELAY_APP=毫秒：模擬線上網路較慢，筆記 App 晚一點才載入
const delay = Number(process.env.DELAY_APP || 0)
s.on("Fetch.requestPaused", (m) => setTimeout(() => send("Fetch.continueRequest", { requestId: m.params.requestId }), delay))

const ch12 = root + "/" + encodeURI("02-出埃及記/第12章")
await send("Page.navigate", { url: ch12 })
await sleep(3000)
await ev(`localStorage.setItem('bwz-tour-v2', JSON.stringify({ status: 'active', step: 14, skills: [], skipped: [] }))`)
if (delay) await send("Fetch.enable", { patterns: [{ urlPattern: "*personal-notes/app.js*", requestStage: "Request" }] })
await send("Page.reload", { ignoreCache: true })
await sleep(7000)
const info = JSON.parse(await ev(`JSON.stringify({ title: document.querySelector('.bwz-bubble h2, .bwz-bubble .bwz-title')?.textContent ?? document.querySelector('.bwz-bubble')?.innerText.slice(0, 60), step: document.querySelector('.bwz-bubble')?.dataset.step, hole: (() => { const h = document.querySelector('.bwz-hole'); if (!h) return null; const r = h.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)] })(), panel: (() => { const p = document.querySelector('.bwz-notes .bwz-n-head'); if (!p) return null; const r = p.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)] })() })`))
check("導覽停在「個人筆記」這一站", info.step === "notes" && String(info.title).includes("寫下你自己的筆記"), JSON.stringify(info))
check("框起來的位置包含筆記面板標題", info.hole && info.panel && info.hole[0] <= info.panel[0] + 2 && info.hole[0] + info.hole[1] >= info.panel[0] + info.panel[1] - 2, JSON.stringify({ hole: info.hole, panel: info.panel }))
await saveShot(shotPath)
finish()
