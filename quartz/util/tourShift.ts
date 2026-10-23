// 導覽停在某一站時，目標上方的內容可能還在長高（網頁字型載入後換行、延後加入的區塊），
// 導覽早先捲到的位置就偏了，聚光圈會框到畫面外。這裡只決定「要不要重新捲一次」（純函式），量測與捲動在 wiki-tour 的 tour.inline.ts。
// 判斷依據是目標「在整份文件裡的位置」變了，而不是畫面上的位置：讀者自己捲動不會改變文件位置，所以不會和讀者搶捲動。

/** 位置變動小於這個值視為沒變（取整、子像素誤差）。 */
export const SHIFT_THRESHOLD_PX = 8
/** 每一站最多補捲幾次，避免內容一直在變時反覆捲動。 */
export const MAX_RESCROLLS_PER_STEP = 4

export interface ShiftInput {
  /** 上一次捲動時量到的目標文件位置（rect.top + scrollY） */
  scrolledDocTop: number
  /** 現在量到的目標文件位置 */
  nowDocTop: number
  /** 這一站已經補捲的次數 */
  rescrolls: number
  /** 目標本身是 fixed／sticky（文件位置會隨捲動改變，不能拿來判斷版面位移） */
  followsViewport: boolean
}

export function shouldRescrollAfterShift({ scrolledDocTop, nowDocTop, rescrolls, followsViewport }: ShiftInput): boolean {
  if (followsViewport) return false
  if (rescrolls >= MAX_RESCROLLS_PER_STEP) return false
  return Math.abs(nowDocTop - scrolledDocTop) > SHIFT_THRESHOLD_PX
}
