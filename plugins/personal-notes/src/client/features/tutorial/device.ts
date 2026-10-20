// 教學要用電腦版還是手機版（D-51，14 §2.1）：網址參數 > 手動切換記住的 > 自動判斷（觸控為主＝手機版）。
// 網址參數只影響這一次，不會記住；只有使用者按「電腦｜手機」才記住（這台裝置）。

import type { InputKind } from "../../ui/env"
import { primaryInput } from "../../ui/env"

export type TutorialDevice = InputKind
export const DEVICE_KEY = "bwz-tutorial-device"

/** 只接受 "touch" | "desktop"，其他（含 null）回 null */
export function parseDevice(v: unknown): TutorialDevice | null {
  return v === "touch" || v === "desktop" ? v : null
}

/** 優先順序：網址參數 > 手動記住 > 自動判斷 */
export function resolveDevice(o: { param: string | null; stored: string | null; auto: InputKind }): TutorialDevice {
  return parseDevice(o.param) ?? parseDevice(o.stored) ?? o.auto
}

/** localStorage 讀；丟例外回 null */
export function storedDevice(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY)
  } catch {
    return null
  }
}

/** 使用者按「電腦｜手機」切換時記住（這台裝置）；寫不進去就算了（try/catch） */
export function rememberDevice(d: TutorialDevice): void {
  try {
    localStorage.setItem(DEVICE_KEY, d)
  } catch {
    // 記不住選擇不影響使用
  }
}

/** 打開教學時用的裝置：resolveDevice({ param, stored: storedDevice(), auto: primaryInput() }) */
export function initialDevice(param: string | null = null): TutorialDevice {
  return resolveDevice({ param, stored: storedDevice(), auto: primaryInput() })
}
