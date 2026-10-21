import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
} from "@quartz-community/types";
import { classNames } from "../util/lang";
import { i18n } from "../i18n";
import style from "./styles/search.scss";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/search.inline.ts";

export type SearchField = "title" | "content" | "tags";

export interface SearchOptions {
  enablePreview: boolean;
  fieldPriority: SearchField[];
}

const defaultOptions: SearchOptions = {
  enablePreview: true,
  fieldPriority: ["title", "content", "tags"],
};

let searchResultsSequence = 0;

export default ((userOpts?: Partial<SearchOptions>) => {
  const Search: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const opts = { ...defaultOptions, ...userOpts };
    const locale = cfg.locale ?? "en-US";
    const searchText = i18n(locale).components.search;
    const searchPlaceholder = searchText.searchBarPlaceholder;
    const resultsId = `search-results-${++searchResultsSequence}`;

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
            <input
              autocomplete="off"
              class="search-bar"
              name="search"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={resultsId}
              aria-expanded="false"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
            />
            <div
              class="search-layout"
              data-preview={opts.enablePreview}
              data-field-priority={JSON.stringify(opts.fieldPriority)}
              data-no-results={searchText.noResults}
              data-no-results-hint={searchText.noResultsHint}
              data-results-label="搜尋結果"
            >
              <div
                class="results-container"
                id={resultsId}
                role="listbox"
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
