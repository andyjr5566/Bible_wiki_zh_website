// Google Drive appDataFolder 後端（03 §2、§4；PoC 已驗證所有端點，06 §1）。
// HTTP、節流、退避與錯誤分類在 adapter/http.ts（與備份用的 driveFiles.ts 共用）。

import { APP_TAG, SCHEMA_VERSION } from "../model/record"
import { DriveHttp, type DriveHttpOptions } from "./http"
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
const FILE_FIELDS = "id,name,version,modifiedTime,appProperties"

export interface DriveAdapterOptions extends DriveHttpOptions {}

interface DriveFile {
  id: string
  name: string
  version: string
  modifiedTime?: string
  appProperties?: Record<string, string>
}

export { classifyError } from "./http"

function toRemote(f: DriveFile): RemoteFile | null {
  const p = f.appProperties ?? {}
  if (p.app !== APP_TAG || (p.kind !== "shard" && p.kind !== "device" && p.kind !== "retired") || !p.device) return null
  return {
    id: f.id,
    name: f.name,
    kind: p.kind,
    shard: p.kind === "shard" ? (p.shard ?? null) : null,
    device: p.device,
    version: String(f.version),
    ...(f.modifiedTime ? { modified: Date.parse(f.modifiedTime) } : {}),
  }
}

export class DriveAdapter implements SyncAdapter {
  private readonly http: DriveHttp

  constructor(opts: DriveAdapterOptions) {
    this.http = new DriveHttp(opts)
  }

  private request(method: string, url: string, body?: BodyInit, contentType?: string): Promise<unknown> {
    return this.http.request(method, url, body, contentType)
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
