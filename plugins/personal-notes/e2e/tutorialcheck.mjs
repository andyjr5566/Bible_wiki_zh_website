// 筆記操作教學（F7）的瀏覽器檢查：〈我的筆記〉的「▶ 筆記教學」、?tutorial=1、8 段動畫與「換你試試」、示範區不寫進真正的筆記、
// 鍵盤操作、減少動態效果、深色模式、手機；每段播完各截一張圖。
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
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
await finish()
