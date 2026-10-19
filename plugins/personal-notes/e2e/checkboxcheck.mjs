// 勾選框排版檢查：網站主題替所有勾選框加了 margin-inline-start: -1.4rem，曾讓「每週自動備份」的勾選框蓋到「立即備份」按鈕（使用者實機截圖 2026-10-20）。
// 已登入的狀態畫面在無頭 Chrome 裡登不進去，所以在設定視窗裡放一份與 backupView.statusView、prompts.deleteAll 相同結構的元素，用網站真正的 CSS 量位置。
// 用法：node e2e/checkboxcheck.mjs <siteRoot> <profile> [shotDir]
import { startBrowser, clickText } from "./lib.mjs"

const [root, profile, shotDir] = process.argv.slice(2)
const s = await startBrowser({ root, profile, shotDir })
const { ev, check, go, shot, errors, setViewport, sleep, finish } = s
const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`))

const inject = `(() => {
  const sec = document.querySelector('.bwz-n-dialog [data-section="drive-backup"]')
  const area = document.createElement('div')
  area.className = 'bwz-backup-status-area'
  area.innerHTML = '<p class="bwz-backup-status">上次備份：今天（Google Drive）</p>'
    + '<button class="bwz-n-btn primary small bwz-backup-button" type="button" id="cb-btn">立即備份</button>'
    + '<label class="bwz-backup-check"><input type="checkbox" id="cb-auto" checked><span>每週自動備份（這台裝置）</span></label>'
  const del = document.createElement('label')
  del.className = 'bwz-n-check'
  del.innerHTML = '<input type="checkbox" id="cb-del"> 同時把 Google Drive「聖經知識庫筆記備份」資料夾裡的備份移到垃圾桶（30 天內可以救回）'
  sec.prepend(area, del)
})()`
const measure = `(() => {
  const r = (id) => document.getElementById(id).getBoundingClientRect()
  const btn = r('cb-btn'), auto = r('cb-auto'), del = r('cb-del'), label = document.getElementById('cb-del').parentElement.getBoundingClientRect()
  return { btnRight: Math.round(btn.right), autoLeft: Math.round(auto.left), autoTop: Math.round(auto.top), btnTop: Math.round(btn.top), btnBottom: Math.round(btn.bottom), delLeft: Math.round(del.left), labelLeft: Math.round(label.left), scroll: document.documentElement.scrollWidth <= innerWidth }
})()`

for (const [name, w, h, opts] of [["電腦", 1280, 900, {}], ["手機", 390, 844, { dpr: 2, mobile: true, touch: true }]]) {
  await setViewport(w, h, opts)
  await go("/my-notes")
  await sleep(1500)
  await ev(clickText(".bwz-shell-head button", "設定與備份"))
  await sleep(800)
  await ev(inject)
  await sleep(300)
  const m = await J(measure)
  const sameRow = m.autoTop >= m.btnTop && m.autoTop <= m.btnBottom
  check(`${name}：「每週自動備份」勾選框不蓋到「立即備份」按鈕`, !sameRow || m.autoLeft >= m.btnRight + 4, JSON.stringify(m))
  check(`${name}：刪除視窗的勾選框在文字框內、不跑到左邊外面`, m.delLeft >= m.labelLeft, JSON.stringify(m))
  check(`${name}：不左右捲`, m.scroll)
  await ev(`document.getElementById('cb-btn').scrollIntoView({ block: 'center' })`)
  await sleep(300)
  await shot(`checkbox-${w}`)
}
check("沒有 JavaScript 例外", errors.length === 0, errors.slice(0, 2).join(" | "))
await finish()
