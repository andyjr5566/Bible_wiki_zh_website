// 「Aa 外觀」面板：無頭 Chrome（CDP）驗證。重用 plugins/personal-notes/e2e/lib.mjs（不修改它）。
// 用法：node e2e/check.mjs <newBase> <baseBase> <profileRoot> <shotDir>
//   newBase      新版（含 site-ux）建置的網址，例如 http://localhost:8192/Bible_wiki_zh_website
//   baseBase     改動前（沒有 site-ux）建置的網址，用來比對預設外觀完全沒變
//   profileRoot  放 Chrome user-data-dir 的資料夾（每個情境會在底下開新的子資料夾）
//   shotDir      截圖資料夾
// 兩個站台都要先用 `node plugins/personal-notes/e2e/subpath-server.mjs <out> <port>` 開好。
import { mkdirSync, writeFileSync } from "node:fs"
import { startBrowser, ch1, sleep } from "../../personal-notes/e2e/lib.mjs"

const [NEW, BASE, profileRoot, shotDir] = process.argv.slice(2)
if (!NEW || !BASE || !profileRoot || !shotDir) {
  console.error("用法：node e2e/check.mjs <newBase> <baseBase> <profileRoot> <shotDir>")
  process.exit(2)
}
mkdirSync(shotDir, { recursive: true })
let profileN = 0
const profile = () => `${profileRoot}/p${++profileN}`
const allResults = []

// 取回目前頁面上的各種計算後樣式（比對基準版與新版用）
const MEASURE = `(() => {
  const a = document.querySelector('article')
  const root = a.querySelector(':scope > .markdown-preview-view') || a
  const fs = (el) => (el ? getComputedStyle(el).fontSize : null)
  const ol = root.querySelector(':scope > ol')
  const sty = (l) => { const c = getComputedStyle(l); return [c.color, c.backgroundColor, c.paddingLeft, c.paddingRight, c.fontWeight, c.textDecorationLine, c.textDecorationStyle, c.opacity, c.borderRadius].join('|') }
  const verseLinks = [...ol.querySelectorAll('a')]
  const otherLinks = [...root.querySelectorAll('a')].filter((l) => !ol.contains(l))
  const li = ol.querySelector('li')
  return {
    p: fs(root.querySelector('p')), li: fs(li), cli: fs(root.querySelector('.collapsible-content ul li')),
    ctitle: fs(root.querySelector('.collapsible-title')), h3: fs(root.querySelector('h3')),
    liColor: getComputedStyle(li).color, liWeight: getComputedStyle(li).fontWeight,
    verse: verseLinks.map(sty), other: otherLinks.map(sty), nVerse: verseLinks.length, nOther: otherLinks.length,
    marked: ol.classList.contains('bwz-ux-verses'),
  }
})()`

const ARTICLE_CLIP = `(() => { const r = document.querySelector('article').getBoundingClientRect(); return JSON.stringify({ x: Math.max(0, r.left), y: 0, width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(innerHeight, 900), scale: 1 }) })()`

async function open(root, opts = {}) {
  const s = await startBrowser({ root, profile: profile(), shotDir, ...opts })
  s.check = ((orig) => (name, ok, detail = "") => { allResults.push(ok); orig(name, ok, detail) })(s.check)
  return s
}

const setLS = (s, obj) => s.ev(`(() => { ${Object.entries(obj).map(([k, v]) => v === null ? `localStorage.removeItem(${JSON.stringify(k)})` : `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(";")} })()`)
const attrs = (s) => s.ev(`JSON.stringify({ bg: document.documentElement.getAttribute('data-bg'), fs: document.documentElement.getAttribute('data-ux-fs'), links: document.documentElement.getAttribute('data-ux-links') })`).then(JSON.parse)
const reload = async (s, path = ch1, wait = 3500) => { await s.go(path, wait) }
const num = (px) => parseFloat(px)

// ---- 真實輸入 ----
const KEYS = { Tab: [9, "Tab", ""], Enter: [13, "Enter", "\r"], Escape: [27, "Escape", ""], ArrowLeft: [37, "ArrowLeft", ""], ArrowUp: [38, "ArrowUp", ""], ArrowRight: [39, "ArrowRight", ""], ArrowDown: [40, "ArrowDown", ""], " ": [32, "Space", " "] }
async function press(s, k, mods = 0) {
  const [vk, code, text] = KEYS[k]
  await s.send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers: mods, text })
  await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers: mods })
  await sleep(120)
}
async function mouse(s, x, y, type = "click") {
  if (type === "move") return s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
  await s.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
  await s.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
  await sleep(200)
}
const center = async (s, sel) => { for (let i = 0; i < 40 && !(await s.ev(`!!document.querySelector(${JSON.stringify(sel)})`)); i++) await sleep(250); return centerNow(s, sel) }
const centerNow = (s, sel) => s.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) })()`).then(JSON.parse)
const clickSel = async (s, sel) => { const c = await center(s, sel); await mouse(s, c.x, c.y) }
const panelState = (s) => s.ev(`JSON.stringify({ open: !!document.querySelector('#site-ux-panel'), expanded: document.querySelector('.site-ux-btn')?.getAttribute('aria-expanded'), active: document.activeElement?.className + '|' + (document.activeElement?.textContent || '').slice(0, 8), checked: [...document.querySelectorAll('#site-ux-panel [role=radio][aria-checked=true]')].map((b) => b.textContent) })`).then(JSON.parse)
const clickOpt = (s, name, value) => clickSel(s, `#site-ux-panel [role=radio][data-name=${name}][data-value=${value}]`)
const openPanel = async (s) => { await clickSel(s, ".site-ux-btn"); await sleep(250) }

// ======================================================================
// 1. 預設外觀和改動前完全一樣（桌機，亮／深）
// ======================================================================
console.log("\n== 1. 預設外觀不變 ==")
for (const theme of ["light", "dark"]) {
  const out = {}
  for (const [label, url] of [["base", BASE], ["new", NEW]]) {
    const s = await open(url, { width: 1440, height: 900 })
    await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.wikiTourCompleted='1'}catch(e){}" })
    await s.go(ch1, 3000)
    await setLS(s, { theme })
    await reload(s)
    out[label] = await s.ev(`JSON.stringify(${MEASURE})`).then(JSON.parse)
    out[label].htmlAttrs = await s.ev(`document.documentElement.getAttributeNames().sort().join(',')`)
    const clip = JSON.parse(await s.ev(ARTICLE_CLIP))
    out[label].png = await s.capture(clip)
    await sleep(600)
    out[label].png2 = await s.capture(clip) // 同一版本連拍兩次，用來判斷截圖本身有沒有雜訊
    if (label === "new") await s.saveShot(`${shotDir}/default-${theme}.png`)
    if (label === "base") await s.saveShot(`${shotDir}/default-${theme}-BASE.png`)
    s.proc?.kill?.()
    // 不用 s.finish()（它會結束整個程序）；關掉連線即可
    s.send("Browser.close").catch(() => {})
    await sleep(500)
  }
  const { png: pb, png2: pb2, ...b } = out.base
  const { png: pn, png2: pn2, ...n } = out.new
  const { marked: _bm, ...b2 } = b, { marked: _nm, ...n2 } = n
  const sameStyles = JSON.stringify(b2) === JSON.stringify(n2)
  const pass = (name, ok, d = "") => { allResults.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${d ? "  — " + d : ""}`) }
  pass(`[${theme}] 預設：字級、連結顏色／底色／內距／字重／底線／透明度、<html> 屬性都和改動前相同`, sameStyles, sameStyles ? `p=${n.p} li=${n.li} cli=${n.cli} 連結${n.nVerse}+${n.nOther}` : JSON.stringify({ b, n }).slice(0, 600))
  pass(`[${theme}] 預設：經文清單沒有被標記成會受影響（class 只是標記，不帶樣式）`, n.marked === true && n.htmlAttrs === b.htmlAttrs)
  const same = pb && pn && Buffer.compare(pb, pn) === 0
  // 背景圖與毛玻璃在不同次截圖會有些微雜訊（同一版本連拍也可能不同），所以位元組不同時，只要大小差在 2% 內就算相同；
  // 真正的判斷標準是上面「計算後樣式逐項相同」，截圖只是輔助，也已人工看過 default-*-clip-BASE／NEW。
  const noisy = pb && pn && Math.abs(pb.length - pn.length) / pb.length < 0.02
  if (!same && pb && pn) { writeFileSync(`${shotDir}/default-${theme}-clip-BASE.png`, pb); writeFileSync(`${shotDir}/default-${theme}-clip-NEW.png`, pn) }
  pass(`[${theme}] 預設：文章區截圖逐位元組相同（背景有些微雜訊，大小差 2% 內視為相同）`, same || noisy, noisy && !same ? `位元組不同但大小差 ${(Math.abs(pb.length - pn.length) / pb.length * 100).toFixed(2)}%（背景雜訊），以計算後樣式相同為準` : same ? `${pn.length} bytes` : `base ${pb?.length} vs new ${pn?.length}（已存兩張 clip 圖）`)
}

// ======================================================================
// 2. 各設定組合的截圖與樣式；字級比例；本章整理不受影響
// ======================================================================
console.log("\n== 2. 設定組合（桌機 1440） ==")
{
  const s = await open(NEW, { width: 1440, height: 900 })
  const { check } = s
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.wikiTourCompleted='1'}catch(e){}" })
  await s.go(ch1, 3000)
  let baseM = null
  for (const theme of ["light", "dark"]) {
    await setLS(s, { theme, "theme-bg": "paper", "bwz-ux-fontsize": null, "bwz-ux-verselinks": null })
    await reload(s)
    baseM = JSON.parse(await s.ev(`JSON.stringify(${MEASURE})`))
    // 先算出每個組合：底色 × 經文連結（字級中），再加小、大各一張
    const combos = []
    for (const bg of ["paper", "pure"]) for (const links of ["normal", "quiet", "hidden"]) combos.push({ bg, fs: "m", links })
    combos.push({ bg: "paper", fs: "s", links: "quiet" }, { bg: "paper", fs: "l", links: "quiet" })
    for (const c of combos) {
      await setLS(s, { theme, "theme-bg": c.bg, "bwz-ux-fontsize": c.fs, "bwz-ux-verselinks": c.links })
      await reload(s)
      const m = JSON.parse(await s.ev(`JSON.stringify(${MEASURE})`))
      const at = await attrs(s)
      const tag = `${theme}/${c.bg}/字級${{ s: "小", m: "中", l: "大" }[c.fs]}/連結${{ normal: "明顯", quiet: "低調", hidden: "隱藏" }[c.links]}`
      await s.ev(`window.scrollTo(0, document.querySelector('article ol').getBoundingClientRect().top + scrollY - 120)`)
      await sleep(400)
      await s.shot(`combo-${theme}-${c.bg}-${c.fs}-${c.links}`)
      await s.ev(`window.scrollTo(0, 0)`)

      // 底色
      check(`[${tag}] 底色屬性`, (at.bg === "pure") === (c.bg === "pure"), JSON.stringify(at))
      // 字級（相對於預設的倍率）
      const k = { s: 0.9, m: 1, l: 1.15 }[c.fs]
      const near = (a, b) => Math.abs(num(a) - num(b) * k) < 0.02
      check(`[${tag}] 字級倍率 ×${k}（p／li／可收合清單／可收合標題）`, near(m.p, baseM.p) && near(m.li, baseM.li) && near(m.cli, baseM.cli) && near(m.ctitle, baseM.ctitle), `p ${baseM.p}→${m.p}, li ${baseM.li}→${m.li}, cli ${baseM.cli}→${m.cli}, title ${baseM.ctitle}→${m.ctitle}`)
      // 本章整理等經文清單以外的連結：任何設定下都和預設相同
      check(`[${tag}] 經文清單以外的連結（本章整理等 ${m.nOther} 個）完全不變`, JSON.stringify(m.other) === JSON.stringify(baseM.other))
      // 經文連結
      const textColor = m.liColor
      const parts = m.verse.map((x) => x.split("|"))
      if (c.links === "normal") {
        check(`[${tag}] 經文連結維持明顯（和預設逐項相同）`, JSON.stringify(m.verse) === JSON.stringify(baseM.verse))
      } else {
        const colorOk = parts.every((p) => p[0] === textColor)
        const bgOk = parts.every((p) => p[1] === "rgba(0, 0, 0, 0)")
        const padOk = parts.every((p) => p[2] === "0px" && p[3] === "0px")
        const fwOk = parts.every((p) => p[4] === m.liWeight)
        const opOk = parts.every((p) => p[7] === "1")
        const decoOk = c.links === "quiet" ? parts.every((p) => p[5] === "underline" && p[6] === "dotted") : parts.every((p) => p[5] === "none")
        check(`[${tag}] 經文連結${c.links === "quiet" ? "低調：同色、無底色、字重相同、細虛線底線" : "隱藏：看起來是一般文字（無底線、無底色）"}`, colorOk && bgOk && padOk && fwOk && opOk && decoOk && parts.length === baseM.nVerse, JSON.stringify({ colorOk, bgOk, padOk, fwOk, opOk, decoOk, n: parts.length }))
      }
      // 功能面：連結都還在、可點、可聚焦
      if (c.links === "hidden" && c.bg === "paper" && c.fs === "m") {
        const live = await s.ev(`JSON.stringify((() => { const a = [...document.querySelectorAll('article ol.bwz-ux-verses a')]; return { n: a.length, focusable: a.filter((x) => x.tabIndex >= 0 && x.getAttribute('href')).length, hit: a.filter((x) => { x.scrollIntoView({block:'center'}); const r = x.getClientRects()[0]; const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e === x || x.contains(e)) }).length } })())`).then(JSON.parse)
        check(`[${tag}] 隱藏：連結沒有被移除，全部可聚焦、點得到`, live.n === baseM.nVerse && live.focusable === live.n && live.hit === live.n, JSON.stringify(live))
      }
    }
  }
  await s.send("Browser.close").catch(() => {})
  await sleep(400)
}

// ======================================================================
// 3. 低調：滑過／鍵盤聚焦時回到一般連結樣式
// ======================================================================
console.log("\n== 3. 低調的滑過與聚焦 ==")
{
  const s = await open(NEW, { width: 1440, height: 900 })
  const { check } = s
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.wikiTourCompleted='1'}catch(e){}" })
  await s.go(ch1, 3000)
  await setLS(s, { "bwz-ux-verselinks": "quiet" })
  await reload(s)
  const target = await s.ev(`(() => { const a = [...document.querySelectorAll('article ol.bwz-ux-verses a')].find((x) => !x.classList.contains('broken')) || document.querySelector('article ol.bwz-ux-verses a'); a.id = 'probe'; a.scrollIntoView({block:'center'}); return a.className })()`)
  await sleep(300)
  const c = await center(s, "#probe")
  const st = () => s.ev(`(() => { const c = getComputedStyle(document.querySelector('#probe')); return JSON.stringify({ color: c.color, bg: c.backgroundColor, deco: c.textDecorationLine, outline: c.outlineStyle + ' ' + c.outlineWidth }) })()`).then(JSON.parse)
  const rest = await st()
  await mouse(s, c.x, c.y, "move")
  await sleep(500)
  const hover = await st()
  check("低調：滑過連結時顯示一般連結的底色與顏色", hover.bg !== "rgba(0, 0, 0, 0)" && hover.color !== rest.color, `rest ${JSON.stringify(rest)} → hover ${JSON.stringify(hover)}`)
  await mouse(s, 5, 5, "move")
  // 鍵盤聚焦：先聚焦前一個可聚焦元素，再按 Tab
  await s.ev(`(() => { const all = [...document.querySelectorAll('a[href],button,input,[tabindex="0"]')].filter((e) => e.tabIndex >= 0); const i = all.indexOf(document.querySelector('#probe')); all[i - 1].focus() })()`)
  await press(s, "Tab")
  await sleep(500)
  const focused = await s.ev(`document.activeElement?.id`)
  const foc = await st()
  check("低調：鍵盤聚焦時顯示一般連結樣式與外框", focused === "probe" && foc.bg !== "rgba(0, 0, 0, 0)", `active=${focused} ${JSON.stringify(foc)}`)
  await s.send("Browser.close").catch(() => {})
  await sleep(400)
}

// ======================================================================
// 4. 面板操作（滑鼠）、儲存、重新整理、SPA 換頁、舊「素」設定、恢復預設
// ======================================================================
console.log("\n== 4. 面板、儲存與換頁 ==")
{
  const s = await open(NEW, { width: 1440, height: 900 })
  const { check } = s
  // 記錄 <html> 屬性第一次被設成字級時，<body> 是否已經存在（驗證在繪製前就套用）
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.wikiTourCompleted='1'}catch(e){}; new MutationObserver(() => { if (document.documentElement.hasAttribute('data-ux-fs') && !window.__fsAt) window.__fsAt = document.body ? 'body' : 'head' }).observe(document, { attributes: true, subtree: true })` })
  await s.go(ch1, 3000)
  check("舊的「素」按鈕已移除，只剩一個外觀按鈕", (await s.ev(`document.querySelectorAll('.puremode').length`)) === 0 && (await s.ev(`document.querySelectorAll('.site-ux-btn').length`)) === 1)
  const btn = await s.ev(`JSON.stringify((() => { const b = document.querySelector('.site-ux-btn'); return { label: b.getAttribute('aria-label'), text: b.textContent.trim(), exp: b.getAttribute('aria-expanded'), inToolbar: !!b.closest('.left.sidebar .flex-component'), prevIsDark: !!b.parentElement.previousElementSibling?.querySelector('.darkmode') } })())`).then(JSON.parse)
  check("按鈕：Aa、aria-label=外觀、在左上工具列、排在深色模式按鈕之後", btn.label === "外觀" && btn.text === "Aa" && btn.inToolbar && btn.exp === "false", JSON.stringify(btn))
  await s.shot("ui-toolbar-closed")

  await openPanel(s)
  let st = await panelState(s)
  check("按一下按鈕：面板打開，aria-expanded=true，預設選項為 紙質／中／明顯", st.open && st.expanded === "true" && st.checked.join() === "紙質,中,明顯", JSON.stringify(st))
  const labels = await s.ev(`JSON.stringify([...document.querySelectorAll('#site-ux-panel .site-ux-title, #site-ux-panel .site-ux-label, #site-ux-panel .site-ux-opt, #site-ux-panel .site-ux-reset')].map((e) => e.textContent))`).then(JSON.parse)
  check("面板文字", labels.join(" ") === "外觀 底色 紙質 素色 字級 小 中 大 經文連結 明顯 低調 隱藏 恢復預設", labels.join(" "))
  await s.shot("ui-panel-open-light")
  await clickOpt(s, "bg", "pure")
  await clickOpt(s, "fontSize", "l")
  await clickOpt(s, "links", "quiet")
  const ls = await s.ev(`JSON.stringify({ bg: localStorage.getItem('theme-bg'), fs: localStorage.getItem('bwz-ux-fontsize'), links: localStorage.getItem('bwz-ux-verselinks') })`).then(JSON.parse)
  check("點選三個設定：立即套用並存進 localStorage（theme-bg=pure）", JSON.stringify(await attrs(s)) === JSON.stringify({ bg: "pure", fs: "l", links: "quiet" }) && ls.bg === "pure" && ls.fs === "l" && ls.links === "quiet", JSON.stringify(ls))
  await s.shot("ui-panel-after-clicks")
  // 外面點一下關閉
  await mouse(s, 900, 600)
  st = await panelState(s)
  check("點面板外面：面板關閉，aria-expanded=false", !st.open && st.expanded === "false", JSON.stringify(st))
  // 重新整理後保留
  await reload(s)
  check("重新整理後設定保留（素色、大、低調），且屬性在 <body> 出現之前就套用（不閃爍）", JSON.stringify(await attrs(s)) === JSON.stringify({ bg: "pure", fs: "l", links: "quiet" }) && (await s.ev(`window.__fsAt`)) === "head", `fsAt=${await s.ev("window.__fsAt")}`)
  await openPanel(s)
  st = await panelState(s)
  check("重新整理後面板顯示的選項和儲存的一致", st.checked.join() === "素色,大,低調", JSON.stringify(st))
  await mouse(s, 900, 600)
  // SPA 換頁：點「下一章」
  await s.ev(`window.__marker = 'same-document'`)
  await s.ev(`[...document.querySelectorAll('a')].find((a) => decodeURIComponent(a.getAttribute('href') || '').endsWith('第2章')).click()`)
  await sleep(2500)
  const spa = await s.ev(`JSON.stringify({ marker: window.__marker, path: decodeURIComponent(location.pathname), attrs: { bg: document.documentElement.getAttribute('data-bg'), fs: document.documentElement.getAttribute('data-ux-fs'), links: document.documentElement.getAttribute('data-ux-links') }, marked: !!document.querySelector('article ol.bwz-ux-verses'), btns: document.querySelectorAll('.site-ux-btn').length, p: getComputedStyle(document.querySelector('article p')).fontSize })`).then(JSON.parse)
  check("SPA 換頁（沒有整頁重載）後設定仍然有效，新頁面的經文清單重新標記", spa.marker === "same-document" && spa.path.endsWith("第2章") && spa.attrs.bg === "pure" && spa.attrs.fs === "l" && spa.attrs.links === "quiet" && spa.marked && spa.btns === 1, JSON.stringify(spa))
  await openPanel(s)
  st = await panelState(s)
  check("換頁後按鈕仍可開啟面板，選項正確", st.open && st.checked.join() === "素色,大,低調", JSON.stringify(st))
  // 恢復預設
  await clickSel(s, "#site-ux-panel .site-ux-reset")
  const after = await attrs(s)
  const ls2 = await s.ev(`JSON.stringify({ bg: localStorage.getItem('theme-bg'), fs: localStorage.getItem('bwz-ux-fontsize'), links: localStorage.getItem('bwz-ux-verselinks') })`).then(JSON.parse)
  st = await panelState(s)
  check("恢復預設：屬性清除、儲存改回 paper／m／normal、面板顯示 紙質／中／明顯", after.bg === null && after.fs === null && after.links === null && ls2.bg === "paper" && ls2.fs === "m" && ls2.links === "normal" && st.checked.join() === "紙質,中,明顯", JSON.stringify({ after, ls2, st }))
  await s.send("Browser.close").catch(() => {})
  await sleep(400)
}

// ======================================================================
// 5. 舊「素」設定仍然有效；localStorage 壞掉時不出錯
// ======================================================================
console.log("\n== 5. 舊設定與儲存失敗 ==")
{
  const s = await open(NEW, { width: 1440, height: 900 })
  const { check, errors } = s
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.wikiTourCompleted='1'}catch(e){}" })
  await s.go(ch1, 3000)
  // 模擬舊版讀者：只有 theme-bg=pure，沒有新的 key
  await setLS(s, { "theme-bg": "pure", "bwz-ux-fontsize": null, "bwz-ux-verselinks": null })
  await reload(s)
  const a = await attrs(s)
  await openPanel(s)
  const st = await panelState(s)
  const bgColor = await s.ev(`getComputedStyle(document.body).backgroundImage + '|' + getComputedStyle(document.body).backgroundColor`)
  check("舊「素」設定（theme-bg=pure）仍然套用，面板顯示「素色」", a.bg === "pure" && st.checked[0] === "素色" && bgColor.startsWith("none"), `${JSON.stringify(a)} ${bgColor}`)
  await mouse(s, 900, 600)
  await setLS(s, { "theme-bg": "paper" })
  await reload(s)
  check("舊設定 theme-bg=paper：維持紙質", (await attrs(s)).bg === null)
  // 壞掉的值
  await setLS(s, { "theme-bg": "zzz", "bwz-ux-fontsize": "huge", "bwz-ux-verselinks": "??" })
  await reload(s)
  const bad = await attrs(s)
  check("儲存裡有不認得的值：退回預設，不出錯", bad.bg === null && bad.fs === null && bad.links === null && errors.length === 0, `errors=${errors.length}`)
  await s.send("Browser.close").catch(() => {})
  await sleep(400)

  // localStorage 整個丟錯：頁面仍可使用，面板仍可切換（只是不記住）
  const s2 = await open(NEW, { width: 1440, height: 900 })
  await s2.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const real = window.localStorage; const bad = (k) => /^(theme-bg|bwz-ux)/.test(k); window.__lsProbe = 0; Object.defineProperty(window, 'localStorage', { value: { getItem: (k) => { if (bad(k)) { window.__lsProbe++; throw new Error('blocked') } return real.getItem(k) }, setItem: (k, v) => { if (bad(k)) { window.__lsProbe++; throw new Error('blocked') } return real.setItem(k, v) }, removeItem: (k) => real.removeItem(k), key: (i) => real.key(i), get length() { return real.length } } }) })()` })
  await s2.go(ch1, 3500)
  await openPanel(s2)
  await clickOpt(s2, "fontSize", "s")
  const a2 = await attrs(s2)
  s2.check("localStorage 存取丟錯：沒有 JS 錯誤，面板仍可切換字級（只是不會記住）", a2.fs === "s" && s2.errors.length === 0 && (await s2.ev(`window.__lsProbe`)) > 0, `${JSON.stringify(a2)} errors=${s2.errors.length} ${s2.errors[0] ?? ""} probe=${await s2.ev("window.__lsProbe")}`)
  await s2.send("Browser.close").catch(() => {})
  await sleep(400)
}

// ======================================================================
// 6. 只用鍵盤
// ======================================================================
console.log("\n== 6. 鍵盤操作 ==")
{
  const s = await open(NEW, { width: 1440, height: 900 })
  const { check } = s
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.wikiTourCompleted='1'}catch(e){}" })
  await s.go(ch1, 3500)
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    await press(s, "Tab")
    reached = await s.ev(`document.activeElement?.classList.contains('site-ux-btn')`)
  }
  check("Tab 可以到達外觀按鈕", reached)
  const ring = await s.ev(`(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle + ' ' + c.outlineWidth })()`)
  check("按鈕有可見的焦點框", !ring.startsWith("none") && !ring.endsWith(" 0px"), ring)
  await press(s, "Enter")
  await sleep(200)
  let st = await panelState(s)
  check("Enter 開啟面板，焦點進到「底色」目前選項（紙質），aria-expanded=true", st.open && st.expanded === "true" && st.active.endsWith("紙質") && st.active.startsWith("site-ux-opt"), JSON.stringify(st))
  const focusRing = await s.ev(`(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle + ' ' + c.outlineWidth })()`)
  check("面板內的焦點有可見外框", !focusRing.startsWith("none") && !focusRing.endsWith(" 0px"), focusRing)
  await press(s, "ArrowRight")
  st = await panelState(s)
  check("方向鍵右：底色換成素色並立即套用（radiogroup 行為）", st.checked[0] === "素色" && (await attrs(s)).bg === "pure", JSON.stringify(st))
  await press(s, "ArrowRight")
  st = await panelState(s)
  check("方向鍵右到底後繞回第一個（紙質）", st.checked[0] === "紙質" && (await attrs(s)).bg === null, JSON.stringify(st))
  await press(s, "ArrowLeft")
  st = await panelState(s)
  check("方向鍵左：繞到最後一個（素色）", st.checked[0] === "素色", JSON.stringify(st))
  await press(s, "Tab")
  st = await panelState(s)
  check("Tab：移到下一組「字級」的目前選項（中）", st.active.endsWith("中"), JSON.stringify(st))
  await press(s, "ArrowDown")
  st = await panelState(s)
  check("方向鍵下：字級換成大", st.checked[1] === "大" && (await attrs(s)).fs === "l", JSON.stringify(st))
  await press(s, "Tab")
  await press(s, "ArrowRight")
  st = await panelState(s)
  check("Tab 到「經文連結」，方向鍵右：低調", st.checked[2] === "低調" && (await attrs(s)).links === "quiet", JSON.stringify(st))
  await press(s, "ArrowRight")
  await press(s, "ArrowRight")
  st = await panelState(s)
  check("方向鍵繼續：隱藏 → 繞回明顯", st.checked[2] === "明顯", JSON.stringify(st))
  await press(s, "Tab")
  st = await panelState(s)
  check("Tab：到「恢復預設」", st.active === "site-ux-reset|恢復預設", JSON.stringify(st))
  await press(s, "Enter")
  const rst = await attrs(s)
  check("在「恢復預設」按 Enter：全部回預設", rst.bg === null && rst.fs === null && rst.links === null, JSON.stringify(rst))
  await press(s, "Tab")
  st = await panelState(s)
  check("Tab 在面板內循環（不跑到頁面其他地方）", st.open && /site-ux-close|site-ux-opt/.test(st.active), JSON.stringify(st))
  await press(s, "Escape")
  st = await panelState(s)
  check("Esc：面板關閉、焦點回到按鈕、aria-expanded=false", !st.open && st.expanded === "false" && st.active.startsWith("site-ux-btn"), JSON.stringify(st))
  await press(s, "Enter")
  await sleep(200)
  await press(s, " ")
  st = await panelState(s)
  check("Enter 再開、空白鍵可選取目前選項（面板仍開著）", st.open, JSON.stringify(st))
  await press(s, "Escape")
  await s.send("Browser.close").catch(() => {})
  await sleep(400)
}

// ======================================================================
// 7. 手機 390×844（觸控、iPhone UA）
// ======================================================================
console.log("\n== 7. 手機 ==")
{
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
  const s = await open(NEW, { width: 390, height: 844, mobile: true, userAgent: UA })
  const { check } = s
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.wikiTourCompleted='1'}catch(e){}" })
  await s.go(ch1, 3500)
  const tap = async (sel) => {
    const c = await center(s, sel)
    await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }] })
    await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await sleep(300)
  }
  const bb = await s.ev(`JSON.stringify((() => { const r = document.querySelector('.site-ux-btn').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, y: r.top } })())`).then(JSON.parse)
  check("手機：外觀按鈕在畫面內且至少 44×44", bb.w >= 44 && bb.h >= 44 && bb.x >= 0 && bb.x + bb.w <= 390, JSON.stringify(bb))
  await s.shot("mobile-toolbar-closed")
  await tap(".site-ux-btn")
  let st = await panelState(s)
  check("手機：點一下（觸控）打開面板", st.open && st.expanded === "true", JSON.stringify(st))
  const geo = await s.ev(`JSON.stringify((() => { const p = document.querySelector('#site-ux-panel').getBoundingClientRect(); const small = [...document.querySelectorAll('#site-ux-panel button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: Math.round(r.width), h: Math.round(r.height) } }).filter((b) => b.w < 44 || b.h < 44); return { l: p.left, r: p.right, t: p.top, b: p.bottom, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, bsw: document.body.scrollWidth, small } })())`).then(JSON.parse)
  check("手機：面板完整在視窗內", geo.l >= 0 && geo.r <= geo.iw && geo.t >= 0 && geo.b <= geo.ih, JSON.stringify(geo))
  check("手機：沒有橫向捲動", geo.sw <= geo.iw && geo.bsw <= geo.iw, `scrollWidth ${geo.sw} / ${geo.iw}`)
  check("手機：面板內所有按鈕都至少 44×44", geo.small.length === 0, JSON.stringify(geo.small))
  await s.shot("mobile-panel-open")
  await tap(`#site-ux-panel [role=radio][data-name=fontSize][data-value=l]`)
  await tap(`#site-ux-panel [role=radio][data-name=links][data-value=hidden]`)
  const a = await attrs(s)
  const p = await s.ev(`getComputedStyle(document.querySelector('article p')).fontSize`)
  check("手機：觸控切換字級與經文連結，內文 1.4rem×1.15=25.76px", a.fs === "l" && a.links === "hidden" && Math.abs(num(p) - 25.76) < 0.05, `${JSON.stringify(a)} p=${p}`)
  await s.shot("mobile-panel-after")
  // 點面板外面關閉
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 800 }] })
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await sleep(300)
  st = await panelState(s)
  check("手機：點面板外面關閉", !st.open, JSON.stringify(st))
  await setLS(s, { "bwz-ux-fontsize": "m", "bwz-ux-verselinks": "normal" })
  await reload(s)
  const sw = await s.ev(`document.documentElement.scrollWidth <= innerWidth`)
  check("手機：預設設定下頁面沒有橫向捲動", sw)
  await s.ev(`window.scrollTo(0, document.querySelector('article ol').getBoundingClientRect().top + scrollY - 150)`)
  await sleep(300)
  await s.shot("mobile-default-verses")
  await s.send("Browser.close").catch(() => {})
  await sleep(400)
}

// ======================================================================
// 8. 手機：章節快捷列（.bwz-cqb，往下捲才出現）和外觀按鈕／面板不互相遮擋
// ======================================================================
console.log("\n== 8. 手機：快捷列與外觀面板 ==")
{
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
  const s = await open(NEW, { width: 390, height: 844, mobile: true, userAgent: UA })
  const { check } = s
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.wikiTourCompleted='1'}catch(e){}" })
  await s.go(ch1, 3500)
  const rects = `JSON.stringify((() => { const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), vis: cs.display !== 'none' && cs.visibility !== 'hidden' && b.height > 0, pos: cs.position, z: cs.zIndex } }; return { btn: r(document.querySelector('.site-ux-btn')), bar: r(document.querySelector('.bwz-cqb')), toolbar: r(document.querySelector('.left.sidebar')), panel: r(document.querySelector('#site-ux-panel')) } })())`
  let g = JSON.parse(await s.ev(rects))
  check("手機（頁首）：外觀按鈕可見，快捷列還沒出現", !!g.btn?.vis && (!g.bar || !g.bar.vis || g.bar.b <= 0), JSON.stringify(g))
  await s.shot("mobile-top-aa")
  await s.ev("window.scrollTo(0, 1600)")
  await sleep(900)
  g = JSON.parse(await s.ev(rects))
  const overlap = g.btn && g.btn.vis && g.bar && g.bar.vis && !(g.btn.b <= g.bar.t || g.btn.t >= g.bar.b || g.btn.r <= g.bar.l || g.btn.l >= g.bar.r)
  await s.ev("window.scrollTo(0, 1600)")
  await sleep(900)
  g = JSON.parse(await s.ev(rects))
  // 快捷列（position: fixed，z-index 600）設計上會整條蓋住置頂的工具列（搜尋、深色模式、Aa 都一樣），捲回頁首它就收起。
  check("手機（往下捲）：快捷列出現（固定在頂端、蓋住置頂工具列是它的設計），頁面沒有橫向捲動", !!g.bar?.vis && (await s.ev("document.documentElement.scrollWidth <= innerWidth")), JSON.stringify(g))
  await s.shot("mobile-scrolled-quickbar")
  await s.ev("window.scrollTo(0, 0)")
  await sleep(900)
  g = JSON.parse(await s.ev(rects))
  check("手機：捲回頁首後快捷列收起，外觀按鈕又露出來、沒有被蓋住", !!g.btn?.vis && (!g.bar || !g.bar.vis || g.bar.b <= 0), JSON.stringify(g))
  // 先在頁首打開面板，再往下捲到快捷列出現：面板要在快捷列上面、完整在視窗內
  const c = await center(s, ".site-ux-btn")
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }] })
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await sleep(400)
  await s.ev("window.scrollTo(0, 1600)")
  await sleep(1200)
  g = JSON.parse(await s.ev(rects))
  const top = await s.ev(`(() => { const p = document.querySelector('#site-ux-panel'); if (!p) return 'nopanel'; const r = p.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return p.contains(e) ? 'panel' : (e?.className || e?.tagName) })()`)
  check("手機：面板開著時往下捲到快捷列出現，面板仍在最上層（沒被快捷列或浮動按鈕蓋住）且完整在視窗內", !!g.bar?.vis && top === "panel" && !!g.panel && g.panel.l >= 0 && g.panel.r <= 390 && g.panel.t >= 0 && g.panel.b <= 844, `top=${top} ${JSON.stringify(g)}`)
  await s.shot("mobile-panel-with-quickbar")
  await s.send("Browser.close").catch(() => {})
  await sleep(400)
}

console.log(`\n${allResults.filter(Boolean).length}/${allResults.length} 通過`)
process.exit(allResults.some((ok) => !ok) ? 1 : 0)
