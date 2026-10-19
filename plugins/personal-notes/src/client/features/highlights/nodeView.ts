import { healNodeRecords, movedHere, nodeRecords } from "../../repo/nodeHeal"
import type { Session } from "../../session/session"
import { toast } from "../../ui/dom"
import { loadLinkIndex } from "../../ui/linkIndex"
import type { View } from "../types"
import { HighlightsService } from "./highlights"

/**
 * 按鈕位於掛載點外，換頁時仍由這個 View 負責清除。
 * 條目搬移或改名後（D-46）：舊網址已失效、但找得回這一頁的條目紀錄，同步正常時直接改到這一頁；
 * 暫時不能寫入（例如需要重新連線）時先當作已加入書籤顯示，按下去會移除那一筆。
 */
export class NodeBookmark implements View {
  private readonly service: HighlightsService
  private readonly button: HTMLButtonElement
  private readonly unsubscribe: () => void
  private destroyed = false
  /** 舊網址的書籤（還沒改到這一頁時）。 */
  private relocatedId: string | null = null

  constructor(
    private readonly session: Session,
    host: HTMLElement,
    private readonly slug: string,
    private readonly title: string,
  ) {
    this.service = new HighlightsService(() => session.repo)
    const doc = host.ownerDocument
    this.button = doc.createElement("button")
    this.button.type = "button"
    this.button.className = "bwz-node-bookmark"
    this.button.addEventListener("click", this.onClick)
    const heading = doc.querySelector(".page-header h1.article-title")
    if (heading) heading.after(this.button)
    else doc.querySelector("article")?.prepend(this.button)
    this.unsubscribe = session.onChange(() => this.render())
    this.render()
    void this.relocate()
  }

  private async relocate(): Promise<void> {
    const others = nodeRecords(this.session.repo).filter((r) => r.winner.anchor.node?.slug !== this.slug)
    if (others.length === 0) return
    const index = await loadLinkIndex()
    if (!index || this.destroyed) return
    try {
      const kind = this.session.status.kind
      if (kind === "local-only" || kind === "ready") await healNodeRecords(this.session.repo, index.pages, { slug: this.slug, title: this.title })
    } catch {
      // 修不成也沒關係：下面照樣認得舊書籤
    }
    if (this.destroyed) return
    const ids = new Set(movedHere(nodeRecords(this.session.repo), index.pages, this.slug))
    this.relocatedId = this.service.allBookmarks().find((r) => ids.has(r.id))?.id ?? null
    this.render()
  }

  private render(): void {
    if (this.relocatedId && !this.service.allBookmarks().some((r) => r.id === this.relocatedId)) this.relocatedId = null
    const added = !!this.service.findNodeBookmark(this.slug) || !!this.relocatedId
    this.button.textContent = added ? "🔖 已加入書籤" : "🔖 加入書籤"
    this.button.setAttribute("aria-pressed", String(added))
  }

  private readonly onClick = async (): Promise<void> => {
    if (this.destroyed || this.button.disabled) return
    this.button.disabled = true
    try {
      if (!(await this.session.gateEdit()) || this.destroyed) return
      let result: "added" | "removed"
      if (!this.service.findNodeBookmark(this.slug) && this.relocatedId) {
        await this.service.remove(this.relocatedId)
        this.relocatedId = null
        result = "removed"
      } else result = await this.service.toggleNodeBookmark(this.slug, this.title)
      if (!this.destroyed) {
        this.render()
        toast(result === "added" ? "已加入書籤" : "已移除書籤")
      }
    } catch {
      if (!this.destroyed) toast("書籤操作失敗，請再試一次")
    } finally {
      this.button.disabled = false
    }
  }

  destroy(): void {
    this.destroyed = true
    this.unsubscribe()
    this.button.removeEventListener("click", this.onClick)
    this.button.remove()
  }
}
