// explorerTools.inline.ts
// 聖經研讀知識庫 - 左側「探索」目錄的「全部收合」按鈕
// 有任何資料夾展開時，目錄最上方出現按鈕；按下後全部收起，並照 explorer 外掛的格式寫回 localStorage("fileTree")，
// 換頁或重新整理後仍維持收起。

type FolderState = { path: string; collapsed: boolean }

function openFolders(explorer: Element): HTMLElement[] {
  return Array.from(explorer.querySelectorAll<HTMLElement>(".folder-outer.open"))
}

function collapseAll(explorer: Element) {
  let saved: FolderState[] = []
  try {
    saved = JSON.parse(localStorage.getItem("fileTree") || "[]")
  } catch {}
  for (const outer of openFolders(explorer)) {
    outer.classList.remove("open")
    const container = outer.previousElementSibling as HTMLElement | null
    // 資料夾的展開鈕（B5-4）要跟著改成「收合」狀態，螢幕閱讀器才不會讀到舊狀態
    const toggle = container?.querySelector(".folder-button-icon")
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false")
      toggle.setAttribute("aria-label", `展開「${container?.dataset.foldername ?? ""}」`)
    }
    const path = container?.dataset.folderpath
    if (!path) continue
    const item = saved.find((s) => s.path === path)
    if (item) item.collapsed = true
    else saved.push({ path, collapsed: true })
  }
  try {
    localStorage.setItem("fileTree", JSON.stringify(saved))
  } catch {}
}

function refresh(explorer: Element) {
  const btn = explorer.querySelector<HTMLButtonElement>(".explorer-collapse-all")
  if (btn) btn.hidden = openFolders(explorer).length === 0
}

const observed = new WeakSet<Element>()

function mountCollapseAll() {
  for (const explorer of document.querySelectorAll(".explorer")) {
    const content = explorer.querySelector(".explorer-content")
    if (!content) continue
    let btn = content.querySelector<HTMLButtonElement>(":scope > .explorer-collapse-all")
    if (!btn) {
      btn = document.createElement("button")
      btn.type = "button"
      btn.className = "explorer-collapse-all"
      btn.title = "把展開的資料夾全部收起來"
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg><span>全部收合</span>'
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        collapseAll(explorer)
        refresh(explorer)
      })
      content.prepend(btn)
    }
    // 資料夾清單由 explorer 外掛非同步畫出、開關也由它處理：清單有變化就重新判斷要不要顯示按鈕
    if (!observed.has(content)) {
      observed.add(content)
      new MutationObserver(() => refresh(explorer)).observe(content, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"],
      })
    }
    refresh(explorer)
  }
}

document.addEventListener("nav", () => setTimeout(mountCollapseAll, 0))
document.addEventListener("render", () => setTimeout(mountCollapseAll, 0))
