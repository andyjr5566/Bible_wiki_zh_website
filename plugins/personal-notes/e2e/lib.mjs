// 共用的 headless Chrome（CDP）檢查工具。只被 e2e/*.mjs 匯入，本身不執行任何檢查。
//
// 每支檢查腳本的寫法：
//   import { startBrowser, sleep, ch1, setVal, clickText, selectIn, toolbarButtons } from "./lib.mjs"
//   const s = await startBrowser({ root, profile, width, height, mobile, incognito, shotDir })
//   const { send, ev, check, go, errors, finish } = s
//   ...只寫這支腳本自己的步驟...
//   finish()
//
// 環境變數 CHROME_PATH 可指定 chrome.exe（預設 C:/Program Files/Google/Chrome/Application/chrome.exe）。
// 環境變數 CHROME_FLAGS（空白分隔）會附加到 Chrome 旗標後面，例如 CI 用 "--no-sandbox --disable-dev-shm-usage"。

import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"

export const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe"
// 額外的 Chrome 旗標（空白分隔；沒設定就是空陣列，不影響既有腳本）
export const EXTRA_FLAGS = (process.env.CHROME_FLAGS || "").split(/\s+/).filter(Boolean)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 第 1 章的站內路徑（已 encodeURI；使用時接在 root 後面）
export const ch1 = "/" + encodeURI("01-創世記/第1章")

// 在輸入框填值並觸發 input 事件（游標放到文字最後）
export const setVal = (sel, v) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.focus(); el.value = ${JSON.stringify(v)}; el.setSelectionRange(el.value.length, el.value.length); el.dispatchEvent(new Event('input', { bubbles: true })) })()`

// 點擊範圍內文字符合的按鈕
export const clickText = (scope, text) => `[...document.querySelectorAll(${JSON.stringify(scope)})].find(b => b.textContent.trim() === ${JSON.stringify(text)} || b.textContent.includes(${JSON.stringify(text)}))?.click()`

// 選取某一節裡的某段文字（或跨節）
export const selectIn = (v1, text1, v2 = null, text2 = null) => `(() => {
  const nodeWith = (li, t) => { const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const i = n.data.indexOf(t); if (i >= 0) return [n, i] } return null }
  const a = nodeWith(document.querySelector('li[data-v="${v1}"]'), ${JSON.stringify(text1)})
  const b = ${v2 ? `nodeWith(document.querySelector('li[data-v="${v2}"]'), ${JSON.stringify(text2)})` : "a"}
  const r = document.createRange(); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1] + ${JSON.stringify(text2 ?? text1)}.length)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString()
})()`

// 目前看得到的選取工具列按鈕文字
export const toolbarButtons = `[...document.querySelectorAll('.bwz-h-toolbar:not([hidden]) button')].map(b => b.textContent)`

// 開一條 CDP WebSocket。onEvent 接收沒有 id 的事件（有 method 的訊息）。
function connect(url, onEvent) {
  const sock = new WebSocket(url)
  const pending = new Map()
  let seq = 0
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
    else if (m.method) onEvent(m)
  }
  return {
    ready: new Promise((r) => (sock.onopen = r)),
    // sessionId（選填）：送給用 Target.attachToTarget（flatten）接上的其他目標，例如 Service Worker
    send: (method, params = {}, sessionId) => new Promise((res) => { const id = ++seq; pending.set(id, res); sock.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })) }),
    close: () => sock.close(),
  }
}

// 啟動 headless Chrome（隨機除錯埠）並連上第一個分頁。
//   root        站台根網址，例如 http://localhost:8090/Bible_wiki_zh_website（結尾不加 /）
//   profile     Chrome user-data-dir
//   width/height 視窗與視埠大小（預設 1280x900）
//   mobile      true 時用 2 倍像素、觸控、行動版模擬（手機檢查用）
//   incognito   預設 true（--incognito）；mobilecheck 關掉
//   shotDir     截圖資料夾（shot 用）；沒有給就不存圖
//   userAgent   選填，覆寫 User-Agent
//   detailMax   check 的說明文字最多印幾個字（預設 220）
export async function startBrowser({ root, profile, width = 1280, height = 900, mobile = false, incognito = true, shotDir = null, userAgent = null, detailMax = 220 } = {}) {
  const port = 9100 + Math.floor(Math.random() * 90)
  const flags = ["--headless=new", ...(incognito ? ["--incognito"] : []), `--window-size=${width},${height}`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", ...EXTRA_FLAGS, "about:blank"]
  const proc = spawn(CHROME, flags, { stdio: "ignore" })
  // 路徑錯誤或沒有執行權限時，spawn 會丟出 error 事件；不接的話只會看到一長串看不懂的堆疊
  proc.on("error", (err) => {
    console.error(`無法啟動 Chrome：${CHROME}（${err.code ?? err.message}）。請確認路徑，或用環境變數 CHROME_PATH 指定 Chrome 的執行檔。`)
    process.exit(1)
  })

  let pageWs
  for (let i = 0; i < 75 && !pageWs; i++) {
    try { pageWs = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl } catch {}
    if (!pageWs) await sleep(200)
  }
  if (!pageWs) { proc.kill(); throw new Error(`Chrome 沒有在除錯埠 ${port} 開啟分頁`) }

  // 事件分派：on(method, fn) 訂閱 CDP 事件
  const listeners = new Map()
  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn])
  const page = connect(pageWs, (m) => { for (const fn of listeners.get(m.method) ?? []) fn(m) })
  const extra = []
  await page.ready

  const errors = []
  on("Runtime.exceptionThrown", (m) => errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text))
  const send = page.send
  await send("Page.enable")
  await send("Runtime.enable")
  await setViewport(width, height, { dpr: mobile ? 2 : 1, mobile, touch: mobile })
  if (userAgent) await send("Emulation.setUserAgentOverride", { userAgent })

  const results = []
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))?.result?.value

  // 印出 PASS/FAIL 一行並記下結果
  const check = (name, ok, detail = "") => {
    results.push(ok)
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== "" ? "  — " + String(detail).slice(0, detailMax) : ""}`)
  }

  // 導航到 root + path，等 wait 毫秒
  const go = async (path, wait = 4500) => { await send("Page.navigate", { url: root + path }); await sleep(wait) }

  // 改變視埠（手機中途切換用）。touch 要明確指定。
  async function setViewport(w, h, { dpr = 1, mobile: isMobile = false, touch = false } = {}) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: isMobile })
    if (touch) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
  }

  // 截圖成 Buffer（clip 選填）
  const capture = async (clip = null) => {
    const r = await send("Page.captureScreenshot", clip ? { format: "png", clip } : { format: "png" })
    return r?.data ? Buffer.from(r.data, "base64") : null
  }
  // 存到 shotDir/<name>.png（沒有 shotDir 就跳過）
  const shot = async (name) => { if (!shotDir) return; const b = await capture(); if (b) writeFileSync(`${shotDir}/${name}.png`, b) }
  // 存到指定檔案路徑
  const saveShot = async (file, clip = null) => { const b = await capture(clip); if (b) writeFileSync(file, b) }

  // 新增一則筆記：按「新增筆記」、可選地先執行 extra 的 JS、再填內容
  const newNote = async (body, extraJs = "") => {
    await ev(clickText(".bwz-notes button", "新增筆記"))
    await sleep(600)
    if (extraJs) await ev(extraJs)
    await ev(setVal(".bwz-n-card.editing textarea", body))
    await sleep(900)
  }

  // 另外開一條瀏覽器層級（browser target）的 CDP 連線，例如要設定下載行為時使用
  const openBrowserSocket = async () => {
    const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
    const c = connect(v.webSocketDebuggerUrl, () => {})
    await c.ready
    extra.push(c)
    return c
  }

  // 印總結、關掉連線、殺掉 Chrome；有任何一項失敗就以 1 結束
  const finish = () => {
    console.log(`\n${results.filter(Boolean).length}/${results.length} 通過`)
    for (const c of extra) c.close()
    page.close()
    proc.kill()
    process.exit(results.some((ok) => !ok) ? 1 : 0)
  }

  return { root, shotDir, send, on, ev, check, go, errors, results, setViewport, capture, shot, saveShot, newNote, openBrowserSocket, finish, sleep }
}
