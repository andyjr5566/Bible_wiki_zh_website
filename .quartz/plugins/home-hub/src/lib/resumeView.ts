// 把「閱讀紀錄＋目前有哪些章」整理成首頁卡片要顯示的內容（純函式，不碰 DOM）。
// 取捨規則（每卷一筆、章被刪退回全書目錄、整卷沒頁面就不顯示）全在 quartz/util/readingPosition.ts 的 pickResume。
import type { CatalogEntry } from "../../../../quartz/util/bookCatalog"
import { pickResume, type ReadingState, type ResumeReading } from "../../../../quartz/util/readingPosition"
import { bookDescription, chapterDescription } from "./resumeText"

/** 大卡之外再列幾個小連結。 */
export const RECENT_LINK_COUNT = 2

export interface ResumeMain {
  slug: string
  ratio: number
  title: string
  meta: string
  /** 螢幕閱讀器念的按鈕名稱 */
  ariaLabel: string
  /** 只有真的有「章」才需要回到捲動位置 */
  restoreScroll: boolean
}

export interface RecentLink {
  slug: string
  label: string
}

export interface ResumeView {
  main: ResumeMain
  recent: RecentLink[]
}

function chapterTitle(resume: ResumeReading, spaced: boolean): string {
  if (resume.kind === "chapter") {
    return spaced ? `${resume.book.name} 第 ${resume.chapter} 章` : `${resume.book.name}第 ${resume.chapter} 章`
  }
  return resume.book.name
}

export function buildResumeView(
  state: ReadingState,
  catalog: readonly CatalogEntry[],
  now: number,
): ResumeView | null {
  const picks = pickResume(state, catalog, 1 + RECENT_LINK_COUNT)
  const [first, ...rest] = picks
  if (!first) return null

  const isChapter = first.kind === "chapter"
  return {
    main: {
      slug: first.slug,
      ratio: first.ratio,
      title: chapterTitle(first, true),
      meta: isChapter ? chapterDescription(first.ratio, first.t, now) : bookDescription(first.t, now),
      ariaLabel: `繼續閱讀${chapterTitle(first, false)}`,
      restoreScroll: isChapter,
    },
    recent: rest.map((resume) => ({ slug: resume.slug, label: chapterTitle(resume, true) })),
  }
}
