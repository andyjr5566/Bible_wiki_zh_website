import type { QuartzEmitterPlugin } from "../types"
import type { FullSlug } from "../../util/path"
import { buildVerseIndex, buildVerseOriginalIndex } from "../../util/verseIndex"
import { buildVerseSearchHints, loadVerseSearchHintsSource } from "../../util/verseSearchHints"
import { write } from "./helpers"

export const VerseIndex: QuartzEmitterPlugin = () => {
  const emit: ReturnType<QuartzEmitterPlugin>["emit"] = async (ctx, content) => {
    const { index, malformed } = buildVerseIndex(content)
    for (const slug of malformed) {
      console.warn(`[verse-index] 未索引 ${slug}：找不到完整的經文清單`)
    }
    const indexedSlugs = new Set(index.chapters.map((chapter) => chapter.slug))
    const originalIndex = buildVerseOriginalIndex(content, indexedSlugs)

    const hintsSource = loadVerseSearchHintsSource()
    const hints = buildVerseSearchHints(index.chapters, hintsSource.related, hintsSource.pins)

    return [
      await write({
        ctx,
        slug: "static/verseIndex" as FullSlug,
        ext: ".json",
        content: JSON.stringify(index),
      }),
      await write({
        ctx,
        slug: "static/verseOriginalIndex" as FullSlug,
        ext: ".json",
        content: JSON.stringify(originalIndex),
      }),
      await write({
        ctx,
        slug: "static/verseSearchHints" as FullSlug,
        ext: ".json",
        content: JSON.stringify(hints),
      }),
    ]
  }
  return { name: "VerseIndex", emit, partialEmit: emit }
}
