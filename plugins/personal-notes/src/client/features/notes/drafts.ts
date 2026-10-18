// 編輯中草稿的本機備份（localStorage），防止「打完字 0.6 秒內就關分頁／重新整理」時遺失（Codex 畫面審查 #4）。
//
// 規則（Codex 第二輪審查 #1–#5）：
// - 每個編輯框一份草稿（鍵含帳號、分頁、編輯框代號），不同分頁、不同編輯框互不覆蓋。
// - 草稿記下「編輯時的版本」（baseHlc）。補存時若筆記已被別處改過，另存成新筆記，不覆蓋。
// - 確定寫進資料庫後才刪除草稿；失敗就留著，下次再試。
// - 這個分頁裡還開著的編輯框、正在補存中的草稿不會被拿去補存；別的分頁的草稿超過 30 秒沒被清掉才補存。

import type { NoteInput } from "./notes"

export interface Draft {
  book: string
  chapter: number
  /** 這個編輯框對應的筆記；新筆記還沒建立時是 null。 */
  noteId: string | null
  /** 最後一次成功存檔（或開啟編輯器）時的版本；新筆記是 null。 */
  baseHlc: string | null
  input: NoteInput
  at: number
  tab: string
}

const PREFIX = "bwz-notes-draft:"
export const DRAFT_STALE_MS = 30_000

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

const randomId = () => Math.random().toString(36).slice(2, 10)

/** 這個分頁的代號（重新整理後不變，所以重新整理前留下的草稿可以立刻補存）。 */
export const tabId: string = safe(() => {
  let id = sessionStorage.getItem("bwz-notes-tab")
  if (!id) {
    id = randomId()
    sessionStorage.setItem("bwz-notes-tab", id)
  }
  return id
}, randomId())

const active = new Set<string>()
const recovering = new Set<string>()

/** 新編輯框的草稿鍵。namespace：帳號 permissionId 或 "anon"。 */
export function newDraftKey(namespace: string): string {
  const key = `${PREFIX}${namespace}:${tabId}:${randomId()}`
  active.add(key)
  return key
}

/** 編輯框關閉了（草稿若還在，之後可被補存）。 */
export function releaseDraftKey(key: string): void {
  active.delete(key)
}

/** 回傳是否寫入成功（localStorage 滿了或被封鎖時為 false）。 */
export function writeDraft(key: string, draft: Draft): boolean {
  return safe(() => {
    localStorage.setItem(key, JSON.stringify(draft))
    return true
  }, false)
}

export function clearDraft(key: string): void {
  safe(() => localStorage.removeItem(key), undefined)
}

/** 這個帳號可以補存的草稿。 */
export function recoverableDrafts(namespace: string, now = Date.now()): { key: string; draft: Draft }[] {
  const prefix = `${PREFIX}${namespace}:`
  const keys = safe(() => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? ""), [] as string[])
  const out: { key: string; draft: Draft }[] = []
  for (const key of keys) {
    if (!key.startsWith(prefix) || active.has(key) || recovering.has(key)) continue
    const draft = safe(() => JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null, null)
    if (!draft) continue
    if (draft.tab !== tabId && now - draft.at < DRAFT_STALE_MS) continue
    out.push({ key, draft })
  }
  return out
}

/** 補存期間鎖住這份草稿，避免同時被處理兩次。 */
export async function withDraftLock(key: string, fn: () => Promise<void>): Promise<void> {
  if (recovering.has(key)) return
  recovering.add(key)
  try {
    await fn()
  } finally {
    recovering.delete(key)
  }
}
