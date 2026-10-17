// 版本向量（D-26）：每台裝置對某則筆記的編輯次數。`a ≤ b`（逐項）代表 b 看過 a。

export type VersionVector = Record<string, number>

export function vvLeq(a: VersionVector, b: VersionVector): boolean {
  for (const [device, n] of Object.entries(a)) {
    if (n > (b[device] ?? 0)) return false
  }
  return true
}

export function vvEquals(a: VersionVector, b: VersionVector): boolean {
  return vvLeq(a, b) && vvLeq(b, a)
}

/** a 被 b 支配：b 看過 a，而且 b 比 a 新。 */
export function vvDominatedBy(a: VersionVector, b: VersionVector): boolean {
  return vvLeq(a, b) && !vvLeq(b, a)
}

export function vvMax(...vectors: VersionVector[]): VersionVector {
  const out: VersionVector = {}
  for (const v of vectors) {
    for (const [device, n] of Object.entries(v)) {
      if (n > (out[device] ?? 0)) out[device] = n
    }
  }
  return out
}

export function vvIncrement(v: VersionVector, device: string): VersionVector {
  return { ...v, [device]: (v[device] ?? 0) + 1 }
}

export function isValidVv(v: unknown): v is VersionVector {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false
  return Object.values(v as Record<string, unknown>).every(
    (n) => typeof n === "number" && Number.isInteger(n) && n >= 0,
  )
}
