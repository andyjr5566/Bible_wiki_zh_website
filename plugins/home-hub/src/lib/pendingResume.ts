// 按「繼續」到換頁完成之間，要記得「這次要捲到哪裡」：一次性旗標放在 sessionStorage，
// 只有按「繼續」才會寫；一般點進章節不會有旗標，所以不會被捲動。不用網址 hash（會和章內錨點、搜尋跳轉混在一起）。
import { canonicalSlugPath } from "../../../../quartz/util/bibleBooks"

export const PENDING_KEY = "bwz-resume-pending"
// 旗標只有幾秒鐘的壽命：換頁失敗或讀者中途離開，旗標不會留到之後某次不相干的造訪。
export const PENDING_TTL_MS = 60 * 1000

export interface PendingResume {
  slug: string
  ratio: number
  t: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function parsePending(raw: string | null | undefined): PendingResume | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PendingResume> | null
    if (
      !value ||
      typeof value.slug !== "string" ||
      typeof value.ratio !== "number" ||
      !Number.isFinite(value.ratio) ||
      typeof value.t !== "number" ||
      !Number.isFinite(value.t)
    ) {
      return null
    }
    return { slug: value.slug, ratio: value.ratio, t: value.t }
  } catch {
    return null
  }
}

/** 旗標是不是給「現在這一頁」的、而且還沒過期。 */
export function pendingApplies(pending: PendingResume | null, currentSlug: string, now: number): pending is PendingResume {
  if (!pending) return false
  if (now - pending.t > PENDING_TTL_MS || pending.t - now > PENDING_TTL_MS) return false
  return canonicalSlugPath(pending.slug) === canonicalSlugPath(currentSlug)
}

function sessionStore(): StorageLike | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    return null
  }
}

export function setPending(slug: string, ratio: number, now: number, storage: StorageLike | null = sessionStore()): void {
  try {
    storage?.setItem(PENDING_KEY, JSON.stringify({ slug, ratio, t: now } satisfies PendingResume))
  } catch {
    // 寫不進去就當作這次不還原位置，不影響換頁
  }
}

/** 取出並清掉旗標（讀一次就失效）；不是給這一頁的也一併清掉，避免殘留。 */
export function takePending(currentSlug: string, now: number, storage: StorageLike | null = sessionStore()): PendingResume | null {
  if (!storage) return null
  let pending: PendingResume | null = null
  try {
    pending = parsePending(storage.getItem(PENDING_KEY))
    if (pending) storage.removeItem(PENDING_KEY)
  } catch {
    return null
  }
  return pendingApplies(pending, currentSlug, now) ? pending : null
}
