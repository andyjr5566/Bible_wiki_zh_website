import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import { buildCatalog } from "../../../../quartz/util/bookCatalog";
// 書卷格子是 book-picker 外掛提供的共用元件（打包進這個外掛的 dist）；分頁、鍵盤、灰色書卷提示由 book-picker 的腳本統一處理
import { BookGrid } from "../../../book-picker/src/components/BookGrid";
import { compactCatalog } from "../lib/catalogData";
// @ts-expect-error - inline script imported as string by esbuild loader
import earlyScript from "./scripts/early.inline.ts";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/hub.inline.ts";
// @ts-expect-error - css imported as string by esbuild loader
import gridStyle from "../../../book-picker/src/components/styles/bookGrid.scss";
// @ts-expect-error - css imported as string by esbuild loader
import style from "./styles/hub.scss";

const APPENDIX_INDEX = "appendix/index";
const QUICK_START = "教學/快速入門";

// 首頁入口：搜尋 → 繼續閱讀 → 按書卷讀經 → 快速入門／互動網站與附錄。
// 繼續閱讀卡的內容是讀者本機的紀錄，只能在瀏覽器裡畫；這裡只嵌入「有哪些章」（章號而已）讓瀏覽器判斷章還在不在。
// 腳本每頁都會載入（負責記錄閱讀位置），所以非首頁一律不畫任何東西。
const HomeHub: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const isIndex = fileData.slug === "index" || fileData.slug === "";
  if (!isIndex) return null;

  const catalog = buildCatalog(allFiles.map((file) => file.slug ?? ""));
  const link = (slug: string) => "./" + slug.split("/").map(encodeURIComponent).join("/");

  return (
    <section class="bwz-hub" aria-label="讀經入口" data-catalog={JSON.stringify(compactCatalog(catalog))}>
      <button type="button" class="bwz-hub-search" data-hub-search>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span class="bwz-hub-search-text">
          搜尋經文、人物、主題<span class="bwz-hub-wide">，或輸入「出 12:3」</span>
        </span>
        <kbd aria-hidden="true" data-hub-kbd>
          Ctrl K
        </kbd>
      </button>

      <div class="bwz-hub-resume" data-hub-resume data-state="pending"></div>

      <div class="bwz-hub-books">
        {/* 不用 <h2> 元素：主題外掛的 `html[saved-theme] body h2` 沒有分層，外掛的樣式贏不了它；用 role=heading 語意相同 */}
        <div class="bwz-hub-h" role="heading" aria-level={2}>
          按書卷讀經
        </div>
        <BookGrid catalog={catalog} fromSlug="index" idPrefix="bwz-hub" layout="grid" />
        <p class="bwz-hub-note">灰色的書卷研讀頁還在整理中，會陸續開放。</p>
      </div>

      <div class="bwz-hub-links">
        <a href={link(QUICK_START)}>快速入門</a>
        <a href={link(APPENDIX_INDEX)}>互動網站與附錄</a>
      </div>
    </section>
  );
};

HomeHub.beforeDOMLoaded = earlyScript;
HomeHub.afterDOMLoaded = script;
// 書卷格子的共用樣式（左欄選擇器也會載入同一份，重複無害）
HomeHub.css = `${gridStyle}
${style}`;

export default (() => HomeHub) satisfies QuartzComponentConstructor;
