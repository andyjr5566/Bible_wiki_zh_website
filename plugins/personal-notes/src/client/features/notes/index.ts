// 筆記功能：章節頁底部的面板（掛載點 chapter）與「我的筆記」頁（掛載點 mynotes）。

import type { Feature } from "../types"
import { ChapterPanel } from "./chapterPanel"
import { MyNotesPage } from "./myNotesPage"

export const notesFeature: Feature = {
  id: "notes",
  views: {
    chapter: ({ session, host, data }) => {
      const book = data.book ?? ""
      const chapter = Number(data.chapter)
      return book && chapter ? new ChapterPanel(session, host, book, chapter) : null
    },
    mynotes: ({ session, host }) => new MyNotesPage(session, host),
  },
}
