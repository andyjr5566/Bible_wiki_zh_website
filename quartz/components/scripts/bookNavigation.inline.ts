// bookNavigation.inline.ts
// 聖經研讀知識庫 - 書卷目錄直達「全書目錄及綱要」導航引擎

function isBookFolder(str: string): boolean {
  if (!str) return false
  const decoded = decodeURIComponent(str)
  // 書卷資料夾特徵：以兩位數字開頭（如 01 創世記、02 出埃及記 等）
  // 排除具體章節（第XX章）或已經是全書目錄及綱要
  if (decoded.includes("全書目錄及綱要") || /第[0-9]+章/.test(decoded)) {
    return false
  }
  return /(?:^|\/)[0-9]{2}[\s\-][^/]+(?:\/index(?:\.html)?)?\/?$/.test(decoded)
}

// 1. 預先檢查（在 <head> 階段立即執行，防止畫面渲染白頁或預設列表）
function instantBookRedirect(): boolean {
  try {
    const path = window.location.pathname
    if (isBookFolder(path)) {
      // 避免白屏閃爍預設列表
      if (document.documentElement) {
        document.documentElement.style.opacity = "0"
      }
      const cleanBase = path.replace(/\/index(?:\.html)?\/?$/, "").replace(/\/+$/, "")
      const target =
        cleanBase +
        "/%E5%85%A8%E6%9B%B8%E7%9B%AE%E9%8C%84%E5%8F%8A%E7%B6%B1%E8%A6%81" +
        window.location.search +
        window.location.hash
      window.location.replace(target)
      return true
    }
  } catch {
    // 靜默 fallback
  }
  return false
}

// 立即在加載時執行一次
instantBookRedirect()

// 2. 側邊欄 Explorer 資料夾按鈕連結重寫
function updateExplorerLinks() {
  const containers = document.querySelectorAll<HTMLElement>(".folder-container")
  containers.forEach((container) => {
    const folderpath = container.dataset.folderpath || ""
    const decodedPath = decodeURIComponent(folderpath)

    // 比對是否為書卷目錄（如 01-創世記/index 或 01 創世記/index）
    if (!/(?:^|\/)[0-9]{2}[\s\-]/.test(decodedPath)) return

    const link = container.querySelector<HTMLAnchorElement>("a.folder-button")
    if (link) {
      const currentHref = link.getAttribute("href") || ""
      if (!currentHref.includes("全書目錄及綱要")) {
        const cleanHref = currentHref.replace(/\/index(?:\.html)?\/?$/, "").replace(/\/+$/, "")
        link.setAttribute("href", `${cleanHref}/全書目錄及綱要`)
      }
    }
  })
}

// 3. 麵包屑導航連結重寫
function updateBreadcrumbsLinks() {
  const crumbs = document.querySelectorAll<HTMLAnchorElement>(".breadcrumb-element a")
  crumbs.forEach((a) => {
    const text = a.textContent?.trim() || ""
    if (/^[0-9]{2}[\s\-]/.test(text)) {
      const href = a.getAttribute("href") || ""
      if (!href.includes("全書目錄及綱要")) {
        const cleanHref = href.replace(/\/index(?:\.html)?\/?$/, "").replace(/\/+$/, "")
        a.setAttribute("href", `${cleanHref}/全書目錄及綱要`)
      }
    }
  })
}

// 4. 點擊捕獲（Capture Phase 雙重保障：點擊瞬間確保 href 已經是全書目錄及綱要）
document.addEventListener(
  "click",
  (e) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    // (1) 側邊欄書卷按鈕
    const folderBtn = target.closest<HTMLAnchorElement | HTMLButtonElement>(".folder-button")
    if (folderBtn) {
      const container = folderBtn.closest<HTMLElement>(".folder-container")
      if (container) {
        const folderpath = decodeURIComponent(container.dataset.folderpath || "")
        if (/(?:^|\/)[0-9]{2}[\s\-]/.test(folderpath)) {
          const href = folderBtn.getAttribute("href") || ""
          if (!href.includes("全書目錄及綱要")) {
            const cleanHref = href.replace(/\/index(?:\.html)?\/?$/, "").replace(/\/+$/, "")
            const targetUrl = `${cleanHref}/全書目錄及綱要`
            folderBtn.setAttribute("href", targetUrl)
            if (folderBtn.tagName.toLowerCase() === "button") {
              e.preventDefault()
              e.stopPropagation()
              window.location.assign(targetUrl)
            }
          }
        }
      }
    }

    // (2) 麵包屑書卷連結
    const crumb = target.closest<HTMLAnchorElement>(".breadcrumb-element a")
    if (crumb) {
      const text = crumb.textContent?.trim() || ""
      if (/^[0-9]{2}[\s\-]/.test(text)) {
        const href = crumb.getAttribute("href") || ""
        if (!href.includes("全書目錄及綱要")) {
          const cleanHref = href.replace(/\/index(?:\.html)?\/?$/, "").replace(/\/+$/, "")
          crumb.setAttribute("href", `${cleanHref}/全書目錄及綱要`)
        }
      }
    }
  },
  true,
)

// 5. 監聽 Explorer DOM 動態渲染
let explorerObserver: MutationObserver | null = null

function setupExplorerObserver() {
  const explorer = document.querySelector(".explorer")
  if (!explorer) return

  updateExplorerLinks()

  if (!explorerObserver) {
    explorerObserver = new MutationObserver(() => {
      updateExplorerLinks()
    })
    explorerObserver.observe(explorer, { childList: true, subtree: true })
  }
}

// 6. SPA 路由切換事件處理
document.addEventListener("nav", (e: any) => {
  // 若當前頁面仍落入書卷資料夾 index，立即無縫切換
  const slug = document.body?.dataset?.slug || e?.detail?.url || ""
  const decodedSlug = decodeURIComponent(slug)
  const match = decodedSlug.match(/^([0-9]{2}[\s\-][^/]+?)\/index$/)
  if (match) {
    const bookFolder = match[1]
    const targetPath = `${bookFolder}/全書目錄及綱要`
    const targetUrl = new URL(encodeURI(targetPath), window.location.href)
    if (typeof (window as any).spaNavigate === "function") {
      ;(window as any).spaNavigate(targetUrl)
    } else {
      window.location.replace(targetUrl.href)
    }
    return
  }

  setupExplorerObserver()
  updateBreadcrumbsLinks()
})

// DOM 加載完成後初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupExplorerObserver()
    updateBreadcrumbsLinks()
  })
} else {
  setupExplorerObserver()
  updateBreadcrumbsLinks()
}
