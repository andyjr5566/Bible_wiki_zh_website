// 〈我的筆記〉新版面（D-42）瀏覽器檢查：大量資料（400 筆記、80 便條、120 重點、25 書籤）的整理與收納。
// 用法：node e2e/mynotescheck.mjs <siteRoot> <profile> <backup.json> [shotDir]
//   backup.json 由 e2e/gen-backup.ts 產生（見 e2e/README.md）。
import { startBrowser, sleep } from "./lib.mjs"

const [root, profile, backupPath, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root, profile, shotDir })
const { ev, check, go, send, shot, errors, setViewport, finish } = s

const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))
const panel = (id) => `document.querySelector('#bwz-tab-${id}') && document.querySelector('[aria-labelledby="bwz-tab-${id}"]')`
const tabs = `[...document.querySelectorAll('.bwz-shell-tab')].map(t => ({ text: t.textContent, on: t.getAttribute('aria-selected') === 'true' }))`
const clickTab = (label) => ev(`[...document.querySelectorAll('.bwz-shell-tab')].find(t => t.textContent.startsWith(${JSON.stringify(label)})).click()`)
const visiblePanel = `[...document.querySelectorAll('.bwz-shell-panel')].filter(p => !p.hidden && p.getBoundingClientRect().height > 0).map(p => p.getAttribute('aria-labelledby'))`

await send("DOM.enable")
await go("/my-notes")
let t = await J(tabs)
check("外框：四個分頁（筆記、便條、重點、書籤）與「⚙ 設定與備份」", t.map((x) => x.text.replace(/\d+$/, "")).join(",") === "筆記,便條,重點,書籤" && (await ev(`!!document.querySelector('.bwz-shell-head .bwz-settings-btn[data-shell="settings"]')`)), JSON.stringify(t))
check("沒有資料時顯示說明", (await ev(`document.querySelector('[aria-labelledby="bwz-tab-notes"] .bwz-n-empty')?.textContent ?? ''`)).includes("還沒有筆記"))
// 匯入大量資料
const doc = await send("DOM.getDocument", { depth: -1 })
const q = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: '[aria-labelledby="bwz-tab-notes"] input[type=file]' })
await send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [backupPath] })
await sleep(6000)
const summary = await ev(`document.querySelector('.bwz-shell-summary')?.textContent`)
check("匯入 625 筆後，總覽一行顯示各種數量", summary === "共 400 則筆記 · 80 張便條 · 120 個重點 · 25 個書籤", summary)
t = await J(tabs)
check("分頁標籤上的數量", t.map((x) => x.text).join(",") === "筆記400,便條80,重點120,書籤25", JSON.stringify(t))
// 筆記分頁：最近 10＋依書卷折疊
await clickTab("筆記")
await sleep(400)
const notesView = await J(`(() => { const p = ${panel("notes")}; return { recent: p.querySelectorAll('.bwz-lib-recent .bwz-lib-card').length, books: p.querySelectorAll('details.bwz-lib-book').length, open: p.querySelectorAll('details.bwz-lib-book[open]').length, renderedCards: p.querySelectorAll('.bwz-lib-card').length, height: Math.round(document.documentElement.scrollHeight) } })()`)
check("筆記分頁：最近編輯 10 則、依書卷 12 卷全部收起、只畫出 10 張卡片、頁面不會變很長", notesView.recent === 10 && notesView.books === 12 && notesView.open === 0 && notesView.renderedCards === 10 && notesView.height < 4500, JSON.stringify(notesView))
const recentOrder = await J(`[...${panel("notes")}.querySelectorAll('.bwz-lib-recent .bwz-n-time')].map(e => e.textContent)`)
check("最近編輯依時間由新到舊", recentOrder.length === 10, JSON.stringify(recentOrder.slice(0, 3)))
await shot("m1-notes")
// 打開創世記 → 章 → 卡片
await ev(`${panel("notes")}.querySelector('details.bwz-lib-book summary').click()`)
await sleep(300)
const gen = await J(`(() => { const b = ${panel("notes")}.querySelector('details.bwz-lib-book'); return { name: b.querySelector('.bwz-lib-name').textContent, num: Number(b.querySelector('.bwz-lib-num').textContent), chapters: b.querySelectorAll('details.bwz-lib-chapter').length, chapterSum: [...b.querySelectorAll('details.bwz-lib-chapter > summary .bwz-lib-num')].reduce((s, e) => s + Number(e.textContent), 0), cards: b.querySelectorAll('.bwz-lib-card').length } })()`)
check("打開「創世記」：列出各章與數量（章數量加起來等於書卷數量），章還沒打開不畫卡片", gen.name === "創世記" && gen.chapters > 0 && gen.chapterSum === gen.num && gen.cards === 0, JSON.stringify(gen))
await ev(`${panel("notes")}.querySelector('details.bwz-lib-chapter summary').click()`)
await sleep(300)
const ch = await J(`(() => { const c = ${panel("notes")}.querySelector('details.bwz-lib-chapter'); return { num: Number(c.querySelector('.bwz-lib-num').textContent), cards: c.querySelectorAll('.bwz-lib-card').length, link: !!c.querySelector('.bwz-lib-go') } })()`)
check("打開第一章：畫出該章的卡片，數量相符、有「前往該章 →」", ch.cards === ch.num && ch.cards > 0 && ch.link, JSON.stringify(ch))
// 兩行預覽與展開
const clamp = await J(`(() => { const c = [...${panel("notes")}.querySelectorAll('.bwz-lib-card')].find(c => c.querySelector('.bwz-lib-toggle')); if (!c) return null; const p = c.querySelector('.bwz-lib-preview'); const before = Math.round(p.getBoundingClientRect().height); c.querySelector('.bwz-lib-toggle').click(); const after = Math.round(p.getBoundingClientRect().height); const text = c.querySelector('.bwz-lib-toggle').textContent; return { before, after, text } })()`)
check("長筆記只顯示約兩行，按「展開全文」才完整", !!clamp && clamp.before <= 70 && clamp.after > clamp.before + 30 && clamp.text === "收起", JSON.stringify(clamp))
await shot("m2-notes-open")
// 資料更新後（例如同步）打開的書卷維持打開
await ev(`(() => { const i = document.querySelector('.bwz-shell-search'); i.value = 'x'; i.dispatchEvent(new Event('input')); i.value = ''; i.dispatchEvent(new Event('input')) })()`)
await sleep(300)
check("重新畫之後，剛才打開的書卷與章維持打開", await ev(`${panel("notes")}.querySelectorAll('details[open]').length >= 2`))
// 搜尋：平鋪結果、每次 20 則
await ev(`(() => { const i = document.querySelector('.bwz-shell-search'); i.value = '短筆記'; i.dispatchEvent(new Event('input')) })()`)
await sleep(400)
const s1 = await J(`(() => { const p = ${panel("notes")}; return { count: p.querySelector('.bwz-lib-count')?.textContent, cards: p.querySelectorAll('.bwz-lib-card').length, more: p.querySelector('.bwz-lib-more')?.textContent ?? null, tree: !!p.querySelector('.bwz-lib-books') } })()`)
check("搜尋：顯示「找到 N 則」、先列 20 則、有「再顯示」、不顯示書卷目錄", /找到 \d+ 則筆記/.test(s1.count ?? "") && s1.cards === 20 && !!s1.more && !s1.tree, JSON.stringify(s1))
await ev(`${panel("notes")}.querySelector('.bwz-lib-more').click()`)
await sleep(300)
check("按「再顯示」多列 20 則", (await ev(`${panel("notes")}.querySelectorAll('.bwz-lib-card').length`)) === 40)
t = await J(tabs)
check("搜尋時分頁數量變成符合的數量", !t[0].text.endsWith("400") && t[1].text.endsWith("0"), JSON.stringify(t))
await ev(`(() => { const i = document.querySelector('.bwz-shell-search'); i.value = ''; i.dispatchEvent(new Event('input')) })()`)
// 標籤
await ev(`[...document.querySelectorAll('.bwz-n-tag-filter .bwz-n-tag')][0].click()`)
await sleep(300)
check("點標籤：放進搜尋框並篩選", (await ev(`document.querySelector('.bwz-shell-search').value`)).startsWith("#") && (await ev(`!!${panel("notes")}.querySelector('.bwz-lib-count')`)))
await ev(`(() => { const i = document.querySelector('.bwz-shell-search'); i.value = ''; i.dispatchEvent(new Event('input')) })()`)
await sleep(300)
// 便條分頁
await clickTab("便條")
await sleep(300)
const sv = await J(`(() => { const p = ${panel("stickies")}; return { vis: ${visiblePanel}, slips: p.querySelectorAll('.bwz-lib-recent .bwz-lib-sticky').length, colors: new Set([...p.querySelectorAll('.bwz-lib-sticky')].map(s => s.dataset.color)).size, books: p.querySelectorAll('details.bwz-lib-book').length } })()`)
check("便條分頁：只顯示這一頁、最近 10 張迷你紙箋（四色）、依書卷收起", sv.vis.length === 1 && sv.vis[0] === "bwz-tab-stickies" && sv.slips === 10 && sv.colors === 4 && sv.books > 0, JSON.stringify(sv))
check("迷你紙箋真的是紙色底（不被網站主題蓋掉）", await ev(`(() => { const s = document.querySelector('[aria-labelledby="bwz-tab-stickies"] .bwz-lib-sticky[data-color="yellow"]'); const m = getComputedStyle(s).backgroundColor.match(/[0-9]+/g).map(Number); return m[0] > 200 && m[1] > 200 })()`))
check("頁尾（使用說明・隱私權政策）在頁面最後", await ev(`(() => { const m = document.querySelector('[data-bwz-notes="mynotes"]'); return m.lastElementChild.classList.contains('bwz-shell-footer') })()`))
await shot("m3-stickies")
// 重點、書籤
await clickTab("重點")
await sleep(300)
check("重點分頁：最近 10 筆（含引文）", (await ev(`${panel("highlights")}.querySelectorAll('.bwz-lib-recent .bwz-lib-row .bwz-h-quote').length`)) === 10)
await clickTab("書籤")
await sleep(300)
const bm = await J(`(() => { const p = ${panel("bookmarks")}; const g = [...p.querySelectorAll('details.bwz-lib-book')]; return { groups: g.map(x => x.querySelector('.bwz-lib-name').textContent), last: g.at(-1)?.querySelector('.bwz-lib-num').textContent } })()`)
check("書籤分頁：知識庫條目分成一組放最後（3 個）", bm.groups.at(-1) === "知識庫條目" && bm.last === "3", JSON.stringify(bm))
await shot("m4-bookmarks")
// 記住分頁
await send("Page.reload")
await sleep(5000)
check("重新整理後停在上次的分頁（書籤）", (await J(tabs)).find((x) => x.on)?.text.startsWith("書籤"))
await clickTab("筆記")
// 設定與備份
await ev(`document.querySelector('.bwz-settings-btn[data-shell="settings"]').click()`)
await sleep(500)
const sec = await J(`[...document.querySelectorAll('.bwz-n-dialog .bwz-settings-section h4')].map(h => h.textContent)`)
check("「⚙ 設定與備份」：帳號與同步、備份與匯出、備份到 Google Drive、便條紙、刪除資料", sec.join(",") === "帳號與同步,備份與匯出,備份到 Google Drive,便條紙,刪除資料", JSON.stringify(sec))
check("備份按鈕在設定裡、不在頁面上", (await ev(`[...document.querySelectorAll('.bwz-n-dialog button')].some(b => b.textContent.includes('匯出備份'))`)) && !(await ev(`[...document.querySelectorAll('.bwz-shell ~ * button, .bwz-shell button')].some(b => !b.closest('.bwz-n-dialog') && b.textContent.includes('匯出備份'))`)))
await shot("m5-settings")
await ev(`[...document.querySelectorAll('.bwz-n-dialog button')].find(b => b.textContent === '完成').click()`)
await sleep(300)
// 手機
await setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await go("/my-notes")
const mob = await J(`(() => { const tabsEl = document.querySelector('.bwz-shell-tabs'); const tabsH = [...document.querySelectorAll('.bwz-shell-tab')].map(t => Math.round(t.getBoundingClientRect().height)); const sum = document.querySelector('details.bwz-lib-book > summary'); return { overflow: document.documentElement.scrollWidth - innerWidth, tabsH, sumH: sum ? Math.round(sum.getBoundingClientRect().height) : 0 } })()`)
check("手機：頁面不會左右捲、分頁與目錄列至少 44px", mob.overflow <= 0 && mob.tabsH.every((x) => x >= 44) && mob.sumH >= 44, JSON.stringify(mob))
await shot("m6-mobile")
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
finish()
