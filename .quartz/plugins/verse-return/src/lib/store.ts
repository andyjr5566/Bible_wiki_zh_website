// 返回點的儲存：sessionStorage（只在這個分頁有效；關掉分頁就沒了）。
// 鍵名與資料格式的規則在 quartz/util/returnPoint.ts，這裡只是薄薄的讀寫層。
// 所有讀寫都包 try/catch：儲存被封鎖或額度用完時當作沒有返回點，不丟錯。
import {
  RETURN_POINT_KEY,
  parseReturnPoint,
  serializeReturnPoint,
  type ReturnPoint,
} from "../../../../quartz/util/returnPoint"
import {
  ENTRY_LANDING_KEY,
  parseEntryLanding,
  serializeEntryLanding,
  type EntryLanding,
} from "../../../../quartz/util/entryLanding"

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function sessionStore(): StorageLike | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    return null
  }
}

export function readReturnPoint(storage: StorageLike | null = sessionStore()): ReturnPoint | null {
  try {
    return parseReturnPoint(storage?.getItem(RETURN_POINT_KEY))
  } catch {
    return null
  }
}

export function writeReturnPoint(point: ReturnPoint, storage: StorageLike | null = sessionStore()): boolean {
  try {
    if (!storage) return false
    storage.setItem(RETURN_POINT_KEY, serializeReturnPoint(point))
    return true
  } catch {
    return false
  }
}

export function clearReturnPoint(storage: StorageLike | null = sessionStore()): void {
  try {
    storage?.removeItem(RETURN_POINT_KEY)
  } catch {
    // 清不掉就算了；下一次讀取仍會驗證格式
  }
}

export function readEntryLanding(
  storage: StorageLike | null = sessionStore(),
  now = Date.now(),
): EntryLanding | null {
  try {
    return parseEntryLanding(storage?.getItem(ENTRY_LANDING_KEY), now)
  } catch {
    return null
  }
}

export function writeEntryLanding(landing: EntryLanding, storage: StorageLike | null = sessionStore()): boolean {
  try {
    if (!storage) return false
    storage.setItem(ENTRY_LANDING_KEY, serializeEntryLanding(landing))
    return true
  } catch {
    return false
  }
}

export function clearEntryLanding(storage: StorageLike | null = sessionStore()): void {
  try {
    storage?.removeItem(ENTRY_LANDING_KEY)
  } catch {
    // 清不掉就算了；下次導覽仍會略過這筆記錄
  }
}
