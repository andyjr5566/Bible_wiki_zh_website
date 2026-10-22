// 還原捲動位置要「等頁面長高到穩定」：換頁後圖片、折疊段落、筆記面板還在載入，頁面高度會變
// （實測一章從 12841px 掉到 10320px 再升到 10545px，約 1.6 秒才穩定），位置用比例算，高度變了就要重算。
// 這裡只決定「這一輪要不要再捲一次」（純函式，時間與高度由呼叫端傳入），實際捲動在 home-hub 的 scrollRestore.ts 與 verse-return 的 jump.ts（兩邊共用，所以放在 quartz/util）。

/** 每隔多久看一次頁面高度。 */
export const RESTORE_POLL_MS = 100
/** 高度連續這麼久沒變，就當作穩定、收手。 */
export const RESTORE_STABLE_MS = 500
/** 最久等這麼久；頁面一直在變（例如無限載入）也不會永遠跟著捲。 */
export const RESTORE_MAX_MS = 3000

export interface RestoreTick {
  now: number
  startedAt: number
  /** 這一輪量到的頁面高度 */
  height: number
  /** 上一輪量到的高度；第一輪沒有 */
  lastHeight: number | undefined
  /** 高度最後一次變動的時間 */
  lastChangeAt: number
}

export type RestoreAction = "apply" | "wait" | "done"

export function restoreAction({ now, startedAt, height, lastHeight, lastChangeAt }: RestoreTick): RestoreAction {
  if (now - startedAt >= RESTORE_MAX_MS) return "done"
  if (lastHeight === undefined || height !== lastHeight) return "apply"
  return now - lastChangeAt >= RESTORE_STABLE_MS ? "done" : "wait"
}
