import { describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import type { TokenResult } from "../src/client/auth/gis"
import { MemoryAdapter, MemoryCloud } from "../src/client/adapter/memory"
import { AdapterError, type SyncAdapter } from "../src/client/adapter/types"
import { NotesService } from "../src/client/features/notes/notes"
import type { Notice, Prompts } from "../src/client/session/prompts"
import { Session, type SessionDeps, type TokenSource } from "../src/client/session/session"
import { ANON_DB, NotesStore, accountDbName } from "../src/client/store/db"

// ---------- 測試替身 ----------

class FakeTokens implements TokenSource {
  ready = false
  prepareCalls = 0
  requestCalls = 0
  failPrepare = false
  nextResult: TokenResult = { ok: true }
  private value: string | null = null
  private owner: string | null = null
  private listeners = new Set<() => void>()

  async prepare(): Promise<void> {
    this.prepareCalls++
    if (this.failPrepare) throw new Error("無法載入")
    this.ready = true
  }
  request(): Promise<TokenResult> {
    this.requestCalls++
    if (this.nextResult.ok) {
      this.value = "token"
      this.owner = null
      this.emit()
    }
    return Promise.resolve(this.nextResult)
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
    this.owner = pid
    this.emit()
  }
  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  forgotEmail = 0
  rememberEmail() {}
  forgetEmail() {
    this.forgotEmail++
  }
  clear() {
    this.value = null
    this.owner = null
    this.emit()
  }
  async revoke() {
    this.clear()
  }
  /** 模擬授權一小時到期。 */
  expire() {
    this.value = null
    this.emit()
  }
  private emit() {
    for (const fn of this.listeners) fn()
  }
}

class FakePrompts implements Prompts {
  asked: string[] = []
  notices: Notice[] = []
  answers = {
    explain: true,
    adopt: true,
    reconnect: "connect" as "connect" | "offline" | "cancel",
    offline: "ok" as "ok" | "retry" | "cancel",
    signOut: "keep" as "keep" | "clear" | null,
  }
  async explainSignIn(googleReady: Promise<void>, start: () => void) {
    this.asked.push("explain")
    try {
      await googleReady
    } catch {
      return false // 載入失敗時「繼續」不能按，使用者只能取消
    }
    if (this.answers.explain) start()
    return this.answers.explain
  }
  async inAppBrowser() {
    this.asked.push("in-app")
  }
  async adoptAnonymous(count: number) {
    this.asked.push(`adopt:${count}`)
    return this.answers.adopt
  }
  async reconnectBeforeEdit(start: () => void) {
    this.asked.push("reconnect")
    if (this.answers.reconnect === "connect") start()
    return this.answers.reconnect
  }
  async offline() {
    this.asked.push("offline")
    return this.answers.offline
  }
  async signOut() {
    this.asked.push("sign-out")
    return this.answers.signOut
  }
  async disconnect(opts: { canRevoke: boolean; hasUnsyncedChanges: boolean }) {
    this.asked.push(`disconnect:${opts.canRevoke}`)
    return true
  }
  async deleteAll() {
    this.asked.push("delete-all")
    return true
  }
  async reupload() {
    return true
  }
  notify(n: Notice) {
    this.notices.push(n)
  }
}

/** 沒有（屬於這個帳號的）token 就回 401，模擬 Drive 的行為。 */
function guarded(inner: SyncAdapter, getToken: () => string | null): SyncAdapter {
  return new Proxy(inner, {
    get(target, prop) {
      const v = (target as unknown as Record<string | symbol, unknown>)[prop]
      if (typeof v !== "function") return v
      return (...args: unknown[]) => (getToken() ? v.apply(target, args) : Promise.reject(new AdapterError("auth", "no token", 401)))
    },
  })
}

function env(opts: { cloud?: MemoryCloud; inAppBrowser?: string } = {}) {
  const cloud = opts.cloud ?? new MemoryCloud()
  const factory = new IDBFactory()
  const storage = new Map<string, string>()
  const tokens = new FakeTokens()
  const prompts = new FakePrompts()
  const clock = { t: Date.parse("2026-10-18T00:00:00.000Z") }
  const deps: SessionDeps = {
    config: { clientId: "test", syncEnabled: true, minPollSeconds: 180, maxWritesPerMinute: 1000, notice: "", appVersion: "t" },
    prompts,
    tokens,
    inAppBrowser: opts.inAppBrowser ?? null,
    deviceLabel: "測試裝置",
    storage: { get: (k) => storage.get(k) ?? null, set: (k, v) => void (v === null ? storage.delete(k) : storage.set(k, v)) },
    openStore: (name) => NotesStore.open(name, factory),
    deleteStore: (name) => NotesStore.deleteDatabase(name, factory),
    createAdapter: (getToken) => guarded(new MemoryAdapter(cloud), getToken),
    createScheduler: ({ syncer }) => ({ start() {}, stop() {}, syncNow: () => syncer.sync(), withLock: (fn) => fn(), broadcastChanged() {} }),
    now: () => clock.t,
  }
  const session = new Session(deps)
  return { session, cloud, tokens, prompts, storage, factory, clock, notes: new NotesService(() => session.repo) }
}

const note = (body: string) => ({ book: "GEN", chapter: 1, verseStart: null, verseEnd: null, title: "", body, tags: [] })
const bodies = (notes: NotesService) => notes.all().map((r) => r.winner.body).sort()

async function signedIn(opts: { cloud?: MemoryCloud } = {}) {
  const e = env(opts)
  await e.session.init()
  await e.session.signInFromClick()
  await e.session.ws.syncer.sync()
  e.prompts.asked = []
  return e
}

// ---------- 測試 ----------

describe("Session：未登入時不連到 Google（D-34）", () => {
  it("沒按「用 Google 同步」：不載入 Google 元件、不碰雲端；筆記照常可寫、可編輯", async () => {
    const e = env()
    await e.session.init()
    await e.notes.create(note("本機筆記"))
    expect(await e.session.gateEdit()).toBe(true)
    expect(e.tokens.prepareCalls).toBe(0)
    expect(e.tokens.requestCalls).toBe(0)
    expect(e.cloud.calls).toEqual({})
    expect(e.session.status.kind).toBe("local-only")
    expect(e.prompts.asked).toEqual([])
  })

  it("在 LINE 等內建瀏覽器按登入：只顯示引導，不載入 Google 元件", async () => {
    const e = env({ inAppBrowser: "LINE" })
    await e.session.init()
    await e.session.signInFromClick()
    expect(e.prompts.asked).toEqual(["in-app"])
    expect(e.tokens.prepareCalls).toBe(0)
  })

  it("曾在這台裝置登入過：啟動時預先載入 Google 元件，但沒有授權前不碰雲端", async () => {
    const e = env()
    e.storage.set("bwz-notes-account", JSON.stringify({ permissionId: "perm123", email: "t@example.com", displayName: "測試" }))
    await e.session.init()
    expect(e.tokens.prepareCalls).toBe(1)
    expect(e.session.status.kind).toBe("needs-reconnect")
    await e.session.ws.syncer.sync()
    expect(e.cloud.calls).toEqual({})
  })
})

describe("Session：登入", () => {
  it("先說明權限 → 按繼續才開 Google 視窗 → 切到帳號資料 → 詢問加入未登入的筆記", async () => {
    const e = env()
    await e.session.init()
    await e.notes.create(note("未登入時寫的"))
    await e.session.signInFromClick()
    expect(e.prompts.asked).toEqual(["explain", "adopt:1"])
    expect(e.tokens.requestCalls).toBe(1)
    expect(e.session.account?.permissionId).toBe("perm123")
    expect(bodies(e.notes)).toEqual(["未登入時寫的"])
    const anon = await NotesStore.open(ANON_DB, e.factory)
    expect(await anon.getAllOwn()).toHaveLength(0)
    await e.session.ws.syncer.sync()
    expect(e.session.status.kind).toBe("ready")

    const other = await signedIn({ cloud: e.cloud })
    expect(bodies(other.notes)).toEqual(["未登入時寫的"])
  })

  it("說明視窗按取消：不開 Google 視窗，維持未登入", async () => {
    const e = env()
    await e.session.init()
    e.prompts.answers.explain = false
    await e.session.signInFromClick()
    expect(e.tokens.requestCalls).toBe(0)
    expect(e.session.account).toBeNull()
  })

  it("Google 元件載入失敗：不會開 Google 視窗", async () => {
    const e = env()
    await e.session.init()
    e.tokens.failPrepare = true
    await e.session.signInFromClick()
    expect(e.tokens.requestCalls).toBe(0)
    expect(e.session.account).toBeNull()
  })

  it("在 Google 視窗拒絕：維持未登入，並告知原因", async () => {
    const e = env()
    await e.session.init()
    e.tokens.nextResult = { ok: false, reason: "denied", message: "沒有同意" }
    await e.session.signInFromClick()
    expect(e.session.account).toBeNull()
    expect(e.prompts.notices).toContainEqual({ type: "sign-in-failed", reason: "denied", message: "沒有同意" })
  })
})

describe("Session：先同步再編輯（D-03、D-04）", () => {
  it("同步失敗時提示一次；確認後本次不再提示；恢復同步後，下次失敗會再提示", async () => {
    const e = await signedIn()
    e.cloud.offline = true
    e.clock.t += 60_000
    expect(await e.session.gateEdit()).toBe(true)
    expect(e.prompts.asked).toEqual(["offline"])
    e.clock.t += 60_000
    expect(await e.session.gateEdit()).toBe(true)
    expect(e.prompts.asked).toEqual(["offline"])

    e.cloud.offline = false
    e.clock.t += 60_000
    expect(await e.session.gateEdit()).toBe(true)
    e.session.resetOfflineAcknowledgement()
    e.cloud.offline = true
    e.clock.t += 60_000
    expect(await e.session.gateEdit()).toBe(true)
    expect(e.prompts.asked).toEqual(["offline", "offline"])
  })

  it("離線提示按取消：不能編輯", async () => {
    const e = await signedIn()
    e.cloud.offline = true
    e.clock.t += 60_000
    e.prompts.answers.offline = "cancel"
    expect(await e.session.gateEdit()).toBe(false)
  })

  it("授權到期：編輯前詢問；選「連線」重新授權後就同步、可編輯", async () => {
    const e = await signedIn()
    e.tokens.expire()
    expect(e.session.status.kind).toBe("needs-reconnect")
    expect(await e.session.gateEdit()).toBe(true)
    expect(e.prompts.asked).toEqual(["reconnect"])
    expect(e.session.status.kind).toBe("ready")
  })

  it("授權到期：選「先離線編輯」→ 顯示離線提示，確認後可編輯", async () => {
    const e = await signedIn()
    e.tokens.expire()
    e.prompts.answers.reconnect = "offline"
    expect(await e.session.gateEdit()).toBe(true)
    expect(e.prompts.asked).toEqual(["reconnect", "offline"])
    expect(e.tokens.requestCalls).toBe(1) // 只有最初登入那一次
  })
})

describe("Session：登出與刪除", () => {
  it("登出並清除：這台裝置上的帳號資料被清空，回到未登入", async () => {
    const e = await signedIn()
    await e.notes.create(note("帳號裡的"))
    await e.session.ws.syncer.sync()
    e.prompts.answers.signOut = "clear"
    await e.session.signOut()
    expect(e.session.account).toBeNull()
    expect(e.session.status.kind).toBe("local-only")
    expect(e.storage.has("bwz-notes-account")).toBe(false)
    expect(e.notes.all()).toHaveLength(0)
    const s = await NotesStore.open(accountDbName("perm123"), e.factory)
    expect(await s.getAllOwn()).toHaveLength(0)
  })

  it("授權到期時不能刪除全部（避免只刪了本機、雲端還在），而且不會先問兩次確認才說不行", async () => {
    const e = await signedIn()
    await e.notes.create(note("x"))
    await e.session.ws.syncer.sync()
    e.tokens.expire()
    await e.session.deleteEverything()
    expect(e.prompts.notices).toContainEqual({ type: "connect-before-delete" })
    expect(e.prompts.asked).not.toContain("delete-all")
    expect(e.notes.all()).toHaveLength(1)
    expect(e.cloud.files.size).toBeGreaterThan(0)
  })
})

describe("Session：Codex 重構審查回歸測試", () => {
  it("A1 切換帳號時，畫面收到通知當下讀到的一定是新帳號的資料庫", async () => {
    const e = env()
    await e.session.init()
    const mismatches: string[] = []
    e.session.onChange(() => {
      const expected = e.session.account ? accountDbName(e.session.account.permissionId) : ANON_DB
      if (e.session.ws.store.name !== expected) mismatches.push(`${e.session.ws.store.name} ≠ ${expected}`)
    })
    await e.session.signInFromClick()
    e.prompts.answers.signOut = "keep"
    await e.session.signOut()
    expect(mismatches).toEqual([])
  })

  it("B2 詢問「加入未登入的筆記」期間帳號被切換：不加入、也不清掉匿名筆記", async () => {
    const e = env()
    await e.session.init()
    await e.notes.create(note("未登入時寫的"))
    e.prompts.answers.signOut = "keep"
    e.prompts.adoptAnonymous = async () => {
      await e.session.signOut()
      return true
    }
    await e.session.signInFromClick()
    expect(e.session.account).toBeNull()
    expect(bodies(e.notes)).toEqual(["未登入時寫的"])
  })

  it("畫面 #3 切換帳號前先讓編輯中的內容存進原本的帳號，並算進「要不要加入」", async () => {
    const e = env()
    await e.session.init()
    let editorOpen = true // 和真正的編輯器一樣：存完就關閉，之後再呼叫不做事
    e.session.onBeforeSwitch(async () => {
      if (!editorOpen) return
      editorOpen = false
      await e.notes.create(note("編輯中還沒存的"))
    })
    await e.session.signInFromClick()
    expect(e.prompts.asked).toEqual(["explain", "adopt:1"])
    expect(e.session.account?.permissionId).toBe("perm123")
    expect(bodies(e.notes)).toEqual(["編輯中還沒存的"])
  })
})

describe("Session：多方檢查回歸測試（Antigravity）", () => {
  it("M-09 主動登出就忘記帳號提示，下次可以選別的帳號", async () => {
    const e = await signedIn()
    e.prompts.answers.signOut = "keep"
    await e.session.signOut()
    expect(e.tokens.forgotEmail).toBe(1)
  })

  it("H-03 沒有有效連線時中斷連線：先說明無法撤銷，結果通知 revoked=false", async () => {
    const e = await signedIn()
    e.tokens.expire()
    await e.session.disconnect()
    expect(e.prompts.asked).toEqual(["disconnect:false"])
    expect(e.prompts.notices).toContainEqual({ type: "disconnected", revoked: false })
    expect(e.session.account).toBeNull()
  })

  it("H-02 選了「先不要」之後，還能在「我的筆記」頁把未登入的筆記加入帳號", async () => {
    const e = env()
    await e.session.init()
    await e.notes.create(note("未登入時寫的"))
    e.prompts.answers.adopt = false
    await e.session.signInFromClick()
    expect(e.notes.all()).toHaveLength(0)
    expect(await e.session.pendingAnonymousCount()).toBe(1)
    await e.session.adoptAnonymousNow()
    expect(bodies(e.notes)).toEqual(["未登入時寫的"])
    expect(await e.session.pendingAnonymousCount()).toBe(0)
  })

  it("未登入時可以一次清除這台裝置上的筆記", async () => {
    const e = env()
    await e.session.init()
    await e.notes.create(note("公用電腦上寫的"))
    await e.session.clearLocal()
    expect(e.notes.all()).toHaveLength(0)
  })

  it("第二輪 #7 編輯中的內容存不進去也無法備份：不切換帳號，告知使用者", async () => {
    const e = await signedIn()
    e.session.onBeforeSwitch(async () => {
      throw new Error("存不進去")
    })
    e.prompts.answers.signOut = "keep"
    await e.session.signOut()
    expect(e.session.account?.permissionId).toBe("perm123")
    expect(e.prompts.notices).toContainEqual({ type: "switch-blocked" })
    expect(e.tokens.forgotEmail).toBe(0)
  })
})
