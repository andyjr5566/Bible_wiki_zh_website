// 拍互動網站的封面圖，給互動網站總入口與章節頁用。
// 新網站還沒有封面時，網站會先顯示書法標題封面；部署檢查發現缺封面會提醒補拍。
//
// 用法：
//   node scripts/capture-covers.mjs                              拍 config/interactive-sites.json 裡的全部網站
//   node scripts/capture-covers.mjs 創世記/第6章 民數記/第33章   只拍指定的網站
//   node scripts/capture-covers.mjs --base <網址> ...            改用別的網站根目錄（例如本機測試站），結尾不加 /
//
// 流程：無頭 Chrome 開 1440×900 → 等 3D 載入 → 關掉教學框 → 截圖 → 依 cover.crop 裁切 → 縮成 640×400 WebP。
// 為什麼要裁切：整頁縮到 640 寬時字太小看不清，所以只留下重點區域。
// cover.crop = [x, y, 寬, 高]，以 1440×900 的截圖座標為準；cover.hash 會接在網址後面（例如 #p=大衛）。
// 輸出：quartz/static/interactive-covers/<key 的 / 換成 ->.webp，例如 創世記-第6章.webp

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { startBrowser, sleep } from "../plugins/personal-notes/e2e/lib.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CONFIG = join(repo, "config", "interactive-sites.json")
const OUT_DIR = join(repo, "quartz", "static", "interactive-covers")
const DEFAULT_BASE = "https://andyjr5566.github.io/Bible_wiki_zh_website/static/website"
const SHOT_W = 1440
const SHOT_H = 900
const COVER_W = 640
const COVER_H = 400
const LOAD_WAIT_MS = 14000
const DISMISS_WORDS = ["略過", "跳過", "關閉", "知道了", "稍後", "不用了", "先逛逛", "自己看", "×", "✕"]

const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

// 點掉教學框：文字或 aria-label 含關鍵字的可見按鈕都點一次
const DISMISS_JS = `(() => {
  const words = ${JSON.stringify(DISMISS_WORDS)}
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" }
  let n = 0
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    const label = el.textContent.trim() + " " + (el.getAttribute("aria-label") || "")
    if (words.some((w) => label.includes(w)) && visible(el)) { el.click(); n++ }
  }
  return n
})()`

const pressEscape = async (s) => {
  for (const type of ["keyDown", "keyUp"]) {
    await s.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  }
}

const dismissRound = async (s) => {
  const clicked = await s.ev(DISMISS_JS)
  await pressEscape(s)
  return clicked
}

// 依 crop 裁切再縮成 640×400（fit cover）；沒有 crop 就整張縮放
const toCover = (png, crop) => {
  let img = sharp(png)
  if (crop) {
    const [x, y, w, h] = crop
    img = img.extract({ left: x, top: y, width: w, height: h })
  }
  return img.resize(COVER_W, COVER_H, { fit: "cover" }).webp({ quality: 72 }).toBuffer()
}

async function main() {
  const args = process.argv.slice(2)
  let base = DEFAULT_BASE
  const keys = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base") {
      base = args[++i]
      if (!base) fail("--base 後面要接網址")
    } else {
      keys.push(args[i])
    }
  }
  base = base.replace(/\/+$/, "")

  const { sites } = JSON.parse(readFileSync(CONFIG, "utf8"))
  const targets = keys.length ? keys : Object.keys(sites)
  const unknown = targets.filter((k) => !sites[k])
  if (unknown.length) fail(`config/interactive-sites.json 裡找不到：${unknown.join("、")}`)

  mkdirSync(OUT_DIR, { recursive: true })
  const s = await startBrowser({ root: base, profile: join(tmpdir(), "bwz-capture-covers-profile"), width: SHOT_W, height: SHOT_H })

  for (const key of targets) {
    const cover = sites[key].cover ?? {}
    const path = `/${key.split("/").map(encodeURIComponent).join("/")}/dist/index.html${cover.hash ?? ""}`
    const out = join(OUT_DIR, `${key.replaceAll("/", "-")}.webp`)
    try {
      console.log(`拍 ${key} …`)
      await s.go(path, LOAD_WAIT_MS)
      const n1 = await dismissRound(s)
      await sleep(1500)
      const n2 = await dismissRound(s)
      await sleep(2500)
      const png = await s.capture()
      if (!png) throw new Error("截圖失敗")
      const webp = await toCover(png, cover.crop)
      writeFileSync(out, webp)
      s.check(key, true, `教學框點了 ${n1 + n2} 次，${(webp.length / 1024).toFixed(1)} KB → ${out}`)
    } catch (err) {
      s.check(key, false, err.message)
    }
  }

  s.finish()
}

main().catch((err) => fail(err.stack || String(err)))
