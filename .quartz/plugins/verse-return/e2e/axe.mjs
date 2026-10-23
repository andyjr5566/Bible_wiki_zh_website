// axe 無障礙檢查：章節頁（研讀／純經文）與條目頁（有／沒有返回按鈕）× 淺深 × 1440／390。critical 或 serious 就失敗。
// 用法：node e2e/axe.mjs <root> <profileRoot> <axe.min.js 路徑>
import { readFileSync } from "node:fs"
import { chapterPath, entryPath, open, clickSel, waitFor, sleep } from "./helpers.mjs"

const [ROOT, profileRoot, axePath] = process.argv.slice(2)
if (!ROOT || !profileRoot || !axePath) {
  console.error("用法：node e2e/axe.mjs <root> <profileRoot> <axe.min.js>")
  process.exit(2)
}
const axe = readFileSync(axePath, "utf8")
const results = []
const run = async (s, name) => {
  await s.ev(axe)
  const out = JSON.parse(await s.ev(`axe.run(document, { resultTypes: ['violations'] }).then((r) => JSON.stringify(r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))))`))
  const ok = out.length === 0
  results.push(ok)
  console.log(`${ok ? "PASS" : "FAIL"}  axe ${name}${ok ? "" : "  — " + JSON.stringify(out).slice(0, 600)}`)
}

for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  for (const theme of ["light", "dark"]) {
    const tag = `${w} ${theme}`
    let s = await open({ root: ROOT, profileRoot, theme, width: w, height: h, mobile })
    await s.go(chapterPath(2), 3500)
    await run(s, `章節（研讀）${tag}`)
    // 從經文連結進條目：有返回按鈕的條目頁
    await s.ev(`document.querySelector('article ol li:nth-child(7) a.internal').click()`)
    await waitFor(s, `!!document.querySelector('.bwz-vr-go')`, 6000)
    await sleep(800)
    await run(s, `條目（有返回按鈕）${tag}`)
    await s.go(entryPath("安息"), 3000)
    await s.ev(`sessionStorage.clear()`)
    await s.go(entryPath("安息"), 3000)
    await run(s, `條目（沒有按鈕）${tag}`)
    // 純經文
    await s.ev(`sessionStorage.setItem('bwz-ux-view','pure')`)
    await s.go(chapterPath(2), 3500)
    await run(s, `章節（純經文）${tag}`)
    // Aa 面板打開（含閱讀模式一列）
    await s.ev(`document.querySelector('.site-ux-btn').click()`)
    await sleep(500)
    await run(s, `章節＋Aa 面板 ${tag}`)
    s.send("Browser.close").catch(() => {})
    await sleep(500)
  }
}
console.log(`\n${results.filter(Boolean).length}/${results.length} 通過`)
process.exit(results.some((ok) => !ok) ? 1 : 0)
