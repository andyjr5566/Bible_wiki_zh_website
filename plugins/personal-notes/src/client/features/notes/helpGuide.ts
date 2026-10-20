// 筆記面板的「?」小說明：一個簡單的文字版教學（不是導覽，也不是動畫教學；動畫教學由下方連結另開）。
// 內容是資料（HELP_LINES），畫面用 h() 組出來，不使用 innerHTML。

import { h } from "../../ui/dom"
import { primaryInput, type InputKind } from "../../ui/env"

export const HELP_LINES: { icon: string; text: string; touch?: string }[] = [
  { icon: "📝", text: "按「＋ 新增筆記」寫這一章的筆記，邊寫邊自動儲存。" },
  { icon: "🖍", text: "用滑鼠在經文上選一段字，跳出工具列：畫重點、書籤、便條、寫筆記。", touch: "長按經文，拉動藍色把手選範圍，下方會跳出工具列：畫重點、書籤、便條、寫筆記。" },
  { icon: "🗒️", text: "便條紙貼在那一節下面，可以換顏色、收起成小紙條。" },
  { icon: "🔗", text: "筆記裡打「[[」加條目名稱，就能連到知識庫；條目頁會列出「我的相關筆記」。" },
  { icon: "❝", text: "在註釋或條目頁用滑鼠選一段字，按「引用到筆記」，引文和出處會自動放進筆記。", touch: "在註釋或條目頁長按選一段字，點「引用到筆記」，引文和出處會自動放進筆記。" },
  { icon: "📚", text: "〈我的筆記〉頁可以依書卷、標籤找所有筆記。" },
  { icon: "☁️", text: "用 Google 同步，手機電腦都看得到；「⚙ 設定與備份」可以存一份到 Google Drive。" },
]

/** 依主要輸入方式挑說法：觸控（手機、平板）有 touch 就用 touch，其他行兩邊相同（D-51）。 */
export function helpLines(input: InputKind): { icon: string; text: string }[] {
  return HELP_LINES.map(({ icon, text, touch }) => ({
    icon,
    text: input === "touch" && touch ? touch : text,
  }))
}

const CHAPTER_FIRST = "寫這一章的筆記"
const ENTRY_FIRST = "寫這個條目的筆記"

/**
 * 組出「筆記怎麼用」對話框的內容。
 * basepath：網站根路徑（document.body.dataset.basepath）；forEntry：條目頁時第一行改成「寫這個條目的筆記」。
 */
export function buildHelpGuide(basepath: string, forEntry = false, input: InputKind = primaryInput()): HTMLElement {
  const lines = helpLines(input).map((line, i) => {
    const text = i === 0 && forEntry ? line.text.replace(CHAPTER_FIRST, ENTRY_FIRST) : line.text
    return h(
      "li",
      { class: "bwz-n-help-line" },
      h("span", { class: "bwz-n-help-icon", text: line.icon, attrs: { "aria-hidden": "true" } }),
      h("span", { class: "bwz-n-help-text", text }),
    )
  })
  return h(
    "div",
    { class: "bwz-n-help" },
    h("ul", { class: "bwz-n-help-list" }, ...lines),
    h("p", { class: "bwz-n-help-more" }, h("a", { text: "看動畫教學 →", attrs: { href: `${basepath}/my-notes?tutorial=1` } })),
  )
}
