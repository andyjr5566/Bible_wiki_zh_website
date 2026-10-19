// 存到 Google Drive＋備份提醒（F3b）的瀏覽器檢查（未登入的部分；真正的 Google Drive 上傳與還原要用自己的帳號實機測）。
// 「把時間往後調」：頁面載入前把 Date.now 換成「真實時間＋localStorage 的 e2e-shift 毫秒」。
// 用法：node e2e/backupcheck.mjs <siteRoot> <profile> [shotDir]
import { startBrowser, ch1, clickText } from "./lib.mjs"

const [root, profile, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root, profile, shotDir })
const { ev, check, go, send, shot, errors, setViewport, sleep, finish } = s
const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))
const DAY = 24 * 60 * 60 * 1000
await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const real = Date.now.bind(Date); Date.now = () => real() + Number((() => { try { return localStorage.getItem('e2e-shift') } catch { return 0 } })() || 0) })()` })
const shift = async (days) => { await ev(`localStorage.setItem('e2e-shift', String(${days * DAY}))`) }
const reminder = `(() => { const n = document.querySelector('[data-notice="backup-reminder"]'); if (!n || n.hidden || n.getBoundingClientRect().height === 0) return null; return { text: n.textContent.trim(), buttons: [...n.querySelectorAll('button')].map(b => b.textContent.trim()) } })()`

// 寫一則筆記（未登入）
await go(ch1 + "?skip=1")
await ev(clickText(".bwz-notes button", "新增筆記"))
await sleep(600)
await ev(`(() => { const t = document.querySelector('.bwz-n-card.editing textarea'); t.value = '要備份的筆記'; t.dispatchEvent(new Event('input', { bubbles: true })) })()`)
await sleep(1200)
await ev(clickText(".bwz-notes .bwz-n-card.editing button", "完成"))
await sleep(800)

// 1. 剛寫的筆記不提醒
await go("/my-notes")
await sleep(1500)
check("新寫的筆記：不會一開始就提醒備份", (await J(reminder)) === null, JSON.stringify(await J(reminder)))
// 2. 設定區塊：未登入的說明與按鈕、「這是什麼？」收合
await ev(clickText(".bwz-shell-head button", "設定與備份"))
await sleep(800)
const sec = await J(`(() => { const s = document.querySelector('.bwz-n-dialog [data-section="drive-backup"]'); if (!s) return null; const d = s.querySelector('details'); return { title: s.querySelector('h4')?.textContent ?? '', text: s.textContent.replace(/\\s+/g, ' ').slice(0, 160), buttons: [...s.querySelectorAll('button')].map(b => b.textContent.trim()), details: !!d, open: !!d?.open, summary: d?.querySelector('summary')?.textContent.trim() ?? '' } })()`)
check("設定區塊「備份到 Google Drive」：未登入時說明登入後可每週自動備份，有「用 Google 同步」", !!sec && sec.title === "備份到 Google Drive" && sec.text.includes("每週") && sec.buttons.some((b) => b.includes("用 Google 同步")), JSON.stringify(sec))
check("「這是什麼？」預設收合，不佔版面", !!sec && sec.details && !sec.open && sec.summary.includes("這是什麼"), JSON.stringify(sec))
const order = await J(`[...document.querySelectorAll('.bwz-n-dialog [data-section]')].map(s => s.dataset.section)`)
check("區塊順序：備份與匯出 → 備份到 Google Drive", order.indexOf("backup") >= 0 && order.indexOf("drive-backup") === order.indexOf("backup") + 1, JSON.stringify(order))
await shot("backup-settings")
await ev(clickText(".bwz-n-dialog button", "完成"))
await sleep(400)
// 3. 時間往後 40 天：提醒出現（未登入：下載備份檔、用 Google 同步、之後再說）
await shift(40)
await go("/my-notes")
await sleep(1500)
let r = await J(reminder)
check("40 天沒備份：〈我的筆記〉頂端出現提醒（未登入）", !!r && r.text.includes("還沒有備份") && r.buttons.some((b) => b.includes("下載備份檔")) && r.buttons.some((b) => b.includes("用 Google 同步")) && r.buttons.some((b) => b.includes("之後再說")), JSON.stringify(r))
await shot("backup-reminder")
// 4. 之後再說：重新整理後也不提醒；再過 8 天又出現
await ev(clickText('[data-notice="backup-reminder"] button', "之後再說"))
await sleep(800)
const hiddenNow = (await J(reminder)) === null
await go("/my-notes")
await sleep(1500)
check("按「之後再說」：提醒消失，重新整理後也不出現", hiddenNow && (await J(reminder)) === null)
await shift(48)
await go("/my-notes")
await sleep(1500)
check("「之後再說」7 天後：提醒再出現", (await J(reminder)) !== null)
// 5. 下載備份檔也算備份：之後不提醒
await ev(`(() => { const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl = this.download; return } return orig.call(this) } })()`)
await ev(clickText('[data-notice="backup-reminder"] button', "下載備份檔"))
await sleep(1200)
const dl = await ev(`window.__dl ?? null`)
const goneNow = (await J(reminder)) === null
await go("/my-notes")
await sleep(1500)
check("按「下載備份檔」：下載 JSON，提醒立刻消失，重新整理後也不再提醒", !!dl && dl.endsWith(".json") && goneNow && (await J(reminder)) === null, `${dl} ${goneNow}`)
// 6. 手機（下載後又改過筆記、再過 40 天才會提醒）
await setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await shift(60)
await go(ch1 + "?skip=1")
await ev(clickText(".bwz-notes button", "新增筆記"))
await sleep(600)
await ev(`(() => { const t = document.querySelector('.bwz-n-card.editing textarea'); t.value = '手機上改過'; t.dispatchEvent(new Event('input', { bubbles: true })) })()`)
await sleep(1200)
await ev(clickText(".bwz-notes .bwz-n-card.editing button", "完成"))
await sleep(800)
await shift(100)
await go("/my-notes")
await sleep(1500)
const mob = await J(`(() => { const n = document.querySelector('[data-notice="backup-reminder"]'); const b = n ? [...n.querySelectorAll('button')].map(x => Math.round(x.getBoundingClientRect().height)) : []; return { shown: !!n, scroll: document.documentElement.scrollWidth <= innerWidth, b } })()`)
check("手機：提醒不左右捲、按鈕至少 44px", mob.shown && mob.scroll && mob.b.length > 0 && mob.b.every((h) => h >= 44), JSON.stringify(mob))
await shot("backup-mobile")
await shift(0)
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
await finish()
