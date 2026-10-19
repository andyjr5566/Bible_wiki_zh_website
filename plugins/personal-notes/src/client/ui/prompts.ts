// session/prompts.ts 的瀏覽器實作：帳號與同步相關的對話框、提示文字都集中在這裡。

import type { Notice, Prompts } from "../session/prompts"
import { dialog, h, toast } from "./dom"

function noticeText(n: Notice): string {
  switch (n.type) {
    case "signed-in":
      return `已登入：${n.name}`
    case "signed-out":
      return n.cleared ? "已登出，並清除這台裝置上的筆記" : "已登出。再按「用 Google 同步」登入同一個帳號，筆記就會回來。"
    case "disconnected":
      return n.revoked
        ? "已中斷連線並登出。雲端上的筆記沒有刪除。"
        : "已登出。要完全取消本站的授權，請到 Google 帳戶的「第三方連線」移除本站。"
    case "adopted":
      return `已加入 ${n.count} 則筆記`
    case "switched-account":
      return "已切換到另一個帳號的筆記，請再按一次"
    case "deleted-all":
      if (n.backupTrashFailed) return "已刪除全部筆記；Google Drive 裡的備份沒有移到垃圾桶，請到雲端硬碟刪除「聖經知識庫筆記備份」資料夾"
      if (n.trashedBackups) return `已刪除全部筆記，並把 ${n.trashedBackups} 份備份移到 Google Drive 的垃圾桶（30 天內可救回）`
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
      return "請先按上方的「繼續同步」連上雲端，才能一併刪除雲端上的筆記"
    case "switch-blocked":
      return "編輯中的筆記存不進去，為了不弄丟內容，這次先不切換帳號。請先把內容複製起來，再試一次。"
    case "delete-failed":
      return n.message || "刪除失敗，請稍後再試"
  }
}

export const browserPrompts: Prompts = {
  async explainSignIn(googleReady, start, notice) {
    const base = document.body.dataset.basepath ?? ""
    const choice = await dialog({
      title: "用 Google 帳號同步筆記",
      message: h(
        "div",
        null,
        notice ? h("p", { class: "bwz-n-warn", text: notice }) : null,
        h("p", {
          text: "登入後，筆記會存到你自己的 Google 雲端硬碟裡一個本站專用的隱藏空間，手機、平板、電腦登入同一個帳號都看得到同一份。這個空間在 Google 雲端硬碟 App 裡看不到，請直接在本站查看筆記。",
        }),
        h("p", { text: "本站看不到你雲端硬碟裡的照片、文件或任何其他檔案，筆記也不會經過本站的伺服器。" }),
        h("p", null, h("a", { text: "隱私權政策", attrs: { href: `${base}/${encodeURI("教學/隱私權政策")}`, target: "_blank", rel: "noopener" } })),
      ),
      buttons: [
        { id: "go", label: "繼續", kind: "primary", run: start, waitFor: googleReady, waitingLabel: "Google 元件載入中…", failedLabel: "無法連到 Google，請檢查網路" },
        { id: "cancel", label: "取消" },
      ],
    })
    return choice === "go"
  },

  async inAppBrowser(browserName) {
    // 只有 LINE 認得 openExternalBrowser 參數；其他 App 要從選單選「用瀏覽器開啟」（Antigravity 審查 M-07）
    const isLine = browserName === "LINE"
    const url = new URL(location.href)
    url.searchParams.set("openExternalBrowser", "1")
    const choice = await dialog({
      title: "請用 Safari 或 Chrome 開啟",
      message: h(
        "div",
        null,
        h("p", { text: `${browserName} 內建的瀏覽器無法登入 Google。請改用 Safari 或 Chrome 開啟本頁，就能同步筆記。` }),
        isLine ? null : h("p", { text: "做法：點畫面角落的「⋯」選單，選「用瀏覽器開啟」；或按「複製網址」，再貼到 Safari 或 Chrome。" }),
        h("p", { text: `注意：在 ${browserName} 裡寫的筆記不會自動帶到 Safari 或 Chrome，建議切換過去之後再開始寫。` }),
      ),
      buttons: [
        ...(isLine ? [{ id: "open", label: "用外部瀏覽器開啟", kind: "primary" as const, run: () => location.assign(url.toString()) }] : []),
        { id: "copy", label: "複製網址", kind: isLine ? undefined : ("primary" as const) },
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
      message: h(
        "div",
        null,
        h("p", { text: `這台裝置上有 ${count} 則未登入時寫的筆記。要把它們加入這個 Google 帳號、一起同步嗎？` }),
        h("p", { text: "選「先不要」的話，登入期間這些筆記不會顯示（不會刪除），之後可以在「我的筆記」頁再加入。只有在公用電腦、那些筆記不是你寫的時候才選「先不要」。" }),
      ),
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
      title: "要先連上雲端嗎？",
      message: "為了確保這台裝置和雲端的筆記一致，新增、修改或刪除前會先和雲端同步。",
      buttons: [
        { id: "connect", label: "繼續同步", kind: "primary", run: start },
        { id: "offline", label: "先在這台裝置上改" },
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
        h("p", { text: "登出後畫面會回到「未登入」，這個帳號的筆記會先隱藏；再登入同一個帳號就會出現，雲端上的筆記不受影響。" }),
        h("p", { text: "自己的手機或電腦：選「登出」，筆記留在這台裝置，下次登入很快。" }),
        h("p", { text: "教會或公用電腦：選「登出並清除」，刪掉這台裝置上的筆記與記住的帳號，並記得也登出瀏覽器裡的 Google 帳號。" }),
      ),
      buttons: [
        { id: "keep", label: "登出", kind: "primary" },
        { id: "clear", label: "登出並清除這台裝置的資料", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    return choice === "keep" || choice === "clear" ? choice : null
  },

  async disconnect({ canRevoke, hasUnsyncedChanges }) {
    const choice = await dialog({
      title: "中斷與 Google 的連線",
      message: h(
        "div",
        null,
        hasUnsyncedChanges ? h("p", { class: "bwz-n-warn", text: "注意：還有修改尚未上傳到雲端。建議先按「繼續同步」，等狀態變成「已同步」再中斷連線。" }) : null,
        canRevoke
          ? h("p", { text: "這會撤銷本站存取你 Google 雲端硬碟筆記空間的授權並登出。雲端上的筆記不會被刪除，之後重新登入即可繼續使用。" })
          : h("p", { text: "目前沒有連上雲端，本站無法替你向 Google 撤銷授權，只能先登出。要完全取消授權，請到 Google 帳戶的「第三方連線」移除本站；或先按「繼續同步」再回來中斷連線。" }),
      ),
      buttons: [
        { id: "ok", label: canRevoke ? "中斷連線" : "先登出", kind: "danger" },
        { id: "cancel", label: "取消", autofocus: true },
      ],
    })
    return choice === "ok"
  },

  async deleteAll({ offerBackups }) {
    // D-50：有 Drive 備份權限時讓使用者勾選要不要一起把備份移到垃圾桶（預設不勾）；沒有權限時說明備份不會被刪
    const trash = h("input", { attrs: { type: "checkbox" } })
    const first = await dialog({
      title: "刪除全部筆記",
      message: h(
        "div",
        null,
        h("p", { text: "這會刪除你在 Google 雲端硬碟上本站的所有筆記，以及這台裝置上的筆記，無法復原。建議先按「匯出備份」。" }),
        offerBackups
          ? h("label", { class: "bwz-n-check" }, trash, " 同時把 Google Drive「聖經知識庫筆記備份」資料夾裡的備份移到垃圾桶（30 天內可以救回）")
          : h("p", { class: "bwz-n-muted", text: "如果你曾存到 Google Drive，那些備份檔不會被刪除；要刪請到雲端硬碟刪除「聖經知識庫筆記備份」資料夾。" }),
      ),
      buttons: [
        { id: "next", label: "我了解，繼續", kind: "danger" },
        { id: "cancel", label: "取消", autofocus: true },
      ],
    })
    if (first !== "next") return false // 第一段已預設停在「取消」
    const trashBackups = offerBackups && trash.checked
    const second = await dialog({
      title: "最後確認",
      message: trashBackups ? "真的要刪除全部筆記，並把 Google Drive 裡的備份移到垃圾桶嗎？" : "真的要刪除全部筆記嗎？",
      buttons: [
        { id: "delete", label: "刪除全部", kind: "danger" },
        { id: "cancel", label: "取消", kind: "primary" },
      ],
    })
    return second === "delete" ? { trashBackups } : false
  },

  async reupload() {
    const choice = await dialog({
      title: "雲端的筆記資料似乎被刪除了",
      message: h(
        "div",
        null,
        h("p", { text: "可能是在另一台裝置按了「刪除全部筆記」，或在 Google 雲端硬碟的「管理應用程式」刪除了本站的隱藏資料。這台裝置上還有筆記。" }),
        h("p", { text: "如果是你刻意刪除的，請選「清除這台裝置上的筆記」；如果不是，選「重新上傳」用這台裝置的資料把雲端補回來。" }),
      ),
      buttons: [
        { id: "reupload", label: "重新上傳", kind: "primary" },
        { id: "clear", label: "清除這台裝置上的筆記", kind: "danger" },
        { id: "later", label: "稍後再說", autofocus: true },
      ],
    })
    return choice === "reupload" || choice === "clear" ? choice : null
  },

  notify(n) {
    toast(noticeText(n))
  },
}
