// 手機尺寸（390x844、觸控）檢查筆記輸入框與我的筆記頁版面。
// 用法：node e2e/mobilecheck.mjs <siteRoot> <profile> [shotDir]
import { startBrowser, ch1, sleep } from "./lib.mjs"

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

const [base, profile, shots] = process.argv.slice(2)
const s = await startBrowser({ root: base, profile, width: 390, height: 844, mobile: true, incognito: false, userAgent: IPHONE_UA, shotDir: shots, detailMax: Infinity })
const { ev, check, go, shot, finish } = s

await go(ch1 + "?skip=1", 5000)
await ev(`[...document.querySelectorAll('.bwz-notes button')].find(b => b.textContent.includes('新增筆記')).click()`)
await sleep(800)
const inputs = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.bwz-n-card.editing input, .bwz-n-card.editing textarea')].map(el => { const cs = getComputedStyle(el); return { label: el.getAttribute('aria-label'), h: Math.round(el.getBoundingClientRect().height), border: cs.borderTopWidth + ' ' + cs.borderTopStyle, font: cs.fontSize } }))`))
for (const i of inputs) check(`編輯器「${i.label}」高度≥44、有框線、字級≥16`, i.h >= 44 && i.border.startsWith("1px solid") && parseFloat(i.font) >= 16, `h=${i.h} border=${i.border} font=${i.font}`)
await ev(`document.querySelector('.bwz-n-card.editing').scrollIntoView({block:'center'})`)
await sleep(300)
await shot("m1-editor")
await go("/my-notes", 4500)
const f = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.bwz-shell-search')].map(el => ({ tag: el.tagName, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) })))`))
check("我的筆記：搜尋框整行寬（≥300px）、高度≥44", f[0] && f[0].w >= 300 && f[0].h >= 44, JSON.stringify(f))
await ev(`document.querySelector('.bwz-shell-search').scrollIntoView({block:'center'})`)
await sleep(300)
await shot("m2-mynotes")
finish()
