// 知識庫條目加入書籤（12 N2）瀏覽器檢查。
// 用法：node e2e/nodecheck.mjs <siteRoot> <profile>
import { startBrowser, ch1 } from "./lib.mjs"

const [root, profile] = process.argv.slice(2)
const s = await startBrowser({ root, profile })
const { ev, check, go, send, errors, setViewport, sleep, finish } = s

const entry = "/" + encodeURI("link_folder/人物/亞伯拉罕")
const btnState = `JSON.stringify((() => { const all = document.querySelectorAll('button.bwz-node-bookmark'); const b = all[0]; const h1 = document.querySelector('.page-header h1.article-title'); return { n: all.length, text: b?.textContent, pressed: b?.getAttribute('aria-pressed'), afterTitle: !!b && !!h1 && h1.nextElementSibling === b, h: b ? Math.round(b.getBoundingClientRect().height) : 0 } })())`
const state = async () => JSON.parse(await ev(btnState))

await go(entry)
let cur = await state()
check("條目頁標題下方有「🔖 加入書籤」", cur.n === 1 && cur.afterTitle && cur.text === "🔖 加入書籤" && cur.pressed === "false", JSON.stringify(cur))
await ev(`document.querySelector('button.bwz-node-bookmark').click()`)
await sleep(1200)
cur = await state()
const t1 = await ev(`document.querySelector('.bwz-n-toast.show')?.textContent ?? null`)
check("按下後變成「已加入書籤」並提示", cur.text === "🔖 已加入書籤" && cur.pressed === "true" && t1 === "已加入書籤", `${JSON.stringify(cur)} ${t1}`)
await send("Page.reload")
await sleep(4500)
check("重新整理後仍是已加入", (await state()).pressed === "true")
await go("/" + encodeURI("link_folder/人物") + "/")
check("資料夾首頁（不是條目）沒有書籤按鈕", (await state()).n === 0)
await go(ch1 + "?skip=1")
check("章節頁沒有條目書籤按鈕", (await state()).n === 0)
await go("/my-notes")
const listed = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('a')].filter(a => a.textContent.includes('📚')).map(a => ({ text: a.textContent.trim(), href: decodeURIComponent(a.getAttribute('href') || '') })))`))
check("我的筆記頁列出「📚 亞伯拉罕」並連到條目", listed.length === 1 && listed[0].text === "📚 亞伯拉罕" && listed[0].href.endsWith("link_folder/人物/亞伯拉罕"), JSON.stringify(listed))
await ev(`[...document.querySelectorAll('a')].find(a => a.textContent.includes('📚')).click()`)
await sleep(3500)
cur = await state()
check("點清單回到條目頁（SPA），按鈕只有一個且是已加入", decodeURIComponent(await ev(`location.pathname`)).endsWith("亞伯拉罕") && cur.n === 1 && cur.pressed === "true", JSON.stringify(cur))
// SPA 換到另一個條目
const other = await ev(`(() => { const a = [...document.querySelectorAll('article a.internal')].find(a => (a.getAttribute('href') || '').includes('link_folder/') && !decodeURIComponent(a.getAttribute('href')).includes('亞伯拉罕')); if (!a) return null; a.click(); return decodeURIComponent(a.getAttribute('href')) })()`)
await sleep(3500)
if (other) {
  cur = await state()
  const isEntry = !decodeURIComponent(await ev(`location.pathname`)).endsWith("/")
  check("換到另一個條目：按鈕只有一個、狀態是未加入", !isEntry || (cur.n === 1 && cur.pressed === "false"), `${other} ${JSON.stringify(cur)}`)
}
await go(entry)
await ev(`document.querySelector('button.bwz-node-bookmark').click()`)
await sleep(1200)
check("再按一次取消書籤", (await state()).pressed === "false")
await setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await go(entry)
cur = await state()
check("手機版：按鈕看得到且至少 44px", cur.n === 1 && cur.h >= 44, JSON.stringify(cur))
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
finish()
