// 本機儲存（IndexedDB），見 03 §6。
// 資料庫依帳號分開：`bwz-notes-anon`（未登入）、`bwz-notes-u-<permissionId>`。
//
// stores：
//   own     本裝置負責保存的版本（每則筆記最多一個），keyPath id
//   remote  其他裝置分片的快取，keyPath fileId
//   outbox  待上傳的分片，keyPath shard（dirtyAt 用來避免清掉上傳期間的新修改）
//   meta    其他狀態（deviceId、ownFiles、startPageToken…），out-of-line key

import type { NoteRecord } from "../model/record"

const DB_VERSION = 1

export interface RemoteShardCache {
  fileId: string
  device: string
  shard: string
  version: string
  records: NoteRecord[]
}

export interface OutboxEntry {
  shard: string
  dirtyAt: number
}

export const ANON_DB = "bwz-notes-anon"
export const accountDbName = (permissionId: string) => `bwz-notes-u-${permissionId}`

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"))
  })
}

export class NotesStore {
  private constructor(
    private readonly db: IDBDatabase,
    readonly name: string,
  ) {}

  static open(name: string, factory: IDBFactory = indexedDB): Promise<NotesStore> {
    return new Promise((resolve, reject) => {
      const r = factory.open(name, DB_VERSION)
      r.onupgradeneeded = () => {
        const db = r.result
        if (!db.objectStoreNames.contains("own")) db.createObjectStore("own", { keyPath: "id" })
        if (!db.objectStoreNames.contains("remote")) db.createObjectStore("remote", { keyPath: "fileId" })
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "shard" })
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta")
      }
      r.onsuccess = () => {
        const db = r.result
        // 其他分頁升級資料庫版本時，關閉自己以免擋住升級
        db.onversionchange = () => db.close()
        resolve(new NotesStore(db, name))
      }
      r.onerror = () => reject(r.error)
      r.onblocked = () => reject(new Error("IndexedDB 被其他分頁占用"))
    })
  }

  static deleteDatabase(name: string, factory: IDBFactory = indexedDB): Promise<void> {
    return new Promise((resolve, reject) => {
      const r = factory.deleteDatabase(name)
      r.onsuccess = () => resolve()
      r.onerror = () => reject(r.error)
      r.onblocked = () => resolve()
    })
  }

  close(): void {
    this.db.close()
  }

  // ---------- meta ----------

  async getMeta<T>(key: string): Promise<T | undefined> {
    const tx = this.db.transaction("meta", "readonly")
    return (await req(tx.objectStore("meta").get(key))) as T | undefined
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const tx = this.db.transaction("meta", "readwrite")
    tx.objectStore("meta").put(value, key)
    await done(tx)
  }

  // ---------- own ----------

  async getAllOwn(): Promise<NoteRecord[]> {
    const tx = this.db.transaction("own", "readonly")
    return req(tx.objectStore("own").getAll())
  }

  /** 儲存本裝置版本並標記分片待上傳（同一交易，避免存了卻忘了上傳）。 */
  async saveOwn(records: NoteRecord[], shards: string[], dirtyAt: number): Promise<void> {
    const tx = this.db.transaction(["own", "outbox"], "readwrite")
    const own = tx.objectStore("own")
    for (const r of records) own.put(r)
    const outbox = tx.objectStore("outbox")
    for (const shard of new Set(shards)) outbox.put({ shard, dirtyAt } satisfies OutboxEntry)
    await done(tx)
  }

  /**
   * 條件式儲存：只有在每筆紀錄目前的 own 版本 hlc 仍等於 expectedHlc 時才寫入（同一交易）。
   * 防止同一台裝置的兩個分頁同時編輯同一則筆記時互相覆蓋。回傳 false 代表有人先改了，呼叫端應重新載入後再試。
   */
  async saveOwnIfUnchanged(
    entries: { record: NoteRecord; expectedHlc: string | null }[],
    shards: string[],
    dirtyAt: number,
  ): Promise<boolean> {
    const tx = this.db.transaction(["own", "outbox"], "readwrite")
    const own = tx.objectStore("own")
    const outbox = tx.objectStore("outbox")
    let ok = true
    let pending = entries.length
    const commit = () => {
      for (const e of entries) own.put(e.record)
      for (const shard of new Set(shards)) outbox.put({ shard, dirtyAt } satisfies OutboxEntry)
    }
    if (pending === 0) commit()
    for (const e of entries) {
      const get = own.get(e.record.id)
      get.onsuccess = () => {
        const current = get.result as NoteRecord | undefined
        if ((current?.hlc ?? null) !== e.expectedHlc) ok = false
        if (--pending === 0) {
          if (ok) commit()
        }
      }
    }
    await done(tx)
    return ok
  }

  /** 修剪用：只有 own 目前仍是指定 hlc 的版本才刪除（避免刪掉上傳期間的新編輯）。回傳實際刪除的 id。 */
  async deleteOwnIfUnchanged(entries: { id: string; hlc: string }[]): Promise<string[]> {
    if (entries.length === 0) return []
    const tx = this.db.transaction("own", "readwrite")
    const own = tx.objectStore("own")
    const deleted: string[] = []
    for (const e of entries) {
      const get = own.get(e.id)
      get.onsuccess = () => {
        if ((get.result as NoteRecord | undefined)?.hlc === e.hlc) {
          own.delete(e.id)
          deleted.push(e.id)
        }
      }
    }
    await done(tx)
    return deleted
  }

  /** 修剪：只移除，不標記上傳（呼叫端會在上傳時寫入修剪後的內容）。 */
  async deleteOwn(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const tx = this.db.transaction("own", "readwrite")
    for (const id of ids) tx.objectStore("own").delete(id)
    await done(tx)
  }

  // ---------- remote ----------

  async getAllRemote(): Promise<RemoteShardCache[]> {
    const tx = this.db.transaction("remote", "readonly")
    return req(tx.objectStore("remote").getAll())
  }

  async putRemote(cache: RemoteShardCache): Promise<void> {
    const tx = this.db.transaction("remote", "readwrite")
    tx.objectStore("remote").put(cache)
    await done(tx)
  }

  async deleteRemote(fileId: string): Promise<void> {
    const tx = this.db.transaction("remote", "readwrite")
    tx.objectStore("remote").delete(fileId)
    await done(tx)
  }

  // ---------- outbox ----------

  async getOutbox(): Promise<OutboxEntry[]> {
    const tx = this.db.transaction("outbox", "readonly")
    return req(tx.objectStore("outbox").getAll())
  }

  async markDirty(shards: string[], dirtyAt: number): Promise<void> {
    const tx = this.db.transaction("outbox", "readwrite")
    for (const shard of new Set(shards)) tx.objectStore("outbox").put({ shard, dirtyAt } satisfies OutboxEntry)
    await done(tx)
  }

  /** 上傳成功後清除；若上傳期間又有新修改（dirtyAt 變了）則保留。回傳是否已清除。 */
  async clearDirty(shard: string, expectedDirtyAt: number): Promise<boolean> {
    const tx = this.db.transaction("outbox", "readwrite")
    const store = tx.objectStore("outbox")
    let cleared = false
    // 在 onsuccess 回呼中直接刪除（不經過 await），確保仍在同一交易內
    const get = store.get(shard)
    get.onsuccess = () => {
      const current = get.result as OutboxEntry | undefined
      if (current && current.dirtyAt === expectedDirtyAt) {
        store.delete(shard)
        cleared = true
      }
    }
    await done(tx)
    return cleared
  }

  /** 登出並選擇「清除此裝置上的筆記」時使用。 */
  async clearAll(): Promise<void> {
    const tx = this.db.transaction(["own", "remote", "outbox", "meta"], "readwrite")
    for (const s of ["own", "remote", "outbox", "meta"]) tx.objectStore(s).clear()
    await done(tx)
  }
}
