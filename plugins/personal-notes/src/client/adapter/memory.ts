// 測試用的記憶體雲端：行為模仿 Drive appDataFolder（版本不連號、409 fileIdInUse、changes 日誌）。
// 多個 MemoryAdapter 共用同一個 MemoryCloud ＝ 多台裝置登入同一個帳號。

import {
  AdapterError,
  type Account,
  type AdapterErrorKind,
  type ChangeSet,
  type FileMeta,
  type RemoteFile,
  type SyncAdapter,
} from "./types"

interface StoredFile {
  meta: RemoteFile
  body: string
}

export class MemoryCloud {
  files = new Map<string, StoredFile>()
  private log: { seq: number; fileId: string }[] = []
  private seq = 1
  private idCounter = 0
  offline = false
  /** 讓接下來 n 次呼叫失敗（模擬頻率限制、伺服器錯誤等）。 */
  failures: { kind: AdapterErrorKind; count: number; methods?: string[] }[] = []
  calls: Record<string, number> = {}
  account: Account = { displayName: "測試", email: "t@example.com", permissionId: "perm123" }
  /** 檔案的修改時間用這個時鐘（測試可以控制） */
  now: () => number = () => Date.now()

  check(method: string): void {
    this.calls[method] = (this.calls[method] ?? 0) + 1
    if (this.offline) throw new AdapterError("network", "offline")
    const f = this.failures.find((x) => x.count > 0 && (!x.methods || x.methods.includes(method)))
    if (f) {
      f.count--
      throw new AdapterError(f.kind, `injected ${f.kind}`)
    }
  }

  record(fileId: string): void {
    this.log.push({ seq: this.seq++, fileId })
  }

  token(): string {
    return String(this.seq)
  }

  changesSince(token: number): string[] {
    return [...new Set(this.log.filter((e) => e.seq >= token).map((e) => e.fileId))]
  }

  newId(): string {
    return `mem${++this.idCounter}`
  }

  /** 模擬使用者在 Drive「管理應用程式」刪除本站的隱藏資料。 */
  wipe(): void {
    for (const id of [...this.files.keys()]) {
      this.files.delete(id)
      this.record(id)
    }
  }
}

export class MemoryAdapter implements SyncAdapter {
  constructor(private readonly cloud: MemoryCloud) {}

  async account(): Promise<Account> {
    this.cloud.check("account")
    return { ...this.cloud.account }
  }

  async startToken(): Promise<string> {
    this.cloud.check("startToken")
    return this.cloud.token()
  }

  async listFiles(): Promise<RemoteFile[]> {
    this.cloud.check("listFiles")
    return [...this.cloud.files.values()].map((f) => ({ ...f.meta }))
  }

  async changes(token: string): Promise<ChangeSet> {
    this.cloud.check("changes")
    const ids = this.cloud.changesSince(Number(token))
    const files: RemoteFile[] = []
    const removed: string[] = []
    for (const id of ids) {
      const f = this.cloud.files.get(id)
      if (f) files.push({ ...f.meta })
      else removed.push(id)
    }
    return { files, removed, token: this.cloud.token() }
  }

  async read(fileId: string): Promise<unknown> {
    this.cloud.check("read")
    const f = this.cloud.files.get(fileId)
    if (!f) throw new AdapterError("notFound", "not found", 404)
    return JSON.parse(f.body)
  }

  async generateIds(count: number): Promise<string[]> {
    this.cloud.check("generateIds")
    return Array.from({ length: count }, () => this.cloud.newId())
  }

  async create(id: string, meta: FileMeta, body: unknown): Promise<RemoteFile> {
    this.cloud.check("create")
    if (this.cloud.files.has(id)) throw new AdapterError("fileIdInUse", "in use", 409, "fileIdInUse")
    const remote: RemoteFile = { id, name: meta.name, kind: meta.kind, shard: meta.shard, device: meta.device, version: "1", modified: this.cloud.now() }
    this.cloud.files.set(id, { meta: remote, body: JSON.stringify(body) })
    this.cloud.record(id)
    return { ...remote }
  }

  async update(fileId: string, body: unknown): Promise<RemoteFile> {
    this.cloud.check("update")
    const f = this.cloud.files.get(fileId)
    if (!f) throw new AdapterError("notFound", "not found", 404)
    // Drive 的 version 不是 +1（PoC 實測 1→3）
    f.meta = { ...f.meta, version: String(Number(f.meta.version) + 2), modified: this.cloud.now() }
    f.body = JSON.stringify(body)
    this.cloud.record(fileId)
    return { ...f.meta }
  }

  async remove(fileId: string): Promise<void> {
    this.cloud.check("remove")
    if (!this.cloud.files.delete(fileId)) throw new AdapterError("notFound", "not found", 404)
    this.cloud.record(fileId)
  }
}
