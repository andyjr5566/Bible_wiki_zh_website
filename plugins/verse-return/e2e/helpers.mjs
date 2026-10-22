// verse-return 與 site-ux 純經文檢查共用的小工具（只被 e2e/*.mjs 匯入，不執行任何檢查）。
// 站台要先用 plugins/personal-notes/e2e/subpath-server.mjs 掛在 /Bible_wiki_zh_website/ 底下。
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"

export { sleep }

export const chapterPath = (n = 2) => "/" + encodeURI(`01-創世記/第${n}章`)
export const entryPath = (name = "安息") => "/" + encodeURI(`知識節點/${name}`)

// 跳過首訪導覽與「加入主畫面」提示；theme 是 light 或 dark
export const preload = (theme = "light", { pwa = false } = {}) =>
  `try{localStorage.wikiTourCompleted='1';localStorage.setItem('bwz-tour-v2', JSON.stringify({v:2,status:"dismissed",step:0,skills:[],skipped:[]}));localStorage.setItem('theme','${theme}');${pwa ? "" : "localStorage.setItem('pwa_install_guide_dismissed_v1','1');"}}catch(e){}`

/** 開一個新的無頭 Chrome（每次一個新的 profile），並先放好 localStorage 的設定。 */
export async function open({ root, profileRoot, shotDir, theme = "light", pwa = false, extraScript = "", ...opts }) {
  const profile = `${profileRoot}/p${Date.now()}${Math.floor(Math.random() * 1000)}`
  const s = await startBrowser({ root, profile, shotDir, ...opts })
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: preload(theme, { pwa }) + extraScript })
  return s
}

export async function mouse(s, x, y, type = "click", modifiers = 0) {
  if (type === "move") return s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
  await s.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, modifiers })
  await s.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, modifiers })
  await sleep(200)
}

/** 目標元素捲到畫面中間後，回傳它的中心座標。 */
export async function centerOf(s, sel, scroll = true) {
  for (let i = 0; i < 40 && !(await s.ev(`!!document.querySelector(${JSON.stringify(sel)})`)); i++) await sleep(250)
  // 等了 10 秒還找不到：回傳 null，讓呼叫端記成失敗，而不是整支腳本當掉、後面的檢查都沒跑
  if (!(await s.ev(`!!document.querySelector(${JSON.stringify(sel)})`))) return null
  if (scroll) {
    await s.ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center', behavior: 'instant' })`)
    await sleep(150)
  }
  return s
    .ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) })()`)
    .then(JSON.parse)
}

export async function clickSel(s, sel, { scroll = true, modifiers = 0 } = {}) {
  const c = await centerOf(s, sel, scroll)
  if (!c) {
    console.log(`FAIL  找不到要點的元素：${sel}`)
    process.exitCode = 1
    return false
  }
  await mouse(s, c.x, c.y, "click", modifiers)
  return true
}

/** 等到 expr 為真（最多 ms 毫秒）；回傳最後一次的值。 */
export async function waitFor(s, expr, ms = 6000) {
  let v
  for (let t = 0; t < ms; t += 150) {
    v = await s.ev(expr)
    if (v) return v
    await sleep(150)
  }
  return v
}

export const rectOf = (s, sel) =>
  s
    .ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'null'; const r = e.getBoundingClientRect(); return JSON.stringify({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }) })()`)
    .then(JSON.parse)

export const intersects = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

// WCAG 對比：傳入計算後的 rgb()/rgba() 字串
export const contrastExpr = (sel, bgSel = sel) => `(() => {
  const parse = (c) => c.match(/[\\d.]+/g).map(Number)
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const fg = parse(getComputedStyle(document.querySelector(${JSON.stringify(sel)})).color)
  const bg = parse(getComputedStyle(document.querySelector(${JSON.stringify(bgSel)})).backgroundColor)
  const a = lum(fg), b = lum(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
})()`

export const storedPoint = (s) => s.ev(`(() => { try { return sessionStorage.getItem('bwz-return-point') } catch (e) { return 'ERR' } })()`)
export const scrollY = (s) => s.ev(`Math.round(window.scrollY)`)
export const urlPath = (s) => s.ev(`location.pathname + location.hash`).then((p) => decodeURIComponent(p))
