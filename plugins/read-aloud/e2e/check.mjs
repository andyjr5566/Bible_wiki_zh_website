// 經文朗讀：無頭 Chrome 驗證（以假的 speechSynthesis 驗證邏輯；沒有真的聲音）。
// 用法：node e2e/check.mjs <siteDir> <profile> <shotDir>
//   siteDir  `npx quartz build -d test_content -o <siteDir>` 的輸出資料夾（含 01-創世記 第1、2章）
//   profile  Chrome user-data-dir（放 scratchpad；每次執行請用新的資料夾，才能驗證「預設語速 1.0×」）
//   shotDir  截圖資料夾（會自動建立）
// 本腳本自己在隨機埠開一個靜態伺服器（站台根目錄 "/"），不需要事先啟動伺服器。
// 重用 plugins/personal-notes/e2e/lib.mjs（不修改它）。
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { startBrowser } from "../../personal-notes/e2e/lib.mjs"

const [siteDir, profile, shotDir] = process.argv.slice(2)
if (!siteDir || !profile || !shotDir) {
  console.error("用法：node e2e/check.mjs <siteDir> <profile> <shotDir>")
  process.exit(2)
}
mkdirSync(shotDir, { recursive: true })

// ---------- 靜態伺服器（/foo → foo.html、/dir/ → dir/index.html） ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".xml": "application/xml" }
const tryFile = async (p) => { try { return (await stat(p)).isFile() ? p : null } catch { return null } }
const server = createServer(async (req, res) => {
  // baseUrl 帶子路徑（GitHub Pages 的 /Bible_wiki_zh_website），部分資源會用子路徑請求，這裡兩種都接受
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/Bible_wiki_zh_website(?=\/|$)/, "") || "/"
  const base = path.join(siteDir, p)
  const file = (await tryFile(base)) ?? (await tryFile(base + ".html")) ?? (await tryFile(path.join(base, "index.html")))
  if (!file) {
    const nf = await tryFile(path.join(siteDir, "404.html"))
    res.writeHead(404, { "content-type": TYPES[".html"] })
    return res.end(nf ? await readFile(nf) : "not found")
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" })
  res.end(await readFile(file))
})
const port = await new Promise((r) => server.listen(0, "127.0.0.1", () => r(server.address().port)))
const root = `http://127.0.0.1:${port}`

// ---------- 假的 speechSynthesis（頁面載入前注入） ----------
// speech.ts 用 utterance.addEventListener("start"/"boundary"/"end")（沒有 addEventListener 才退回 onend），
// 所以假的 Utterance 繼承 EventTarget，用 dispatchEvent(new Event("end")) 觸發。
const FAKE = `(() => {
  try { localStorage.setItem('wikiTourCompleted', '1') } catch {}   // 不要讓 wiki-tour 的歡迎卡片擋住截圖
  window.__spoken = []        // { text, rate } 依序
  window.__cancelCount = 0
  window.__utts = []          // 所有被 speak 過的 utterance
  let current = null
  class FakeUtterance extends EventTarget {
    constructor(text) { super(); this.text = text; this.rate = 1; this.lang = ""; this.voice = null; this.pitch = 1; this.volume = 1 }
  }
  const voice = { lang: "zh-TW", name: "Fake zh-TW", default: true, localService: true, voiceURI: "fake-zh-TW" }
  const synth = new EventTarget()
  synth.getVoices = () => [voice]
  synth.speak = (u) => { window.__spoken.push({ text: u.text, rate: u.rate }); window.__utts.push(u); current = u }
  synth.cancel = () => { window.__cancelCount++; current = null }
  synth.pause = () => {}
  synth.resume = () => {}
  Object.defineProperty(synth, "speaking", { get: () => !!current })
  Object.defineProperty(synth, "pending", { get: () => false })
  Object.defineProperty(synth, "paused", { get: () => false })
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true })
  window.SpeechSynthesisUtterance = FakeUtterance
  // 觸發「最新一個 utterance」的 end
  window.__fireEnd = () => { const u = window.__utts[window.__utts.length - 1]; if (u) u.dispatchEvent(new Event("end")); return !!u }
  window.__fireEndOf = (i) => { const u = window.__utts[i]; if (u) u.dispatchEvent(new Event("end")); return !!u }
})()`

const s = await startBrowser({ root, profile, width: 1200, height: 900, shotDir })
const { send, on, ev, check, go, errors, sleep, saveShot, setViewport, finish } = s
await send("Page.addScriptToEvaluateOnNewDocument", { source: FAKE })

// console.error 也算錯誤（lib 的 errors 只收未捕捉例外）
const consoleErrors = []
on("Runtime.consoleAPICalled", (m) => { if (m.params.type === "error") consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ")) })

// ---------- 輔助 ----------
const ch1 = "/" + encodeURI("01-創世記/第1章")
const ch2 = "/" + encodeURI("01-創世記/第2章")
const toc = "/" + encodeURI("01-創世記/全書目錄及綱要")
const waitFor = async (expr, timeout = 6000) => { for (let t = 0; t < timeout; t += 100) { if (await ev(expr)) return true; await sleep(100) } return false }
const j = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))
// 經文清單（朗讀列正下方的 ol）每節的朗讀文字（略過 .bwz-v-ui / [hidden]，空白整理）
const EXPECTED = `(() => { const ol = document.querySelector('.bwz-ra')?.nextElementSibling; if (!ol) return []; return [...ol.children].filter(c => c.tagName === 'LI').map(li => { const c = li.cloneNode(true); c.querySelectorAll('.bwz-v-ui,[hidden],script,style').forEach(e => e.remove()); return c.textContent.replace(/\\s+/g, ' ').trim() }) })()`
const lis = `[...document.querySelector('.bwz-ra').nextElementSibling.children].filter(c => c.tagName === 'LI')`
const barReady = `document.querySelectorAll('.bwz-ra').length === 1`
const playBtn = `document.querySelector('.bwz-ra button')`
const btnText = `${playBtn}?.textContent.trim()`
const spokenLen = `window.__spoken.length`
const nowIdx = `${lis}.map((l, i) => l.classList.contains('bwz-ra-now') ? i : -1).filter(i => i >= 0)`
const setSelect = (n, v) => `(() => { const sel = document.querySelectorAll('.bwz-ra select')[${n}]; sel.value = ${JSON.stringify(String(v))}; sel.dispatchEvent(new Event('change', { bubbles: true })) })()`

async function openChapter(p) {
  await go(p + "?skip=1", 1500)
  return waitFor(barReady, 7000)
}

// 朗讀列（播放中）背景不透明度，以及在朗讀列範圍內取樣：最上層元素是否都屬於朗讀列
const occlusion = () => j(`(() => { const bar = document.querySelector('.bwz-ra'); const bg = getComputedStyle(bar).backgroundColor
  const m = bg.match(/\\/\\s*([\\d.]+)\\s*\\)/) || bg.match(/rgba\\([^)]*,\\s*([\\d.]+)\\)/); const alpha = m ? Number(m[1]) : 1
  const r = bar.getBoundingClientRect(); let covered = 0, total = 0, who = []
  for (const fx of [0.05, 0.3, 0.5, 0.7, 0.95]) for (const fy of [0.15, 0.5, 0.85]) { total++; const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (el && !bar.contains(el) && el !== bar) { covered++; who.push(el.tagName + '.' + String(el.className).slice(0, 30)) } }
  return { bg, alpha, covered, total, who: [...new Set(who)].slice(0, 4) } })()`)

// 從第 15 節開始播放（讓畫面真的捲動、朗讀列貼頂），等捲動結束後截圖並檢查「朗讀列貼頂、被唸的那節在視窗內」，最後停止。
async function playShot(file, label) {
  await ev(setSelect(0, 14))
  await ev(`${playBtn}.click()`)
  await waitFor(`${btnText} === '■ 停止'`)
  await ev(`document.documentElement.style.scrollBehavior = 'auto'`)
  await sleep(2200) // 等平滑捲動結束
  const st = await j(`(() => { const bar = document.querySelector('.bwz-ra'); const br = bar.getBoundingClientRect(); const li = document.querySelector('.bwz-ra-now'); const lr = li.getBoundingClientRect(); return { barTop: Math.round(br.top), barBottom: Math.round(br.bottom), liTop: Math.round(lr.top), liBottom: Math.round(lr.bottom), innerH: innerHeight, scrollY: Math.round(scrollY), pos: getComputedStyle(bar).position, liNo: li.value || null } })()`)
  const occ = await occlusion()
  await saveShot(file)
  check(label + " 朗讀列不透明、沒被別的元素蓋住（elementFromPoint 取樣）", occ.alpha >= 0.9 && occ.covered === 0, JSON.stringify(occ))
  check(label + " 朗讀列貼在視窗頂端、被唸的那節在視窗內且沒被朗讀列蓋住", st.pos === "sticky" && st.barTop >= 0 && st.barTop < 80 && st.liTop >= st.barBottom - 2 && st.liBottom <= st.innerH, JSON.stringify(st))
  await ev(`${playBtn}.click()`)
  await waitFor(`${btnText} === '▶ 播放'`)
  // 中途停止時下拉留在最後唸的那一節（方便接著再聽）；整章唸完才回到第 1 節
  const kept = await j(`document.querySelector('.bwz-ra select').value`)
  check(label + " 手動停止後「從第 N 節」留在最後唸的那一節", kept === "14", `value=${kept}`)
  await ev(setSelect(0, 0)) // 後面的檢查都從第 1 節開始
}

// ===== 1. 章節頁結構 =====
await go(ch1 + "?skip=1", 1500)
await ev(`try { localStorage.setItem('theme', 'light') } catch {}`) // 明確指定淺色（無頭 Chrome 預設可能是深色）
const loaded = await openChapter(ch1)
check("1a 章節頁載入並出現 .bwz-ra", loaded)
const c1 = await j(`(() => {
  const bars = document.querySelectorAll('.bwz-ra')
  const bar = bars[0]; const ol = bar?.nextElementSibling
  const article = document.querySelector('article'); const content = article.querySelector(':scope > .markdown-preview-view') ?? article
  let firstOl = null; for (const c of content.children) { if (c.tagName === 'HR') break; if (c.tagName === 'OL') { firstOl = c; break } }
  const liCount = ol ? [...ol.children].filter(c => c.tagName === 'LI').length : -1
  const sels = bar.querySelectorAll('select')
  return { bars: bars.length, directlyAbove: !!ol && ol === firstOl && ol.tagName === 'OL', parentIsContent: bar.parentElement === ol?.parentElement,
           options: sels[0]?.options.length, liCount, rate: sels[1]?.value, rateLabel: sels[1]?.selectedOptions[0]?.textContent, btn: bar.querySelector('button').textContent.trim() }
})()`)
check("1b .bwz-ra 恰有 1 個，位於經文 ol 正上方", c1.bars === 1 && c1.directlyAbove && c1.parentIsContent, JSON.stringify(c1))
check("1c「從第 N 節」選項數 = 經文 li 數", c1.options === c1.liCount && c1.liCount > 1, `options=${c1.options} li=${c1.liCount}`)
check("1d 預設語速 1.0×，按鈕「▶ 播放」", c1.rate === "1" && c1.rateLabel === "1.0×" && c1.btn === "▶ 播放", `${c1.rateLabel} / ${c1.btn}`)
const N = c1.liCount
const expected = await j(EXPECTED)

// ===== 9a. 桌面待命截圖（先拍，避免捲動） =====
await ev(`window.scrollTo(0, 0)`)
await ev(`document.querySelector('.bwz-ra').scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -120)`)
await sleep(400)
const shots = {}
shots.desktopIdle = `${shotDir}/desktop-1200-idle.png`
await saveShot(shots.desktopIdle)
shots.desktopPlaying = `${shotDir}/desktop-1200-playing.png`
await playShot(shots.desktopPlaying, "9d 桌面 1200 淺色播放中：")
await ev(`window.__spoken.length = 0; window.__utts.length = 0`) // 截圖用的播放不要混進後面的朗讀紀錄

// ===== 2. 播放 =====
await ev(`${playBtn}.click()`)
await waitFor(`${spokenLen} >= 1`)
const p2 = await j(`(() => { const bar = document.querySelector('.bwz-ra'); return { first: window.__spoken[0], now: ${nowIdx}, nowCount: document.querySelectorAll('.bwz-ra-now').length, btn: ${btnText}, playing: bar.classList.contains('is-playing'), pos: getComputedStyle(bar).position } })()`)
check("2a 第一個被朗讀的文字 = 第 1 節文字", p2.first?.text === expected[0] && expected[0].length > 0, `spoken="${p2.first?.text?.slice(0, 40)}" rate=${p2.first?.rate}`)
check("2b 第 1 節 li 有 bwz-ra-now，且全頁只有一節", JSON.stringify(p2.now) === "[0]" && p2.nowCount === 1, JSON.stringify({ now: p2.now, count: p2.nowCount }))
check("2c 按鈕變「■ 停止」", p2.btn === "■ 停止", p2.btn)
check("2d .bwz-ra 有 is-playing 且 position: sticky", p2.playing && p2.pos === "sticky", `playing=${p2.playing} position=${p2.pos}`)

// ===== 3. 依序唸完所有節 =====
let orderOk = true, orderDetail = ""
for (let i = 1; i < N; i++) {
  await ev(`window.__fireEnd()`)
  const ok = await waitFor(`${spokenLen} >= ${i + 1}`, 3000)
  const now = await j(nowIdx)
  if (!ok || JSON.stringify(now) !== JSON.stringify([i])) { orderOk = false; orderDetail = `第 ${i + 1} 節: spoken 到達=${ok} now=${JSON.stringify(now)}`; break }
}
check("3a 每節 end 後換成下一節並只標示該節", orderOk, orderDetail || `${N} 節`)
await ev(`window.__fireEnd()`) // 最後一節 end
const idle = await waitFor(`${btnText} === '▶ 播放'`, 3000)
const spoken = await j(`window.__spoken.map(s => s.text)`)
check("3b __spoken 依序等於各節文字（共 N 節，不含其他段落）", JSON.stringify(spoken) === JSON.stringify(expected) && spoken.length === N, `spoken=${spoken.length} expected=${N}`)
const afterEnd = await j(`({ btn: ${btnText}, now: document.querySelectorAll('.bwz-ra-now').length, playing: document.querySelector('.bwz-ra').classList.contains('is-playing'), sel: document.querySelector('.bwz-ra select').value })`)
check("3c 最後一節 end 後按鈕回「▶ 播放」，bwz-ra-now 全移除", idle && afterEnd.now === 0 && !afterEnd.playing, JSON.stringify(afterEnd))

// ===== 4. .bwz-v-ui 不被朗讀 =====
await ev(`(() => { const li = ${lis}[2]; const sp = document.createElement('span'); sp.className = 'bwz-v-ui'; sp.textContent = '📝這是筆記'; li.appendChild(sp) })()`)
const expected4 = await j(EXPECTED)
const before4 = await ev(spokenLen)
await ev(setSelect(0, 2))
await ev(`${playBtn}.click()`)
await waitFor(`${spokenLen} > ${before4}`)
const t4 = await ev(`window.__spoken[${before4}].text`)
check("4 插入 .bwz-v-ui 後重新播放該節，朗讀文字不含「這是筆記」且等於該節文字", typeof t4 === "string" && !t4.includes("這是筆記") && !t4.includes("📝") && t4 === expected4[2] && t4 === expected[2], `spoken="${t4?.slice(0, 40)}"`)
await ev(`${playBtn}.click()`) // 停止
await waitFor(`${btnText} === '▶ 播放'`)

// ===== 5. 播放中換起始節、改語速 =====
await ev(setSelect(0, 0))
await ev(setSelect(1, 1)) // 確保語速 1.0
await ev(`${playBtn}.click()`)
await waitFor(`${btnText} === '■ 停止'`)
let base = await ev(spokenLen)
await ev(setSelect(0, 4)) // 從第 5 節
await waitFor(`${spokenLen} > ${base}`)
const p5 = await j(`({ last: window.__spoken[window.__spoken.length - 1], now: ${nowIdx}, btn: ${btnText} })`)
check("5a 播放中選「從第 5 節」：重新從第 5 節開始", p5.last.text === expected[4] && JSON.stringify(p5.now) === "[4]" && p5.btn === "■ 停止", JSON.stringify({ now: p5.now, text: p5.last.text.slice(0, 20) }))
base = await ev(spokenLen)
await ev(setSelect(1, 1.25))
await waitFor(`${spokenLen} > ${base}`)
const p5b = await j(`({ last: window.__spoken[window.__spoken.length - 1], now: ${nowIdx}, stored: (() => { try { return localStorage.getItem('bwz-read-aloud-rate') } catch { return 'ERR' } })() })`)
check("5b 改語速 1.25×：目前這節以 rate 1.25 重新朗讀", p5b.last.rate === 1.25 && p5b.last.text === expected[4] && JSON.stringify(p5b.now) === "[4]", JSON.stringify({ rate: p5b.last.rate, now: p5b.now }))
check("5c localStorage bwz-read-aloud-rate = \"1.25\"", p5b.stored === "1.25", String(p5b.stored))
await ev(`${playBtn}.click()`) // 停止
await openChapter(ch1) // 重新載入
const rl = await j(`({ v: document.querySelectorAll('.bwz-ra select')[1]?.value, label: document.querySelectorAll('.bwz-ra select')[1]?.selectedOptions[0]?.textContent })`)
check("5d 重新載入後語速下拉顯示 1.25×", rl.v === "1.25" && rl.label === "1.25×", JSON.stringify(rl))

// ===== 6. 停止 =====
await ev(`${playBtn}.click()`)
await waitFor(`${btnText} === '■ 停止'`)
const rate6 = await ev(`window.__spoken[window.__spoken.length - 1].rate`)
const cancelBefore = await ev(`window.__cancelCount`)
const spokenBefore = await ev(spokenLen)
const lastUttIdx = (await ev(`window.__utts.length`)) - 1
await ev(`${playBtn}.click()`) // ■ 停止
await sleep(300)
const p6 = await j(`({ btn: ${btnText}, cancel: window.__cancelCount, now: document.querySelectorAll('.bwz-ra-now').length })`)
await ev(`window.__fireEndOf(${lastUttIdx})`)
await sleep(500)
const spokenAfter = await ev(spokenLen)
check("6a 按「■ 停止」：__cancelCount 增加、按鈕回「▶ 播放」、標示移除", p6.cancel > cancelBefore && p6.btn === "▶ 播放" && p6.now === 0, JSON.stringify({ cancelBefore, ...p6 }))
check("6b 停止後再觸發舊的 end，不會朗讀下一節", spokenAfter === spokenBefore, `spoken ${spokenBefore} -> ${spokenAfter}（重新載入後以 rate ${rate6} 播放）`)

// ===== 6b2. 語速可選到 2 倍 =====
const rateLabels = await j(`[...document.querySelectorAll('.bwz-ra select')[1].options].map((o) => o.textContent)`)
check("6b2 語速選項含 1.75× 與 2.0×", JSON.stringify(rateLabels) === JSON.stringify(["0.75×", "1.0×", "1.25×", "1.5×", "1.75×", "2.0×"]), JSON.stringify(rateLabels))
await ev(`window.__spoken.length = 0; window.__utts.length = 0`)
await ev(setSelect(1, 2))
await ev(`${playBtn}.click()`)
await waitFor(`${spokenLen} >= 1`)
const rate2 = await j(`({ rate: window.__spoken[0].rate, saved: localStorage.getItem('bwz-read-aloud-rate') })`)
check("6b3 選 2.0× 後以 rate 2 朗讀並記住", rate2.rate === 2 && rate2.saved === "2", JSON.stringify(rate2))
await ev(`${playBtn}.click()`) // 停止
await sleep(300)
await ev(setSelect(1, 1))

// ===== 6c. 語音出錯：停下來並說明，不會悄悄跳過後面的節 =====
await ev(`window.__spoken.length = 0; window.__utts.length = 0`)
await ev(`${playBtn}.click()`) // ▶ 播放
await waitFor(`${spokenLen} >= 1`)
await ev(`(() => { const u = window.__utts[window.__utts.length - 1]; const e = new Event("error"); e.error = "not-allowed"; u.dispatchEvent(e) })()`)
await sleep(400)
const p6c = await j(`({ btn: ${btnText}, spoken: ${spokenLen}, now: document.querySelectorAll('.bwz-ra-now').length, msg: document.querySelector('.bwz-ra-msg')?.textContent || '' })`)
check("6c 語音出錯：回到待命、只唸過 1 節、顯示說明文字", p6c.btn === "▶ 播放" && p6c.spoken === 1 && p6c.now === 0 && p6c.msg.includes("沒辦法朗讀"), JSON.stringify(p6c))
await ev(`${playBtn}.click()`) // 再按一次播放：說明文字消失
await waitFor(`${spokenLen} >= 2`)
check("6d 重新播放後說明文字消失", (await ev(`document.querySelector('.bwz-ra-msg')?.textContent || ''`)) === "")
await ev(`${playBtn}.click()`) // 停止，恢復待命
await sleep(300)

// ===== 7. 非章節頁 =====
const nonChapter = {}
for (const [name, p] of [["首頁", "/?skip=1"], ["全書目錄及綱要", toc + "?skip=1"]]) {
  await go(p, 3500)
  nonChapter[name] = await j(`({ bars: document.querySelectorAll('.bwz-ra').length, scriptBound: !!window.__bwzReadAloudBound, title: document.title })`)
  check(`7 ${name} 沒有 .bwz-ra（朗讀 script 已載入）`, nonChapter[name].bars === 0 && nonChapter[name].scriptBound, JSON.stringify(nonChapter[name]))
}

// ===== 8. SPA 換頁 =====
await openChapter(ch1)
await ev(`window.__spaMarker = 'alive'`)
// 點站內連結：優先用頁面上現成的連結（例如側欄檔案樹）；找不到就插入一個站內連結並點它（Quartz 的 SPA 點擊攔截是全域的）
const clickLink = (target) => ev(`(() => {
  const want = decodeURIComponent(${JSON.stringify(target)})
  let a = [...document.querySelectorAll('a[href]')].find(x => { try { return decodeURIComponent(new URL(x.href).pathname) === want } catch { return false } })
  let injected = false
  if (!a) { a = document.createElement('a'); a.href = ${JSON.stringify(target)}; a.className = 'internal'; a.textContent = 'e2e-link'; document.body.appendChild(a); injected = true }
  a.click(); return injected ? 'injected' : 'existing'
})()`)
const h1Has = (t) => `(document.querySelector('article h1')?.textContent || '').includes(${JSON.stringify(t)})`
const barState = `({ bars: document.querySelectorAll('.bwz-ra').length, h1: document.querySelector('article h1')?.textContent.trim(), now: document.querySelectorAll('.bwz-ra-now').length, opts: document.querySelector('.bwz-ra select')?.options.length, lis: (() => { const ol = document.querySelector('.bwz-ra')?.nextElementSibling; return ol ? [...ol.children].filter(c => c.tagName === 'LI').length : -1 })(), spa: window.__spaMarker })`

await ev(`${playBtn}.click()`)
await waitFor(`${btnText} === '■ 停止'`)
const cancel8 = await ev(`window.__cancelCount`)
const spoken8 = await ev(spokenLen)
const lastUtt8 = (await ev(`window.__utts.length`)) - 1
const how = await clickLink(ch2)
await waitFor(`${h1Has("第2章")} && ${barReady}`, 7000)
await sleep(500)
const s8 = await j(barState)
const exp2 = await j(EXPECTED)
check("8a 播放中 SPA 換到第 2 章：舊朗讀被停止（__cancelCount 增加）", (await ev(`window.__cancelCount`)) > cancel8, `cancel ${cancel8} -> ${await ev(`window.__cancelCount`)}（連結：${how}）`)
check("8b 換頁後 .bwz-ra 恰有 1 個、屬於第 2 章、無殘留 bwz-ra-now、且為 SPA（沒整頁重載）", s8.bars === 1 && s8.h1.includes("第2章") && s8.now === 0 && s8.opts === s8.lis && s8.lis === exp2.length && s8.spa === "alive", JSON.stringify(s8))
await ev(`window.__fireEndOf(${lastUtt8})`)
await sleep(400)
check("8c 換頁後觸發舊 utterance 的 end，不會朗讀任何東西", (await ev(spokenLen)) === spoken8, `spoken ${spoken8} -> ${await ev(spokenLen)}`)
let roundOk = true, roundDetail = []
for (let k = 1; k <= 3; k++) {
  await clickLink(ch1)
  await waitFor(`${h1Has("第1章")} && ${barReady}`, 7000)
  await sleep(300)
  const a = await j(barState)
  await clickLink(ch2)
  await waitFor(`${h1Has("第2章")} && ${barReady}`, 7000)
  await sleep(300)
  const b = await j(barState)
  const ok = a.bars === 1 && a.h1.includes("第1章") && a.opts === N && b.bars === 1 && b.h1.includes("第2章") && b.now === 0 && b.spa === "alive"
  roundDetail.push(`${k}:[${a.bars}/${a.h1},${b.bars}/${b.h1}]`)
  if (!ok) roundOk = false
}
check("8d 來回換頁 3 次後各頁都只有 1 個 .bwz-ra、章節正確", roundOk, roundDetail.join(" "))
// 換頁後仍可正常播放（確認新頁的朗讀列可用）
const base8 = await ev(spokenLen)
await ev(`${playBtn}.click()`)
await waitFor(`${spokenLen} > ${base8}`)
check("8e 換頁後的朗讀列可正常播放（朗讀第 2 章第 1 節）", (await ev(`window.__spoken[window.__spoken.length - 1].text`)) === exp2[0], "")
await ev(`${playBtn}.click()`)

// ===== 9. 版面截圖 =====
// 手機 375 寬：待命、播放中
await setViewport(375, 812, { dpr: 2, mobile: true })
await openChapter(ch1)
await sleep(500)
const layout = (label) => j(`(() => { const bar = document.querySelector('.bwz-ra'); const r = bar.getBoundingClientRect(); return { label: ${JSON.stringify(label)}, barScrollW: bar.scrollWidth, barClientW: bar.clientWidth, barRight: Math.round(r.right), docScrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, barH: Math.round(r.height), children: [...bar.children].map(c => Math.round(c.getBoundingClientRect().right)) } })()`)
await ev(`document.querySelector('.bwz-ra').scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -80)`)
await sleep(400)
const lyIdle = await layout("mobile-idle")
shots.mobileIdle = `${shotDir}/mobile-375-idle.png`
await saveShot(shots.mobileIdle)
check("9a 手機 375 待命：.bwz-ra scrollWidth <= clientWidth 且頁面沒有橫向溢出", lyIdle.barScrollW <= lyIdle.barClientW && lyIdle.docScrollW <= lyIdle.innerW, JSON.stringify(lyIdle))
shots.mobilePlaying = `${shotDir}/mobile-375-playing.png`
await ev(setSelect(0, 14))
await ev(`${playBtn}.click()`)
await waitFor(`${btnText} === '■ 停止'`)
await sleep(2200)
const lyPlay = await layout("mobile-playing")
const occM = await occlusion()
await saveShot(shots.mobilePlaying)
check("9f 手機 375 播放中：朗讀列不透明（且在頁面頂端固定列之上，不被它蓋住）", occM.alpha >= 0.9 && occM.covered === 0, JSON.stringify(occM))
check("9b 手機 375 播放中：.bwz-ra scrollWidth <= clientWidth 且頁面沒有橫向溢出", lyPlay.barScrollW <= lyPlay.barClientW && lyPlay.docScrollW <= lyPlay.innerW, JSON.stringify(lyPlay))
await ev(`${playBtn}.click()`)

// 深色模式（桌面 1200）。站上 darkmode 腳本：<html saved-theme="dark">、localStorage.theme="dark"
await setViewport(1200, 900, { dpr: 1, mobile: false })
await send("Emulation.setTouchEmulationEnabled", { enabled: false })
await ev(`try { localStorage.setItem('theme', 'dark') } catch {}`)
await openChapter(ch1)
shots.darkPlaying = `${shotDir}/desktop-1200-dark-playing.png`
await playShot(shots.darkPlaying, "9c 深色模式桌面 1200 播放中：")
const dark = await j(`(() => { const bar = document.querySelector('.bwz-ra'); const cs = getComputedStyle(bar); return { theme: document.documentElement.getAttribute('saved-theme'), bg: cs.backgroundColor, color: cs.color } })()`)
check("9e 深色模式：saved-theme=dark、朗讀列背景與文字顏色不同", dark.theme === "dark" && dark.bg !== dark.color, JSON.stringify(dark))
await ev(`try { localStorage.setItem('theme', 'light') } catch {}`)

// ===== 10. 沒有 console 錯誤、個人筆記未回歸 =====
check("10a 全程沒有未捕捉的 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
check("10b 全程沒有 console.error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "))
await openChapter(ch1)
await sleep(1500)
const pn = await j(`({ entry: !!document.querySelector('a.bwz-notes-entry'), notesPanel: !!document.querySelector('.bwz-notes'), toolbarPresent: true })`)
check("10c 個人筆記入口與筆記區塊仍存在（朗讀列沒有擠掉它們）", pn.entry && pn.notesPanel, JSON.stringify(pn))

console.log("\n截圖：")
for (const [k, v] of Object.entries(shots)) console.log(`  ${k}: ${v}`)
server.close()
finish()
