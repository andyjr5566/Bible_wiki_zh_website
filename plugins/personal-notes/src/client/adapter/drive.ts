// Google Drive appDataFolder 後端（03 §2、§4；PoC 已驗證所有端點，06 §1）。

import { APP_TAG, SCHEMA_VERSION } from "../model/record"
import {
  AdapterError,
  type Account,
  type ChangeSet,
  type FileMeta,
  type RemoteFile,
  type SyncAdapter,
} from "./types"

const API = "https://www.googleapis.com/drive/v3"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3"
const FILE_FIELDS = "id,name,version,appProperties"

export interface DriveAdapterOptions {
  getToken: () => string | null
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** 每分鐘最多幾次 API 呼叫（客戶端限流，03 §4.7）。 */
  maxCallsPerMinute?: number
  maxRetries?: number
}

interface DriveFile {
  id: string
  name: string
  version: string
  appProperties?: Record<string, string>
}

export function classifyError(status: number, reason: string, message: string): AdapterError {
  if (status === 401) return new AdapterError("auth", message, status, reason)
  if (status === 429) return new AdapterError("rateLimit", message, status, reason)
  if (status === 403) {
    if (["userRateLimitExceeded", "rateLimitExceeded", "RATE_LIMIT_EXCEEDED"].includes(reason))
      return new AdapterError("rateLimit", message, status, reason)
    if (reason === "storageQuotaExceeded") return new AdapterError("storageFull", message, status, reason)
    if (reason === "domainPolicy" || reason === "admin_policy_enforced") return new AdapterError("admin", message, status, reason)
    if (reason === "insufficientPermissions" || reason === "insufficientScopes" || reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT")
      return new AdapterError("auth", message, status, reason)
    return new AdapterError("other", message, status, reason)
  }
  if (status === 404) return new AdapterError("notFound", message, status, reason)
  if (status === 409 && reason === "fileIdInUse") return new AdapterError("fileIdInUse", message, status, reason)
  if (status >= 500) return new AdapterError("server", message, status, reason)
  return new AdapterError("other", message, status, reason)
}

function toRemote(f: DriveFile): RemoteFile | null {
  const p = f.appProperties ?? {}
  if (p.app !== APP_TAG || (p.kind !== "shard" && p.kind !== "device") || !p.device) return null
  return {
    id: f.id,
    name: f.name,
    kind: p.kind,
    shard: p.kind === "shard" ? (p.shard ?? null) : null,
    device: p.device,
    version: String(f.version),
  }
}

export class DriveAdapter implements SyncAdapter {
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly maxCallsPerMinute: number
  private readonly maxRetries: number
  private callTimes: number[] = []

  constructor(private readonly opts: DriveAdapterOptions) {
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args))
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.maxCallsPerMinute = opts.maxCallsPerMinute ?? 60
    this.maxRetries = opts.maxRetries ?? 4
  }

  private async throttle(): Promise<void> {
    const now = Date.now()
    this.callTimes = this.callTimes.filter((t) => now - t < 60_000)
    if (this.callTimes.length >= this.maxCallsPerMinute) {
      const wait = 60_000 - (now - this.callTimes[0]) + 50
      await this.sleep(wait)
    }
    this.callTimes.push(Date.now())
  }

  private async request(method: string, url: string, body?: BodyInit, contentType?: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const token = this.opts.getToken()
      if (!token) throw new AdapterError("auth", "沒有有效的 Google 授權")
      await this.throttle()
      let res: Response
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
        if (contentType) headers["Content-Type"] = contentType
        res = await this.fetchImpl(url, { method, headers, body })
      } catch (e) {
        const err = new AdapterError("network", e instanceof Error ? e.message : "network error")
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoff(attempt))
          continue
        }
        throw err
      }
      const text = await res.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      if (res.ok) return data
      const e = (data as { error?: { message?: string; status?: string; errors?: { reason?: string }[] } })?.error
      const reason = e?.errors?.[0]?.reason ?? e?.status ?? ""
      const err = classifyError(res.status, reason, e?.message ?? `HTTP ${res.status}`)
      if (err.retryable && attempt < this.maxRetries) {
        await this.sleep(this.backoff(attempt))
        continue
      }
      throw err
    }
  }

  /** 截斷指數退避：1、2、4、8… 秒＋最多 1 秒隨機，上限 64 秒（Google 建議）。 */
  private backoff(attempt: number): number {
    return Math.min(2 ** attempt * 1000 + Math.random() * 1000, 64_000)
  }

  async account(): Promise<Account> {
    const d = (await this.request("GET", `${API}/about?fields=user(displayName,emailAddress,permissionId,photoLink)`)) as {
      user: { displayName: string; emailAddress: string; permissionId: string; photoLink?: string }
    }
    return { displayName: d.user.displayName, email: d.user.emailAddress, permissionId: d.user.permissionId, photoLink: d.user.photoLink }
  }

  async startToken(): Promise<string> {
    const d = (await this.request("GET", `${API}/changes/startPageToken`)) as { startPageToken: string }
    return d.startPageToken
  }

  async listFiles(): Promise<RemoteFile[]> {
    const q = encodeURIComponent(`appProperties has { key='app' and value='${APP_TAG}' }`)
    const out: RemoteFile[] = []
    let pageToken = ""
    do {
      const url =
        `${API}/files?spaces=appDataFolder&q=${q}&pageSize=1000&fields=nextPageToken,files(${FILE_FIELDS})` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "")
      const d = (await this.request("GET", url)) as { nextPageToken?: string; files: DriveFile[] }
      for (const f of d.files) {
        const r = toRemote(f)
        if (r) out.push(r)
      }
      pageToken = d.nextPageToken ?? ""
    } while (pageToken)
    return out
  }

  async changes(token: string): Promise<ChangeSet> {
    const files = new Map<string, RemoteFile>()
    const removed = new Set<string>()
    let pageToken = token
    let next = token
    for (;;) {
      const url =
        `${API}/changes?pageToken=${encodeURIComponent(pageToken)}&spaces=appDataFolder&includeRemoved=true&pageSize=1000` +
        `&fields=nextPageToken,newStartPageToken,changes(fileId,removed,file(${FILE_FIELDS},trashed))`
      const d = (await this.request("GET", url)) as {
        nextPageToken?: string
        newStartPageToken?: string
        changes: { fileId: string; removed?: boolean; file?: DriveFile & { trashed?: boolean } }[]
      }
      for (const c of d.changes) {
        if (c.removed || !c.file || c.file.trashed) {
          files.delete(c.fileId)
          removed.add(c.fileId)
          continue
        }
        const r = toRemote(c.file)
        if (r) {
          files.set(r.id, r)
          removed.delete(r.id)
        }
      }
      if (d.nextPageToken) {
        pageToken = d.nextPageToken
        continue
      }
      next = d.newStartPageToken ?? pageToken
      break
    }
    return { files: [...files.values()], removed: [...removed], token: next }
  }

  async read(fileId: string): Promise<unknown> {
    return this.request("GET", `${API}/files/${encodeURIComponent(fileId)}?alt=media`)
  }

  async generateIds(count: number): Promise<string[]> {
    const d = (await this.request("GET", `${API}/files/generateIds?count=${count}&space=appDataFolder&type=files`)) as { ids: string[] }
    return d.ids
  }

  async create(id: string, meta: FileMeta, body: unknown): Promise<RemoteFile> {
    const metadata = {
      id,
      name: meta.name,
      parents: ["appDataFolder"],
      mimeType: "application/json",
      appProperties: {
        app: APP_TAG,
        kind: meta.kind,
        device: meta.device,
        schema: String(SCHEMA_VERSION),
        ...(meta.shard ? { shard: meta.shard } : {}),
      },
    }
    const boundary = "bwz" + Math.random().toString(36).slice(2)
    const payload =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(body)}\r\n--${boundary}--`
    const d = (await this.request(
      "POST",
      `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`,
      payload,
      `multipart/related; boundary=${boundary}`,
    )) as DriveFile
    const r = toRemote(d)
    if (!r) throw new AdapterError("other", "建立的檔案缺少必要屬性")
    return r
  }

  async update(fileId: string, body: unknown): Promise<RemoteFile> {
    const d = (await this.request(
      "PATCH",
      `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=${FILE_FIELDS}`,
      JSON.stringify(body),
      "application/json; charset=UTF-8",
    )) as DriveFile
    const r = toRemote(d)
    if (!r) throw new AdapterError("other", "更新的檔案缺少必要屬性")
    return r
  }

  async remove(fileId: string): Promise<void> {
    await this.request("DELETE", `${API}/files/${encodeURIComponent(fileId)}`)
  }
}
