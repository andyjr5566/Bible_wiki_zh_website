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

function isCopyOf(copy: NoteRecord, version: NoteRecord): boolean {
  const from = copy.copiedFrom as { id?: string; hlc?: string } | undefined
  return from?.id === version.id && from.hlc === version.hlc
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
 * - 同時修改 → 另存為新紀錄，標題加「（匯入）」，不覆蓋現有內容；已另存過的版本略過（copiedFrom）。
 */
export async function importBackup(repo: Repository, data: unknown): Promise<ImportResult> {
  const list = (data as { records?: unknown[] })?.records
  if (!Array.isArray(list)) throw new Error("不是本站匯出的筆記檔")
  const result: ImportResult = { added: 0, updated: 0, copied: 0, skipped: 0, invalid: 0 }
  // 每個 id 在這次匯入中最多寫一次：備份檔裡同一則可能有多個版本（勝出版本＋衝突版本），
  // 後面的版本要和「已決定要寫入的」一起比較，否則會互相覆蓋（Codex 重構審查 B1）。
  const byId = new Map<string, CommitEntry>()
  const copies: CommitEntry[] = []
  for (const raw of list) {
    const r = validateRecord(raw)
    if (!r) {
      result.invalid++
      continue
    }
    repo.observe(r.hlc)
    const current = repo.get(r.id)
    const previous = repo.ownRecord(r.id)
    const planned = byId.get(r.id)
    const front = [...(current ? [current.winner, ...current.conflicts] : []), ...(planned ? [planned.record] : [])]
    if (front.length === 0) {
      byId.set(r.id, { record: r, expectedHlc: previous?.hlc ?? null, previous })
      result.added++
      continue
    }
    if (front.some((v) => vvLeq(r.vv, v.vv))) {
      result.skipped++
      continue
    }
    if (front.every((v) => vvDominatedBy(v.vv, r.vv))) {
      // 比目前所有版本（含本次已決定寫入的）都新：取代
      let record = r
      if (current) {
        const hlc = repo.tick()
        const vv = vvMax(current.frontierVv, r.vv)
        const me = repo.deviceId
        record = { ...r, hlc, vv: { ...vvIncrement(vv, me), [me]: Math.max((vv[me] ?? 0) + 1, repo.stampOf(hlc)) }, author: me, updatedAt: repo.iso() }
      }
      if (!planned) result.updated++
      byId.set(r.id, { record, expectedHlc: previous?.hlc ?? null, previous })
    } else if (repo.hasCopyOf(r) || copies.some((c) => isCopyOf(c.record, r))) {
      result.skipped++ // 先前匯入時已另存過這個版本
    } else {
      copies.push({ record: repo.copyAsNew(r, "（匯入）"), expectedHlc: null, previous: undefined })
      result.copied++
    }
  }
  const entries = [...byId.values(), ...copies]
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
