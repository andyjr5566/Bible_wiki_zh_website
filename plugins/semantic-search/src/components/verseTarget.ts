import { formatScriptureRef, parseScriptureRef, resolveScriptureTarget } from "./scriptureRef";

// 搜尋框的「經文跳轉」卡片資料，以及章節頁「經文清單」的判斷規則（純函式，不碰 DOM）。
// 經文清單規則和 plugins/site-ux/src/lib/verses.ts、plugins/personal-notes/src/client/model/verseList.ts 一致
// （外掛各自獨立打包，不互相 import，所以這裡複製一份）。

export type ScriptureCard =
  | {
      kind: "chapter";
      slug: string;
      verse?: number;
      verseEnd?: number;
      title: string;
      subtitle: string;
    }
  | { kind: "book-only"; slug: string; title: string; subtitle: string }
  | { kind: "missing"; title: string; subtitle: string };

/** 查詢是經文參照時，回傳要顯示的跳轉卡片資料；不是經文參照回傳 null。 */
export function buildScriptureCard(
  query: string,
  hasSlug: (slug: string) => boolean,
): ScriptureCard | null {
  const ref = parseScriptureRef(query);
  if (!ref) return null;

  const target = resolveScriptureTarget(ref, hasSlug);
  if (target.kind === "chapter") {
    const verseText =
      ref.verse === undefined
        ? null
        : ref.verseEnd === undefined
          ? `${ref.verse}`
          : `${ref.verse}–${ref.verseEnd}`;
    return {
      kind: "chapter",
      slug: target.slug,
      ...(target.verse === undefined ? {} : { verse: target.verse }),
      ...(target.verseEnd === undefined ? {} : { verseEnd: target.verseEnd }),
      title: `跳到 ${formatScriptureRef(ref)}`,
      subtitle: verseText === null ? "閱讀這一章" : `第 ${verseText} 節會標示出來`,
    };
  }
  if (target.kind === "book-only") {
    return {
      kind: "book-only",
      slug: target.slug,
      title: `${ref.book.zh}第 ${ref.chapter} 章的研讀頁還在整理中`,
      subtitle: `先看${ref.book.zh}的目錄與綱要`,
    };
  }
  return {
    kind: "missing",
    title: `${ref.book.zh}的研讀頁還在整理中`,
    subtitle: "網站正在逐卷整理中，可以先搜尋相關的人物或主題",
  };
}

/** 最小的節點介面：DOM 元素和測試用的假節點都符合。 */
export interface VerseNode {
  tagName: string;
  children: ArrayLike<VerseNode>;
  getAttribute(name: string): string | null;
}

export interface VerseList<N extends VerseNode = VerseNode> {
  items: N[];
  /** 第一節的節數（ol 的 start，預設 1）。 */
  start: number;
}

const MAX_VERSE_ITEMS = 200;

/**
 * 在內文根節點的子節點裡由前往後看，遇到第一條 hr 就停；停之前的第一個 ol 就是經文清單。
 * li 少於 1 個或多於 200 個就不當作經文清單。
 */
export function findVerseItems<N extends VerseNode>(content: N): VerseList<N> | null {
  let list: N | null = null;
  for (const child of Array.from(content.children) as N[]) {
    const tag = child.tagName.toLowerCase();
    if (tag === "hr") return null;
    if (tag === "ol") {
      list = child;
      break;
    }
  }
  if (!list) return null;

  const items = (Array.from(list.children) as N[]).filter(
    (child) => child.tagName.toLowerCase() === "li",
  );
  if (items.length < 1 || items.length > MAX_VERSE_ITEMS) return null;

  const start = Number(list.getAttribute("start") ?? "1") || 1;
  return { items, start };
}

/**
 * 取第 verse 到 verseEnd 節的 li。verse 不在清單範圍內回傳 null（呼叫端只停在章首）；
 * verseEnd 超過最後一節就取到最後一節。
 */
export function pickVerseItems<N extends VerseNode>(
  found: VerseList<N>,
  verse: number,
  verseEnd?: number,
): N[] | null {
  const first = verse - found.start;
  if (!Number.isInteger(first) || first < 0 || first >= found.items.length) return null;
  const lastVerse = verseEnd !== undefined && verseEnd >= verse ? verseEnd : verse;
  const last = Math.min(lastVerse - found.start, found.items.length - 1);
  return found.items.slice(first, last + 1);
}
