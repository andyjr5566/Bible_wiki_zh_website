// 導覽的「個人筆記」相關站：
//   notes（框住筆記面板）→ notes-entry（框住左上筆記本圖示、換讀者點）→ mynotes（我的筆記頁）→ 回第 12 章接 maps。
//   另檢查舊進度（沒有 v、step 指向舊的 maps）會搬到新的 maps，以及圖示不在時不擋路。電腦與手機各跑一次。
// 用法：node e2e/tourcheck.mjs <siteRoot> <profile> <shotFile>
//   profile   Chrome user-data-dir（絕對路徑）；電腦用 <profile>-desktop、手機用 <profile>-phone
//   shotFile  電腦截圖的檔案路徑（.png）；其他截圖是同名加 -entry、-mynotes、-phone、-phone-entry、-phone-mynotes
//   環境變數 DELAY_APP=毫秒：模擬線上網路較慢，筆記 App 晚一點才載入。
//   需要完整內容（第 12 章），test_content 沒有。
//   這支腳本會分別啟動電腦與手機兩個子程序（環境變數 TOUR_VIEW=desktop|phone），任何一個失敗就以 1 結束。
import { spawnSync } from "node:child_process"
import { startBrowser, sleep } from "./lib.mjs"

const [root, profile, shotPath] = process.argv.slice(2)
const view = process.env.TOUR_VIEW

if (!view) {
  let code = 0
  for (const v of ["desktop", "phone"]) {
    const r = spawnSync(process.execPath, [process.argv[1], root, profile, shotPath], { stdio: "inherit", env: { ...process.env, TOUR_VIEW: v } })
    if (r.status !== 0) code = 1
  }
  process.exit(code)
}

const phone = view === "phone"
const delay = Number(process.env.DELAY_APP || 0)
const shotOf = (suffix) => shotPath.replace(/\.png$/i, `${suffix}.png`)
const ch12 = root + "/" + encodeURI("02-出埃及記/第12章")
const NOTES_STEP = 14 // 舊版與新版 notes 的索引相同；maps 舊 15、新 17
const tag = phone ? "手機" : "電腦"
const shots = phone
  ? { notes: shotOf("-phone"), entry: shotOf("-phone-entry"), mynotes: shotOf("-phone-mynotes") }
  : { notes: shotPath, entry: shotOf("-entry"), mynotes: shotOf("-mynotes") }

const INFO = `JSON.stringify((() => {
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, w: r.width, h: r.height } }
  const b = document.querySelector('.bwz-bubble')
  return {
    slug: document.body.dataset.slug,
    step: b?.dataset.step,
    title: b?.querySelector('h3')?.textContent,
    hole: rect(document.querySelector('.bwz-hole')),
    bubble: rect(b),
    icon: rect([...document.querySelectorAll('a.bwz-notes-entry')].find((e) => e.getClientRects().length)),
    panel: rect(document.querySelector('.bwz-notes .bwz-n-head')),
    shellHead: rect(document.querySelector('.bwz-shell .bwz-shell-head')),
    tutBtn: rect(document.querySelector('.bwz-shell [data-action="tutorial"]')),
    btns: [...document.querySelectorAll('.bwz-bubble .bwz-btn')].map((x) => ({ t: x.textContent.trim(), h: x.getBoundingClientRect().height, tt: x.dataset.t })),
    saved: JSON.parse(localStorage.getItem('bwz-tour-v2') || 'null'),
  }
})())`

const contains = (hole, r, slack = 2) => !!hole && !!r && hole.top <= r.top + slack && hole.left <= r.left + slack && hole.bottom >= r.bottom - slack && hole.right >= r.right - slack
const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

const viewOpts = phone ? { width: 390, height: 844, mobile: true } : {}
const s = await startBrowser({ root, profile: `${profile}-${view}`, ...viewOpts })
const { ev, send, check, saveShot } = s
const info = async () => JSON.parse(await ev(INFO))
const tap = async (r) => {
  const x = (r.left + r.right) / 2
  const y = (r.top + r.bottom) / 2
  if (phone) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  } else {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
  }
}
const loadAt = async (state, wait = 6500) => {
  await send("Page.navigate", { url: ch12 })
  await sleep(3000)
  await ev(`localStorage.setItem('bwz-tour-v2', ${JSON.stringify(JSON.stringify(state))})`)
  await send("Page.reload", { ignoreCache: true })
  await sleep(wait)
}
if (delay) {
  s.on("Fetch.requestPaused", (m) => setTimeout(() => send("Fetch.continueRequest", { requestId: m.params.requestId }), delay))
  await send("Fetch.enable", { patterns: [{ urlPattern: "*personal-notes/app.js*", requestStage: "Request" }] })
}

// ---- notes 站 ----
await loadAt({ status: "active", step: NOTES_STEP, skills: [], skipped: [] })
let i = await info()
check(`[${tag}] 導覽停在「個人筆記」這一站`, i.step === "notes" && String(i.title).includes("寫下你自己的筆記"), JSON.stringify({ step: i.step, title: i.title }))
check(`[${tag}] 框起來的位置包含筆記面板標題`, i.hole && i.panel && i.hole.top <= i.panel.top + 2 && i.hole.bottom >= i.panel.bottom - 2, JSON.stringify({ hole: i.hole, panel: i.panel }))
const noteText = await ev(`document.querySelector('.bwz-bubble .bwz-text')?.innerText ?? ''`)
check(`[${tag}] notes 站文字不再提「左上角」，仍有「看筆記教學」`, !noteText.includes("左上角") && noteText.includes("同一份") && noteText.includes("看筆記教學"), noteText)
await saveShot(shots.notes)

// ---- (a) 下一步 → notes-entry，聚光圈包含圖示 ----
await ev(`document.querySelector('.bwz-bubble [data-t=next]').click()`)
await sleep(2500)
i = await info()
check(`[${tag}] (a) 下一步進到 notes-entry 站`, i.step === "notes-entry" && i.title === "所有筆記，都在這裡", JSON.stringify({ step: i.step, title: i.title }))
check(`[${tag}] (a) 聚光圈包含 a.bwz-notes-entry`, contains(i.hole, i.icon), JSON.stringify({ hole: i.hole, icon: i.icon }))
check(`[${tag}] 這一站換讀者操作（只有「跳過這步」，沒有「下一步」）`, i.btns.some((b) => b.tt === "skip") && !i.btns.some((b) => b.tt === "next"), JSON.stringify(i.btns))
const entryText = await ev(`document.querySelector('.bwz-bubble .bwz-text')?.innerText ?? ''`)
check(`[${tag}] notes-entry 文字正確且不含「左上角」`, entryText === "點這個筆記本圖示，打開〈我的筆記〉：每一章寫過的筆記、便條、重點、書籤都收在一起。", entryText)
check(`[${tag}] 泡泡沒有蓋住圖示`, !overlaps(i.bubble, i.icon), JSON.stringify({ bubble: i.bubble, icon: i.icon }))
if (phone) {
  check(`[${tag}] 按鈕高度 ≥ 44px`, i.btns.length > 0 && i.btns.every((b) => b.h >= 43.5), JSON.stringify(i.btns))
  check(`[${tag}] 泡泡不超出畫面左右`, i.bubble.left >= 0 && i.bubble.right <= 390.5, JSON.stringify(i.bubble))
}
await saveShot(shots.entry)

// ---- (b) 點圖示 → my-notes、mynotes 站 ----
await tap(i.icon)
await sleep(4500)
i = await info()
check(`[${tag}] (b) 點圖示後進到 my-notes 並出現 mynotes 站`, i.slug === "my-notes" && i.step === "mynotes" && i.title === "〈我的筆記〉", JSON.stringify({ slug: i.slug, step: i.step, title: i.title }))
check(`[${tag}] (b) 聚光圈包含我的筆記標題列與「▶ 筆記教學」按鈕`, contains(i.hole, i.shellHead) && contains(i.hole, i.tutBtn), JSON.stringify({ hole: i.hole, head: i.shellHead, btn: i.tutBtn }))
const myText = await ev(`document.querySelector('.bwz-bubble .bwz-text')?.innerText ?? ''`)
const tutLabel = await ev(`document.querySelector('.bwz-shell [data-action="tutorial"]')?.textContent`)
check(`[${tag}] mynotes 文字引用的按鈕名稱與頁面上一致`, tutLabel === "▶ 筆記教學" && myText === "這裡可以分頁看筆記、便條、重點、書籤，也能搜尋、依書卷找。第一次用，按「▶ 筆記教學」看怎麼操作。", `${tutLabel} / ${myText}`)
check(`[${tag}] mynotes 按鈕是「回到第12章」`, i.btns.some((b) => b.t === "回到第12章" && b.tt === "next"), JSON.stringify(i.btns))
if (phone) check(`[${tag}] mynotes 按鈕高度 ≥ 44px`, i.btns.every((b) => b.h >= 43.5), JSON.stringify(i.btns))
await saveShot(shots.mynotes)

// ---- (c) 回到第12章 → maps ----
await ev(`document.querySelector('.bwz-bubble [data-t=next]').click()`)
await sleep(5000)
i = await info()
check(`[${tag}] (c) 「回到第12章」後回到第 12 章並出現 maps 站`, i.slug === "02-出埃及記/第12章" && i.step === "maps", JSON.stringify({ slug: i.slug, step: i.step, saved: i.saved }))
check(`[${tag}] 進度存成 v2、step=17`, i.saved?.v === 2 && i.saved?.step === 17, JSON.stringify(i.saved))

// ---- (e) 舊進度搬移 ----
await loadAt({ status: "active", step: 15, skills: [], skipped: [] })
i = await info()
check(`[${tag}] (e) 沒有 v、step=15（舊 maps）搬到新的 maps 站`, i.step === "maps" && i.saved?.v === 2 && i.saved?.step === 17, JSON.stringify({ step: i.step, saved: i.saved }))
await loadAt({ status: "active", step: 17, v: 2, skills: [], skipped: [] }, 5000)
i = await info()
check(`[${tag}] (e) 已是 v2 的 step=17 不會再被 +2`, i.step === "maps" && i.saved?.step === 17, JSON.stringify({ step: i.step, saved: i.saved }))
await loadAt({ status: "active", step: 12, skills: [], skipped: [] }, 5000)
i = await info()
check(`[${tag}] (e) 舊 step=12（notes 之前）維持不變`, i.step === "table" && i.saved?.step === 12, JSON.stringify({ step: i.step, saved: i.saved }))
await loadAt({ status: "active", step: "abc", skills: "x", skipped: null }, 5000)
i = await info()
check(`[${tag}] (e) 壞掉的進度資料退回第一站、不報錯`, i.saved?.step === 0 && Array.isArray(i.saved?.skills), JSON.stringify(i.saved))

// ---- 圖示不在時不擋路 ----
await loadAt({ status: "active", step: NOTES_STEP + 1, v: 2, skills: [], skipped: [] }, 5000) // v:2 = 新版索引，notes-entry 就是 15
await ev(`document.querySelectorAll('a.bwz-notes-entry').forEach((a) => a.parentElement.remove())`)
await sleep(1500)
i = await info()
check(`[${tag}] 圖示不在時 notes-entry 改成「下一步」、不擋路`, i.step === "notes-entry" && i.btns.some((b) => b.tt === "next") && !i.btns.some((b) => b.tt === "skip"), JSON.stringify({ step: i.step, btns: i.btns }))

check(`[${tag}] 沒有 JavaScript 例外`, s.errors.length === 0, s.errors.join(" | "))
s.finish()
