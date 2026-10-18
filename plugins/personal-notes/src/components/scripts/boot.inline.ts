// 每頁都會載入的小型啟動腳本（< 1 KB）：頁面上有筆記掛載點時，才去載入完整的筆記 App。

interface NotesApp {
  mountAll(): Promise<void>
}

const w = window as Window & { __bwzNotesApp?: Promise<NotesApp>; __bwzNotesBooted?: boolean }

const ENTRY_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/>' +
  '<path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>'

/** 左上角工具列的「我的筆記」入口：圖示（取代原本的閱讀模式按鈕，放在明暗模式按鈕後面）＋圖示列下方的文字按鈕。 */
function mountEntry(): void {
  const toolbar = document.querySelector(".left.sidebar .flex-component")
  if (!toolbar) return
  const base = document.body.dataset.basepath ?? ""
  const onPage = location.pathname.replace(/\/$/, "").endsWith("/my-notes")
  let text = toolbar.parentElement?.querySelector<HTMLAnchorElement>(":scope > a.bwz-notes-entry-text")
  if (!text) {
    text = document.createElement("a")
    text.className = "bwz-notes-entry-text"
    text.href = `${base}/my-notes`
    text.innerHTML = '<span aria-hidden="true">📝</span> 我的筆記'
    toolbar.after(text)
  }
  if (onPage) text.setAttribute("aria-current", "page")
  else text.removeAttribute("aria-current")
  let link = toolbar.querySelector<HTMLAnchorElement>("a.bwz-notes-entry")
  if (!link) {
    link = document.createElement("a")
    link.className = "bwz-notes-entry"
    link.href = `${base}/my-notes`
    link.title = "我的筆記"
    link.setAttribute("aria-label", "我的筆記")
    link.innerHTML = ENTRY_ICON
    const wrapper = document.createElement("div")
    wrapper.style.cssText = "flex-grow: 0; flex-shrink: 1; flex-basis: auto; order: 0; align-self: center; justify-self: center;"
    wrapper.append(link)
    const dark = Array.from(toolbar.children).find((c) => c.querySelector(".darkmode"))
    if (dark) dark.after(wrapper)
    else toolbar.append(wrapper)
  }
  if (onPage) link.setAttribute("aria-current", "page")
  else link.removeAttribute("aria-current")
}

function boot(): void {
  mountEntry()
  const el = document.querySelector<HTMLElement>("[data-bwz-notes]")
  if (!el) {
    // 換到沒有筆記的頁面：App 已載入過就讓它清掉舊畫面（Codex 畫面審查 #6）
    w.__bwzNotesApp?.then((app) => app.mountAll()).catch(() => undefined)
    return
  }
  if (!w.__bwzNotesApp) {
    const base = document.body.dataset.basepath ?? ""
    const v = el.dataset.bwzVersion ?? "0"
    const url = `${base}/static/personal-notes/app.js?v=${encodeURIComponent(v)}`
    w.__bwzNotesApp = import(url) as Promise<NotesApp>
  }
  w.__bwzNotesApp
    .then((app: NotesApp) => app.mountAll())
    .catch((e: unknown) => {
      console.error("[personal-notes] 載入失敗", e)
      el.textContent = "筆記功能載入失敗，請重新整理頁面。"
    })
}

if (!w.__bwzNotesBooted) {
  w.__bwzNotesBooted = true
  document.addEventListener("nav", boot)
}
