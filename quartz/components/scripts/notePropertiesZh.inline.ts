// notePropertiesZh.inline.ts
// 聖經研讀知識庫 - 條目頁「屬性」區塊的中文化與整理（decision U-7）
// note-properties 外掛的介面字（標題 "Properties"、欄位名 "aliases" 等）寫死英文，且沒有 zh-TW 語系，
// 而 .quartz/ 的外掛每次建置都會重新下載，不能直接改。所以在這裡於頁面載入後處理：
//   - 欄位名改成中文（沒有對照的欄位維持原樣）
//   - 值是空的列整列隱藏（例如 aliases: []）；全部都空就整個區塊隱藏
//   - 重新計算右上角的數量
// 標題的「屬性」先由 custom.scss 顯示（避免整頁載入時閃一下英文），script 跑完後改成真正的文字。
// 懸停預覽（.popover）裡的區塊整個由 custom.scss 隱藏，這裡不處理。

const NOTE_PROPERTY_LABELS: Record<string, string> = {
  aliases: "別名",
  alias: "別名",
  tags: "標籤",
  tag: "標籤",
  description: "描述",
  title: "標題",
  created: "建立日期",
  modified: "修改日期",
  date: "日期",
  author: "作者",
}

function isEmptyPropertyValue(cell: Element): boolean {
  // 空陣列：<span class="note-properties-list"></span>；null：<span class="note-properties-empty">—</span>
  if (cell.querySelector(".note-properties-empty")) return true
  return (cell.textContent ?? "").trim() === ""
}

function tidyNoteProperties() {
  for (const block of document.querySelectorAll<HTMLElement>("details.note-properties")) {
    if (block.closest(".popover")) continue
    let visible = 0
    for (const row of block.querySelectorAll<HTMLElement>(".note-properties-row")) {
      const keyCell = row.querySelector(".note-properties-key")
      const valueCell = row.querySelector(".note-properties-value")
      if (keyCell && !keyCell.hasAttribute("data-zh")) {
        const original = (keyCell.textContent ?? "").trim()
        const zh = NOTE_PROPERTY_LABELS[original]
        if (zh) keyCell.textContent = zh
        keyCell.setAttribute("data-zh", "1")
      }
      const empty = !valueCell || isEmptyPropertyValue(valueCell)
      row.hidden = empty
      if (!empty) visible++
    }
    block.hidden = visible === 0
    const title = block.querySelector(".note-properties-title")
    if (title) title.textContent = "屬性"
    block.setAttribute("data-zh", "1")
    const count = block.querySelector(".note-properties-count")
    if (count) count.textContent = String(visible)
  }
}

document.addEventListener("nav", tidyNoteProperties)
document.addEventListener("render", tidyNoteProperties)
