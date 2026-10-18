// session/prompts.ts 的瀏覽器實作：帳號與同步相關的對話框、提示文字都集中在這裡。

import type { Notice, Prompts } from "../session/prompts"
import { dialog, h, toast } from "./dom"

function noticeText(n: Notice): string {
  switch (n.type) {
    case "signed-in":
      return `已登入：${n.name}`
    case "signed-out":
      return n.cleared ? "已登出，並清除這台裝置上的筆記" : "已登出"
    case "disconnected":
      return "已中斷連線"
    case "adopted":
      return `已加入 ${n.count} 則筆記`
    case "switched-account":
      return "已切換到另一個帳號的筆記，請再按一次"
    case "deleted-all":
      return "已刪除全部筆記"
    case "google-loading":
      return "Google 登入元件載入中，請稍候再按一次"
    case "google-load-failed":
      return n.message || "無法載入 Google 登入元件，請檢查網路"
    case "sign-in-failed":
      return n.message || "登入失敗"
    case "account-read-failed":
      return n.message || "登入後讀取帳號資料失敗"
    case "connect-before-delete":
      return "請先「連線 Google 同步」，才能刪除雲端上的筆記"
    case "delete-failed":
      return n.message || "刪除失敗，請稍後再試"
  }
}

export const browserPrompts: Prompts = {
  async explainSignIn(googleReady, start) {
    const choice = await dialog({
      title: "用 Google 帳號同步筆記",
      message: h(
        "div",
        null,
        h("p", { text: "登入後，你的筆記會存到你自己的 Google 雲端硬碟裡一個「隱藏的筆記資料夾」，在手機、平板、電腦都能看到同一份筆記。" }),
        h("p", { text: "本站只能存取自己建立的這個專屬空間，看不到你雲端硬碟裡的任何其他檔案。筆記不會經過本站的伺服器。" }),
      ),
      buttons: [
        { id: "go", label: "繼續", kind: "primary", run: start, waitFor: googleReady, waitingLabel: "Google 元件載入中…", failedLabel: "無法連到 Google，請檢查網路" },
        { id: "cancel", label: "取消" },
      ],
    })
    return choice === "go"
  },

  async inAppBrowser(browserName) {
    const url = new URL(location.href)
    url.searchParams.set("openExternalBrowser", "1")
    const choice = await dialog({
      title: "請用 Safari 或 Chrome 開啟",
      message: `${browserName} 內建的瀏覽器無法登入 Google。請改用 Safari 或 Chrome 開啟本頁，就能同步筆記。在這裡寫的筆記仍會先存在這個瀏覽器裡。`,
      buttons: [
        { id: "open", label: "用外部瀏覽器開啟", kind: "primary", run: () => location.assign(url.toString()) },
        { id: "copy", label: "複製網址" },
        { id: "close", label: "關閉" },
      ],
    })
    if (choice === "copy") {
      try {
        await navigator.clipboard.writeText(location.href)
        toast("已複製網址")
      } catch {
        toast(location.href)
      }
    }
  },

  async adoptAnonymous(count) {
    const choice = await dialog({
      title: "加入未登入時寫的筆記？",
      message: `這台裝置上有 ${count} 則未登入時寫的筆記。要把它們加入這個 Google 帳號、一起同步嗎？（如果這是公用電腦，請選「先不要」）`,
      buttons: [
        { id: "adopt", label: "加入", kind: "primary" },
        { id: "skip", label: "先不要" },
      ],
      dismissible: false,
    })
    return choice === "adopt"
  },

  async reconnectBeforeEdit(start) {
    const choice = await dialog({
      title: "要先連線 Google 同步嗎？",
      message: "為了確保你看到的是最新的筆記，編輯前會先和雲端同步。",
      buttons: [
        { id: "connect", label: "連線 Google 同步", kind: "primary", run: start },
        { id: "offline", label: "先離線編輯" },
        { id: "cancel", label: "取消" },
      ],
    })
    return choice === "connect" || choice === "offline" ? choice : "cancel"
  },

  async offline(withRetry) {
    const choice = await dialog({
      title: "目前無法與雲端同步",
      message: h(
        "div",
        null,
        h("p", { text: "（沒有網路或尚未連線 Google）" }),
        h("p", { text: "你現在的修改會先存在這台裝置，恢復連線後會自動合併。" }),
        h("p", { text: "如果其他裝置也修改過同一則筆記，系統會保留兩個版本讓你選擇。" }),
      ),
      buttons: [
        ...(withRetry ? [{ id: "retry", label: "重試同步" }] : []),
        { id: "ok", label: "我知道了，繼續編輯", kind: "primary" as const },
        { id: "cancel", label: "取消" },
      ],
    })
    return choice === "ok" || choice === "retry" ? choice : "cancel"
  },

  async signOut(hasUnsyncedChanges) {
    const choice = await dialog({
      title: "登出",
      message: h(
        "div",
        null,
        hasUnsyncedChanges ? h("p", { class: "bwz-n-warn", text: "注意：還有修改尚未上傳到雲端。如果清除這台裝置上的筆記，這些修改會遺失。" }) : null,
        h("p", { text: "「保留」：筆記留在這台裝置，下次登入同一個帳號時繼續使用。" }),
        h("p", { text: "「清除」：刪除這台裝置上的筆記與記住的帳號（雲端上的不受影響）。公用電腦請選清除，並記得也登出瀏覽器裡的 Google 帳號。" }),
      ),
      buttons: [
        { id: "keep", label: "保留這台裝置上的筆記", kind: "primary" },
        { id: "clear", label: "清除這台裝置上的筆記", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    return choice === "keep" || choice === "clear" ? choice : null
  },

  async disconnect() {
    const choice = await dialog({
      title: "中斷與 Google 的連線",
      message: "這會撤銷本站存取你 Google 雲端硬碟筆記資料夾的授權並登出。雲端上的筆記不會被刪除，之後重新登入即可繼續使用。",
      buttons: [
        { id: "ok", label: "中斷連線", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    return choice === "ok"
  },

  async deleteAll() {
    const first = await dialog({
      title: "刪除全部筆記",
      message: "這會刪除你在 Google 雲端硬碟上本站的所有筆記，以及這台裝置上的筆記，無法復原。建議先按「匯出備份」。",
      buttons: [
        { id: "next", label: "我了解，繼續", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    if (first !== "next") return false
    const second = await dialog({
      title: "最後確認",
      message: "真的要刪除全部筆記嗎？",
      buttons: [
        { id: "delete", label: "刪除全部", kind: "danger" },
        { id: "cancel", label: "取消", kind: "primary" },
      ],
    })
    return second === "delete"
  },

  async reupload() {
    const choice = await dialog({
      title: "雲端的筆記資料似乎被刪除了",
      message: "可能是在 Google 雲端硬碟的「管理應用程式」中刪除了本站的隱藏資料。這台裝置上還有筆記，要用這台裝置的資料重新上傳嗎？",
      buttons: [
        { id: "reupload", label: "重新上傳", kind: "primary" },
        { id: "later", label: "稍後再說" },
      ],
    })
    return choice === "reupload"
  },

  notify(n) {
    toast(noticeText(n))
  },
}
