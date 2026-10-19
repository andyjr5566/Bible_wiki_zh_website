// 筆記操作教學（D-49，13 §6）：〈我的筆記〉頁標題列的「▶ 筆記教學」按鈕，打開動畫示範＋自己試的對話框。
// 網址 ?tutorial=1 會自動打開（網站導覽的筆記那一站連到這裡），打開後把參數拿掉。
// 教學只畫一個假的示範頁，完全不讀寫真正的筆記資料。

import type { Session } from "../../session/session"
import { shellFor, type MyNotesShell } from "../../ui/myNotesShell"
import type { Feature, View } from "../types"
import { openTutorial, type TutorialHandle } from "./dialog"

const ACTION_ID = "tutorial"

/** 網址有 ?tutorial=1 嗎？有的話順便把參數從網址拿掉（保留其他參數與 #）。 */
export function consumeTutorialParam(): boolean {
  try {
    const url = new URL(location.href)
    if (url.searchParams.get("tutorial") !== "1") return false
    url.searchParams.delete("tutorial")
    history.replaceState(history.state, "", url.pathname + url.search + url.hash)
    return true
  } catch {
    return false
  }
}

class TutorialLauncher implements View {
  private readonly shell: MyNotesShell
  private handle: TutorialHandle | null = null
  private dead = false

  constructor(session: Session, host: HTMLElement) {
    this.shell = shellFor(host, session)
    this.shell.addAction({ id: ACTION_ID, label: "▶ 筆記教學", order: 10, onClick: (button) => this.open(button) })
    if (consumeTutorialParam()) {
      // 等頁面外框與其他分頁登記完再打開
      setTimeout(() => {
        if (!this.dead) this.open(this.shell.root.querySelector<HTMLElement>(`[data-action="${ACTION_ID}"]`))
      }, 0)
    }
  }

  private open(opener: HTMLElement | null): void {
    if (this.handle) return
    const handle = openTutorial(opener)
    this.handle = handle
    void handle.closed.then(() => {
      if (this.handle === handle) this.handle = null
    })
  }

  destroy(): void {
    this.dead = true
    this.handle?.close()
    this.shell.removeAction(ACTION_ID)
  }
}

export const tutorialFeature: Feature = {
  id: "tutorial",
  views: {
    mynotes: ({ session, host }) => new TutorialLauncher(session, host),
  },
}
