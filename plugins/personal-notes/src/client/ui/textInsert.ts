// 在文字框的游標位置插入一段文字（純函式）。「引用到筆記」插進編輯中的筆記時使用。

/**
 * 把 insert 插進 value 的 caret 位置：前面接在空行之後（沒有空行就補），後面還有內容時另外留一行給使用者寫想法。
 * 回傳新內容與新的游標位置（引文下方的空行）。
 */
export function insertAtCaret(value: string, caret: number | null, insert: string): { value: string; caret: number } {
  const at = caret === null ? value.length : Math.min(Math.max(0, caret), value.length)
  const before = value.slice(0, at)
  const after = value.slice(at).replace(/^\n+/, "")
  const lead = before === "" ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n"
  const head = before + lead + insert
  return { value: after ? `${head}\n\n${after}` : head, caret: head.length }
}
