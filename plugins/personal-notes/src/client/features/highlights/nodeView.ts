import type { Session } from "../../session/session"
import { toast } from "../../ui/dom"
import type { View } from "../types"
import { HighlightsService } from "./highlights"

/** 按鈕位於掛載點外，換頁時仍由這個 View 負責清除。 */
export class NodeBookmark implements View {
  private readonly service: HighlightsService
  private readonly button: HTMLButtonElement
  private readonly unsubscribe: () => void
  private destroyed = false

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
  }

  private render(): void {
    const added = !!this.service.findNodeBookmark(this.slug)
    this.button.textContent = added ? "🔖 已加入書籤" : "🔖 加入書籤"
    this.button.setAttribute("aria-pressed", String(added))
  }

  private readonly onClick = async (): Promise<void> => {
    if (this.destroyed || this.button.disabled) return
    this.button.disabled = true
    try {
      if (!(await this.session.gateEdit()) || this.destroyed) return
      const result = await this.service.toggleNodeBookmark(this.slug, this.title)
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
