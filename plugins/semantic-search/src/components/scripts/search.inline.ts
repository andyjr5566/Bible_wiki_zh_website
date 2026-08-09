import FlexSearch from "flexsearch";
import {
  removeAllChildren,
  normalizeRelativeURLs,
  registerEscapeHandler,
  resolveBasePath,
  escapeHTML,
} from "@quartz-community/utils";
import { findExactMatchSlugs, getBookNameFromSlug, shouldRunExactSearch } from "../searchLogic";

const GITHUB_PAGES_HOST = "andyjr5566.github.io";
const GITHUB_PAGES_BASE_PATH = "/Bible_wiki_zh_website";
const SEARCH_API_ORIGIN = "https://bible-wiki-zh-website.vercel.app";

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

let currentSearchTerm: string = "";
const contextWindowWords = 30;

const encoder = (str: string): string[] => {
  const tokens: string[] = [];
  let bufferStart = -1;
  let bufferEnd = -1;
  const lower = str.toLowerCase();
  let i = 0;

  for (const char of lower) {
    const code = char.codePointAt(0)!;

    const isCJK =
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x20000 && code <= 0x2a6df);

    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13;

    if (isCJK) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd));
        bufferStart = -1;
      }
      tokens.push(char);
    } else if (isWhitespace) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd));
        bufferStart = -1;
      }
    } else {
      if (bufferStart === -1) bufferStart = i;
      bufferEnd = i + 1;
    }
    i += char.length;
  }

  if (bufferStart !== -1) {
    tokens.push(lower.slice(bufferStart));
  }

  return tokens;
};

const index = new FlexSearch.Document({
  encode: encoder,
  document: {
    id: "id",
    tag: "tags",
    index: [
      { field: "title", tokenize: "forward" },
      { field: "content", tokenize: "forward" },
      { field: "tags", tokenize: "forward" },
    ],
  },
});

let contentData: Record<string, Item> | null = null;
let idDataMap: string[] = [];
const fetchContentCache = new Map<string, Element[]>();

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

async function setupSearch() {
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
      results.setAttribute("role", "listbox");
      results.setAttribute("aria-label", "Search results");
      searchLayout.appendChild(results);
    }

    let preview = searchLayout.querySelector(".preview-container") as HTMLDivElement | null;
    if (enablePreview && !preview) {
      preview = document.createElement("div");
      preview.className = "preview-container";
      searchLayout.appendChild(preview);
    }

    let currentHover: HTMLElement | null = null;
    let previewToken = 0;
    let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let latestSearchRequest = 0;

    const hideSearch = () => {
      container.classList.remove("active");
      if (sidebar) sidebar.style.zIndex = "";
      searchButton.setAttribute("aria-expanded", "false");
      searchBar.value = "";
      removeAllChildren(results!);
      if (preview) removeAllChildren(preview);
      searchLayout.classList.remove("display-results");
      latestSearchRequest++;
      currentHover = null;
      searchButton.focus();
    };

    const showSearch = () => {
      if (sidebar) sidebar.style.zIndex = "9999";
      container.classList.add("active");
      searchButton.setAttribute("aria-expanded", "true");
      searchBar.focus();
    };

    const displayResults = async (finalResults: any[]) => {
      removeAllChildren(results);

      if (finalResults.length === 0) {
        const noMatch = document.createElement("a");
        noMatch.className = "result-card no-match";
        const noMatchTitle = document.createElement("h3");
        noMatchTitle.textContent = "No results.";
        const noMatchHint = document.createElement("p");
        noMatchHint.textContent = "Try another search term?";
        noMatch.appendChild(noMatchTitle);
        noMatch.appendChild(noMatchHint);
        results.appendChild(noMatch);
        currentHover = null;
        if (preview) removeAllChildren(preview);
      } else {
        for (const item of finalResults) {
          const itemTile = document.createElement("a");
          itemTile.className = "result-card";
          itemTile.id = item.slug;
          itemTile.href = resolveSearchPath(item.slug);

          const titleEl = document.createElement("h3");
          titleEl.className = "card-title";
          // Add a badge depending on the match type
          if (item.type === "semantic") {
            const badge = document.createElement("span");
            badge.style.fontSize = "0.7em";
            badge.style.backgroundColor = "var(--secondary)";
            badge.style.color = "var(--light)";
            badge.style.padding = "2px 6px";
            badge.style.borderRadius = "4px";
            badge.style.marginRight = "6px";
            badge.style.verticalAlign = "middle";
            const scoreText = item.score !== undefined ? ` ${Math.round(item.score * 100)}%` : "";
            badge.textContent = `AI 語意${scoreText}`;
            titleEl.appendChild(badge);
          } else if (item.type === "keyword") {
            const badge = document.createElement("span");
            badge.style.fontSize = "0.7em";
            badge.style.backgroundColor = "var(--tertiary)";
            badge.style.color = "var(--light)";
            badge.style.padding = "2px 6px";
            badge.style.borderRadius = "4px";
            badge.style.marginRight = "6px";
            badge.style.verticalAlign = "middle";
            badge.textContent = `精準比對`;
            titleEl.appendChild(badge);
          }
          const titleText = document.createElement("span");
          const bookName = getBookNameFromSlug(item.slug);
          const plainTitle = item.title.replace(/<[^>]*>/g, "");
          const bookPrefix =
            bookName && !plainTitle.includes(bookName) ? `${escapeHTML(bookName)} ` : "";
          titleText.innerHTML = `${bookPrefix}${item.title.replace(/<(?!\/?span\b)[^>]*>/gi, "")}`;
          titleEl.appendChild(titleText);

          itemTile.appendChild(titleEl);

          if (item.tags.length > 0) {
            const tagList = document.createElement("ul");
            tagList.className = "tags";
            tagList.innerHTML = item.tags.join("");
            itemTile.appendChild(tagList);
          }

          const descEl = document.createElement("p");
          descEl.className = "card-description";
          descEl.innerHTML = item.content.replace(/<(?!\/?span\b)[^>]*>/gi, "");
          itemTile.appendChild(descEl);

          results.appendChild(itemTile);
        }
      }
    };

    const getResultElements = (): HTMLElement[] => {
      return Array.from(results.querySelectorAll<HTMLElement>(".result-card:not(.no-match)"));
    };

    const highlightTerm = () => {
      return currentSearchTerm.trim();
    };

    const updatePreview = async (el: HTMLElement | null) => {
      if (!preview) return;
      removeAllChildren(preview);
      if (!el) return;
      const slug = el.id;
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
      if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => updatePreview(currentHover), 150);
    };

    const focusByIndex = (index: number) => {
      const resultElements = getResultElements();
      if (resultElements.length === 0) {
        setFocus(null);
        return;
      }
      const clamped = Math.min(Math.max(index, 0), resultElements.length - 1);
      setFocus(resultElements[clamped] ?? null);
    };

    const focusNext = () => {
      const resultElements = getResultElements();
      if (resultElements.length === 0) return;
      const currentIndex = currentHover ? resultElements.indexOf(currentHover) : -1;
      focusByIndex(currentIndex + 1);
    };

    const focusPrevious = () => {
      const resultElements = getResultElements();
      if (resultElements.length === 0) return;
      const currentIndex = currentHover
        ? resultElements.indexOf(currentHover)
        : resultElements.length;
      focusByIndex(currentIndex - 1);
    };

    let searchDebounceTimer: ReturnType<typeof setTimeout>;

    const onType = async (e: Event) => {
      const inputValue = (e.target as HTMLInputElement).value;
      currentSearchTerm = inputValue;
      const requestId = ++latestSearchRequest;
      const parsed = parseSearchQuery(inputValue);
      const hasContent = parsed.query !== "";
      searchLayout.classList.toggle("display-results", hasContent);

      if (!hasContent) {
        removeAllChildren(results);
        if (preview) removeAllChildren(preview);
        currentHover = null;
        return;
      }

      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

      searchDebounceTimer = setTimeout(async () => {
        let finalResults: any[] = [];
        const displayTerm = parsed.query;

        if (parsed.query) {
          // Perform both semantic search and exact keyword search concurrently
          const semanticPromise = fetch(getSearchApiUrl(parsed.query))
            .then((res) => (res.ok ? res.json() : null))
            .catch((error) => {
              console.error("Semantic search error:", error);
              return null;
            });

          // Only perform keyword search if query length is >= 2
          let exactPromise: Promise<any> | null = null;
          if (shouldRunExactSearch(parsed.query)) {
            exactPromise = Promise.resolve(findExactMatchSlugs(contentData ?? {}, parsed.query));
          }

          const [semanticData, exactData] = await Promise.all([semanticPromise, exactPromise]);
          if (requestId !== latestSearchRequest) return;

          const resultMap = new Map<string, any>();

          // 1. Process Semantic Matches First (High Priority)
          if (semanticData && semanticData.results) {
            semanticData.results.forEach((r: any) => {
              resultMap.set(r.slug, {
                id: r.slug,
                slug: r.slug,
                score: r.score,
                title: highlight(displayTerm, r.title || r.slug),
                content: highlight(displayTerm, r.text || "", true),
                tags: [],
                type: "semantic",
              });
            });
          }

          // 2. Process Keyword Matches
          if (exactData) {
            exactData.forEach((slug: string) => {
              if (!slug) return;
              if (!resultMap.has(slug)) {
                // Found only by keyword
                const doc = contentData![slug];
                if (!doc) return;
                resultMap.set(slug, {
                  id: slug,
                  slug: slug,
                  title: highlight(displayTerm, doc.title || slug),
                  content: highlight(displayTerm, doc.content || "", true),
                  tags: doc.tags || [],
                  type: "keyword",
                });
              }
            });
          }

          // Convert Map to array (preserves insertion order: semantic/both first, then pure keywords)
          finalResults = Array.from(resultMap.values());
        }

        if (requestId !== latestSearchRequest) return;
        await displayResults(finalResults);
        const resultElements = getResultElements();
        setFocus(resultElements[0] ?? null);
      }, 500);
    };

    const onButtonClick = (e: Event) => {
      e.stopPropagation();
      showSearch();
    };
    searchButton.addEventListener("click", onButtonClick);
    addCleanup(() => searchButton.removeEventListener("click", onButtonClick));

    searchBar.addEventListener("input", onType);
    addCleanup(() => searchBar.removeEventListener("input", onType));

    const onSearchBarKeydown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
        e.preventDefault();
        focusPrevious();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "Tab") {
        e.preventDefault();
        focusNext();
        return;
      }
      if (e.key === "Enter" && !e.isComposing) {
        const focused = currentHover;
        if (focused instanceof HTMLAnchorElement) {
          e.preventDefault();
          storeSearchTerm();
          hideSearch();
          focused.click();
        }
      }
    };
    searchBar.addEventListener("keydown", onSearchBarKeydown);
    addCleanup(() => searchBar.removeEventListener("keydown", onSearchBarKeydown));

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

    const onResultsClick = (e: Event) => {
      const target = (e.target as HTMLElement).closest(".result-card") as HTMLAnchorElement | null;
      if (!target || target.classList.contains("no-match")) return;
      if (e instanceof MouseEvent && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) return;
      storeSearchTerm();
      hideSearch();
    };
    const onResultsMouseover = (e: Event) => {
      const target = (e.target as HTMLElement).closest(".result-card") as HTMLElement | null;
      if (!target || target.classList.contains("no-match")) return;
      setFocus(target);
    };
    results.addEventListener("click", onResultsClick);
    results.addEventListener("mouseover", onResultsMouseover);
    addCleanup(() => {
      results!.removeEventListener("click", onResultsClick);
      results!.removeEventListener("mouseover", onResultsMouseover);
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

async function fillDocument() {
  if (!contentData) return;
  let id = 0;
  const promises: Array<Promise<unknown>> = [];
  for (const slug of Object.keys(contentData)) {
    const fileData = contentData[slug];
    if (!fileData) continue;
    idDataMap[id] = slug;
    promises.push(
      index.addAsync(id, {
        id: id,
        slug: slug,
        title: fileData.title || "",
        content: fileData.content || "",
        tags: fileData.tags || [],
      }),
    );
    id++;
  }
  await Promise.all(promises);
}

async function fetchContentIndex(): Promise<Record<string, Item>> {
  const data = await fetchData;
  return data as unknown as Record<string, Item>;
}

let indexInitialized = false;

async function initIndex() {
  if (indexInitialized) return;
  contentData = await fetchContentIndex();
  await fillDocument();
  indexInitialized = true;
}

async function addContentIndexEntries(patch: Record<string, Item>): Promise<number> {
  if (!indexInitialized || !contentData) return 0;
  let added = 0;
  for (const slug of Object.keys(patch)) {
    if (contentData[slug]) continue;
    const fileData = patch[slug];
    if (!fileData) continue;
    const id = idDataMap.length;
    idDataMap[id] = slug;
    contentData[slug] = fileData;
    await index.addAsync(id, {
      id,
      slug,
      title: fileData.title || "",
      content: fileData.content || "",
      tags: fileData.tags || [],
    });
    added++;
  }
  return added;
}

document.addEventListener("content-index-updated", (event) => {
  const detail = (event as CustomEvent).detail as { slugs?: string[] } | undefined;
  if (!indexInitialized || !contentData) return;
  const slugs = detail?.slugs;
  if (!Array.isArray(slugs) || slugs.length === 0) return;

  (async () => {
    try {
      const base = (await fetchData) as unknown as Record<string, unknown>;
      if (!base || typeof base !== "object") return;
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
    } catch {
      // non-fatal: shadow index patch failed
    }
  })();
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

async function handleNavOrRender() {
  runCleanups();
  await initIndex();
  await setupSearch();
  scrollToSearchTerm();
}

document.addEventListener("nav", handleNavOrRender);
document.addEventListener("render", handleNavOrRender);
