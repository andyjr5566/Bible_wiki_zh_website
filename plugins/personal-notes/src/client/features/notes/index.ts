// 筆記功能：章節頁底部的面板（掛載點 chapter）、知識庫條目頁的筆記面板（掛載點 node，D-47）與「我的筆記」頁（掛載點 mynotes）。
// 條目書籤是 highlights 功能，同樣掛在 node 掛載點上，兩者各用自己的容器、互不 import。

import type { Feature } from "../types"
import { MyNotesPage } from "./myNotesPage"
import { NotesPanel, chapterTarget, entryTarget } from "./notesPanel"

export const notesFeature: Feature = {
  id: "notes",
  views: {
    chapter: ({ session, host, data }) => {
      const book = data.book ?? ""
      const chapter = Number(data.chapter)
      return book && chapter ? new NotesPanel(session, host, chapterTarget(book, chapter)) : null
    },
    node: ({ session, host, data }) => {
      const slug = data.slug ?? ""
      return slug ? new NotesPanel(session, host, entryTarget({ slug, title: data.title ?? slug.split("/").pop() ?? slug })) : null
    },
    mynotes: ({ session, host }) => new MyNotesPage(session, host),
  },
}
