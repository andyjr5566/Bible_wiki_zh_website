// 共用元件：本卷章號格（缺號灰掉，目前章 aria-current="page"）。
// 左欄選擇器、手機章末、（需要時）首頁入口都用這一個；樣式在 styles/bookGrid.scss。
// 缺號是指「這一卷還沒有那一章的頁面」（內容整理中），不是錯誤，所以灰掉而不是隱藏，讓讀者看得出章數。
import type { CatalogEntry } from "../../../../quartz/util/bookCatalog"
import { chapterSlug } from "../../../../quartz/util/bookCatalog"
import { relativeHref } from "../lib/pickerLogic"

export interface ChapterGridProps {
  entry: CatalogEntry
  fromSlug: string
  /** 目前這一章；全書目錄、書卷導論頁沒有。 */
  currentChapter?: number
}

export function ChapterGrid({ entry, fromSlug, currentChapter }: ChapterGridProps) {
  const have = new Set(entry.chapters)
  const numbers = Array.from({ length: entry.book.chapters }, (_, i) => i + 1)
  return (
    <div class="bwz-chgrid-wrap">
      <ul class="bwz-chgrid">
        {numbers.map((n) => {
          if (!have.has(n)) {
            return (
              <li>
                <span class="bwz-ch is-missing">
                  {n}
                  <span class="bwz-sr-only">（尚未開放）</span>
                </span>
              </li>
            )
          }
          const current = n === currentChapter
          return (
            <li>
              <a
                class="bwz-ch"
                href={relativeHref(fromSlug, chapterSlug(entry.book, n))}
                aria-label={current ? `第 ${n} 章（目前這一章）` : `第 ${n} 章`}
                aria-current={current ? "page" : undefined}
              >
                {n}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ChapterGrid
