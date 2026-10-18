// 畫重點與書籤（12 C3）：章節頁（掛載點 chapter，排在筆記面板下方）與「我的筆記」頁（掛載點 mynotes）。

import type { Feature } from "../types"
import { ChapterHighlights } from "./chapterView"
import { HighlightsPage } from "./myNotesView"
import { NodeBookmark } from "./nodeView"

export const highlightsFeature: Feature = {
  id: "highlights",
  views: {
    chapter: ({ session, host, data }) => {
      const book = data.book ?? ""
      const chapter = Number(data.chapter)
      return book && chapter ? new ChapterHighlights(session, host, book, chapter) : null
    },
    node: ({ session, host, data }) => data.slug
      ? new NodeBookmark(session, host, data.slug, data.title ?? data.slug.split("/").pop() ?? data.slug)
      : null,
    mynotes: ({ session, host }) => new HighlightsPage(session, host),
  },
}
