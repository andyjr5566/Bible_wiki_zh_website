// 首頁入口與閱讀位置：這支腳本每個頁面都會載入（元件在非首頁只是不畫東西），
// 所以「記錄章節的閱讀位置」和「首頁的繼續閱讀卡」共用同一份儲存層，邏輯只有一份。
import { expandCatalog } from "../../lib/catalogData"
import { applyReadingOrder } from "../../lib/readingOrder"
import { loadReading } from "../../lib/readingStorage"
import { takePending } from "../../lib/pendingResume"
import { startRecording } from "../../lib/readingRecorder"
import { renderResume } from "../../lib/resumeCard"
import { buildResumeView } from "../../lib/resumeView"
import { restoreScroll } from "../../lib/scrollRestore"

function currentSlug(): string {
  return document.body.dataset.slug ?? ""
}

function bindSearch(hub: HTMLElement): void {
  const button = hub.querySelector<HTMLElement>("[data-hub-search]")
  if (!button || button.dataset.bound) return
  button.dataset.bound = "1"
  // 不重寫搜尋：直接按網站現有的搜尋鈕（手機上它在 ☰ 抽屜裡，程式點擊照樣有效）
  button.addEventListener("click", () => {
    document.querySelector<HTMLElement>(".search-button")?.click()
  })
  const hint = hub.querySelector<HTMLElement>("[data-hub-kbd]")
  if (hint && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) hint.textContent = "⌘ K"
}

function renderHub(): void {
  const hub = document.querySelector<HTMLElement>(".bwz-hub")
  if (!hub) return
  bindSearch(hub)
  const container = hub.querySelector<HTMLElement>("[data-hub-resume]")
  if (!container) return
  const view = buildResumeView(loadReading(), expandCatalog(hub.dataset.catalog), Date.now())
  renderResume(container, view)
}

function onNav(): void {
  const slug = currentSlug()
  // 每次換頁都重算順序：剛讀完第一章再回首頁時，入口要已經排在最上面
  applyReadingOrder()
  renderHub()

  const pending = takePending(slug, Date.now())
  const restore = pending ? restoreScroll(pending.ratio) : null
  startRecording(slug, { suspended: () => restore?.active() ?? false })
}

document.addEventListener("nav", onNav)
