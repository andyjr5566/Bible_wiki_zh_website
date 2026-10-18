// 瀏覽器端排程（03 §4.2、§4.3、§4.6）：何時拉取、何時上傳、多分頁協調。
//
// - 上傳：輸入停頓 5 秒、或連續修改滿 60 秒；頁面隱藏／換頁時立即上傳。
// - 拉取：頁面可見時定期（從 minPollSeconds 起，沒有變化就逐步拉長到 10 分鐘）；
//   取得焦點時（距上次 > 30 秒）；恢復網路時。頁面隱藏時不輪詢。
// - 多分頁：每次同步都包在 Web Locks 裡（同一帳號一次只有一個分頁在同步）；
//   同步或本機修改後用 BroadcastChannel 通知其他分頁重新載入。

import type { Repository } from "../repo/repository"
import type { Syncer } from "./syncer"

const PUSH_IDLE_MS = 5_000
const PUSH_MAX_MS = 60_000
const FOCUS_PULL_MS = 30_000
const MAX_POLL_MS = 10 * 60_000

export interface SchedulerOptions {
  repo: Repository
  syncer: Syncer
  namespace: string
  minPollSeconds: number
}

export class SyncScheduler {
  private readonly repo: Repository
  private readonly syncer: Syncer
  private readonly lockName: string
  private readonly channel: BroadcastChannel | null
  private readonly minPollMs: number
  private pollMs: number
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private firstDirtyAt = 0
  private stopped = false
  private cleanups: (() => void)[] = []

  constructor(opts: SchedulerOptions) {
    this.repo = opts.repo
    this.syncer = opts.syncer
    this.lockName = `bwz-notes-sync-${opts.namespace}`
    this.minPollMs = Math.max(60, opts.minPollSeconds) * 1000
    this.pollMs = this.minPollMs
    this.channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`bwz-notes-${opts.namespace}`) : null
  }

  start(): void {
    // 「先同步再編輯」等所有同步入口都走同一把跨分頁鎖（Codex 審查 #2）
    this.syncer.setRunner(() => this.withLock(() => this.syncer.sync()).then(() => this.afterSync()))
    const on = (target: Window | Document, type: string, fn: (e: Event) => void) => {
      target.addEventListener(type, fn)
      this.cleanups.push(() => target.removeEventListener(type, fn))
    }
    on(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.flushNow()
        this.stopPolling()
      } else {
        this.maybePullOnFocus()
        this.schedulePoll()
      }
    })
    on(window, "pagehide", () => this.flushNow())
    on(document, "prenav", () => this.flushNow())
    on(window, "focus", () => this.maybePullOnFocus())
    on(window, "online", () => void this.syncNow())

    this.cleanups.push(this.repo.onLocalWrite(() => this.localWrite()))
    if (this.channel) {
      this.channel.onmessage = (ev) => {
        const type = (ev.data as { type?: string })?.type
        if (type === "changed") void this.repo.reloadFromStore()
        if (type === "local-write") this.schedulePush()
      }
    }
    void this.syncNow()
    this.schedulePoll()
  }

  stop(): void {
    this.stopped = true
    this.stopPolling()
    if (this.pushTimer) clearTimeout(this.pushTimer)
    for (const fn of this.cleanups) fn()
    this.cleanups = []
    this.channel?.close()
  }

  withLock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks
    if (locks?.request) return locks.request(this.lockName, fn) as Promise<T>
    return fn()
  }

  /** 立即同步（拉取＋上傳）。 */
  async syncNow(): Promise<void> {
    if (this.stopped) return
    await this.withLock(() => this.syncer.sync())
    await this.afterSync()
  }

  broadcastChanged(): void {
    this.channel?.postMessage({ type: "changed" })
  }

  /** 同步後通知其他分頁；若因寫入額度還有待上傳的分片，稍後續傳（Codex 審查 #10）。 */
  private async afterSync(): Promise<void> {
    this.broadcastChanged()
    if (this.stopped) return
    if ((await this.repo.pendingShards()) > 0 && !this.pushTimer && this.syncer.status.kind === "ready") {
      this.pushTimer = setTimeout(() => void this.pushNow(), 20_000)
    }
  }

  private localWrite(): void {
    this.channel?.postMessage({ type: "local-write" })
    this.pollMs = this.minPollMs
    this.schedulePush()
  }

  private schedulePush(): void {
    if (this.stopped) return
    const now = Date.now()
    if (!this.firstDirtyAt) this.firstDirtyAt = now
    if (this.pushTimer) clearTimeout(this.pushTimer)
    const wait = Math.max(0, Math.min(PUSH_IDLE_MS, this.firstDirtyAt + PUSH_MAX_MS - now))
    this.pushTimer = setTimeout(() => void this.pushNow(), wait)
  }

  private async pushNow(): Promise<void> {
    this.pushTimer = null
    this.firstDirtyAt = 0
    if (this.stopped) return
    await this.withLock(() => this.syncer.push())
    await this.afterSync()
  }

  /** 頁面隱藏、關閉、換頁：盡量立即上傳（資料已在本機，失敗也不會遺失）。 */
  private flushNow(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      void this.pushNow()
    }
  }

  private maybePullOnFocus(): void {
    if (Date.now() - this.syncer.lastPullAt > FOCUS_PULL_MS) void this.syncNow()
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = null
  }

  private schedulePoll(): void {
    this.stopPolling()
    if (this.stopped || document.visibilityState === "hidden") return
    this.pollTimer = setTimeout(async () => {
      const before = this.syncer.remoteRevision
      await this.syncNow()
      // 沒有收到新資料就逐步拉長間隔，有就回到最短間隔
      const changed = this.syncer.remoteRevision !== before
      this.pollMs = changed ? this.minPollMs : Math.min(Math.round(this.pollMs * 1.5), MAX_POLL_MS)
      this.schedulePoll()
    }, this.pollMs)
  }
}
