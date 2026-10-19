// 使用者可見的 Google Drive 備份檔；獨立於 appDataFolder 的 SyncAdapter。

import { APP_TAG } from "../model/record"
import { DriveHttp, type DriveHttpOptions } from "./http"
import { AdapterError } from "./types"

const API = "https://www.googleapis.com/drive/v3"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3"
const FOLDER_MIME = "application/vnd.google-apps.folder"
const FOLDER_NAME = "聖經知識庫筆記備份"
const FILE_FIELDS = "id,name,createdTime,appProperties,mimeType,trashed"

interface DriveFile {
  id: string
  name?: string
  createdTime?: string
  mimeType?: string
  trashed?: boolean
  appProperties?: Record<string, string>
}

export interface BackupListing {
  id: string
  name: string
  createdTime: string
  records: number
}

export interface DriveFilesLike {
  ensureFolder(): Promise<string>
  listBackups(): Promise<BackupListing[]>
  createBackup(folderId: string, name: string, json: string, records: number): Promise<string>
  trash(fileId: string): Promise<void>
  read(fileId: string): Promise<string>
}

export class DriveFiles implements DriveFilesLike {
  private readonly http: DriveHttp

  constructor(opts: DriveHttpOptions) {
    this.http = new DriveHttp(opts)
  }

  private async list(query: string): Promise<DriveFile[]> {
    const files: DriveFile[] = []
    let pageToken = ""
    do {
      const url =
        `${API}/files?spaces=drive&q=${encodeURIComponent(query)}&pageSize=1000&fields=nextPageToken,files(${FILE_FIELDS})` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "")
      const page = (await this.http.request("GET", url)) as { files?: DriveFile[]; nextPageToken?: string }
      files.push(...(page.files ?? []))
      pageToken = page.nextPageToken ?? ""
    } while (pageToken)
    return files
  }

  async ensureFolder(): Promise<string> {
    const query =
      `trashed = false and mimeType = '${FOLDER_MIME}' and ` +
      `appProperties has { key='app' and value='${APP_TAG}' } and ` +
      "appProperties has { key='kind' and value='backup-folder' }"
    const existing = (await this.list(query)).find(
      (file) =>
        !file.trashed &&
        file.mimeType === FOLDER_MIME &&
        file.appProperties?.app === APP_TAG &&
        file.appProperties?.kind === "backup-folder",
    )
    if (existing) return existing.id

    const created = (await this.http.request(
      "POST",
      `${API}/files?fields=id`,
      JSON.stringify({
        name: FOLDER_NAME,
        mimeType: FOLDER_MIME,
        parents: ["root"],
        appProperties: { app: APP_TAG, kind: "backup-folder" },
      }),
      "application/json; charset=UTF-8",
    )) as { id?: string }
    if (!created.id) throw new AdapterError("other", "Drive 沒有回傳資料夾 ID")
    return created.id
  }

  async listBackups(): Promise<BackupListing[]> {
    const query =
      `trashed = false and appProperties has { key='app' and value='${APP_TAG}' } and ` +
      "appProperties has { key='kind' and value='backup' }"
    const files = await this.list(query)
    return files
      .filter(
        (file) =>
          !file.trashed &&
          file.appProperties?.app === APP_TAG &&
          file.appProperties?.kind === "backup" &&
          file.mimeType === "application/json",
      )
      .map((file) => ({
        id: file.id,
        name: file.name ?? "",
        createdTime: file.createdTime ?? "",
        records: Math.max(0, Number.parseInt(file.appProperties?.records ?? "0", 10) || 0),
      }))
      .sort((a, b) => (Date.parse(b.createdTime) || 0) - (Date.parse(a.createdTime) || 0))
  }

  async createBackup(folderId: string, name: string, json: string, records: number): Promise<string> {
    const metadata = {
      name,
      parents: [folderId],
      mimeType: "application/json",
      appProperties: { app: APP_TAG, kind: "backup", records: String(records) },
    }
    const boundary = "bwz" + Math.random().toString(36).slice(2)
    const payload =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n` +
      `--${boundary}--`
    const created = (await this.http.request(
      "POST",
      `${UPLOAD}/files?uploadType=multipart&fields=id`,
      payload,
      `multipart/related; boundary=${boundary}`,
    )) as { id?: string }
    if (!created.id) throw new AdapterError("other", "Drive 沒有回傳備份檔 ID")
    return created.id
  }

  /**
   * 每次刪除前重新列出本站備份。清單以 appProperties 查找，不接受任意 Drive ID。
   */
  async trash(fileId: string): Promise<void> {
    if (!(await this.listBackups()).some((file) => file.id === fileId)) {
      throw new AdapterError("notFound", "找不到本站建立的備份檔")
    }
    await this.http.request(
      "PATCH",
      `${API}/files/${encodeURIComponent(fileId)}?fields=id,trashed`,
      JSON.stringify({ trashed: true }),
      "application/json; charset=UTF-8",
    )
  }

  async read(fileId: string): Promise<string> {
    if (!(await this.listBackups()).some((file) => file.id === fileId)) {
      throw new AdapterError("notFound", "找不到本站建立的備份檔")
    }
    return this.http.requestText("GET", `${API}/files/${encodeURIComponent(fileId)}?alt=media`)
  }
}
