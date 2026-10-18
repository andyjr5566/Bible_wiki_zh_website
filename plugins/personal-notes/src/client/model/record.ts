// 筆記紀錄（一則筆記的一個版本）與分片檔格式。見 03 §3。

import { bookByCode, isValidShard } from "./books"
import { NOTE_ID_PATTERN } from "./ids"
import { parseHlc } from "./hlc"
import { isValidVv, type VersionVector } from "./vv"

export const SCHEMA_VERSION = 1
export const APP_TAG = "bwz-notes"
export const MAX_BODY_LENGTH = 100_000

export type RecordType = "note" | "highlight" | "bookmark" | "sticky"

/** 紀錄種類的格式。看不懂的種類（日後新增的功能）也接受並原樣保留，只是不顯示（D-41）。 */
const RECORD_TYPE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
export type AnchorKind = "chapter" | "verse" | "node" | "free"

export interface Anchor {
  kind: AnchorKind
  ref: string | null
  book: string | null
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
  endRef: string | null
  quote: { exact: string; prefix: string; suffix: string } | null
  textHash: string | null
  node: { slug: string; title: string } | null
}

export interface NoteRecord {
  id: string
  type: RecordType
  anchor: Anchor
  title: string
  body: string
  tags: string[]
  links: string[]
  createdAt: string
  updatedAt: string
  hlc: string
  vv: VersionVector
  author: string
  deleted: boolean
  /** 本程式看不懂的欄位原樣保留，寫回時不遺失（03 §4.7）。 */
  [extra: string]: unknown
}

export interface ShardFile {
  schema: number
  kind: "shard"
  app: string
  shard: string
  device: string
  writtenAt: string
  records: NoteRecord[]
  [extra: string]: unknown
}

export function chapterAnchor(book: string, chapter: number, verseStart: number | null = null, verseEnd: number | null = null): Anchor {
  return {
    kind: "chapter",
    ref: `${book}.${chapter}`,
    book,
    chapter,
    verseStart,
    verseEnd,
    endRef: null,
    quote: null,
    textHash: null,
    node: null,
  }
}

/** 紀錄屬於哪個分片：經文錨點用書卷代碼，其餘用保留鍵。 */
export function shardOf(record: Pick<NoteRecord, "anchor">): string {
  const a = record.anchor
  if (a.book && bookByCode(a.book)) return a.book
  if (a.kind === "node") return "_NODE"
  return "_FREE"
}

/** 從內文抽出 [[連結]] 目標（衍生資料）。 */
export function extractLinks(body: string): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(/\[\[([^\]|#\n]+)(?:[#|][^\]\n]*)?\]\]/g)) {
    const target = m[1].trim()
    if (target) out.add(target)
  }
  return [...out]
}

function isStr(v: unknown): v is string {
  return typeof v === "string"
}

function isIntOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isInteger(v))
}

function validAnchor(a: unknown): a is Anchor {
  if (!a || typeof a !== "object") return false
  const x = a as Record<string, unknown>
  if (!["chapter", "verse", "node", "free"].includes(x.kind as string)) return false
  if (!(x.ref === null || isStr(x.ref))) return false
  if (!(x.book === null || isStr(x.book))) return false
  if (!isIntOrNull(x.chapter) || !isIntOrNull(x.verseStart) || !isIntOrNull(x.verseEnd)) return false
  return true
}

/** 驗證遠端或匯入的紀錄。不合格回傳 null（呼叫端略過，不讓壞資料污染本機）。 */
export function validateRecord(raw: unknown): NoteRecord | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (!isStr(r.id) || !NOTE_ID_PATTERN.test(r.id)) return null
  if (!isStr(r.type) || !RECORD_TYPE_PATTERN.test(r.type)) return null
  if (!validAnchor(r.anchor)) return null
  if (!isStr(r.title) || !isStr(r.body) || r.body.length > MAX_BODY_LENGTH * 2) return null
  if (!Array.isArray(r.tags) || !r.tags.every(isStr)) return null
  if (!Array.isArray(r.links) || !r.links.every(isStr)) return null
  if (!isStr(r.createdAt) || !isStr(r.updatedAt)) return null
  if (!isStr(r.hlc) || !parseHlc(r.hlc)) return null
  if (!isValidVv(r.vv) || Object.keys(r.vv).length === 0) return null
  if (!isStr(r.author)) return null
  if (typeof r.deleted !== "boolean") return null
  return r as NoteRecord
}

export type ShardValidation =
  | { ok: true; shard: ShardFile; skipped: number }
  | { ok: false; reason: "not-json" | "not-shard" | "newer-schema"; schema?: number }

export function validateShard(raw: unknown): ShardValidation {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not-json" }
  const s = raw as Record<string, unknown>
  if (s.kind !== "shard" || s.app !== APP_TAG || !isStr(s.shard) || !isStr(s.device) || !Array.isArray(s.records)) {
    return { ok: false, reason: "not-shard" }
  }
  if (typeof s.schema !== "number" || s.schema > SCHEMA_VERSION) {
    return { ok: false, reason: "newer-schema", schema: typeof s.schema === "number" ? s.schema : undefined }
  }
  if (!isValidShard(s.shard)) return { ok: false, reason: "not-shard" }
  const records: NoteRecord[] = []
  let skipped = 0
  for (const r of s.records) {
    const v = validateRecord(r)
    if (v) records.push(v)
    else skipped++
  }
  return { ok: true, shard: { ...(s as unknown as ShardFile), records }, skipped }
}

/** 兩個版本內容是否相同（用來判斷同時修改是否真的衝突）。 */
export function contentEquals(a: NoteRecord, b: NoteRecord): boolean {
  return (
    a.deleted === b.deleted &&
    a.title === b.title &&
    a.body === b.body &&
    a.type === b.type &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    JSON.stringify(a.anchor) === JSON.stringify(b.anchor)
  )
}
