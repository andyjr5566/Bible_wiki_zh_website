// B1：Service Worker 檢查（註冊、快取內容、離線瀏覽、恢復連線）。
// 用法：node e2e/swcheck.mjs <siteRoot（含子路徑，結尾不加 /）> <profile>
import { startBrowser, ch1, sleep } from "./lib.mjs"

const [root, profile] = process.argv.slice(2)
const s = await startBrowser({ root, profile })
const { ev, send, check, errors, finish } = s

// 離線模擬：Network.emulateNetworkConditions 只管分頁本身，Service Worker 是另一個目標，
// 它的 fetch 仍然連得上網路（以前這支腳本的「離線」因此沒有真的測到 SW 的離線分支）。
// 所以也接上每個 Service Worker 目標，一起設成離線。
// 模擬條件跟著「連線（session）」走：同一個目標要沿用同一個 session，否則第一次設的離線會一直留著。
const browser = await s.openBrowserSocket()
const swSessions = new Map()
async function setOffline(offline) {
  const cond = { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }
  await send("Network.emulateNetworkConditions", cond)
  const { targetInfos } = await browser.send("Target.getTargets")
  for (const t of targetInfos.filter((x) => x.type === "service_worker")) {
    let sessionId = swSessions.get(t.targetId)
    if (!sessionId) {
      sessionId = (await browser.send("Target.attachToTarget", { targetId: t.targetId, flatten: true })).sessionId
      swSessions.set(t.targetId, sessionId)
      await browser.send("Network.enable", {}, sessionId)
    }
    await browser.send("Network.emulateNetworkConditions", cond, sessionId)
  }
}

// 除了 JavaScript 例外，console.error 也算錯誤（Service Worker 的錯誤多半只出現在 console）
s.on("Runtime.consoleAPICalled", (m) => { if (m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ")) })

const url1 = root + ch1
const url2 = root + "/" + encodeURI("01-創世記/第2章")
// 「沒看過的頁面」要真的不在快取裡：網站會預先抓連結頁（第 6 章就常被抓進快取），離線前再挑一頁確認沒存過
const UNSEEN = ["01-創世記/第6章", "link_folder/人物/大衛", "link_folder/主題/刀劍", "教學/熱鍵與功能速查", "INSTALL_COMPUTER"]
let url6 = root + "/" + encodeURI(UNSEEN[0])

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
// 第 1 批把羊皮紙背景壓到 0.4 MB 以下，現在會進快取；檢查的是「超過 3 MB 的檔案不進快取」這條規則
const bigCached = JSON.parse(await ev(`caches.keys().then(async ns => { const out = []; for (const n of ns) { const c = await caches.open(n); for (const r of await c.keys()) { const res = await c.match(r); const size = (await res.blob()).size; if (size > 3 * 1024 * 1024) out.push(r.url + " " + size) } } return JSON.stringify(out) })`))
check("快取裡沒有超過 3 MB 的大檔", bigCached.length === 0, bigCached.join(","))
check("其他網域（Google 字型等）沒有進快取", keys.every((u) => u.startsWith(new URL(root).origin)))
check("個人筆記設定檔 config.json 沒有進快取", !keys.some((u) => u.includes("personal-notes/config.json")))

// 離線
await setOffline(true)
await send("Page.navigate", { url: url2 }); await sleep(3000)
check("離線：看過的頁面（第 2 章）可以打開", await ev(`decodeURIComponent(location.pathname).endsWith('第2章') && !!document.querySelector('article') && document.body.innerText.length > 200`))
await send("Page.navigate", { url: url1 }); await sleep(4000)
const offNotes = await ev(`[...document.querySelectorAll('.bwz-notes .bwz-n-body')].map(e => e.innerText)`)
check("離線：第 1 章的筆記面板與筆記都在", Array.isArray(offNotes) && offNotes.includes("離線前寫的筆記"), JSON.stringify(offNotes))
for (const p of UNSEEN) {
  const u = root + "/" + encodeURI(p)
  if (!(await ev(`caches.match(${JSON.stringify(u)}).then(r => !!r)`))) { url6 = u; break }
}
const unseenName = decodeURIComponent(url6).split("/").pop()
await send("Page.navigate", { url: url6 }); await sleep(3000)
const offlineView = JSON.parse(await ev(`JSON.stringify({ path: decodeURIComponent(location.pathname), hasMessage: document.body.innerText.includes("這一頁還沒存到這台裝置"), savedCount: document.querySelectorAll("#saved-pages a").length, hasChapter2: document.body.innerText.includes("創世記 第2章") })`))
check("離線：未讀頁顯示離線頁、網址不變且清單含已存頁面", offlineView.path.endsWith(unseenName) && offlineView.hasMessage && offlineView.savedCount >= 1 && offlineView.hasChapter2, JSON.stringify(offlineView))
await ev(`document.querySelector("#retry").click()`)
await sleep(1200)
check("離線：重試按鈕可用", await ev(`decodeURIComponent(location.pathname).endsWith(${JSON.stringify(unseenName)}) && document.body.innerText.includes("這一頁還沒存到這台裝置")`))
await setOffline(false)
// 解除離線模擬後，Service Worker 那條要幾秒才真的恢復（實測偶爾第一次重新整理還拿到離線頁），所以最多重新整理 4 次、每次等 3 秒
const recovered = `decodeURIComponent(location.pathname).endsWith(${JSON.stringify(unseenName)}) && !!document.querySelector("article") && document.body.innerText.length > 200`
for (let k = 0; k < 4; k++) {
  await send("Page.reload"); await sleep(3000)
  if (await ev(recovered)) break
}
check("恢復連線：重新整理後未讀頁正常載入", await ev(recovered), await ev(`JSON.stringify({ path: decodeURIComponent(location.pathname), title: document.title, article: !!document.querySelector("article"), len: document.body?.innerText.length })`))
const swErr = errors.filter((e) => /Service Worker|ServiceWorker/i.test(e))
check("沒有 Service Worker 錯誤訊息", swErr.length === 0, swErr.slice(0, 2).join(" | "))
finish()
