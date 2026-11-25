import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
} from "@quartz-community/types";
import { classNames } from "../util/lang";
import { i18n } from "../i18n";
import { parseFeedbackFormConfig, type FeedbackFormConfig } from "./feedbackForm";
import style from "./styles/search.scss";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/search.inline.ts";

export type SearchField = "title" | "content" | "tags";

export interface SearchOptions {
  enablePreview: boolean;
  fieldPriority: SearchField[];
  /** 經文結果底部的「找不到經文？」問卷提示；不設定就不顯示。 */
  feedbackForm?: FeedbackFormConfig;
}

const defaultOptions: SearchOptions = {
  enablePreview: true,
  fieldPriority: ["title", "content", "tags"],
};

let searchResultsSequence = 0;

export default ((userOpts?: Partial<SearchOptions>) => {
  const Search: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const opts = { ...defaultOptions, ...userOpts };
    const feedbackForm = parseFeedbackFormConfig(opts.feedbackForm);
    const locale = cfg.locale ?? "en-US";
    const searchText = i18n(locale).components.search;
    const searchPlaceholder = searchText.searchBarPlaceholder;
    const resultsId = `search-results-${++searchResultsSequence}`;
    const shortlistId = `search-shortlist-${searchResultsSequence}`;
    const advancedId = `search-advanced-${searchResultsSequence}`;
    const semanticStatusId = `search-semantic-status-${searchResultsSequence}`;

    return (
      <div class={classNames(displayClass, "search")}>
        <button
          class="search-button"
          aria-label={i18n(locale).components.search.title}
          aria-expanded="false"
        >
          <svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.9 19.7">
            <title>{searchText.title}</title>
            <g class="search-path" fill="none">
              <path stroke-linecap="square" d="M18.5 18.3l-5.4-5.4" />
              <circle cx="8" cy="8" r="7" />
            </g>
          </svg>
          <p>{i18n(locale).components.search.title}</p>
        </button>
        <div class="search-container" role="dialog" aria-modal="true" aria-label="搜尋">
          <div class="search-space">
            <div class="search-modes" role="group" aria-label="搜尋範圍">
              <div class="search-mode-tabs">
                <button type="button" class="search-mode" data-mode="verse" aria-pressed="true">
                  經文搜尋
                </button>
                <button
                  type="button"
                  class="search-mode"
                  data-mode="knowledge"
                  aria-pressed="false"
                >
                  知識庫進階
                </button>
              </div>
              <div class="search-mode-actions">
                <button
                  type="button"
                  class="search-shortlist-toggle"
                  aria-expanded="false"
                  aria-controls={shortlistId}
                >
                  暫存清單 <span class="search-verse-list-count">0</span>
                </button>
                <button type="button" class="search-close" aria-label="關閉搜尋">
                  ×
                </button>
              </div>
            </div>
            <input
              autocomplete="off"
              class="search-bar"
              name="search"
              type="text"
              role="searchbox"
              aria-controls={resultsId}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
            />
            <section class="search-verse-controls" aria-label="經文搜尋條件與暫存清單">
              <div class="search-verse-toolbar">
                <div class="search-verse-toolbar-left">
                  <span class="search-scope">傳統和合本</span>
                  <div class="search-suggestions" role="group" aria-label="關鍵字建議" hidden></div>
                </div>
                <button
                  type="button"
                  class="search-advanced-toggle"
                  aria-expanded="false"
                  aria-controls={advancedId}
                >
                  進階條件{" "}
                  <span class="search-advanced-count" hidden>
                    0
                  </span>
                  <span class="search-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>
              </div>
              <div class="search-refinements" role="group" aria-label="已加入的條件" hidden></div>
              <div class="search-verse-advanced" id={advancedId} hidden>
                <form class="search-refine-form">
                  <input
                    type="text"
                    class="search-refine-input"
                    autocomplete="off"
                    placeholder="在結果中再查關鍵字"
                    aria-label="在結果中再查關鍵字"
                    disabled
                  />
                  <button type="submit" class="search-refine-add" disabled>
                    加入條件
                  </button>
                </form>
                <div class="search-verse-options">
                  <span class="search-scope-note">範圍為傳統和合本・本站已收錄的經文</span>
                  <label class="search-check">
                    <input type="checkbox" class="search-strict-literal" />
                    嚴格字面比對
                  </label>
                </div>
              </div>
              <details class="search-verse-list" id={shortlistId}>
                <summary>
                  暫存經文 <span class="search-verse-list-count">0</span> 節
                </summary>
                <div class="search-verse-list-body"></div>
                <button type="button" class="search-verse-copy" disabled>
                  複製清單
                </button>
              </details>
            </section>
            <fieldset class="search-knowledge-controls" hidden>
              <legend>知識類型</legend>
              <label
                class="search-check search-semantic-toggle"
                title="找意思相近的內容，不必完全相同的字"
              >
                <input
                  type="checkbox"
                  class="search-semantic-checkbox"
                  aria-describedby={semanticStatusId}
                />
                語意搜尋
              </label>
              <div class="search-knowledge-actions">
                <button type="button" class="search-knowledge-all">
                  全選
                </button>
                <button type="button" class="search-knowledge-clear">
                  清除
                </button>
              </div>
              <div class="search-knowledge-categories"></div>
              <p class="search-semantic-status" id={semanticStatusId}>
                找意思相近的內容，不必完全相同的字
              </p>
            </fieldset>
            <div
              class="search-layout"
              data-preview={opts.enablePreview}
              data-mode="verse"
              data-field-priority={JSON.stringify(opts.fieldPriority)}
              data-feedback-form={feedbackForm ? JSON.stringify(feedbackForm) : undefined}
              data-no-results={searchText.noResults}
              data-no-results-hint={searchText.noResultsHint}
              data-results-label="搜尋結果"
            >
              <p class="search-result-count" hidden></p>
              <div
                class="results-container"
                id={resultsId}
                role="region"
                aria-label="搜尋結果"
              ></div>
            </div>
          </div>
          <div class="search-sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
        </div>
      </div>
    );
  };

  Search.afterDOMLoaded = script;
  Search.css = style;

  return Search;
}) satisfies QuartzComponentConstructor;
