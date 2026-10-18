import { dialog, h } from "../../ui/dom"
import type { View } from "../types"
import { getStickyMode, onStickyModeChange, setStickyMode, type StickyMode } from "./settings"

const miniPaper = '<svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M3 2h9l5 4v12H3z"/><path d="M12 2v4h5"/><path d="M6 10h8M6 13h8M6 16h5"/></svg>'
const miniIcon = '<svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M4 3h8l4 4v11H4z"/><path d="M12 3v4h4"/></svg>'

export class StickySettings implements View {
  private closeDialog?: () => void
  private unsubscribe?: () => void

  constructor(private readonly host: HTMLElement) {
    host.replaceChildren(h("div", {
      class: "bwz-sticky-settings bwz-v-ui",
    }, h("button", {
      class: "bwz-settings-btn bwz-n-btn bwz-v-ui",
      text: "⚙ 設定",
      attrs: { type: "button" },
      on: { click: () => void this.open() },
    })))
  }

  private async open(): Promise<void> {
    if (this.closeDialog) return
    const inputs: HTMLInputElement[] = []
    const body = h("div", {
      class: "bwz-sticky-options bwz-v-ui",
    }, h("p", {
      class: "bwz-v-ui",
      text: "便條紙平常要：",
    }))
    for (const [value, label, illustration] of [
      ["open", "展開，直接貼在經文下方", miniPaper],
      ["icon", "收起成小紙條，點了才看", miniIcon],
    ] as const) {
      const input = h("input", {
        class: "bwz-v-ui",
        attrs: { type: "radio", name: "bwz-sticky-mode", value },
        on: { change: () => setStickyMode(value) },
      })
      inputs.push(input)
      // 固定的示意圖 SVG（本檔常數，不是使用者內容）
      const svg = h("span", { class: "bwz-sticky-option-icon bwz-v-ui" })
      svg.append(document.importNode(new DOMParser().parseFromString(illustration, "text/html").body.firstElementChild!, true))
      body.append(h("label", {
        class: "bwz-sticky-option bwz-v-ui",
      }, input, svg, h("span", { class: "bwz-v-ui", text: label })))
    }
    const update = (mode: StickyMode) => inputs.forEach(input => {
      input.checked = input.value === mode
    })
    update(getStickyMode())
    const off = onStickyModeChange(update)
    this.unsubscribe = off
    this.closeDialog = () => body.closest(".bwz-n-dialog")
      ?.querySelector<HTMLButtonElement>(".bwz-n-dialog-actions button")
      ?.click()
    try {
      await dialog({
        title: "設定",
        message: body,
        buttons: [{ id: "done", label: "完成" }],
      })
    } finally {
      off()
      this.unsubscribe = undefined
      this.closeDialog = undefined
    }
  }

  destroy(): void {
    this.closeDialog?.()
    this.unsubscribe?.()
    this.host.replaceChildren()
  }
}
