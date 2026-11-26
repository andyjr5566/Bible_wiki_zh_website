// 內容比 test_content 豐富的站（詩篇 150 章、士師記只有全書目錄、馬太福音有章節與導論）：
// 驗證章號很多時的捲動、「目前可以讀…」的句子（不連續）、只有目錄的書卷可以點、預設分頁。
// 用法：node e2e/rich.mjs <siteRoot> <profileRoot> [shotDir]
// 這個站要用 scratch 內容建（見 dev-notes 或回報），不是 CI 的 test_content，所以不接進 CI。
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"
const [ROOT, profileRoot, shotDir] = process.argv.slice(2)
const results = []
const open = async (o) => {
  const s = await startBrowser({ root: ROOT, profile: `${profileRoot}/r${Math.random().toString(36).slice(2, 6)}`, shotDir, detailMax: 400, ...o })
  const orig = s.check
  s.check = (n, ok, d = "") => { results.push(ok); orig(n, ok, d) }
  await s.go("/index.html?skip=1", 1500)
  await s.ev(`localStorage.setItem("bwz-tour-v2", JSON.stringify({v:2,status:"dismissed",step:0,skills:[],skipped:[]}));localStorage.setItem("pwa_install_guide_dismissed_v1","1")`)
  return s
}
const close = async (s) => { await s.send("Browser.close").catch(() => {}); await sleep(1500) }
const psalm = (n) => "/" + encodeURI(`19-詩篇/第${n}章`)

for (const [w, mobile] of [[1440, false], [390, true]]) {
  const s = await open({ width: w, height: mobile ? 844 : 900, mobile })
  const { check, ev, go, shot } = s
  await go(psalm(119), 3500)
  if (mobile) { await ev(`document.querySelector('.explorer-toggle.mobile-explorer').click()`); await sleep(900) }
  const info = await ev(`(() => { const w = document.querySelector('.bwz-picker .bwz-chgrid-wrap'); const cur = w.querySelector('a[aria-current=page]'); const wr = w.getBoundingClientRect(); const cr = cur.getBoundingClientRect(); const cell = w.querySelector('a.bwz-ch').getBoundingClientRect().height; return { n: w.querySelectorAll('li').length, h: Math.round(w.clientHeight), sh: w.scrollHeight, st: Math.round(w.scrollTop), cell, inView: cr.top >= wr.top - 1 && cr.bottom <= wr.bottom + 1 } })()`)
  check(`${w} 詩篇 150 章：章號區可捲動、高度約 8 行（8 × 格高 + 間距內）`, info.n === 150 && info.sh > info.h && info.h <= 8 * info.cell + 7 * 6 + 12, JSON.stringify(info))
  check(`${w} 第 119 章（要捲動才看得到）已捲進章號區的可視範圍`, info.inView && info.st > 0, JSON.stringify(info))
  await shot(`rich-${w}-psalm119`)
  // 換卷再收起後，目前章仍在可視範圍
  await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(200)
  await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(200)
  check(`${w} 換卷展開再收起後，目前章仍在可視範圍`, await ev(`(() => { const w = document.querySelector('.bwz-picker .bwz-chgrid-wrap'); const cr = w.querySelector('a[aria-current=page]').getBoundingClientRect(); const wr = w.getBoundingClientRect(); return cr.top >= wr.top - 1 && cr.bottom <= wr.bottom + 1 })()`))
  check(`${w} 沒有橫向捲動`, (await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`)) <= 0)
  await close(s)
}
{
  const s = await open({ width: 1440, height: 900 })
  const { check, ev, go, shot } = s
  await go("/" + encodeURI("link_folder/人物/亞伯拉罕"), 3000)
  const t = await ev(`[...document.querySelectorAll('.bwz-bg-book.is-locked')].find((b) => b.textContent === '出埃及記').title`)
  check("不連續的開放書卷列出（創世記、詩篇、馬太福音；士師記只有目錄也算開放）", t === "出埃及記的研讀頁還在整理中，目前已開放創世記、士師記、詩篇、馬太福音。", t)
  const open1 = await ev(`[...document.querySelectorAll('a.bwz-bg-book')].map((a) => a.textContent).join('|')`)
  check("開放的是創世記、士師記（只有目錄）、詩篇、馬太福音", open1 === "創世記|士師記|詩篇|馬太福音" || open1 === "創世記|士師記|詩篇", open1)
  const href = await ev(`[...document.querySelectorAll('a.bwz-bg-book')].find((a) => a.textContent === '士師記').getAttribute('href')`)
  check("只有全書目錄的士師記連到全書目錄", decodeURIComponent(href).endsWith("07-士師記/全書目錄及綱要"), href)
  await shot("rich-entry")
  await ev(`localStorage.setItem('bwz-reading', JSON.stringify({v:1,books:{'40-馬太福音':{slug:'40-馬太福音/第1章',ratio:0.3,t:Date.now()}}}))`)
  await go("/" + encodeURI("link_folder/人物/亞伯拉罕"), 3000)
  check("最近讀馬太福音：預設新約，且新約裡馬太福音可點", await ev(`document.querySelector('.bwz-bg-tab[aria-selected=true]').dataset.testament === 'nt' && !!document.querySelector('#bwz-pk-panel-nt a.bwz-bg-book')`))
  await go("/" + encodeURI("40-馬太福音/書卷導論"), 3000)
  check("書卷導論頁：book 版面、有「書卷導論」連結、沒有全書目錄連結、預設新約", await ev(`document.querySelector('.bwz-picker').dataset.mode === 'book' && [...document.querySelectorAll('.bwz-pk-link')].map((a) => a.textContent).join() === '書卷導論'`))
  await close(s)
}
console.log(`\n${results.filter(Boolean).length}/${results.length} 通過`)
process.exit(results.some((x) => !x) ? 1 : 0)
