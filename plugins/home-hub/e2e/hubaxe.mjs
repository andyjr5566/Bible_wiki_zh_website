// 首頁入口的無障礙與鍵盤檢查（無頭 Chrome / CDP）：
//   (1) axe-core：首頁 × 淺深 × 1440／390，整頁與入口區塊都不可以有 critical／serious
//   (2) 鍵盤：只用 Tab／Enter／方向鍵操作搜尋鈕、繼續、分頁、書卷連結
// 用法：node e2e/hubaxe.mjs <siteRoot> <profile> <axe.min.js 路徑>
// axe-core 不放進專案（只在本機檢查用），路徑由參數給。
import { readFileSync } from "node:fs"
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"

const [root, profile, axePath] = process.argv.slice(2)
if (!root || !profile || !axePath) {
  console.error("用法：node e2e/hubaxe.mjs <siteRoot> <profile> <axe.min.js>")
  process.exit(2)
}
const axeSource = readFileSync(axePath, "utf8")
const s = await startBrowser({ root, profile, width: 1440, height: 900, detailMax: Infinity })
const { ev, send, check, errors, finish } = s

async function waitFor(expr, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs
  let v
  while (Date.now() < end) {
    try { v = await ev(expr) } catch { v = undefined }
    if (v) return v
    await sleep(200)
  }
  return v
}
async function open(path) {
  await send("Page.navigate", { url: root + path })
  return waitFor(`document.readyState === 'complete' && !!document.querySelector('.bwz-hub')`)
}
const record = JSON.stringify({ v: 1, books: { "01-創世記": { slug: "01-創世記/第2章", ratio: 0.5, t: Date.now() - 86400000 } } })
async function seed(theme) {
  await open("/index.html?skip=1")
  await ev(`localStorage.clear(); localStorage.setItem('theme', ${JSON.stringify(theme)}); localStorage.setItem('bwz-reading', ${JSON.stringify(record)})`)
  await open("/index.html?skip=1")
  await waitFor(`!!document.querySelector('.bwz-resume')`)
  await sleep(800)
}

// ---------- (1) axe ----------
const runAxe = (context) => ev(`(async () => {
  if (!window.axe) { const el = document.createElement('script'); el.textContent = ${JSON.stringify(axeSource)}; document.head.appendChild(el) }
  const r = await axe.run(${context}, { resultTypes: ['violations'] })
  return JSON.stringify(r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(' ') })))
})()`)
for (const theme of ["light", "dark"]) {
  for (const [name, w, h, mobile] of [["1440", 1440, 900, false], ["390", 390, 844, true]]) {
    await s.setViewport(w, h, { dpr: mobile ? 2 : 1, mobile, touch: mobile })
    await seed(theme)
    for (const [label, ctx] of [["整頁", "document"], ["入口區塊", "document.querySelector('.bwz-hub')"]]) {
      const v = JSON.parse(await runAxe(ctx))
      const bad = v.filter((x) => x.impact === "critical" || x.impact === "serious")
      check(`axe ${theme} ${name} ${label}：沒有 critical／serious`, bad.length === 0, `${v.length} 項違規（${v.map((x) => `${x.id}:${x.impact}×${x.nodes}`).join("、") || "無"}）${bad.map((x) => x.first).join(" ; ")}`)
    }
  }
}

// ---------- (2) 鍵盤 ----------
await s.setViewport(1440, 900)
await seed("light")
const key = async (k, code = k, text) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: k === "Tab" ? 9 : k === "Enter" ? 13 : k === "Escape" ? 27 : k === "ArrowRight" ? 39 : 0, ...(text ? { text } : {}) })
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: k === "Tab" ? 9 : k === "Enter" ? 13 : k === "Escape" ? 27 : k === "ArrowRight" ? 39 : 0 })
}
const active = () => ev(`(() => { const a = document.activeElement; return a ? (a.className || a.tagName) + '|' + (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 12)) : '' })()`)
async function tabTo(selector, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await ev(`document.activeElement?.matches(${JSON.stringify(selector)})`)) return i
    await key("Tab")
    await sleep(60)
  }
  return -1
}
await ev(`document.activeElement?.blur(); window.scrollTo(0, 0)`)
const tSearch = await tabTo(".bwz-hub-search")
check("鍵盤：Tab 可以到達首頁搜尋鈕", tSearch >= 0, `按 ${tSearch} 次 Tab`)
await key("Enter", "Enter", "\r")
check("鍵盤：Enter 打開搜尋", !!(await waitFor(`!!document.querySelector('.search-container.active')`, 8000)))
await key("Escape")
await sleep(500)
await ev(`document.querySelector('.bwz-hub-search').focus()`)
const tGo = await tabTo(".bwz-resume-go", 5)
check("鍵盤：搜尋鈕之後 Tab 到「繼續」", tGo >= 0, await active())
const focusRing = await ev(`getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth`)
check("鍵盤：「繼續」有可見的焦點框", !/^none/.test(focusRing), focusRing)
const tTab = await tabTo(".bwz-hub .bwz-bg-tab", 5)
check("鍵盤：「繼續」之後 Tab 到書卷分頁", tTab >= 0, await active())
await key("ArrowRight")
await sleep(300)
check("鍵盤：方向鍵切換到新約分頁", !!(await ev(`document.querySelector('.bwz-hub .bwz-bg-tab[data-testament=nt]').getAttribute('aria-selected') === 'true'`)), await active())
await key("Tab")
await sleep(200)
check("鍵盤：Tab 進入書卷格（連結或灰色按鈕）", !!(await ev(`!!document.activeElement.closest('.bwz-hub .bwz-bookgrid') && document.activeElement.classList.contains('bwz-bg-book')`)), await active())
// 繼續：Enter 後換頁並捲動
await ev(`document.querySelector('.bwz-hub-search').focus()`)
await tabTo(".bwz-resume-go", 5)
await key("Enter", "Enter", "\r")
check("鍵盤：在「繼續」上按 Enter 會前往該章", !!(await waitFor(`document.body.dataset.slug === '01-創世記/第2章'`, 10000)))
await sleep(2200)
const ratio = await ev(`(document.documentElement.scrollHeight - innerHeight) > 0 ? scrollY / (document.documentElement.scrollHeight - innerHeight) : 0`)
check("鍵盤：Enter 繼續後也回到約同一位置（±10%）", Math.abs(ratio - 0.5) <= 0.1, `比例 ${Number(ratio).toFixed(2)}`)

check("全程沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
finish()
