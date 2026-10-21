// 「Aa 外觀」面板：底色／字級／經文連結。按鈕由伺服器端畫在左上工具列，面板在按下按鈕時才建立。
import {
  DEFAULTS,
  applySettings,
  readSettings,
  writeSetting,
  type SettingName,
  type Settings,
} from "../../lib/settings"
import { markVerseList } from "../../lib/verses"

interface GroupSpec {
  name: SettingName
  label: string
  options: ReadonlyArray<readonly [string, string]>
}

const GROUPS: GroupSpec[] = [
  {
    name: "bg",
    label: "底色",
    options: [
      ["paper", "紙質"],
      ["pure", "素色"],
    ],
  },
  {
    name: "fontSize",
    label: "字級",
    options: [
      ["s", "小"],
      ["m", "中"],
      ["l", "大"],
    ],
  },
  {
    name: "links",
    label: "經文連結",
    options: [
      ["normal", "明顯"],
      ["quiet", "低調"],
      ["hidden", "隱藏"],
    ],
  },
]

const PANEL_ID = "site-ux-panel"

interface OpenPanel {
  el: HTMLElement
  button: HTMLElement
  cleanup: () => void
}

interface QuartzWindow extends Window {
  addCleanup?: (fn: () => void) => void
}

let current: OpenPanel | null = null

function applyAll(settings: Settings): void {
  applySettings(settings)
  markVerseList()
}

function announceBg(bg: string): void {
  // 沿用舊「素」按鈕發出的事件，其他程式若有監聽不受影響
  document.dispatchEvent(new CustomEvent("bgchange", { detail: { bg } }))
}

function change(name: SettingName, value: string): void {
  const next = { ...readSettings(), [name]: value } as Settings
  writeSetting(name, value as never)
  // 即使儲存失敗（隱私模式），畫面仍然套用這次的選擇
  applyAll({ ...next })
  if (name === "bg") announceBg(value)
}

function resetAll(): void {
  for (const group of GROUPS) writeSetting(group.name, DEFAULTS[group.name] as never)
  applyAll({ ...DEFAULTS })
  announceBg(DEFAULTS.bg)
}

/** 目前畫面上實際套用的設定（讀 <html> 屬性，所以儲存失敗時面板也和畫面一致）。 */
function currentSettings(): Settings {
  const root = document.documentElement
  const fs = root.getAttribute("data-ux-fs")
  const links = root.getAttribute("data-ux-links")
  return {
    bg: root.getAttribute("data-bg") === "pure" ? "pure" : "paper",
    fontSize: fs === "s" || fs === "l" ? fs : "m",
    links: links === "quiet" || links === "hidden" ? links : "normal",
  }
}

function syncChecked(panel: HTMLElement): void {
  const settings = currentSettings()
  for (const radio of Array.from(panel.querySelectorAll<HTMLElement>("[role=radio]"))) {
    const name = radio.dataset.name as SettingName
    const on = String(settings[name]) === radio.dataset.value
    radio.setAttribute("aria-checked", on ? "true" : "false")
    radio.tabIndex = on ? 0 : -1
  }
}

function buildPanel(): HTMLElement {
  const panel = document.createElement("div")
  panel.id = PANEL_ID
  panel.className = "site-ux-panel"
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-label", "外觀")

  const header = document.createElement("div")
  header.className = "site-ux-head"
  const title = document.createElement("span")
  title.className = "site-ux-title"
  title.textContent = "外觀"
  const closeButton = document.createElement("button")
  closeButton.type = "button"
  closeButton.className = "site-ux-close"
  closeButton.setAttribute("aria-label", "關閉")
  closeButton.textContent = "×"
  closeButton.dataset.action = "close"
  header.append(title, closeButton)
  panel.append(header)

  for (const group of GROUPS) {
    const wrap = document.createElement("div")
    wrap.className = "site-ux-group"
    const labelId = `site-ux-label-${group.name}`
    const label = document.createElement("div")
    label.className = "site-ux-label"
    label.id = labelId
    label.textContent = group.label
    const seg = document.createElement("div")
    seg.className = "site-ux-seg"
    seg.setAttribute("role", "radiogroup")
    seg.setAttribute("aria-labelledby", labelId)
    for (const [value, text] of group.options) {
      const radio = document.createElement("button")
      radio.type = "button"
      radio.className = "site-ux-opt"
      radio.setAttribute("role", "radio")
      radio.dataset.name = group.name
      radio.dataset.value = value
      radio.textContent = text
      seg.append(radio)
    }
    wrap.append(label, seg)
    panel.append(wrap)
  }

  const reset = document.createElement("button")
  reset.type = "button"
  reset.className = "site-ux-reset"
  reset.dataset.action = "reset"
  reset.textContent = "恢復預設"
  panel.append(reset)

  syncChecked(panel)
  return panel
}

function place(panel: HTMLElement, button: HTMLElement): void {
  const margin = 8
  const rect = button.getBoundingClientRect()
  const width = Math.min(340, window.innerWidth - margin * 2)
  panel.style.width = `${width}px`
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))
  const top = Math.max(margin, rect.bottom + 6)
  panel.style.left = `${left}px`
  panel.style.top = `${top}px`
  panel.style.maxHeight = `${Math.max(160, window.innerHeight - top - margin)}px`
}

function closePanel(restoreFocus: boolean): void {
  if (!current) return
  const { el, button, cleanup } = current
  current = null
  cleanup()
  el.remove()
  button.setAttribute("aria-expanded", "false")
  if (restoreFocus) button.focus()
}

function moveRadio(radio: HTMLElement, delta: number | "first" | "last"): void {
  const group = Array.from(
    radio.parentElement?.querySelectorAll<HTMLElement>("[role=radio]") ?? [],
  )
  let next: number
  if (delta === "first") next = 0
  else if (delta === "last") next = group.length - 1
  else next = (group.indexOf(radio) + delta + group.length) % group.length
  const target = group[next]
  if (!target) return
  target.focus()
  target.click() // 方向鍵移動就同時選取（和原生 radio 一樣）
}

function openPanel(button: HTMLElement): void {
  closePanel(false)
  const panel = buildPanel()
  document.body.append(panel)
  button.setAttribute("aria-expanded", "true")
  button.setAttribute("aria-controls", PANEL_ID)
  place(panel, button)

  const onPanelClick = (event: Event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button")
    if (!target) return
    if (target.dataset.action === "close") return closePanel(true)
    if (target.dataset.action === "reset") {
      resetAll()
      syncChecked(panel)
      return
    }
    if (target.getAttribute("role") === "radio") {
      change(target.dataset.name as SettingName, target.dataset.value as string)
      syncChecked(panel)
    }
  }

  const onPanelKey = (event: KeyboardEvent) => {
    if (event.key === "Tab") {
      // 面板開著時 Tab 只在面板內循環；Esc 才離開
      const stops = Array.from(panel.querySelectorAll<HTMLElement>("button")).filter(
        (b) => b.tabIndex >= 0,
      )
      const first = stops[0]
      const last = stops[stops.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first?.focus()
      }
      return
    }
    const radio = (event.target as HTMLElement).closest<HTMLElement>("[role=radio]")
    if (!radio) return
    let delta: number | "first" | "last" | null = null
    if (event.key === "ArrowRight" || event.key === "ArrowDown") delta = 1
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") delta = -1
    else if (event.key === "Home") delta = "first"
    else if (event.key === "End") delta = "last"
    if (delta === null) return
    event.preventDefault()
    moveRadio(radio, delta)
  }

  const outside = (event: Event) => {
    const target = event.target as Node
    if (panel.contains(target) || button.contains(target)) return
    closePanel(false)
  }
  const onDocKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    closePanel(true)
  }
  const onResize = () => place(panel, button)

  panel.addEventListener("click", onPanelClick)
  panel.addEventListener("keydown", onPanelKey)
  document.addEventListener("pointerdown", outside, true)
  document.addEventListener("focusin", outside)
  document.addEventListener("keydown", onDocKey)
  window.addEventListener("resize", onResize)
  window.addEventListener("scroll", onResize, true)

  current = {
    el: panel,
    button,
    cleanup: () => {
      panel.removeEventListener("click", onPanelClick)
      panel.removeEventListener("keydown", onPanelKey)
      document.removeEventListener("pointerdown", outside, true)
      document.removeEventListener("focusin", outside)
      document.removeEventListener("keydown", onDocKey)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    },
  }

  const first =
    panel.querySelector<HTMLElement>("[role=radio][aria-checked=true]") ??
    panel.querySelector<HTMLElement>("button")
  first?.focus()
}

function setup(): void {
  closePanel(false)
  applyAll(readSettings())

  for (const button of Array.from(document.querySelectorAll<HTMLElement>(".site-ux-btn"))) {
    const onClick = () => {
      if (current && current.button === button) closePanel(true)
      else openPanel(button)
    }
    button.addEventListener("click", onClick)
    ;(window as QuartzWindow).addCleanup?.(() => button.removeEventListener("click", onClick))
  }
}

document.addEventListener("nav", setup)
document.addEventListener("prenav", () => closePanel(false))
