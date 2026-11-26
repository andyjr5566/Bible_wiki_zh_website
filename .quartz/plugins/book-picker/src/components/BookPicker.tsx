import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import {
  buildCatalog,
  introSlug,
  parseBookSlug,
  tocSlug,
  type CatalogEntry,
} from "../../../../quartz/util/bookCatalog";
import { BookGrid } from "./BookGrid";
import { ChapterGrid } from "./ChapterGrid";
import { currentBookOf, defaultTestament, pickerMode, relativeHref } from "../lib/pickerLogic";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/picker.inline.ts";
// @ts-expect-error - css imported as string by esbuild loader
import gridStyle from "./styles/bookGrid.scss";
// @ts-expect-error - css imported as string by esbuild loader
import pickerStyle from "./styles/picker.scss";

// 左欄的書卷／章節選擇器（U-22 方案 B）。三種版面由 pickerMode 決定：
//   book＝章節頁、全書目錄、書卷導論：本卷章號格＋「換卷」；  home＝首頁：收成一行；  other＝其他頁：直接展開書卷格子。
// 所有版面的標記都由伺服器端一次畫好，腳本（picker.inline.ts）只負責展開／收起、手機搬進抽屜、提示。

/** 同一次建置每一頁都要這份目錄；allFiles 是同一個陣列，所以只算一次。 */
const catalogCache = new WeakMap<object, CatalogEntry[]>();

function catalogOf(allFiles: QuartzComponentProps["allFiles"]): CatalogEntry[] {
  let catalog = catalogCache.get(allFiles);
  if (!catalog) {
    catalog = buildCatalog(allFiles.flatMap((file) => (file.slug ? [String(file.slug)] : [])));
    catalogCache.set(allFiles, catalog);
  }
  return catalog;
}

const BookPicker: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const slug = String(fileData.slug ?? "index");
  const mode = pickerMode(slug);
  const parsed = parseBookSlug(slug);
  const book = currentBookOf(slug);
  const catalog = catalogOf(allFiles);
  const entry = book ? catalog.find((item) => item.book.num === book.num) : undefined;
  const current = parsed?.kind === "chapter" ? parsed.chapter : undefined;

  const grid = (
    <BookGrid
      catalog={catalog}
      fromSlug={slug}
      idPrefix="bwz-pk"
      currentBookNum={book?.num}
      defaultTestament={defaultTestament(book)}
    />
  );

  return (
    <div class="bwz-picker-slot">
      <div
        class="bwz-picker"
        role="group"
        aria-label="書卷與章節"
        data-mode={mode}
        data-kind={parsed?.kind}
        data-book-name={book?.name}
      >
        {mode === "home" ? (
          <>
            <button
              type="button"
              class="bwz-pk-collapse"
              aria-expanded="false"
              aria-controls="bwz-pk-books"
              aria-label="瀏覽全部書卷"
            >
              <span class="bwz-pk-title">書卷</span>
              <span class="bwz-pk-arrow" aria-hidden="true">
                ▸
              </span>
            </button>
            <div id="bwz-pk-books" class="bwz-pk-books" hidden>
              {grid}
            </div>
          </>
        ) : mode === "book" && book && entry ? (
          <>
            <div class="bwz-pk-head">
              <h2 class="bwz-pk-title">書卷</h2>
              <button
                type="button"
                class="bwz-pk-switch"
                aria-expanded="false"
                aria-controls="bwz-pk-books"
                aria-label={`目前在${book.name}，換別的書卷`}
              >
                {book.name}{" "}
                <span class="bwz-pk-arrow" aria-hidden="true">
                  ▾
                </span>{" "}
                換卷
              </button>
            </div>
            <div class="bwz-pk-current">
              {entry.hasToc && (
                <a class="bwz-pk-link" href={relativeHref(slug, tocSlug(book))}>
                  全書目錄及綱要
                </a>
              )}
              {entry.hasIntro && (
                <a class="bwz-pk-link" href={relativeHref(slug, introSlug(book))}>
                  書卷導論
                </a>
              )}
              <ChapterGrid entry={entry} fromSlug={slug} currentChapter={current} />
            </div>
            <div id="bwz-pk-books" class="bwz-pk-books" hidden>
              {grid}
            </div>
          </>
        ) : (
          <>
            <h2 class="bwz-pk-title">書卷</h2>
            <div id="bwz-pk-books" class="bwz-pk-books">
              {grid}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

BookPicker.afterDOMLoaded = script;
BookPicker.css = `${gridStyle}\n${pickerStyle}`;

export default (() => BookPicker) satisfies QuartzComponentConstructor;
