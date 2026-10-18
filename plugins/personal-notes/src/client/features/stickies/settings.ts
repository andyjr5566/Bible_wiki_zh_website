export type StickyMode = "open" | "icon"
export const STICKY_MODE_EVENT = "bwz:sticky-mode"
const KEY = "bwz-sticky-mode"
export function getStickyMode(): StickyMode {
  try { return localStorage.getItem(KEY) === "icon" ? "icon" : "open" } catch { return "open" }
}
export function setStickyMode(value: StickyMode): void {
  const mode = value === "icon" ? "icon" : "open"
  try { localStorage.setItem(KEY, mode) } catch { /* 裝置可能禁止儲存偏好 */ }
  window.dispatchEvent(new CustomEvent(STICKY_MODE_EVENT, { detail: mode }))
}
export function onStickyModeChange(run: (mode: StickyMode) => void): () => void {
  const local = (e: Event) => run((e as CustomEvent<StickyMode>).detail === "icon" ? "icon" : "open")
  const remote = (e: StorageEvent) => { if (e.key === KEY || e.key === null) run(getStickyMode()) }
  window.addEventListener(STICKY_MODE_EVENT, local)
  window.addEventListener("storage", remote)
  return () => { window.removeEventListener(STICKY_MODE_EVENT, local); window.removeEventListener("storage", remote) }
}
