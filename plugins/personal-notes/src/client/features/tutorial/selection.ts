// 手機版「換你試試」：讀者用手指真的長按選字時，判斷選取範圍碰到示範頁上哪一段虛線字。
// 純函式（pickTarget）只吃字元位置，可以在 Node 測試；DOM 的部分（watchSelection）把真實選取換算成字元位置。
// 只讀取選取範圍，不寫任何資料（D-49：示範頁不會存進真正的筆記）。

import type { Stage } from "./engine"

/** 一段字元範圍：start 含、end 不含（相對於同一個根節點的文字位置）。 */
export interface Span {
  start: number
  end: number
}

export interface Target extends Span {
  name: string
}

/**
 * 選取範圍和哪一段目標字重疊最多就回傳哪一段的名稱；完全沒碰到（只是相鄰）、選取是空的回 null。
 * 重疊一樣多時取排在前面的。start 大於 end（反向選取）會先對調。
 */
export function pickTarget(sel: Span, targets: readonly Target[]): string | null {
  const a = Math.min(sel.start, sel.end)
  const b = Math.max(sel.start, sel.end)
  let best: string | null = null
  let bestLen = 0
  for (const t of targets) {
    const len = Math.min(b, t.end) - Math.max(a, t.start)
    if (len > bestLen) {
      best = t.name
      bestLen = len
    }
  }
  return best
}

/** node／offset 這個位置，是 root 裡的第幾個字（在 root 之前算 0、之後算全長）。 */
export function textOffset(root: Node, node: Node, offset: number): number {
  const r = document.createRange()
  r.setStart(root, 0)
  try {
    r.setEnd(node, offset)
  } catch {
    return 0
  }
  return Math.min(r.toString().length, root.textContent?.length ?? 0)
}

/**
 * 監看讀者真實的選取（document 的 selectionchange，防抖 delay 毫秒）。
 * 選取範圍碰到 targets() 回傳的某一個元素時呼叫 onHit；選取是空的（點一下、放開）就什麼都不做。
 * 示範區換掉或關閉（stage.signal 中止）時自動停止。
 */
export function watchSelection(
  s: Stage,
  targets: () => readonly { name: string; el: HTMLElement }[],
  onHit: (name: string, el: HTMLElement, range: Range) => void,
  delay = 200,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const check = () => {
    timer = undefined
    if (s.signal.aborted) return
    const sel = getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    // 選取要有一端在示範頁裡（網站其他地方的選取不管）
    if (!s.page.contains(range.startContainer) && !s.page.contains(range.endContainer)) return
    const list = targets()
    const spans: Target[] = list.map(({ name, el }) => {
      const start = textOffset(s.page, el, 0)
      return { name, start, end: start + (el.textContent?.length ?? 0) }
    })
    const hit = pickTarget(
      { start: textOffset(s.page, range.startContainer, range.startOffset), end: textOffset(s.page, range.endContainer, range.endOffset) },
      spans,
    )
    const found = list.find((t) => t.name === hit)
    if (found) onHit(found.name, found.el, range)
  }
  const onChange = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(check, delay)
  }
  document.addEventListener("selectionchange", onChange)
  s.signal.addEventListener(
    "abort",
    () => {
      document.removeEventListener("selectionchange", onChange)
      if (timer !== undefined) clearTimeout(timer)
    },
    { once: true },
  )
}
