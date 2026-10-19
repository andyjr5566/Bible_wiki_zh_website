// 引用到筆記（F6）的瀏覽器檢查：註釋區選字 → 工具列 → 新筆記／插在編輯中的游標位置、經文選字只出現經文工具列、條目頁引用、手機。
// 用法：node e2e/quotecheck.mjs <siteRoot> <profile> [shotDir]（網站用 test_content 建置）
import { startBrowser, ch1, clickText, selectIn, setVal } from "./lib.mjs"

const [root, profile, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root, profile, shotDir })
const { ev, check, go, shot, errors, setViewport, sleep, finish } = s
const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))
const abraham = "/" + encodeURI("link_folder/人物/亞伯拉罕")

// 選取經文以外、文章裡第一段夠長的文字（跳過經文清單、我們自己的元素、收合區塊）
const selectCommentary = `(() => {
  const art = document.querySelector('article')
  const list = document.querySelector('ol.bwz-verses')
  const ps = [...art.querySelectorAll('p, li')].filter(p => !p.closest('li[data-v]') && !p.closest('[class*="bwz-"]') && !p.closest('details:not([open])') && (!list || !list.contains(p)) && p.textContent.trim().length > 12 && p.getBoundingClientRect().height > 0)
  const p = ps[0]; if (!p) return null
  p.scrollIntoView({ block: 'center' })
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n = w.nextNode(); while (n && n.data.trim().length < 6) n = w.nextNode()
  if (!n) return null
  const start = n.data.search(/\\S/); const r = document.createRange(); r.setStart(n, start); r.setEnd(n, Math.min(n.data.length, start + 8))
  getSelection().removeAllRanges(); getSelection().addRange(r); return getSelection().toString()
})()`
const toolbars = `({ quote: (() => { const t = document.querySelector('.bwz-q-toolbar'); return !!t && !t.hidden && t.getBoundingClientRect().height > 0 })(), verse: (() => { const t = document.querySelector('.bwz-h-toolbar:not(.bwz-q-toolbar)'); return !!t && !t.hidden && t.getBoundingClientRect().height > 0 })() })`

// 1. 章節頁註釋區選字 → 只出現引用工具列
await go(ch1 + "?skip=1")
const picked = await ev(selectCommentary)
await sleep(700)
let tb = await J(toolbars)
check("註釋區選字：出現「❝ 引用到筆記」、不出現經文工具列", !!picked && tb.quote && !tb.verse, `${picked} ${JSON.stringify(tb)}`)
await shot("q1-toolbar")
// 2. 沒有開著的筆記 → 開新筆記並填好引文、自動儲存
await ev(clickText(".bwz-q-toolbar button", "引用到筆記"))
await sleep(1500)
const val = await ev(`document.querySelector('.bwz-notes .bwz-n-card.editing textarea')?.value ?? null`)
check("沒有開著的筆記：開一則新筆記，引文與出處已填好", !!val && val.startsWith("> ") && val.includes(picked.trim().slice(0, 4)) && /> —— \[\[01-創世記\/第1章(#[^|\]]+)?\|創世記 1/.test(val) && val.endsWith("\n\n"), JSON.stringify(val))
const verseFields = await ev(`(() => { const i = [...document.querySelectorAll('.bwz-notes .bwz-n-card.editing input[type=number]')]; return i.map(x => x.value).join(',') })()`)
check("引用開的新筆記是整章筆記（沒有節數）", verseFields === "" || /^,*$/.test(verseFields), verseFields)
await ev(clickText(".bwz-notes .bwz-n-card.editing button", "完成"))
await sleep(1000)
const card = await J(`(() => { const c = [...document.querySelectorAll('.bwz-notes .bwz-n-list .bwz-n-card')].find(c => c.querySelector('blockquote')); if (!c) return null; const a = c.querySelector('blockquote a'); return { quote: c.querySelector('blockquote').innerText.trim().slice(0, 40), link: a?.textContent ?? null, href: a?.getAttribute('href') ?? null } })()`)
check("存好後：卡片顯示引用區塊，出處是可點的連結（創世記 1 · …）", !!card && !!card.link && card.link.startsWith("創世記 1") && !!card.href && decodeURI(card.href).includes("01-創世記/第1章"), JSON.stringify(card))
// 3. 編輯中再引用 → 插在游標位置
await ev(clickText(".bwz-notes button", "新增筆記"))
await sleep(600)
await ev(setVal(".bwz-notes .bwz-n-card.editing textarea", "我的想法："))
await ev(`document.querySelector('.bwz-notes .bwz-n-card.editing textarea').blur()`)
await ev(selectCommentary)
await sleep(700)
await ev(clickText(".bwz-q-toolbar button", "引用到筆記"))
await sleep(900)
const val2 = await ev(`document.querySelector('.bwz-notes .bwz-n-card.editing textarea')?.value ?? null`)
check("編輯中再引用：插在游標位置（原本的字還在、引文接在後面）", !!val2 && val2.startsWith("我的想法：") && val2.includes("\n> ") && val2.includes("—— [["), JSON.stringify(val2))
await sleep(1200)
await ev(clickText(".bwz-notes .bwz-n-card.editing button", "完成"))
await sleep(800)
// 4. 經文選字 → 只出現經文工具列
await ev(selectIn(3, "要有光"))
await sleep(700)
tb = await J(toolbars)
check("經文選字：只出現經文工具列", tb.verse && !tb.quote, JSON.stringify(tb))
await ev(`getSelection().removeAllRanges()`)
await sleep(400)
// 5. 條目頁引用 → 條目筆記
await go(abraham)
await ev(selectCommentary)
await sleep(700)
tb = await J(toolbars)
await ev(clickText(".bwz-q-toolbar button", "引用到筆記"))
await sleep(1500)
const ent = await ev(`document.querySelector('[data-bwz-notes="node"] .bwz-n-card.editing textarea')?.value ?? null`)
check("條目頁選字：出現引用工具列，引文開成條目筆記（出處是亞伯拉罕）", tb.quote && !!ent && /> —— \[\[link_folder\/人物\/亞伯拉罕(#[^|\]]+)?\|亞伯拉罕/.test(ent), JSON.stringify(ent))
await ev(clickText('[data-bwz-notes="node"] .bwz-n-card.editing button', "完成"))
await sleep(1000)
const entCount = await ev(`document.querySelectorAll('[data-bwz-notes="node"] .bwz-n-list .bwz-n-card blockquote').length`)
check("條目筆記存好、顯示引用區塊", entCount === 1, entCount)
// 6. 在我們自己的元素（筆記卡片）裡選字不出現引用工具列
await ev(`(() => { const t = document.querySelector('[data-bwz-notes="node"] .bwz-n-card blockquote'); const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT); const n = w.nextNode(); const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, Math.min(3, n.data.length)); getSelection().removeAllRanges(); getSelection().addRange(r) })()`)
await sleep(700)
tb = await J(toolbars)
check("在筆記卡片裡選字：不出現引用工具列", !tb.quote, JSON.stringify(tb))
await ev(`getSelection().removeAllRanges()`)
// 7. 手機
await setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await go(ch1 + "?skip=1")
await ev(selectCommentary)
await sleep(800)
const mob = await J(`(() => { const t = document.querySelector('.bwz-q-toolbar'); const b = t?.querySelector('button')?.getBoundingClientRect(); const r = t?.getBoundingClientRect(); return { shown: !!t && !t.hidden, h: b ? Math.round(b.height) : 0, left: r ? Math.round(r.left) : -1, right: r ? Math.round(r.right) : 9999, vw: innerWidth } })()`)
check("手機：引用工具列在畫面內、按鈕至少 44px", mob.shown && mob.h >= 44 && mob.left >= 0 && mob.right <= mob.vw, JSON.stringify(mob))
await shot("q2-mobile")
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
await finish()
