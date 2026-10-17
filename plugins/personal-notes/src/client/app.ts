// 延遲載入的筆記 App 入口。由頁面上的啟動腳本在需要時 import，並在每次 SPA 換頁後呼叫 mountAll()。

import { Controller, type ClientConfig } from "./controller"
import { ChapterPanel } from "./ui/chapterPanel"
import { MyNotesPage } from "./ui/myNotes"

let controllerPromise: Promise<Controller | null> | null = null
const mounted = new Map<HTMLElement, { destroy(): void }>()

async function loadConfig(base: string): Promise<ClientConfig | null> {
  try {
    const res = await fetch(`${base}/static/personal-notes/config.json`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as ClientConfig
  } catch {
    return null
  }
}

function getController(): Promise<Controller | null> {
  if (!controllerPromise) {
    controllerPromise = (async () => {
      const base = document.body.dataset.basepath ?? ""
      const config = (await loadConfig(base)) ?? {
        clientId: "",
        syncEnabled: false,
        minPollSeconds: 180,
        maxWritesPerMinute: 6,
        notice: "",
        appVersion: "0",
      }
      try {
        const c = new Controller(config)
        await c.init()
        return c
      } catch (e) {
        console.error("[personal-notes] 初始化失敗", e)
        return null
      }
    })()
  }
  return controllerPromise
}

/** 掛載目前頁面上的所有筆記元件；移除已不在頁面上的。 */
export async function mountAll(): Promise<void> {
  for (const [el, view] of mounted) {
    if (!document.body.contains(el)) {
      view.destroy()
      mounted.delete(el)
    }
  }
  const targets = [...document.querySelectorAll<HTMLElement>("[data-bwz-notes]")].filter((el) => !mounted.has(el))
  if (targets.length === 0) return
  const c = await getController()
  for (const el of targets) {
    if (!c) {
      el.replaceChildren(document.createTextNode("筆記功能暫時無法使用（瀏覽器可能封鎖了本機儲存）。"))
      continue
    }
    const kind = el.dataset.bwzNotes
    if (kind === "chapter") {
      const book = el.dataset.book ?? ""
      const chapter = Number(el.dataset.chapter)
      if (book && chapter) mounted.set(el, new ChapterPanel(c, el, book, chapter))
    } else if (kind === "mynotes") {
      mounted.set(el, new MyNotesPage(c, el))
    }
  }
}
