// 下載 JSON 備份檔（「匯出備份」與備份提醒共用，D-45）：下載後記錄時間，備份提醒才知道多久沒備份。

import type { Session } from "../session/session"
import { exportBackup } from "../repo/backup"
import { h, toast } from "./dom"

/** 下載一份 JSON 筆記備份，並記錄這次下載時間。 */
export async function downloadBackupFile(session: Session): Promise<void> {
  const data = exportBackup(session.repo)
  if (data.records.length === 0) {
    toast("目前沒有筆記可以匯出")
    return
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = h("a", { attrs: { href: url, download: `聖經筆記備份-${new Date().toISOString().slice(0, 10)}.json`, "data-router-ignore": true } })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await session.markDownloaded()
  toast(`已匯出 ${data.records.length} 則筆記`)
}
