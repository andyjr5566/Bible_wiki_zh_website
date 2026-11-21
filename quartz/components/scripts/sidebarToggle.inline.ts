const preference = "bwz-left-sidebar-collapsed"
const root = document.documentElement

try {
  root.toggleAttribute("data-bwz-sidebar-collapsed", localStorage.getItem(preference) === "true")
} catch {
  // The control still works when browser storage is unavailable.
}

function syncToggle() {
  const toggle = document.querySelector<HTMLButtonElement>(".bwz-sidebar-toggle")
  if (!toggle) return
  const collapsed = root.hasAttribute("data-bwz-sidebar-collapsed")
  toggle.setAttribute("aria-expanded", String(!collapsed))
  toggle.title = collapsed ? "展開左欄" : "收合左欄"
  toggle.setAttribute("aria-label", toggle.title)
  toggle.hidden = false
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest(".bwz-sidebar-toggle")) return
  const collapsed = root.toggleAttribute("data-bwz-sidebar-collapsed")
  syncToggle()
  try {
    localStorage.setItem(preference, String(collapsed))
  } catch {
    // Keep the current setting in this document.
  }
})

document.addEventListener("DOMContentLoaded", syncToggle)
document.addEventListener("nav", syncToggle)
document.addEventListener("render", syncToggle)
