// 共用元件：書卷格子（舊約／新約分頁＋8 組小標＋全名小標籤）。
// 左欄選擇器（BookPicker）與首頁入口（home-hub 外掛）都用這一個，不要各寫一份；
// 所以這裡不依賴左欄的情境：只吃資料（catalog）與目前頁的 slug，樣式在 styles/bookGrid.scss。
// 分頁切換、鍵盤操作、灰色書卷的提示、依閱讀紀錄決定預設分頁，都由 book-picker 的腳本
// 對頁面上所有 .bwz-bookgrid 統一處理（事件委派），使用這個元件的外掛不必再附腳本。
import { groupBooks, type BibleBook, type Testament } from "../../../../quartz/util/bibleBooks"
import type { CatalogEntry } from "../../../../quartz/util/bookCatalog"
import { bookLinkSlug, openBooksSummary, relativeHref } from "../lib/pickerLogic"

export interface BookGridProps {
  /** buildCatalog 的結果（伺服器端算一次）。 */
  catalog: readonly CatalogEntry[]
  /** 目前頁的 slug，用來產生相對連結。 */
  fromSlug: string
  /** 同一頁有多個格子時要唯一（用在分頁的 id）。 */
  idPrefix: string
  /** 目前這一卷（會標示 aria-current）；沒有就不傳。 */
  currentBookNum?: number
  /** 預設開哪個約；用戶端沒有閱讀紀錄時維持這個值。 */
  defaultTestament?: Testament
  /**
   * 沒有目前書卷時，是否讓用戶端依閱讀紀錄（localStorage bwz-reading）改選預設的約。
   * 預設 true；首頁與左欄的行為因此一致。
   */
  autoTab?: boolean
  /** chips＝依文字寬度排的全名小標籤（左欄）；grid＝等寬格（首頁，較寬）。 */
  layout?: "chips" | "grid"
}

const TESTAMENT_LABEL: Record<Testament, string> = { ot: "舊約", nt: "新約" }
const TESTAMENTS: Testament[] = ["ot", "nt"]

function bookCount(testament: Testament): number {
  return groupBooks(testament).reduce((sum, { books }) => sum + books.length, 0)
}

function BookItem({
  book,
  entry,
  fromSlug,
  current,
}: {
  book: BibleBook
  entry: CatalogEntry
  fromSlug: string
  current: boolean
}) {
  const slug = bookLinkSlug(entry)
  if (!slug) {
    // 灰色書卷：不是連結而是 aria-disabled 的按鈕，點了由腳本跳提示（比什麼都不發生友善）
    return (
      <button type="button" class="bwz-bg-book is-locked" aria-disabled="true" data-book={book.name}>
        {book.name}
      </button>
    )
  }
  return (
    <a class="bwz-bg-book" href={relativeHref(fromSlug, slug)} aria-current={current ? "true" : undefined}>
      {book.name}
    </a>
  )
}

export function BookGrid({
  catalog,
  fromSlug,
  idPrefix,
  currentBookNum,
  defaultTestament = "ot",
  autoTab = true,
  layout = "chips",
}: BookGridProps) {
  const entries = new Map(catalog.map((entry) => [entry.book.num, entry]))
  const summary = openBooksSummary(catalog)
  // 沒有目前書卷時才讓用戶端依閱讀紀錄改選；有目前書卷就固定用它所屬的約
  const auto = autoTab && currentBookNum === undefined

  return (
    <div
      class={`bwz-bookgrid bwz-bookgrid--${layout}`}
      data-open-summary={summary}
      data-auto-tab={auto ? "true" : undefined}
    >
      <div class="bwz-bg-tabs" role="tablist" aria-label="舊約或新約">
        {TESTAMENTS.map((testament) => {
          const selected = testament === defaultTestament
          return (
            <button
              type="button"
              role="tab"
              class="bwz-bg-tab"
              id={`${idPrefix}-tab-${testament}`}
              data-testament={testament}
              aria-selected={selected ? "true" : "false"}
              aria-controls={`${idPrefix}-panel-${testament}`}
              tabindex={selected ? 0 : -1}
            >
              {TESTAMENT_LABEL[testament]} {bookCount(testament)} 卷
            </button>
          )
        })}
      </div>
      {TESTAMENTS.map((testament) => (
        <div
          role="tabpanel"
          class="bwz-bg-panel"
          id={`${idPrefix}-panel-${testament}`}
          aria-labelledby={`${idPrefix}-tab-${testament}`}
          hidden={testament !== defaultTestament}
        >
          {groupBooks(testament).map(({ group, books }) => (
            <div class="bwz-bg-group" role="group" aria-labelledby={`${idPrefix}-g-${group.id}`}>
              <div class="bwz-bg-gh" id={`${idPrefix}-g-${group.id}`}>
                {group.name}
              </div>
              <div class="bwz-bg-books">
                {books.map((book) => (
                  <BookItem
                    book={book}
                    entry={entries.get(book.num)!}
                    fromSlug={fromSlug}
                    current={book.num === currentBookNum}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default BookGrid
