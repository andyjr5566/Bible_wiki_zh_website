import { describe, expect, it } from "vitest"
import { backupsToTrash, dueForAutoBackup, needsReminder } from "../src/client/model/backupPolicy"

const DAY = 24 * 60 * 60 * 1000
const NOW = 100 * DAY

describe("備份時機", () => {
  it("剛好七天到期，六天二十三小時未到期", () => {
    const base = { now: NOW, lastChangeAt: NOW - DAY, autoEnabled: true, granted: true }
    expect(dueForAutoBackup({ ...base, lastBackupAt: NOW - 7 * DAY })).toBe(true)
    expect(dueForAutoBackup({ ...base, lastBackupAt: NOW - 6 * DAY - 23 * 60 * 60 * 1000 })).toBe(false)
  })

  it("從未備份且有紀錄時到期；沒改過或沒有權限時不到期", () => {
    expect(dueForAutoBackup({ now: NOW, lastBackupAt: null, lastChangeAt: NOW - DAY, autoEnabled: true, granted: true })).toBe(true)
    expect(dueForAutoBackup({ now: NOW, lastBackupAt: null, lastChangeAt: null, autoEnabled: true, granted: true })).toBe(false)
    expect(dueForAutoBackup({ now: NOW, lastBackupAt: NOW - 8 * DAY, lastChangeAt: NOW - 9 * DAY, autoEnabled: true, granted: true })).toBe(false)
    expect(dueForAutoBackup({ now: NOW, lastBackupAt: null, lastChangeAt: NOW, autoEnabled: true, granted: false })).toBe(false)
  })
})

describe("備份提醒", () => {
  const base = { now: NOW, lastBackupAt: NOW - 30 * DAY, lastChangeAt: NOW - DAY, autoHealthy: false, snoozedUntil: null }

  it("三十天且有修改時提醒", () => {
    expect(needsReminder(base)).toBe(true)
    expect(needsReminder({ ...base, lastChangeAt: NOW - 31 * DAY })).toBe(false)
  })

  it("之後再說及正常運作的自動備份不提醒", () => {
    expect(needsReminder({ ...base, snoozedUntil: NOW + DAY })).toBe(false)
    expect(needsReminder({ ...base, autoHealthy: true })).toBe(false)
  })

  it("新使用者從最早紀錄起算，第一天不提醒", () => {
    expect(needsReminder({ ...base, lastBackupAt: null, firstRecordAt: NOW - DAY })).toBe(false)
    expect(needsReminder({ ...base, lastBackupAt: null, firstRecordAt: NOW - 30 * DAY })).toBe(true)
    expect(needsReminder({ ...base, lastBackupAt: null, firstRecordAt: undefined, lastChangeAt: NOW - DAY })).toBe(false)
  })
})

it("只修剪依建立時間排序後第十一份起的備份", () => {
  const list = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    createdTime: new Date(NOW - i * DAY).toISOString(),
  })).reverse()
  expect(backupsToTrash(list)).toEqual(["10", "11"])
  expect(list[0].id).toBe("11")
})
