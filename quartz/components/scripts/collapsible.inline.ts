// collapsible.inline.ts
// 聖經研讀知識庫 - 素雅段落折疊與雙層手風琴模組

interface CollapseRule {
  title: string
  subheadings: boolean
}

// 內建預設規則（雙重保障，防網絡請求異常）
const defaultRules: CollapseRule[] = [
  { title: "本章知識節點", subheadings: false },
  { title: "來源依據", subheadings: false },
  { title: "按書卷累積", subheadings: true },
]

let activeRules: CollapseRule[] = [...defaultRules]

// 載入自定義規則（從 /static/collapse-rules.json）
async function loadCollapseRules() {
  try {
    const res = await fetch("/static/collapse-rules.json")
    if (res.ok) {
      const data = await res.json()
      if (data && Array.isArray(data.sections)) {
        activeRules = data.sections
      }
    }
  } catch {
    // 靜默 fallback 到 defaultRules
  }
}

function processCollapsibleSections() {
  const article = document.querySelector("article")
  if (!article) return

  // 取得頁面中所有的 H2 標題
  const h2Elements = Array.from(article.querySelectorAll("h2"))

  for (const h2 of h2Elements) {
    // 若已被包裝過則略過
    if (h2.closest("details.collapsible-section")) continue

    const headingText = h2.textContent?.trim() || ""

    // 比對是否有命中規則（精確或包含）
    const matchedRule = activeRules.find(
      (r) => headingText === r.title || headingText.includes(r.title),
    )
    if (!matchedRule) continue

    // 收集該 H2 直到下一個同級 H2 或水平線（HR）之前的所有元素
    const siblingsToWrap: Element[] = []
    let nextNode = h2.nextElementSibling

    while (nextNode && nextNode.tagName.toLowerCase() !== "h2") {
      // 若遇到分界 hr 且後面有其他大標題，可以在此中斷
      if (nextNode.tagName.toLowerCase() === "hr") {
        break
      }
      siblingsToWrap.push(nextNode)
      nextNode = nextNode.nextElementSibling
    }

    if (siblingsToWrap.length === 0) continue

    // 建立外層 <details>
    const details = document.createElement("details")
    details.className = "collapsible-section"
    if (matchedRule.subheadings) {
      details.classList.add("collapsible-nested")
    }

    // 建立 <summary>
    const summary = document.createElement("summary")
    summary.className = "collapsible-summary"

    const summaryTitle = document.createElement("span")
    summaryTitle.className = "collapsible-title"
    summaryTitle.textContent = headingText
    summary.appendChild(summaryTitle)

    // 數量徽章
    const badge = document.createElement("span")
    badge.className = "collapsible-badge"

    if (matchedRule.subheadings) {
      const h3Count = siblingsToWrap.filter((el) => el.tagName.toLowerCase() === "h3").length
      if (h3Count > 0) {
        badge.textContent = `${h3Count} 卷書`
      }
    } else {
      const listItems = siblingsToWrap.reduce(
        (acc, el) => acc + el.querySelectorAll("li").length,
        0,
      )
      if (listItems > 0) {
        badge.textContent = `${listItems} 條目`
      }
    }

    if (badge.textContent) {
      summary.appendChild(badge)
    }

    details.appendChild(summary)

    // 建立內容包裹區
    const contentDiv = document.createElement("div")
    contentDiv.className = "collapsible-content"

    // 如果指定了 subheadings（雙層嵌套：旗下的各卷書 H3 也是獨立收合）
    if (matchedRule.subheadings) {
      let currentSubDetails: HTMLDetailsElement | null = null
      let currentSubContent: HTMLDivElement | null = null

      for (const node of siblingsToWrap) {
        if (node.tagName.toLowerCase() === "h3") {
          // 建立子書卷 details
          currentSubDetails = document.createElement("details")
          currentSubDetails.className = "collapsible-subheading"

          const subSummary = document.createElement("summary")
          subSummary.className = "collapsible-sub-summary"

          const subTitle = document.createElement("span")
          subTitle.className = "collapsible-sub-title"
          subTitle.textContent = node.textContent?.trim() || ""
          subSummary.appendChild(subTitle)

          currentSubDetails.appendChild(subSummary)

          currentSubContent = document.createElement("div")
          currentSubContent.className = "collapsible-sub-content"
          currentSubDetails.appendChild(currentSubContent)

          contentDiv.appendChild(currentSubDetails)
          // 乾淨移除原 H3 節點，避免殘留在外部
          node.remove()
        } else if (currentSubContent) {
          currentSubContent.appendChild(node)
        } else {
          contentDiv.appendChild(node)
        }
      }
    } else {
      // 一般單層收合
      for (const node of siblingsToWrap) {
        contentDiv.appendChild(node)
      }
    }

    details.appendChild(contentDiv)

    // 替換原 DOM
    h2.parentNode?.insertBefore(details, h2)
    h2.remove()
  }
}

// 註冊 SPA 頁面切換與首次載入事件
document.addEventListener("nav", async () => {
  await loadCollapseRules()
  processCollapsibleSections()
})

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    loadCollapseRules().then(processCollapsibleSections)
  })
} else {
  loadCollapseRules().then(processCollapsibleSections)
}
