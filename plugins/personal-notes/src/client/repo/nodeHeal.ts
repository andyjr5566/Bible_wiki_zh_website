// 掛在知識庫條目上的紀錄（條目書籤，以及之後的條目筆記）在條目搬移或改名後找回（D-46、13 §3.3）。
// 比對規則在 model/nodeLocate.ts；這裡負責挑出紀錄、把找到新網址的紀錄改過去（照一般修改流程，會同步）。

import type { Resolved } from "../merge/merge"
import type { LinkPage } from "../model/linkIndex"
import { relocateAll, type Relocation } from "../model/nodeLocate"
import type { Repository } from "./repository"

/** 所有掛在條目上的紀錄（不分種類）。 */
export function nodeRecords(repo: Repository): Resolved[] {
  return repo.visible().filter((r) => r.winner.anchor.kind === "node" && !!r.winner.anchor.node?.slug)
}

/** 每筆條目紀錄現在應該連到哪裡（id → 結果）。 */
export function locateNodeRecords(records: Resolved[], pages: LinkPage[]): Map<string, Relocation> {
  const refs = records.map((r) => ({ id: r.id, slug: r.winner.anchor.node!.slug, title: r.winner.anchor.node!.title }))
  const found = relocateAll(refs, pages)
  return new Map(refs.map((ref) => [ref.id, found.get(ref)!]))
}

/** 舊網址已失效、而且找回的就是這一頁的紀錄 id。 */
export function movedHere(records: Resolved[], pages: LinkPage[], slug: string): string[] {
  return [...locateNodeRecords(records, pages)].filter(([, loc]) => loc.kind === "moved" && loc.slug === slug).map(([id]) => id)
}

/** 把「應該就是這一頁」的條目紀錄改到這一頁的網址與標題；有衝突待選的先不動。回傳改了幾筆。 */
export async function healNodeRecords(repo: Repository, pages: LinkPage[], here: { slug: string; title: string }): Promise<number> {
  let healed = 0
  for (const id of movedHere(nodeRecords(repo), pages, here.slug)) {
    const r = repo.get(id)
    if (!r || r.conflicts.length > 0) continue
    await repo.withCas(async () => {
      const cur = repo.editable(id)
      return repo.replace(repo.revise(cur, { anchor: { ...cur.winner.anchor, node: { slug: here.slug, title: here.title } } }))
    })
    healed++
  }
  return healed
}
