// 引用到筆記（F6）：章節頁（經文以外的內容）與知識庫條目頁選字後的「❝ 引用到筆記」。

import { bookByCode, chapterSlug } from "../../model/books"
import type { Feature } from "../types"
import { QuoteSelection } from "./selectionView"

export const quotesFeature: Feature = {
  id: "quotes",
  views: {
    chapter: ({ data }) => {
      const book = data.book ?? ""
      const chapter = Number(data.chapter)
      const slug = book && chapter ? chapterSlug(book, chapter) : null
      if (!slug) return null
      const name = bookByCode(book)?.name ?? book
      return new QuoteSelection({ target: { kind: "chapter", book, chapter }, slug, label: `${name} ${chapter}`, hasVerses: true })
    },
    node: ({ data }) => {
      const slug = data.slug ?? ""
      if (!slug) return null
      return new QuoteSelection({ target: { kind: "entry", slug }, slug, label: data.title ?? slug.split("/").pop() ?? slug, hasVerses: false })
    },
  },
}
