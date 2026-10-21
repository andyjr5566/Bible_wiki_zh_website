import { describe, it, expect } from "vitest";
import {
  BIBLE_BOOKS,
  chapterSlug,
  formatScriptureRef,
  parseScriptureRef,
  resolveScriptureTarget,
  type BibleBook,
  type ScriptureRef,
} from "../src/components/scriptureRef";

function bookAt(number: number): BibleBook {
  const book = BIBLE_BOOKS[number - 1];
  if (!book) throw new Error(`No Bible book numbered ${number}`);
  return book;
}

function expectParsed(
  input: string,
  number: number,
  chapter: number,
  verse?: number,
  verseEnd?: number,
): void {
  const expected: ScriptureRef = { book: bookAt(number), chapter };
  if (verse !== undefined) expected.verse = verse;
  if (verseEnd !== undefined) expected.verseEnd = verseEnd;
  expect(parseScriptureRef(input)).toEqual(expected);
}

describe("BIBLE_BOOKS", () => {
  it("contains all 66 books in order with correctly formatted folders", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);

    BIBLE_BOOKS.forEach((book, index) => {
      expect(book.number).toBe(index + 1);
      expect(book.zh.length).toBeGreaterThan(0);
      expect(book.zhAbbr.length).toBeGreaterThan(0);
      expect(book.en.length).toBeGreaterThan(0);
      expect(book.slugFolder).toBe(
        `${String(index + 1).padStart(2, "0")}-${book.zh}`,
      );
    });
  });

  it("parses every book's full name, Chinese abbreviation, and English name", () => {
    for (const book of BIBLE_BOOKS) {
      expectParsed(`${book.zh} 1`, book.number, 1);
      expectParsed(`${book.zhAbbr[0]!}1`, book.number, 1);
      expectParsed(`${book.en[0]!} 1`, book.number, 1);
    }
  });
});

describe("parseScriptureRef", () => {
  it("parses the requested Chinese and English forms", () => {
    const examples: Array<[string, number, number, number?, number?]> = [
      ["出12:3", 2, 12, 3],
      ["出 12:3", 2, 12, 3],
      ["出12：3", 2, 12, 3],
      ["出埃及記 12:3", 2, 12, 3],
      ["出埃及記12章3節", 2, 12, 3],
      ["出埃及記 第12章", 2, 12],
      ["出 12", 2, 12],
      ["出12", 2, 12],
      ["Exod 12:3", 2, 12, 3],
      ["Ex 12:3", 2, 12, 3],
      ["exodus 12:3", 2, 12, 3],
      ["Gen 1:27", 1, 1, 27],
      ["1 Sam 3:4", 9, 3, 4],
      ["1Sam 3", 9, 3],
      ["Ps 23", 19, 23],
      ["Song 2:1", 22, 2, 1],
      ["出１２：３", 2, 12, 3],
      ["创世记1:1", 1, 1, 1],
      ["出埃及记 12:3", 2, 12, 3],
      ["约翰福音3:16", 43, 3, 16],
      ["士師記 3", 7, 3],
      ["Jude 1:3", 65, 1, 3],
      ["Jud 1", 65, 1],
      ["Judg 3", 7, 3],
      ["約一1:9", 62, 1, 9],
      ["約1:1", 43, 1, 1],
      ["創 2:7", 1, 2, 7],
      ["民數記 3:5-7", 4, 3, 5, 7],
    ];

    for (const [input, number, chapter, verse, verseEnd] of examples) {
      expectParsed(input, number, chapter, verse, verseEnd);
    }
  });

  it("parses verse ranges and keeps only the opening point of a cross-chapter range", () => {
    expectParsed("出12:3-5", 2, 12, 3, 5);
    expectParsed("出12:3～5", 2, 12, 3, 5);
    expectParsed("出12:31-13:2", 2, 12, 31);
  });

  it("rejects general words, incomplete book names, and out-of-range numbers", () => {
    const invalidInputs = [
      "逾越節",
      "摩西",
      "挪亞",
      "亞伯拉罕",
      "但以理",
      "約瑟",
      "哈利路亞",
      "出埃及記",
      "士師記",
      "出0",
      "出151",
      "出12:0",
      "出12:201",
      "出12:5-3",
    ];

    for (const input of invalidInputs) {
      expect(parseScriptureRef(input)).toBeNull();
    }
  });

  it("requires a number after a one-character Chinese abbreviation", () => {
    for (const input of ["約", "亞", "歌", "哈", "但", "多", "門", "來", "雅", "書", "加", "西", "可", "路"]) {
      expect(parseScriptureRef(input)).toBeNull();
    }
  });
});

describe("chapterSlug, resolveScriptureTarget, and formatScriptureRef", () => {
  const ref: ScriptureRef = {
    book: bookAt(2),
    chapter: 12,
    verse: 3,
    verseEnd: 5,
  };

  it("builds chapter slugs and formatted references", () => {
    expect(chapterSlug(ref)).toBe("02-出埃及記/第12章");
    expect(formatScriptureRef(ref)).toBe("出埃及記 12:3–5");
    expect(formatScriptureRef({ book: bookAt(2), chapter: 12, verse: 3 })).toBe(
      "出埃及記 12:3",
    );
    expect(formatScriptureRef({ book: bookAt(2), chapter: 12 })).toBe("出埃及記 12");
  });

  it("resolves a chapter, a book-only outline, or a missing book", () => {
    const chapter = chapterSlug(ref);
    const bookOnly = `${ref.book.slugFolder}/全書目錄及綱要`;

    expect(resolveScriptureTarget(ref, (slug) => slug === chapter)).toEqual({
      kind: "chapter",
      slug: chapter,
      verse: 3,
      verseEnd: 5,
    });
    expect(resolveScriptureTarget(ref, (slug) => slug === bookOnly)).toEqual({
      kind: "book-only",
      slug: bookOnly,
      book: ref.book,
    });
    expect(resolveScriptureTarget(ref, () => false)).toEqual({
      kind: "missing",
      book: ref.book,
    });
  });
});
