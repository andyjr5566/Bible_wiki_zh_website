// 66 卷書的單一來源：資料在 config/bible-books.json（同步腳本、部署檢查、書卷選擇器共用），
// 這裡只負責型別與「書卷 ↔ 資料夾路徑」的轉換，避免每個模組各自拼路徑。
import data from "../../config/bible-books.json"

export type Testament = "ot" | "nt"

export interface BookGroup {
  id: string
  name: string
  testament: Testament
}

export interface BibleBook {
  num: number
  name: string
  short: string
  chapters: number
  group: string
}

export const BOOK_GROUPS = data.groups as readonly BookGroup[]
export const BIBLE_BOOKS = data.books as readonly BibleBook[]

/** 保留資料夾實名，讓檔案系統與網站路徑都能使用同一卷資料。 */
export function folderName(book: BibleBook): string {
  return String(book.num).padStart(2, "0") + " " + book.name
}

/** 網站把書卷資料夾中的空白轉成連字號，這裡集中產生正式路徑。 */
export function folderSlug(book: BibleBook): string {
  return String(book.num).padStart(2, "0") + "-" + book.name
}

export function groupBooks(testament?: Testament): { group: BookGroup; books: readonly BibleBook[] }[] {
  return BOOK_GROUPS.filter((group) => testament === undefined || group.testament === testament).map(
    (group) => ({
      group,
      books: BIBLE_BOOKS.filter((book) => book.group === group.id),
    }),
  )
}

function decodePath(value: string): string {
  const path = value.trim().split(/[?#]/, 1)[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** 網址可能是編碼過的、帶空白或結尾斜線；統一成建置輸出的寫法（空白→連字號）再比對。 */
export function canonicalSlugPath(value: string): string {
  return decodePath(value)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.html$/i, "")
    .replace(/[\s]+/g, "-")
}

export function bookByFolderSlug(s: string): BibleBook | undefined {
  const canonical = canonicalSlugPath(s)
  const folder = canonical.split("/").at(-1)
  return BIBLE_BOOKS.find((book) => folderSlug(book) === folder)
}

