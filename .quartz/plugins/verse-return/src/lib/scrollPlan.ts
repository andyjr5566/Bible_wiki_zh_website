// 回到某處時「要捲到哪裡」的算法（純函式）。位置全部用「視窗座標」輸入，結果是 window.scrollTo 的 top。

export interface TargetBox {
  /** 目標元素上緣相對視窗（getBoundingClientRect().top） */
  top: number
  height: number
}

export interface ScrollContext {
  scrollY: number
  viewportHeight: number
  /** 貼在頂端的東西（手機黏頂工具列、章節快捷列）佔掉的高度；桌機是 0 */
  topObstruction: number
}

/** 經節置中：在「不被頂端遮住的可見範圍」裡置中；經節比可見範圍還高時改成對齊上緣。 */
export function centerScrollTop(target: TargetBox, ctx: ScrollContext): number {
  const visible = ctx.viewportHeight - ctx.topObstruction
  const offset = target.height >= visible ? 0 : (visible - target.height) / 2
  return Math.max(0, Math.round(ctx.scrollY + target.top - ctx.topObstruction - offset))
}

/** 標題對齊頁面可見範圍的上緣（再留一點空隙），不被黏頂的工具列與快捷列蓋住。 */
export const HEADING_GAP_PX = 12

export function headingScrollTop(target: TargetBox, ctx: ScrollContext): number {
  return Math.max(0, Math.round(ctx.scrollY + target.top - ctx.topObstruction - HEADING_GAP_PX))
}
