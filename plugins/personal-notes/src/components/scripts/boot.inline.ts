// 每頁都會載入的小型啟動腳本（< 1 KB）：頁面上有筆記掛載點時，才去載入完整的筆記 App。

interface NotesApp {
  mountAll(): Promise<void>
}

const w = window as Window & { __bwzNotesApp?: Promise<NotesApp>; __bwzNotesBooted?: boolean }

function boot(): void {
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
