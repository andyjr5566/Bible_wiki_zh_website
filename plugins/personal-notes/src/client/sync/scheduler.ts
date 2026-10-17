// 瀏覽器端排程（03 §4.2、§4.3、§4.6）：何時拉取、何時上傳、多分頁協調。
//
// - 上傳：輸入停頓 5 秒、或連續修改滿 60 秒；頁面隱藏／換頁時立即上傳。
// - 拉取：頁面可見時定期（從 minPollSeconds 起，沒有變化就逐步拉長到 10 分鐘）；
//   取得焦點時（距上次 > 30 秒）；恢復網路時。頁面隱藏時不輪詢。
// - 多分頁：每次同步都包在 Web Locks 裡（同一帳號一次只有一個分頁在同步）；
//   同步或本機修改後用 BroadcastChannel 通知其他分頁重新載入。

import type { NotesEngine } from "./engine"

const PUSH_IDLE_MS = 5_000
const PUSH_MAX_MS = 60_000
const FOCUS_PULL_MS = 30_000
const MAX_POLL_MS = 10 * 60_000

export interface SchedulerOptions {
  engine: NotesEngine
  namespace: string
  minPollSeconds: number
}

export class SyncScheduler {
  private readonly engine: NotesEngine
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
    this.engine = opts.engine
    this.lockName = `bwz-notes-sync-${opts.namespace}`
    this.minPollMs = Math.max(60, opts.minPollSeconds) * 1000
    this.pollMs = this.minPollMs
    this.channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`bwz-notes-${opts.namespace}`) : null
  }

  start(): void {
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

    this.cleanups.push(this.engine.onLocalWrite(() => this.localWrite()))
    if (this.channel) {
      this.channel.onmessage = (ev) => {
        const type = (ev.data as { type?: string })?.type
        if (type === "changed") void this.engine.reloadFromStore()
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

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks
    if (locks?.request) return locks.request(this.lockName, fn) as Promise<T>
    return fn()
  }

  /** 立即同步（拉取＋上傳）。 */
  async syncNow(): Promise<void> {
    if (this.stopped) return
    await this.withLock(() => this.engine.sync())
    this.channel?.postMessage({ type: "changed" })
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
    await this.withLock(() => this.engine.push())
    this.channel?.postMessage({ type: "changed" })
  }

  /** 頁面隱藏、關閉、換頁：盡量立即上傳（資料已在本機，失敗也不會遺失）。 */
  private flushNow(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      void this.pushNow()
    }
  }

  private maybePullOnFocus(): void {
    if (Date.now() - this.engine.lastPullAt > FOCUS_PULL_MS) void this.syncNow()
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = null
  }

  private schedulePoll(): void {
    this.stopPolling()
    if (this.stopped || document.visibilityState === "hidden") return
    this.pollTimer = setTimeout(async () => {
      const before = this.engine.remoteRevision
      await this.syncNow()
      // 沒有收到新資料就逐步拉長間隔，有就回到最短間隔
      const changed = this.engine.remoteRevision !== before
      this.pollMs = changed ? this.minPollMs : Math.min(Math.round(this.pollMs * 1.5), MAX_POLL_MS)
      this.schedulePoll()
    }, this.pollMs)
  }
}
