// 同步狀態列（各功能的畫面共用）：狀態文字、登入／繼續同步／立即同步按鈕、目前帳號。

import type { Session } from "../session/session"
import type { SyncErrorKind } from "../sync/syncer"
import { formatTime, h } from "./dom"

const ERROR_TEXT: Record<SyncErrorKind, string> = {
  "cloud-wiped": "雲端的筆記資料似乎被刪除了",
  "storage-full": "你的 Google 雲端硬碟空間已滿，筆記暫時只存在這台裝置",
  admin: "此帳號的管理員不允許這個網站存取雲端硬碟，筆記只會存在這台裝置",
  "newer-schema": "雲端的筆記是用較新版本的網站寫的，請重新整理網頁",
  "circuit-open": "同步連續失敗，5 分鐘後再自動重試",
  other: "同步發生錯誤",
}

export function statusText(s: Session): { text: string; tone: "ok" | "busy" | "warn" | "bad" | "local" } {
  const st = s.status
  switch (st.kind) {
    case "local-only":
      return { text: s.syncAvailable ? "筆記目前只存在這台裝置" : "筆記存在這台裝置", tone: "local" }
    case "needs-reconnect":
      // 「尚未連線」聽起來像斷網或沒存到，改成講清楚（Antigravity 審查 L-01）
      return { text: "筆記已存在這台裝置，點「繼續同步」連上雲端", tone: "warn" }
    case "idle":
    case "syncing":
      return { text: "同步中…", tone: "busy" }
    case "ready":
      return { text: `已同步 ${formatTime(st.lastSyncAt)}`, tone: "ok" }
    case "offline":
      return { text: "離線中，恢復連線後自動同步", tone: "warn" }
    case "error":
      return { text: st.detail && st.error === "other" ? `${ERROR_TEXT.other}：${st.detail}` : ERROR_TEXT[st.error], tone: "bad" }
  }
}

/** 狀態列＋主要操作按鈕（登入／繼續同步／立即同步）；已登入時在右側顯示帳號。 */
export function statusBar(s: Session): HTMLElement {
  const { text, tone } = statusText(s)
  const bar = h("div", { class: "bwz-n-status" }, h("span", { class: `bwz-n-dot ${tone}`, attrs: { "aria-hidden": "true" } }), h("span", { class: "bwz-n-status-text", text }))
  const actions = h("span", { class: "bwz-n-status-actions" })
  const st = s.status
  if (s.syncAvailable) {
    if (!s.account) {
      actions.append(
        h("button", {
          class: "bwz-n-btn primary small",
          text: s.inAppBrowser ? "用 Safari／Chrome 開啟以同步" : "用 Google 同步",
          attrs: { type: "button" },
          on: { click: () => void s.signInFromClick() },
        }),
      )
    } else if (st.kind === "needs-reconnect") {
      actions.append(h("button", { class: "bwz-n-btn primary small", text: "繼續同步", attrs: { type: "button" }, on: { click: () => void s.signInFromClick() } }))
    } else if (st.kind === "error" && st.error === "cloud-wiped") {
      actions.append(h("button", { class: "bwz-n-btn primary small", text: "處理", attrs: { type: "button" }, on: { click: () => void s.confirmReupload() } }))
    } else if (st.kind !== "syncing") {
      actions.append(h("button", { class: "bwz-n-btn small", text: "立即同步", attrs: { type: "button" }, on: { click: () => s.syncNow() } }))
    }
  }
  bar.append(actions)
  if (s.account) {
    bar.append(h("span", { class: "bwz-n-account", text: s.account.displayName || s.account.email, attrs: { title: `已登入 ${s.account.email}` } }))
  }
  return bar
}
