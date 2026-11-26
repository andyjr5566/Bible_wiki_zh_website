// 把 buildResumeView 的結果畫成「繼續閱讀」大卡與小連結（薄 DOM 層，只用 textContent，不拼 HTML）。
import type { ResumeView } from "./resumeView"
import { setPending } from "./pendingResume"

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** 站在子路徑（GitHub Pages 的 /Bible_wiki_zh_website/）時要加上 basepath，連結才不會 404。 */
function hrefFor(slug: string): string {
  const base = document.body.dataset.basepath ?? ""
  return `${base}/${slug.split("/").map(encodeURIComponent).join("/")}`
}

export function renderResume(container: HTMLElement, view: ResumeView | null): void {
  container.replaceChildren()
  container.dataset.state = view ? "ready" : "empty"
  if (!view) return

  const { main, recent } = view

  const card = el("div", "bwz-resume")
  card.append(el("span", "bwz-resume-kicker", "繼續閱讀"))
  card.append(el("span", "bwz-resume-title", main.title))
  card.append(el("span", "bwz-resume-meta", main.meta))

  const go = el("a", "bwz-resume-go", "繼續 ›")
  go.href = hrefFor(main.slug)
  go.setAttribute("aria-label", main.ariaLabel)
  // 只有按「繼續」才還原捲動位置；一般點進章節永遠從頭開始
  if (main.restoreScroll) go.addEventListener("click", () => setPending(main.slug, main.ratio, Date.now()))
  card.append(go)
  container.append(card)

  if (recent.length === 0) return
  const more = el("p", "bwz-resume-more", "最近也讀了：")
  for (const item of recent) {
    const link = el("a", "bwz-resume-link", item.label)
    link.href = hrefFor(item.slug)
    more.append(link)
  }
  container.append(more)
}
