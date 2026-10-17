// 書卷代碼表（USFM 三碼）。編號＝content 書卷資料夾前綴（如「01 創世記」→ slug「01-創世記」）。
// 見 dev-notes/personal-notes/03-architecture.md 附錄 A、D-14。

export interface Book {
  num: string
  name: string
  code: string
  chapters: number
}

export const BOOKS: readonly Book[] = [
  { num: "01", name: "創世記", code: "GEN", chapters: 50 },
  { num: "02", name: "出埃及記", code: "EXO", chapters: 40 },
  { num: "03", name: "利未記", code: "LEV", chapters: 27 },
  { num: "04", name: "民數記", code: "NUM", chapters: 36 },
  { num: "05", name: "申命記", code: "DEU", chapters: 34 },
  { num: "06", name: "約書亞記", code: "JOS", chapters: 24 },
  { num: "07", name: "士師記", code: "JDG", chapters: 21 },
  { num: "08", name: "路得記", code: "RUT", chapters: 4 },
  { num: "09", name: "撒母耳記上", code: "1SA", chapters: 31 },
  { num: "10", name: "撒母耳記下", code: "2SA", chapters: 24 },
  { num: "11", name: "列王紀上", code: "1KI", chapters: 22 },
  { num: "12", name: "列王紀下", code: "2KI", chapters: 25 },
  { num: "13", name: "歷代志上", code: "1CH", chapters: 29 },
  { num: "14", name: "歷代志下", code: "2CH", chapters: 36 },
  { num: "15", name: "以斯拉記", code: "EZR", chapters: 10 },
  { num: "16", name: "尼希米記", code: "NEH", chapters: 13 },
  { num: "17", name: "以斯帖記", code: "EST", chapters: 10 },
  { num: "18", name: "約伯記", code: "JOB", chapters: 42 },
  { num: "19", name: "詩篇", code: "PSA", chapters: 150 },
  { num: "20", name: "箴言", code: "PRO", chapters: 31 },
  { num: "21", name: "傳道書", code: "ECC", chapters: 12 },
  { num: "22", name: "雅歌", code: "SNG", chapters: 8 },
  { num: "23", name: "以賽亞書", code: "ISA", chapters: 66 },
  { num: "24", name: "耶利米書", code: "JER", chapters: 52 },
  { num: "25", name: "耶利米哀歌", code: "LAM", chapters: 5 },
  { num: "26", name: "以西結書", code: "EZK", chapters: 48 },
  { num: "27", name: "但以理書", code: "DAN", chapters: 12 },
  { num: "28", name: "何西阿書", code: "HOS", chapters: 14 },
  { num: "29", name: "約珥書", code: "JOL", chapters: 3 },
  { num: "30", name: "阿摩司書", code: "AMO", chapters: 9 },
  { num: "31", name: "俄巴底亞書", code: "OBA", chapters: 1 },
  { num: "32", name: "約拿書", code: "JON", chapters: 4 },
  { num: "33", name: "彌迦書", code: "MIC", chapters: 7 },
  { num: "34", name: "那鴻書", code: "NAM", chapters: 3 },
  { num: "35", name: "哈巴谷書", code: "HAB", chapters: 3 },
  { num: "36", name: "西番雅書", code: "ZEP", chapters: 3 },
  { num: "37", name: "哈該書", code: "HAG", chapters: 2 },
  { num: "38", name: "撒迦利亞書", code: "ZEC", chapters: 14 },
  { num: "39", name: "瑪拉基書", code: "MAL", chapters: 4 },
  { num: "40", name: "馬太福音", code: "MAT", chapters: 28 },
  { num: "41", name: "馬可福音", code: "MRK", chapters: 16 },
  { num: "42", name: "路加福音", code: "LUK", chapters: 24 },
  { num: "43", name: "約翰福音", code: "JHN", chapters: 21 },
  { num: "44", name: "使徒行傳", code: "ACT", chapters: 28 },
  { num: "45", name: "羅馬書", code: "ROM", chapters: 16 },
  { num: "46", name: "哥林多前書", code: "1CO", chapters: 16 },
  { num: "47", name: "哥林多後書", code: "2CO", chapters: 13 },
  { num: "48", name: "加拉太書", code: "GAL", chapters: 6 },
  { num: "49", name: "以弗所書", code: "EPH", chapters: 6 },
  { num: "50", name: "腓立比書", code: "PHP", chapters: 4 },
  { num: "51", name: "歌羅西書", code: "COL", chapters: 4 },
  { num: "52", name: "帖撒羅尼迦前書", code: "1TH", chapters: 5 },
  { num: "53", name: "帖撒羅尼迦後書", code: "2TH", chapters: 3 },
  { num: "54", name: "提摩太前書", code: "1TI", chapters: 6 },
  { num: "55", name: "提摩太後書", code: "2TI", chapters: 4 },
  { num: "56", name: "提多書", code: "TIT", chapters: 3 },
  { num: "57", name: "腓利門書", code: "PHM", chapters: 1 },
  { num: "58", name: "希伯來書", code: "HEB", chapters: 13 },
  { num: "59", name: "雅各書", code: "JAS", chapters: 5 },
  { num: "60", name: "彼得前書", code: "1PE", chapters: 5 },
  { num: "61", name: "彼得後書", code: "2PE", chapters: 3 },
  { num: "62", name: "約翰一書", code: "1JN", chapters: 5 },
  { num: "63", name: "約翰二書", code: "2JN", chapters: 1 },
  { num: "64", name: "約翰三書", code: "3JN", chapters: 1 },
  { num: "65", name: "猶大書", code: "JUD", chapters: 1 },
  { num: "66", name: "啟示錄", code: "REV", chapters: 22 },
]

const byNum = new Map(BOOKS.map((b) => [b.num, b]))
const byCode = new Map(BOOKS.map((b) => [b.code, b]))

export function bookByNum(num: string): Book | undefined {
  return byNum.get(num)
}

export function bookByCode(code: string): Book | undefined {
  return byCode.get(code)
}

/** 非經文分片鍵（03 §2）。 */
export const RESERVED_SHARDS = ["_NODE", "_META", "_FREE"] as const

export function isValidShard(shard: string): boolean {
  return byCode.has(shard) || (RESERVED_SHARDS as readonly string[]).includes(shard)
}

export interface ChapterRef {
  book: Book
  chapter: number
}

const CHAPTER_SLUG = /^(\d{2})-[^/]+\/第(\d+)章$/

/**
 * 章節頁 slug（如「01-創世記/第10章」）→ 書卷與章。
 * 只用編號判斷書卷，不依賴名稱文字（content 仍在建置中，D-14）。認不出就回傳 null。
 */
export function parseChapterSlug(slug: string): ChapterRef | null {
  let s = slug
  try {
    s = decodeURIComponent(slug)
  } catch {
    // 已是解碼後的字串
  }
  const m = CHAPTER_SLUG.exec(s)
  if (!m) return null
  const book = bookByNum(m[1])
  const chapter = Number(m[2])
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null
  return { book, chapter }
}

/** 書卷代碼＋章 → 章節頁 slug（用於「我的筆記」連回章節）。 */
export function chapterSlug(code: string, chapter: number): string | null {
  const book = bookByCode(code)
  if (!book || chapter < 1 || chapter > book.chapters) return null
  return `${book.num}-${book.name}/第${chapter}章`
}

export function chapterRef(code: string, chapter: number): string {
  return `${code}.${chapter}`
}

export function chapterLabel(code: string, chapter: number): string {
  const book = bookByCode(code)
  return book ? `${book.name} 第${chapter}章` : `${code} ${chapter}`
}
