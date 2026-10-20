// 章節／條目筆記面板的「?」文字版教學（F7b）：簡單的文字清單，不是動畫導覽；最下面連到動畫教學。
// 電腦尺寸的 🖍、❝ 兩行寫「滑鼠」；觸控模擬（手機）寫「長按」「拉動」（D-51，14 §2.5）。
// 用法：node e2e/helpcheck.mjs <siteRoot> <profile> [shotDir]
import { startBrowser, ch1 } from "./lib.mjs"

const [root, profile, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root, profile, shotDir })
const { ev, check, go, shot, errors, setViewport, sleep, finish } = s
const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))
const open = `(() => { const b = document.querySelector('.bwz-notes .bwz-n-head button[aria-label="筆記怎麼用"]'); if (!b) return false; b.click(); return true })()`
const read = `(() => { const d = document.querySelector('.bwz-n-dialog'); if (!d) return null; const a = d.querySelector('a'); return { title: d.querySelector('h3, h2, .bwz-n-dialog-title')?.textContent.trim() ?? '', lines: [...d.querySelectorAll('li')].map(li => li.textContent.trim()), link: a?.getAttribute('href') ?? null, linkText: a?.textContent.trim() ?? '', tour: !!document.querySelector('.bwz-tut') } })()`

await go(ch1 + "?skip=1")
check("章節筆記面板標題旁有「?」", await ev(open))
await sleep(500)
let d = await J(read)
check("點「?」：打開文字版說明（7 條），不是動畫或網站導覽", !!d && d.title.includes("筆記怎麼用") && d.lines.length === 7 && !d.tour, JSON.stringify(d))
check("說明最下面連到動畫教學（/my-notes?tutorial=1）", !!d && !!d.link && d.link.endsWith("/my-notes?tutorial=1") && d.linkText.includes("動畫教學"), `${d?.link} ${d?.linkText}`)
check("章節頁的第一條是寫這一章的筆記", !!d && d.lines[0].includes("這一章"), d?.lines[0])
check("電腦：🖍 與 ❝ 兩行寫「滑鼠」、沒有「長按」", !!d && d.lines[1].includes("滑鼠") && d.lines[4].includes("滑鼠") && !d.lines[1].includes("長按") && !d.lines[4].includes("長按"), `${d?.lines[1]} / ${d?.lines[4]}`)
await shot("help-chapter")
await ev(`[...document.querySelectorAll('.bwz-n-dialog button')].find(b => b.textContent.includes('知道了'))?.click()`)
await sleep(300)
await go("/" + encodeURI("link_folder/人物/亞伯拉罕"))
check("條目頁筆記面板也有「?」", await ev(open))
await sleep(500)
d = await J(read)
check("條目頁的第一條是寫這個條目的筆記", !!d && d.lines[0].includes("這個條目"), d?.lines[0])
await ev(`[...document.querySelectorAll('.bwz-n-dialog button')].find(b => b.textContent.includes('知道了'))?.click()`)
await setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await go(ch1 + "?skip=1")
const h = await ev(`Math.round(document.querySelector('.bwz-notes .bwz-n-head button[aria-label="筆記怎麼用"]')?.getBoundingClientRect().height ?? 0)`)
check("手機：「?」按鈕至少 44px", h >= 44, h)
check("手機尺寸確實是觸控為主（pointer: coarse）", await ev(`matchMedia('(pointer: coarse)').matches`))
await ev(open)
await sleep(500)
d = await J(read)
check("手機：🖍 那行寫「長按」「拉動」、沒有「滑鼠」", !!d && d.lines.length === 7 && d.lines[1].includes("長按") && d.lines[1].includes("拉動") && !d.lines[1].includes("滑鼠"), d?.lines[1])
check("手機：❝ 那行寫「長按」、沒有「滑鼠」", !!d && d.lines[4].includes("長按") && !d.lines[4].includes("滑鼠"), d?.lines[4])
check("手機：其他行（🗒️ 🔗 📚 ☁️）跟電腦版一樣", !!d && [2, 3, 5, 6].every((i) => !d.lines[i].includes("長按") && !d.lines[i].includes("滑鼠")), JSON.stringify(d?.lines))
check("手機：📝 行用「點「＋ 新增筆記」」", !!d && d.lines[0].includes("點「＋ 新增筆記」") && !d.lines[0].includes("按「"), d?.lines[0])
await shot("help-phone")
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
await finish()
