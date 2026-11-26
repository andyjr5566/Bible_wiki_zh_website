// 閱讀紀錄的儲存層：只負責 localStorage 的讀寫與「有沒有紀錄」，規則全部在 quartz/util/readingPosition.ts。
// 所有存取都包 try/catch：隱私模式、被封鎖或額度用完時讀回空紀錄、寫入靜默失敗，首頁照常。
import {
  EMPTY_READING,
  READING_STORAGE_KEY,
  parseReading,
  recentReadings,
  recordReading,
  serializeReading,
  type ReadingState,
  type ReadingUpdate,
} from "../../../../quartz/util/readingPosition"

export interface ReadingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function localStore(): ReadingStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

export function loadReading(storage: ReadingStorage | null = localStore()): ReadingState {
  if (!storage) return EMPTY_READING
  try {
    return parseReading(storage.getItem(READING_STORAGE_KEY))
  } catch {
    return EMPTY_READING
  }
}

/** 至少有一筆「對得上書卷的章節紀錄」才算有紀錄（壞掉的、不認得的書卷不算）。 */
export function hasReading(storage: ReadingStorage | null = localStore()): boolean {
  return recentReadings(loadReading(storage), 1).length > 0
}

/** 回傳這次是否真的寫進去（章節頁以外的 slug 規則會拒絕，也不寫）。 */
export function saveReading(update: ReadingUpdate, storage: ReadingStorage | null = localStore()): boolean {
  if (!storage) return false
  try {
    const before = loadReading(storage)
    const after = recordReading(before, update)
    if (after === before) return false
    storage.setItem(READING_STORAGE_KEY, serializeReading(after))
    return true
  } catch {
    return false
  }
}
