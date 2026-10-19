import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import type { TokenResult } from "../src/client/auth/gis"
import type { BackupListing, DriveFilesLike } from "../src/client/adapter/driveFiles"
import { AdapterError, type AdapterErrorKind } from "../src/client/adapter/types"
import { NotesService } from "../src/client/features/notes/notes"
import { exportBackup } from "../src/client/repo/backup"
import { Repository } from "../src/client/repo/repository"
import { DriveBackup, type BackupWorkspace } from "../src/client/session/driveBackup"
import type { AccountInfo, KeyValueStore, TokenSource } from "../src/client/session/session"
import { NotesStore } from "../src/client/store/db"

// ---------- 測試替身 ----------

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.parse("2026-10-19T12:00:00.000Z")

const alice: AccountInfo = { permissionId: "perm-alice", email: "alice@example.com", displayName: "Alice" }
const bob: AccountInfo = { permissionId: "perm-bob", email: "bob@example.com", displayName: "Bob" }

/** 記錄所有呼叫、保存檔案（含建立時間與垃圾桶）；可指定哪個方法丟 AdapterError，或卡住等放行。 */
class FakeDrive implements DriveFilesLike {
  calls: string[] = []
  trashedIds: string[] = []
  /** 本站備份（listBackups 會回傳沒進垃圾桶的）。 */
  files: { id: string; name: string; createdTime: string; records: number; json: string; trashed: boolean }[] = []
  /** Drive 裡不是本站備份的檔案：listBackups 看不到，也絕對不能被動到。 */
  foreign = [
    { id: "foreign-photo", trashed: false },
    { id: "foreign-doc", trashed: false },
  ]
  failures: Partial<Record<string, AdapterError>> = {}
  gates: Partial<Record<string, Promise<void>>> = {}
  private seq = 0

  constructor(private readonly clock: { t: number }) {}

  failWith(method: string, kind: AdapterErrorKind): void {
    this.failures[method] = new AdapterError(kind, `${method} 失敗（${kind}）`)
  }

  countOf(method: string): number {
    return this.calls.filter((c) => c === method).length
  }

  /** 放一份既有的本站備份。 */
  seed(createdTime: number, records = 1, json = JSON.stringify({ records: [] })): string {
    const id = `seed-${++this.seq}`
    this.files.push({ id, name: id + ".json", createdTime: new Date(createdTime).toISOString(), records, json, trashed: false })
    return id
  }

  private live() {
    return this.files.filter((f) => !f.trashed)
  }

  private async enter(method: string): Promise<void> {
    this.calls.push(method)
    const gate = this.gates[method]
    if (gate) await gate
    const failure = this.failures[method]
    if (failure) throw failure
  }

  async ensureFolder(): Promise<string> {
    await this.enter("ensureFolder")
    return "folder-1"
  }

  async listBackups(): Promise<BackupListing[]> {
    await this.enter("listBackups")
    return this.live()
      .map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime, records: f.records }))
      .sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime))
  }

  async createBackup(_folderId: string, name: string, json: string, records: number): Promise<string> {
    await this.enter("createBackup")
    const id = `new-${++this.seq}`
    this.files.push({ id, name, createdTime: new Date(this.clock.t).toISOString(), records, json, trashed: false })
    return id
  }

  async trash(fileId: string): Promise<void> {
    await this.enter("trash")
    // 和真正的 DriveFiles 一樣：只認本站備份，其他 ID 一律拒絕
    const file = this.live().find((f) => f.id === fileId)
    if (!file) throw new AdapterError("notFound", "找不到本站建立的備份檔")
    file.trashed = true
    this.trashedIds.push(fileId)
  }

  async read(fileId: string): Promise<string> {
    await this.enter("read")
    const file = this.live().find((f) => f.id === fileId)
    if (!file) throw new AdapterError("notFound", "找不到本站建立的備份檔")
    return file.json
  }
}

class FakeTokens implements TokenSource {
  ready = true
  requestBackupCalls = 0
  requestCalls = 0
  setOwnerCalls: string[] = []
  /** 要求備份權限時使用者的選擇：結果，以及是否真的勾了 drive.file。 */
  nextBackupResult: TokenResult = { ok: true }
  grantOnRequest = true
  private value: string | null = null
  private owner: string | null = null
  private granted = new Set<string>()

  constructor(opts: { token?: boolean; owner?: string; granted?: string[] } = {}) {
    if (opts.token ?? false) this.value = "token"
    this.owner = opts.owner ?? null
    for (const id of opts.granted ?? []) this.granted.add(id)
  }

  async prepare(): Promise<void> {}
  request(): Promise<TokenResult> {
    this.requestCalls++
    return Promise.resolve({ ok: true })
  }
  requestBackupScope(): Promise<TokenResult> {
    this.requestBackupCalls++
    const result = this.nextBackupResult
    if (result.ok || result.reason === "no-scope") {
      this.value = "token"
      this.owner = null // 新 token 還沒確認屬於誰
      if (this.grantOnRequest) this.pendingGrant = true
    }
    return Promise.resolve(result)
  }
  private pendingGrant = false
  hasBackupScope(pid: string): boolean {
    return this.granted.has(pid)
  }
  token() {
    return this.value
  }
  tokenFor(pid: string) {
    return this.owner === pid ? this.value : null
  }
  hasToken() {
    return this.value !== null
  }
  setOwner(pid: string) {
    this.setOwnerCalls.push(pid)
    this.owner = pid
    if (this.pendingGrant) this.granted.add(pid) // 使用者勾了 drive.file：這個帳號才算有權限
  }
  onChange() {
    return () => {}
  }
  rememberEmail() {}
  forgetEmail() {}
  clearCalls = 0
  clear() {
    this.clearCalls++
    this.value = null
    this.owner = null
  }
  async revoke() {}
}

class MapStorage implements KeyValueStore {
  map = new Map<string, string>()
  get(key: string) {
    return this.map.get(key) ?? null
  }
  set(key: string, value: string | null) {
    if (value === null) this.map.delete(key)
    else this.map.set(key, value)
  }
}

let seq = 0
async function makeWs(clock: { t: number }): Promise<BackupWorkspace & { notes: NotesService }> {
  const store = await NotesStore.open(`drive${++seq}`, new IDBFactory())
  const repo = await Repository.create({ store, now: () => clock.t })
  return { store, repo, notes: new NotesService(() => repo) }
}

async function addNote(ws: { notes: NotesService }, body: string, chapter = 1) {
  return ws.notes.create({ book: "GEN", chapter, verseStart: null, verseEnd: null, title: "", body, tags: [] })
}

interface WorldOptions {
  signedIn?: boolean
  /** 這個帳號已有 drive.file（兩個權限都有）。 */
  granted?: boolean
  /** token 已確認屬於這個帳號。 */
  tokenOwned?: boolean
}

async function world(opts: WorldOptions = {}) {
  const { signedIn = true, granted = true, tokenOwned = true } = opts
  const clock = { t: T0 }
  const drive = new FakeDrive(clock)
  const tokens = new FakeTokens({
    token: tokenOwned,
    owner: tokenOwned && signedIn ? alice.permissionId : undefined,
    granted: granted && signedIn ? [alice.permissionId] : [],
  })
  const storage = new MapStorage()
  const ws = await makeWs(clock)
  const cur: { account: AccountInfo | null; ws: BackupWorkspace } = { account: signedIn ? alice : null, ws }
  let identity = alice.permissionId
  const backup = new DriveBackup({
    current: () => cur,
    tokens,
    storage,
    createDriveFiles: () => drive,
    identifyToken: async () => ({ permissionId: identity }),
    now: () => clock.t,
  })
  const meta = (store: BackupWorkspace["store"], key: string) => store.getMeta<unknown>(key)
  return { clock, drive, tokens, storage, ws, cur, backup, meta, setIdentity: (id: string) => (identity = id) }
}

/** 一則在 daysAgo 天前建立（也是最後修改）的筆記；做完把時間拉回「現在」。 */
async function noteAged(w: Awaited<ReturnType<typeof world>>, daysAgo: number, body = "舊筆記", chapter = 1) {
  w.clock.t = T0 - daysAgo * DAY
  const note = await addNote(w.ws, body, chapter)
  w.clock.t = T0
  return note
}

// ---------- 案例 ----------

describe("存到 Google Drive：權限與上傳", () => {
  it("未登入：backupNow 回傳 signed-out，不呼叫 Drive；markDownloaded 後 lastBackup().kind 是 file", async () => {
    const w = await world({ signedIn: false })
    const result = await w.backup.backupNow(true)
    expect(result).toEqual({ ok: false, reason: "signed-out" })
    expect(w.drive.calls).toEqual([])
    expect(w.tokens.requestBackupCalls).toBe(0)

    await w.backup.markDownloaded()
    const last = await w.backup.lastBackup()
    expect(last.kind).toBe("file")
    expect(last.at).toBe(T0)
  })

  it("只有 appdata、從自動流程（fromClick=false）：回傳 no-scope，不呼叫 Drive、不申請權限", async () => {
    const w = await world({ granted: false })
    const result = await w.backup.backupNow(false)
    expect(result).toEqual({ ok: false, reason: "no-scope" })
    expect(w.drive.calls).toEqual([])
    expect(w.tokens.requestBackupCalls).toBe(0)
    expect(w.tokens.requestCalls).toBe(0)
  })

  it("從按鈕（fromClick=true）沒權限：同步呼叫 requestBackupScope；使用者沒勾 drive.file → no-scope，token 仍屬於這個帳號，沒有上傳", async () => {
    const w = await world({ granted: false, tokenOwned: false })
    w.tokens.nextBackupResult = { ok: true }
    w.tokens.grantOnRequest = false // 同意畫面沒勾 drive.file：token 只有 appdata

    const pending = w.backup.backupNow(true)
    // 還沒 await：必須已經在 click 的同步呼叫鏈內申請了權限（否則瀏覽器會擋彈出視窗）
    expect(w.tokens.requestBackupCalls).toBe(1)

    const result = await pending
    expect(result).toEqual({ ok: false, reason: "no-scope" })
    expect(w.tokens.setOwnerCalls).toEqual([alice.permissionId])
    expect(w.tokens.tokenFor(alice.permissionId)).toBe("token") // 原本的同步還能繼續用
    expect(w.drive.calls).toEqual([])
    expect(w.drive.files).toHaveLength(0)
  })

  it("兩個權限都有：上傳一份，內容的 records 數量等於 repo 的紀錄數，appProperties 的筆數正確；lastBackupAt＝now、kind＝drive、failures＝0", async () => {
    const w = await world()
    await addNote(w.ws, "一", 1)
    await addNote(w.ws, "二", 2)
    await addNote(w.ws, "三", 3)
    await w.ws.store.setMeta("backupFailures", 2)
    const expected = w.ws.repo.visible().length
    expect(expected).toBe(3)

    const result = await w.backup.backupNow(true)
    expect(result).toMatchObject({ ok: true, records: 3 })

    expect(w.drive.countOf("createBackup")).toBe(1)
    expect(w.drive.files).toHaveLength(1)
    const file = w.drive.files[0]
    expect(JSON.parse(file.json).records).toHaveLength(expected)
    expect(file.records).toBe(expected)
    expect(w.tokens.requestBackupCalls).toBe(0) // 已有權限就不再彈視窗

    const last = await w.backup.lastBackup()
    expect(last).toMatchObject({ at: T0, kind: "drive", failures: 0 })
  })

  it("已有 10 份本站備份＋這次 1 份：只把最舊的 1 份移到垃圾桶，Drive 裡其他不是本站備份的檔案不被動到", async () => {
    const w = await world()
    await addNote(w.ws, "內容")
    const ids: string[] = []
    for (let day = 1; day <= 10; day++) ids.push(w.drive.seed(T0 - day * DAY)) // ids[9] 是最舊的（10 天前）

    const result = await w.backup.backupNow(false)
    expect(result.ok).toBe(true)

    expect(w.drive.trashedIds).toEqual([ids[9]])
    expect(w.drive.countOf("trash")).toBe(1)
    expect(w.drive.files.filter((f) => !f.trashed)).toHaveLength(10)
    expect(w.drive.foreign.every((f) => !f.trashed)).toBe(true)
    // 沒有任何呼叫碰到非本站檔案：trash 只會收到清單裡的 ID
    expect(w.drive.trashedIds.some((id) => id.startsWith("foreign"))).toBe(false)
  })
})

describe("存到 Google Drive：還原", () => {
  it("還原：Drive 的備份含 2 筆、本機已有 1 筆不同紀錄 → 還原後 3 筆，原本那筆不變；同一份還原兩次不會重複", async () => {
    const w = await world()
    const other = await makeWs(w.clock)
    await addNote(other, "遠端一", 5)
    await addNote(other, "遠端二", 6)
    const json = JSON.stringify(exportBackup(other.repo))
    const backupId = w.drive.seed(T0 - DAY, 2, json)

    const mine = await addNote(w.ws, "本機原有", 1)
    const before = JSON.stringify(w.ws.repo.get(mine.id)!.winner)

    const first = await w.backup.restore(backupId)
    expect(first).toMatchObject({ added: 2, updated: 0, copied: 0, invalid: 0 })
    expect(w.ws.notes.all()).toHaveLength(3)
    expect(JSON.stringify(w.ws.repo.get(mine.id)!.winner)).toBe(before)
    expect(w.ws.repo.get(mine.id)!.winner.body).toBe("本機原有")

    const second = await w.backup.restore(backupId)
    expect(second.added).toBe(0)
    expect(second.copied).toBe(0)
    expect(w.ws.notes.all()).toHaveLength(3)
  })
})

describe("每週自動備份 autoBackupIfDue", () => {
  it("(a) 沒有 drive.file 權限 → 不呼叫 Drive", async () => {
    const w = await world({ granted: false })
    await noteAged(w, 20)
    await w.backup.autoBackupIfDue()
    expect(w.drive.calls).toEqual([])
    expect(w.tokens.requestBackupCalls).toBe(0)
  })

  it("(b) 上次備份 6 天前（之後有改過）→ 不備份", async () => {
    const w = await world()
    await noteAged(w, 2)
    await w.ws.store.setMeta("lastBackupAt", T0 - 6 * DAY)
    await w.ws.store.setMeta("lastBackupKind", "drive")
    await w.backup.autoBackupIfDue()
    expect(w.drive.calls).toEqual([])
  })

  it("(c) 8 天前備份、之後有改過 → 備份一次", async () => {
    const w = await world()
    await noteAged(w, 7)
    await w.ws.store.setMeta("lastBackupAt", T0 - 8 * DAY)
    await w.ws.store.setMeta("lastBackupKind", "drive")
    await w.backup.autoBackupIfDue()
    expect(w.drive.countOf("createBackup")).toBe(1)
    expect((await w.backup.lastBackup()).at).toBe(T0)
    // 馬上再檢查一次：剛備份過，不會重複
    await w.backup.autoBackupIfDue()
    expect(w.drive.countOf("createBackup")).toBe(1)
  })

  it("(d) 8 天前備份、之後沒改過 → 不備份", async () => {
    const w = await world()
    await noteAged(w, 9)
    await w.ws.store.setMeta("lastBackupAt", T0 - 8 * DAY)
    await w.ws.store.setMeta("lastBackupKind", "drive")
    await w.backup.autoBackupIfDue()
    expect(w.drive.countOf("createBackup")).toBe(0)
  })

  it("(e) 本機記錄 8 天前，但 Drive 上另一台裝置 1 天前剛備份 → 不備份，且 lastBackupAt 更新成那份的時間", async () => {
    const w = await world()
    await noteAged(w, 7)
    await w.ws.store.setMeta("lastBackupAt", T0 - 8 * DAY)
    await w.ws.store.setMeta("lastBackupKind", "file")
    w.drive.seed(T0 - DAY)
    w.drive.seed(T0 - 20 * DAY)

    await w.backup.autoBackupIfDue()
    expect(w.drive.countOf("createBackup")).toBe(0)
    const last = await w.backup.lastBackup()
    expect(last.at).toBe(T0 - DAY)
    expect(last.kind).toBe("drive")
  })

  it("(f) 這台裝置把自動備份關掉（setAutoEnabled(false)）→ 不備份", async () => {
    const w = await world()
    await noteAged(w, 7)
    await w.ws.store.setMeta("lastBackupAt", T0 - 8 * DAY)
    w.backup.setAutoEnabled(false)
    expect((await w.backup.lastBackup()).autoEnabled).toBe(false)
    await w.backup.autoBackupIfDue()
    expect(w.drive.calls).toEqual([])
  })

  it("(g) Drive 丟 network 錯誤：不丟例外、failures 加 1，連續 3 次後 reminder().failures 是 3", async () => {
    const w = await world()
    await noteAged(w, 7)
    await w.ws.store.setMeta("lastBackupAt", T0 - 8 * DAY)
    w.drive.failWith("createBackup", "network")

    for (let i = 1; i <= 3; i++) {
      await expect(w.backup.autoBackupIfDue()).resolves.toBeUndefined()
      expect((await w.backup.lastBackup()).failures).toBe(i)
    }
    expect((await w.backup.reminder()).failures).toBe(3)
    expect(w.drive.files).toHaveLength(0)
    expect((await w.backup.lastBackup()).at).toBe(T0 - 8 * DAY) // 失敗不算備份過
  })

  it("(g 補充) 連列出備份清單時就丟 network 錯誤：同樣不丟例外、failures 加 1", async () => {
    const w = await world()
    await noteAged(w, 7)
    await w.ws.store.setMeta("lastBackupAt", T0 - 8 * DAY)
    w.drive.failWith("listBackups", "network")
    const warn = console.warn
    console.warn = () => {}
    try {
      await expect(w.backup.autoBackupIfDue()).resolves.toBeUndefined()
    } finally {
      console.warn = warn
    }
    expect((await w.backup.lastBackup()).failures).toBe(1)
    expect(w.drive.countOf("createBackup")).toBe(0)
  })
})

describe("同時與切換", () => {
  it("同一時間按兩次 backupNow：只上傳一次，第二次拿到同一個 Promise", async () => {
    const w = await world()
    await addNote(w.ws, "內容")
    let release!: () => void
    w.drive.gates.createBackup = new Promise<void>((resolve) => (release = resolve))

    const first = w.backup.backupNow(true)
    const second = w.backup.backupNow(true)
    expect(second).toBe(first)
    release()
    const [a, b] = await Promise.all([first, second])
    expect(a).toEqual(b)
    expect(w.drive.countOf("createBackup")).toBe(1)
    expect(w.drive.files).toHaveLength(1)

    // 做完之後可以再按（不是永遠卡住）
    w.clock.t = T0 + 1000
    await w.backup.backupNow(true)
    expect(w.drive.countOf("createBackup")).toBe(2)
  })

  it("切換工作區：備份進行中 current() 換成另一個帳號的 ws → 結果不會寫到新的 ws 的 meta", async () => {
    const w = await world()
    await addNote(w.ws, "內容")
    const other = await makeWs(w.clock)
    let release!: () => void
    w.drive.gates.ensureFolder = new Promise<void>((resolve) => (release = resolve))

    const pending = w.backup.backupNow(false)
    expect(w.drive.countOf("ensureFolder")).toBe(1) // 已經在 Drive 那一步卡住
    w.cur.account = bob
    w.cur.ws = other // 使用者這時切換到另一個帳號
    release()
    await pending

    expect(await w.meta(other.store, "lastBackupAt")).toBeUndefined()
    expect(await w.meta(other.store, "lastBackupKind")).toBeUndefined()
    expect(await w.meta(other.store, "backupFailures")).toBeUndefined()
  })
})

describe("備份提醒 reminder", () => {
  it("從沒備份、最早紀錄 10 天前 → 不提醒", async () => {
    const w = await world({ granted: false })
    await noteAged(w, 10)
    const r = await w.backup.reminder()
    expect(r.show).toBe(false)
    expect(r.daysSince).toBeNull()
  })

  it("從沒備份、最早紀錄 31 天前 → 提醒", async () => {
    const w = await world({ granted: false })
    await noteAged(w, 31)
    expect((await w.backup.reminder()).show).toBe(true)
  })

  it("未登入、最早紀錄 31 天前 → 也提醒", async () => {
    const w = await world({ signedIn: false })
    await noteAged(w, 31)
    expect((await w.backup.reminder()).show).toBe(true)
  })

  it("snoozeReminder() 後 7 天內不提醒", async () => {
    const w = await world({ granted: false })
    await noteAged(w, 31)
    expect((await w.backup.reminder()).show).toBe(true)
    w.backup.snoozeReminder()
    expect((await w.backup.reminder()).show).toBe(false)
    w.clock.t = T0 + 6 * DAY
    expect((await w.backup.reminder()).show).toBe(false)
    w.clock.t = T0 + 8 * DAY
    expect((await w.backup.reminder()).show).toBe(true)
  })

  it("自動備份開著且權限正常、失敗 < 3 → 不提醒；失敗到 3 次或關掉自動備份 → 提醒", async () => {
    const w = await world()
    await noteAged(w, 60)
    expect((await w.backup.reminder()).show).toBe(false)
    await w.ws.store.setMeta("backupFailures", 2)
    expect((await w.backup.reminder()).show).toBe(false)
    await w.ws.store.setMeta("backupFailures", 3)
    expect((await w.backup.reminder()).show).toBe(true)
    await w.ws.store.setMeta("backupFailures", 0)
    w.backup.setAutoEnabled(false)
    expect((await w.backup.reminder()).show).toBe(true)
  })

  it("下載過備份檔（markDownloaded）也算備份：之後沒改過就不提醒", async () => {
    const w = await world({ granted: false })
    await noteAged(w, 40)
    expect((await w.backup.reminder()).show).toBe(true)
    await w.backup.markDownloaded()
    const r = await w.backup.reminder()
    expect(r.show).toBe(false)
    expect(r.daysSince).toBe(0)
  })
})

describe("Gemini 審查 F3a 的修正", () => {
  it("#3 新備份上傳成功但移舊備份到垃圾桶失敗：這次仍算成功、記錄時間、不累計失敗", async () => {
    const w = await world()
    await addNote(w.ws, "內容")
    for (let day = 1; day <= 10; day++) w.drive.seed(T0 - day * DAY)
    w.drive.failWith("trash", "network")
    const result = await w.backup.backupNow(false)
    expect(result.ok).toBe(true)
    expect(await w.meta(w.ws.store, "lastBackupAt")).toBe(T0)
    expect((await w.backup.lastBackup()).failures).toBe(0)
  })

  it("#2 在 Google 視窗選了別的帳號：回傳 auth，並丟掉那個 token（不會卡住目前帳號的同步）", async () => {
    const w = await world({ granted: false })
    w.setIdentity("someone-else")
    const result = await w.backup.backupNow(true)
    expect(result).toEqual({ ok: false, reason: "auth" })
    expect(w.tokens.clearCalls).toBe(1)
    expect(w.tokens.setOwnerCalls).toEqual([])
    expect(w.drive.countOf("createBackup")).toBe(0)
  })

  it("#6 帳號 A 備份進行中切到帳號 B：B 按備份不會拿到 A 的結果", async () => {
    const w = await world()
    await addNote(w.ws, "A 的筆記")
    let release!: () => void
    w.drive.gates.createBackup = new Promise<void>((r) => (release = r))
    const a = w.backup.backupNow(false)
    w.cur.account = { ...alice, permissionId: "bob", email: "b@example.com", displayName: "B" }
    const b = w.backup.backupNow(false)
    expect(b).not.toBe(a)
    expect((await b).ok).toBe(false) // B 沒有 drive.file
    release()
    expect((await a).ok).toBe(true)
  })

  it("D-50 刪除全部筆記時勾了一起刪：只把本站備份移到垃圾桶，其他檔案不動", async () => {
    const w = await world()
    w.drive.seed(T0 - DAY)
    w.drive.seed(T0 - 2 * DAY)
    expect(await w.backup.trashAllBackups()).toBe(2)
    expect(w.drive.files.every((f) => f.trashed)).toBe(true)
    expect(w.drive.foreign.every((f) => !f.trashed)).toBe(true)
  })
})
