// 每頁要嵌入的文字：標題 + 換行 + 內文前 400 個字（內文裡的換行改成空白）。
// 規則來自 dev-notes/semantic-search/README.md 的 S-3，改這裡就會讓所有向量重算（快取鍵含文字）。

export const BODY_CHARS = 400

export function pageText(title, content) {
  const body = String(content ?? "").replace(/\r?\n/g, " ")
  // 以 code point 計算，避免切到代理對（surrogate pair）中間
  const head = Array.from(body).slice(0, BODY_CHARS).join("")
  return `${String(title ?? "")}\n${head}`
}
