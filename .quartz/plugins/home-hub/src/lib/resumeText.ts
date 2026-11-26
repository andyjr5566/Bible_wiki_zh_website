// 「繼續閱讀」卡片的說明文字：上次讀到章的哪一段、多久以前。
// 只有純函式（時間由呼叫端傳入），門檻都寫成具名常數，之後要調整只改這裡。

// 捲動比例的分界：低於 START 算開頭、低於 EARLY 算前段、低於 MIDDLE 算中段，其餘算後段。
export const POSITION_START_BELOW = 0.1
export const POSITION_EARLY_BELOW = 0.35
export const POSITION_MIDDLE_BELOW = 0.65

// 五分鐘內說「剛剛」；跨過午夜就不再說「今天」，改看日曆天數。
export const JUST_NOW_MS = 5 * 60 * 1000
// 日曆天數差小於這個數字就說「N 天前」；再久改顯示日期，因為「12 天前」要讀者自己再換算。
export const DAYS_AGO_BELOW = 7

export type PositionLabel = "開頭" | "前段" | "中段" | "後段"

export function positionLabel(ratio: number): PositionLabel {
  if (!(ratio >= POSITION_START_BELOW)) return "開頭"
  if (ratio < POSITION_EARLY_BELOW) return "前段"
  if (ratio < POSITION_MIDDLE_BELOW) return "中段"
  return "後段"
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 兩個時間點相差幾個「日曆天」（用本機時區的日期算，不是除以 24 小時，才不會被夏令時間或半夜弄錯）。 */
function calendarDaysBetween(from: number, to: number): number {
  const a = new Date(startOfLocalDay(from))
  const b = new Date(startOfLocalDay(to))
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000,
  )
}

export function relativeTime(t: number, now: number): string {
  // 時鐘不準造成「未來」的時間，也當作剛剛，不顯示負數。
  if (!Number.isFinite(t) || now - t < JUST_NOW_MS) return "剛剛"
  const days = calendarDaysBetween(t, now)
  if (days <= 0) return "今天"
  if (days === 1) return "昨天"
  if (days < DAYS_AGO_BELOW) return `${days} 天前`
  const d = new Date(t)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 章節頁：「上次讀到這一章的中段 · 昨天」。 */
export function chapterDescription(ratio: number, t: number, now: number): string {
  return `上次讀到這一章的${positionLabel(ratio)} · ${relativeTime(t, now)}`
}

/** 該章已經不存在、退回全書目錄時沒有「這一章」可說。 */
export function bookDescription(t: number, now: number): string {
  return `上次讀過這一卷 · ${relativeTime(t, now)}`
}
