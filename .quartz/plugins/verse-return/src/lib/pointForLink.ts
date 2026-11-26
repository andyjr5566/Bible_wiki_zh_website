// 一個連結被點下去（或滑過）時，它對應哪個返回點：在經文某一節裡 → 那一節；在「本章整理」裡 → 最近的小標題。
// 「哪一節、哪個標題」的判斷用 quartz/util/chapterDom.ts（和純經文模式共用），這裡不重寫。
import { readChapterDom, studyHeadingIdOf, verseNumberOf } from "../../../../quartz/util/chapterDom"
import { makeStudyPoint, makeVersePoint, type ReturnPoint } from "../../../../quartz/util/returnPoint"

export function pointForLink(link: Element, now: number, doc: Document = document): ReturnPoint | null {
  const dom = readChapterDom(doc)
  if (!dom) return null
  const slug = doc.body.dataset.slug ?? ""

  const verse = verseNumberOf(dom, link)
  if (verse !== null) return makeVersePoint(slug, verse, now)

  const headingId = studyHeadingIdOf(dom, link)
  return headingId ? makeStudyPoint(slug, headingId, now) : null
}
