// 編輯中草稿的本機備份（localStorage），防止「打完字 0.6 秒內就關分頁／重新整理」時遺失（Codex 畫面審查 #4）。
//
// 規則（Codex 第二輪審查 #1–#5）：
// - 每個編輯框一份草稿（鍵含帳號、分頁、編輯框代號），不同分頁、不同編輯框互不覆蓋。
// - 草稿記下「編輯時的版本」（baseHlc）。補存時若筆記已被別處改過，另存成新筆記，不覆蓋。
// - 確定寫進資料庫後才刪除草稿；失敗就留著，下次再試。
// - 這個分頁裡還開著的編輯框、正在補存中的草稿不會被拿去補存；別的分頁的草稿超過 30 秒沒被清掉才補存。

import type { NoteRecord } from "../../model/record"
import type { NodeRef, NoteInput, NotesService } from "./notes"

export interface Draft {
  /** 章節筆記的書卷與章；條目筆記填 ""、0（看 node）。 */
  book: string
  chapter: number
  /** 條目筆記（F5）：寫在哪個知識庫條目上（以 slug 對應）；章節筆記與舊草稿沒有這個欄位。 */
  node?: NodeRef
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

/**
 * 補存一份草稿；回傳是否真的寫入了東西。與目前在哪個頁面無關：章節草稿與條目草稿都靠草稿本身記的位置
 * （book／chapter 或 node.slug）判斷，所以在任何一種頁面都能補存另一種的草稿。
 */
export async function applyDraft(notes: NotesService, d: Draft): Promise<boolean> {
  if (!d.input.title && !d.input.body.trim()) return false
  // 條目草稿以 draft.node 為準（舊版草稿沒有這個欄位）；input.node 一併帶上，補存時才會建成條目筆記
  const input: NoteInput = d.node ? { ...d.input, node: d.node } : d.input
  // 「已經存到了」要連標籤與節數一起比（只改標籤或節數的草稿不能被當成已存好，Codex Sol 審查 F5a #1）
  const tagsKey = (t: readonly string[]) => [...t].sort().join("|")
  const same = (r: NoteRecord) =>
    !r.deleted &&
    r.title === input.title &&
    r.body === input.body &&
    tagsKey(r.tags) === tagsKey(input.tags ?? []) &&
    (d.node || ((r.anchor.verseStart ?? null) === (input.verseStart ?? null) && (r.anchor.verseEnd ?? null) === (input.verseEnd ?? null)))
  // 紀錄現在是不是還在草稿記的位置（同一個條目／同一章）；不是就另存，不改到別的位置（#2）
  const sameTarget = (r: NoteRecord) =>
    d.node ? r.anchor.kind === "node" && r.anchor.node?.slug === d.node.slug : r.anchor.kind !== "node" && r.anchor.book === input.book && r.anchor.chapter === input.chapter
  const existing = d.noteId ? notes.get(d.noteId) : undefined
  if (existing && same(existing.winner)) return false // 其實已經存到了
  if (existing && !existing.winner.deleted && existing.conflicts.length === 0 && existing.winner.hlc === d.baseHlc && sameTarget(existing.winner)) {
    // 筆記從上次存檔後沒被別處改過：直接補上
    await notes.update(existing.id, input)
    return true
  }
  const siblings = d.node ? notes.forEntry(d.node.slug) : notes.forChapter(input.book, input.chapter)
  if (!d.noteId && siblings.some((r) => same(r.winner))) return false // 新筆記其實建立成功了
  // 筆記已被別的分頁或裝置改過（或不見了）：另存，不覆蓋較新的內容（Codex 第二輪 #1）
  await notes.create(d.noteId ? { ...input, title: `${input.title || "筆記"}（恢復的草稿）` } : input)
  return true
}
