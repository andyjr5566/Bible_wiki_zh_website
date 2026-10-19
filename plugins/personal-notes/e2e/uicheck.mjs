// 使用者回饋：選取工具列點別處收起、拿掉取消、左上角我的筆記入口。
// 用法：node e2e/uicheck.mjs <siteRoot> <profile> [shotFile]
//   shotFile  選填，手機版入口的截圖檔路徑（預設 ui-mobile.png）；桌面版截圖存成同名的 -desktop.png。注意這是檔案路徑，不是資料夾。
import { startBrowser, ch1, clickText, selectIn } from "./lib.mjs"

const [root, profile, shotFile = "ui-mobile.png"] = process.argv.slice(2)
const s = await startBrowser({ root, profile })
const { ev, send, check, go, errors, sleep, saveShot, setViewport, finish } = s

// 工具列「真的看得到」：不能只看 hidden 屬性（CSS display 會蓋掉 [hidden]）
const tbVisible = `(() => { const t = document.querySelector('.bwz-h-toolbar'); return !!t && getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().height > 0 })()`
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
}
const blankPoint = `(() => { const h = document.querySelector('article h1, .article-title, article h2'); const r = h.getBoundingClientRect(); return [Math.round(r.left + 5), Math.round(r.top + r.height / 2)] })()`

await go(ch1 + "?skip=1")
// ---- 3. 左上角入口 ----
const tbar = JSON.parse(await ev(`JSON.stringify((() => { const t = document.querySelector('.left.sidebar .flex-component'); const kids = [...t.children].map(c => c.querySelector('.darkmode') ? 'dark' : c.querySelector('.puremode') ? 'pure' : c.querySelector('.bwz-notes-entry') ? 'notes' : c.querySelector('.readermode') ? 'reader' : c.className || c.tagName); const a = t.querySelector('a.bwz-notes-entry'); const r = a?.getBoundingClientRect(); return { kids, href: a?.getAttribute('href'), w: r?.width, h: r?.height, reader: !!document.querySelector('.readermode') } })())`))
check("閱讀模式按鈕已移除", !tbar.reader, JSON.stringify(tbar.kids))
check("「我的筆記」入口在明暗模式按鈕後面、看得到", tbar.kids.indexOf("notes") === tbar.kids.indexOf("dark") + 1 && tbar.w >= 18 && tbar.h >= 18, JSON.stringify(tbar))
const txt = JSON.parse(await ev(`JSON.stringify((() => { const a = document.querySelector('.left.sidebar a.bwz-notes-entry-text'); if (!a) return null; const t = document.querySelector('.left.sidebar .flex-component').getBoundingClientRect(); const ex = document.querySelector('.left.sidebar .explorer')?.getBoundingClientRect(); const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), below: r.top >= t.bottom - 1, aboveExplorer: !ex || r.bottom <= ex.top + 1, w: r.width, h: r.height } })())`))
check("圖示列下方有文字按鈕「📝 我的筆記」，在探索上方", txt && txt.text === "📝 我的筆記" && txt.below && txt.aboveExplorer && txt.h > 20, JSON.stringify(txt))
await saveShot(shotFile.replace(".png", "-desktop.png"), { x: 0, y: 0, width: 330, height: 330, scale: 1 })
// ---- 1. 選取後點別處收起 ----
await ev(selectIn(3, "要有光"))
await sleep(700)
check("選取經文時工具列看得到", await ev(tbVisible))
const [bx, by] = JSON.parse(await ev(`JSON.stringify(${blankPoint})`))
await clickAt(bx, by)
await sleep(700)
check("點別處後工具列真的消失", !(await ev(tbVisible)))
await ev(selectIn(3, "要有光"))
await sleep(700)
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
await sleep(300)
check("按 Esc 工具列消失", !(await ev(tbVisible)))
// ---- 2. 重點的移除工具列：沒有取消，點別處收起 ----
await ev(selectIn(3, "要有光"))
await sleep(700)
await ev(clickText(".bwz-h-toolbar button", "畫重點"))
await sleep(1200)
await ev(`window.scrollTo(0, 0)`)
const [mx, my] = JSON.parse(await ev(`JSON.stringify((() => { const m = document.querySelector('li[data-v="3"] mark.bwz-hl'); m.scrollIntoView({ block: 'center' }); const r = m.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)] })())`))
await sleep(300)
await clickAt(mx, my)
await sleep(600)
const rb = await ev(`[...document.querySelectorAll('.bwz-h-toolbar button')].map(b => b.textContent)`)
check("點重點只出現「移除這個重點」（沒有取消）", (await ev(tbVisible)) && JSON.stringify(rb) === JSON.stringify(["移除這個重點"]), JSON.stringify(rb))
const [bx2, by2] = JSON.parse(await ev(`JSON.stringify(${blankPoint})`))
await clickAt(bx2, by2)
await sleep(700)
check("點別處後移除工具列消失、重點還在", !(await ev(tbVisible)) && (await ev(`!!document.querySelector('li[data-v="3"] mark.bwz-hl')`)))
// ---- 3. 點入口到我的筆記（SPA） ----
await ev(`document.querySelector('a.bwz-notes-entry').click()`)
await sleep(3500)
const mine = JSON.parse(await ev(`JSON.stringify({ path: decodeURIComponent(location.pathname), cur: document.querySelector('a.bwz-notes-entry')?.getAttribute('aria-current'), n: document.querySelectorAll('.left.sidebar a.bwz-notes-entry').length, page: !!document.querySelector('[data-bwz-notes="mynotes"]') })`))
check("點入口打開我的筆記頁，入口標示為目前頁、只有一個", mine.path.endsWith("/my-notes") && mine.cur === "page" && mine.n === 1 && mine.page, JSON.stringify(mine))
await ev(`history.back()`)
await sleep(3000)
check("回到章節頁後入口仍只有一個且不標示", (await ev(`document.querySelectorAll('.left.sidebar a.bwz-notes-entry').length`)) === 1 && !(await ev(`document.querySelector('a.bwz-notes-entry').hasAttribute('aria-current')`)))
await ev(`document.querySelector('a.bwz-notes-entry-text').click()`)
await sleep(3500)
check("點文字按鈕打開我的筆記頁", decodeURIComponent(await ev(`location.pathname`)).endsWith("/my-notes") && (await ev(`document.querySelector('a.bwz-notes-entry-text').getAttribute('aria-current')`)) === "page" && (await ev(`document.querySelectorAll('a.bwz-notes-entry-text').length`)) === 1)
await ev(`history.back()`)
await sleep(3000)
// 首頁、資料夾頁也有入口
await go("/" + encodeURI("教學/快速入門"))
check("一般文章頁（教學）也有入口", await ev(`!!document.querySelector('.left.sidebar a.bwz-notes-entry')`))
await go("/" + encodeURI("01-創世記") + "/")
check("資料夾頁也有入口", await ev(`!!document.querySelector('.left.sidebar a.bwz-notes-entry')`))
// 手機寬度
// 手機視埠（390x844、2 倍像素、行動版模擬，無觸控）
await setViewport(390, 844, { dpr: 2, mobile: true })
await go(ch1 + "?skip=1")
const mob = JSON.parse(await ev(`JSON.stringify((() => { const a = document.querySelector('.left.sidebar a.bwz-notes-entry'); if (!a) return null; const r = a.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, vis: getComputedStyle(a).visibility } })())`))
check("手機版入口看得到", mob && mob.w >= 18 && mob.top < 200, JSON.stringify(mob))
check("手機版不顯示文字按鈕（頂部空間有限）", await ev(`(() => { const a = document.querySelector('a.bwz-notes-entry-text'); return !a || a.getBoundingClientRect().height === 0 })()`))
await saveShot(shotFile, { x: 0, y: 0, width: 390, height: 160, scale: 1 })

check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
finish()
