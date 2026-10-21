import {
  removeAllChildren,
  normalizeRelativeURLs,
  registerEscapeHandler,
  resolveBasePath,
  escapeHTML,
} from "@quartz-community/utils";
import {
  findExactMatchSlugs,
  getBookNameFromSlug,
  isSearchExcludedSlug,
  shouldRunExactSearch,
  rankExactMatches,
  warmExactSearchCache,
  getResultCategory,
  summarizeCategories,
  CATEGORY_CHAPTER,
} from "../searchLogic";
import {
  appendSemanticResults,
  composeSearchView,
  createIndexLoader,
  fetchJsonWithTimeout,
  pageResults,
  SEMANTIC_SEARCH_TIMEOUT_MS,
  type SearchIndexState,
  type SearchViewNote,
  type SemanticSearchState,
} from "../searchFlow";
import {
  buildScriptureCard,
  findVerseItems,
  pickVerseItems,
  type ScriptureCard,
} from "../verseTarget";
import { getNextVisibleIndex, getSearchAnnouncement, shouldAnnounce } from "../searchA11y";

const GITHUB_PAGES_HOST = "andyjr5566.github.io";
const GITHUB_PAGES_BASE_PATH = "/Bible_wiki_zh_website";
const SEARCH_API_ORIGIN = "https://bible-wiki-zh-website.vercel.app";
// 一次先畫幾張結果卡片：完整站第一次查詢在全新瀏覽器量到 60 張要 301 ms，改 30 張留出餘裕（B4-1：300 ms 內）
const RESULT_RENDER_LIMIT = 30;

function isGitHubPagesHost(): boolean {
  return window.location.hostname === GITHUB_PAGES_HOST;
}

function getSearchBasePath(): string {
  const configuredBasePath = document.body?.dataset?.basepath ?? "";
  if (configuredBasePath) return configuredBasePath;
  return isGitHubPagesHost() ? GITHUB_PAGES_BASE_PATH : "";
}

function resolveSearchPath(slug: string): string {
  return resolveBasePath(slug, getSearchBasePath());
}

function getSearchApiUrl(query: string): string {
  const origin = isGitHubPagesHost() ? SEARCH_API_ORIGIN : window.location.origin;
  const url = new URL("/api/search", origin);
  url.searchParams.set("q", query);
  return url.toString();
}

interface Item {
  id: number;
  slug: string;
  title: string;
  content: string;
  tags: string[];
  [key: string]: any;
}

interface SearchResultView {
  title: string;
  content: string;
}

interface SearchDisplayResult {
  id: string;
  slug: string;
  tags: string[];
  type: string;
  getView(): SearchResultView;
}

interface DisplayResultsOptions {
  pending?: boolean;
  semanticUnavailable?: boolean;
  indexNote?: SearchViewNote;
  preserveFocus?: boolean;
  preserveRenderedCount?: boolean;
}

let currentSearchTerm: string = "";
const contextWindowWords = 30;
let resultOptionSequence = 0;
let resultsContainerSequence = 0;

let contentData: Record<string, Item> | null = null;
const pendingContentIndexUpdates = new Set<string>();
const ensureIndex = createIndexLoader(fetchContentIndex, async (data) => {
  contentData = data;
  await applyPendingContentIndexUpdates();
  // 索引下載完（通常在使用者還沒打完字之前）就先把正規化全文算好，第一次查詢不用再花這段時間
  setTimeout(() => {
    if (contentData) warmExactSearchCache(contentData);
  }, 0);
});
const fetchContentCache = new Map<string, Element[]>();

function canPreloadContentIndex(): boolean {
  return (
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData !== true
  );
}

interface SemanticSearchResultData {
  slug: string;
  title?: unknown;
  text?: unknown;
}

function isSemanticSearchPayload(data: unknown): data is { results: SemanticSearchResultData[] } {
  if (typeof data !== "object" || data === null || !("results" in data)) return false;
  const results = (data as { results?: unknown }).results;
  // 個別格式不對的結果在下面逐筆略過（appendSemanticResults 會跳過沒有 slug 的），不要因為一筆壞資料就丟掉整包
  return Array.isArray(results);
}

function parseSearchQuery(input: string): { query: string } {
  return { query: input.trim() };
}
const parser = new DOMParser();

async function fetchContent(slug: string): Promise<Element[]> {
  if (fetchContentCache.has(slug)) {
    return fetchContentCache.get(slug) as Element[];
  }
  const targetUrl = new URL(resolveSearchPath(slug), window.location.origin).toString();
  try {
    const res = await fetch(targetUrl);
    if (!res.ok) return [];
    const text = await res.text();
    const html = parser.parseFromString(text ?? "", "text/html");
    normalizeRelativeURLs(html, targetUrl);
    const contents = Array.from(html.getElementsByClassName("popover-hint"));
    fetchContentCache.set(slug, contents);
    return contents;
  } catch {
    return [];
  }
}

const cleanupFns: Array<() => void> = [];

function addCleanup(fn: () => void) {
  cleanupFns.push(fn);
}

function runCleanups() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns.length = 0;
}

function setupSearch() {
  const searchElements = document.querySelectorAll(".search");

  for (const searchEl of Array.from(searchElements)) {
    const container = searchEl.querySelector(".search-container") as HTMLElement | null;
    const searchButton = searchEl.querySelector(".search-button") as HTMLElement | null;
    const searchBar = searchEl.querySelector(".search-bar") as HTMLInputElement;
    const searchLayout = searchEl.querySelector(".search-layout");

    if (!container || !searchButton || !searchBar || !searchLayout) continue;

    const sidebar = container.closest(".sidebar") as HTMLElement | null;
    const enablePreview = searchLayout.getAttribute("data-preview") === "true";
    const fieldPriorityAttr = searchLayout.getAttribute("data-field-priority");
    const fieldPriority: string[] = fieldPriorityAttr
      ? JSON.parse(fieldPriorityAttr)
      : ["title", "content", "tags"];

    let results = searchLayout.querySelector(".results-container") as HTMLDivElement | null;
    if (!results) {
      results = document.createElement("div");
      results.className = "results-container";
      searchLayout.appendChild(results);
    }
    if (!results.id) {
      let resultsId = "";
      do {
        resultsId = `search-results-${++resultsContainerSequence}`;
      } while (document.getElementById(resultsId));
      results.id = resultsId;
    }
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", "搜尋結果");
    searchBar.setAttribute("aria-controls", results.id);
    searchBar.setAttribute("role", "combobox");
    searchBar.setAttribute("aria-autocomplete", "list");
    searchBar.setAttribute("aria-expanded", "false");

    let status = container.querySelector(".search-sr-only") as HTMLElement | null;
    if (!status) {
      status = document.createElement("div");
      status.className = "search-sr-only";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      container.appendChild(status);
    }

    let preview = searchLayout.querySelector(".preview-container") as HTMLDivElement | null;
    if (enablePreview && !preview) {
      preview = document.createElement("div");
      preview.className = "preview-container";
      searchLayout.appendChild(preview);
    }

    let currentHover: HTMLElement | null = null;
    // 使用者這次查詢有沒有自己移動過選取（方向鍵、滑鼠、Tab）。沒動過時，結果重畫一律選最上面那一張；
    // 經文跳轉卡片比全文結果晚出現（要先查小索引），不這樣做的話選取會停在第一筆全文結果，按 Enter 就跳錯頁
    let selectionTouched = false;
    let previewToken = 0;
    let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let latestSearchRequest = 0;
    let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
    let semanticRequestController: AbortController | null = null;
    // 目前選的類型篩選；null 代表「全部」。換新查詢時重設，語意結果晚到時保留。
    let activeCategory: string | null = null;
    // 目前查詢若是經文參照（出12:3），結果清單最上面的「經文跳轉」卡片資料
    let scriptureCard: ScriptureCard | null = null;
    let currentResults: SearchDisplayResult[] = [];
    let currentDisplayOptions: DisplayResultsOptions = {};
    let renderedResultCount = 0;
    const announcedMessages = new Set<string>();

    const announce = (message: string | null) => {
      if (shouldAnnounce(announcedMessages, message)) status!.textContent = message!;
    };

    const preloadIndex = () => {
      if (canPreloadContentIndex()) void ensureIndex();
    };

    const hideSearch = () => {
      container.classList.remove("active");
      if (sidebar) sidebar.style.zIndex = "";
      searchButton.setAttribute("aria-expanded", "false");
      searchBar.setAttribute("aria-expanded", "false");
      searchBar.removeAttribute("aria-activedescendant");
      searchBar.value = "";
      removeAllChildren(results!);
      searchLayout.querySelector(".result-filters")?.remove();
      if (preview) removeAllChildren(preview);
      status!.textContent = "";
      searchLayout.classList.remove("display-results");
      latestSearchRequest++;
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      semanticRequestController?.abort();
      semanticRequestController = null;
      currentHover = null;
      searchButton.focus();
    };

    const showSearch = () => {
      preloadIndex();
      if (sidebar) sidebar.style.zIndex = "9999";
      container.classList.add("active");
      searchButton.setAttribute("aria-expanded", "true");
      searchBar.focus();
    };

    const getResultElements = (): HTMLElement[] => {
      return Array.from(
        results.querySelectorAll<HTMLElement>(
          ".result-card[role='option']:not(.no-match):not(.scripture-missing):not([hidden])",
        ),
      );
    };

    const updateComboboxState = () => {
      const visibleResults = getResultElements();
      const selected = currentHover && visibleResults.includes(currentHover) ? currentHover : null;
      for (const option of Array.from(
        results.querySelectorAll<HTMLElement>(".result-card[role='option']"),
      )) {
        option.setAttribute("aria-selected", String(option === selected));
      }
      if (selected?.id) {
        searchBar.setAttribute("aria-activedescendant", selected.id);
      } else {
        searchBar.removeAttribute("aria-activedescendant");
      }
      searchBar.setAttribute("aria-expanded", String(visibleResults.length > 0));
    };

    const createResultCardElement = (item: SearchDisplayResult): HTMLElement => {
      const view = item.getView();
      const itemTile = document.createElement("a");
      itemTile.className = "result-card";
      itemTile.id = `search-opt-${++resultOptionSequence}`;
      itemTile.dataset.slug = item.slug;
      itemTile.setAttribute("role", "option");
      itemTile.setAttribute("aria-selected", "false");
      itemTile.href = resolveSearchPath(item.slug);

      const category = getResultCategory(item.slug);
      itemTile.dataset.category = category;

      const titleEl = document.createElement("h3");
      titleEl.className = "card-title";

      const categoryTag = document.createElement("span");
      categoryTag.className = "result-category";
      categoryTag.dataset.category = category;
      categoryTag.textContent = category;
      titleEl.appendChild(categoryTag);

      const titleText = document.createElement("span");
      titleText.className = "result-title-text";
      // 書卷名只加在章節前面；條目的 link_folder 資料夾名稱已由類型標籤顯示
      const bookName = category === CATEGORY_CHAPTER ? getBookNameFromSlug(item.slug) : "";
      const plainTitle = view.title.replace(/<[^>]*>/g, "");
      const bookPrefix =
        bookName && !plainTitle.includes(bookName) ? escapeHTML(bookName) + " " : "";
      titleText.innerHTML = bookPrefix + view.title.replace(/<(?!\/?span\b)[^>]*>/gi, "");
      titleEl.appendChild(titleText);

      // 比對方式徽章：樣式由 CSS class 控制，視覺上比類型標籤次要
      if (item.type === "semantic" || item.type === "keyword") {
        const badge = document.createElement("span");
        badge.className = `result-match-badge result-match-${item.type}`;
        badge.textContent = item.type === "semantic" ? "語意相關" : "完全相符";
        titleEl.appendChild(badge);
      }

      itemTile.appendChild(titleEl);

      if (item.tags.length > 0) {
        const tagList = document.createElement("ul");
        tagList.className = "tags";
        // 每個標籤包在 <li> 裡（axe：<ul> 只能直接包 <li>）
        tagList.innerHTML = item.tags
          .map((tag: string) => `<li><p>${escapeHTML(String(tag))}</p></li>`)
          .join("");
        itemTile.appendChild(tagList);
      }

      // 一行摘要（含命中字的片段）；內容是空的就不顯示摘要列
      const snippetHtml = String(view.content ?? "").replace(/<(?!\/?span\b)[^>]*>/gi, "");
      if (snippetHtml.replace(/<[^>]*>/g, "").trim() !== "") {
        const descEl = document.createElement("p");
        descEl.className = "card-description";
        descEl.innerHTML = snippetHtml;
        itemTile.appendChild(descEl);
      }

      return itemTile;
    };

    const appendNextResults = (focusFirst = false) => {
      const previousOptionCount = getResultElements().length;
      results.querySelector(".search-more-note")?.remove();
      results.querySelector(".search-more-btn")?.remove();

      const page = pageResults(
        currentResults,
        activeCategory,
        (item) => getResultCategory(item.slug),
        renderedResultCount,
        RESULT_RENDER_LIMIT,
      );
      for (const item of page.items) {
        const card = createResultCardElement(item);
        const footer = results.querySelector(".search-index-note, .search-semantic-note");
        if (footer) {
          results.insertBefore(card, footer);
        } else {
          results.appendChild(card);
        }
      }
      renderedResultCount += page.items.length;

      if (page.remaining > 0) {
        const moreNote = document.createElement("p");
        moreNote.className = "search-more-note";
        moreNote.textContent = `還有 ${page.remaining} 筆結果，可以用上方的類型篩選或加長關鍵字。`;
        results.appendChild(moreNote);

        const moreButton = document.createElement("button");
        moreButton.type = "button";
        moreButton.className = "search-more-btn";
        // 它放在 listbox 裡，axe 要求 listbox 的子元素是 option；方向鍵只走 .result-card，所以不影響鍵盤選取
        moreButton.setAttribute("role", "option");
        moreButton.setAttribute("aria-selected", "false");
        moreButton.textContent = `再顯示 ${RESULT_RENDER_LIMIT} 筆`;
        results.appendChild(moreButton);
      }

      if (focusFirst) {
        const options = getResultElements();
        setFocus(options[previousOptionCount] ?? null);
      } else {
        updateComboboxState();
      }
    };

    const displayResults = (
      finalResults: SearchDisplayResult[],
      options: DisplayResultsOptions = {},
    ) => {
      const previousFocus = options.preserveFocus && selectionTouched ? currentHover : null;
      const previousFocusSlug = previousFocus?.dataset.slug;
      const previousToolbarScroll =
        searchLayout.querySelector<HTMLElement>(".result-filters")?.scrollLeft ?? 0;
      const previousRenderedCount = renderedResultCount;
      const targetRenderedCount = options.preserveRenderedCount
        ? Math.max(RESULT_RENDER_LIMIT, previousRenderedCount)
        : RESULT_RENDER_LIMIT;
      currentResults = finalResults;
      currentDisplayOptions = { ...options };
      removeAllChildren(results);
      renderedResultCount = 0;
      currentHover = null;
      searchBar.removeAttribute("aria-activedescendant");
      renderFilterToolbar(finalResults.map((item) => getResultCategory(item.slug)));

      if (scriptureCard) results.appendChild(createScriptureCardElement(scriptureCard));

      if (finalResults.length === 0) {
        if (options.pending) {
          if (options.indexNote !== "index-loading" && options.indexNote !== "exact-loading") {
            const pendingNote = document.createElement("p");
            pendingNote.className = "search-pending-note";
            pendingNote.textContent = "搜尋中…";
            results.appendChild(pendingNote);
          }
        } else if (
          options.indexNote !== "search-unavailable" &&
          (!scriptureCard || scriptureCard.kind === "missing")
        ) {
          const noMatch = document.createElement("a");
          noMatch.className = "result-card no-match";
          const noMatchTitle = document.createElement("h3");
          noMatchTitle.textContent = "找不到相符的結果";
          const noMatchHint = document.createElement("p");
          noMatchHint.textContent =
            searchLayout.getAttribute("data-no-results-hint") || "換個關鍵字試試看？";
          noMatch.appendChild(noMatchTitle);
          noMatch.appendChild(noMatchHint);
          results.appendChild(noMatch);
        }
      } else {
        appendNextResults();
        while (
          options.preserveRenderedCount &&
          renderedResultCount < targetRenderedCount &&
          results.querySelector(".search-more-btn")
        ) {
          appendNextResults();
        }
      }

      if (options.indexNote) {
        const indexNote = document.createElement("p");
        indexNote.className = "search-index-note";
        const indexNoteMessages: Record<Exclude<SearchViewNote, "semantic-unavailable">, string> = {
          "index-loading": "搜尋資料載入中…",
          "exact-loading": "正在尋找完全相符的結果…",
          "index-unavailable": "完全相符的結果暫時無法載入，目前只顯示語意相關的結果。",
          "search-unavailable": "搜尋暫時無法使用，請稍後再試。",
        };
        if (options.indexNote !== "semantic-unavailable") {
          indexNote.textContent = indexNoteMessages[options.indexNote];
          results.appendChild(indexNote);
        }
      }

      if (options.semanticUnavailable) {
        const semanticNote = document.createElement("p");
        semanticNote.className = "search-semantic-note";
        semanticNote.textContent = "語意搜尋暫時沒有回應，目前只顯示完全相符的結果。";
        results.appendChild(semanticNote);
      }

      const moreNote = results.querySelector(".search-more-note");
      const moreButton = results.querySelector(".search-more-btn");
      if (moreNote) results.appendChild(moreNote);
      if (moreButton) results.appendChild(moreButton);

      applyCategoryFilter();
      const toolbarEl = searchLayout.querySelector<HTMLElement>(".result-filters");
      if (toolbarEl) toolbarEl.scrollLeft = previousToolbarScroll;
      const resultElements = getResultElements();
      if (resultElements.length === 0) {
        setFocus(null);
        if (preview) removeAllChildren(preview);
      } else if (previousFocus && previousFocusSlug) {
        const nextFocus = resultElements.find(
          (element) => element.dataset.slug === previousFocusSlug,
        );
        if (nextFocus) {
          setFocus(nextFocus);
        } else {
          setFocus(resultElements[0] ?? null);
        }
      } else {
        setFocus(resultElements[0] ?? null);
      }
      updateComboboxState();
    };
    // 經文跳轉卡片不屬於任何類型：篩選時一直留在最上面。找不到內容的那一張（scripture-missing）不能被選到。
    const createScriptureCardElement = (card: ScriptureCard): HTMLElement => {
      const el = document.createElement(card.kind === "missing" ? "div" : "a");
      el.className = "result-card scripture-jump";
      if (card.kind === "missing") {
        el.classList.add("scripture-missing");
      } else {
        el.id = `search-opt-${++resultOptionSequence}`;
        el.dataset.slug = card.slug;
        el.setAttribute("role", "option");
        el.setAttribute("aria-selected", "false");
        (el as HTMLAnchorElement).href = resolveSearchPath(card.slug);
        if (card.kind === "chapter" && card.verse !== undefined) {
          el.dataset.verse = String(card.verse);
          if (card.verseEnd !== undefined) el.dataset.verseEnd = String(card.verseEnd);
        }
      }

      const titleEl = document.createElement("h3");
      titleEl.className = "card-title";
      const tag = document.createElement("span");
      tag.className = "result-category";
      tag.dataset.category = "章節";
      tag.textContent = "經文";
      const titleText = document.createElement("span");
      titleText.className = "result-title-text";
      titleText.textContent = card.title;
      titleEl.appendChild(tag);
      titleEl.appendChild(titleText);
      el.appendChild(titleEl);

      const sub = document.createElement("p");
      sub.className = "card-description";
      sub.textContent = card.subtitle;
      el.appendChild(sub);
      return el;
    };

    // 結果清單上方的類型篩選列：只在結果有兩種以上類型時顯示
    const renderFilterToolbar = (categories: string[]) => {
      searchLayout.querySelector(".result-filters")?.remove();
      const summary = summarizeCategories(categories);
      if (summary.length < 2) {
        activeCategory = null;
        return;
      }
      // 保留使用者已選的篩選；若該類型已不在結果中才退回「全部」
      if (activeCategory !== null && !summary.some((entry) => entry.name === activeCategory)) {
        activeCategory = null;
      }

      const toolbar = document.createElement("div");
      toolbar.className = "result-filters";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", "依類型篩選");

      const addButton = (label: string, count: number, value: string | null) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "result-filter";
        button.dataset.filter = value ?? "";
        button.setAttribute("aria-pressed", "false");
        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        const countEl = document.createElement("span");
        countEl.className = "result-filter-count";
        countEl.textContent = String(count);
        button.appendChild(labelEl);
        button.appendChild(countEl);
        toolbar.appendChild(button);
      };
      addButton("全部", categories.length, null);
      for (const entry of summary) addButton(entry.name, entry.count, entry.name);
      searchLayout.insertBefore(toolbar, results);
    };

    // 依 activeCategory 更新篩選鈕的 aria-pressed；結果卡片已依類型重新分頁繪製
    const applyCategoryFilter = () => {
      for (const button of Array.from(
        searchLayout.querySelectorAll<HTMLElement>(".result-filter"),
      )) {
        const value = button.dataset.filter ? button.dataset.filter : null;
        button.setAttribute("aria-pressed", String(value === activeCategory));
      }
      updateComboboxState();
    };

    const highlightTerm = () => {
      return currentSearchTerm.trim();
    };

    const updatePreview = async (el: HTMLElement | null) => {
      if (!preview) return;
      removeAllChildren(preview);
      if (!el) return;
      const slug = el.dataset.slug;
      if (!slug) return;
      const token = ++previewToken;
      const contents = await fetchContent(slug);
      if (token !== previewToken) return;
      const term = highlightTerm();
      const previewInner = document.createElement("div");
      previewInner.className = "preview-inner";
      for (const contentEl of contents) {
        const cloned = contentEl.cloneNode(true) as HTMLElement;
        if (term.trim() !== "") {
          cloned.innerHTML = highlightHTML(term, cloned);
        }
        previewInner.appendChild(cloned);
      }
      preview.appendChild(previewInner);

      requestAnimationFrame(() => {
        const highlights = Array.from(preview!.getElementsByClassName("highlight"));
        if (highlights.length === 0) return;
        highlights.sort((a, b) => b.innerHTML.length - a.innerHTML.length);
        const target = highlights[0] as HTMLElement;
        let offset = 0;
        let current: HTMLElement | null = target;
        while (current && current !== preview) {
          offset += current.offsetTop;
          current = current.offsetParent as HTMLElement | null;
        }
        preview!.scrollTop = Math.max(0, offset - 50);
      });
    };

    const setFocus = (el: HTMLElement | null) => {
      if (currentHover) currentHover.classList.remove("focus");
      currentHover = el;
      if (currentHover) {
        currentHover.classList.add("focus");
        currentHover.scrollIntoView({ block: "nearest" });
      }
      updateComboboxState();
      if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => updatePreview(currentHover), 150);
    };

    const focusByDirection = (direction: -1 | 1) => {
      const allOptions = Array.from(
        results.querySelectorAll<HTMLElement>(".result-card[role='option']"),
      );
      const visibleOptions = allOptions.filter((option) => !option.hidden);
      const currentIndex = currentHover ? allOptions.indexOf(currentHover) : -1;
      if (
        direction === 1 &&
        currentHover &&
        currentIndex === visibleOptions.length - 1 &&
        results.querySelector(".search-more-btn")
      ) {
        selectionTouched = true;
        appendNextResults(true);
        return;
      }
      const nextIndex = getNextVisibleIndex(
        currentIndex,
        direction,
        allOptions.map((option) => !option.hidden),
      );
      if (nextIndex >= 0) {
        selectionTouched = true;
        setFocus(allOptions[nextIndex] ?? null);
      }
    };

    const onType = (e: Event) => {
      const inputValue = (e.target as HTMLInputElement).value;
      currentSearchTerm = inputValue;
      const requestId = ++latestSearchRequest;
      activeCategory = null;
      scriptureCard = null;
      selectionTouched = false;
      announcedMessages.clear();
      status!.textContent = "";
      semanticRequestController?.abort();
      semanticRequestController = null;
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

      const parsed = parseSearchQuery(inputValue);
      const hasContent = parsed.query !== "";
      searchLayout.classList.toggle("display-results", hasContent);

      if (currentHover) currentHover.classList.remove("focus");
      currentHover = null;

      if (!hasContent) {
        removeAllChildren(results);
        searchLayout.querySelector(".result-filters")?.remove();
        if (preview) removeAllChildren(preview);
        searchBar.setAttribute("aria-expanded", "false");
        searchBar.removeAttribute("aria-activedescendant");
        return;
      }

      searchDebounceTimer = setTimeout(() => {
        if (requestId !== latestSearchRequest) return;
        const displayTerm = parsed.query;
        let indexState: SearchIndexState = contentData ? "ready" : "loading";
        let semanticState: SemanticSearchState = "loading";
        let exactResults: SearchDisplayResult[] = [];
        let semanticResults: SearchDisplayResult[] = [];

        const buildExactResults = () => {
          const data = contentData ?? {};
          const exactSlugs = shouldRunExactSearch(parsed.query)
            ? rankExactMatches(data, findExactMatchSlugs(data, parsed.query), parsed.query)
            : [];
          return exactSlugs.flatMap((slug) => {
            const doc = data[slug];
            if (!doc) return [];
            let view: SearchResultView | undefined;
            return [
              {
                id: slug,
                slug,
                tags: doc.tags || [],
                type: "keyword",
                getView: () => {
                  if (!view) {
                    view = {
                      title: highlight(displayTerm, doc.title || slug),
                      content: highlight(displayTerm, doc.content || "", true),
                    };
                  }
                  return view;
                },
              },
            ];
          });
        };

        const renderCurrentResults = () => {
          const view = composeSearchView({
            exact: exactResults,
            semantic: semanticResults,
            indexState,
            semanticState,
          });
          displayResults(view.results, {
            pending: view.pending,
            semanticUnavailable: view.notes.includes("semantic-unavailable"),
            indexNote: view.notes.find((note) => note !== "semantic-unavailable"),
            preserveFocus: true,
            preserveRenderedCount: true,
          });
          if (indexState === "ready") {
            announce(getSearchAnnouncement("exact", exactResults.length));
          }
        };

        if (contentData) exactResults = buildExactResults();
        renderCurrentResults();

        // 經文參照（出12:3）：用小索引（fetchData）的 key 判斷這一章／這一卷有沒有內容，不等完整內文索引
        void getKnownSlugs().then((knownSlugs) => {
          if (requestId !== latestSearchRequest) return;
          scriptureCard = knownSlugs
            ? buildScriptureCard(parsed.query, (slug) => knownSlugs.has(slug))
            : null;
          if (scriptureCard && scriptureCard.kind !== "missing") {
            announce(
              getSearchAnnouncement("scripture", scriptureCard.title.replace(/^跳到\s*/, "")),
            );
          }
          renderCurrentResults();
        });

        if (indexState === "loading") {
          void ensureIndex().then((loaded) => {
            if (requestId !== latestSearchRequest) return;
            indexState = loaded ? "ready" : "error";
            if (loaded) exactResults = buildExactResults();
            renderCurrentResults();
          });
        }

        // Start semantic search immediately; index loading proceeds independently.
        const controller = new AbortController();
        semanticRequestController = controller;
        void fetchJsonWithTimeout(getSearchApiUrl(parsed.query), {
          timeoutMs: SEMANTIC_SEARCH_TIMEOUT_MS,
          signal: controller.signal,
        }).then((semanticResponse) => {
          if (requestId !== latestSearchRequest) return;
          if (semanticRequestController === controller) semanticRequestController = null;

          if (semanticResponse.status !== "ok" || !isSemanticSearchPayload(semanticResponse.data)) {
            semanticState = "error";
            renderCurrentResults();
            return;
          }

          const semanticAdditions = appendSemanticResults(
            exactResults.map((result) => result.slug),
            semanticResponse.data.results.filter(
              (result): result is SemanticSearchResultData =>
                typeof result === "object" && result !== null && typeof result.slug === "string",
            ),
            isSearchExcludedSlug,
          );
          semanticResults = semanticAdditions.map((result) => {
            const title = typeof result.title === "string" ? result.title : result.slug;
            const text = typeof result.text === "string" ? result.text : "";
            let view: SearchResultView | undefined;
            return {
              id: result.slug,
              slug: result.slug,
              tags: [],
              type: "semantic",
              getView: () => {
                if (!view) {
                  view = {
                    title: highlight(displayTerm, title),
                    content: highlight(displayTerm, text, true),
                  };
                }
                return view;
              },
            };
          });
          semanticState = "ready";
          if (semanticAdditions.length > 0) {
            announce(getSearchAnnouncement("semantic", semanticAdditions.length));
          }
          renderCurrentResults();
        });
        // 停止輸入 100 ms 後才搜尋：完整站第一次查詢含這段約 260 ms，達到 B4-1「300 ms 內」；舊的語意請求會被取消
      }, 100);
    };
    const onButtonClick = (e: Event) => {
      e.stopPropagation();
      showSearch();
    };
    searchButton.addEventListener("click", onButtonClick);
    addCleanup(() => searchButton.removeEventListener("click", onButtonClick));

    searchButton.addEventListener("pointerenter", preloadIndex);
    searchButton.addEventListener("focus", preloadIndex);
    searchButton.addEventListener("touchstart", preloadIndex, { passive: true });
    searchBar.addEventListener("focus", preloadIndex);
    addCleanup(() => {
      searchButton.removeEventListener("pointerenter", preloadIndex);
      searchButton.removeEventListener("focus", preloadIndex);
      searchButton.removeEventListener("touchstart", preloadIndex);
      searchBar.removeEventListener("focus", preloadIndex);
    });

    searchBar.addEventListener("input", onType);
    addCleanup(() => searchBar.removeEventListener("input", onType));

    const onSearchBarKeydown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        focusByDirection(-1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusByDirection(1);
        return;
      }
      if (e.key === "Enter" && !e.isComposing) {
        const visibleResults = getResultElements();
        const focused =
          currentHover && visibleResults.includes(currentHover)
            ? currentHover
            : (visibleResults[0] ?? null);
        if (focused instanceof HTMLAnchorElement) {
          e.preventDefault();
          setFocus(focused);
          storeNavigationHint(focused);
          hideSearch();
          focused.click();
        }
      }
    };
    searchBar.addEventListener("keydown", onSearchBarKeydown);
    addCleanup(() => searchBar.removeEventListener("keydown", onSearchBarKeydown));

    const onDialogKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusableSelector =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          !element.hidden &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );
      const lastFocusable = focusableElements[focusableElements.length - 1] ?? searchBar;

      if (e.target === searchBar && e.shiftKey) {
        e.preventDefault();
        lastFocusable.focus();
      } else if (e.target === lastFocusable && !e.shiftKey) {
        e.preventDefault();
        searchBar.focus();
      }
    };
    container.addEventListener("keydown", onDialogKeydown);
    addCleanup(() => container.removeEventListener("keydown", onDialogKeydown));

    const onDocumentKeydown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        container.classList.contains("active") ? hideSearch() : showSearch();
      }
    };
    document.addEventListener("keydown", onDocumentKeydown);
    addCleanup(() => document.removeEventListener("keydown", onDocumentKeydown));

    const storeSearchTerm = () => {
      const term = currentSearchTerm.trim();
      if (term) sessionStorage.setItem("search-term", term);
    };

    // 換頁後要捲到哪裡：經文跳轉卡片存 search-verse（章節 + 節數），其他結果存搜尋字
    const storeNavigationHint = (card: HTMLElement) => {
      try {
        if (!card.classList.contains("scripture-jump")) {
          storeSearchTerm();
          return;
        }
        const verse = Number(card.dataset.verse);
        if (!card.dataset.slug || !Number.isInteger(verse) || verse < 1) return;
        const verseEnd = Number(card.dataset.verseEnd);
        sessionStorage.setItem(
          "search-verse",
          JSON.stringify({
            slug: card.dataset.slug,
            verse,
            verseEnd: Number.isInteger(verseEnd) && verseEnd >= verse ? verseEnd : verse,
          }),
        );
      } catch {
        // sessionStorage 不能用就算了，只是不會標示節數／捲到搜尋字
      }
    };

    const onResultsClick = (e: Event) => {
      const moreButton = (e.target as HTMLElement).closest(".search-more-btn");
      if (moreButton) {
        e.preventDefault();
        appendNextResults();
        return;
      }
      const target = (e.target as HTMLElement).closest(".result-card") as HTMLAnchorElement | null;
      if (!target || target.classList.contains("no-match")) return;
      if (target.classList.contains("scripture-missing")) return;
      if (e instanceof MouseEvent && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) return;
      storeNavigationHint(target);
      hideSearch();
    };
    const onResultsMouseover = (e: Event) => {
      const target = (e.target as HTMLElement).closest(".result-card") as HTMLElement | null;
      if (!target || target.classList.contains("no-match")) return;
      if (target.classList.contains("scripture-missing")) return;
      selectionTouched = true;
      setFocus(target);
    };
    const onResultsFocusIn = (e: Event) => {
      const target = (e.target as HTMLElement).closest(
        ".result-card[role='option']",
      ) as HTMLElement | null;
      if (!target || target.hidden) return;
      selectionTouched = true;
      setFocus(target);
    };
    const onFilterClick = (e: Event) => {
      const button = (e.target as HTMLElement).closest(".result-filter") as HTMLElement | null;
      if (!button) return;
      activeCategory = button.dataset.filter ? button.dataset.filter : null;
      displayResults(currentResults, {
        ...currentDisplayOptions,
        preserveFocus: true,
        preserveRenderedCount: false,
      });
    };
    // 按篩選鈕時不要讓搜尋框失去焦點（手機上才不會收起鍵盤、方向鍵也還能用）
    const onFilterMousedown = (e: Event) => {
      if ((e.target as HTMLElement).closest(".result-filters, .search-more-btn"))
        e.preventDefault();
    };
    searchLayout.addEventListener("click", onFilterClick);
    searchLayout.addEventListener("mousedown", onFilterMousedown);
    results.addEventListener("click", onResultsClick);
    results.addEventListener("mouseover", onResultsMouseover);
    results.addEventListener("focusin", onResultsFocusIn);
    addCleanup(() => {
      searchLayout.removeEventListener("click", onFilterClick);
      searchLayout.removeEventListener("mousedown", onFilterMousedown);
      results!.removeEventListener("click", onResultsClick);
      results!.removeEventListener("mouseover", onResultsMouseover);
      results!.removeEventListener("focusin", onResultsFocusIn);
    });

    const cleanupEscapeHandler = registerEscapeHandler(container, hideSearch);
    addCleanup(cleanupEscapeHandler);
  }
}

function tokenizeTerm(term: string): string[] {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== "");
  const tokenLen = tokens.length;
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "));
    }
  }
  return tokens.sort((a, b) => b.length - a.length);
}

function highlightHTML(searchTerm: string, el: HTMLElement): string {
  const tokenizedTerms = tokenizeTerm(searchTerm).filter((term) => term.trim() !== "");
  if (tokenizedTerms.length === 0) return el.innerHTML;
  const html = parser.parseFromString(el.innerHTML, "text/html");
  const combined = tokenizedTerms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (combined === "") return el.innerHTML;
  const regex = new RegExp(combined, "gi");
  const walker = html.createTreeWalker(html.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Text | null = walker.nextNode() as Text | null;
  while (node) {
    nodes.push(node);
    node = walker.nextNode() as Text | null;
  }
  for (const textNode of nodes) {
    const text = textNode.nodeValue ?? "";
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;
    const fragment = html.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(html.createTextNode(text.slice(lastIndex, match.index)));
      }
      const span = html.createElement("span");
      span.className = "highlight";
      span.textContent = match[0];
      fragment.appendChild(span);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(html.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
  return html.body.innerHTML;
}

function highlight(searchTerm: string, text: string, trim?: boolean): string {
  const tokenizedTerms = tokenizeTerm(searchTerm);
  let tokenizedText = escapeHTML(text)
    .split(/\s+/)
    .filter((t) => t !== "");

  let startIndex = 0;
  let endIndex = tokenizedText.length - 1;

  if (trim) {
    const includesCheck = (tok: string) => {
      return tokenizedTerms.some((term) => tok.toLowerCase().startsWith(term.toLowerCase()));
    };
    const occurrencesIndices = tokenizedText.map(includesCheck);

    let bestSum = 0;
    let bestIndex = 0;
    for (let i = 0; i < Math.max(tokenizedText.length - contextWindowWords, 0); i++) {
      const window = occurrencesIndices.slice(i, i + contextWindowWords);
      const windowSum = window.reduce((total, cur) => total + (cur ? 1 : 0), 0);
      if (windowSum >= bestSum) {
        bestSum = windowSum;
        bestIndex = i;
      }
    }

    startIndex = Math.max(bestIndex - contextWindowWords, 0);
    endIndex = Math.min(startIndex + 2 * contextWindowWords, tokenizedText.length - 1);
    tokenizedText = tokenizedText.slice(startIndex, endIndex);
  }

  const slice = tokenizedText
    .map((tok) => {
      let result = tok;
      for (const searchTok of tokenizedTerms) {
        if (tok.toLowerCase().includes(searchTok.toLowerCase())) {
          const regex = new RegExp(searchTok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          result = tok.replace(regex, (match) => `<span class="highlight">${match}</span>`);
          break;
        }
      }
      return result;
    })
    .join(" ");

  return (
    (startIndex === 0 ? "" : "...") + slice + (endIndex === tokenizedText.length - 1 ? "" : "...")
  );
}

async function fetchContentIndex(): Promise<Record<string, Item>> {
  // fetchData 現在是只有標題與連結的小索引（U-18）；搜尋需要全文，改讀完整索引（舊版頁面沒有這個函式時退回 fetchData）
  const data =
    typeof fetchFullContentIndex === "function" ? await fetchFullContentIndex() : await fetchData;
  return data as unknown as Record<string, Item>;
}

/** 小索引（fetchData）的 key 就是所有頁面的 slug；一定會載入，不用等完整內文索引。載入失敗回傳 null。 */
async function getKnownSlugs(): Promise<Set<string> | null> {
  try {
    const base = (await fetchData) as unknown as Record<string, unknown>;
    if (!base || typeof base !== "object") return null;
    const content = base.content;
    const root = content && typeof content === "object" ? (content as object) : base;
    return new Set(Object.keys(root));
  } catch {
    return null;
  }
}

async function addContentIndexEntries(patch: Record<string, Item>): Promise<number> {
  if (!contentData) return 0;
  let added = 0;
  for (const slug of Object.keys(patch)) {
    if (contentData[slug]) continue;
    const fileData = patch[slug];
    if (!fileData) continue;
    contentData[slug] = fileData;
    added++;
  }
  return added;
}

async function applyContentIndexUpdates(slugs: string[]): Promise<boolean> {
  try {
    const base = (await fetchData) as unknown as Record<string, unknown>;
    if (!base || typeof base !== "object") return false;
    const root =
      (base as Record<string, unknown>).content &&
      typeof (base as Record<string, unknown>).content === "object"
        ? ((base as Record<string, unknown>).content as Record<string, unknown>)
        : (base as Record<string, unknown>);
    const patch: Record<string, Item> = {};
    for (const slug of slugs) {
      const entry = root[slug];
      if (entry && typeof entry === "object") {
        patch[slug] = entry as Item;
      }
    }
    await addContentIndexEntries(patch);
    return true;
  } catch {
    return false;
  }
}

async function applyPendingContentIndexUpdates(): Promise<void> {
  if (pendingContentIndexUpdates.size === 0) return;
  const slugs = [...pendingContentIndexUpdates];
  if (await applyContentIndexUpdates(slugs)) {
    for (const slug of slugs) pendingContentIndexUpdates.delete(slug);
  }
}

document.addEventListener("content-index-updated", (event) => {
  const detail = (event as CustomEvent).detail as { slugs?: string[] } | undefined;
  const slugs = detail?.slugs;
  if (!Array.isArray(slugs) || slugs.length === 0) return;

  if (!contentData) {
    for (const slug of slugs) pendingContentIndexUpdates.add(slug);
    return;
  }
  void applyContentIndexUpdates(slugs);
});

function scrollToSearchTerm() {
  const term = sessionStorage.getItem("search-term");
  if (!term) return;
  sessionStorage.removeItem("search-term");

  requestAnimationFrame(() => {
    const headingSelector =
      ".popover-hint h1, .popover-hint h2, .popover-hint h3, .popover-hint h4, " +
      ".popover-hint h5, .popover-hint h6, article h1, article h2, article h3";
    const bodySelector =
      ".popover-hint p, .popover-hint li, .popover-hint td, .popover-hint th, " +
      ".popover-hint blockquote, article p, article li";
    const headings = document.querySelectorAll(headingSelector);
    const bodyEls = document.querySelectorAll(bodySelector);
    const candidates = [...Array.from(headings), ...Array.from(bodyEls)];

    for (const el of candidates) {
      const text = el.textContent ?? "";
      const idx = text.toLowerCase().indexOf(term.toLowerCase());
      if (idx === -1) continue;

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let charCount = 0;
      let node: Text | null;
      let startNode: Text | null = null;
      let startOffset = 0;
      let endNode: Text | null = null;
      let endOffset = 0;

      while ((node = walker.nextNode() as Text | null)) {
        const len = node.nodeValue?.length ?? 0;
        if (!startNode && charCount + len > idx) {
          startNode = node;
          startOffset = idx - charCount;
        }
        if (startNode && charCount + len >= idx + term.length) {
          endNode = node;
          endOffset = idx + term.length - charCount;
          break;
        }
        charCount += len;
      }

      if (!startNode || !endNode) continue;

      try {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const span = document.createElement("span");
        span.className = "search-scroll-target";
        range.surroundContents(span);
        span.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => {
          span.classList.add("fade-out");
          setTimeout(() => {
            const parent = span.parentNode;
            if (parent) {
              parent.replaceChild(document.createTextNode(span.textContent || ""), span);
              parent.normalize();
            }
          }, 1000);
        }, 2000);
      } catch {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      break;
    }
  });
}

/**
 * 點經文跳轉卡片後換頁：如果目前頁面就是存的章節，捲到那幾節並短暫高亮。
 * 回傳 true 代表有 search-verse（不論有沒有成功標示），此時不要再跑 scrollToSearchTerm。
 */
function scrollToSearchVerse(): boolean {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem("search-verse");
    if (raw !== null) sessionStorage.removeItem("search-verse");
  } catch {
    return false;
  }
  if (raw === null) return false;

  let stored: { slug?: unknown; verse?: unknown; verseEnd?: unknown } | null = null;
  try {
    stored = JSON.parse(raw);
  } catch {
    return true;
  }
  if (!stored || typeof stored.slug !== "string" || typeof stored.verse !== "number") return true;
  if (stored.slug !== document.body.dataset.slug) return true;

  const verse = stored.verse;
  const verseEnd = typeof stored.verseEnd === "number" ? stored.verseEnd : undefined;
  requestAnimationFrame(() => {
    const article = document.querySelector("article");
    if (!article) return;
    const content = article.querySelector(":scope > .markdown-preview-view") ?? article;
    const found = findVerseItems(content as HTMLElement);
    const items = found ? pickVerseItems(found, verse, verseEnd) : null;
    if (!items || items.length === 0) return; // 找不到經文清單或節數超出範圍：停在章首
    for (const old of Array.from(document.querySelectorAll(".search-verse-target"))) {
      old.classList.remove("search-verse-target", "fade-out");
    }
    for (const item of items) item.classList.add("search-verse-target");
    items[0]!.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => {
      for (const item of items) item.classList.add("fade-out");
      setTimeout(() => {
        for (const item of items) item.classList.remove("search-verse-target", "fade-out");
      }, 1000);
    }, 2000);
  });
  return true;
}

function handleNavOrRender() {
  runCleanups();
  // 先處理經文跳轉（不用等完整內文索引）；有 search-verse 時不再跑搜尋字捲動，避免兩個捲動打架
  const handledVerse = scrollToSearchVerse();
  setupSearch();
  if (!handledVerse) scrollToSearchTerm();
}

document.addEventListener("nav", handleNavOrRender);
document.addEventListener("render", handleNavOrRender);
