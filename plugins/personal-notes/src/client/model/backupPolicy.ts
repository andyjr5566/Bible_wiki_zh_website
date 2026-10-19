export const AUTO_BACKUP_DAYS = 7
export const REMIND_DAYS = 30
export const KEEP_BACKUPS = 10

const DAY_MS = 24 * 60 * 60 * 1000

export interface AutoBackupState {
  lastBackupAt: number | null
  lastChangeAt: number | null
  now: number
  autoEnabled: boolean
  granted: boolean
}

export function dueForAutoBackup(state: AutoBackupState): boolean {
  if (!state.autoEnabled || !state.granted || state.lastChangeAt === null) return false
  if (state.lastBackupAt === null) return true
  return state.now - state.lastBackupAt >= AUTO_BACKUP_DAYS * DAY_MS && state.lastChangeAt > state.lastBackupAt
}

export interface ReminderState {
  lastBackupAt: number | null
  lastChangeAt: number | null
  /** 從未備份時優先以最早紀錄起算。 */
  firstRecordAt?: number | null
  now: number
  autoHealthy: boolean
  snoozedUntil: number | null
}

export function needsReminder(state: ReminderState): boolean {
  if (state.autoHealthy || state.lastChangeAt === null) return false
  if (state.snoozedUntil !== null && state.now < state.snoozedUntil) return false
  const anchor = state.lastBackupAt ?? state.firstRecordAt ?? state.lastChangeAt
  if (state.now - anchor < REMIND_DAYS * DAY_MS) return false
  return state.lastBackupAt === null || state.lastChangeAt > state.lastBackupAt
}

export function backupsToTrash<T extends { id: string; createdTime: string }>(
  list: readonly T[],
  keep = KEEP_BACKUPS,
): string[] {
  return [...list]
    .sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime))
    .slice(Math.max(0, keep))
    .map((backup) => backup.id)
}
