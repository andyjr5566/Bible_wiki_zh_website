// 首頁刊頭與區塊順序的端對端檢查（無頭 Chrome / CDP），對 test_content 建出的小站跑。
// 要驗證的規則：網站標題（h1）＋兩行介紹在最上面，接著才是導覽卡與入口（有閱讀紀錄時入口在前），再來是文章其餘內容。
//   (1) 首頁 × 有／無閱讀紀錄 × 淺深 × 1440／834／390：順序、第一次繪製不跳動、只有一個可見 h1、
//       原本的 h1／引言／分隔線已隱藏、刊頭與原件外觀一致、刊頭 h1 帶原件的 id（沒有 aria 指向它）、沒有橫向捲動
//   (2) SPA 換頁：章節頁 → 首頁 → 章節頁，章節頁自己的 h1 不受影響；點右欄目錄第一項（整頁載入與 SPA 換頁後）會捲到刊頭
//   (3) 懸浮預覽：預覽首頁時不顯示第二份刊頭，也不會藏掉目前頁面的標題
//   (4) 退回原狀（選填第 4 個參數）：index.md 第一個不是 h1 的站，不畫刊頭、文章的 h1 照常顯示
//   (5) axe 的標題規則（選填第 5 個參數，axe.min.js 的路徑）：heading-order、page-has-heading-one、empty-heading 都沒有違規
// 用法：node e2e/ordercheck.mjs <siteRoot，結尾不加 /> <profile> <shotDir> [第一個不是 h1 的站的 siteRoot] [axe.min.js]
// axe-core 不放進專案（只在本機檢查用），路徑由參數給。
import { mkdirSync, readFileSync } from "node:fs"
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"

const [root, profile, shotDir, fallbackRoot, axePath] = process.argv.slice(2)
if (!root || !profile || !shotDir) {
  console.error("用法：node e2e/ordercheck.mjs <siteRoot> <profile> <shotDir> [fallbackSiteRoot]")
  process.exit(2)
}
mkdirSync(shotDir, { recursive: true })

const CH2 = "/" + encodeURI("01-創世記/第2章")
const HOME = "/index.html?skip=1"
const DAY = 86_400_000
const seedRecord = () => JSON.stringify({ v: 1, books: { "01-創世記": { slug: "01-創世記/第2章", ratio: 0.5, t: Date.now() - DAY } } })

const s = await startBrowser({ root, profile, width: 1440, height: 900, shotDir, detailMax: Infinity })
const { ev, send, check, errors, finish } = s

async function waitFor(expr, timeoutMs = 15000, every = 200) {
  const end = Date.now() + timeoutMs
  let v
  while (Date.now() < end) {
    try { v = await ev(expr) } catch { v = undefined }
    if (v) return v
    await sleep(every)
  }
  return v
}
async function open(base, path, ready = "true", timeoutMs = 20000) {
  const target = new URL(base + path)
  await send("Page.navigate", { url: target.href })
  return waitFor(`location.pathname === ${JSON.stringify(target.pathname)} && document.readyState === 'complete' && !!document.querySelector('article') && (${ready})`, timeoutMs)
}

// 每個畫面幀記下刊頭、導覽卡、入口的先後（M／T／H 依由上到下排成字串）、刊頭相對於中欄頂端的位置、可見的 h1 數量
// （手機上中欄本身會因為頁首載入而整個位移，那和刊頭無關，所以量相對位置）
const SAMPLER = `(() => {
  window.__frames = []
  const sample = () => {
    const m = document.querySelector('.bwz-masthead'), t = document.querySelector('.wiki-tour-launcher'), h = document.querySelector('.bwz-hub')
    if (h) {
      const items = [['M', m], ['T', t], ['H', h]].filter(([, e]) => e).map(([k, e]) => [k, e.getBoundingClientRect().top])
      window.__frames.push({ order: items.sort((a, b) => a[1] - b[1]).map(([k]) => k).join(''), mastTop: m ? Math.round(m.getBoundingClientRect().top - document.querySelector('.center').getBoundingClientRect().top) : -1, h1: [...document.querySelectorAll('h1')].filter((e) => e.checkVisibility()).length })
    }
    if (performance.now() < 2500) requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)
})()`
const sampler = (await send("Page.addScriptToEvaluateOnNewDocument", { source: SAMPLER }))?.identifier

// 刊頭與文章原件的外觀要一致（原件被隱藏，computed style 仍然算得出來）
const STYLE_PARITY = `(() => {
  const props = ["fontFamily","fontSize","fontWeight","color","textAlign","letterSpacing","lineHeight","marginTop","marginBottom","paddingTop","paddingBottom","paddingLeft","paddingRight","borderLeftWidth","borderLeftColor","backgroundColor","borderRadius","position"]
  const pairs = [["h1", ".bwz-masthead h1", "article .markdown-rendered > h1"], ["blockquote", ".bwz-masthead blockquote", "article .markdown-rendered > blockquote"], ["p", ".bwz-masthead blockquote p", "article .markdown-rendered > blockquote p"]]
  const bad = []
  for (const [name, a, b] of pairs) {
    const x = document.querySelector(a), y = document.querySelector(b)
    if (!x || !y) { bad.push(name + ":missing"); continue }
    const cx = getComputedStyle(x), cy = getComputedStyle(y)
    for (const p of props) if (cx[p] !== cy[p]) bad.push(name + "." + p + " " + cx[p] + " / " + cy[p])
  }
  const ax = getComputedStyle(document.querySelector(".bwz-masthead h1"), "::after"), ay = getComputedStyle(document.querySelector("article .markdown-rendered > h1"), "::after")
  for (const p of ["content", "fontSize", "color", "marginTop", "opacity", "display"]) if (ax[p] !== ay[p]) bad.push("h1::after." + p)
  return bad
})()`

const STATE = `(() => {
  const vis = (e) => !!e && e.checkVisibility()
  const art = document.querySelector("article .markdown-rendered")
  const kids = [...art.children]
  const orig = { h1: kids[0], q: kids[1], hr: kids[2] }
  const firstShown = kids.find((e) => e.checkVisibility())
  // 刊頭的 h1 帶和原件相同的 id（目錄與 #標題 才捲得到），刊頭裡只有這一個 id；getElementById 先找到刊頭的；
  // 沒有任何 aria 屬性指向這個 id（頁面上別處本來就有重複的 list-0，那是左欄探索與目錄的，和刊頭無關）
  const origId = orig.h1?.id
  const mastIds = [...document.querySelectorAll(".bwz-masthead [id]")].map((e) => e.id)
  const idCount = origId ? document.querySelectorAll("#" + CSS.escape(origId)).length : 0
  const firstById = origId ? document.getElementById(origId) : null
  const idInMasthead = !!firstById?.closest(".bwz-masthead") && firstById.tagName === "H1"
  const ariaRefs = origId ? [...document.querySelectorAll("[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns],[aria-activedescendant],[aria-details],[aria-errormessage],label[for]")].filter((e) => ["aria-labelledby","aria-describedby","aria-controls","aria-owns","aria-activedescendant","aria-details","aria-errormessage","for"].some((a) => (e.getAttribute(a) || "").split(" ").includes(origId))).length : -1
  const headEls = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter((e) => e.checkVisibility())
  const heads = headEls.map((e) => e.getAttribute("aria-level") ? +e.getAttribute("aria-level") : +e.tagName[1])
  // 第一個可見的 h1 之後，標題層級不可以一次跳兩級以上（桌機左欄的 h2 在中欄之前，本來就在 h1 前面）
  const fromH1 = heads.slice(heads.indexOf(1))
  const skip = fromH1.some((lv, i) => i > 0 && lv > fromH1[i - 1] + 1)
  const firstH1IsMasthead = headEls.find((e) => e.tagName === "H1")?.closest(".bwz-masthead") !== null
  const m = document.querySelector(".bwz-masthead"), t = document.querySelector(".wiki-tour-launcher"), h = document.querySelector(".bwz-hub")
  const top = (e) => Math.round(e.getBoundingClientRect().top + scrollY)
  return {
    top: { m: m && top(m), t: t && top(t), h: h && top(h), art: top(art) },
    visibleH1: [...document.querySelectorAll("h1")].filter((e) => e.checkVisibility()).map((e) => (e.closest(".bwz-masthead") ? "masthead" : e.className || "other")),
    mastText: m?.querySelector("h1")?.textContent,
    origText: orig.h1?.textContent,
    quoteSame: m?.querySelector("blockquote")?.textContent === orig.q?.textContent,
    hidden: { h1: !vis(orig.h1), q: !vis(orig.q), hr: orig.hr?.tagName === "HR" ? !vis(orig.hr) : null },
    firstShown: firstShown?.tagName,
    mastIds, origId, idCount, idInMasthead, ariaRefs,
    headings: heads,
    skip,
    firstH1IsMasthead,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    attr: document.querySelector(".bwz-masthead")?.getAttribute("data-bwz-masthead"),
  }
})()`

// SPA 換頁剛結束時 DOM 可能還在替換，量不到就等一下再量（最多 10 次，每次都印出原因，方便事後查）
async function getState() {
  for (let i = 0; i < 10; i++) {
    const r = await send("Runtime.evaluate", { expression: STATE, returnByValue: true, awaitPromise: true })
    if (r?.result?.value) return r.result.value
    console.log("  （量測失敗，重試）" + (r?.exceptionDetails?.exception?.description ?? r?.exceptionDetails?.text ?? "沒有回應").slice(0, 200))
    await sleep(500)
  }
  return null
}

// ---------- (1) 首頁 × 紀錄 × 淺深 × 寬度 ----------
await send("Network.enable")
await send("Network.clearBrowserCache")
const VIEWS = [["1440", 1440, 900, false], ["834", 834, 1112, false], ["390", 390, 844, true]]
for (const [name, w, h, mobile] of VIEWS) {
  await s.setViewport(w, h, { dpr: mobile ? 2 : 1, mobile, touch: mobile })
  for (const theme of ["light", "dark"]) {
    for (const withRecord of [false, true]) {
      const tag = `${withRecord ? "有紀錄" : "無紀錄"} ${name} ${theme === "dark" ? "深" : "淺"}`
      // 先在關掉取樣器的狀態下寫好 localStorage，再開取樣器載入，才量得到第一次繪製
      await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: sampler })
      await open(root, HOME, "true")
      await ev(`(() => { localStorage.clear(); localStorage.setItem('theme', ${JSON.stringify(theme)}); ${withRecord ? `localStorage.setItem('bwz-reading', ${JSON.stringify(seedRecord())});` : ""} })()`)
      const again = await send("Page.addScriptToEvaluateOnNewDocument", { source: SAMPLER })
      await open(root, HOME, `!!document.querySelector('.bwz-hub') && !!document.querySelector('.wiki-tour-launcher')`)
      await sleep(2800)
      const frames = (await ev(`window.__frames`)) ?? []
      await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: again?.identifier })
      const want = withRecord ? "MHT" : "MTH"
      const orders = [...new Set(frames.map((f) => f.order))]
      check(`${tag}：每一幀（含第一次繪製）順序都是 ${want}（刊頭、${withRecord ? "入口、導覽卡" : "導覽卡、入口"}）`, frames.length > 5 && orders.length === 1 && orders[0] === want, `${frames.length} 幀，順序 ${orders.join("/")}`)
      const mastTops = frames.map((f) => f.mastTop)
      const shift = mastTops.length ? Math.max(...mastTops) - Math.min(...mastTops) : -1
      check(`${tag}：刊頭載入過程相對中欄的位移 ≤ 2px`, shift >= 0 && shift <= 2, `位移 ${shift}px`)
      check(`${tag}：每一幀都只有一個可見的 h1`, frames.length > 5 && frames.every((f) => f.h1 === 1), [...new Set(frames.map((f) => f.h1))].join("/"))

      const st = await getState()
      const sorted = Object.entries({ M: st.top.m, T: st.top.t, H: st.top.h }).sort((a, b) => a[1] - b[1]).map(([k]) => k).join("")
      check(`${tag}：最後的版面順序是 ${want}，文章在入口後面`, sorted === want && st.top.art > Math.max(st.top.h, st.top.t), JSON.stringify(st.top))
      check(`${tag}：頁面上只有一個可見的 h1，而且是刊頭的`, st.visibleH1.length === 1 && st.visibleH1[0] === "masthead", JSON.stringify(st.visibleH1))
      check(`${tag}：刊頭的文字就是文章裡原件的文字（單一來源）`, !!st.mastText && st.mastText === st.origText && st.quoteSame, `${st.mastText} / ${st.origText}`)
      check(`${tag}：文章裡原本的 h1、引言、分隔線都隱藏，文章從下一個區塊開始`, st.hidden.h1 && st.hidden.q && st.hidden.hr === true && ["H2", "DETAILS"].includes(st.firstShown), JSON.stringify({ hidden: st.hidden, firstShown: st.firstShown }))
      check(`${tag}：刊頭 h1 帶原件的 id、getElementById 先找到刊頭、沒有 aria 指向它`, st.mastIds.length === 1 && st.mastIds[0] === st.origId && st.idCount === 2 && st.idInMasthead && st.ariaRefs === 0, JSON.stringify({ mastIds: st.mastIds, idCount: st.idCount, idInMasthead: st.idInMasthead, ariaRefs: st.ariaRefs }))
      check(`${tag}：第一個可見的 h1 是刊頭的，其後標題層級沒有跳級`, st.firstH1IsMasthead && !st.skip, st.headings.join(","))
      const bad = await ev(STYLE_PARITY)
      check(`${tag}：刊頭的標題、引言外觀和原件一致`, bad.length === 0, bad.join("；"))
      check(`${tag}：沒有橫向捲動`, st.sw <= st.iw, `scrollWidth ${st.sw} / ${st.iw}`)
      await ev(`window.scrollTo(0, 0)`)
      await s.shot(`order-${withRecord ? "has" : "none"}-${name}-${theme}`)
    }
  }
}
await s.setViewport(1440, 900)

// ---------- (2) SPA：章節頁 → 首頁 → 章節頁 ----------
await open(root, HOME, "true")
await ev(`(() => { localStorage.clear(); localStorage.setItem('theme', 'light') })()`)
await open(root, CH2 + "?skip=1", `!!document.querySelector('h1.article-title')`)
check("章節頁：沒有刊頭，文章自己的 h1 可見、只有一個可見 h1", await ev(`!document.querySelector('.bwz-masthead') && !!document.querySelector('article .markdown-rendered > h1:first-child')?.checkVisibility() && [...document.querySelectorAll('h1')].filter((e) => e.checkVisibility()).length === 1`))
await ev(`document.querySelector('.page-title a').click()`)
await waitFor(`document.body.dataset.slug === 'index' && !!document.querySelector('.bwz-masthead')`, 10000)
await sleep(600)
const spaHome = await getState()
check("SPA 進首頁：刊頭出現、只有一個可見 h1、原件隱藏", spaHome?.visibleH1.length === 1 && spaHome?.visibleH1[0] === "masthead" && spaHome?.hidden.h1 && spaHome?.hidden.q && spaHome?.hidden.hr === true, JSON.stringify({ v: spaHome?.visibleH1, h: spaHome?.hidden }))
await ev(`document.querySelector('.bwz-hub a.bwz-bg-book[href*="01-"]')?.click()`)
await waitFor(`document.body.dataset.slug !== 'index'`, 10000)
await sleep(800)
const spaOut = await ev(`(() => ({ mast: document.querySelectorAll('.bwz-masthead').length, vis: [...document.querySelectorAll('h1')].filter((e) => e.checkVisibility()).length, first: document.querySelector('article .markdown-rendered > h1')?.checkVisibility() ?? null, slug: document.body.dataset.slug }))()`)
check("SPA 離開首頁：刊頭消失，目前頁面的標題不會被隱藏規則誤傷", spaOut.mast === 0 && spaOut.vis === 1, JSON.stringify(spaOut))
await ev(`history.back()`)
await waitFor(`document.body.dataset.slug === 'index' && !!document.querySelector('.bwz-masthead')`, 10000)
await sleep(500)
const spaBack = await getState()
check("SPA 上一頁回首頁：刊頭仍在、只有一個可見 h1", spaBack?.visibleH1.length === 1 && spaBack?.visibleH1[0] === "masthead", JSON.stringify(spaBack?.visibleH1))

// ---------- (2b) 右欄目錄第一項（連到原件的 id）要捲到刊頭 ----------
const TOC_CLICK = `(async () => {
  const link = document.querySelector('.toc-content a')
  const id = decodeURIComponent((link?.getAttribute('href') || '').slice(1))
  window.scrollTo({ top: 1500, behavior: 'instant' })
  await new Promise((r) => setTimeout(r, 400))
  const before = Math.round(scrollY)
  link.click()
  await new Promise((r) => setTimeout(r, 1200))
  const h = document.querySelector('.bwz-masthead h1')
  const r = h.getBoundingClientRect()
  return { id, same: id === h.id, before, after: Math.round(scrollY), top: Math.round(r.top), vis: r.top >= 0 && r.bottom <= innerHeight, hash: decodeURIComponent(location.hash.slice(1)) === id }
})()`
await open(root, HOME, `!!document.querySelector('.toc-content a')`)
await sleep(1000)
const toc1 = await ev(TOC_CLICK)
check("目錄第一項（整頁載入的首頁，1440）：捲到刊頭，刊頭標題在畫面內", !!toc1 && toc1.same && toc1.before >= 1000 && toc1.after < 400 && toc1.vis && toc1.hash, JSON.stringify(toc1))
await open(root, CH2 + "?skip=1", `!!document.querySelector('.page-title a')`)
await ev(`document.querySelector('.page-title a').click()`)
await waitFor(`document.body.dataset.slug === 'index' && !!document.querySelector('.bwz-masthead') && !!document.querySelector('.toc-content a')`, 10000)
await sleep(1000)
const toc2 = await ev(TOC_CLICK)
check("目錄第一項（SPA 換頁到首頁後，1440）：捲到刊頭，刊頭標題在畫面內", !!toc2 && toc2.same && toc2.before >= 1000 && toc2.after < 400 && toc2.vis && toc2.hash, JSON.stringify(toc2))

// ---------- (3) 懸浮預覽 ----------
await open(root, CH2 + "?skip=1", `!!document.querySelector('article .markdown-rendered')`)
await sleep(800)
await ev(`(() => { const a = document.createElement('a'); a.className = 'internal'; a.id = 'bwz-order-probe'; a.href = '../index'; a.dataset.slug = 'index'; a.textContent = '首頁預覽探針'; const p = document.querySelector('article .markdown-rendered p') || document.querySelector('article .markdown-rendered'); p.appendChild(a); document.dispatchEvent(new CustomEvent('nav', { detail: { url: location.pathname } })) })()`)
await sleep(800)
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 })
const box = await ev(`(() => { const r = document.getElementById('bwz-order-probe').getBoundingClientRect(); document.getElementById('bwz-order-probe').scrollIntoView({ block: 'center' }); const r2 = document.getElementById('bwz-order-probe').getBoundingClientRect(); return { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 } })()`)
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y })
const shown = await waitFor(`!!document.querySelector('.popover.active-popover')`, 8000)
await sleep(500)
const pop = await ev(`(() => { const p = document.querySelector('.popover.active-popover'); const hs = p ? [...p.querySelectorAll('h1')].filter((e) => e.checkVisibility()) : []; return { inPopover: !!p, isHome: !!p?.querySelector('.bwz-masthead, .bwz-hub'), mastShown: !![...document.querySelectorAll('.popover .bwz-masthead')].find((e) => e.checkVisibility()), popH1: hs.map((e) => e.textContent.trim()), pageH1: !!document.querySelector('.center article .markdown-rendered > h1:first-child')?.checkVisibility() }})()`)
await s.shot("order-popover")
check("懸浮預覽：預覽首頁時出現預覽視窗，內容是首頁", !!shown && pop.inPopover && pop.isHome, JSON.stringify(pop))
check("懸浮預覽：預覽裡標題只出現一次（文章自己的，不顯示第二份刊頭）", !pop.mastShown && pop.popH1.length === 1, JSON.stringify(pop))
check("懸浮預覽：目前頁面（章節頁）的標題沒有被藏掉", pop.pageH1, JSON.stringify(pop))

// ---------- (4) 退回原狀 ----------
if (fallbackRoot) {
  await s.setViewport(1440, 900)
  await open(fallbackRoot, HOME, `!!document.querySelector('.bwz-hub')`)
  await sleep(1200)
  const fb = await ev(`(() => {
    const art = document.querySelector('article .markdown-rendered'), kids = [...art.children], h1 = art.querySelector(':scope > h1')
    return { mast: document.querySelectorAll('.bwz-masthead').length, hub: !!document.querySelector('.bwz-hub'), visH1: [...document.querySelectorAll('h1')].filter((e) => e.checkVisibility()).length,
      h1Shown: !!h1?.checkVisibility(), firstTag: kids[0]?.tagName, hrShown: kids.filter((e) => e.tagName === 'HR').every((e) => e.checkVisibility()), sw: document.documentElement.scrollWidth, iw: innerWidth }
  })()`)
  await s.shot("order-fallback")
  check("退回原狀：第一個不是 h1 的 index.md 不畫刊頭，入口照常", fb.mast === 0 && fb.hub && fb.firstTag === "P", JSON.stringify(fb))
  check("退回原狀：文章的 h1 與分隔線照常顯示，頁面只有一個可見 h1", fb.h1Shown && fb.hrShown && fb.visH1 === 1, JSON.stringify(fb))
  check("退回原狀：沒有橫向捲動", fb.sw <= fb.iw)
}

// ---------- (5) axe 標題規則 ----------
if (axePath) {
  const axeSource = readFileSync(axePath, "utf8")
  const HEADING_RULES = ["heading-order", "page-has-heading-one", "empty-heading"]
  const runAxe = () => ev(`(async () => {
    if (!window.axe) { const el = document.createElement('script'); el.textContent = ${JSON.stringify(axeSource)}; document.head.appendChild(el) }
    const r = await axe.run(document, { runOnly: ${JSON.stringify(HEADING_RULES)}, resultTypes: ['violations', 'passes'] })
    return JSON.stringify({ violations: r.violations.map((v) => v.id + '×' + v.nodes.length), passed: r.passes.map((v) => v.id) })
  })()`)
  const axeStates = []
  for (const [name, w, h, mobile] of [["1440", 1440, 900, false], ["390", 390, 844, true]]) {
    for (const theme of ["light", "dark"]) for (const withRecord of [false, true]) axeStates.push([root, name, w, h, mobile, theme, withRecord])
  }
  if (fallbackRoot) axeStates.push([fallbackRoot, "1440", 1440, 900, false, "light", false, "（退回原狀的站）"])
  for (const [base, name, w, h, mobile, theme, withRecord, note = ""] of axeStates) {
    await s.setViewport(w, h, { dpr: mobile ? 2 : 1, mobile, touch: mobile })
    await open(base, HOME, "true")
    await ev(`(() => { localStorage.clear(); localStorage.setItem('theme', ${JSON.stringify(theme)}); ${withRecord ? `localStorage.setItem('bwz-reading', ${JSON.stringify(seedRecord())});` : ""} })()`)
    await open(base, HOME, `!!document.querySelector('.bwz-hub')`)
    await sleep(1500)
    const r = JSON.parse(await runAxe())
    check(`axe 標題規則 ${withRecord ? "有紀錄" : "無紀錄"} ${name} ${theme === "dark" ? "深" : "淺"}${note}：沒有違規，且 3 條規則都真的檢查過`, r.violations.length === 0 && HEADING_RULES.every((id) => r.passed.includes(id)), `違規 ${r.violations.join("、") || "無"}；通過 ${r.passed.join("、")}`)
  }
}

check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 3).join(" | "))
finish()
