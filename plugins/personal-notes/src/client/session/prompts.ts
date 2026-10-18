// session 需要問使用者、或告訴使用者的事。實作在 ui/prompts.ts（對話框與提示文字都在那裡），
// 測試時換成假的實作，所以登入、先同步再編輯、登出等流程可以在 Node 測試。

import type { TokenResult } from "../auth/gis"

/** 要通知使用者的事件（顯示文字由 UI 決定）。 */
export type Notice =
  | { type: "signed-in"; name: string }
  | { type: "signed-out"; cleared: boolean }
  | { type: "disconnected" }
  | { type: "adopted"; count: number }
  | { type: "switched-account" }
  | { type: "deleted-all" }
  | { type: "google-loading" }
  | { type: "google-load-failed"; message: string }
  | { type: "sign-in-failed"; reason: Exclude<TokenResult, { ok: true }>["reason"]; message: string }
  | { type: "account-read-failed"; message: string }
  | { type: "connect-before-delete" }
  | { type: "delete-failed"; message: string }

export interface Prompts {
  /**
   * 登入前說明權限。googleReady 完成前「繼續」不能按；使用者按「繼續」時要在點擊當下「同步」呼叫 start()
   * （它會開 Google 視窗，晚一步瀏覽器就會擋）。回傳使用者是否按了「繼續」。
   */
  explainSignIn(googleReady: Promise<void>, start: () => void): Promise<boolean>
  /** LINE 等內建瀏覽器無法登入 Google 時的引導（D-21）。 */
  inAppBrowser(browserName: string): Promise<void>
  /** 第一次登入時，是否把未登入時寫的紀錄加入帳號（D-05）。 */
  adoptAnonymous(count: number): Promise<boolean>
  /** 編輯前需要重新連線。按「連線」時同步呼叫 start()。 */
  reconnectBeforeEdit(start: () => void): Promise<"connect" | "offline" | "cancel">
  /** 無法同步時的離線提示（D-04）。 */
  offline(withRetry: boolean): Promise<"ok" | "retry" | "cancel">
  signOut(hasUnsyncedChanges: boolean): Promise<"keep" | "clear" | null>
  disconnect(): Promise<boolean>
  /** 刪除全部（UI 負責兩段確認）。 */
  deleteAll(): Promise<boolean>
  /** 雲端資料被清空後，是否用這台裝置的資料重新上傳。 */
  reupload(): Promise<boolean>
  notify(notice: Notice): void
}
