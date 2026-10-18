import type { Feature } from "../types"
import { ChapterStickies } from "./chapterView"
import { StickiesPage } from "./myNotesView"

export const stickiesFeature: Feature = {
  id: "stickies",
  views: {
    chapter: ({ session, host, data }) => {
      const book = data.book ?? ""
      const chapter = Number(data.chapter)
      return book && chapter ? new ChapterStickies(session, host, book, chapter) : null
    },
    mynotes: ({ session, host }) => new StickiesPage(session, host),
  },
}
