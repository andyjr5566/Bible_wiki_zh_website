import { describe, it, expect } from "vitest";
import {
  buildScriptureCard,
  findVerseItems,
  pickVerseItems,
  type VerseNode,
} from "../src/components/verseTarget";

function node(tagName: string, children: VerseNode[] = [], attrs: Record<string, string> = {}) {
  return { tagName, children, getAttribute: (name: string) => attrs[name] ?? null } as VerseNode;
}
function ol(count: number, attrs: Record<string, string> = {}) {
  return node(
    "OL",
    Array.from({ length: count }, () => node("LI")),
    attrs,
  );
}

const known = new Set(["02-出埃及記/第12章", "01-創世記/全書目錄及綱要"]);
const hasSlug = (slug: string) => known.has(slug);

describe("buildScriptureCard", () => {
  it("builds a chapter card with a verse", () => {
    expect(buildScriptureCard("出12:3", hasSlug)).toEqual({
      kind: "chapter",
      slug: "02-出埃及記/第12章",
      verse: 3,
      title: "跳到 出埃及記 12:3",
      subtitle: "第 3 節會標示出來",
    });
  });

  it("builds a chapter card without a verse", () => {
    const card = buildScriptureCard("Exod 12", hasSlug);
    expect(card).toMatchObject({
      kind: "chapter",
      title: "跳到 出埃及記 12",
      subtitle: "閱讀這一章",
    });
  });

  it("keeps the verse range", () => {
    expect(buildScriptureCard("出12:3-5", hasSlug)).toMatchObject({
      kind: "chapter",
      verse: 3,
      verseEnd: 5,
      subtitle: "第 3–5 節會標示出來",
    });
  });

  it("falls back to the book outline, then to a missing card", () => {
    expect(buildScriptureCard("創 99:1", hasSlug)).toEqual({
      kind: "book-only",
      slug: "01-創世記/全書目錄及綱要",
      title: "創世記第 99 章的研讀頁還在整理中",
      subtitle: "先看創世記的目錄與綱要",
    });
    expect(buildScriptureCard("士師記 3", hasSlug)).toEqual({
      kind: "missing",
      title: "士師記的研讀頁還在整理中",
      subtitle: "網站正在逐卷整理中，可以先搜尋相關的人物或主題",
    });
  });

  it("returns null for ordinary queries", () => {
    expect(buildScriptureCard("逾越節", hasSlug)).toBeNull();
    expect(buildScriptureCard("但以理", hasSlug)).toBeNull();
  });
});

describe("findVerseItems / pickVerseItems", () => {
  it("uses the first ol before the first hr", () => {
    const list = ol(5);
    const content = node("DIV", [node("P"), list, node("HR"), ol(2)]);
    const found = findVerseItems(content);
    expect(found?.items).toHaveLength(5);
    expect(found?.start).toBe(1);
  });

  it("returns null when an hr comes first, when there is no ol, or the ol is too big/empty", () => {
    expect(findVerseItems(node("DIV", [node("HR"), ol(3)]))).toBeNull();
    expect(findVerseItems(node("DIV", [node("P")]))).toBeNull();
    expect(findVerseItems(node("DIV", [ol(201)]))).toBeNull();
    expect(findVerseItems(node("DIV", [ol(0)]))).toBeNull();
  });

  it("counts the nth li as the nth verse and honours ol start", () => {
    const found = findVerseItems(node("DIV", [ol(10)]))!;
    expect(pickVerseItems(found, 3)).toEqual([found.items[2]]);
    expect(pickVerseItems(found, 5, 7)).toEqual(found.items.slice(4, 7));

    const started = findVerseItems(node("DIV", [ol(5, { start: "4" })]))!;
    expect(started.start).toBe(4);
    expect(pickVerseItems(started, 4)).toEqual([started.items[0]]);
    expect(pickVerseItems(started, 3)).toBeNull();
  });

  it("returns null for verses past the end and clamps the end of a range", () => {
    const found = findVerseItems(node("DIV", [ol(5)]))!;
    expect(pickVerseItems(found, 6)).toBeNull();
    expect(pickVerseItems(found, 0)).toBeNull();
    expect(pickVerseItems(found, 4, 99)).toEqual(found.items.slice(3, 5));
  });
});
