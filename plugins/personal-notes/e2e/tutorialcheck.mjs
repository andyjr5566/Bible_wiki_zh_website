// 筆記操作教學（F7）的瀏覽器檢查：〈我的筆記〉的「▶ 筆記教學」、?tutorial=1、8 段動畫與「換你試試」、示範區不寫進真正的筆記、
// 鍵盤操作、減少動態效果、深色模式、手機；每段播完各截一張圖。
// 第 9 節起是手機版教學（D-51、F8）：觸控模擬、自動選手機版、8 段、鍵盤與把手與系統選單、電腦｜手機切換、
// 換你試試（真實選取＋觸控點按）、沙盒不寫真實筆記、減少動態效果、44px，最後換回電腦。
// 用法：node e2e/tutorialcheck.mjs <siteRoot> <profile> [shotDir]
import { startBrowser, ch1, clickText } from "./lib.mjs"

const [root, profile, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root, profile, shotDir })
const { ev, check, go, send, shot, errors, setViewport, sleep, finish } = s
const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))
const key = async (k, code, vk) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk })
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk })
}
const state = `(() => { const d = document.querySelector('.bwz-tut'); if (!d) return null; return { title: d.querySelector('.bwz-tut-title')?.textContent ?? '', dots: d.querySelectorAll('.bwz-tut-dot').length, active: [...d.querySelectorAll('.bwz-tut-dot')].findIndex(x => x.getAttribute('aria-current') === 'step' || x.classList.contains('on') || x.getAttribute('aria-pressed') === 'true'), mode: d.dataset.mode ?? '', tryShown: d.dataset.mode === 'try' } })()`
const records = `(async () => { const t = document.querySelector('.bwz-shell-summary')?.textContent ?? ''; return t })()`

// 無頭 Chrome 預設回報「減少動態效果」，先明確設成一般動態，才會真的播動畫
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] })
// 先寫一則真的筆記，之後確認教學不會改到真正的資料
await go(ch1 + "?skip=1")
await ev(clickText(".bwz-notes button", "新增筆記"))
await sleep(600)
await ev(`(() => { const t = document.querySelector('.bwz-n-card.editing textarea'); t.value = '真的筆記'; t.dispatchEvent(new Event('input', { bubbles: true })) })()`)
await sleep(1200)
await ev(clickText(".bwz-notes .bwz-n-card.editing button", "完成"))
await sleep(800)

// 1. 〈我的筆記〉有按鈕；?tutorial=1 自動打開並拿掉參數
await go("/my-notes")
const before = await ev(records)
const btn = await ev(`[...document.querySelectorAll('.bwz-shell-head button')].map(b => b.textContent.trim())`)
check("〈我的筆記〉上方有「▶ 筆記教學」（在「⚙ 設定與備份」旁）", Array.isArray(btn) && btn.includes("▶ 筆記教學") && btn.some((t) => t.includes("設定與備份")), JSON.stringify(btn))
await go("/my-notes?tutorial=1")
await sleep(800)
let st = await J(state)
check("?tutorial=1 自動打開教學、網址參數拿掉、先播動畫（demo）", !!st && st.mode === "demo" && !(await ev(`location.search.includes('tutorial')`)), JSON.stringify(st) + " " + (await ev("location.search")))
check("教學有 8 段", st?.dots === 8, st?.dots)

// 2. 逐段播放：每段播完出現「換你試試」，各截一張
const titles = []
for (let i = 0; i < 8; i++) {
  let done = false
  for (let k = 0; k < 40 && !done; k++) { await sleep(500); done = (await J(state))?.tryShown }
  st = await J(state)
  titles.push(`${st?.title}${done ? "" : "（沒出現換你試試）"}`)
  await shot(`tut-${i + 1}`)
  if (i < 7) { await key("ArrowRight", "ArrowRight", 39); await sleep(300) }
}
check("8 段都播完並出現「換你試試」", titles.length === 8 && titles.every((t) => !t.includes("沒出現")), titles.join("｜"))
// 換你試試：在示範區點東西不會出錯
await ev(`(() => { const f = document.querySelector('.bwz-tut-frame'); [...f.querySelectorAll('button')].slice(0, 6).forEach(b => b.click()) })()`)
await sleep(600)
// 3. 鍵盤：← 回上一段、Esc 關閉、焦點回到按鈕
await key("ArrowLeft", "ArrowLeft", 37)
await sleep(300)
const back = await J(state)
await key("Escape", "Escape", 27)
await sleep(500)
const closed = await J(`({ open: !!document.querySelector('.bwz-tut'), focus: document.activeElement?.textContent?.trim() ?? '' })`)
check("← 回上一段、Esc 關閉教學", back?.title !== titles[7] && !closed.open, `${back?.title} ${JSON.stringify(closed)}`)
// 4. 示範區沒有寫進真正的筆記
await go("/my-notes")
const after = await ev(records)
check("看完教學並在示範區點過按鈕：真正的筆記數量不變", before === after && before.includes("1"), `${before} → ${after}`)
// 5. 從按鈕打開，焦點在對話框內；關閉後焦點回到按鈕
await ev(clickText(".bwz-shell-head button", "筆記教學"))
await sleep(600)
const inDialog = await ev(`!!document.activeElement?.closest('.bwz-tut')`)
await ev(`document.querySelector('.bwz-tut-close').click()`)
await sleep(400)
const focusBack = await ev(`document.activeElement?.textContent?.trim() ?? ''`)
check("按鈕打開：焦點在教學裡；關閉後回到「▶ 筆記教學」", inDialog && focusBack === "▶ 筆記教學", `${inDialog} ${focusBack}`)
// 6. 減少動態效果：顯示最後畫面與步驟清單
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] })
await go("/my-notes?tutorial=1")
await sleep(800)
const reduced = await J(`(() => { const d = document.querySelector('.bwz-tut'); const steps = d?.querySelectorAll('.bwz-tut-steps li').length ?? 0; return { reduced: d?.classList.contains('reduced') ?? false, steps, hand: !!d?.querySelector('.bwz-tut-hand:not([hidden])') && getComputedStyle(d.querySelector('.bwz-tut-hand')).display !== 'none' } })()`)
check("減少動態效果：不播動畫，改顯示步驟清單", reduced.reduced && reduced.steps >= 2, JSON.stringify(reduced))
await shot("tut-reduced")
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] })
// 7. 深色模式截圖
await ev(`localStorage.setItem('theme', 'dark')`)
await go("/my-notes?tutorial=1")
await ev(`document.documentElement.setAttribute('saved-theme', 'dark')`)
await sleep(9000)
await shot("tut-dark")
await ev(`document.querySelector('.bwz-tut-close')?.click(); localStorage.setItem('theme', 'light'); document.documentElement.setAttribute('saved-theme', 'light')`)
// 8. 手機
await setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await go("/my-notes?tutorial=1")
await sleep(9000)
const mob = await J(`(() => { const d = document.querySelector('.bwz-tut'); const btns = [...d.querySelectorAll('.bwz-tut-btn, .bwz-tut-close')].map(b => Math.round(b.getBoundingClientRect().height)); return { scroll: document.documentElement.scrollWidth <= innerWidth && d.scrollWidth <= innerWidth + 1, btns } })()`)
check("手機：不左右捲、教學的按鈕至少 44px", mob.scroll && mob.btns.length > 0 && mob.btns.every((h) => h >= 44), JSON.stringify(mob))
await shot("tut-mobile")
// ===== 9. 手機版教學（D-51，14 §4）：觸控模擬、不帶 device 參數，看自動選擇、8 段、切換、換你試試（真實選取）、沙盒、無障礙 =====
// 9.0 共用的小工具
const probe = `(() => { const d = document.querySelector('.bwz-tut'); if (!d) return null
  const ph = d.querySelector('.bwz-tut-phrase.sel'); const tb = d.querySelector('.bwz-tut-toolbar')
  return { mode: d.dataset.mode ?? '', device: d.dataset.device ?? '', title: d.querySelector('.bwz-tut-title')?.textContent ?? '',
    kbd: !!d.querySelector('.bwz-tut-kbd'), handles: d.querySelectorAll('.bwz-tut-handle').length, sys: !!d.querySelector('.bwz-tut-sysmenu'), tb: !!tb,
    below: ph && tb ? tb.getBoundingClientRect().top >= ph.getBoundingClientRect().bottom - 1 : null,
    finger: !!d.querySelector('.bwz-tut-cursor.finger'), arrow: !!d.querySelector('.bwz-tut-cursor:not(.finger)') } })()`
const frameInfo = `(() => { const d = document.querySelector('.bwz-tut'); const f = d.querySelector('.bwz-tut-frame').getBoundingClientRect(); return { fw: Math.round(f.width), vw: innerWidth, coarse: matchMedia('(pointer: coarse)').matches, device: d.dataset.device } })()`
// 看一段播到「換你試試」為止，記下途中出現過的東西（鍵盤、把手、系統選單、工具列在選取下方）
const watchScene = async (shotName = null, maxMs = 80000) => {
  const seen = { kbd: false, handles: 0, sys: false, below: false, finger: false, arrow: false, mode: "", title: "" }
  let shotted = false
  for (const t0 = Date.now(); Date.now() - t0 < maxMs; await sleep(120)) {
    const p = await J(probe)
    if (!p) break
    seen.kbd ||= p.kbd; seen.handles = Math.max(seen.handles, p.handles); seen.sys ||= p.sys; seen.below ||= p.below === true
    seen.finger ||= p.finger; seen.arrow ||= p.arrow; seen.mode = p.mode; seen.title = p.title
    if (shotName && !shotted && p.sys && p.handles >= 2 && p.tb) { shotted = true; await sleep(300); await shot(shotName) }
    if (p.mode === "try") break
  }
  return seen
}
const tap = async (x, y) => {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
  await sleep(70)
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}
const centerOf = (sel) => J(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
// 在某個元素的第一個文字節點裡建立真實選取（等同讀者長按拉出的選取範圍）
const selectIn = (sel, from = 0, to = -1) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); const n = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(); const r = document.createRange(); r.setStart(n, ${from}); r.setEnd(n, ${to} < 0 ? n.length : ${to}); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString() })()`
const setTheme = (t) => `localStorage.setItem('theme', '${t}'); document.documentElement.setAttribute('saved-theme', '${t}')`
const dialogBtns = `[...document.querySelectorAll('.bwz-tut .bwz-tut-btn, .bwz-tut .bwz-tut-close, .bwz-tut .bwz-tut-radio, .bwz-tut .bwz-tut-skip')].filter((b) => b.offsetParent !== null).map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)])`

await ev(setTheme("light"))
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] })
await ev(`localStorage.removeItem('bwz-tutorial-device'); localStorage.setItem('bwz-tutorial-scene', 'write')`)
// 9.1 真正的筆記數量（觸控模擬下看〈我的筆記〉），稍後關掉教學再比一次
await go("/my-notes")
const beforePhone = await ev(records)
// 9.2 不帶 device 參數打開：自動是手機版、示範區撐滿寬度、是手指不是箭頭
await go("/my-notes?tutorial=1")
await sleep(500)
let fi = await J(frameInfo)
check("手機：觸控模擬下 (pointer: coarse) 成立，不帶 device 參數就自動是手機版", fi.coarse && fi.device === "touch", JSON.stringify(fi))
check("手機：示範區寬度撐滿（至少視窗寬度的 95%）", fi.fw >= fi.vw * 0.95, `${fi.fw}/${fi.vw}`)
const titles9 = []
const seenAll = []
for (let i = 0; i < 8; i++) {
  const seen = await watchScene(i === 1 ? "tutp-2-demo" : null)
  seenAll.push(seen)
  titles9.push(`${seen.title}:${seen.mode}`)
  await shot(`tutp-${i + 1}`)
  if (i === 0) check("手機：示範用手指圓點、不是箭頭", seen.finger && !seen.arrow, JSON.stringify(seen))
  if (i < 7) { await ev(`document.querySelector('.bwz-tut-btn.primary').click()`); await sleep(200) }
}
check("手機：8 段都播到「換你試試」、沒有 JavaScript 例外", titles9.every((t) => t.endsWith(":try")) && errors.length === 0, titles9.join("｜") + " " + errors.slice(0, 2).join(" | "))
check("手機：第 1 段（寫整章筆記）打字時鍵盤升起", seenAll[0].kbd, JSON.stringify(seenAll[0]))
// 第 1 段重播，確認「完成」之後鍵盤收起
await ev(`document.querySelectorAll('.bwz-tut-dot')[0].click()`)
await sleep(300)
const kbdLog = { up: false, downAfterUp: false, kbdInTry: null }
for (const t0 = Date.now(); Date.now() - t0 < 60000; await sleep(100)) {
  const p = await J(probe)
  if (p.kbd) kbdLog.up = true
  else if (kbdLog.up) kbdLog.downAfterUp = true
  if (p.mode === "try") { kbdLog.kbdInTry = p.kbd; break }
}
check("手機：第 1 段按「完成」之後鍵盤收起（換你試試時也沒有畫假鍵盤）", kbdLog.up && kbdLog.downAfterUp && kbdLog.kbdInTry === false, JSON.stringify(kbdLog))
const s2 = seenAll[1]
check("手機：第 2 段（選經文）示範有選取把手（2 個）、手機自己的系統選單、工具列在選取範圍下方", s2.handles >= 2 && s2.sys && s2.below, JSON.stringify(s2))
check("手機：第 1 段（沒有選字）沒有把手與系統選單", seenAll[0].handles === 0 && !seenAll[0].sys)

// 9.3 切換「電腦｜手機」
await ev(`document.querySelectorAll('.bwz-tut-dot')[1].click()`)
await sleep(400)
const t2 = (await J(probe)).title
await ev(`[...document.querySelectorAll('.bwz-tut-radio')].find((b) => b.textContent === '電腦').click()`)
await sleep(600)
let p9 = await J(probe)
check("切換：按「電腦」→ 同一段的電腦版（箭頭、不是手指）", p9.device === "desktop" && p9.title === t2 && p9.mode === "demo", JSON.stringify(p9))
check("切換：選擇記在這台裝置（localStorage）", (await ev(`localStorage.getItem('bwz-tutorial-device')`)) === "desktop")
await ev(`document.querySelector('.bwz-tut-close').click()`)
await go("/my-notes?tutorial=1")
await sleep(600)
p9 = await J(probe)
check("切換：重新整理（不帶參數）→ 記住的電腦版", p9?.device === "desktop", JSON.stringify(p9))
await ev(`document.querySelector('.bwz-tut-close').click()`)
await go("/my-notes?tutorial=1&device=touch")
await sleep(600)
p9 = await J(probe)
check("切換：?device=touch 蓋過記住的選擇", p9?.device === "touch", JSON.stringify(p9))
await ev(`document.querySelector('.bwz-tut-radio[aria-checked="true"]').focus()`)
await key("ArrowLeft", "ArrowLeft", 37)
await sleep(500)
p9 = await J(probe)
const left = p9?.device
const leftTitle = p9?.title
await key("ArrowRight", "ArrowRight", 39)
await sleep(500)
p9 = await J(probe)
check("切換：「電腦｜手機」上按 ←→ 在兩個選項間移動（←＝電腦、→＝手機），停在同一段", left === "desktop" && p9?.device === "touch" && p9.title === leftTitle, `${left} ${JSON.stringify(p9)}`)
await ev(`document.querySelector('.bwz-tut-close').click()`)

// 9.4 手機版「換你試試」：真實選取 + 工具列在下方 + 點按鈕；點虛線字備案
await ev(`localStorage.setItem('bwz-tutorial-scene', 'select')`)
await go("/my-notes?tutorial=1&device=touch")
await sleep(400)
await ev(`document.querySelector('.bwz-tut-skip').click()`)
await sleep(600)
p9 = await J(probe)
check("手機換你試試：第 2 段進入 try 模式、沒有手指、沒有假系統選單與把手、沒有假鍵盤", p9.mode === "try" && p9.title === "選經文" && !p9.finger && !p9.arrow && !p9.sys && p9.handles === 0 && !p9.kbd, JSON.stringify(p9))
const us = await J(`(() => { const v = document.querySelector('.bwz-tut-canvas.try .bwz-tut-vt'); const c = getComputedStyle(v); return { us: c.userSelect, wus: c.webkitUserSelect, callout: c.webkitTouchCallout ?? '' } })()`)
check("手機換你試試：經文可以選取（user-select: text、不擋長按選單）", us.us === "text" && us.callout !== "none", JSON.stringify(us))
// 先選一段沒有虛線的字：不該出現工具列
await ev(selectIn('.bwz-tut-canvas.try li[data-v="2"] .bwz-tut-vt', 0, 6))
await sleep(600)
check("手機換你試試：選到沒有虛線的字，不跳工具列", !(await J(probe)).tb)
// 真實選取蓋住虛線字（神說：「要有光」）
const picked = await ev(selectIn('.bwz-tut-canvas.try .bwz-tut-phrase[data-t="sel"]'))
await sleep(700)
const hit = await J(`(() => { const tb = document.querySelector('.bwz-tut-canvas.try .bwz-tut-toolbar'); const sel = getSelection(); const r = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null; const t = tb?.getBoundingClientRect(); return { tb: !!tb, below: !!(t && r && t.top >= r.bottom), gap: t && r ? Math.round(t.top - r.bottom) : null, kept: sel.toString(), sys: !!document.querySelector('.bwz-tut-sysmenu'), handles: document.querySelectorAll('.bwz-tut-handle').length, inView: !!t && t.bottom <= innerHeight && t.left >= 0 && t.right <= innerWidth } })()`)
check("手機換你試試：真實選取蓋到虛線字 → 工具列出現在選取範圍下方（沒有蓋住字、在畫面內）", hit.tb && hit.below && hit.inView, JSON.stringify(hit))
check("手機換你試試：真實選取沒被取消（選到的字還在）、不畫假把手與假系統選單", hit.kept === picked && picked.length > 0 && !hit.sys && hit.handles === 0, JSON.stringify(hit) + " " + picked)
await shot("tutp-try-selection-light")
await ev(setTheme("dark"))
await sleep(500)
await shot("tutp-try-selection-dark")
await ev(setTheme("light"))
await sleep(300)
const hl = await centerOf('.bwz-tut-canvas.try .bwz-tut-toolbar [data-t="hl"]')
await tap(hl.x, hl.y)
await sleep(600)
const marks = await J(`({ mark: !!document.querySelector('.bwz-tut-canvas.try mark.bwz-tut-hl[data-t="sel"]'), tb: !!document.querySelector('.bwz-tut-toolbar') })`)
check("手機換你試試：用觸控點「🖍 畫重點」→ 那段字畫上螢光筆、工具列收起", marks.mark && !marks.tb, JSON.stringify(marks))
// 備案：直接點虛線字（第一節 起初，神創造天地）
const ph2 = await centerOf('.bwz-tut-canvas.try .bwz-tut-phrase[data-t="sel2"]')
await tap(ph2.x, ph2.y)
await sleep(500)
check("手機換你試試：直接點虛線字（備案）也會跳出工具列", (await J(probe)).tb)
const bm = await centerOf('.bwz-tut-canvas.try .bwz-tut-toolbar [data-t="bm"]')
await tap(bm.x, bm.y)
await sleep(500)
check("手機換你試試：點「🔖 書籤」有反應（經文前出現書籤）", await ev(`!!document.querySelector('.bwz-tut-canvas.try .bwz-tut-ribbon')`))
await shot("tutp-try-after")
// 換到別段之後，真實選取不能再觸發舊示範區（監看已停止）
await ev(`document.querySelectorAll('.bwz-tut-dot')[0].click()`)
await sleep(300)
await ev(selectIn('.bwz-tut-canvas .bwz-tut-vt'))
await sleep(500)
check("手機換你試試：換段之後在別的畫面選字不會冒出舊的工具列", !(await ev(`!!document.querySelector('.bwz-tut-toolbar')`)))

// 9.5 沙盒：關掉教學，真正的筆記沒有變動
await key("Escape", "Escape", 27)
await sleep(500)
await go("/my-notes")
const afterPhone = await ev(records)
check("手機：看完教學、在示範頁選字與點按鈕之後，真正的筆記數量不變", beforePhone === afterPhone && afterPhone.includes("1") && afterPhone === before, `${beforePhone} → ${afterPhone}（電腦版開頭 ${before}）`)

// 9.6 無障礙：按鈕 ≥44px、不左右捲；減少動態效果
await ev(`localStorage.setItem('bwz-tutorial-scene', 'select')`)
await go("/my-notes?tutorial=1&device=touch")
await sleep(1500)
const a11y = await J(`({ scroll: document.documentElement.scrollWidth <= innerWidth && document.querySelector('.bwz-tut').scrollWidth <= innerWidth + 1, btns: ${dialogBtns} })`)
check("手機：不左右捲、標題列的「電腦｜手機」與所有教學按鈕至少 44px", a11y.scroll && a11y.btns.length >= 6 && a11y.btns.every(([, hgt]) => hgt >= 44), JSON.stringify(a11y))
await shot("tutp-light")
await ev(`document.querySelector('.bwz-tut-close').click()`)
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] })
await ev(`localStorage.setItem('bwz-tutorial-scene', 'write')`)
await go("/my-notes?tutorial=1")
await sleep(1200)
const rd = await J(`(() => { const d = document.querySelector('.bwz-tut'); return { device: d.dataset.device, reduced: d.classList.contains('reduced'), mode: d.dataset.mode, steps: d.querySelectorAll('.bwz-tut-steps li').length, stepsShown: getComputedStyle(d.querySelector('.bwz-tut-steps')).display !== 'none', kbd: !!d.querySelector('.bwz-tut-kbd'), cursor: !!d.querySelector('.bwz-tut-cursor') } })()`)
check("手機＋減少動態效果：不播動畫，直接顯示最後畫面與步驟清單，沒有鍵盤與手指", rd.device === "touch" && rd.reduced && rd.mode === "still" && rd.steps >= 2 && rd.stepsShown && !rd.kbd && !rd.cursor, JSON.stringify(rd))
await shot("tutp-reduced")
await ev(`document.querySelector('.bwz-tut-close').click()`)
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] })

// 9.7 換回電腦：關掉觸控模擬＋電腦視窗尺寸；清掉記住的選擇，重新打開自動是電腦版
await send("Emulation.setTouchEmulationEnabled", { enabled: false })
await setViewport(1280, 900, { dpr: 1, mobile: false })
await ev(`localStorage.removeItem('bwz-tutorial-device'); localStorage.setItem('bwz-tutorial-scene', 'select')`)
await go("/my-notes?tutorial=1")
await sleep(800)
p9 = await J(probe)
fi = await J(frameInfo)
check("電腦：關掉觸控模擬、清掉記住的選擇後重新打開 → 自動是電腦版（箭頭游標）", !fi.coarse && p9?.device === "desktop" && p9.arrow && !p9.finger, JSON.stringify([fi, p9]))
await shot("tutp-back-desktop")
await ev(`document.querySelector('.bwz-tut-close')?.click()`)
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
await finish()
