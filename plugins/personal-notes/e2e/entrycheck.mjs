// 條目相關的瀏覽器檢查：F4b 條目搬移後找回書籤、F5 條目頁寫筆記與「我的相關筆記」。
// 用法：node e2e/entrycheck.mjs <siteRoot> <profile> <backup.json> [shotDir]
//   backup.json 由 `npx tsx e2e/gen-entry-backup.ts <輸出.json>` 產生；網站用 test_content 建置。
import { startBrowser, clickText, setVal } from "./lib.mjs"

const [root, profile, backupPath, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root, profile, shotDir })
const { ev, check, go, send, shot, errors, setViewport, sleep, finish } = s
const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))
const abraham = "/" + encodeURI("link_folder/人物/亞伯拉罕")
const david = "/" + encodeURI("link_folder/人物/大衛")

// 匯入準備好的資料
await send("DOM.enable")
await go("/my-notes")
const doc = await send("DOM.getDocument", { depth: -1 })
const q = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: '[aria-labelledby="bwz-tab-notes"] input[type=file]' })
await send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [backupPath] })
await sleep(4000)

// ---- F4b：〈我的筆記〉的書籤分頁 ----
await ev(clickText(".bwz-shell-tab", "書籤"))
await sleep(400)
await ev(`[...document.querySelectorAll('[aria-labelledby="bwz-tab-bookmarks"] details')].forEach(d => d.open = true)`)
await sleep(2500)
const rows = await J(`[...document.querySelectorAll('[aria-labelledby="bwz-tab-bookmarks"] .bwz-lib-row')].map(r => ({ text: r.querySelector('.bwz-lib-place')?.textContent ?? '', href: r.querySelector('a.bwz-lib-place')?.getAttribute('href') ?? null }))`)
const moved = rows.find((r) => r.text.includes("亞伯拉罕"))
const missing = rows.find((r) => r.text.includes("不存在的條目"))
check("〈我的筆記〉：搬過資料夾的條目書籤連到新網址", !!moved && !!moved.href && decodeURI(moved.href).endsWith("link_folder/人物/亞伯拉罕"), JSON.stringify(moved))
check("〈我的筆記〉：找不到的條目書籤標示「可能已改名或刪除」、沒有連結", !!missing && missing.text.includes("（條目可能已改名或刪除）") && missing.href === null, JSON.stringify(missing))

// ---- F4b：條目頁認得舊書籤並改到新網址 ----
await go(abraham)
await sleep(1500)
const btn = await ev(`document.querySelector('.bwz-node-bookmark')?.textContent ?? null`)
check("條目頁：舊網址的書籤顯示成「已加入書籤」", btn === "🔖 已加入書籤", btn)
// 擋掉連結索引再進來一次：還是已加入書籤，代表紀錄已經改到新網址（不是每次靠比對）
await send("Network.enable")
await send("Network.setBlockedURLs", { urls: ["*links.json*"] })
await go(abraham)
await sleep(800)
const btn2 = await ev(`document.querySelector('.bwz-node-bookmark')?.textContent ?? null`)
check("條目頁：書籤紀錄已改成新網址（擋掉連結索引仍認得）", btn2 === "🔖 已加入書籤", btn2)
await send("Network.setBlockedURLs", { urls: [] })

// ---- F5：條目頁寫筆記 ----
await go(abraham)
const panel = await J(`(() => { const p = document.querySelector('[data-bwz-notes="node"] .bwz-n-entry-panel'); return { heading: p?.querySelector('.bwz-n-head h2')?.textContent ?? null, add: p?.querySelector('.bwz-n-toolbar button')?.textContent ?? null } })()`)
check("條目頁：有「我的筆記」面板與「＋ 寫一則關於〈亞伯拉罕〉的筆記」", !!panel.heading?.startsWith("我的筆記") && panel.add === "＋ 寫一則關於〈亞伯拉罕〉的筆記", JSON.stringify(panel))
await ev(clickText('[data-bwz-notes="node"] .bwz-n-toolbar button', "寫一則關於"))
await sleep(600)
const hasVerseInputs = await ev(`!!document.querySelector('[data-bwz-notes="node"] .bwz-n-card.editing input[type=number]')`)
check("條目筆記的編輯框沒有節數欄位", !hasVerseInputs)
await ev(setVal('[data-bwz-notes="node"] .bwz-n-card.editing textarea', "信心之父：見 [[以撒]]"))
await sleep(1200)
await ev(clickText('[data-bwz-notes="node"] .bwz-n-card.editing button', "完成"))
await sleep(800)
await send("Page.reload")
await sleep(4500)
const own = await J(`[...document.querySelectorAll('[data-bwz-notes="node"] .bwz-n-list .bwz-n-card .bwz-n-body')].map(e => e.innerText.trim())`)
check("條目筆記重新整理後還在", own.length === 1 && own[0].includes("信心之父"), JSON.stringify(own))

// ---- F5：我的相關筆記 ----
await sleep(1500)
const rel = await J(`(() => { const r = document.querySelector('.bwz-related'); if (!r) return null; const grp = (c) => [...r.querySelectorAll('.bwz-related-group.' + c + ' .bwz-related-card')].map(a => ({ place: a.querySelector('.bwz-related-place')?.textContent ?? '', href: a.getAttribute('href') })); return { hidden: r.hidden, heading: r.querySelector('.bwz-related-heading')?.textContent ?? '', linked: grp('linked'), mentioned: grp('mentioned') } })()`)
check("相關筆記：「連到這個條目」一則（創世記 2 章）", !!rel && rel.linked.length === 1 && rel.linked[0].place.includes("創世記") && rel.linked[0].place.includes("2"), JSON.stringify(rel?.linked))
check("相關筆記：「提到〈亞伯拉罕〉」兩則，條目筆記排最後", !!rel && rel.mentioned.length === 2 && rel.mentioned[0].place.includes("創世記") && rel.mentioned[1].place.startsWith("📚 大衛"), JSON.stringify(rel?.mentioned))
check("相關筆記：標題顯示合計 3 則；本條目自己的筆記與無關筆記不列", !!rel && rel.heading.includes("（3）"), rel?.heading)
await shot("entry-related")
// 點卡片 → 到那一章並捲到那則筆記
const target = rel?.linked[0]?.href ?? ""
await ev(`document.querySelector('.bwz-related-group.linked .bwz-related-card')?.click()`)
await sleep(5000)
const landed = await J(`(() => { const id = location.hash.replace('#bwz-note-', ''); const c = document.querySelector('[data-note-id="' + id + '"]'); const r = c?.getBoundingClientRect(); return { path: decodeURI(location.pathname), hash: location.hash, inView: !!r && r.top >= 0 && r.top < innerHeight } })()`)
check("點相關筆記：到創世記 2 章並捲到那一則", landed.path.endsWith("第2章") && landed.hash.startsWith("#bwz-note-") && landed.inView && target.includes("#bwz-note-"), JSON.stringify(landed))

// ---- F5：SPA 換頁到〈大衛〉：只有大衛的筆記 ----
await go(abraham)
await ev(`(() => { const a = document.createElement('a'); a.href = location.pathname.replace(/[^/]+$/, encodeURIComponent('大衛')); a.textContent = 'go'; document.querySelector('article').append(a); a.click() })()`)
await sleep(4000)
const dv = await J(`(() => ({ path: decodeURI(location.pathname), own: [...document.querySelectorAll('[data-bwz-notes="node"] .bwz-n-list .bwz-n-card .bwz-n-body')].map(e => e.innerText.trim()), panels: document.querySelectorAll('.bwz-n-entry-panel').length }))()`)
check("SPA 換頁到〈大衛〉：只顯示大衛的條目筆記、面板只有一個", dv.path.endsWith("大衛") && dv.own.length === 1 && dv.own[0].includes("大衛之約") && dv.panels === 1, JSON.stringify(dv))

// ---- F5：〈我的筆記〉有「知識庫條目」組 ----
await go("/my-notes")
await ev(clickText(".bwz-shell-tab", "筆記"))
await sleep(500)
const groups = await J(`[...document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] summary')].map(s => s.textContent.trim())`)
check("〈我的筆記〉筆記分頁有「知識庫條目」組", groups.some((g) => g.includes("知識庫條目")), JSON.stringify(groups))

// ---- 手機 ----
await setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await go(abraham)
await sleep(1500)
const mob = await J(`(() => { const cards = [...document.querySelectorAll('.bwz-related-card')].map(a => Math.round(a.getBoundingClientRect().height)); const add = document.querySelector('[data-bwz-notes="node"] .bwz-n-toolbar button')?.getBoundingClientRect().height ?? 0; return { scroll: document.documentElement.scrollWidth <= innerWidth, cards, add: Math.round(add) } })()`)
check("手機：不左右捲、相關筆記卡片與寫筆記按鈕至少 44px", mob.scroll && mob.cards.length > 0 && mob.cards.every((h) => h >= 44) && mob.add >= 44, JSON.stringify(mob))
await shot("entry-mobile")
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
await finish()
