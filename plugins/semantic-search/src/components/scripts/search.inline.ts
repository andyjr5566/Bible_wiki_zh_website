import { normalizeRelativeURLs, resolveBasePath } from "@quartz-community/utils";
import {
  containsExactSearchText,
  findKnowledgeMatchSlugs,
  getKnowledgeSearchCategories,
  getKnowledgeSearchCategory,
  getKnowledgeSearchCategoryLabel,
  shouldRunExactSearch,
  warmExactSearchIndex,
} from "../searchLogic";
import { createIndexLoader } from "../searchFlow";
import { parseScriptureRef } from "../scriptureRef";
import {
  ORIGINAL_STUDY_ATTRIBUTION,
  findOriginalLanguageStudyGroups,
  getVerseMatchRanges,
  normalizeVerseSearchTerm,
  parseVerseSearchHints,
  prepareVerseIndex,
  searchVersesWithRewrite,
  selectPinnedVerses,
  type OriginalStudyGroup,
  type PinnedVerse,
  type PreparedVerse,
  type VerseOriginalIndex,
  type VerseSearchHints,
} from "../verseSearch";
import { buildFeedbackFormUrl, parseFeedbackFormConfig } from "../feedbackForm";
import { findTextMatchRanges } from "../textMatcher";
import { firstHitRanges } from "../termFocus";
import {
  buildScriptureCard,
  findVerseItems,
  pickVerseItems,
  type ScriptureCard,
} from "../verseTarget";
import { buildSnippetHtml } from "../snippet";
import { createSemanticEngine } from "../semanticModel";
import { formatMegabytes, mergeSemanticResults } from "../semanticIndex";
import { getKnowledgeCountText, getSearchAnnouncement } from "../searchA11y";

const GITHUB_PAGES_HOST = "andyjr5566.github.io";
const GITHUB_PAGES_BASE_PATH = "/Bible_wiki_zh_website";
const RESULT_RENDER_LIMIT = 30;

function getSearchBasePath(): string {
  const configuredBasePath = document.body?.dataset?.basepath ?? "";
  if (configuredBasePath) return configuredBasePath;
  return window.location.hostname === GITHUB_PAGES_HOST ? GITHUB_PAGES_BASE_PATH : "";
}

function resolveSearchPath(slug: string): string {
  return resolveBasePath(slug, getSearchBasePath());
}

interface Item {
  title: string;
  content: string;
  tags: string[];
}

let contentData: Record<string, Item> | null = null;
const pendingContentIndexUpdates = new Set<string>();
const ensureIndex = createIndexLoader(fetchContentIndex, async (data) => {
  contentData = data;
  await applyPendingContentIndexUpdates();
  // 分批在閒置時預熱，不阻塞載入與輸入；搜尋時若還沒跑完會等它（見 performSearch）
  void warmExactSearchIndex(data);
});
const fetchContentCache = new Map<string, Element[]>();
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

type SearchMode = "verse" | "knowledge";

const verseDraft = { query: "", refinements: [] as string[], strictLiteral: false };
let knowledgeSelection: Set<string> | null = null;
/** 語意搜尋預設關，只在這個分頁的執行期間記住（SPA 換頁不丟），不寫進任何儲存空間。 */
let semanticOn = false;
/** manifest 讀不到時記下來，不要每次查詢都再試。 */
let semanticManifestMissing = false;
const SEMANTIC_LIMIT = 20;
const semanticEngine = createSemanticEngine({
  resolvePath: (path) => resolveSearchPath(path),
});
const shortlistKey = "search-verse-shortlist-v1";
const shortlist = new Map<string, string>();
try {
  const saved: unknown = JSON.parse(sessionStorage.getItem(shortlistKey) ?? "[]");
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      if (
        Array.isArray(entry) &&
        typeof entry[0] === "string" &&
        /#v[1-9]\d*$/.test(entry[0]) &&
        typeof entry[1] === "string"
      ) {
        shortlist.set(entry[0], entry[1]);
      }
    }
  }
} catch {
  // Storage can be unavailable. The open tab still has an in-memory shortlist.
}

function saveShortlist() {
  try {
    sessionStorage.setItem(shortlistKey, JSON.stringify(Array.from(shortlist)));
  } catch {
    // The shortlist can still be used when storage is unavailable or full.
  }
}

let verses: PreparedVerse[] | null = null;
const ensureVerseIndex = createIndexLoader(
  async () => {
    const response = await fetch(resolveSearchPath("static/verseIndex.json"));
    if (!response.ok) throw new Error("Unable to load verse index");
    return prepareVerseIndex(await response.json());
  },
  (data) => {
    verses = data;
  },
);

/** 原文索引只在需要時才讀；缺檔（精簡環境）或格式不對時當作沒有，不影響經文搜尋。 */
let originalIndex: VerseOriginalIndex | null = null;
const ensureOriginalIndex = createIndexLoader(
  async (): Promise<VerseOriginalIndex | null> => {
    try {
      const response = await fetch(resolveSearchPath("static/verseOriginalIndex.json"));
      if (!response.ok) return null;
      const data = (await response.json()) as Partial<VerseOriginalIndex> | null;
      return data && data.version === 1 && data.lexicon && data.chapters
        ? (data as VerseOriginalIndex)
        : null;
    } catch {
      return null;
    }
  },
  (data) => {
    originalIndex = data;
  },
);

/** 相關詞與單節釘選是加分資料：缺檔或格式不對就當作沒有，經文搜尋照常運作。 */
let verseHints: VerseSearchHints | null = null;
const ensureVerseHints = createIndexLoader(
  async (): Promise<VerseSearchHints | null> => {
    try {
      const response = await fetch(resolveSearchPath("static/verseSearchHints.json"));
      return response.ok ? parseVerseSearchHints(await response.json()) : null;
    } catch {
      return null;
    }
  },
  (data) => {
    verseHints = data;
  },
);

const verseReference = (verse: PreparedVerse) =>
  verse.book + " " + verse.chapter + ":" + verse.verse;

function paintMatches(parent: HTMLElement, text: string, terms: string[], strictLiteral = false) {
  let offset = 0;
  for (const { start, end } of getVerseMatchRanges(text, terms, strictLiteral)) {
    parent.append(text.slice(offset, start));
    const match = document.createElement("span");
    match.className = "highlight";
    match.textContent = text.slice(start, end);
    parent.append(match);
    offset = end;
  }
  parent.append(text.slice(offset));
}

function makeSearchButton(className: string, text: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  return button;
}

function setupSearch() {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(".search"));
  const preferredRoot = () => roots.find((root) => root.getClientRects().length > 0) ?? roots[0];
  for (const root of roots) {
    const container = root.querySelector<HTMLElement>(".search-container");
    const searchButton = root.querySelector<HTMLButtonElement>(".search-button");
    const searchBar = root.querySelector<HTMLInputElement>(".search-bar");
    const layout = root.querySelector<HTMLElement>(".search-layout");
    if (!container || !searchButton || !searchBar || !layout) continue;
    const results = root.querySelector<HTMLElement>(".results-container")!;
    const status = root.querySelector<HTMLElement>(".search-sr-only")!;
    const count = root.querySelector<HTMLElement>(".search-result-count")!;
    const controls = root.querySelector<HTMLElement>(".search-verse-controls")!;
    const knowledgeControls = root.querySelector<HTMLFieldSetElement>(
      ".search-knowledge-controls",
    )!;
    const categoryList = root.querySelector<HTMLElement>(".search-knowledge-categories")!;
    const semanticToggle = root.querySelector<HTMLElement>(".search-semantic-toggle")!;
    const semanticCheckbox = root.querySelector<HTMLInputElement>(".search-semantic-checkbox")!;
    const semanticStatus = root.querySelector<HTMLElement>(".search-semantic-status")!;
    const refineForm = root.querySelector<HTMLFormElement>(".search-refine-form")!;
    const refineInput = root.querySelector<HTMLInputElement>(".search-refine-input")!;
    const refineAdd = root.querySelector<HTMLButtonElement>(".search-refine-add")!;
    const refinements = root.querySelector<HTMLElement>(".search-refinements")!;
    const strictToggle = root.querySelector<HTMLInputElement>(".search-strict-literal")!;
    const suggestions = root.querySelector<HTMLElement>(".search-suggestions")!;
    const shortlistToggle = root.querySelector<HTMLButtonElement>(".search-shortlist-toggle")!;
    const advancedToggle = root.querySelector<HTMLButtonElement>(".search-advanced-toggle")!;
    const advancedPanel = root.querySelector<HTMLElement>(".search-verse-advanced")!;
    const advancedCount = root.querySelector<HTMLElement>(".search-advanced-count")!;
    const shortlistDetails = root.querySelector<HTMLDetailsElement>(".search-verse-list")!;
    const shortlistBody = root.querySelector<HTMLElement>(".search-verse-list-body")!;
    const shortlistCounts = Array.from(
      root.querySelectorAll<HTMLElement>(".search-verse-list-count"),
    );
    const copyButton = root.querySelector<HTMLButtonElement>(".search-verse-copy")!;
    const sidebar = container.closest<HTMLElement>(".sidebar");
    const modes = Array.from(root.querySelectorAll<HTMLButtonElement>(".search-mode"));
    const controller = new AbortController();
    const { signal } = controller;
    const preview = layout.dataset.preview === "true" ? document.createElement("div") : null;
    if (preview) {
      preview.className = "preview-container";
      layout.append(preview);
    }

    let mode: SearchMode = "verse";
    let opener: HTMLElement = searchButton;
    let searchComposing = false;
    let refineComposing = false;
    let request = 0;
    let previewRequest = 0;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    let categoryKeys: string[] = [];
    let verseHits: PreparedVerse[] = [];
    let knowledgeHits: string[] = [];
    let rendered = 0;
    let activeTerms: string[] = [];
    let verseSuggestions: string[] = [];
    let studyElement: HTMLElement | null = null;
    let pinElement: HTMLElement | null = null;
    let feedbackElement: HTMLElement | null = null;
    const feedbackConfig = parseFeedbackFormConfig(layout.dataset.feedbackForm);
    const studyVerses = new Map<string, PreparedVerse>();
    let activeTerm = "";
    let semanticSection: HTMLElement | null = null;
    /** 語意搜尋的狀態：off 未開、preparing 下載中、ready 可用、unavailable 暫時無法使用。 */
    let semanticState: "off" | "preparing" | "ready" | "unavailable" = "off";
    let semanticPercent = 0;
    let semanticMegabytes = 0;

    const announce = (message: string) => {
      status.textContent = message;
    };
    const links = () =>
      Array.from(results.querySelectorAll<HTMLAnchorElement>("a.result-card[href]")).filter(
        (link) => {
          const details = link.closest("details");
          return !details || details.open;
        },
      );

    const paintCategoryFilters = (categories: string[]) => {
      if (categories.join("\n") !== categoryKeys.join("\n")) {
        categoryKeys = categories;
        categoryList.replaceChildren(
          ...categories.map((category) => {
            const label = document.createElement("label");
            label.className = "search-check";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "search-knowledge-category";
            checkbox.dataset.category = category;
            label.append(checkbox, getKnowledgeSearchCategoryLabel(category));
            return label;
          }),
        );
      }
      for (const checkbox of Array.from(categoryList.querySelectorAll<HTMLInputElement>("input"))) {
        checkbox.checked = knowledgeSelection?.has(checkbox.dataset.category!) ?? true;
      }
    };

    const updateVerseToggles = () => {
      for (const toggle of Array.from(
        results.querySelectorAll<HTMLButtonElement>(".search-verse-add"),
      )) {
        const selected = shortlist.has(toggle.dataset.verseId!);
        toggle.setAttribute("aria-pressed", String(selected));
        toggle.textContent = selected ? "✓ 已暫存" : "+ 暫存";
      }
    };

    const paintShortlist = () => {
      for (const countEl of shortlistCounts) countEl.textContent = String(shortlist.size);
      copyButton.disabled = shortlist.size === 0;
      copyButton.textContent = "複製清單";
      if (shortlist.size === 0) {
        shortlistBody.textContent = "從經文結果加入要比較的經節。";
        return;
      }
      const list = document.createElement("ul");
      for (const [id, text] of shortlist) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        const anchor = id.lastIndexOf("#");
        link.dataset.slug = id.slice(0, anchor);
        link.dataset.verse = id.slice(anchor + 2);
        link.href = resolveSearchPath(link.dataset.slug) + id.slice(anchor);
        link.textContent = text;
        const remove = makeSearchButton("search-verse-remove", "移除");
        remove.dataset.verseId = id;
        remove.setAttribute("aria-label", "移除 " + text.split("\t")[0]);
        item.append(link, remove);
        list.append(item);
      }
      shortlistBody.replaceChildren(list);
    };

    const paintVerseControls = () => {
      const query = verseDraft.query.trim();
      const isReference = parseScriptureRef(query) !== null;
      refineInput.disabled = !query || isReference;
      refineAdd.disabled = refineInput.disabled;
      strictToggle.checked = verseDraft.strictLiteral;
      const activeFilters = verseDraft.refinements.length + (verseDraft.strictLiteral ? 1 : 0);
      advancedCount.textContent = String(activeFilters);
      advancedCount.hidden = activeFilters === 0;
      refinements.replaceChildren(
        ...verseDraft.refinements.map((word) => {
          const button = makeSearchButton("search-refinement", word + " ×");
          button.dataset.refine = word;
          button.setAttribute("aria-label", "移除條件 " + word);
          return button;
        }),
      );
      refinements.hidden = refinements.childElementCount === 0;
      if (verseSuggestions.length > 0) {
        const label = document.createElement("span");
        label.className = "search-suggestions-label";
        label.textContent = "相關詞：";
        suggestions.replaceChildren(
          label,
          ...verseSuggestions.map((word) => {
            const button = makeSearchButton("search-suggestion", "「" + word + "」");
            button.dataset.suggestion = word;
            button.setAttribute("aria-label", "改查「" + word + "」");
            return button;
          }),
        );
      } else {
        suggestions.replaceChildren();
      }
      suggestions.hidden = verseSuggestions.length === 0;
    };

    const makeVerseCard = (verse: PreparedVerse, rendering?: string, highlight?: string) => {
      const row = document.createElement("div");
      row.className = "search-verse-row";
      const card = document.createElement("a");
      card.className = "result-card search-verse-result";
      card.dataset.slug = verse.slug;
      card.dataset.verse = String(verse.verse);
      card.href = resolveSearchPath(verse.slug) + "#v" + verse.verse;
      const title = document.createElement("h3");
      title.textContent = verseReference(verse);
      if (rendering) {
        const badge = document.createElement("span");
        badge.className = "search-original-rendering";
        badge.textContent = "譯作「" + rendering + "」";
        title.append(" ", badge);
      }
      const text = document.createElement("p");
      text.className = "search-verse-text";
      paintMatches(
        text,
        verse.text,
        rendering ? [rendering] : highlight ? [highlight] : activeTerms,
        rendering || highlight ? false : verseDraft.strictLiteral,
      );
      card.append(title, text);

      const toggle = makeSearchButton("search-verse-add", "");
      toggle.dataset.verseId = verse.id;
      toggle.setAttribute("aria-label", "暫存 " + verseReference(verse));
      row.append(card, toggle);
      return row;
    };

    const makeKnowledgeCard = (slug: string, semantic = false) => {
      const item = contentData![slug]!;
      const card = document.createElement("a");
      card.className = "result-card";
      card.dataset.slug = slug;
      card.href = resolveSearchPath(slug);
      const title = document.createElement("h3");
      title.className = "card-title";
      const category = getKnowledgeSearchCategory(slug)!;
      card.dataset.category = category;
      const label = document.createElement("span");
      label.className = "result-category";
      label.dataset.category = category;
      label.textContent = getKnowledgeSearchCategoryLabel(category);
      const name = document.createElement("span");
      name.className = "result-title-text";
      paintMatches(name, item.title || slug, [activeTerm]);
      title.append(label, name);
      if (semantic) {
        const badge = document.createElement("span");
        badge.className = "result-match-badge result-match-semantic";
        badge.textContent = "意思相近";
        title.append(badge);
        card.classList.add("is-semantic");
      }
      card.append(title);
      const tags = item.tags?.filter((tag) => containsExactSearchText(tag, activeTerm)) ?? [];
      if (tags.length) {
        const list = document.createElement("ul");
        list.className = "tags";
        for (const tag of tags) {
          const item = document.createElement("li");
          const text = document.createElement("p");
          paintMatches(text, tag, [activeTerm]);
          item.append(text);
          list.append(item);
        }
        card.append(list);
      }
      const snippet = buildSnippetHtml(item.content || "", activeTerm, { title: item.title });
      if (snippet) {
        const text = document.createElement("p");
        text.className = "card-description";
        text.innerHTML = snippet;
        card.append(text);
      }
      return card;
    };

    /** 直接命中之後依序是：其他譯本釘選、原文研讀、問卷提示；新增的經文卡片要插在它們前面。 */
    const tailAnchor = () =>
      [pinElement, studyElement, feedbackElement].find((element) => element?.isConnected) ?? null;

    const appendNextPage = (focusNext = false) => {
      const previousCount = rendered;
      results.querySelector(".search-more-btn")?.remove();
      if (mode === "verse") {
        const page = verseHits.slice(rendered, rendered + RESULT_RENDER_LIMIT);
        const nodes = page.map((verse) => makeVerseCard(verse));
        const anchor = tailAnchor();
        if (anchor) anchor.before(...nodes);
        else results.append(...nodes);
        rendered += page.length;
        updateVerseToggles();
      } else {
        const page = knowledgeHits.slice(rendered, rendered + RESULT_RENDER_LIMIT);
        const nodes = page.map((slug) => makeKnowledgeCard(slug));
        // 語意區塊永遠在字面結果之後：再顯示更多字面結果時插在它前面
        if (semanticSection?.isConnected) semanticSection.before(...nodes);
        else results.append(...nodes);
        rendered += page.length;
      }
      const total = mode === "verse" ? verseHits.length : knowledgeHits.length;
      if (rendered < total) {
        const more = makeSearchButton(
          "search-more-btn",
          "再顯示 " + Math.min(RESULT_RENDER_LIMIT, total - rendered) + " 筆",
        );
        const anchor =
          mode === "verse" ? tailAnchor() : semanticSection?.isConnected ? semanticSection : null;
        if (anchor) anchor.before(more);
        else results.append(more);
      }
      if (focusNext) links()[previousCount]?.focus();
    };

    const showResultMessage = (message: string, className = "search-index-note") => {
      const note = document.createElement("p");
      note.className = className;
      note.textContent = message;
      results.append(note);
      announce(message);
    };

    const showCount = (total: number, unit: string, text?: string) => {
      count.hidden = false;
      if (mode === "verse" && unit === "節經文") {
        const titleSpan = document.createElement("span");
        titleSpan.className = "search-section-title";
        titleSpan.textContent = `① 直接符合「${verseDraft.query.trim()}」`;
        const metaSpan = document.createElement("span");
        metaSpan.className = "search-section-meta";
        metaSpan.textContent = `${total} ${unit}`;
        count.replaceChildren(titleSpan, metaSpan);
      } else {
        count.textContent = text ?? "找到 " + total + " " + unit;
      }
      announce(text ?? "找到 " + total + " " + unit);
    };

    const resetResults = () => {
      results.replaceChildren();
      results.scrollTop = 0;
      count.hidden = true;
      rendered = 0;
      studyElement = null;
      semanticSection = null;
      pinElement = null;
      feedbackElement = null;
      studyVerses.clear();
      status.textContent = "";
      previewRequest++;
      clearTimeout(previewTimer);
      if (preview) {
        delete preview.dataset.slug;
        preview.replaceChildren();
      }
    };

    const makeOriginalGroup = (group: OriginalStudyGroup) => {
      const details = document.createElement("details");
      details.className = "search-original-group";
      details.open = group.autoOpen;
      const summary = document.createElement("summary");
      const summaryMain = document.createElement("span");
      summaryMain.className = "search-original-summary-main";
      const lemma = document.createElement("span");
      lemma.className = "search-original-lemma";
      lemma.textContent = group.lemma;
      const translit = document.createElement("span");
      translit.className = "search-original-translit";
      translit.textContent = `(${group.translit})`;
      const renderingsPill = document.createElement("span");
      renderingsPill.className = "search-original-renderings";
      renderingsPill.textContent = `另譯作：${group.distinctRenderings.slice(0, 4).join("、")}`;
      const hitCount = document.createElement("span");
      hitCount.className = "search-original-count";
      hitCount.textContent = `・${group.hits.length} 節`;
      summaryMain.append(lemma, translit, renderingsPill, hitCount);
      summary.append(summaryMain);
      // 詞義說明暫不顯示：目前的資料是和合本譯法統計，夾雜斷詞雜訊，整理好再補。
      if (group.entryLink) {
        const link = document.createElement("a");
        link.className = "search-original-entry-link";
        link.dataset.slug = group.entryLink.slug;
        link.href = resolveSearchPath(group.entryLink.slug);
        link.textContent =
          (group.entryLink.isOriginalEntry ? "原文條目：" : "相關條目：") +
          group.entryLink.title +
          " →";
        summary.append(link);
      }
      details.append(summary);
      const body = document.createElement("div");
      body.className = "search-original-body";
      for (const { verse, rendering } of group.hits.slice(0, RESULT_RENDER_LIMIT)) {
        studyVerses.set(verse.id, verse);
        body.append(makeVerseCard(verse, rendering));
      }
      if (group.hits.length > RESULT_RENDER_LIMIT) {
        const more = document.createElement("p");
        more.className = "search-original-more";
        more.textContent = `僅列出前 ${RESULT_RENDER_LIMIT} 節，共 ${group.hits.length} 節`;
        body.append(more);
      }
      details.append(body);
      return details;
    };

    const placeBeforeFeedback = (node: HTMLElement) => {
      if (feedbackElement?.isConnected) feedbackElement.before(node);
      else results.append(node);
    };

    /** 其他譯本用字對不上時，人工釘選的經節；樣式沿用原文研讀區塊的標題列。 */
    const showPinnedVerses = (pinned: PinnedVerse[], query: string) => {
      if (pinned.length === 0) return;
      const section = document.createElement("section");
      section.className = "search-pinned";
      section.setAttribute("aria-label", "其他譯本用字");
      const header = document.createElement("div");
      header.className = "search-section-header is-study";
      const title = document.createElement("span");
      title.className = "search-section-title";
      title.textContent = "其他譯本作「" + query + "」";
      const meta = document.createElement("span");
      meta.className = "search-section-meta";
      meta.textContent = pinned.length + " 節經文";
      header.append(title, meta);
      section.append(header);
      for (const { verse, cuv } of pinned) {
        studyVerses.set(verse.id, verse);
        section.append(makeVerseCard(verse, undefined, cuv));
      }
      pinElement = section;
      placeBeforeFeedback(section);
      updateVerseToggles();
    };

    const showFeedbackHint = (query: string) => {
      if (!feedbackConfig) return;
      const hint = document.createElement("p");
      hint.className = "search-feedback-hint";
      const link = document.createElement("a");
      link.href = buildFeedbackFormUrl(feedbackConfig, query);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "填寫問卷";
      hint.append("找不到你要的經文嗎？歡迎", link, "告訴我們。");
      feedbackElement = hint;
      results.append(hint);
    };

    /** 非阻塞：原文索引缺檔時什麼都不顯示，經文結果不受影響。 */
    const showOriginalStudy = async (
      token: number,
      query: string,
      hits: PreparedVerse[],
      corpus: PreparedVerse[],
    ) => {
      const optionsOn = verseDraft.refinements.length > 0 || verseDraft.strictLiteral;
      if (optionsOn && query.length < 2) return;
      if (!originalIndex) {
        await ensureOriginalIndex();
        if (token !== request || mode !== "verse") return;
      }
      if (optionsOn) {
        if (!originalIndex) return;
        const note = document.createElement("p");
        note.className = "search-index-note search-original-skipped";
        note.textContent = "加上再查條件或嚴格字面比對時，不列出同一原文詞的其他譯法。";
        placeBeforeFeedback(note);
        return;
      }
      const groups = findOriginalLanguageStudyGroups(
        corpus,
        originalIndex,
        query,
        new Set(hits.map((hit) => hit.id)),
      );
      if (groups.length === 0) return;
      const section = document.createElement("section");
      section.className = "search-original-study";
      section.setAttribute("aria-label", "原文其他譯法");
      const header = document.createElement("div");
      header.className = "search-section-header is-study";
      const headerLeft = document.createElement("span");
      headerLeft.className = "search-section-header-left";
      const headerTitle = document.createElement("span");
      headerTitle.className = "search-section-title";
      headerTitle.textContent =
        hits.length > 0 ? "② 同一原文詞在本站的其他譯法" : "對應原文詞在本站譯法";
      const headerBadge = document.createElement("span");
      headerBadge.className = "search-section-badge";
      headerBadge.textContent = `延伸研讀・${groups.length} 個詞根`;
      headerLeft.append(headerTitle, headerBadge);
      const headerHint = document.createElement("span");
      headerHint.className = "search-section-meta";
      headerHint.textContent = "點擊可展開／收合";
      header.append(headerLeft, headerHint);
      section.append(header, ...groups.map((group) => makeOriginalGroup(group)));
      const credit = document.createElement("p");
      credit.className = "search-original-credit";
      credit.textContent = ORIGINAL_STUDY_ATTRIBUTION;
      section.append(credit);
      studyElement = section;
      if (pinElement?.isConnected) pinElement.after(section);
      else placeBeforeFeedback(section);
      if (hits.length === 0) {
        const message = "字面無直接相符經文，以下顯示同原文詞在本站已收錄的經文";
        count.hidden = false;
        count.textContent = message;
        announce(message);
      }
      updateVerseToggles();
    };

    const SEMANTIC_HINT = "找意思相近的內容，不必完全相同的字";
    const SEMANTIC_UNAVAILABLE = "語意搜尋暫時無法使用，目前只顯示完全相符的結果。";
    const semanticProgressText = () =>
      (semanticMegabytes > 0 && !semanticEngine.isReady()
        ? `第一次使用需要下載約 ${semanticMegabytes} MB，之後會留在這個瀏覽器裡。`
        : "") + `正在準備語意搜尋…${semanticPercent}%`;

    const paintSemanticStatus = () => {
      if (semanticState === "preparing") semanticStatus.textContent = semanticProgressText();
      else if (semanticState === "unavailable") semanticStatus.textContent = SEMANTIC_UNAVAILABLE;
      else semanticStatus.textContent = SEMANTIC_HINT;
      const pending = results.querySelector(".search-semantic-pending");
      if (pending && semanticState === "preparing") pending.textContent = semanticProgressText();
    };

    let semanticStart: Promise<boolean> | null = null;
    /** 第一次開啟才下載；同時被呼叫多次時共用同一個等待。失敗就關回去並說明。 */
    const startSemantic = (): Promise<boolean> => {
      if (semanticEngine.isReady()) {
        semanticState = "ready";
        paintSemanticStatus();
        return Promise.resolve(true);
      }
      if (!semanticStart) {
        semanticStart = (async () => {
          semanticState = "preparing";
          semanticPercent = 0;
          paintSemanticStatus();
          const manifest = await semanticEngine.loadManifest();
          if (manifest) {
            semanticMegabytes = formatMegabytes(manifest.assetBytes);
            paintSemanticStatus();
            announce(semanticProgressText());
          }
          const ok =
            manifest !== null &&
            (await semanticEngine.prepare((percent) => {
              semanticPercent = percent;
              paintSemanticStatus();
            }));
          semanticManifestMissing = !ok;
          if (ok) semanticState = semanticOn ? "ready" : "off";
          else {
            semanticState = "unavailable";
            semanticOn = false;
            semanticCheckbox.checked = false;
            announce(SEMANTIC_UNAVAILABLE);
          }
          semanticStart = null;
          paintSemanticStatus();
          return ok;
        })();
      }
      return semanticStart;
    };

    const setSemantic = (on: boolean) => {
      semanticOn = on;
      semanticCheckbox.checked = on;
      semanticToggle.classList.remove("is-suggested");
      if (on) {
        semanticManifestMissing = false;
        void startSemantic();
      } else {
        semanticState = "off";
        paintSemanticStatus();
      }
      refresh();
    };

    /** 切到知識庫分頁時，把畫面同步成目前的語意搜尋狀態。 */
    const syncSemanticControls = () => {
      semanticCheckbox.checked = semanticOn;
      semanticToggle.classList.remove("is-suggested");
      if (semanticOn && semanticState !== "preparing") semanticState = "ready";
      else if (!semanticOn && semanticState !== "unavailable") semanticState = "off";
      paintSemanticStatus();
      if (semanticOn && !semanticEngine.isReady()) void startSemantic();
    };

    /** 字面結果 0 筆而且沒開語意搜尋：高亮勾選並在結果區問一句。 */
    const showSemanticPrompt = () => {
      semanticToggle.classList.add("is-suggested");
      const prompt = document.createElement("div");
      prompt.className = "search-semantic-prompt";
      const text = document.createElement("p");
      text.textContent = "找不到完全相符的內容。要開啟語意搜尋，找意思相近的內容嗎？";
      const button = makeSearchButton("search-semantic-enable", "開啟語意搜尋");
      prompt.append(text, button);
      results.append(prompt);
      announce(text.textContent);
    };

    /** 語意區塊沒有出現（沒開成、失敗、沒結果）時，計數列退回一般的「找到 N 筆知識資料」。 */
    const restoreLiteralCount = () => {
      if (count.hidden) return;
      count.textContent = getKnowledgeCountText(knowledgeHits.length, false);
    };

    /** 字面結果之後接「意思相近的內容」。任何一步發現查詢已換掉就直接放棄。 */
    const showSemanticResults = async (token: number, query: string) => {
      const pending = document.createElement("p");
      pending.className = "search-pending-note search-semantic-pending";
      pending.textContent = semanticEngine.isReady()
        ? "正在找意思相近的內容…"
        : semanticProgressText();
      results.append(pending);
      const ready = await startSemantic();
      if (token !== request) return;
      if (!ready) {
        pending.remove();
        restoreLiteralCount();
        return;
      }
      pending.textContent = "正在找意思相近的內容…";
      let hits: Awaited<ReturnType<typeof semanticEngine.search>> = null;
      let failed = false;
      try {
        hits = await semanticEngine.search(query, () => token !== request);
      } catch {
        failed = true;
      }
      if (token !== request) return;
      pending.remove();
      if (failed) {
        restoreLiteralCount();
        showResultMessage(SEMANTIC_UNAVAILABLE);
        return;
      }
      if (hits === null || !contentData) return;
      const merged = mergeSemanticResults(
        hits.filter((hit) => contentData![hit.slug]),
        knowledgeHits,
        knowledgeSelection ?? new Set(categoryKeys),
        SEMANTIC_LIMIT,
      );
      const literal = getKnowledgeCountText(knowledgeHits.length, false);
      if (merged.length === 0) {
        restoreLiteralCount();
        const note = document.createElement("p");
        note.className = "search-index-note search-semantic-empty";
        note.textContent = "沒有找到意思相近的內容。";
        results.append(note);
        announce(
          knowledgeHits.length > 0 ? literal : (getSearchAnnouncement("none", 0) ?? literal),
        );
        return;
      }
      const section = document.createElement("section");
      section.className = "search-semantic-section";
      section.setAttribute("aria-label", "意思相近的內容");
      const heading = document.createElement("h2");
      heading.className = "search-semantic-divider";
      heading.textContent = "意思相近的內容";
      section.append(heading, ...merged.map((hit) => makeKnowledgeCard(hit.slug, true)));
      semanticSection = section;
      results.append(section);
      announce(literal + "；" + getSearchAnnouncement("semantic", merged.length));
    };

    const performSearch = async (token: number, query: string) => {
      if (mode === "verse") {
        if (parseScriptureRef(query)) {
          showResultMessage("經文參照載入中…");
          const known = await getKnownSlugs();
          if (token !== request) return;
          resetResults();
          if (!known) {
            showResultMessage("經文參照暫時無法載入，請重試。");
            return;
          }
          const card = buildScriptureCard(query, (slug) => known.has(slug));
          if (card) {
            results.append(makeScriptureCard(card));
            announce(card.title);
          }
          return;
        }
        if (!verses) {
          showResultMessage("經文索引載入中…");
          const loaded = await ensureVerseIndex();
          if (token !== request) return;
          resetResults();
          if (!loaded || !verses) {
            showResultMessage("經文索引暫時無法載入，請重試。");
            return;
          }
        }
        if (verseHints === null) {
          await ensureVerseHints();
          if (token !== request) return;
        }
        const execution = searchVersesWithRewrite(
          verses,
          [query, ...verseDraft.refinements],
          verseDraft.strictLiteral,
          verseHints?.related,
        );
        activeTerms = execution.effectiveTerms;
        verseHits = execution.hits;
        // 建議詞只依主查詢算出，加了再查條件或嚴格比對後就不再適用，不顯示。
        verseSuggestions = verseDraft.refinements.length > 0 ? [] : execution.suggestions;
        paintVerseControls();
        if (execution.autoRewrite) {
          const notice = document.createElement("p");
          notice.className = "search-rewrite-notice";
          notice.textContent = execution.autoRewrite.message;
          results.append(notice);
        }
        showCount(verseHits.length, "節經文");
        appendNextPage();
        showFeedbackHint(query);
        showPinnedVerses(
          selectPinnedVerses(
            verses,
            verseHints?.pins ?? [],
            query,
            new Set(execution.hits.map((hit) => hit.id)),
            {
              strictLiteral: verseDraft.strictLiteral,
              hasRefinements: verseDraft.refinements.length > 0,
            },
          ),
          query,
        );
        void showOriginalStudy(token, query, execution.hits, verses);
      } else {
        if ((knowledgeSelection?.size ?? 1) === 0) {
          showResultMessage("請至少勾選一個知識類型。");
          return;
        }
        if (!shouldRunExactSearch(query)) {
          showResultMessage("請輸入至少兩個字搜尋知識庫。");
          return;
        }
        if (!contentData) {
          showResultMessage("知識庫索引載入中…");
          const loaded = await ensureIndex();
          if (token !== request) return;
          resetResults();
          if (!loaded || !contentData) {
            showResultMessage("知識庫索引暫時無法載入，請重試。");
            return;
          }
        }
        // 預熱還在跑就等它跑完（已算好的項目會略過），不要在這裡同步算完全部而凍結畫面
        await warmExactSearchIndex(contentData);
        if (token !== request) return;
        paintCategoryFilters(getKnowledgeSearchCategories(Object.keys(contentData)));
        activeTerm = query;
        knowledgeHits = findKnowledgeMatchSlugs(
          contentData,
          query,
          knowledgeSelection ?? new Set(categoryKeys),
        );
        showCount(
          knowledgeHits.length,
          "筆知識資料",
          getKnowledgeCountText(knowledgeHits.length, semanticOn),
        );
        appendNextPage();
        if (semanticOn) await showSemanticResults(token, query);
        else if (knowledgeHits.length === 0 && !semanticManifestMissing) {
          // 沒有語意索引的環境不要提議，先確認 manifest 在（只讀一個小檔，不下載模型）
          const available = (await semanticEngine.loadManifest()) !== null;
          if (token !== request) return;
          semanticManifestMissing = !available;
          if (available) showSemanticPrompt();
        }
      }
    };

    const refresh = (debounce = false) => {
      const token = ++request;
      clearTimeout(searchTimer);
      resetResults();
      semanticToggle.classList.remove("is-suggested");
      verseSuggestions = [];
      if (mode === "verse") paintVerseControls();
      const query = verseDraft.query.trim();
      layout.classList.toggle("display-results", query.length > 0);
      if (!query) return;
      if (debounce) searchTimer = setTimeout(() => void performSearch(token, query), 60);
      else void performSearch(token, query);
    };

    const setMode = (next: SearchMode) => {
      mode = next;
      layout.dataset.mode = mode;
      const label = mode === "verse" ? "搜尋經文或輸入經文出處" : "搜尋知識庫關鍵字";
      searchBar.placeholder = label;
      searchBar.setAttribute("aria-label", label);
      controls.hidden = mode !== "verse";
      shortlistToggle.hidden = mode !== "verse";
      if (mode !== "verse") shortlistDetails.open = false;
      knowledgeControls.hidden = mode !== "knowledge";
      for (const button of modes)
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      if (mode === "verse") {
        paintVerseControls();
        paintShortlist();
      } else {
        paintCategoryFilters(getKnowledgeSearchCategories(Object.keys(contentData ?? {})));
        syncSemanticControls();
      }
      refresh();
    };

    const showSearch = (next: SearchMode = "verse", trigger: HTMLElement = searchButton) => {
      opener = trigger;
      if (sidebar) sidebar.style.zIndex = "9999";
      container.classList.add("active");
      searchButton.setAttribute("aria-expanded", "true");
      searchBar.value = verseDraft.query;
      setMode(next);
      searchBar.focus();
    };

    const hideSearch = (returnFocus = true) => {
      container.classList.remove("active");
      if (sidebar) sidebar.style.zIndex = "";
      searchButton.setAttribute("aria-expanded", "false");
      layout.classList.remove("display-results");
      searchComposing = false;
      refineComposing = false;
      request++;
      clearTimeout(searchTimer);
      resetResults();
      if (returnFocus) (opener.isConnected ? opener : searchButton).focus();
    };

    const changeQuery = () => {
      if (verseDraft.query.trim() !== searchBar.value.trim()) {
        verseDraft.refinements = [];
        refineInput.value = "";
      }
      verseDraft.query = searchBar.value;
      verseSuggestions = [];
      if (mode === "verse") paintVerseControls();
      refresh(true);
    };

    const showPreview = (card: HTMLAnchorElement) => {
      if (mode !== "knowledge" || !preview || !card.dataset.slug) return;
      const slug = card.dataset.slug;
      if (preview.dataset.slug === slug) return;
      preview.dataset.slug = slug;
      const token = ++previewRequest;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(async () => {
        const contents = await fetchContent(slug);
        if (token !== previewRequest) return;
        const inner = document.createElement("div");
        inner.className = "preview-inner";
        for (const element of contents) {
          const clone = element.cloneNode(true) as HTMLElement;
          clone.innerHTML = highlightHTML(activeTerm, clone);
          inner.append(clone);
        }
        preview.replaceChildren(inner);
        preview.querySelector<HTMLElement>(".highlight")?.scrollIntoView({ block: "nearest" });
      }, 150);
    };

    const handleNavigate = (link: HTMLAnchorElement) => {
      const slug = link.dataset.slug;
      const verse = Number(link.dataset.verse);
      try {
        if (slug && Number.isInteger(verse) && verse > 0) {
          sessionStorage.removeItem("search-term");
          sessionStorage.setItem(
            "search-verse",
            JSON.stringify({
              slug,
              verse,
              verseEnd: Number(link.dataset.verseEnd) || verse,
            }),
          );
          if (slug === document.body.dataset.slug) queueMicrotask(scrollToSearchVerse);
        } else if (slug && mode === "knowledge") {
          sessionStorage.setItem("search-term", activeTerm);
        }
      } catch {
        // The real chapter and verse links still work without session storage.
      }
      hideSearch(false);
    };

    const syncShortlistButton = () => {
      const open = shortlistDetails.open;
      shortlistToggle.setAttribute("aria-expanded", String(open));
      shortlistToggle.setAttribute("aria-pressed", String(open));
    };
    shortlistToggle.addEventListener(
      "click",
      () => {
        shortlistDetails.open = !shortlistDetails.open;
        syncShortlistButton();
      },
      { signal },
    );
    shortlistDetails.addEventListener("toggle", syncShortlistButton, { signal });

    advancedToggle.addEventListener(
      "click",
      () => {
        const open = advancedPanel.hidden;
        advancedPanel.hidden = !open;
        advancedToggle.setAttribute("aria-expanded", String(open));
        advancedToggle.setAttribute("aria-pressed", String(open));
        const caret = advancedToggle.querySelector(".search-caret");
        if (caret) caret.textContent = open ? "▲" : "▾";
      },
      { signal },
    );

    searchButton.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
        showSearch();
      },
      { signal },
    );
    root.querySelector(".search-close")?.addEventListener("click", () => hideSearch(), { signal });
    for (const button of modes) {
      button.addEventListener(
        "click",
        () => setMode(button.dataset.mode === "knowledge" ? "knowledge" : "verse"),
        { signal },
      );
    }
    searchBar.addEventListener(
      "compositionstart",
      () => {
        searchComposing = true;
      },
      { signal },
    );
    searchBar.addEventListener(
      "compositionend",
      () => {
        searchComposing = false;
        changeQuery();
      },
      { signal },
    );
    searchBar.addEventListener(
      "input",
      (event) => {
        if (!searchComposing && !(event as InputEvent).isComposing) changeQuery();
      },
      { signal },
    );
    searchBar.addEventListener(
      "keydown",
      (event) => {
        if (searchComposing || event.isComposing) return;
        const resultLinks = links();
        if (event.key === "ArrowDown" && resultLinks[0]) {
          event.preventDefault();
          resultLinks[0].focus();
        } else if (event.key === "ArrowUp" && resultLinks.at(-1)) {
          event.preventDefault();
          resultLinks.at(-1)?.focus();
        } else if (event.key === "Enter" && resultLinks[0]) {
          event.preventDefault();
          resultLinks[0].click();
        }
      },
      { signal },
    );

    refineInput.addEventListener(
      "compositionstart",
      () => {
        refineComposing = true;
      },
      { signal },
    );
    refineInput.addEventListener(
      "compositionend",
      () => {
        refineComposing = false;
      },
      { signal },
    );
    refineInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter" && (refineComposing || event.isComposing)) event.preventDefault();
      },
      { signal },
    );
    refineForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        if (refineComposing || refineInput.disabled) return;
        const keyword = refineInput.value.trim();
        const normalized = normalizeVerseSearchTerm(keyword);
        if (
          normalized &&
          ![verseDraft.query, ...verseDraft.refinements].some(
            (term) => normalizeVerseSearchTerm(term) === normalized,
          )
        ) {
          verseDraft.refinements.push(keyword);
          paintVerseControls();
          refresh();
        }
        refineInput.value = "";
        refineInput.focus();
      },
      { signal },
    );
    refinements.addEventListener(
      "click",
      (event) => {
        const word = (event.target as HTMLElement).closest<HTMLElement>(".search-refinement")
          ?.dataset.refine;
        if (!word) return;
        verseDraft.refinements = verseDraft.refinements.filter((refinement) => refinement !== word);
        paintVerseControls();
        refresh();
        refineInput.focus();
      },
      { signal },
    );
    suggestions.addEventListener(
      "click",
      (event) => {
        const word = (event.target as HTMLElement).closest<HTMLElement>(".search-suggestion")
          ?.dataset.suggestion;
        if (!word) return;
        searchBar.value = word;
        changeQuery();
        searchBar.focus();
      },
      { signal },
    );
    strictToggle.addEventListener(
      "change",
      () => {
        verseDraft.strictLiteral = strictToggle.checked;
        paintVerseControls();
        refresh();
      },
      { signal },
    );
    categoryList.addEventListener(
      "change",
      (event) => {
        const checkbox = event.target as HTMLInputElement;
        const category = checkbox.dataset.category;
        if (!category) return;
        knowledgeSelection ??= new Set(categoryKeys);
        if (checkbox.checked) knowledgeSelection.add(category);
        else knowledgeSelection.delete(category);
        refresh();
      },
      { signal },
    );
    semanticCheckbox.addEventListener("change", () => setSemantic(semanticCheckbox.checked), {
      signal,
    });
    root.querySelector(".search-knowledge-all")?.addEventListener(
      "click",
      () => {
        knowledgeSelection = null;
        paintCategoryFilters(categoryKeys);
        refresh();
      },
      { signal },
    );
    root.querySelector(".search-knowledge-clear")?.addEventListener(
      "click",
      () => {
        knowledgeSelection = new Set();
        paintCategoryFilters(categoryKeys);
        refresh();
      },
      { signal },
    );

    results.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".search-more-btn")) {
          appendNextPage(true);
          return;
        }
        if (target.closest(".search-semantic-enable")) {
          setSemantic(true);
          return;
        }
        const verseId = target.closest<HTMLButtonElement>(".search-verse-add")?.dataset.verseId;
        if (verseId) {
          const verse = verseHits.find((hit) => hit.id === verseId) ?? studyVerses.get(verseId);
          if (!verse) return;
          if (shortlist.has(verseId)) shortlist.delete(verseId);
          else shortlist.set(verseId, verseReference(verse) + "\t" + verse.text);
          saveShortlist();
          updateVerseToggles();
          paintShortlist();
          announce("暫存經文 " + shortlist.size + " 節");
          return;
        }
        const link = target.closest<HTMLAnchorElement>(
          "a.result-card[href], a.search-original-entry-link[href]",
        );
        if (link) {
          if (link.classList.contains("search-original-entry-link")) event.stopPropagation();
          if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)
            handleNavigate(link);
        }
      },
      { signal },
    );
    const previewEvent = (event: Event) => {
      const card = (event.target as HTMLElement).closest<HTMLAnchorElement>("a.result-card[href]");
      if (card) showPreview(card);
    };
    results.addEventListener("mouseover", previewEvent, { signal });
    results.addEventListener("focusin", previewEvent, { signal });
    results.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        const focused = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          "a.result-card[href]",
        );
        if (!focused) return;
        const resultLinks = links();
        const index = resultLinks.indexOf(focused);
        if (index < 0) return;
        event.preventDefault();
        if (event.key === "ArrowUp") (resultLinks[index - 1] ?? searchBar).focus();
        else
          (
            resultLinks[index + 1] ?? results.querySelector<HTMLButtonElement>(".search-more-btn")
          )?.focus();
      },
      { signal },
    );

    shortlistBody.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        const link = target.closest<HTMLAnchorElement>("a[href]");
        if (link && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)
          handleNavigate(link);
        const verseId = target.closest<HTMLElement>(".search-verse-remove")?.dataset.verseId;
        if (!verseId || !shortlist.delete(verseId)) return;
        saveShortlist();
        updateVerseToggles();
        paintShortlist();
        shortlistToggle.focus();
        announce("暫存經文 " + shortlist.size + " 節");
      },
      { signal },
    );
    copyButton.addEventListener(
      "click",
      async () => {
        const text = Array.from(shortlist.values()).join("\n");
        try {
          await navigator.clipboard.writeText(text);
          announce("已複製暫存經文");
          copyButton.textContent = "已複製";
        } catch {
          announce("無法存取剪貼簿，請從清單選取經文後複製。");
          copyButton.textContent = "無法複製，請手動選取";
        }
      },
      { signal },
    );

    container.addEventListener(
      "click",
      (event) => {
        if (event.target === container) hideSearch();
      },
      { signal },
    );
    container.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input:not([disabled]), summary",
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0] ?? searchBar;
        const last = focusable.at(-1) ?? searchBar;
        if (event.target === first && event.shiftKey) {
          event.preventDefault();
          last.focus();
        } else if (event.target === last && !event.shiftKey) {
          event.preventDefault();
          first.focus();
        }
      },
      { signal },
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.isComposing || searchComposing || refineComposing) return;
        const open = container.classList.contains("active");
        if (
          event.key.toLowerCase() === "k" &&
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey
        ) {
          if (!open && root !== preferredRoot()) return;
          event.preventDefault();
          if (open) hideSearch();
          else showSearch();
        } else if (open && event.key === "Escape") {
          event.preventDefault();
          hideSearch();
        }
      },
      { signal },
    );
    document.addEventListener(
      "search:open",
      (event) => {
        if (event.defaultPrevented || root !== preferredRoot()) return;
        const detail = (event as CustomEvent<{ mode?: SearchMode; opener?: HTMLElement }>).detail;
        showSearch(detail?.mode, detail?.opener);
      },
      { signal },
    );

    addCleanup(() => {
      controller.abort();
      hideSearch(false);
      preview?.remove();
    });
  }
}

function makeScriptureCard(card: ScriptureCard) {
  const element = document.createElement(card.kind === "missing" ? "div" : "a");
  element.className = "result-card scripture-jump";
  if (card.kind === "missing") element.classList.add("scripture-missing");
  else {
    element.dataset.slug = card.slug;
    let path = resolveSearchPath(card.slug);
    if (card.kind === "chapter" && card.verse !== undefined) {
      element.dataset.verse = String(card.verse);
      if (card.verseEnd !== undefined) element.dataset.verseEnd = String(card.verseEnd);
      path += "#v" + card.verse;
    }
    (element as HTMLAnchorElement).href = path;
  }
  const title = document.createElement("h3");
  title.textContent = card.title;
  const subtitle = document.createElement("p");
  subtitle.className = "card-description";
  subtitle.textContent = card.subtitle;
  element.append(title, subtitle);
  return element;
}

function highlightHTML(searchTerm: string, el: HTMLElement): string {
  if (searchTerm.trim() === "") return el.innerHTML;
  const html = parser.parseFromString(el.innerHTML, "text/html");
  const walker = html.createTreeWalker(html.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Text | null = walker.nextNode() as Text | null;
  while (node) {
    nodes.push(node);
    node = walker.nextNode() as Text | null;
  }
  for (const textNode of nodes) {
    const text = textNode.nodeValue ?? "";
    const ranges = findTextMatchRanges(text, [searchTerm], false);
    if (ranges.length === 0) continue;
    const fragment = html.createDocumentFragment();
    let lastIndex = 0;
    for (const { start, end } of ranges) {
      if (start > lastIndex) {
        fragment.appendChild(html.createTextNode(text.slice(lastIndex, start)));
      }
      const span = html.createElement("span");
      span.className = "highlight";
      span.textContent = text.slice(start, end);
      fragment.appendChild(span);
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(html.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
  return html.body.innerHTML;
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
      const ranges = findTextMatchRanges(text, [term], false);
      if (ranges.length === 0) continue;

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const textNodes: Array<{ node: Text; start: number; end: number }> = [];
      let charCount = 0;
      let current: Text | null;
      while ((current = walker.nextNode() as Text | null)) {
        const len = current.nodeValue?.length ?? 0;
        if (len > 0) textNodes.push({ node: current, start: charCount, end: charCount + len });
        charCount += len;
      }

      // 找出第一個命中區段（含跨譯註切開的相鄰片段）所涵蓋的文字節點切片，不破壞內部連結或標籤
      const activeRanges = firstHitRanges(text, ranges);
      const slices: Array<{ node: Text; localStart: number; localEnd: number }> = [];
      for (const r of activeRanges) {
        for (const tn of textNodes) {
          const overlapStart = Math.max(r.start, tn.start);
          const overlapEnd = Math.min(r.end, tn.end);
          if (overlapStart < overlapEnd) {
            slices.push({
              node: tn.node,
              localStart: overlapStart - tn.start,
              localEnd: overlapEnd - tn.start,
            });
          }
        }
      }

      if (slices.length === 0) continue;

      // 同一個文字節點可能有好幾段命中（例如被譯註隔開的「他（原文是我）必按時」），
      // 一個節點只能被取代一次，所以先依節點分組，再一次切成多個標示片段。
      const byNode = new Map<Text, Array<{ localStart: number; localEnd: number }>>();
      for (const { node, localStart, localEnd } of slices) {
        const list = byNode.get(node);
        if (list) list.push({ localStart, localEnd });
        else byNode.set(node, [{ localStart, localEnd }]);
      }

      const createdSpans: HTMLSpanElement[] = [];
      for (const [node, parts] of byNode) {
        const parent = node.parentNode;
        if (!parent) continue;
        const value = node.nodeValue ?? "";
        parts.sort((a, b) => a.localStart - b.localStart);

        const frag = document.createDocumentFragment();
        let cursor = 0;
        for (const { localStart, localEnd } of parts) {
          if (localStart < cursor) continue;
          if (localStart > cursor)
            frag.appendChild(document.createTextNode(value.slice(cursor, localStart)));
          const span = document.createElement("span");
          span.className = "search-scroll-target";
          span.textContent = value.slice(localStart, localEnd);
          frag.appendChild(span);
          createdSpans.push(span);
          cursor = localEnd;
        }
        if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
        parent.replaceChild(frag, node);
      }

      const anchorSpan = createdSpans[0];
      if (anchorSpan) {
        anchorSpan.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => {
          for (const span of createdSpans) span.classList.add("fade-out");
          setTimeout(() => {
            const parents = new Set<Node>();
            for (const span of createdSpans) {
              const parent = span.parentNode;
              if (!parent) continue;
              parents.add(parent);
              while (span.firstChild) parent.insertBefore(span.firstChild, span);
              parent.removeChild(span);
            }
            for (const parent of parents) parent.normalize();
          }, 1000);
        }, 2000);
      } else {
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
