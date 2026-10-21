export interface OpeningGateInput {
  now: number
  lastSeen: string | null
  search: string
  standalone: boolean
}

export interface OpeningGateDecision {
  redirect: boolean
  forceIntro: boolean
  markSeen: boolean
}

export function shouldShowOpening(input: OpeningGateInput): OpeningGateDecision {
  const params = new URLSearchParams(input.search)

  if (params.get("opening") === "1" || params.get("intro") === "1") {
    return { redirect: true, forceIntro: true, markSeen: true }
  }

  if (params.get("opening") === "0" || params.get("skip") === "1") {
    return { redirect: false, forceIntro: false, markSeen: true }
  }

  if (input.standalone) {
    return { redirect: false, forceIntro: false, markSeen: false }
  }

  const lastSeen =
    input.lastSeen === null || input.lastSeen.trim() === ""
      ? Number.NaN
      : Number(input.lastSeen)

  if (
    !Number.isFinite(lastSeen) ||
    lastSeen > input.now ||
    input.now - lastSeen > 24 * 60 * 60 * 1000
  ) {
    return { redirect: true, forceIntro: false, markSeen: true }
  }

  return { redirect: false, forceIntro: false, markSeen: false }
}
