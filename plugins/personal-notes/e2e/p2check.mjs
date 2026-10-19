// Phase 2 功能的瀏覽器檢查（連結、標籤、經節、畫重點、書籤、Markdown 匯出）。
// 用法：node e2e/p2check.mjs <siteRoot> <profile> [only]
//   only  選填，只跑指定段落：含 "2" 或 "3" 跑第 2、3 項；含 "5" 或 "6" 跑第 5、6 項；含 "4" 跑第 4 項。省略則全部跑。
import { startBrowser, ch1, setVal, clickText, selectIn, toolbarButtons } from "./lib.mjs"

const [root, profile, only = ""] = process.argv.slice(2)
const s = await startBrowser({ root, profile })
const { ev, check, go, send, errors, newNote, setViewport, sleep, finish } = s

if (!only || only.includes("2") || only.includes("3")) {
  // ---------- 第 2、3 項 ----------
  const li = await (await fetch(root + "/static/personal-notes/links.json")).json().catch(() => null)
  check("建置有輸出連結索引 links.json", li && li.v === 1 && li.pages.some((p) => p.t === "人的尊嚴"), li ? `${li.pages.length} 頁` : "")
  await go(ch1 + "?skip=1")
  await newNote("## 觀察\n**重點**：看[[人的尊嚴]]，還有[[沒有這個條目]]。\n- 第一點\n- 第二點\n<img src=x onerror=alert(1)>")
  check("C9：未登入時存檔後顯示「已儲存在這台裝置」", (await ev(`document.querySelector('.bwz-n-card.editing .bwz-n-card-actions .bwz-n-muted')?.textContent`)) === "已儲存在這台裝置")
  await ev(clickText(".bwz-n-card.editing button", "完成"))
  await sleep(2500)
  const md = JSON.parse(await ev(`(() => { const b = [...document.querySelectorAll('.bwz-notes .bwz-n-md')].find(x => x.textContent.includes('第一點')); if (!b) return 'null'; const a = b.querySelector('a.bwz-n-wiki'); return JSON.stringify({ h: !!b.querySelector('h4'), strong: b.querySelector('strong')?.textContent, li: b.querySelectorAll('li').length, href: a ? decodeURIComponent(a.getAttribute('href')) : null, missing: b.querySelector('.bwz-n-wiki.missing')?.textContent, img: b.querySelectorAll('img').length, text: b.textContent.includes('<img') }) })()`))
  check("C5：Markdown 顯示（標題、粗體、清單）", md && md.h && md.strong === "重點" && md.li === 2, JSON.stringify(md))
  check("C6：[[人的尊嚴]] 變成站內連結", md && md.href && md.href.endsWith("link_folder/主題/人的尊嚴"), md?.href)
  check("C6：找不到的條目用虛線提示，不是連結", md && md.missing === "沒有這個條目")
  check("安全：HTML 標籤只當文字顯示（沒有 img）", md && md.img === 0 && md.text)
  // 自動完成
  await ev(clickText(".bwz-notes button", "新增筆記"))
  await sleep(600)
  await ev(setVal(".bwz-n-card.editing textarea", "參考 [[人的"))
  await sleep(1500)
  const opts = await ev(`[...document.querySelectorAll('.bwz-n-complete:not([hidden]) li')].map(l => l.textContent)`)
  check("C6：輸入 [[人的 跳出條目候選", Array.isArray(opts) && opts.includes("人的尊嚴"), JSON.stringify(opts))
  const idx = Array.isArray(opts) ? opts.indexOf("人的尊嚴") : -1
  for (let i = 0; i < idx; i++) await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 })
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 })
  await sleep(300)
  check("C6：按 Enter 帶入 [[人的尊嚴]]", (await ev(`document.querySelector('.bwz-n-card.editing textarea').value`)) === "參考 [[人的尊嚴]]", await ev(`document.querySelector('.bwz-n-card.editing textarea').value`))
  await sleep(900)
  await ev(clickText(".bwz-n-card.editing button", "完成"))
  await sleep(800)
  // 標籤
  await newNote("有標籤的筆記", setVal(".bwz-n-card.editing input[aria-label=標籤]", "禱告 信心"))
  await ev(clickText(".bwz-n-card.editing button", "完成"))
  await sleep(800)
  // 我的筆記頁
  await go("/my-notes")
  const tagChips = await ev(`[...document.querySelectorAll('.bwz-n-tag-filter button')].map(b => b.textContent)`)
  check("C5：我的筆記頁列出標籤與筆數", Array.isArray(tagChips) && tagChips.some((t) => t.startsWith("#禱告")), JSON.stringify(tagChips))
  await ev(`[...document.querySelectorAll('.bwz-n-tag-filter button')].find(b => b.textContent.startsWith('#禱告')).click()`)
  await sleep(300)
  const afterTag = await ev(`document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] .bwz-lib-card').length`)
  check("C5：點標籤只顯示有那個標籤的筆記", afterTag === 1, `${afterTag} 則；搜尋框＝${await ev(`document.querySelector('.bwz-shell-search').value`)}`)
  await ev(setVal(".bwz-shell-search", "重點 第一點"))
  await sleep(300)
  check("C5：多個詞同時符合（AND）", (await ev(`document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] .bwz-lib-card').length`)) === 1)
  await ev(setVal(".bwz-shell-search", "重點 不存在的字"))
  await sleep(300)
  check("C5：任一個詞不符合就不顯示", (await ev(`document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] .bwz-lib-card').length`)) === 0)
  await ev(setVal(".bwz-shell-search", ""))
  await sleep(300)
  check("C6：我的筆記頁的 [[條目]] 也是連結", await ev(`!![...document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] a.bwz-n-wiki')].length`))
  // C10：前往該章停在那一則
  const target = await ev(`(() => { const c = [...document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] .bwz-lib-card')].find(x => x.textContent.includes('有標籤的筆記')); const a = c.querySelector('.bwz-lib-card-foot a.bwz-n-link'); return a.getAttribute('href') })()`)
  await ev(`[...document.querySelectorAll('[aria-labelledby="bwz-tab-notes"] .bwz-lib-card')].find(x => x.textContent.includes('有標籤的筆記')).querySelector('.bwz-lib-card-foot a.bwz-n-link').click()`)
  for (let i = 0; i < 25 && !(await ev(`!!document.querySelector('.bwz-notes .bwz-n-flash')`)); i++) await sleep(150)
  const focus = JSON.parse(await ev(`(() => { const c = [...document.querySelectorAll('.bwz-notes .bwz-n-card')].find(x => x.textContent.includes('有標籤的筆記')); if (!c) return 'null'; const r = c.getBoundingClientRect(); return JSON.stringify({ top: Math.round(r.top), h: innerHeight, flash: c.classList.contains('bwz-n-flash') }) })()`))
  check("C10：從我的筆記點「前往該章編輯」，停在那一則並標示", focus && focus.top > 0 && focus.top < focus.h && focus.flash, `${decodeURIComponent(target)} ${JSON.stringify(focus)}`)
}

if (!only || only.includes("5") || only.includes("6")) {
  // ---------- 第 6 項：經節 ----------
  await go(ch1 + "?skip=1")
  const verses = JSON.parse(await ev(`JSON.stringify({ n: document.querySelectorAll('li[data-v]').length, v3: !!document.getElementById('v3') })`))
  check("C2：經文清單標上節數（li[data-v]、#v3）", verses.n >= 20 && verses.v3, JSON.stringify(verses))
  await ev(clickText(".bwz-notes button", "新增筆記"))
  await sleep(600)
  await ev(`(() => { const [a] = document.querySelectorAll('.bwz-n-card.editing input[type=number]'); a.value = '3'; a.dispatchEvent(new Event('input', {bubbles:true})) })()`)
  await ev(setVal(".bwz-n-card.editing textarea", "第三節的筆記"))
  await sleep(900)
  await ev(clickText(".bwz-n-card.editing button", "完成"))
  await sleep(800)
  check("C2：有筆記的經節後面出現 📝 標記", await ev(`!!document.querySelector('li[data-v="3"] .bwz-v-badge')`))
  await ev(`window.scrollTo(0, 0)`)
  await ev(`document.querySelector('li[data-v="3"] .bwz-v-badge').click()`)
  await sleep(300)
  check("C2：點 📝 標記跳到那則筆記", await ev(`!!document.querySelector('.bwz-notes .bwz-n-flash')`))
  // 選取經文 → 工具列
  const picked = await ev(selectIn(3, "要有光"))
  await sleep(700)
  const tb = await ev(toolbarButtons)
  check("C2／C3：選取經文時浮出工具列（畫重點／書籤／寫筆記）", Array.isArray(tb) && tb.some((t) => t.includes("畫重點")) && tb.some((t) => t.includes("寫筆記")), `選取「${picked}」→ ${JSON.stringify(tb)}`)
  await ev(clickText(".bwz-h-toolbar button", "寫筆記"))
  await sleep(1200)
  const composed = JSON.parse(await ev(`JSON.stringify({ v: document.querySelector('.bwz-n-card.editing input[type=number]')?.value, body: document.querySelector('.bwz-n-card.editing textarea')?.value })`))
  check("C2：「寫筆記」開新筆記並帶入節數與引文", composed.v === "3" && composed.body.startsWith("> 要有光"), JSON.stringify(composed))
  await ev(clickText(".bwz-n-card.editing button", "完成"))
  await sleep(500)
  // ---------- 第 5 項：畫重點 ----------
  await ev(selectIn(3, "要有光"))
  await sleep(700)
  await ev(clickText(".bwz-h-toolbar button", "畫重點"))
  await sleep(1200)
  check("C3：畫重點後經文標上螢光（只標選取的字）", (await ev(`[...document.querySelectorAll('li[data-v="3"] mark.bwz-hl')].map(m => m.textContent).join('')`)) === "要有光")
  await ev(selectIn(4, "神", 6, "神"))
  await sleep(700)
  await ev(clickText(".bwz-h-toolbar button", "畫重點"))
  await sleep(1200)
  const multi = await ev(`[4,5,6].map(v => !!document.querySelector('li[data-v="' + v + '"] mark.bwz-hl'))`)
  check("C3：跨三節選取 → 三節整節標上", JSON.stringify(multi) === "[true,true,true]", JSON.stringify(multi))
  check("C3：面板下方列出本章重點（2 個）", (await ev(`document.querySelector('.bwz-h-list summary')?.textContent`)) === "本章畫了 2 個重點")
  // 書籤
  await ev(clickText(".bwz-h-bar button", "書籤"))
  await sleep(1000)
  check("C3：把這一章加入書籤", (await ev(`document.querySelector('.bwz-h-bar button')?.textContent`)) === "🔖 已加入書籤")
  await ev(selectIn(10, "神"))
  await sleep(700)
  await ev(clickText(".bwz-h-toolbar button", "書籤"))
  await sleep(1000)
  // 點重點 → 移除
  await ev(`[...document.querySelectorAll('li[data-v="5"] mark.bwz-hl')].find(m => !m.closest('a')).click()`)
  await sleep(300)
  check("C3：點已畫的重點出現「移除這個重點」", JSON.stringify(await ev(toolbarButtons)).includes("移除這個重點"))
  await ev(clickText(".bwz-h-toolbar button", "移除這個重點"))
  await sleep(1200)
  check("C3：移除後那三節的螢光都消失", (await ev(`document.querySelectorAll('li[data-v="4"] mark.bwz-hl, li[data-v="5"] mark.bwz-hl, li[data-v="6"] mark.bwz-hl').length`)) === 0)
  // 重新整理後還在
  await send("Page.reload")
  await sleep(5000)
  check("C3：重新整理後重點與書籤都還在", (await ev(`[...document.querySelectorAll('li[data-v="3"] mark.bwz-hl')].map(m => m.textContent).join('')`)) === "要有光" && (await ev(`document.querySelector('.bwz-h-bar button')?.textContent`)) === "🔖 已加入書籤")
  // #v 跳到經節
  await go("/" + encodeURI("01-創世記/第2章"), 3500)
  await go(ch1 + "#v12", 300)
  let flashed = false
  for (let i = 0; i < 30 && !flashed; i++) { flashed = await ev(`!!document.querySelector('li[data-v="12"].bwz-v-flash')`); if (!flashed) await sleep(150) }
  check("C2：網址 #v12 會捲到第 12 節並標示", flashed)
  // SPA 換頁回來：不重複
  await ev(`window.spaNavigate(new URL('../01-創世記/第2章', location.href))`)
  await sleep(3000)
  check("C3：換到第 2 章時不殘留工具列與第 1 章的重點", (await ev(`document.querySelectorAll('.bwz-h-toolbar').length`)) === 1 && (await ev(`document.querySelectorAll('mark.bwz-hl').length`)) === 0)
  await ev(`history.back()`)
  await sleep(3000)
  check("C3：換頁回第 1 章，重點重新標上且只有一份", (await ev(`[...document.querySelectorAll('li[data-v="3"] mark.bwz-hl')].map(m => m.textContent).join('')`)) === "要有光" && (await ev(`document.querySelectorAll('.bwz-h-toolbar').length`)) === 1)
  // 我的筆記頁
  await go("/my-notes")
  // D-42 之後：書籤與重點是〈我的筆記〉的兩個分頁
  const page = JSON.parse(await ev(`JSON.stringify({ heads: [...document.querySelectorAll('.bwz-shell-tab')].map(x => x.textContent).filter(t => /^(書籤|重點)/.test(t)), links: [...document.querySelectorAll('.bwz-h-page a.bwz-lib-place')].map(a => decodeURIComponent(a.getAttribute('href'))) })`))
  check("C3：我的筆記頁列出書籤（2）與重點（1）", JSON.stringify(page.heads) === JSON.stringify(["重點1", "書籤2"]), JSON.stringify(page.heads))
  check("C3：清單連結回到該節（#v）", page.links.some((l) => l.endsWith("第1章#v10")) && page.links.some((l) => l.endsWith("第1章#v3")), JSON.stringify(page.links))
}

if (!only || only.includes("4")) {
  // ---------- 第 4 項：Markdown 匯出 ----------
  await go("/my-notes")
  await ev(`(() => { const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl = { name: this.download, href: this.href }; return } return orig.call(this) } })()`)
  await ev(`document.querySelector('.bwz-settings-btn').click()`)
  await sleep(400)
  await ev(clickText("button", "匯出 Markdown"))
  await sleep(800)
  const z = JSON.parse(await ev(`(async () => { const d = window.__dl; if (!d) return 'null'; const b = new Uint8Array(await (await fetch(d.href)).arrayBuffer()); const txt = new TextDecoder().decode(b); return JSON.stringify({ name: d.name, sig: [...b.slice(0, 4)].join(','), size: b.length, hasMd: txt.includes('.md') && txt.includes('聖經筆記/01 創世記/第1章/') }) })()`))
  check("C4：匯出 Markdown 產生 ZIP（含 聖經筆記/01 創世記/第1章/*.md）", z && z.name.endsWith(".zip") && z.sig === "80,75,3,4" && z.hasMd, JSON.stringify(z))
  check("C4：匯出後頁面留在我的筆記", (await ev(`location.pathname`)).endsWith("my-notes"))
}

check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
finish()
