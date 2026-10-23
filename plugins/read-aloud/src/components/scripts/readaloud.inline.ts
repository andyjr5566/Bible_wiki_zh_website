import { createSpeech } from "../../lib/speech"
import { SPEECH_FIXES } from "../../lib/speech-fixes"
import { createPlayer } from "../../lib/player"
import type { Player } from "../../lib/player"
import { findScriptureVerses } from "../../lib/verses"
import type { Verse } from "../../lib/verses"

interface ReadAloudWindow extends Window {
  __bwzReadAloudBound?: boolean
}

const RATE_OPTIONS = [
  { value: 0.75, label: "0.75×" },
  { value: 1, label: "1.0×" },
  { value: 1.25, label: "1.25×" },
  { value: 1.5, label: "1.5×" },
  { value: 1.75, label: "1.75×" },
  { value: 2, label: "2.0×" },
] as const

const RATE_STORAGE_KEY = "bwz-read-aloud-rate"
const speech = createSpeech({ replacements: SPEECH_FIXES })
const readAloudWindow = window as ReadAloudWindow

let player: Player | null = null
let activeBar: HTMLDivElement | null = null
let activeVerses: Verse[] = []
let mountGeneration = 0

function removeVerseMarkers(): void {
  for (const verse of activeVerses) {
    verse.el.classList.remove("bwz-ra-now")
  }

  for (const element of Array.from(document.querySelectorAll(".bwz-ra-now"))) {
    element.classList.remove("bwz-ra-now")
  }
}

function teardown(): void {
  mountGeneration += 1

  const oldPlayer = player
  player = null
  oldPlayer?.stop()
  speech.stop()

  removeVerseMarkers()
  activeBar?.remove()
  activeBar = null
  activeVerses = []
}

// 手機版站上的頂端列（.left.sidebar）是 sticky 貼頂的；朗讀列貼頂時要排在它下面，不能蓋住它。
// 桌面版左欄是獨立的一欄，朗讀列貼在視窗最上面即可。
function stickyTop(): number {
  if (!window.matchMedia("(max-width: 800px)").matches) return 0
  const header = document.querySelector<HTMLElement>(".left.sidebar")
  if (!header || getComputedStyle(header).position !== "sticky") return 0
  return Math.max(0, Math.round(header.getBoundingClientRect().height))
}

function readSavedRate(): number {
  try {
    const saved = window.localStorage.getItem(RATE_STORAGE_KEY)
    const rate = Number(saved)
    return RATE_OPTIONS.some((option) => option.value === rate) ? rate : 1
  } catch {
    return 1
  }
}

function mount(): Promise<void> {
  teardown()
  const generation = mountGeneration
  const verses = findScriptureVerses(document)
  if (!verses) return Promise.resolve()
  if (!speech.supported()) return Promise.resolve()

  return mountWhenReady(verses, generation)
}

async function mountWhenReady(verses: Verse[], generation: number): Promise<void> {
  let ready = false
  try {
    ready = await speech.ready()
  } catch {
    return
  }

  if (!ready || generation !== mountGeneration) return

  const list = verses[0]?.el.parentElement
  if (!list || !list.isConnected) return

  const bar = document.createElement("div")
  bar.className = "bwz-ra"
  bar.setAttribute("role", "group")
  bar.setAttribute("aria-label", "經文朗讀")

  const title = document.createElement("span")
  title.textContent = "🔊 朗讀"
  bar.append(title)

  const startSelect = document.createElement("select")
  startSelect.setAttribute("aria-label", "開始節數")
  for (const [index, verse] of verses.entries()) {
    const option = document.createElement("option")
    option.value = String(index)
    option.textContent = String(verse.number)
    startSelect.append(option)
  }

  const startLabel = document.createElement("label")
  startLabel.append("從第 ", startSelect, " 節")
  bar.append(startLabel)

  const selectedRate = readSavedRate()
  const rateSelect = document.createElement("select")
  rateSelect.setAttribute("aria-label", "語速")
  for (const optionData of RATE_OPTIONS) {
    const option = document.createElement("option")
    option.value = String(optionData.value)
    option.textContent = optionData.label
    rateSelect.append(option)
  }
  rateSelect.value = String(selectedRate)

  const rateLabel = document.createElement("label")
  rateLabel.append("語速 ", rateSelect)
  bar.append(rateLabel)

  const button = document.createElement("button")
  button.type = "button"
  button.textContent = "▶ 播放"
  button.setAttribute("aria-pressed", "false")
  bar.append(button)

  // 語音出錯時在這裡說明（空的時候 CSS 會把它收起來）
  const message = document.createElement("div")
  message.className = "bwz-ra-msg"
  message.setAttribute("role", "status")
  bar.append(message)

  let highlighted: HTMLLIElement | null = null

  const currentPlayer = createPlayer(verses, speech, {
    onVerse(index) {
      const verse = verses[index]
      if (!verse) return

      for (const item of verses) {
        item.el.classList.remove("bwz-ra-now")
      }
      highlighted = verse.el
      verse.el.classList.add("bwz-ra-now")

      startSelect.value = String(index)
      message.textContent = ""
      bar.style.top = `${stickyTop()}px`
      bar.classList.add("is-playing")
      button.textContent = "■ 停止"
      button.setAttribute("aria-pressed", "true")

      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      verse.el.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      })
    },

    onIdle(reason) {
      if (highlighted) {
        highlighted.classList.remove("bwz-ra-now")
        highlighted = null
      }
      for (const verse of verses) {
        verse.el.classList.remove("bwz-ra-now")
      }
      bar.classList.remove("is-playing")
      button.textContent = "▶ 播放"
      button.setAttribute("aria-pressed", "false")
      // 整章唸完才回到第 1 節；中途停止就留在最後唸的那一節，方便接著再聽
      if (reason === "finished") startSelect.value = "0"
      if (reason === "error") message.textContent = "沒辦法朗讀：瀏覽器沒有允許發聲，或語音出了問題。請再按一次「播放」。"
    },
  })

  player = currentPlayer
  activeBar = bar
  activeVerses = verses
  // 互動網站的上方一行（建置時插在經文正前方，U-24）要在朗讀列下面、緊貼第 1 節，所以朗讀列放在它前面
  const interactiveLine = list.previousElementSibling
  ;(interactiveLine?.classList.contains("bwz-ia-line") ? interactiveLine : list).before(bar)

  button.addEventListener("click", () => {
    if (player !== currentPlayer) return
    if (currentPlayer.playing()) {
      currentPlayer.stop()
      return
    }
    currentPlayer.play(Number(startSelect.value), Number(rateSelect.value))
  })

  startSelect.addEventListener("change", () => {
    if (player === currentPlayer && currentPlayer.playing()) {
      currentPlayer.play(Number(startSelect.value), Number(rateSelect.value))
    }
  })

  rateSelect.addEventListener("change", () => {
    if (player !== currentPlayer) return

    const rate = Number(rateSelect.value)
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(rate))
    } catch {}

    if (currentPlayer.playing()) {
      currentPlayer.setRate(rate)
    }
  })
}

if (!readAloudWindow.__bwzReadAloudBound) {
  readAloudWindow.__bwzReadAloudBound = true

  document.addEventListener("nav", () => void mount())
  document.addEventListener("prenav", teardown)
  window.addEventListener("pagehide", teardown)
  // 從瀏覽器的上一頁快取還原時不會再收到 nav，要自己重建朗讀列
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void mount()
  })

  // 腳本若晚於第一個 nav 才載入，補掛一次（mount 開頭會先 teardown，重複呼叫是安全的）
  if (document.readyState !== "loading") void mount()
}
