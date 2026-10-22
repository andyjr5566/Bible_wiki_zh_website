// 「回到剛才的經節」：無頭 Chrome（CDP）驗證。重用 plugins/personal-notes/e2e/lib.mjs（不修改它）。
// 用法：node e2e/check.mjs <root> <profileRoot> <shotDir>
//   root         站台網址（子路徑），例如 http://localhost:8172/Bible_wiki_zh_website
//   profileRoot  放 Chrome user-data-dir 的資料夾
//   shotDir      截圖資料夾
// 站台內容：先用 node e2e/make-content.mjs <test_content> <輸出資料夾> 產生（test_content 加上幾個「知識節點」條目），
// 再用 node quartz/bootstrap-cli.mjs build -d <輸出資料夾> 建站。直接用 test_content 建的站，經文連結都指向不存在的條目，
// 條目之間連續跳與懸停預覽的檢查沒有東西可測。
import { mkdirSync } from "node:fs"
import {
  chapterPath, entryPath, open, clickSel, centerOf, mouse, sleep, waitFor, rectOf, intersects,
  contrastExpr, storedPoint, scrollY, urlPath,
} from "./helpers.mjs"

const [ROOT, profileRoot, shotDir] = process.argv.slice(2)
if (!ROOT || !profileRoot || !shotDir) {
  console.error("用法：node e2e/check.mjs <root> <profileRoot> <shotDir>")
  process.exit(2)
}
mkdirSync(shotDir, { recursive: true })
const all = []
const mk = async (opts = {}) => {
  const s = await open({ root: ROOT, profileRoot, shotDir, ...opts })
  const orig = s.check
  s.check = (name, ok, detail = "") => { all.push(ok); orig(name, ok, detail) }
  return s
}
const close = (s) => { s.send("Browser.close").catch(() => {}) }
const BTN = ".bwz-vr-go"
const VERSE7 = "article ol li:nth-child(7) a.internal"
const labelOf = (s) => s.ev(`document.querySelector('${BTN}')?.textContent ?? null`)
const ariaOf = (s) => s.ev(`document.querySelector('${BTN}')?.getAttribute('aria-label') ?? null`)
const hasBtn = (s) => s.ev(`!!document.querySelector('.bwz-vr')`)
const sleepNav = () => sleep(1200)

// 從第 2 章第 7 節的連結走到條目（真實滑鼠點擊）
async function verseToEntry(s, verse = 7) {
  await s.go(chapterPath(2), 3500)
  await clickSel(s, `article ol li:nth-child(${verse}) a.internal`)
  await waitFor(s, `!!document.querySelector('${BTN}')`, 6000)
}

// ======================================================================
console.log("\n== 1. 桌機 1440：記錄、顯示、位置 ==")
for (const theme of ["light", "dark"]) {
  const s = await mk({ theme, width: 1440, height: 900 })
  const { check } = s
  await s.go(chapterPath(2), 3500)
  check(`[${theme}] 章節頁一開始沒有返回按鈕、沒有返回點`, !(await hasBtn(s)) && (await storedPoint(s)) === null)
  await verseToEntry(s, 7)
  check(`[${theme}] 點第 7 節的連結進條目：按鈕文字是「↩ 返回 創世記 2:7」`, (await labelOf(s)) === "↩ 返回 創世記 2:7", await labelOf(s))
  check(`[${theme}] 螢幕閱讀器文字：回到創世記第 2 章第 7 節`, (await ariaOf(s)) === "回到創世記第 2 章第 7 節", await ariaOf(s))
  check(`[${theme}] × 的名稱：關閉返回按鈕`, (await s.ev(`document.querySelector('.bwz-vr-x')?.getAttribute('aria-label')`)) === "關閉返回按鈕")
  check(`[${theme}] 一般換頁沒有捲動（scrollY === 0）`, (await scrollY(s)) === 0, await scrollY(s))
  const go = await rectOf(s, ".bwz-vr-go")
  const x = await rectOf(s, ".bwz-vr-x")
  const box = { left: go.left, right: x.right, top: Math.min(go.top, x.top), bottom: Math.max(go.bottom, x.bottom) }
  const center = await rectOf(s, ".page > #quartz-body > .center")
  const left = await rectOf(s, ".sidebar.left")
  const right = await rectOf(s, ".sidebar.right")
  const fab = await rectOf(s, ".bwz-fab")
  const bottomGap = 900 - box.bottom
  check(`[${theme}] 位置：在中欄底部置中（左右差 ≤ 2px）`, Math.abs((box.left + box.right) / 2 - (center.left + center.right) / 2) <= 2, JSON.stringify({ box, center }))
  check(`[${theme}] 位置：離底部約 24px`, Math.abs(bottomGap - 24) <= 2, bottomGap)
  check(`[${theme}] 沒有蓋到左欄、右欄、右下「?」`, !intersects(box, left) && !intersects(box, right) && !intersects(box, fab), JSON.stringify({ box, fab }))
  check(`[${theme}] 觸控目標 ≥ 44px（兩顆按鈕的高度與 × 的寬度）`, go.height >= 44 && x.height >= 44 && x.width >= 44, `${go.height}/${x.height}/${x.width}`)
  const ratioGo = await s.ev(contrastExpr(".bwz-vr-go"))
  check(`[${theme}] 按鈕文字對比 ≥ 4.5:1`, ratioGo >= 4.5, ratioGo.toFixed(2))
  const ratioX = await s.ev(contrastExpr(".bwz-vr-x"))
  check(`[${theme}] × 對比 ≥ 4.5:1`, ratioX >= 4.5, ratioX.toFixed(2))
  await s.shot(`btn-1440-${theme}`)

  // 條目之間跳兩次仍在：test_content 裡第 7 節連到的條目沒有再連出去的條目，
  // 所以用 SPA 換頁到兩個確定存在的條目（摩西 → 亞伯拉罕），一樣是「條目之間跳來跳去」
  await s.ev(`window.spaNavigate(new URL(${JSON.stringify(ROOT + "/link_folder/人物/摩西")}))`)
  await sleepNav()
  const mid = await urlPath(s)
  await s.ev(`window.spaNavigate(new URL(${JSON.stringify(ROOT + "/link_folder/人物/亞伯拉罕")}))`)
  await sleepNav()
  check(`[${theme}] 在條目之間連續跳兩次，按鈕仍在且文字不變`, (await labelOf(s)) === "↩ 返回 創世記 2:7" && mid !== (await urlPath(s)), `${mid} → ${await urlPath(s)}`)
  check(`[${theme}] 換頁後 scrollY === 0`, (await scrollY(s)) === 0)
  close(s)
}

// ======================================================================
console.log("\n== 2. 清除：開任何章節頁、×、重整、新分頁 ==")
{
  const s = await mk({ width: 1440, height: 900 })
  const { check } = s
  // 新的瀏覽器、還沒從經文點過任何連結：直接開條目不應該有按鈕
  await s.go(entryPath("安息"), 3000)
  check("直接開條目（沒有走過經文）沒有按鈕", !(await hasBtn(s)))
  await verseToEntry(s, 7)
  await s.go(entryPath("安息"), 3500) // 開條目 = 重新載入，按鈕要還在（重整仍在）
  check("重新整理後按鈕仍在", (await labelOf(s)) === "↩ 返回 創世記 2:7", await labelOf(s))
  // 新分頁（Target.createTarget）沒有
  const bs = await s.openBrowserSocket()
  const created = await bs.send("Target.createTarget", { url: ROOT + entryPath("安息日") })
  await sleep(2500)
  const att = await bs.send("Target.attachToTarget", { targetId: created.targetId, flatten: true })
  const probe = await bs.send("Runtime.evaluate", { expression: `JSON.stringify({ btn: !!document.querySelector('.bwz-vr'), key: sessionStorage.getItem('bwz-return-point') })`, returnByValue: true }, att.sessionId)
  check("新分頁沒有返回按鈕、也沒有返回點", probe?.result?.value === JSON.stringify({ btn: false, key: null }), probe?.result?.value)
  // 自己打開章節（不是按返回鈕）：test_content 的條目沒有連回章節的連結，所以用 SPA 換頁到第 6 章，
  // 一樣是「讀者自己打開了別章」
  await s.go(entryPath("安息"), 3000)
  await s.ev(`window.spaNavigate(new URL(${JSON.stringify(ROOT + "/" + encodeURI("01-創世記/第6章"))}))`)
  await sleep(2500)
  check("在條目裡點章節連結（自己打開章節）：按鈕消失、返回點清掉", !(await hasBtn(s)) && (await storedPoint(s)) === null, `${await hasBtn(s)} ${await storedPoint(s)}`)
  close(s)
}
{
  const s = await mk({ width: 1440, height: 900 })
  const { check } = s
  await verseToEntry(s, 7)
  const before = await urlPath(s)
  await clickSel(s, ".bwz-vr-x")
  await sleep(500)
  check("按 ×：按鈕消失、返回點清掉、不換頁", !(await hasBtn(s)) && (await storedPoint(s)) === null && (await urlPath(s)) === before)
  await clickSel(s, "article a.internal:not([href*='#'])")
  await sleepNav()
  check("按 × 之後再換頁不會又出現", !(await hasBtn(s)))
  close(s)
}

// ======================================================================
console.log("\n== 3. 按「返回」：回到那一節（置中、短暫標示） ==")
for (const theme of ["light", "dark"]) {
  const s = await mk({ theme, width: 1440, height: 900 })
  const { check } = s
  await verseToEntry(s, 7)
  await clickSel(s, ".bwz-vr-go", { scroll: false })
  const landed = await waitFor(s, `location.pathname.endsWith('${encodeURI("第2章")}') && !!document.querySelector('article ol li:nth-child(7)')`, 6000)
  check(`[${theme}] 按了回到第 2 章`, !!landed, await urlPath(s))
  await sleep(300)
  const flashSeen = await waitFor(s, `!!document.querySelector('li.bwz-vr-flash')`, 4500)
  check(`[${theme}] 那一節短暫標示（bwz-vr-flash）`, !!flashSeen)
  await sleep(1200)
  const li = await rectOf(s, "article ol li:nth-child(7)")
  const mid = (li.top + li.bottom) / 2
  check(`[${theme}] 第 7 節置中（中心離視窗中心 ≤ 60px）`, Math.abs(mid - 450) <= 60, `mid=${Math.round(mid)}`)
  check(`[${theme}] 網址沒有 hash`, !(await urlPath(s)).includes("#"), await urlPath(s))
  check(`[${theme}] 回去之後按鈕消失、返回點清掉`, !(await hasBtn(s)) && (await storedPoint(s)) === null)
  await s.shot(`back-1440-${theme}`)
  await sleep(2600)
  check(`[${theme}] 標示會自己消失`, !(await s.ev(`!!document.querySelector('.bwz-vr-flash')`)))
  close(s)
}

// ======================================================================
console.log("\n== 4. 懸停預覽：從經文連結打開預覽，再點預覽裡的連結 ==")
{
  const s = await mk({ width: 1440, height: 900 })
  const { check } = s
  await s.go(chapterPath(2), 3500)
  const sel = "article ol li:nth-child(3) a.internal"
  const c = await centerOf(s, sel)
  await mouse(s, c.x, c.y, "move")
  await mouse(s, c.x + 2, c.y + 1, "move")
  const shown = await waitFor(s, `!!document.querySelector('.popover.active-popover a.internal')`, 6000)
  check("滑過第 3 節的連結：預覽出現", !!shown)
  if (shown) {
    const target = await s.ev(`(() => { const a = [...document.querySelectorAll('.popover.active-popover a.internal')].find((x) => !x.getAttribute('href').includes('#')); if (!a) return null; const r = a.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) })()`)
    if (target) {
      const t = JSON.parse(target)
      // 像真人一樣先垂直往下進入預覽（預覽就貼在連結下方），再在預覽裡橫移到要點的連結。
      // 不能斜著直線走：路上會掃過別節的連結，預覽就換成那一節的，這是預覽本身的行為（不是記錄的問題）。
      await sleep(900) // 預覽要等淡入動畫（延遲 0.2 秒＋0.3 秒）跑完才可見、才點得到
      const popTop = await s.ev(`Math.round(document.querySelector(".popover.active-popover").getBoundingClientRect().top)`)
      for (let y = Math.round(c.y); y <= popTop + 10; y += 6) await mouse(s, c.x, y, "move")
      for (let i = 1; i <= 6; i++) await mouse(s, c.x + ((t.x - c.x) * i) / 6, popTop + 10 + ((t.y - popTop - 10) * i) / 6, "move")
      await mouse(s, t.x, t.y, "click")
      await waitFor(s, `!!document.querySelector('${BTN}')`, 6000)
      check("點預覽裡的連結離開：記成第 3 節", (await labelOf(s)) === "↩ 返回 創世記 2:3", await labelOf(s))
    } else check("預覽裡有可點的站內連結", false)
  }
  close(s)
}
{
  // 預覽來源作廢：滑過經文連結後，過了很久才點「別處」打開的預覽 → 不記
  const s = await mk({ width: 1440, height: 900 })
  const { check } = s
  await s.go(chapterPath(2), 3500)
  await s.ev(`(() => { const a = document.createElement('div'); a.className = 'popover active-popover'; a.innerHTML = '<a class="internal" href="${ROOT}${entryPath("安息日")}">x</a>'; document.body.append(a); window.__a = a })()`)
  await s.ev(`document.querySelector('.popover a').addEventListener('click', (e) => e.preventDefault())`)
  await s.ev(`document.querySelector('.popover a').click()`)
  await sleep(300)
  check("沒有來源的預覽連結（沒滑過經文）被點：不記", (await storedPoint(s)) === null, await storedPoint(s))
  close(s)
}

// ======================================================================
console.log("\n== 5. 本章整理：記「…章整理」、返回到那一段 ==")
for (const theme of ["light", "dark"]) {
  const s = await mk({ theme, width: 1440, height: 900 })
  const { check } = s
  await s.go(chapterPath(2), 3500)
  // 第三段（三、…）裡的「四河」連結
  const info = await s.ev(`(() => {
    const h2 = document.querySelector('#本章整理'); if (!h2) return 'noh2'
    const h3s = [...document.querySelectorAll('article h3')].filter((h) => h2.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)
    const third = h3s.find((h) => h.textContent.trim().startsWith('三、')); if (!third) return 'noh3'
    const a = [...document.querySelectorAll('article a.internal')].find((x) => x.getAttribute('href').includes('伊甸園四河') && (third.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) && !(h3s[3] && (h3s[3].compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING)))
    if (!a) return 'noa'
    a.id = 'e2e-study-link'; return third.id
  })()`)
  check(`[${theme}] 找得到整理第三段的連結`, typeof info === "string" && !info.startsWith("no"), info)
  await clickSel(s, "#e2e-study-link")
  await waitFor(s, `!!document.querySelector('${BTN}')`, 6000)
  check(`[${theme}] 按鈕文字是「↩ 返回 創世記 2 章整理」`, (await labelOf(s)) === "↩ 返回 創世記 2 章整理", await labelOf(s))
  check(`[${theme}] 螢幕閱讀器文字：回到創世記第 2 章的本章整理`, (await ariaOf(s)) === "回到創世記第 2 章的本章整理", await ariaOf(s))
  const stored = JSON.parse((await storedPoint(s)) ?? "null")
  check(`[${theme}] 返回點記的是整理第三段的小標題`, stored?.kind === "study" && stored.headingId === info, JSON.stringify(stored))
  await clickSel(s, ".bwz-vr-go", { scroll: false })
  await waitFor(s, `location.pathname.endsWith('${encodeURI("第2章")}')`, 6000)
  await sleep(2500)
  const top = (await rectOf(s, `[id="${info}"]`))?.top
  check(`[${theme}] 回到整理第三段的小標題（離視窗上緣 0–40px）`, top >= 0 && top <= 40, `top=${Math.round(top)}`)
  check(`[${theme}] 按鈕消失`, !(await hasBtn(s)))
  close(s)
}
{
  // 其他連結不記：相關地圖、知識節點、同頁錨點、修飾鍵
  const s = await mk({ width: 1440, height: 900 })
  const { check } = s
  await s.go(chapterPath(2), 3500)
  await clickSel(s, ".toc a, .table-of-contents a, nav.toc a")
  await sleep(600)
  check("同頁錨點（右欄目錄）不記", (await storedPoint(s)) === null && !(await hasBtn(s)), await storedPoint(s))
  const c = await centerOf(s, VERSE7)
  await mouse(s, c.x, c.y, "click", 2) // Ctrl
  await sleep(800)
  check("Ctrl+點擊（另開分頁）不記", (await storedPoint(s)) === null, await storedPoint(s))
  // 一般換頁（從知識節點清單點進條目）：不記、不捲
  await s.go(chapterPath(2), 3000)
  await s.ev(`window.scrollTo(0, 1500)`)
  await s.ev(`document.querySelector('details.collapsible-section ul a.internal')?.click()`)
  await sleepNav()
  check("從本章知識節點點進條目：不記", (await storedPoint(s)) === null && !(await hasBtn(s)), await storedPoint(s))
  check("一般換頁（沒按按鈕）scrollY === 0", (await scrollY(s)) === 0, await scrollY(s))
  close(s)
}

// ======================================================================
console.log("\n== 6. sessionStorage 被封鎖：不丟例外、功能退回 ==")
{
  const block = `Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('blocked', 'SecurityError') } });`
  const s = await mk({ width: 1440, height: 900, extraScript: block })
  const { check } = s
  // 記下每個例外是從哪個腳本檔丟出來的：探索選單與搜尋（別的外掛）本來就沒保護 sessionStorage，不是這一批的範圍；
  // 只有「讀寫我們的鍵」的腳本丟例外才算失敗
  const thrownFrom = new Set()
  s.on("Runtime.exceptionThrown", (m) => {
    for (const f of m.params.exceptionDetails.stackTrace?.callFrames ?? []) if (f.url) thrownFrom.add(f.url)
  })
  await s.go(chapterPath(2), 3500)
  await clickSel(s, VERSE7)
  await sleepNav()
  check("封鎖時點經文連結仍可換頁、沒有按鈕", !(await hasBtn(s)) && (await urlPath(s)).includes("知識節點"), await urlPath(s))
  const OWN_MARKERS = ["bwz-return-point", "bwz-ux-view"]
  const own = []
  for (const url of thrownFrom) {
    const text = await (await fetch(url)).text()
    if (OWN_MARKERS.some((m) => text.includes(m))) own.push(url)
  }
  check("封鎖時 verse-return／site-ux 的腳本沒有丟例外（其他外掛的例外不算）", own.length === 0, own.join("|") || `其他外掛的例外 ${s.errors.length} 個，來自 ${thrownFrom.size} 個腳本`)
  close(s)
}

// ======================================================================
console.log("\n== 7. 手機 390／375：位置、不重疊、對比、安裝橫幅 ==")
for (const [w, h] of [[390, 844], [375, 667]]) {
  for (const theme of ["light", "dark"]) {
    const s = await mk({ theme, width: w, height: h, mobile: true })
    const { check } = s
    const tag = `[${w} ${theme}]`
    await s.go(chapterPath(2), 3500)
    // 手機用點擊（JS click 等同輕觸；位置檢查才是這一段的重點）
    await s.ev(`document.querySelector('${VERSE7}').click()`)
    await waitFor(s, `!!document.querySelector('${BTN}')`, 6000)
    await sleep(500)
    check(`${tag} 按鈕出現、文字正確`, (await labelOf(s)) === "↩ 返回 創世記 2:7", await labelOf(s))
    const go = await rectOf(s, ".bwz-vr-go")
    const x = await rectOf(s, ".bwz-vr-x")
    const box = { left: go.left, right: x.right, top: Math.min(go.top, x.top), bottom: Math.max(go.bottom, x.bottom) }
    const fab = await rectOf(s, ".bwz-fab")
    const chip = await rectOf(s, ".bwz-n-chip")
    check(`${tag} 左右置中（差 ≤ 2px）、沒有超出畫面`, Math.abs((box.left + box.right) / 2 - w / 2) <= 2 && box.left >= 0 && box.right <= w, JSON.stringify(box))
    check(`${tag} 在右下「?」上面、不重疊`, !intersects(box, fab) && box.bottom <= fab.top, JSON.stringify({ box, fab }))
    check(`${tag} 沒有造成橫向捲動`, (await s.ev(`document.documentElement.scrollWidth <= innerWidth`)) === true)
    check(`${tag} 觸控目標 ≥ 44px`, go.height >= 44 && x.height >= 44 && x.width >= 44, `${go.height}/${x.width}`)
    const ratio = await s.ev(contrastExpr(".bwz-vr-go"))
    check(`${tag} 文字對比 ≥ 4.5:1`, ratio >= 4.5, ratio.toFixed(2))
    await s.shot(`btn-${w}-${theme}`)
    if (theme === "light") {
      // 「加入主畫面」橫幅（首訪才有）：按鈕要在橫幅上面
      await s.send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.removeItem('pwa_install_guide_dismissed_v1')}catch(e){}" })
      await s.ev(`localStorage.removeItem('pwa_install_guide_dismissed_v1')`)
      await s.go(chapterPath(2), 3500)
      await s.ev(`document.querySelector('${VERSE7}').click()`)
      await waitFor(s, `!!document.querySelector('${BTN}')`, 6000)
      await sleep(1500)
      const banner = await rectOf(s, ".pwa-install-guide")
      const go2 = await rectOf(s, ".bwz-vr-go")
      const x2 = await rectOf(s, ".bwz-vr-x")
      const fab2 = await rectOf(s, ".bwz-fab")
      const box2 = { left: go2.left, right: x2.right, top: Math.min(go2.top, x2.top), bottom: Math.max(go2.bottom, x2.bottom) }
      if (banner) {
        check(`${tag} 安裝橫幅出現時：按鈕不蓋到橫幅、也不蓋到「?」`, !intersects(box2, banner) && !intersects(box2, fab2) && box2.bottom <= banner.top, JSON.stringify({ box2, banner, fab2 }))
        await s.shot(`btn-${w}-banner`)
      } else check(`${tag} 安裝橫幅（此環境沒有出現，略過）`, true, "no banner")
    }
    close(s)
  }
}
{
  // 手機：回到整理標題時，標題不被黏頂工具列與章節快捷列蓋住
  const s = await mk({ width: 390, height: 844, mobile: true })
  const { check } = s
  await s.go(chapterPath(2), 3500)
  await s.ev(`(() => { const h2 = document.querySelector('#本章整理'); const a = [...document.querySelectorAll('article a.internal')].find((x) => (h2.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) && !x.getAttribute('href').includes('#')); a.id = 'e2e-study-link' })()`)
  const hid = await s.ev(`(() => { const a = document.getElementById('e2e-study-link'); let h = null; for (const e of document.querySelectorAll('article h3, article h2')) if (e.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) h = e; return h.id })()`)
  await s.ev(`document.getElementById('e2e-study-link').click()`)
  await waitFor(s, `!!document.querySelector('${BTN}')`, 6000)
  await s.ev(`document.querySelector('${BTN}').click()`)
  await waitFor(s, `location.pathname.endsWith('${encodeURI("第2章")}')`, 6000)
  await sleep(3000)
  const top = (await rectOf(s, `[id="${hid}"]`))?.top
  const bar = await rectOf(s, ".bwz-cqb")
  const toolbar = await s.ev(`Math.round(document.querySelector('.sidebar.left').getBoundingClientRect().bottom)`)
  check("手機：回到整理標題時，標題在黏頂工具列與快捷列的下面", top >= Math.max(toolbar, bar?.bottom ?? 0) - 1 && top < 200, JSON.stringify({ top, toolbar, bar }))
  await s.shot("study-back-390")
  close(s)
}

console.log(`\n${all.filter(Boolean).length}/${all.length} 通過`)
process.exit(all.some((ok) => !ok) ? 1 : 0)
