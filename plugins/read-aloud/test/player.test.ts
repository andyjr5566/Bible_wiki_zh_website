// @vitest-environment node
import { describe, expect, it } from "vitest"
import { createPlayer } from "../src/lib/player"
import type { SpeechController, SpeakOptions } from "../src/lib/speech"

interface SpeechCall {
  text: string
  options: SpeakOptions
}

function fakeSpeech(): {
  speech: Pick<SpeechController, "speak" | "stop">
  calls: SpeechCall[]
  stopCount(): number
} {
  const calls: SpeechCall[] = []
  let stops = 0

  const speech: Pick<SpeechController, "speak" | "stop"> = {
    speak(text, options) {
      calls.push({ text, options })
    },
    stop() {
      stops += 1
    },
  }

  return {
    speech,
    calls,
    stopCount: () => stops,
  }
}

describe("朗讀播放器", () => {
  it("依序唸完每一節並在最後回到待命", () => {
    const fake = fakeSpeech()
    const verses = [
      { number: 1, text: "第一節" },
      { number: 2, text: "第二節" },
      { number: 3, text: "第三節" },
    ]
    const announced: number[] = []
    let idleCount = 0
    const player = createPlayer(verses, fake.speech, {
      onVerse(index) {
        announced.push(index)
      },
      onIdle() {
        idleCount += 1
      },
    })

    player.play(0, 1)
    expect(fake.calls.map((call) => call.text)).toEqual(["第一節"])
    expect(announced).toEqual([0])
    expect(player.playing()).toBe(true)

    fake.calls[0].options.onEnd()
    expect(fake.calls.map((call) => call.text)).toEqual(["第一節", "第二節"])
    expect(announced).toEqual([0, 1])

    fake.calls[1].options.onEnd()
    expect(fake.calls.map((call) => call.text)).toEqual(["第一節", "第二節", "第三節"])
    expect(announced).toEqual([0, 1, 2])

    fake.calls[2].options.onEnd()
    expect(player.playing()).toBe(false)
    expect(idleCount).toBe(1)
  })

  it("跳過去除頭尾空白後為空的項目", () => {
    const fake = fakeSpeech()
    const announced: number[] = []
    const player = createPlayer(
      [
        { number: 1, text: "  " },
        { number: 2, text: " 第一節 " },
        { number: 3, text: "\n\t" },
        { number: 4, text: "第二節" },
      ],
      fake.speech,
      {
        onVerse(index) {
          announced.push(index)
        },
        onIdle() {},
      },
    )

    player.play(0, 1)
    expect(fake.calls.map((call) => call.text)).toEqual([" 第一節 "])
    expect(announced).toEqual([1])

    fake.calls[0].options.onEnd()
    expect(fake.calls.map((call) => call.text)).toEqual([" 第一節 ", "第二節"])
    expect(announced).toEqual([1, 3])
  })

  it("停止後忽略遲到的唸完回呼", () => {
    const fake = fakeSpeech()
    let idleCount = 0
    const player = createPlayer([{ number: 1, text: "第一節" }], fake.speech, {
      onVerse() {},
      onIdle() {
        idleCount += 1
      },
    })

    player.play(0, 1)
    const lateOnEnd = fake.calls[0].options.onEnd

    player.stop()
    lateOnEnd()

    expect(player.playing()).toBe(false)
    expect(fake.calls).toHaveLength(1)
    expect(idleCount).toBe(1)
  })

  it("播放中調整語速時從目前這一節重新開始", () => {
    const fake = fakeSpeech()
    const announced: number[] = []
    const player = createPlayer(
      [
        { number: 1, text: "第一節" },
        { number: 2, text: "第二節" },
        { number: 3, text: "第三節" },
      ],
      fake.speech,
      {
        onVerse(index) {
          announced.push(index)
        },
        onIdle() {},
      },
    )

    player.play(0, 1)
    fake.calls[0].options.onEnd()
    const lateOnEnd = fake.calls[1].options.onEnd

    player.setRate(1.25)
    expect(fake.calls).toHaveLength(3)
    expect(fake.calls[2].text).toBe("第二節")
    expect(fake.calls[2].options.rate).toBe(1.25)
    expect(announced).toEqual([0, 1, 1])

    lateOnEnd()
    expect(fake.calls).toHaveLength(3)

    fake.calls[2].options.onEnd()
    expect(fake.calls[3].text).toBe("第三節")
  })

  it("空清單與全空白清單直接回到待命", () => {
    const emptyFake = fakeSpeech()
    let emptyIdleCount = 0
    const emptyPlayer = createPlayer([], emptyFake.speech, {
      onVerse() {},
      onIdle() {
        emptyIdleCount += 1
      },
    })

    emptyPlayer.play(0, 1)
    expect(emptyFake.calls).toHaveLength(0)
    expect(emptyIdleCount).toBe(1)
    expect(emptyPlayer.playing()).toBe(false)

    const blankFake = fakeSpeech()
    let blankIdleCount = 0
    const blankPlayer = createPlayer(
      [
        { number: 1, text: " " },
        { number: 2, text: "\n\t" },
      ],
      blankFake.speech,
      {
        onVerse() {},
        onIdle() {
          blankIdleCount += 1
        },
      },
    )

    blankPlayer.play(0, 1)
    expect(blankFake.calls).toHaveLength(0)
    expect(blankIdleCount).toBe(1)
  })

  it("重複播放時讓舊的唸完回呼失效", () => {
    const fake = fakeSpeech()
    const announced: number[] = []
    let idleCount = 0
    const player = createPlayer(
      [
        { number: 1, text: "第一節" },
        { number: 2, text: "第二節" },
      ],
      fake.speech,
      {
        onVerse(index) {
          announced.push(index)
        },
        onIdle() {
          idleCount += 1
        },
      },
    )

    player.play(0, 1)
    const lateOnEnd = fake.calls[0].options.onEnd

    player.play(1, 1.25)
    lateOnEnd()

    expect(fake.calls).toHaveLength(2)
    expect(fake.calls[1].text).toBe("第二節")
    expect(fake.calls[1].options.rate).toBe(1.25)
    expect(announced).toEqual([0, 1])
    expect(idleCount).toBe(0)

    fake.calls[1].options.onEnd()
    expect(idleCount).toBe(1)
  })
})
