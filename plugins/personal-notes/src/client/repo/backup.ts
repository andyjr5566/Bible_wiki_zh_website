// 匯出／匯入／認領未登入時的紀錄（03 §4.7、D-05）。與紀錄種類無關，全部走正常的合併規則。

import { APP_TAG, SCHEMA_VERSION, validateRecord, type NoteRecord } from "../model/record"
import { vvDominatedBy, vvIncrement, vvLeq, vvMax } from "../model/vv"
import type { CommitEntry, Repository } from "./repository"

export interface BackupFile {
  app: string
  schema: number
  exportedAt: string
  records: NoteRecord[]
}

export interface ImportResult {
  added: number
  updated: number
  copied: number
  skipped: number
  invalid: number
}

/** 匯出目前看得到的所有版本（含待選定的衝突版本）。 */
export function exportBackup(repo: Repository): BackupFile {
  const records: NoteRecord[] = []
  for (const r of repo.visible()) {
    if (!r.winner.deleted) records.push(r.winner)
    records.push(...r.conflicts.filter((c) => !c.deleted))
  }
  return { app: APP_TAG, schema: SCHEMA_VERSION, exportedAt: repo.iso(), records }
}

/**
 * 匯入（重複匯入無害）：
 * - 新紀錄 → 原樣加入；
 * - 已有且匯入版本已被看過 → 略過；
 * - 匯入版本較新（看過目前所有版本）→ 成為新版本；
 * - 同時修改 → 另存為新紀錄，標題加「（匯入）」，不覆蓋現有內容。
 */
export async function importBackup(repo: Repository, data: unknown): Promise<ImportResult> {
  const list = (data as { records?: unknown[] })?.records
  if (!Array.isArray(list)) throw new Error("不是本站匯出的筆記檔")
  const result: ImportResult = { added: 0, updated: 0, copied: 0, skipped: 0, invalid: 0 }
  const entries: CommitEntry[] = []
  for (const raw of list) {
    const r = validateRecord(raw)
    if (!r) {
      result.invalid++
      continue
    }
    repo.observe(r.hlc)
    const current = repo.get(r.id)
    const previous = repo.ownRecord(r.id)
    if (!current) {
      entries.push({ record: r, expectedHlc: previous?.hlc ?? null, previous })
      result.added++
      continue
    }
    const front = [current.winner, ...current.conflicts]
    if (front.some((v) => vvLeq(r.vv, v.vv))) {
      result.skipped++
      continue
    }
    if (front.every((v) => vvDominatedBy(v.vv, r.vv))) {
      const hlc = repo.tick()
      const vv = vvMax(current.frontierVv, r.vv)
      const me = repo.deviceId
      entries.push({
        record: { ...r, hlc, vv: { ...vvIncrement(vv, me), [me]: Math.max((vv[me] ?? 0) + 1, repo.stampOf(hlc)) }, author: me, updatedAt: repo.iso() },
        expectedHlc: previous?.hlc ?? null,
        previous,
      })
      result.updated++
    } else {
      entries.push({ record: repo.copyAsNew(r, "（匯入）"), expectedHlc: null, previous: undefined })
      result.copied++
    }
  }
  if (entries.length > 0) await repo.withCas(() => repo.commit(entries))
  return result
}

/**
 * 把未登入時寫的紀錄加入此帳號（D-05）。規則同匯入：同 id 且內容不同時另存，不丟棄（Codex 審查 #6）。
 * 回傳加入（含更新、另存）的筆數；呼叫端在此函式成功後才可清除匿名資料。
 */
export async function adoptRecords(repo: Repository, records: NoteRecord[]): Promise<number> {
  const live = records.filter((r) => !r.deleted)
  if (live.length === 0) return 0
  const r = await importBackup(repo, { records: live })
  return r.added + r.updated + r.copied
}
