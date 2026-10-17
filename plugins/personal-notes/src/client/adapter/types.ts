// 同步後端介面（D-18）。第一個實作是 Google Drive appDataFolder；測試用 InMemory。

export type AdapterErrorKind =
  | "auth" // token 失效或未授權 → 需要重新連線
  | "rateLimit" // 403/429 頻率限制 → 退避重試
  | "storageFull" // 使用者雲端硬碟已滿
  | "admin" // 管理員封鎖（學校／公司帳號）
  | "network" // 斷線
  | "notFound"
  | "fileIdInUse" // 用預先產生的 ID 重複建立（代表先前其實已建立成功，D-25）
  | "server" // 5xx
  | "other"

export class AdapterError extends Error {
  constructor(
    readonly kind: AdapterErrorKind,
    message: string,
    readonly status = 0,
    readonly reason = "",
  ) {
    super(message)
    this.name = "AdapterError"
  }

  get retryable(): boolean {
    return this.kind === "rateLimit" || this.kind === "network" || this.kind === "server"
  }
}

export interface RemoteFile {
  id: string
  name: string
  kind: "shard" | "device"
  shard: string | null
  device: string
  /** Drive 的 version（每次寫入遞增，但不是 +1）。 */
  version: string
}

export interface ChangeSet {
  files: RemoteFile[]
  removed: string[]
  token: string
}

export interface Account {
  displayName: string
  email: string
  permissionId: string
  photoLink?: string
}

export interface FileMeta {
  name: string
  kind: "shard" | "device"
  shard: string | null
  device: string
}

export interface SyncAdapter {
  account(): Promise<Account>
  startToken(): Promise<string>
  listFiles(): Promise<RemoteFile[]>
  changes(token: string): Promise<ChangeSet>
  read(fileId: string): Promise<unknown>
  generateIds(count: number): Promise<string[]>
  create(id: string, meta: FileMeta, body: unknown): Promise<RemoteFile>
  update(fileId: string, body: unknown): Promise<RemoteFile>
  remove(fileId: string): Promise<void>
}

export const shardFileName = (shard: string, device: string) => `notes.${shard}.${device}.json`
export const deviceFileName = (device: string) => `device.${device}.json`
