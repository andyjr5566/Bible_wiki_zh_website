// B1：Service Worker 檢查（註冊、快取內容、離線瀏覽、恢復連線）。
// 用法：node e2e/swcheck.mjs <siteRoot（含子路徑，結尾不加 /）> <profile>
import { startBrowser, ch1, sleep } from "./lib.mjs"

const [root, profile] = process.argv.slice(2)
const s = await startBrowser({ root, profile })
const { ev, send, check, errors, finish } = s

// 除了 JavaScript 例外，console.error 也算錯誤（Service Worker 的錯誤多半只出現在 console）
s.on("Runtime.consoleAPICalled", (m) => { if (m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ")) })

const url1 = root + ch1
const url2 = root + "/" + encodeURI("01-創世記/第2章")
const url6 = root + "/" + encodeURI("01-創世記/第6章")

await send("Network.enable")
await send("Page.navigate", { url: url1 + "?skip=1" })
await sleep(6000)
const reg = JSON.parse(await ev(`navigator.serviceWorker.getRegistration().then(r => JSON.stringify(r ? { scope: r.scope, script: (r.active || r.waiting || r.installing)?.scriptURL, state: (r.active || r.installing || r.waiting)?.state } : null))`))
check("Service Worker 註冊成功，管整個網站", !!reg && reg.scope === root + "/" && reg.script === root + "/sw.js", JSON.stringify(reg))
await Promise.race([ev(`navigator.serviceWorker.ready.then(() => true)`), sleep(8000)])
// 讓 SW 接管後再瀏覽幾頁（第一次載入時 SW 還沒接管這個分頁）
await send("Page.reload"); await sleep(5000)
await send("Page.navigate", { url: url2 }); await sleep(4000)
check("頁面已被 Service Worker 接管", await ev(`!!navigator.serviceWorker.controller`))
// 寫一則筆記（確認離線時仍在）
await send("Page.navigate", { url: url1 }); await sleep(5000)
await ev(`[...document.querySelectorAll('.bwz-notes button')].find(b => b.textContent.includes('新增筆記')).click()`)
await sleep(700)
await ev(`(() => { const t = document.querySelector('.bwz-n-card.editing textarea'); t.value = '離線前寫的筆記'; t.dispatchEvent(new Event('input', {bubbles:true})) })()`)
await sleep(900)
await ev(`[...document.querySelectorAll('.bwz-n-card.editing button')].find(b => b.textContent === '完成').click()`)
await sleep(800)

const cacheNames = JSON.parse(await ev(`caches.keys().then(ns => JSON.stringify(ns))`))
check("快取名稱只有 bible-wiki-zh-v4", cacheNames.length === 1 && cacheNames[0] === "bible-wiki-zh-v4", JSON.stringify(cacheNames))
const keys = JSON.parse(await ev(`caches.keys().then(async ns => { const out = []; for (const n of ns) { const c = await caches.open(n); for (const r of await c.keys()) out.push(r.url) } return JSON.stringify(out) })`))
check("快取裡有看過的頁面與筆記 App", keys.some((u) => u.includes(encodeURI("第2章"))) && keys.some((u) => u.includes("/static/personal-notes/app.js")), `${keys.length} 筆`)
check("大檔（羊皮紙背景）沒有進快取", !keys.some((u) => /parchment/.test(u)), keys.filter((u) => /parchment/.test(u)).join(","))
check("其他網域（Google 字型等）沒有進快取", keys.every((u) => u.startsWith(new URL(root).origin)))
check("個人筆記設定檔 config.json 沒有進快取", !keys.some((u) => u.includes("personal-notes/config.json")))

// 離線
await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
await send("Page.navigate", { url: url2 }); await sleep(3000)
check("離線：看過的頁面（第 2 章）可以打開", await ev(`decodeURIComponent(location.pathname).endsWith('第2章') && !!document.querySelector('article') && document.body.innerText.length > 200`))
await send("Page.navigate", { url: url1 }); await sleep(4000)
const offNotes = await ev(`[...document.querySelectorAll('.bwz-notes .bwz-n-body')].map(e => e.innerText)`)
check("離線：第 1 章的筆記面板與筆記都在", Array.isArray(offNotes) && offNotes.includes("離線前寫的筆記"), JSON.stringify(offNotes))
await send("Page.navigate", { url: url6 }); await sleep(3000)
const offlineView = JSON.parse(await ev(`JSON.stringify({ path: decodeURIComponent(location.pathname), hasMessage: document.body.innerText.includes("這一頁還沒存到這台裝置"), savedCount: document.querySelectorAll("#saved-pages a").length, hasChapter2: document.body.innerText.includes("創世記 第2章") })`))
check("離線：未讀頁顯示離線頁、網址不變且清單含已存頁面", offlineView.path.endsWith("第6章") && offlineView.hasMessage && offlineView.savedCount >= 1 && offlineView.hasChapter2, JSON.stringify(offlineView))
await ev(`document.querySelector("#retry").click()`)
await sleep(1200)
check("離線：重試按鈕可用", await ev(`decodeURIComponent(location.pathname).endsWith("第6章") && document.body.innerText.includes("這一頁還沒存到這台裝置")`))
await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
await send("Page.reload"); await sleep(4000)
check("恢復連線：重新整理後未讀頁正常載入", await ev(`decodeURIComponent(location.pathname).endsWith("第6章") && !!document.querySelector("article") && document.body.innerText.length > 200`))
const swErr = errors.filter((e) => /Service Worker|ServiceWorker/i.test(e))
check("沒有 Service Worker 錯誤訊息", swErr.length === 0, swErr.slice(0, 2).join(" | "))
finish()
