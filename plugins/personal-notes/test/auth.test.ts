import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  DRIVE_APPDATA_SCOPE,
  DRIVE_FILE_SCOPE,
  TokenManager,
  tokenErrorMessage,
} from "../src/client/auth/gis"

class StorageFake {
  private data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

describe("Google 授權錯誤訊息（12 A4：應用程式已是正式版）", () => {
  it("拒絕授權時說明怎麼重試，不再提試用名單", () => {
    const m = tokenErrorMessage("access_denied")
    expect(m).toContain("授權")
    expect(m).toContain("重試")
    expect(m).not.toContain("試用")
  })

  it("其他錯誤沿用 Google 的說明", () => {
    expect(tokenErrorMessage("invalid_request", "bad request")).toBe("bad request")
    expect(tokenErrorMessage("invalid_request")).toBe("invalid_request")
  })

  it("使用者看得到的程式碼裡沒有「試用」字樣", () => {
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx|scss)$/.test(f)) files.push(p)
      }
    }
    walk(join(__dirname, "../src"))
    const hits = files.filter((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\/?\*)/.test(line))
        .some((line) => /(?<!測)試用/.test(line)),
    )
    expect(hits).toEqual([])
  })
})

describe("增量備份授權", () => {
  let local: StorageFake
  let session: StorageFake
  let callback: (response: unknown) => void
  let requestAccessToken: ReturnType<typeof vi.fn>

  beforeEach(() => {
    local = new StorageFake()
    session = new StorageFake()
    requestAccessToken = vi.fn()
    vi.stubGlobal("localStorage", local)
    vi.stubGlobal("sessionStorage", session)
    vi.stubGlobal("window", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn((options: { callback: (response: unknown) => void }) => {
              callback = options.callback
              return { requestAccessToken }
            }),
            hasGrantedAllScopes: (response: { scope?: string }, scope: string) =>
              (response.scope ?? "").split(" ").includes(scope),
          },
        },
      },
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("尚未開過備份時續期只申請 appdata", async () => {
    const manager = new TokenManager("client")
    await manager.prepare()
    const pending = manager.request()
    expect(requestAccessToken.mock.calls[0][0].scope).toBe(DRIVE_APPDATA_SCOPE)
    callback({ access_token: "a", expires_in: 3600, scope: DRIVE_APPDATA_SCOPE })
    expect(await pending).toEqual({ ok: true })
    manager.setOwner("account")
    expect(manager.hasBackupScope("account")).toBe(false)
    expect(manager.tokenFor("account")).toBe("a")
  })

  it("首次備份同時申請兩個範圍；之後續期也申請兩個", async () => {
    const manager = new TokenManager("client")
    await manager.prepare()
    const first = manager.requestBackupScope()
    expect(requestAccessToken.mock.calls[0][0].scope).toBe(`${DRIVE_APPDATA_SCOPE} ${DRIVE_FILE_SCOPE}`)
    callback({ access_token: "a", expires_in: 3600, scope: `${DRIVE_APPDATA_SCOPE} ${DRIVE_FILE_SCOPE}` })
    expect(await first).toEqual({ ok: true })
    manager.setOwner("account")
    manager.rememberEmail("a@example.com")
    expect(manager.hasBackupScope("account")).toBe(true)
    const renewal = manager.request()
    expect(requestAccessToken.mock.calls[1][0].scope).toBe(`${DRIVE_APPDATA_SCOPE} ${DRIVE_FILE_SCOPE}`)
    callback({ access_token: "b", expires_in: 3600, scope: `${DRIVE_APPDATA_SCOPE} ${DRIVE_FILE_SCOPE}` })
    await renewal
    manager.setOwner("account")
    expect(manager.tokenFor("account")).toBe("b")
  })

  it("未勾 drive.file 仍保留 appdata token 供同步", async () => {
    const manager = new TokenManager("client")
    await manager.prepare()
    const pending = manager.requestBackupScope()
    callback({ access_token: "appdata-only", expires_in: 3600, scope: DRIVE_APPDATA_SCOPE })
    expect(await pending).toMatchObject({ ok: false, reason: "no-scope" })
    manager.setOwner("account")
    expect(manager.tokenFor("account")).toBe("appdata-only")
    expect(manager.hasBackupScope("account")).toBe(false)
  })

  it("Gemini 審查 F3a #1：開過備份後換新分頁（owner 是空的）續期，靠記住的 email 仍兩個範圍一起申請", async () => {
    local.setItem("bwz-notes-login-hint", "a@example.com") // 之前登入過、記住的 email
    const manager = new TokenManager("client")
    await manager.prepare()
    const first = manager.requestBackupScope()
    callback({ access_token: "a", expires_in: 3600, scope: `${DRIVE_APPDATA_SCOPE} ${DRIVE_FILE_SCOPE}` })
    await first
    manager.setOwner("account") // 備份流程只呼叫 setOwner，不會再呼叫 rememberEmail
    // 新分頁：sessionStorage 是空的
    session.removeItem("bwz-notes-token")
    const fresh = new TokenManager("client")
    await fresh.prepare()
    void fresh.request()
    expect(requestAccessToken.mock.calls[requestAccessToken.mock.calls.length - 1][0].scope).toBe(`${DRIVE_APPDATA_SCOPE} ${DRIVE_FILE_SCOPE}`)
  })
})
