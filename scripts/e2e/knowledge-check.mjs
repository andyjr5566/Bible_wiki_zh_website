// 用法：node scripts/e2e/knowledge-check.mjs <站台根網址> <profile 資料夾> [--shots <資料夾>] [--axe <axe.min.js 路徑>]
// 驗證知識節點（link_folder）總入口與類別頁：標題置中、類別卡與印章、分類導航單行並捲到目前分類、
// 書卷面板預設收合、篩選（書卷、關鍵字、網址參數、清除）、SPA 換類別後篩選仍可用、手機不橫向捲動。
// 站台要先掛在 /Bible_wiki_zh_website/ 底下（plugins/personal-notes/e2e/subpath-server.mjs）。
import { mkdirSync, readFileSync } from "node:fs"
import { clickSel, open, sleep, waitFor } from "../../plugins/verse-return/e2e/helpers.mjs"

const args = process.argv.slice(2)
const root = (args[0] ?? "").replace(/\/+$/, "")
const profileRoot = args[1] ?? ""
const shotsIndex = args.indexOf("--shots")
const shotDir = shotsIndex >= 0 ? args[shotsIndex + 1] : undefined
const axeIndex = args.indexOf("--axe")
const axeSource = axeIndex >= 0 ? readFileSync(args[axeIndex + 1], "utf8") : null
if (!root || !profileRoot) {
  console.error("用法：node scripts/e2e/knowledge-check.mjs <站台根網址> <profile 資料夾> [--shots <資料夾>]")
  process.exit(2)
}
if (shotDir) mkdirSync(shotDir, { recursive: true })

const hubPath = "/link_folder/"
const catPath = (name) => `/link_folder/${encodeURIComponent(name)}/`

const s = await open({ root, profileRoot, shotDir })
const { check, ev, go } = s

// 有垂直捲軸時 clientWidth 比視窗窄 15px，和視窗寬度比才準
const overflowX = () => ev(`document.documentElement.scrollWidth - window.innerWidth`)
const visible = (sel) =>
  `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' })()`

for (const [label, width, height, mobile] of [
  ["桌面", 1280, 900, false],
  ["手機", 390, 844, true],
]) {
  await s.setViewport(width, height, { dpr: 1, mobile, touch: mobile })

  /* ---------- 總入口 ---------- */
  await go(hubPath, 3500)
  const cards = await ev(`document.querySelectorAll('.bwz-kn-hub a.bwz-kn-card').length`)
  check(`${label}：總入口有類別卡`, cards >= 11, cards)
  const seals = await ev(`[...document.querySelectorAll('.bwz-kn-hub .bwz-kn-seal')].map(e => e.textContent).join('')`)
  check(`${label}：每張卡有印章（類別名的第一個字）`, seals.length === cards && seals.includes("人") && seals.includes("互"), seals)
  const h1 = JSON.parse(await ev(`(() => { const h = document.querySelector('article h1'); const r = h.getBoundingClientRect(); const a = document.querySelector('article').getBoundingClientRect(); return JSON.stringify({ text: h.textContent, mid: Math.abs((r.left + r.right) / 2 - (a.left + a.right) / 2), shown: r.height > 0 }) })()`))
  check(`${label}：標題「知識節點」置中`, h1.text === "知識節點" && h1.shown && h1.mid < 6, JSON.stringify(h1))
  check(`${label}：標題只有一個（Quartz 的小字頁名已藏起來）`, (await ev(`[...document.querySelectorAll('article h1, .article-title')].filter(e => e.getBoundingClientRect().height > 0).length`)) === 1)
  check(`${label}：總入口沒有 <p>（Aa 字級面板只放大 article 裡的 p）`, (await ev(`document.querySelectorAll('.bwz-kn p').length`)) === 0)
  check(`${label}：總入口不橫向捲動`, (await overflowX()) <= 1, await overflowX())
  const cardPlaced = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.bwz-kn-hub a.bwz-kn-card')].map(a => { const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }))`))
  check(`${label}：卡片大小合理`, cardPlaced.every(([w, h]) => w >= 200 && h >= 100), JSON.stringify(cardPlaced.slice(0, 3)))
  await s.shot(`hub-${label}`)

  /* ---------- 類別頁：人物 ---------- */
  await go(catPath("人物"), 3500)
  check(`${label}：類別頁標題「人物」置中`, (await ev(`document.querySelector('article h1')?.textContent`)) === "人物")
  check(`${label}：類別頁沒有 <p>`, (await ev(`document.querySelectorAll('.bwz-kn p').length`)) === 0)
  check(`${label}：類別頁不橫向捲動`, (await overflowX()) <= 1, await overflowX())

  const pills = JSON.parse(await ev(`(() => { const nav = document.querySelector('.bwz-kn-pills'); const items = [...nav.querySelectorAll('a.bwz-kn-pill')]; const tops = new Set(items.map(a => Math.round(a.getBoundingClientRect().top))); const cur = nav.querySelector('[aria-current=page]'); const n = nav.getBoundingClientRect(); const c = cur.getBoundingClientRect(); return JSON.stringify({ count: items.length, rows: tops.size, scrolls: nav.scrollWidth > nav.clientWidth, curInside: c.left >= n.left - 1 && c.right <= n.right + 1 }) })()`))
  check(`${label}：同層分類導航只有一行`, pills.rows === 1 && pills.count >= 12, JSON.stringify(pills))
  check(`${label}：目前的分類在導航可見範圍內`, pills.curInside, JSON.stringify(pills))

  check(`${label}：篩選工具列顯示`, await waitFor(s, visible(".bwz-kn-tools"), 3000))
  check(`${label}：書卷面板預設收合`, (await ev(`document.querySelector('[data-kn-books]').hidden`)) === true && (await ev(`document.querySelector('[data-kn-books-toggle]').getAttribute('aria-expanded')`)) === "false")
  const total = await ev(`document.querySelectorAll('.bwz-kn-list a.bwz-kn-chip').length`)
  const topChips = await ev(`document.querySelectorAll('.bwz-kn-top a.bwz-kn-chip').length`)

  await clickSel(s, "[data-kn-books-toggle]")
  await sleep(300)
  check(`${label}：按「依書卷篩選」展開面板`, (await ev(`document.querySelector('[data-kn-books]').hidden`)) === false && (await ev(`document.querySelector('[data-kn-books-toggle]').getAttribute('aria-expanded')`)) === "true")
  await s.shot(`books-open-${label}`)

  await clickSel(s, '.bwz-kn-book[data-book="創世記"]')
  await sleep(400)
  const afterBook = JSON.parse(await ev(`JSON.stringify({ panelHidden: document.querySelector('[data-kn-books]').hidden, label: document.querySelector('[data-kn-books-label]').textContent, status: document.querySelector('[data-kn-status]').textContent, url: location.search, shown: document.querySelectorAll('.bwz-kn-list li:not([hidden])').length, topHidden: document.querySelector('[data-kn-top]')?.hidden ?? true, clear: !document.querySelector('[data-kn-clear]').hidden })`))
  check(`${label}：選書卷後面板收起、按鈕顯示「書卷：創世記」`, afterBook.panelHidden && afterBook.label === "書卷：創世記", JSON.stringify(afterBook))
  check(`${label}：選書卷後清單變少、網址記下 ?book=`, afterBook.shown > 0 && afterBook.shown < total && decodeURIComponent(afterBook.url).includes("book=創世記"), JSON.stringify(afterBook))
  check(`${label}：篩選時隱藏「最常讀到」、出現清除鈕`, afterBook.topHidden && afterBook.clear, JSON.stringify(afterBook))

  await s.ev(`(() => { const i = document.querySelector('[data-kn-filter]'); i.value = '亞伯'; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await sleep(300)
  const afterText = await ev(`document.querySelectorAll('.bwz-kn-list li:not([hidden])').length`)
  check(`${label}：再加關鍵字「亞伯」後更少`, afterText > 0 && afterText < afterBook.shown, afterText)
  await s.shot(`filtered-${label}`)

  await clickSel(s, "[data-kn-clear]")
  await sleep(300)
  const cleared = JSON.parse(await ev(`JSON.stringify({ shown: document.querySelectorAll('.bwz-kn-list li:not([hidden])').length, label: document.querySelector('[data-kn-books-label]').textContent, url: location.search, topShown: !document.querySelector('[data-kn-top]')?.hidden })`))
  check(`${label}：清除篩選後回到完整清單`, cleared.shown === total && cleared.label === "依書卷篩選" && cleared.url === "" && (topChips === 0 || cleared.topShown), JSON.stringify(cleared))

  // 網址帶 ?book=：重新整理後維持同一個畫面
  await go(`${catPath("人物")}?book=${encodeURIComponent("出埃及記")}`, 3500)
  const fromUrl = JSON.parse(await ev(`JSON.stringify({ label: document.querySelector('[data-kn-books-label]').textContent, shown: document.querySelectorAll('.bwz-kn-list li:not([hidden])').length })`))
  check(`${label}：網址 ?book=出埃及記 開頁就是篩選後的畫面`, fromUrl.label === "書卷：出埃及記" && fromUrl.shown > 0 && fromUrl.shown < total, JSON.stringify(fromUrl))

  /* ---------- 互文（長標題類別）---------- */
  await go(catPath("互文"), 3500)
  check(`${label}：互文頁不橫向捲動`, (await overflowX()) <= 1, await overflowX())
  const wide = JSON.parse(await ev(`(() => { const ul = document.querySelector('.bwz-kn-list .bwz-kn-chips'); const cs = getComputedStyle(ul); return JSON.stringify({ colw: cs.columnWidth, cols: Math.round(ul.getBoundingClientRect().width / parseFloat(cs.columnWidth)) }) })()`))
  check(`${label}：互文頁的條目欄寬比人物頁寬（名稱是整句）`, parseFloat(wide.colw) >= 200, JSON.stringify(wide))
  const nowrap = await ev(`[...document.querySelectorAll('.bwz-kn-top .bwz-kn-chip-n')].every(n => { const r = document.createRange(); r.selectNodeContents(n); return r.getClientRects().length === 1 })`)
  check(`${label}：「最常讀到」的章數不斷成兩行`, nowrap === true)
  await s.shot(`wide-${label}`)
}

/* ---------- SPA 換頁：從人物點到另一類，篩選仍可用 ---------- */
await s.setViewport(1280, 900)
await go(catPath("人物"), 3500)
await ev(`document.querySelector('.bwz-kn-pill[data-cat="地點"]').click()`)
await waitFor(s, `location.pathname.includes('${encodeURIComponent("地點")}') && !!document.querySelector('.bwz-kn-cat[data-cat="地點"]')`, 6000)
await sleep(800)
check("SPA 換到「地點」後標題與工具列都是新的", (await ev(`document.querySelector('article h1')?.textContent`)) === "地點" && (await waitFor(s, visible(".bwz-kn-tools"), 3000)))
await clickSel(s, "[data-kn-books-toggle]")
await sleep(300)
check("SPA 換頁後書卷面板還能展開", (await ev(`document.querySelector('[data-kn-books]').hidden`)) === false)

/* ---------- 條目連結 ---------- */
await go(catPath("人物"), 3500)
const entryHref = await ev(`document.querySelector('.bwz-kn-list a.bwz-kn-chip').getAttribute('href')`)
await clickSel(s, ".bwz-kn-list a.bwz-kn-chip")
await sleep(2500)
check("點條目進到條目頁", (await ev(`location.pathname`)).includes("link_folder") && !(await ev(`location.pathname`)).endsWith("/人物/"), entryHref)

check("沒有執行期錯誤", s.errors.length === 0, s.errors.join(" | "))

/* ---------- axe 無障礙：淺深色 × 桌面／手機 × 總入口與兩種類別頁（critical／serious 就失敗）---------- */
if (axeSource) {
  for (const [w, h, mobile] of [[1280, 900, false], [390, 844, true]]) {
    for (const theme of ["light", "dark"]) {
      const a = await open({ root, profileRoot, theme, width: w, height: h, mobile })
      for (const path of [hubPath, catPath("人物"), catPath("互文")]) {
        await a.go(path, 3500)
        await a.ev(axeSource)
        const out = JSON.parse(await a.ev(`axe.run(document, { resultTypes: ['violations'] }).then((r) => JSON.stringify(r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))))`))
        check(`axe ${decodeURIComponent(path)} ${w} ${theme}`, out.length === 0, JSON.stringify(out))
      }
      a.send("Browser.close").catch(() => {})
    }
  }
}
s.finish()
