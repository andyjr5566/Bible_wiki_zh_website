// 延遲載入的筆記 App 入口（組裝根）：建立瀏覽器版的 Session，並把頁面上的掛載點交給各功能模組。
// 由頁面上的啟動腳本在需要時 import，並在每次 SPA 換頁後呼叫 mountAll()。

import { DriveAdapter } from "./adapter/drive"
import { DriveFiles } from "./adapter/driveFiles"
import { TokenManager } from "./auth/gis"
import { viewFactories } from "./features"
import type { View } from "./features/types"
import { Session, type ClientConfig, type KeyValueStore } from "./session/session"
import { NotesStore } from "./store/db"
import { SyncScheduler } from "./sync/scheduler"
import { detectInAppBrowser, deviceLabel } from "./ui/env"
import { browserPrompts } from "./ui/prompts"

const DISABLED_CONFIG: ClientConfig = {
  clientId: "",
  syncEnabled: false,
  minPollSeconds: 180,
  maxWritesPerMinute: 6,
  notice: "",
  appVersion: "0",
}

const localStore: KeyValueStore = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      // 私密瀏覽等情況無法寫入，不影響本次使用
    }
  },
}

async function loadConfig(base: string): Promise<ClientConfig | null> {
  try {
    const res = await fetch(`${base}/static/personal-notes/config.json`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as ClientConfig
  } catch {
    return null
  }
}

function createSession(config: ClientConfig): Session {
  return new Session({
    config,
    prompts: browserPrompts,
    tokens: config.syncEnabled && config.clientId ? new TokenManager(config.clientId) : null,
    inAppBrowser: detectInAppBrowser(),
    deviceLabel: deviceLabel(),
    storage: localStore,
    openStore: (name) => NotesStore.open(name),
    deleteStore: (name) => NotesStore.deleteDatabase(name),
    createAdapter: (getToken) => new DriveAdapter({ getToken, maxCallsPerMinute: 60 }),
    // 「存一份到我的 Google Drive」（D-45）：與同步共用同一個 token
    createDriveFiles: (getToken) => new DriveFiles({ getToken, maxCallsPerMinute: 60 }),
    createScheduler: ({ repo, syncer }, namespace) => new SyncScheduler({ repo, syncer, namespace, minPollSeconds: config.minPollSeconds }),
    requestPersistence: () => void navigator.storage?.persist?.().catch(() => undefined),
  })
}

let sessionPromise: Promise<Session | null> | null = null

function getSession(): Promise<Session | null> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const config = (await loadConfig(document.body.dataset.basepath ?? "")) ?? DISABLED_CONFIG
      try {
        const s = createSession(config)
        await s.init()
        return s
      } catch (e) {
        console.error("[personal-notes] 初始化失敗", e)
        return null
      }
    })()
  }
  return sessionPromise
}

// ---------- 掛載 ----------

interface Mounted {
  key: string
  hosts: HTMLElement[]
  views: View[]
}

const mounted = new Map<HTMLElement, Mounted>()

/** 掛載點代表的內容（種類＋書卷＋章…），不含版本號。 */
function mountKey(el: HTMLElement): string {
  return JSON.stringify(Object.entries(el.dataset).filter(([k]) => k !== "bwzVersion").sort())
}

/**
 * Quartz 換頁（micromorph）會沿用同一個元素、只換掉它的內容與屬性。所以除了元素還在頁面上，
 * 還要確認我們放進去的容器還在、而且掛載點代表的仍是同一章，否則要重新掛載。
 */
function stillMounted(el: HTMLElement, m: Mounted): boolean {
  return el.isConnected && m.key === mountKey(el) && m.hosts.every((host) => host.parentElement === el)
}

/** 掛載目前頁面上的所有掛載點；移除已不在頁面上或內容已被換掉的。 */
export async function mountAll(): Promise<void> {
  for (const [el, m] of mounted) {
    if (stillMounted(el, m)) continue
    for (const v of m.views) v.destroy()
    mounted.delete(el)
  }
  const targets = [...document.querySelectorAll<HTMLElement>("[data-bwz-notes]")].filter((el) => !mounted.has(el))
  if (targets.length === 0) return
  const session = await getSession()
  for (const el of targets) {
    if (mounted.has(el) || !el.isConnected) continue // 等待期間又換頁、或另一次 mountAll 已處理
    if (!session) {
      el.replaceChildren(document.createTextNode("筆記功能暫時無法使用（瀏覽器可能封鎖了本機儲存）。"))
      continue
    }
    const hosts: HTMLElement[] = []
    const views: View[] = []
    el.replaceChildren()
    for (const make of viewFactories(el.dataset.bwzNotes ?? "")) {
      const host = el.appendChild(document.createElement("div"))
      const view = make({ session, host, data: el.dataset })
      if (!view) {
        host.remove()
        continue
      }
      hosts.push(host)
      views.push(view)
    }
    mounted.set(el, { key: mountKey(el), hosts, views })
  }
}
