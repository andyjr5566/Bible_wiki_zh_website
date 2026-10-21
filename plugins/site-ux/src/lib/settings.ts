// 「Aa 外觀」設定：底色、字級、經文連結樣式。
// 純函式加最小的 Storage／Element 介面，方便單元測試；所有 localStorage 讀寫都包 try/catch，
// 隱私模式、被封鎖或額度用完時一律退回預設值，不丟錯。

export type Bg = "paper" | "pure"
export type FontSize = "s" | "m" | "l"
export type VerseLinks = "normal" | "quiet" | "hidden"

export interface Settings {
  bg: Bg
  fontSize: FontSize
  links: VerseLinks
}

export const DEFAULTS: Settings = { bg: "paper", fontSize: "m", links: "normal" }

/**
 * 底色沿用原本「素」按鈕的 key 與值（"theme-bg"："pure"／"paper"），
 * 所以已經選過素色的讀者升級後不用重新設定。
 */
export const STORAGE_KEYS = {
  bg: "theme-bg",
  fontSize: "bwz-ux-fontsize",
  links: "bwz-ux-verselinks",
} as const

export const OPTIONS = {
  bg: ["paper", "pure"],
  fontSize: ["s", "m", "l"],
  links: ["normal", "quiet", "hidden"],
} as const

export type SettingName = keyof Settings

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 最小的元素介面：測試時傳一個假物件即可。 */
export interface RootLike {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  getAttribute(name: string): string | null
}

export function normalize<K extends SettingName>(name: K, value: unknown): Settings[K] {
  const allowed = OPTIONS[name] as readonly unknown[]
  return (allowed.includes(value) ? value : DEFAULTS[name]) as Settings[K]
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

function readOne<K extends SettingName>(
  name: K,
  storage: StorageLike | null,
): Settings[K] {
  try {
    if (!storage) return DEFAULTS[name]
    return normalize(name, storage.getItem(STORAGE_KEYS[name]))
  } catch {
    return DEFAULTS[name]
  }
}

export function readSettings(storage: StorageLike | null = defaultStorage()): Settings {
  return {
    bg: readOne("bg", storage),
    fontSize: readOne("fontSize", storage),
    links: readOne("links", storage),
  }
}

/** 寫入一項設定；回傳是否寫入成功（失敗時畫面仍然會套用，只是不會記住）。 */
export function writeSetting<K extends SettingName>(
  name: K,
  value: Settings[K],
  storage: StorageLike | null = defaultStorage(),
): boolean {
  try {
    if (!storage) return false
    storage.setItem(STORAGE_KEYS[name], normalize(name, value))
    return true
  } catch {
    return false
  }
}

/** 把設定寫成 <html> 的屬性。預設值不留屬性，所以預設外觀不會被任何 CSS 影響。 */
export function applySettings(settings: Settings, root: RootLike = document.documentElement): void {
  if (settings.bg === "pure") root.setAttribute("data-bg", "pure")
  else root.removeAttribute("data-bg")

  if (settings.fontSize === "m") root.removeAttribute("data-ux-fs")
  else root.setAttribute("data-ux-fs", settings.fontSize)

  if (settings.links === "normal") root.removeAttribute("data-ux-links")
  else root.setAttribute("data-ux-links", settings.links)
}

/** 讀取已存的設定並套用到 <html>（頁面載入最早期呼叫，避免閃爍）。 */
export function applyStoredSettings(
  storage: StorageLike | null = defaultStorage(),
  root: RootLike = document.documentElement,
): Settings {
  const settings = readSettings(storage)
  applySettings(settings, root)
  return settings
}
