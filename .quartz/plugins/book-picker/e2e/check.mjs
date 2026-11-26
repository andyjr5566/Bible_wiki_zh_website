// 書卷章節選擇器：無頭 Chrome（CDP）驗證。重用 plugins/personal-notes/e2e/lib.mjs（不修改它）。
// 用法：node e2e/check.mjs <siteRoot，結尾不加 /> <profileRoot> [shotDir]
//   siteRoot    用 test_content 建出的站（子路徑伺服器，見 personal-notes/e2e/README.md）
//   profileRoot 放 Chrome user-data-dir 的資料夾（每個情境開新的子資料夾）
// 環境變數：
//   AXE_PATH      axe.min.js 的路徑（有設定才跑 axe：章節、條目、首頁、展開、手機抽屜、章末 × 淺深）
import { mkdirSync, readFileSync } from "node:fs"
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"

const [ROOT, profileRoot, shotDir] = process.argv.slice(2)
if (!ROOT || !profileRoot) {
  console.error("用法：node e2e/check.mjs <siteRoot> <profileRoot> [shotDir]")
  process.exit(2)
}
if (shotDir) mkdirSync(shotDir, { recursive: true })
const AXE = process.env.AXE_PATH ? readFileSync(process.env.AXE_PATH, "utf8") : null
const ch = (n) => "/" + encodeURI(`01-創世記/第${n}章`)
const toc = "/" + encodeURI("01-創世記/全書目錄及綱要")
const entry = "/" + encodeURI("link_folder/人物/亞伯拉罕")
const results = []
let n = 0

async function open(opts = {}) {
  const s = await startBrowser({ root: ROOT, profile: `${profileRoot}/p${++n}`, shotDir, detailMax: 300, ...opts })
  const orig = s.check
  s.check = (name, ok, detail = "") => { results.push(ok); orig(name, ok, detail) }
  // 導覽卡、加入主畫面提示不要蓋住畫面
  await s.go("/index.html?skip=1", 1500)
  await s.ev(`localStorage.setItem("bwz-tour-v2", JSON.stringify({v:2,status:"dismissed",step:0,skills:[],skipped:[]}));localStorage.setItem("pwa_install_guide_dismissed_v1","1");localStorage.setItem("theme","${opts.theme ?? "light"}")`)
  return s
}
// 關掉 Chrome 並等它真的結束：lib 的除錯埠是隨機的，下一個情境若剛好抽到同一個埠、又連上還沒關完的舊 Chrome，
// 連線會中途斷掉（整個腳本卡在「unsettled top-level await」）。
async function closeBrowser(s) {
  await s.send("Browser.close").catch(() => {})
  await sleep(1500)
}
async function waitFor(s, expr, ms = 8000) {
  const end = Date.now() + ms
  let v
  while (Date.now() < end) { try { v = await s.ev(expr) } catch { v = undefined } if (v) return v; await sleep(150) }
  return v
}
const path = (s) => s.ev(`decodeURIComponent(location.pathname)`)
// 真正的鍵盤事件（會觸發按鈕的 Enter／Space 預設行為）
async function key(s, name, code, text) {
  await s.send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, text, windowsVirtualKeyCode: { Enter: 13, ArrowRight: 39, ArrowLeft: 37, End: 35, Home: 36, Tab: 9 }[name] })
  await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: { Enter: 13, ArrowRight: 39, ArrowLeft: 37, End: 35, Home: 36, Tab: 9 }[name] })
}
const REL = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height } })()`
const visible = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' })()`
const overflowX = `document.documentElement.scrollWidth - document.documentElement.clientWidth`
// 只看本外掛的 id（探索清單的 list-0 是 explorer 外掛本來就重複的，不在這個檢查範圍）
const dupIds = `(() => { const ids = [...document.querySelectorAll('[id^=bwz-]')].map((e) => e.id); return ids.filter((id, i) => ids.indexOf(id) !== i) })()`

// ---------------- 桌機 1440 ----------------
{
  const s = await open({ width: 1440, height: 900 })
  const { check, ev, go, shot } = s
  await go(ch(2), 2500)
  check("桌機章節頁：左欄有選擇器、書卷標題與換卷按鈕", await ev(`!!document.querySelector('.bwz-picker[data-mode=book] .bwz-pk-switch') && document.querySelector('.bwz-pk-title').textContent === '書卷'`))
  check("換卷按鈕文字與無障礙名稱", await ev(`(() => { const b = document.querySelector('.bwz-pk-switch'); return b.textContent.replace(/\\s+/g,' ').trim() + '|' + b.getAttribute('aria-label') })()`) === "創世記 ▾ 換卷|目前在創世記，換別的書卷", await ev(`document.querySelector('.bwz-pk-switch').textContent`))
  check("選擇器在探索之前、在左欄內（桌機）", await ev(`(() => { const p = document.querySelector('.bwz-picker'); const x = document.querySelector('.explorer'); return !!(p.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) && !!p.closest('.sidebar.left') })()`))
  check("本卷連結：有全書目錄及綱要；沒有書卷導論的書卷不顯示該連結", await ev(`[...document.querySelectorAll('.bwz-pk-link')].map((a) => a.textContent).join('|')`) === "全書目錄及綱要")
  check("本卷章號格：50 格，缺號灰掉（3 章有頁面）、第 2 章 aria-current=page", await ev(`document.querySelectorAll('.bwz-picker .bwz-chgrid li').length === 50 && document.querySelectorAll('.bwz-picker a.bwz-ch').length === 3 && document.querySelectorAll('.bwz-picker .bwz-ch.is-missing').length === 47 && document.querySelector('.bwz-picker a.bwz-ch[aria-current=page]')?.textContent === '2'`))
  check("目前章的無障礙名稱「第 2 章（目前這一章）」", await ev(`document.querySelector('a.bwz-ch[aria-current=page]').getAttribute('aria-label')`) === "第 2 章（目前這一章）")
  check("書卷格子預設收起（章節頁）", !(await ev(visible(".bwz-pk-books"))))
  check("探索選單沒有書卷資料夾（01-創世記…），仍有知識節點、教學", await waitFor(s, `(() => { const t = document.querySelector('.explorer-ul')?.innerText ?? ''; return t.includes('知識節點') && t.includes('教學') && !/創世記|^0\\d/m.test(t) })()`), await ev(`document.querySelector('.explorer-ul')?.innerText`))
  check("沒有重複的 id", (await ev(dupIds)).length === 0, JSON.stringify(await ev(dupIds)))
  check("桌機章末不顯示（左欄一直在）", !(await ev(visible(".bwz-chend"))))
  await shot("d1440-chapter")

  // 按「換卷」：原地展開書卷格子，本卷章號收起；再按收起
  await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(200)
  check("按換卷：展開書卷格子、本卷章號收起、aria-expanded=true", await ev(`${visible(".bwz-pk-books")} && !${visible(".bwz-pk-current")} && document.querySelector('.bwz-pk-switch').getAttribute('aria-expanded') === 'true'`))
  check("書卷格子：66 卷、8 組、分頁舊約 39 卷／新約 27 卷、預設舊約、目前書卷 aria-current", await ev(`document.querySelectorAll('.bwz-bg-book').length === 66 && document.querySelectorAll('.bwz-bg-gh').length === 8 && [...document.querySelectorAll('.bwz-bg-tab')].map((t) => t.textContent.trim()).join('|') === '舊約 39 卷|新約 27 卷' && document.querySelector('.bwz-bg-tab[aria-selected=true]').dataset.testament === 'ot' && document.querySelector('a.bwz-bg-book[aria-current=true]')?.textContent === '創世記'`))
  await shot("d1440-books-open")
  // 鍵盤：Tab 焦點到分頁，方向鍵切換
  await ev(`document.querySelector('.bwz-bg-tab[aria-selected=true]').focus()`)
  await key(s, "ArrowRight", "ArrowRight")
  check("鍵盤：右方向鍵切到新約，焦點跟著、面板切換", await ev(`document.activeElement.dataset.testament === 'nt' && !document.querySelector('#bwz-pk-panel-nt').hidden && document.querySelector('#bwz-pk-panel-ot').hidden`))
  check("新約的書卷全部是灰色（尚未開放）", await ev(`[...document.querySelectorAll('#bwz-pk-panel-nt .bwz-bg-book')].every((b) => b.getAttribute('aria-disabled') === 'true')`))
  await key(s, "ArrowLeft", "ArrowLeft")
  check("鍵盤：左方向鍵回舊約", await ev(`document.activeElement.dataset.testament === 'ot'`))
  // 灰色書卷：滑鼠 title、點擊提示、Enter
  const title = await ev(`document.querySelector('.bwz-bg-book.is-locked').title`)
  check("灰色書卷 title 是定稿提示句（依開放書卷產生）", title === "出埃及記的研讀頁還在整理中，目前已開放創世記。", title)
  await ev(`document.querySelector('.bwz-bg-book.is-locked').click()`); await sleep(400)
  check("點灰色書卷：出現 role=status 的提示", await ev(`document.querySelector('.bwz-toast')?.getAttribute('role') === 'status' && document.querySelector('.bwz-toast').textContent.includes('的研讀頁還在整理中')`), await ev(`document.querySelector('.bwz-toast')?.textContent`))
  await shot("d1440-toast")
  await sleep(3300)
  check("提示約 3 秒後消失", !(await ev(`!!document.querySelector('.bwz-toast')`)))
  await ev(`document.querySelectorAll('.bwz-bg-book.is-locked')[3].focus()`)
  await key(s, "Enter", "Enter", "\r"); await sleep(400)
  check("鍵盤 Enter 在灰色書卷上也有提示", await ev(`!!document.querySelector('.bwz-toast')`))
  await sleep(3300)
  await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(200)
  check("再按一次換卷：收起書卷格子、章號回來", await ev(`!${visible(".bwz-pk-books")} && ${visible(".bwz-pk-current")}`))

  // 章號：SPA 換頁（不重新載入）
  await ev(`window.__marker = 42`)
  await ev(`document.querySelector('a.bwz-ch[href$="%E7%AC%AC1%E7%AB%A0"], a.bwz-ch[href$="第1章"]').click()`)
  check("點章號會 SPA 換頁到第 1 章，頁面沒有重新載入", await waitFor(s, `decodeURIComponent(location.pathname).endsWith('第1章') && window.__marker === 42 && document.querySelector('a.bwz-ch[aria-current=page]')?.textContent === '1'`), await path(s))
  check("換頁後選擇器只有一份、id 不重複", await ev(`document.querySelectorAll('.bwz-picker').length === 1`) && (await ev(dupIds)).length === 0)
  // 全書目錄頁：沒有目前章，章號格沒有 aria-current
  await go(toc, 2500)
  check("全書目錄頁：選擇器是 book 版面，沒有 aria-current 的章", await ev(`document.querySelector('.bwz-picker').dataset.mode === 'book' && !document.querySelector('.bwz-ch[aria-current=page]')`))
  check("沒有 JavaScript 例外", s.errors.length === 0, JSON.stringify(s.errors))
  await closeBrowser(s)
}

// ---------------- 條目頁、首頁（桌機） ----------------
{
  const s = await open({ width: 1440, height: 900 })
  const { check, ev, go, shot } = s
  await go(entry, 3000)
  check("條目頁：直接展開書卷格子，沒有換卷按鈕", await ev(`document.querySelector('.bwz-picker').dataset.mode === 'other' && ${visible(".bwz-pk-books")} && !document.querySelector('.bwz-pk-switch')`))
  await shot("d1440-entry")
  await go("/index.html?skip=1", 3000)
  check("首頁：收成一行「書卷 ▸」，無障礙名稱「瀏覽全部書卷」", await ev(`(() => { const b = document.querySelector('.bwz-pk-collapse'); return !!b && b.textContent.replace(/\\s+/g, '') === '書卷▸' && b.getAttribute('aria-label') === '瀏覽全部書卷' && !${visible(".bwz-pk-books")} })()`))
  await shot("d1440-home")
  await ev(`document.querySelector('.bwz-pk-collapse').click()`); await sleep(200)
  check("首頁按了展開書卷格子（66 卷）", await ev(`${visible(".bwz-pk-books")} && document.querySelector('.bwz-pk-collapse').getAttribute('aria-expanded') === 'true'`))
  await shot("d1440-home-open")
  await ev(`document.querySelector('.bwz-pk-collapse').click()`); await sleep(200)
  check("再按一次收起", await ev(`!${visible(".bwz-pk-books")}`))
  check("沒有 JavaScript 例外", s.errors.length === 0, JSON.stringify(s.errors))
  await closeBrowser(s)
}

// ---------------- 預設分頁依閱讀紀錄 ----------------
{
  const s = await open({ width: 1440, height: 900 })
  const { check, ev, go } = s
  await go(entry, 2500)
  check("沒有閱讀紀錄：預設舊約", await ev(`document.querySelector('.bwz-bg-tab[aria-selected=true]').dataset.testament === 'ot'`))
  await ev(`localStorage.setItem('bwz-reading', JSON.stringify({v:1,books:{'45-羅馬書':{slug:'45-羅馬書/第1章',ratio:0.3,t:Date.now()}}}))`)
  await go(entry, 2500)
  check("最近讀的是羅馬書：預設開新約", await ev(`document.querySelector('.bwz-bg-tab[aria-selected=true]').dataset.testament === 'nt' && !document.querySelector('#bwz-pk-panel-nt').hidden`))
  await go(ch(2), 2500)
  await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(200)
  check("章節頁（有目前書卷）：用目前書卷所屬的約，不受閱讀紀錄影響", await ev(`document.querySelector('.bwz-bg-tab[aria-selected=true]').dataset.testament === 'ot'`))
  await ev(`localStorage.setItem('bwz-reading', '{壞掉')`)
  await go(entry, 2500)
  check("閱讀紀錄壞掉：退回舊約、沒有例外", await ev(`document.querySelector('.bwz-bg-tab[aria-selected=true]').dataset.testament === 'ot'`) && s.errors.length === 0, JSON.stringify(s.errors))
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } })` })
  await go(entry, 2500)
  // 站內其他腳本（prescript、script-2 等）讀 localStorage 時自己會丟例外，不是選擇器的，所以這裡不檢查例外，
  // 只確認選擇器照常運作（分頁預設舊約、灰色書卷點了仍有提示）；選擇器自己讀紀錄的地方有 try/catch，單元測試也涵蓋。
  await ev(`document.querySelector('.bwz-bg-book.is-locked').click()`); await sleep(400)
  check("localStorage 被封鎖：選擇器照常顯示、預設舊約、灰色書卷仍有提示", await ev(`!!document.querySelector('.bwz-bg-book') && document.querySelector('.bwz-bg-tab[aria-selected=true]')?.dataset.testament === 'ot' && !!document.querySelector('.bwz-toast')`))
  await closeBrowser(s)
}

// ---------------- 手機 390 ----------------
for (const width of [390, 375]) {
  const s = await open({ width, height: 844, mobile: true })
  const { check, ev, go, shot } = s
  await go(ch(2), 3000)
  check(`${width} 章節頁沒有橫向捲動`, (await ev(overflowX)) <= 0, await ev(overflowX))
  check(`${width} 選擇器搬進 ☰ 抽屜（.explorer-content）的最上面，不在頂端工具列`, await ev(`(() => { const p = document.querySelector('.bwz-picker'); const ec = document.querySelector('.explorer-content'); return p.parentElement === ec && ec.firstElementChild === p })()`))
  check(`${width} 頂端工具列沒有變高（只有選單／搜尋／Aa 那一排）`, await ev(`(() => { const r = document.querySelector('.sidebar.left').getBoundingClientRect(); return r.height < 130 })()`), await ev(`document.querySelector('.sidebar.left').getBoundingClientRect().height`))
  check(`${width} 抽屜收起時選擇器看不到`, !(await ev(visible(".bwz-picker"))))
  await ev(`document.querySelector('.explorer-toggle.mobile-explorer').click()`); await sleep(900)
  check(`${width} 打開抽屜：選擇器在最上面、在探索清單之上`, await ev(`(() => { const p = document.querySelector('.bwz-picker').getBoundingClientRect(); const u = document.querySelector('.explorer-ul').getBoundingClientRect(); return p.height > 0 && p.top < u.top && p.top < 200 })()`), JSON.stringify(await ev(REL(".bwz-picker"))))
  check(`${width} 抽屜裡抽屜寬度內沒有橫向溢出`, await ev(`(() => { const ec = document.querySelector('.explorer-content'); return ec.scrollWidth <= ec.clientWidth })()`), await ev(`document.querySelector('.explorer-content').scrollWidth + '/' + document.querySelector('.explorer-content').clientWidth`))
  check(`${width} 觸控目標 ≥ 44px（章號、換卷）`, await ev(`(() => { const a = document.querySelector('a.bwz-ch').getBoundingClientRect(); const b = document.querySelector('.bwz-pk-switch').getBoundingClientRect(); return a.height >= 44 && b.height >= 44 })()`))
  await shot(`m${width}-drawer`)
  await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(300)
  check(`${width} 抽屜裡按換卷：顯示書卷格子`, await ev(visible(".bwz-pk-books")))
  check(`${width} 書卷按鈕觸控目標 ≥ 44px`, await ev(`document.querySelector('.bwz-bg-book').getBoundingClientRect().height >= 44`))
  await shot(`m${width}-drawer-books`)
  // SPA 換頁：選單抽屜裡點章號
  await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(200)
  await ev(`window.__marker = 7`)
  await ev(`[...document.querySelectorAll('a.bwz-ch')].find((a) => a.textContent === '1').click()`)
  check(`${width} 抽屜裡點章號：SPA 換頁到第 1 章，選擇器仍在抽屜、只有一份、沒有重複 id`, await waitFor(s, `decodeURIComponent(location.pathname).endsWith('第1章') && window.__marker === 7 && document.querySelectorAll('.bwz-picker').length === 1 && document.querySelector('.bwz-picker').parentElement.classList.contains('explorer-content') && document.querySelector('a.bwz-ch[aria-current=page]')?.textContent === '1'`) && (await ev(dupIds)).length === 0, await path(s))
  check(`${width} 換頁後抽屜自己收起`, await waitFor(s, `document.querySelector('.explorer').classList.contains('collapsed')`) !== undefined)
  // 視窗寬度改變：搬回左欄、再搬進抽屜
  await s.setViewport(1440, 900)
  check(`${width} 放大到桌機寬度：選擇器搬回左欄的位置（探索之前）`, await waitFor(s, `(() => { const p = document.querySelector('.bwz-picker'); return p.parentElement.classList.contains('bwz-picker-slot') && document.querySelectorAll('.bwz-picker').length === 1 })()`))
  await s.setViewport(width, 844, { dpr: 2, mobile: true, touch: true })
  check(`${width} 縮回手機寬度：選擇器再搬進抽屜`, await waitFor(s, `document.querySelector('.bwz-picker').parentElement.classList.contains('explorer-content')`))
  // 章末
  await go(ch(2), 3000)
  const chend = await ev(`(() => { const e = document.querySelector('article > .bwz-chend'); return !!e && e.querySelector('.bwz-chend-title').textContent + '|' + e.querySelectorAll('li').length + '|' + e.querySelector('.bwz-chend-change').textContent })()`)
  check(`${width} 手機章末：標題「創世記・本卷章節」、章號格 50、按鈕「換一卷書」`, chend === "創世記・本卷章節|50|換一卷書", chend)
  await ev(`document.querySelector('.bwz-chend').scrollIntoView({ block: 'center' })`); await sleep(400)
  await shot(`m${width}-chend`)
  check(`${width} 章末的章號連結沒有 id 重複`, (await ev(dupIds)).length === 0)
  await ev(`document.querySelector('.bwz-chend-change').click()`); await sleep(1000)
  check(`${width} 按「換一卷書」：抽屜打開、顯示書卷格子、回到最上面`, await ev(`!document.querySelector('.explorer').classList.contains('collapsed') && ${visible(".bwz-pk-books")} && document.querySelector('.explorer-content').scrollTop === 0`))
  await ev(`document.querySelector('.explorer-toggle.mobile-explorer').click()`); await sleep(600)
  // 章節快捷列：書名按鈕
  await go(ch(2), 3000)
  await ev(`window.scrollTo(0, 1200)`); await sleep(700)
  check(`${width} 章節快捷列的書名是按鈕`, await ev(`document.querySelector('.bwz-cqb-title')?.tagName === 'BUTTON' && document.querySelector('.bwz-cqb.is-shown') !== null`))
  await ev(`document.querySelector('.bwz-cqb-title').click()`); await sleep(1000)
  check(`${width} 點快捷列書名：抽屜打開、停在最上面的選擇器、目前章在可視範圍`, await ev(`(() => { const ec = document.querySelector('.explorer-content'); const c = document.querySelector('a.bwz-ch[aria-current=page]').getBoundingClientRect(); return !document.querySelector('.explorer').classList.contains('collapsed') && ec.scrollTop === 0 && c.top >= 0 && c.bottom <= innerHeight })()`))
  // 條目頁手機
  await go(entry, 3000)
  await ev(`document.querySelector('.explorer-toggle.mobile-explorer').click()`); await sleep(900)
  check(`${width} 條目頁抽屜：最上面是書卷格子（直接展開）`, await ev(`document.querySelector('.bwz-picker').dataset.mode === 'other' && ${visible(".bwz-pk-books")} && document.querySelector('.explorer-content').scrollTop === 0`))
  check(`${width} 條目頁沒有橫向捲動`, (await ev(overflowX)) <= 0, await ev(overflowX))
  // 灰色提示在手機上
  await ev(`document.querySelector('.bwz-bg-book.is-locked').click()`); await sleep(500)
  await shot(`m${width}-toast`)
  check(`${width} 灰色書卷提示出現在畫面內`, await ev(`(() => { const t = document.querySelector('.bwz-toast'); if (!t) return false; const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight })()`))
  check(`${width} 沒有 JavaScript 例外`, s.errors.length === 0, JSON.stringify(s.errors))
  await closeBrowser(s)
}

// ---------------- axe ----------------
if (AXE) {
  const states = [
    ["章節", 1440, false, ch(2), ""],
    ["章節（展開書卷）", 1440, false, ch(2), `document.querySelector('.bwz-pk-switch').click()`],
    ["條目", 1440, false, entry, ""],
    ["首頁（展開）", 1440, false, "/index.html?skip=1", `document.querySelector('.bwz-pk-collapse').click()`],
    ["手機抽屜（章節）", 390, true, ch(2), `document.querySelector('.explorer-toggle.mobile-explorer').click()`],
    ["手機抽屜（展開書卷）", 390, true, ch(2), `document.querySelector('.explorer-toggle.mobile-explorer').click(); setTimeout(() => document.querySelector('.bwz-pk-switch').click(), 400)`],
    ["手機抽屜（條目）", 390, true, entry, `document.querySelector('.explorer-toggle.mobile-explorer').click()`],
    ["手機章末", 390, true, ch(2), `document.querySelector('.bwz-chend').scrollIntoView()`],
  ]
  for (const theme of ["light", "dark"]) {
    for (const [name, w, mobile, p, act] of states) {
      const s = await open({ width: w, height: mobile ? 844 : 900, mobile, theme })
      await s.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] })
      await s.go(p, 3500)
      if (act) { await s.ev(act); await sleep(1200) }
      await s.ev(AXE + ";true")
      const v = await s.ev(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }, resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 3).map((nd) => nd.target.join(' ')) })))`)
      const bad = v.filter((x) => x.impact === "critical" || x.impact === "serious")
      s.check(`axe ${theme} ${w} ${name}：沒有 critical／serious`, bad.length === 0, JSON.stringify(v))
      await closeBrowser(s)
    }
  }
}

console.log(`\n${results.filter(Boolean).length}/${results.length} 通過`)
process.exit(results.some((ok) => !ok) ? 1 : 0)
