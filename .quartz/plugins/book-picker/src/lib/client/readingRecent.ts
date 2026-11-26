// 讀「最近讀的是哪一卷」（只讀，用來決定書卷格子預設開舊約還是新約）。
// 記錄由首頁入口外掛寫入 localStorage 的 bwz-reading；規則（解析、排序）用 quartz/util/readingPosition。
// localStorage 讀不到（無痕模式、被封鎖）一律當作沒有紀錄，不丟例外。
import type { BibleBook } from "../../../../../quartz/util/bibleBooks"
import { READING_STORAGE_KEY, parseReading, recentReadings } from "../../../../../quartz/util/readingPosition"

export function recentReadBook(): BibleBook | undefined {
  try {
    const raw = window.localStorage.getItem(READING_STORAGE_KEY)
    return recentReadings(parseReading(raw), 1)[0]?.book
  } catch {
    return undefined
  }
}
