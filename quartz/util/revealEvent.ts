// 「請把這個元素所在的區塊顯示出來」的事件約定。
// 純經文模式（site-ux）會藏起本章整理等區塊；別的外掛（例如 verse-return 要捲到「本章整理」的某個標題）
// 不認識那些藏起來的區塊，只要發這個事件，由 site-ux 決定要不要暫時顯示。事件名與資料格式只定義在這裡。
export const REVEAL_EVENT = "bwz:reveal"

export interface RevealDetail {
  /** 要看到的元素 id（通常是標題）。找不到元素或本來就看得到時，什麼都不做。 */
  id: string
  /** 有人處理（元素在藏起來的區塊裡、已暫時顯示）時由 site-ux 設為 true */
  handled?: boolean
}

export function requestReveal(id: string, target: Pick<Document, "dispatchEvent"> = document): boolean {
  const detail: RevealDetail = { id }
  target.dispatchEvent(new CustomEvent<RevealDetail>(REVEAL_EVENT, { detail }))
  return detail.handled === true
}
