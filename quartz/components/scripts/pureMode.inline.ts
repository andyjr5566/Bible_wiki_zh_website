// pureMode.inline.ts
// 聖經研讀知識庫 - 素色黑白 / 古典紙質底色切換引擎

// 1. 在 <head> 階段立即執行，依據本機偏好套用底色屬性，杜絕畫面閃爍
;(function () {
  try {
    const saved = localStorage.getItem("theme-bg")
    if (saved === "pure") {
      document.documentElement.setAttribute("data-bg", "pure")
    }
  } catch {}
})()

function togglePureMode() {
  const isPure = document.documentElement.getAttribute("data-bg") === "pure"
  if (isPure) {
    document.documentElement.removeAttribute("data-bg")
    localStorage.setItem("theme-bg", "paper")
  } else {
    document.documentElement.setAttribute("data-bg", "pure")
    localStorage.setItem("theme-bg", "pure")
  }

  const newBg = document.documentElement.getAttribute("data-bg") || "paper"
  const event = new CustomEvent("bgchange", { detail: { bg: newBg } })
  document.dispatchEvent(event)
}

function mountPureModeButton() {
  const toolbar = document.querySelector(".left.sidebar .flex-component")
  if (!toolbar) return
  if (toolbar.querySelector(".puremode")) return

  const wrapper = document.createElement("div")
  wrapper.style.cssText =
    "flex-grow: 0; flex-shrink: 1; flex-basis: auto; order: 0; align-self: center; justify-self: center;"

  const btn = document.createElement("button")
  btn.className = "puremode"
  btn.setAttribute("type", "button")
  btn.setAttribute("aria-label", "切換素色黑白 / 古典紙質底色")

  // pureIcon: 典雅藏書印章『素』（提示當前為紙感，點擊切換為素色）
  // paperIcon: 典雅藏書印章『紙』（提示當前為純色，點擊切換回紙質）
  btn.innerHTML = `
    <svg class="pureIcon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <title>切換為素色黑白背景（純白／純黑）</title>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" stroke="currentColor"></rect>
      <text x="12" y="16.2" font-size="11.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">素</text>
    </svg>
    <svg class="paperIcon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <title>切換為古典紙質背景（羊皮紙／暖炭黑）</title>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" stroke="currentColor" fill="currentColor" fill-opacity="0.12"></rect>
      <text x="12" y="16.2" font-size="11.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">紙</text>
    </svg>
  `

  btn.addEventListener("click", togglePureMode)
  wrapper.appendChild(btn)
  toolbar.appendChild(wrapper)
}

// 註冊 SPA 導航與 DOM 加載事件
document.addEventListener("nav", mountPureModeButton)

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPureModeButton)
} else {
  mountPureModeButton()
}

