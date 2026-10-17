// 合併規則（03 §4.4、§4.5，D-26）。純函式，不做任何 I/O。
//
// 1. 同一 hlc 視為同一版本（同一版本可能同時出現在本機與遠端快取）。
// 2. 被取代：存在 X 使 V.vv ≤ X.vv 且 X ≠ V → 丟棄 V。
// 3. 剩下的是同時修改的「前緣」：hlc 最大者勝出、顯示在畫面上。
// 4. 前緣中內容與勝出者不同的版本 → 衝突，交給使用者選。

import { compareHlc } from "../model/hlc"
import { contentEquals, type NoteRecord } from "../model/record"
import { vvDominatedBy, vvIncrement, vvMax, type VersionVector } from "../model/vv"

export interface Resolved {
  id: string
  winner: NoteRecord
  /** 與勝出者同時修改、內容不同的版本（依 hlc 由新到舊）。 */
  conflicts: NoteRecord[]
  /** 前緣所有版本 vv 的逐項最大值（解決衝突時的新版本以此為基礎）。 */
  frontierVv: VersionVector
}

function canonicalVv(vv: Record<string, number>): string {
  return Object.keys(vv)
    .sort()
    .filter((k) => vv[k] > 0)
    .map((k) => `${k}=${vv[k]}`)
    .join(",")
}

/** 版本身分：hlc＋vv＋內容。只有三者都相同才視為同一版本（Codex 審查 #4、#6）。 */
function versionKey(v: NoteRecord): string {
  return [v.hlc, canonicalVv(v.vv), v.deleted, v.type, v.title, v.body, JSON.stringify(v.tags), JSON.stringify(v.anchor)].join("\u0000")
}

function dedupe(versions: NoteRecord[]): NoteRecord[] {
  const byKey = new Map<string, NoteRecord>()
  for (const v of versions) {
    const k = versionKey(v)
    if (!byKey.has(k)) byKey.set(k, v)
  }
  return [...byKey.values()]
}

/** 排序：hlc 大者在前；hlc 相同（異常）時以版本身分排序，確保各裝置結果一致。 */
function newestFirst(a: NoteRecord, b: NoteRecord): number {
  const c = compareHlc(b.hlc, a.hlc)
  if (c !== 0) return c
  const ka = versionKey(a)
  const kb = versionKey(b)
  return ka < kb ? 1 : ka > kb ? -1 : 0
}

export function frontier(versions: NoteRecord[]): NoteRecord[] {
  const unique = dedupe(versions)
  return unique.filter((v) => !unique.some((x) => x !== v && vvDominatedBy(v.vv, x.vv)))
}

/** 解出一則筆記的勝出版本與衝突。versions 須為同一 id。 */
export function resolveVersions(versions: NoteRecord[]): Resolved | null {
  if (versions.length === 0) return null
  const front = frontier(versions)
  const sorted = [...front].sort(newestFirst)
  const winner = sorted[0]
  const conflicts = sorted.slice(1).filter((v) => !contentEquals(v, winner))
  return {
    id: winner.id,
    winner,
    conflicts,
    frontierVv: vvMax(...front.map((v) => v.vv)),
  }
}

/** 把所有來源的版本依 id 分組並解出結果。 */
export function resolveAll(versions: Iterable<NoteRecord>): Map<string, Resolved> {
  const byId = new Map<string, NoteRecord[]>()
  for (const v of versions) {
    const list = byId.get(v.id)
    if (list) list.push(v)
    else byId.set(v.id, [v])
  }
  const out = new Map<string, Resolved>()
  for (const [id, list] of byId) {
    const r = resolveVersions(list)
    if (r) out.set(id, r)
  }
  return out
}

/**
 * 新版本的 vv：以「前緣最大值」為基礎，本裝置那一項設為 max(原值 + 1, stamp)。
 *
 * - 不提供「只以勝出版本為基礎」的選項：那樣會讓本裝置計數倒退，造成①默默取代自己先前的
 *   衝突版本、②第三台裝置的版本被誤判為看過它。有衝突的筆記必須先選定版本（03 §4.4），
 *   引擎層也會拒絕一般編輯（Codex 審查 #3）。
 * - stamp 傳入目前時間（毫秒）：即使本機資料從舊備份還原，計數也不會重複使用（Codex 審查 #5）。
 */
export function nextVv(resolved: Resolved | null, device: string, stamp = 0): VersionVector {
  const base = resolved ? resolved.frontierVv : {}
  const next = vvIncrement(base, device)
  if (stamp > next[device]) next[device] = Math.floor(stamp)
  return next
}

export const TOMBSTONE_TTL_MS = 365 * 24 * 60 * 60 * 1000

/**
 * 修剪本裝置分片（03 §4.5）。
 * - 已被「遠端」版本取代的本機版本可以移除（取代者保存在對方分片，仍會被所有裝置看到）。
 *   只看遠端版本：本機尚未上傳的版本不算數。
 * - 墓碑超過保存期限、且遠端已沒有同 id 的任何版本，才移除（避免舊版本復活）。
 */
export function pruneOwn(own: NoteRecord[], remote: NoteRecord[], now: number, tombstoneTtlMs = TOMBSTONE_TTL_MS): NoteRecord[] {
  const remoteById = new Map<string, NoteRecord[]>()
  for (const r of remote) {
    const list = remoteById.get(r.id)
    if (list) list.push(r)
    else remoteById.set(r.id, [r])
  }
  const ownById = new Map<string, NoteRecord[]>()
  for (const v of own) {
    const list = ownById.get(v.id)
    if (list) list.push(v)
    else ownById.set(v.id, [v])
  }
  return own.filter((v) => {
    const others = (remoteById.get(v.id) ?? []).filter((x) => x !== v)
    // 只有被「遠端」版本取代才能移除（取代者在對方分片中，所有裝置都看得到）
    if (others.some((x) => vvDominatedBy(v.vv, x.vv))) return false
    // 防呆：本機同 id 不應有多個版本；若有，被本機較新版本取代者也可移除
    const ownOthers = (ownById.get(v.id) ?? []).filter((x) => x !== v)
    if (ownOthers.some((x) => vvDominatedBy(v.vv, x.vv))) return false
    if (v.deleted && others.length === 0 && ownOthers.length === 0) {
      const age = now - Date.parse(v.updatedAt)
      if (Number.isFinite(age) && age > tombstoneTtlMs) return false
    }
    return true
  })
}
