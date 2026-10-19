// 針對本輪修正的實際瀏覽器檢查（打字不遺失、節數對調、刪除焦點、空白筆記、說明視窗、匯出、前往該章、搜尋）。
// 用法：node e2e/fixcheck.mjs <baseUrl> <profileDir> <downloadDir>
//   環境變數 INCOG=1：無痕模式（無頭 Chrome 不允許無痕下載，改驗匯出時產生的下載連結）。
import { readdirSync, readFileSync } from "node:fs"
import { startBrowser, ch1 } from "./lib.mjs"

const [base, profile, dlDir] = process.argv.slice(2)
const s = await startBrowser({ root: base, profile, incognito: !!process.env.INCOG })
const { ev, check, go, send, errors, sleep, finish } = s

const typeInto = (sel, value) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })) })()`
const cardBodies = `[...document.querySelectorAll('.bwz-notes .bwz-n-list .bwz-n-card .bwz-n-body')].map(e => e.innerText)`

// 無痕模式時頁面在另一個瀏覽器環境，下載設定要指定那個環境
const br = await s.openBrowserSocket()
const ctx = ((await br.send("Target.getTargets"))?.targetInfos ?? []).find((t) => t.type === "page")?.browserContextId
await br.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dlDir, eventsEnabled: true, ...(ctx ? { browserContextId: ctx } : {}) })

// 1. 打字後 150ms 就重新整理：內容不能遺失
await go(ch1 + "?skip=1")
await ev(`[...document.querySelectorAll('.bwz-notes button')].find(b => b.textContent.includes('新增筆記')).click()`)
await sleep(600)
await ev(typeInto(".bwz-n-card.editing .bwz-n-textarea", "重新整理前最後打的字"))
await sleep(150)
await send("Page.reload")
await sleep(5000)
const afterReload = await ev(cardBodies)
check("打字後 150ms 重新整理：內容保留", afterReload.includes("重新整理前最後打的字"), JSON.stringify(afterReload))

// 2. 節數填反（9–4）→ 存成第 4–9 節
await ev(`[...document.querySelectorAll('.bwz-notes button')].find(b => b.textContent.includes('新增筆記')).click()`)
await sleep(600)
await ev(`(() => { const [a, b] = document.querySelectorAll('.bwz-n-card.editing input[type=number]'); a.value = '9'; a.dispatchEvent(new Event('input', {bubbles:true})); b.value = '4'; b.dispatchEvent(new Event('input', {bubbles:true})) })()`)
await ev(typeInto(".bwz-n-card.editing .bwz-n-textarea", "節數填反"))
await sleep(900)
await ev(`[...document.querySelectorAll('.bwz-n-card.editing button')].find(b => b.textContent === '完成').click()`)
await sleep(800)
const verse = await ev(`[...document.querySelectorAll('.bwz-notes .bwz-n-card')].find(c => c.innerText.includes('節數填反'))?.querySelector('.bwz-n-verse')?.innerText`)
check("節數 9–4 自動對調", verse === "第 4–9 節", verse)
check("完成後焦點回到該則的「編輯」按鈕或新增鈕", await ev(`['編輯','＋ 新增筆記'].includes(document.activeElement?.textContent)`), await ev(`document.activeElement?.textContent`))

// 3. 刪除確認框焦點在「取消」
await ev(`[...document.querySelectorAll('.bwz-notes .bwz-n-card')].find(c => c.innerText.includes('節數填反')).querySelector('.danger').click()`)
await sleep(400)
check("刪除確認框預設焦點在「取消」", await ev(`document.activeElement?.textContent === '取消'`), await ev(`document.activeElement?.textContent`))
await ev(`document.activeElement.click()`)
await sleep(300)

// 4. 內容全刪空後按完成 → 不留空白卡片
const before = (await ev(cardBodies)).length
await ev(`[...document.querySelectorAll('.bwz-notes button')].find(b => b.textContent.includes('新增筆記')).click()`)
await sleep(600)
await ev(typeInto(".bwz-n-card.editing .bwz-n-textarea", "x"))
await sleep(900)
await ev(typeInto(".bwz-n-card.editing .bwz-n-textarea", ""))
await sleep(200)
await ev(`[...document.querySelectorAll('.bwz-n-card.editing button')].find(b => b.textContent === '完成').click()`)
await sleep(1000)
check("內容清空後完成：不留空白筆記", (await ev(cardBodies)).length === before, `${before} → ${(await ev(cardBodies)).length}`)

// 5. 說明視窗顯示試用公告與隱私權政策連結
await ev(`[...document.querySelectorAll('.bwz-n-status button')].find(b => b.textContent.includes('Google'))?.click()`)
await sleep(1500)
const dlg = await ev(`document.querySelector('.bwz-n-dialog')?.innerText ?? ''`)
check("登入說明視窗：隱私權政策連結（不顯示試用公告）", !dlg.includes("試用") && dlg.includes("隱私權政策"), dlg.slice(0, 60).replace(/\s+/g, " "))
await ev(`[...document.querySelectorAll('.bwz-n-dialog button')].find(b => b.textContent === '取消').click()`)
await sleep(300)

// 6. 說明中心有「看我的筆記」
await ev(`document.querySelector('.bwz-fab')?.click()`)
await sleep(600)
check("說明中心有「看我的筆記」連結", await ev(`!!document.querySelector('[data-modal=help] a[data-slug="my-notes"]')`))
await ev(`document.querySelector('[data-modal=help] [data-h=close]')?.click()`)

// 7. 我的筆記頁：匯出真的下載、頁面不跳走
await go("/my-notes")
// 無痕模式下無頭 Chrome 不允許下載：改成攔截匯出時產生的下載連結，在頁面裡讀出內容核對
if (process.env.INCOG) await ev(`(() => { const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__exported = { name: this.download, href: this.href, routerIgnore: 'routerIgnore' in this.dataset }; return } return orig.call(this) } })()`)
await ev(`document.querySelector('.bwz-settings-btn[data-shell="settings"]')?.click()`)
await sleep(400)
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('匯出備份')).click()`)
if (process.env.INCOG) {
  await sleep(800)
  const x = JSON.parse(await ev(`(async () => { const e = window.__exported; if (!e) return 'null'; const data = await (await fetch(e.href)).json(); return JSON.stringify({ name: e.name, routerIgnore: e.routerIgnore, records: data.records.length }) })()`))
  const p0 = await ev(`location.pathname`)
  check("匯出備份（無痕模式改驗下載連結）：檔名、內容正確，頁面留在我的筆記", !!x && x.records > 0 && x.routerIgnore && x.name.endsWith(".json") && p0.endsWith("my-notes"), JSON.stringify(x) + " " + p0)
}
await sleep(2500)
const path = await ev(`location.pathname`)
const files = readdirSync(dlDir).filter((f) => f.endsWith(".json"))
let count = -1
if (files.length) count = JSON.parse(readFileSync(`${dlDir}/${files[0]}`, "utf8")).records.length
if (!process.env.INCOG) check("匯出備份：下載 JSON 檔、頁面留在我的筆記", files.length === 1 && path.endsWith("my-notes") && count > 0, `${files.join(",")} records=${count} path=${path}`)

// 8. 「前往該章編輯 →」會捲到筆記面板
await ev(`[...document.querySelectorAll('.bwz-n-dialog button')].find(b => b.textContent === '完成')?.click()`)
await sleep(300)
await ev(`document.querySelector('.bwz-lib-card .bwz-lib-card-foot a.bwz-n-link').click()`)
await sleep(4000)
const pos = await ev(`(() => { const r = document.querySelector('.bwz-notes').getBoundingClientRect(); return JSON.stringify({ y: Math.round(scrollY), top: Math.round(r.top), h: innerHeight }) })()`)
const p = JSON.parse(pos)
check("「前往該章編輯 →」捲到筆記面板", p.top >= -5 && p.top < p.h, pos)

// 9. 搜尋 #標籤、書卷名
await go("/my-notes")
await ev(typeInto(".bwz-shell-search", "創世記 第1章"))
await sleep(300)
check("我的筆記搜尋：可用書卷章節", (await ev(`document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] .bwz-lib-card').length`)) > 0)

check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
finish()
