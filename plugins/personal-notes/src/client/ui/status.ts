// 同步狀態列（章節面板與我的筆記頁共用）。

import type { Controller } from "../controller"
import { formatTime, h } from "./dom"

export function statusText(c: Controller): { text: string; tone: "ok" | "busy" | "warn" | "bad" | "local" } {
  const s = c.status
  switch (s.kind) {
    case "local-only":
      return { text: c.syncAvailable ? "筆記目前只存在這台裝置" : "筆記存在這台裝置", tone: "local" }
    case "needs-reconnect":
      return { text: "尚未連線，點「繼續同步」", tone: "warn" }
    case "idle":
    case "syncing":
      return { text: "同步中…", tone: "busy" }
    case "ready":
      return { text: `已同步 ${formatTime(s.lastSyncAt)}`, tone: "ok" }
    case "offline":
      return { text: "離線中，恢復連線後自動同步", tone: "warn" }
    case "error":
      return { text: s.message, tone: "bad" }
  }
}

/** 狀態列＋主要操作按鈕（登入／繼續同步／立即同步）。 */
export function statusBar(c: Controller, opts: { showAccount?: boolean } = {}): HTMLElement {
  const { text, tone } = statusText(c)
  const bar = h("div", { class: "bwz-n-status" }, h("span", { class: `bwz-n-dot ${tone}`, attrs: { "aria-hidden": "true" } }), h("span", { class: "bwz-n-status-text", text }))
  const actions = h("span", { class: "bwz-n-status-actions" })
  const s = c.status
  if (c.syncAvailable) {
    if (!c.account) {
      actions.append(
        h("button", {
          class: "bwz-n-btn primary small",
          text: c.inAppBrowser ? "用 Safari／Chrome 開啟以同步" : "用 Google 同步",
          attrs: { type: "button" },
          on: { click: () => c.signInFromClick() },
        }),
      )
    } else if (s.kind === "needs-reconnect") {
      actions.append(h("button", { class: "bwz-n-btn primary small", text: "繼續同步", attrs: { type: "button" }, on: { click: () => c.signInFromClick() } }))
    } else if (s.kind === "error" && s.error === "cloud-wiped") {
      actions.append(h("button", { class: "bwz-n-btn primary small", text: "處理", attrs: { type: "button" }, on: { click: () => void c.confirmReupload() } }))
    } else if (s.kind !== "syncing") {
      actions.append(h("button", { class: "bwz-n-btn small", text: "立即同步", attrs: { type: "button" }, on: { click: () => c.syncNow() } }))
    }
  }
  bar.append(actions)
  if (opts.showAccount && c.account) {
    bar.append(h("span", { class: "bwz-n-account", text: c.account.displayName || c.account.email }))
  }
  return bar
}
