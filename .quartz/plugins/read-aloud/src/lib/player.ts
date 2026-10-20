import type { SpeechController } from "./speech"

export interface PlayerVerse {
  number: number
  text: string
}

export interface PlayerEvents {
  onVerse(index: number): void
  /** finished＝整段唸完；stopped＝使用者（或換頁）中途停止；error＝語音引擎出錯，播放中止 */
  onIdle(reason: "finished" | "stopped" | "error"): void
}

export interface Player {
  play(fromIndex: number, rate: number): void
  stop(): void
  setRate(rate: number): void
  playing(): boolean
}

export function createPlayer(
  verses: readonly PlayerVerse[],
  speech: Pick<SpeechController, "speak" | "stop">,
  events: PlayerEvents,
): Player {
  let generation = 0
  let dispatch = 0
  let utteranceSequence = 0
  let activeUtterance: number | null = null
  let active = false
  let currentIndex = -1
  let currentRate = 1

  const finish = (run: number, reason: "finished" | "error" = "finished"): void => {
    if (run !== generation || !active) return

    active = false
    currentIndex = -1
    activeUtterance = null
    dispatch += 1
    events.onIdle(reason)
  }

  const startAt = (run: number, fromIndex: number): void => {
    if (run !== generation || !active) return

    let index = fromIndex
    while (index < verses.length && verses[index].text.trim().length === 0) {
      index += 1
    }

    if (index >= verses.length) {
      finish(run)
      return
    }

    currentIndex = index
    const currentDispatch = ++dispatch
    events.onVerse(index)

    if (
      run !== generation ||
      !active ||
      currentIndex !== index ||
      currentDispatch !== dispatch
    ) {
      return
    }

    const utterance = ++utteranceSequence
    activeUtterance = utterance

    speech.speak(verses[index].text, {
      rate: currentRate,
      onBoundary: () => {},
      onEnd: () => {
        if (
          run !== generation ||
          !active ||
          activeUtterance !== utterance
        ) {
          return
        }

        activeUtterance = null
        startAt(run, index + 1)
      },
      // 出錯就整個停下來，不要悄悄跳過每一節、把整章快速「唸」完
      onError: () => {
        if (run !== generation || !active || activeUtterance !== utterance) return

        speech.stop()
        finish(run, "error")
      },
    })
  }

  return {
    play(fromIndex: number, rate: number): void {
      const run = ++generation
      active = false
      currentIndex = -1
      activeUtterance = null
      dispatch += 1
      currentRate = rate

      speech.stop()
      if (run !== generation) return

      const requestedIndex = Number.isFinite(fromIndex) ? Math.trunc(fromIndex) : 0
      active = true
      startAt(run, Math.max(0, requestedIndex))
    },

    stop(): void {
      const wasActive = active
      const stopRun = ++generation
      active = false
      currentIndex = -1
      activeUtterance = null
      dispatch += 1

      speech.stop()
      if (wasActive && stopRun === generation && !active) {
        events.onIdle("stopped")
      }
    },

    setRate(rate: number): void {
      currentRate = rate
      if (!active || currentIndex < 0) return

      const run = generation
      const index = currentIndex
      activeUtterance = null
      dispatch += 1

      speech.stop()
      if (run !== generation || !active || currentIndex !== index) return

      startAt(run, index)
    },

    playing(): boolean {
      return active
    },
  }
}
