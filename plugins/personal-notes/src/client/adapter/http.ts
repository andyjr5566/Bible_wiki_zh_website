// Drive API 共用的 HTTP、節流、退避與錯誤分類（從 adapter/drive.ts 抽出，D-45）：
// 同步用的 DriveAdapter（appDataFolder）與備份用的 DriveFiles（看得到的資料夾）共用。

import { AdapterError } from "./types"

export interface DriveHttpOptions {
  getToken: () => string | null
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** 每分鐘最多幾次 API 呼叫（客戶端限流，03 §4.7）。 */
  maxCallsPerMinute?: number
  maxRetries?: number
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

export class DriveHttp {
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly maxCallsPerMinute: number
  private readonly maxRetries: number
  private callTimes: number[] = []

  constructor(private readonly opts: DriveHttpOptions) {
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args))
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.maxCallsPerMinute = opts.maxCallsPerMinute ?? 60
    this.maxRetries = opts.maxRetries ?? 4
  }

  private async throttle(): Promise<void> {
    const now = Date.now()
    this.callTimes = this.callTimes.filter((time) => now - time < 60_000)
    if (this.callTimes.length >= this.maxCallsPerMinute) {
      const wait = 60_000 - (now - this.callTimes[0]) + 50
      await this.sleep(wait)
    }
    this.callTimes.push(Date.now())
  }

  /** 保留既有 DriveAdapter 的 JSON 解析行為，包括 alt=media。 */
  request(method: string, url: string, body?: BodyInit, contentType?: string): Promise<unknown> {
    return this.send(method, url, body, contentType, false)
  }

  requestText(method: string, url: string, body?: BodyInit, contentType?: string): Promise<string> {
    return this.send(method, url, body, contentType, true) as Promise<string>
  }

  private async send(method: string, url: string, body: BodyInit | undefined, contentType: string | undefined, textOnly: boolean): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const token = this.opts.getToken()
      if (!token) throw new AdapterError("auth", "沒有有效的 Google 授權")
      await this.throttle()

      let response: Response
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
        if (contentType) headers["Content-Type"] = contentType
        response = await this.fetchImpl(url, { method, headers, body })
      } catch (error) {
        const err = new AdapterError("network", error instanceof Error ? error.message : "network error")
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoff(attempt))
          continue
        }
        throw err
      }

      const text = await response.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      if (response.ok) return textOnly ? text : data

      const detail = (data as { error?: { message?: string; status?: string; errors?: { reason?: string }[] } })?.error
      const reason = detail?.errors?.[0]?.reason ?? detail?.status ?? ""
      const err = classifyError(response.status, reason, detail?.message ?? `HTTP ${response.status}`)
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
}
