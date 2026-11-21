import type { FontFamily } from "./settings"

// The default and sans-serif fonts are already provided by the site's typography.
export function syncReadingFont(font: FontFamily): void {
  const id = "site-ux-serif-font"
  const current = document.getElementById(id)
  if (font !== "serif") {
    current?.remove()
    return
  }
  if (current) return

  const link = document.createElement("link")
  link.id = id
  link.rel = "stylesheet"
  link.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&display=swap"
  link.addEventListener("error", () => link.remove(), { once: true })
  document.head.append(link)
}
