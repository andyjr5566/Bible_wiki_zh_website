import type { QuartzEmitterPlugin } from "../types"
import type { FullSlug } from "../../util/path"
import { buildVerseIndex } from "../../util/verseIndex"
import { write } from "./helpers"

export const VerseIndex: QuartzEmitterPlugin = () => {
  const emit: ReturnType<QuartzEmitterPlugin>["emit"] = async (ctx, content) => {
    const { index, malformed } = buildVerseIndex(content)
    for (const slug of malformed) {
      console.warn(`[verse-index] 未索引 ${slug}：找不到完整的經文清單`)
    }
    return [
      await write({
        ctx,
        slug: "static/verseIndex" as FullSlug,
        ext: ".json",
        content: JSON.stringify(index),
      }),
    ]
  }
  return { name: "VerseIndex", emit, partialEmit: emit }
}
