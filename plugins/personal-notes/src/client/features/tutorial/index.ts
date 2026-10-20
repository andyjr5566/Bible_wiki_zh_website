// 筆記操作教學（D-49，13 §6）：〈我的筆記〉頁標題列的「▶ 筆記教學」按鈕，打開動畫示範＋自己試的對話框。
// 網址 ?tutorial=1 會自動打開（網站導覽的筆記那一站連到這裡），打開後把參數拿掉。
// ?device=touch|desktop 可以指定教學版本。
// 教學只畫一個假的示範頁，完全不讀寫真正的筆記資料。

import type { Session } from "../../session/session"
import { shellFor, type MyNotesShell } from "../../ui/myNotesShell"
import type { Feature, View } from "../types"
import { openTutorial, type TutorialHandle } from "./dialog"
import { initialDevice } from "./device"

const ACTION_ID = "tutorial"

/** 網址有 ?tutorial=1 嗎？有的話順便把參數從網址拿掉（保留其他參數與 #）。 */
export function consumeTutorialParam(): { device: string | null } | null {
  try {
    const url = new URL(location.href)
    if (url.searchParams.get("tutorial") !== "1") return null
    const device = url.searchParams.get("device")
    url.searchParams.delete("tutorial")
    url.searchParams.delete("device")
    history.replaceState(history.state, "", url.pathname + url.search + url.hash)
    return { device }
  } catch {
    return null
  }
}

class TutorialLauncher implements View {
  private readonly shell: MyNotesShell
  private handle: TutorialHandle | null = null
  private dead = false

  constructor(session: Session, host: HTMLElement) {
    this.shell = shellFor(host, session)
    this.shell.addAction({ id: ACTION_ID, label: "▶ 筆記教學", order: 10, onClick: (button) => this.open(button) })
    const param = consumeTutorialParam()
    if (param) {
      // 等頁面外框與其他分頁登記完再打開
      setTimeout(() => {
        if (!this.dead) this.open(this.shell.root.querySelector<HTMLElement>(`[data-action="${ACTION_ID}"]`), initialDevice(param.device))
      }, 0)
    }
  }

  private open(opener: HTMLElement | null, device?: ReturnType<typeof initialDevice>): void {
    if (this.handle) return
    const handle = device ? openTutorial(opener, undefined, device) : openTutorial(opener)
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
