// 功能模組清單。新增功能時在這裡登記；同一種掛載點上的多個功能，依這裡的順序由上而下排列。

import { highlightsFeature } from "./highlights"
import { stickiesFeature } from "./stickies"
import { tutorialFeature } from "./tutorial"
import { notesFeature } from "./notes"
import { quotesFeature } from "./quotes"
import type { Feature, MountContext, View } from "./types"

export const FEATURES: readonly Feature[] = [notesFeature, highlightsFeature, stickiesFeature, quotesFeature, tutorialFeature]

/** 某種掛載點上要建立的所有畫面（依登記順序）。 */
export function viewFactories(kind: string): ((ctx: MountContext) => View | null)[] {
  const ordered = [...FEATURES.filter((f) => f.first?.includes(kind)), ...FEATURES.filter((f) => !f.first?.includes(kind))]
  return ordered.flatMap((f) => {
    const make = f.views[kind]
    return make ? [make] : []
  })
}
