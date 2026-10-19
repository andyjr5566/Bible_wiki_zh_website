import { describe, expect, it, vi } from "vitest"
import { DriveFiles } from "../src/client/adapter/driveFiles"

function reply(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } })
}

describe("Drive 可見備份檔", () => {
  it("以 appProperties 找資料夾，找到時不建立", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      expect(url.searchParams.get("spaces")).toBe("drive")
      const q = url.searchParams.get("q") ?? ""
      expect(q).toContain("backup-folder")
      expect(q).toContain("appProperties")
      expect(q).toContain("trashed = false")
      expect(q).not.toContain("聖經知識庫筆記備份")
      return reply({
        files: [{
          id: "folder",
          name: "使用者改過的名字",
          mimeType: "application/vnd.google-apps.folder",
          appProperties: { app: "bwz-notes", kind: "backup-folder" },
        }],
      })
    })
    const files = new DriveFiles({ getToken: () => "token", fetchImpl: fetchImpl as typeof fetch })
    expect(await files.ensureFolder()).toBe("folder")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("沒有資料夾才在根目錄建立", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply({ files: [] }))
      .mockResolvedValueOnce(reply({ id: "new-folder" }))
    const files = new DriveFiles({ getToken: () => "token", fetchImpl: fetchImpl as typeof fetch })
    expect(await files.ensureFolder()).toBe("new-folder")
    const [url, init] = fetchImpl.mock.calls[1] as [string, RequestInit]
    expect(url).toContain("/files?fields=id")
    const body = JSON.parse(String(init.body))
    expect(body.parents).toEqual(["root"])
    expect(body.appProperties).toEqual({ app: "bwz-notes", kind: "backup-folder" })
  })

  it("上傳 multipart JSON，附上本站標記及筆數", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({ id: "backup-1" }))
    const files = new DriveFiles({ getToken: () => "token", fetchImpl: fetchImpl as typeof fetch })
    expect(await files.createBackup("folder", "backup.json", '{"records":[]}', 3)).toBe("backup-1")
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("uploadType=multipart")
    expect((init.headers as Record<string, string>)["Content-Type"]).toContain("multipart/related")
    expect(String(init.body)).toContain('"parents":["folder"]')
    expect(String(init.body)).toContain('"app":"bwz-notes","kind":"backup","records":"3"')
    expect(String(init.body)).toContain('{"records":[]}')
  })

  it("清單由新到舊；移到垃圾桶前重新確認本站標記", async () => {
    const entries = [
      { id: "old", name: "old.json", createdTime: "2025-01-01T00:00:00Z", mimeType: "application/json", appProperties: { app: "bwz-notes", kind: "backup", records: "2" } },
      { id: "other", name: "other.json", createdTime: "2025-01-03T00:00:00Z", mimeType: "application/json", appProperties: { app: "other", kind: "backup", records: "1" } },
      { id: "new", name: "new.json", createdTime: "2025-01-02T00:00:00Z", mimeType: "application/json", appProperties: { app: "bwz-notes", kind: "backup", records: "3" } },
    ]
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "PATCH" ? reply({ id: "old", trashed: true }) : reply({ files: entries }),
    )
    const files = new DriveFiles({ getToken: () => "token", fetchImpl: fetchImpl as typeof fetch })
    expect((await files.listBackups()).map((file) => file.id)).toEqual(["new", "old"])
    await files.trash("old")
    const patch = fetchImpl.mock.calls.find((call) => call[1]?.method === "PATCH")
    expect(patch).toBeDefined()
    expect(JSON.parse(String(patch![1]!.body))).toEqual({ trashed: true })
    await expect(files.trash("other")).rejects.toThrow()
    expect(fetchImpl.mock.calls.filter((call) => call[1]?.method === "PATCH")).toHaveLength(1)
  })
})
