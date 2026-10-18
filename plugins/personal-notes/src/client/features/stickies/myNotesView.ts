import { dialog, h } from "../../ui/dom"
import type { View } from "../types"
import { getStickyMode, onStickyModeChange, setStickyMode, type StickyMode } from "./settings"

export class StickySettings implements View {
  private closeDialog?: () => void
  private unsubscribe?: () => void
  constructor(private readonly host: HTMLElement) {
    host.replaceChildren(h("div", { class: "bwz-sticky-settings bwz-v-ui" }, h("button", {
      class: "bwz-settings-btn bwz-n-btn bwz-v-ui", text: "⚙ 設定", attrs: { type: "button" },
      on: { click: () => void this.open() },
    })))
  }
  private async open(): Promise<void> {
    if (this.closeDialog) return
    const inputs: HTMLInputElement[] = []
    const body = h("div", { class: "bwz-v-ui" }, h("p", { class: "bwz-v-ui", text: "便條紙平常要：" }))
    for (const [value, label] of [["open", "展開，直接貼在經文下方"], ["icon", "收起成 🗒 小圖示，點了才看"]] as const) {
      const input = h("input", { class: "bwz-v-ui", attrs: { type: "radio", name: "bwz-sticky-mode", value }, on: { change: () => setStickyMode(value) } })
      inputs.push(input)
      body.append(h("label", { class: "bwz-sticky-option bwz-v-ui" }, input, label))
    }
    const update = (mode: StickyMode) => inputs.forEach(input => { input.checked = input.value === mode })
    update(getStickyMode())
    const off = onStickyModeChange(update)
    this.unsubscribe = off
    this.closeDialog = () => body.closest(".bwz-n-dialog")?.querySelector<HTMLButtonElement>(".bwz-n-dialog-actions button")?.click()
    try { await dialog({ title: "設定", message: body, buttons: [{ id: "done", label: "完成" }] }) } finally { off(); this.unsubscribe = undefined; this.closeDialog = undefined }
  }
  destroy(): void { this.closeDialog?.(); this.unsubscribe?.(); this.host.replaceChildren() }
}
