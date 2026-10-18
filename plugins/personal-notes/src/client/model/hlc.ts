// 混合邏輯時鐘（03 §3.3）。格式：`{wallMs 16 位}:{counter 4 位}:{deviceId}`，可直接字串比較。
// 用途：在「同時修改」的版本間決定顯示哪一個（最後寫入者優先）。因果判斷用 vv，不用 HLC（D-26）。

const MAX_COUNTER = 9999

export interface HlcParts {
  wall: number
  counter: number
  device: string
}

export function formatHlc({ wall, counter, device }: HlcParts): string {
  return `${String(wall).padStart(16, "0")}:${String(counter).padStart(4, "0")}:${device}`
}

export function parseHlc(hlc: string): HlcParts | null {
  const m = /^(\d{16}):(\d{4}):(.+)$/.exec(hlc)
  if (!m) return null
  return { wall: Number(m[1]), counter: Number(m[2]), device: m[3] }
}

export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export class HlcClock {
  private wall = 0
  private counter = 0

  constructor(
    private readonly device: string,
    last?: string | null,
    private readonly now: () => number = Date.now,
  ) {
    if (last) this.observe(last)
  }

  /** 產生一個大於所有已見過時間的新 HLC。 */
  tick(): string {
    const physical = this.now()
    if (physical > this.wall) {
      this.wall = physical
      this.counter = 0
    } else if (this.counter >= MAX_COUNTER) {
      this.wall += 1
      this.counter = 0
    } else {
      this.counter += 1
    }
    return this.current()
  }

  /** 收到遠端版本時呼叫，確保之後產生的 HLC 比它大。 */
  observe(remote: string): void {
    const p = parseHlc(remote)
    if (!p) return
    if (p.wall > this.wall || (p.wall === this.wall && p.counter > this.counter)) {
      this.wall = p.wall
      this.counter = p.counter
    }
  }

  current(): string {
    return formatHlc({ wall: this.wall, counter: this.counter, device: this.device })
  }
}
