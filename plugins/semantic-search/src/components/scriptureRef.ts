// 經文參照解析（B4-4）：認得「出12:3」「出埃及記 12:3」「出 12」「Exod 12:3」「Gen 1:27」等寫法，
// 對應到網站章節頁的 slug（NN-書名/第C章）。書名用和合本全名；66 卷的中英文縮寫與常見簡體書名都收在 BIBLE_BOOKS。
// 單字縮寫（約、亞、但…）只有後面緊接數字才算參照，所以「但以理」「約瑟」「亞伯拉罕」不會被誤判。
export interface BibleBook {
  readonly number: number;
  readonly zh: string;
  readonly zhSimplified: string;
  readonly zhAbbr: readonly string[];
  readonly en: readonly string[];
  readonly slugFolder: string;
}

export interface ScriptureRef {
  book: BibleBook;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

export type ScriptureTarget =
  | { kind: "chapter"; slug: string; verse?: number; verseEnd?: number }
  | { kind: "book-only"; slug: string; book: BibleBook }
  | { kind: "missing"; book: BibleBook };

export const BIBLE_BOOKS: readonly BibleBook[] = [
  {
    number: 1,
    zh: "創世記",
    zhSimplified: "创世记",
    zhAbbr: ["創"],
    en: ["Genesis", "Gen", "Gn"],
    slugFolder: "01-創世記",
  },
  {
    number: 2,
    zh: "出埃及記",
    zhSimplified: "出埃及记",
    zhAbbr: ["出"],
    en: ["Exodus", "Exod", "Ex"],
    slugFolder: "02-出埃及記",
  },
  {
    number: 3,
    zh: "利未記",
    zhSimplified: "利未记",
    zhAbbr: ["利"],
    en: ["Leviticus", "Lev"],
    slugFolder: "03-利未記",
  },
  {
    number: 4,
    zh: "民數記",
    zhSimplified: "民数记",
    zhAbbr: ["民"],
    en: ["Numbers", "Num", "Nm"],
    slugFolder: "04-民數記",
  },
  {
    number: 5,
    zh: "申命記",
    zhSimplified: "申命记",
    zhAbbr: ["申"],
    en: ["Deuteronomy", "Deut", "Dt"],
    slugFolder: "05-申命記",
  },
  {
    number: 6,
    zh: "約書亞記",
    zhSimplified: "约书亚记",
    zhAbbr: ["書", "书"],
    en: ["Joshua", "Josh", "Jos"],
    slugFolder: "06-約書亞記",
  },
  {
    number: 7,
    zh: "士師記",
    zhSimplified: "士师记",
    zhAbbr: ["士"],
    en: ["Judges", "Judg", "Jdg"],
    slugFolder: "07-士師記",
  },
  {
    number: 8,
    zh: "路得記",
    zhSimplified: "路得记",
    zhAbbr: ["得"],
    en: ["Ruth", "Ru"],
    slugFolder: "08-路得記",
  },
  {
    number: 9,
    zh: "撒母耳記上",
    zhSimplified: "撒母耳记上",
    zhAbbr: ["撒上"],
    en: ["1 Samuel", "1Sam", "1 Sam", "I Samuel", "1st Samuel"],
    slugFolder: "09-撒母耳記上",
  },
  {
    number: 10,
    zh: "撒母耳記下",
    zhSimplified: "撒母耳记下",
    zhAbbr: ["撒下"],
    en: ["2 Samuel", "2Sam", "2 Sam", "II Samuel", "2nd Samuel"],
    slugFolder: "10-撒母耳記下",
  },
  {
    number: 11,
    zh: "列王紀上",
    zhSimplified: "列王纪上",
    zhAbbr: ["王上"],
    en: ["1 Kings", "1Kgs", "1 Kgs", "I Kings", "1st Kings"],
    slugFolder: "11-列王紀上",
  },
  {
    number: 12,
    zh: "列王紀下",
    zhSimplified: "列王纪下",
    zhAbbr: ["王下"],
    en: ["2 Kings", "2Kgs", "2 Kgs", "II Kings", "2nd Kings"],
    slugFolder: "12-列王紀下",
  },
  {
    number: 13,
    zh: "歷代志上",
    zhSimplified: "历代志上",
    zhAbbr: ["代上"],
    en: ["1 Chronicles", "1Chr", "1 Chr", "I Chronicles", "1st Chronicles"],
    slugFolder: "13-歷代志上",
  },
  {
    number: 14,
    zh: "歷代志下",
    zhSimplified: "历代志下",
    zhAbbr: ["代下"],
    en: ["2 Chronicles", "2Chr", "2 Chr", "II Chronicles", "2nd Chronicles"],
    slugFolder: "14-歷代志下",
  },
  {
    number: 15,
    zh: "以斯拉記",
    zhSimplified: "以斯拉记",
    zhAbbr: ["拉"],
    en: ["Ezra", "Ezr"],
    slugFolder: "15-以斯拉記",
  },
  {
    number: 16,
    zh: "尼希米記",
    zhSimplified: "尼希米记",
    zhAbbr: ["尼"],
    en: ["Nehemiah", "Neh"],
    slugFolder: "16-尼希米記",
  },
  {
    number: 17,
    zh: "以斯帖記",
    zhSimplified: "以斯帖记",
    zhAbbr: ["斯"],
    en: ["Esther", "Est"],
    slugFolder: "17-以斯帖記",
  },
  {
    number: 18,
    zh: "約伯記",
    zhSimplified: "约伯记",
    zhAbbr: ["伯"],
    en: ["Job"],
    slugFolder: "18-約伯記",
  },
  {
    number: 19,
    zh: "詩篇",
    zhSimplified: "诗篇",
    zhAbbr: ["詩", "诗"],
    en: ["Psalms", "Psalm", "Ps", "Psa"],
    slugFolder: "19-詩篇",
  },
  {
    number: 20,
    zh: "箴言",
    zhSimplified: "箴言",
    zhAbbr: ["箴"],
    en: ["Proverbs", "Prov", "Pr"],
    slugFolder: "20-箴言",
  },
  {
    number: 21,
    zh: "傳道書",
    zhSimplified: "传道书",
    zhAbbr: ["傳", "传"],
    en: ["Ecclesiastes", "Eccles", "Eccl", "Ecc"],
    slugFolder: "21-傳道書",
  },
  {
    number: 22,
    zh: "雅歌",
    zhSimplified: "雅歌",
    zhAbbr: ["歌"],
    en: ["Song of Songs", "Song of Solomon", "Song", "SOS"],
    slugFolder: "22-雅歌",
  },
  {
    number: 23,
    zh: "以賽亞書",
    zhSimplified: "以赛亚书",
    zhAbbr: ["賽", "赛"],
    en: ["Isaiah", "Isa"],
    slugFolder: "23-以賽亞書",
  },
  {
    number: 24,
    zh: "耶利米書",
    zhSimplified: "耶利米书",
    zhAbbr: ["耶"],
    en: ["Jeremiah", "Jer"],
    slugFolder: "24-耶利米書",
  },
  {
    number: 25,
    zh: "耶利米哀歌",
    zhSimplified: "耶利米哀歌",
    zhAbbr: ["哀"],
    en: ["Lamentations", "Lam"],
    slugFolder: "25-耶利米哀歌",
  },
  {
    number: 26,
    zh: "以西結書",
    zhSimplified: "以西结书",
    zhAbbr: ["結", "结"],
    en: ["Ezekiel", "Ezek", "Eze"],
    slugFolder: "26-以西結書",
  },
  {
    number: 27,
    zh: "但以理書",
    zhSimplified: "但以理书",
    zhAbbr: ["但"],
    en: ["Daniel", "Dan"],
    slugFolder: "27-但以理書",
  },
  {
    number: 28,
    zh: "何西阿書",
    zhSimplified: "何西阿书",
    zhAbbr: ["何"],
    en: ["Hosea", "Hos"],
    slugFolder: "28-何西阿書",
  },
  {
    number: 29,
    zh: "約珥書",
    zhSimplified: "约珥书",
    zhAbbr: ["珥"],
    en: ["Joel", "Joe"],
    slugFolder: "29-約珥書",
  },
  {
    number: 30,
    zh: "阿摩司書",
    zhSimplified: "阿摩司书",
    zhAbbr: ["摩"],
    en: ["Amos"],
    slugFolder: "30-阿摩司書",
  },
  {
    number: 31,
    zh: "俄巴底亞書",
    zhSimplified: "俄巴底亚书",
    zhAbbr: ["俄"],
    en: ["Obadiah", "Obad", "Ob"],
    slugFolder: "31-俄巴底亞書",
  },
  {
    number: 32,
    zh: "約拿書",
    zhSimplified: "约拿书",
    zhAbbr: ["拿"],
    en: ["Jonah", "Jon"],
    slugFolder: "32-約拿書",
  },
  {
    number: 33,
    zh: "彌迦書",
    zhSimplified: "弥迦书",
    zhAbbr: ["彌", "弥"],
    en: ["Micah", "Mic"],
    slugFolder: "33-彌迦書",
  },
  {
    number: 34,
    zh: "那鴻書",
    zhSimplified: "那鸿书",
    zhAbbr: ["鴻", "鸿"],
    en: ["Nahum", "Nah"],
    slugFolder: "34-那鴻書",
  },
  {
    number: 35,
    zh: "哈巴谷書",
    zhSimplified: "哈巴谷书",
    zhAbbr: ["哈"],
    en: ["Habakkuk", "Hab"],
    slugFolder: "35-哈巴谷書",
  },
  {
    number: 36,
    zh: "西番雅書",
    zhSimplified: "西番雅书",
    zhAbbr: ["番"],
    en: ["Zephaniah", "Zeph"],
    slugFolder: "36-西番雅書",
  },
  {
    number: 37,
    zh: "哈該書",
    zhSimplified: "哈该书",
    zhAbbr: ["該", "该"],
    en: ["Haggai", "Hag"],
    slugFolder: "37-哈該書",
  },
  {
    number: 38,
    zh: "撒迦利亞書",
    zhSimplified: "撒迦利亚书",
    zhAbbr: ["亞", "亚"],
    en: ["Zechariah", "Zech"],
    slugFolder: "38-撒迦利亞書",
  },
  {
    number: 39,
    zh: "瑪拉基書",
    zhSimplified: "玛拉基书",
    zhAbbr: ["瑪", "玛"],
    en: ["Malachi", "Mal"],
    slugFolder: "39-瑪拉基書",
  },
  {
    number: 40,
    zh: "馬太福音",
    zhSimplified: "马太福音",
    zhAbbr: ["太"],
    en: ["Matthew", "Matt", "Mt"],
    slugFolder: "40-馬太福音",
  },
  {
    number: 41,
    zh: "馬可福音",
    zhSimplified: "马可福音",
    zhAbbr: ["可"],
    en: ["Mark", "Mk", "Mrk"],
    slugFolder: "41-馬可福音",
  },
  {
    number: 42,
    zh: "路加福音",
    zhSimplified: "路加福音",
    zhAbbr: ["路"],
    en: ["Luke", "Lk"],
    slugFolder: "42-路加福音",
  },
  {
    number: 43,
    zh: "約翰福音",
    zhSimplified: "约翰福音",
    zhAbbr: ["約", "约"],
    en: ["John", "Jn"],
    slugFolder: "43-約翰福音",
  },
  {
    number: 44,
    zh: "使徒行傳",
    zhSimplified: "使徒行传",
    zhAbbr: ["徒"],
    en: ["Acts", "Ac"],
    slugFolder: "44-使徒行傳",
  },
  {
    number: 45,
    zh: "羅馬書",
    zhSimplified: "罗马书",
    zhAbbr: ["羅", "罗"],
    en: ["Romans", "Rom"],
    slugFolder: "45-羅馬書",
  },
  {
    number: 46,
    zh: "哥林多前書",
    zhSimplified: "哥林多前书",
    zhAbbr: ["林前"],
    en: ["1 Corinthians", "1Cor", "1 Cor", "I Corinthians", "1st Corinthians"],
    slugFolder: "46-哥林多前書",
  },
  {
    number: 47,
    zh: "哥林多後書",
    zhSimplified: "哥林多后书",
    zhAbbr: ["林後", "林后"],
    en: ["2 Corinthians", "2Cor", "2 Cor", "II Corinthians", "2nd Corinthians"],
    slugFolder: "47-哥林多後書",
  },
  {
    number: 48,
    zh: "加拉太書",
    zhSimplified: "加拉太书",
    zhAbbr: ["加"],
    en: ["Galatians", "Gal"],
    slugFolder: "48-加拉太書",
  },
  {
    number: 49,
    zh: "以弗所書",
    zhSimplified: "以弗所书",
    zhAbbr: ["弗"],
    en: ["Ephesians", "Eph"],
    slugFolder: "49-以弗所書",
  },
  {
    number: 50,
    zh: "腓立比書",
    zhSimplified: "腓立比书",
    zhAbbr: ["腓"],
    en: ["Philippians", "Phil", "Php"],
    slugFolder: "50-腓立比書",
  },
  {
    number: 51,
    zh: "歌羅西書",
    zhSimplified: "歌罗西书",
    zhAbbr: ["西"],
    en: ["Colossians", "Col"],
    slugFolder: "51-歌羅西書",
  },
  {
    number: 52,
    zh: "帖撒羅尼迦前書",
    zhSimplified: "帖撒罗尼迦前书",
    zhAbbr: ["帖前"],
    en: ["1 Thessalonians", "1Thess", "1 Thess", "I Thessalonians", "1st Thessalonians"],
    slugFolder: "52-帖撒羅尼迦前書",
  },
  {
    number: 53,
    zh: "帖撒羅尼迦後書",
    zhSimplified: "帖撒罗尼迦后书",
    zhAbbr: ["帖後", "帖后"],
    en: ["2 Thessalonians", "2Thess", "2 Thess", "II Thessalonians", "2nd Thessalonians"],
    slugFolder: "53-帖撒羅尼迦後書",
  },
  {
    number: 54,
    zh: "提摩太前書",
    zhSimplified: "提摩太前书",
    zhAbbr: ["提前"],
    en: ["1 Timothy", "1Tim", "1 Tim", "I Timothy", "1st Timothy"],
    slugFolder: "54-提摩太前書",
  },
  {
    number: 55,
    zh: "提摩太後書",
    zhSimplified: "提摩太后书",
    zhAbbr: ["提後", "提后"],
    en: ["2 Timothy", "2Tim", "2 Tim", "II Timothy", "2nd Timothy"],
    slugFolder: "55-提摩太後書",
  },
  {
    number: 56,
    zh: "提多書",
    zhSimplified: "提多书",
    zhAbbr: ["多"],
    en: ["Titus", "Tit"],
    slugFolder: "56-提多書",
  },
  {
    number: 57,
    zh: "腓利門書",
    zhSimplified: "腓利门书",
    zhAbbr: ["門", "门"],
    en: ["Philemon", "Phlm", "Phm"],
    slugFolder: "57-腓利門書",
  },
  {
    number: 58,
    zh: "希伯來書",
    zhSimplified: "希伯来书",
    zhAbbr: ["來", "来"],
    en: ["Hebrews", "Heb"],
    slugFolder: "58-希伯來書",
  },
  {
    number: 59,
    zh: "雅各書",
    zhSimplified: "雅各书",
    zhAbbr: ["雅"],
    en: ["James", "Jas", "Jam"],
    slugFolder: "59-雅各書",
  },
  {
    number: 60,
    zh: "彼得前書",
    zhSimplified: "彼得前书",
    zhAbbr: ["彼前"],
    en: ["1 Peter", "1Pet", "1 Pet", "I Peter", "1st Peter"],
    slugFolder: "60-彼得前書",
  },
  {
    number: 61,
    zh: "彼得後書",
    zhSimplified: "彼得后书",
    zhAbbr: ["彼後", "彼后"],
    en: ["2 Peter", "2Pet", "2 Pet", "II Peter", "2nd Peter"],
    slugFolder: "61-彼得後書",
  },
  {
    number: 62,
    zh: "約翰一書",
    zhSimplified: "约翰一书",
    zhAbbr: ["約壹", "約一", "约壹", "约一"],
    en: ["1 John", "1Jn", "1 Jn", "I John", "1st John"],
    slugFolder: "62-約翰一書",
  },
  {
    number: 63,
    zh: "約翰二書",
    zhSimplified: "约翰二书",
    zhAbbr: ["約貳", "約二", "约貳", "约二"],
    en: ["2 John", "2Jn", "2 Jn", "II John", "2nd John"],
    slugFolder: "63-約翰二書",
  },
  {
    number: 64,
    zh: "約翰三書",
    zhSimplified: "约翰三书",
    zhAbbr: ["約參", "約三", "约參", "约三"],
    en: ["3 John", "3Jn", "3 Jn", "III John", "3rd John"],
    slugFolder: "64-約翰三書",
  },
  {
    number: 65,
    zh: "猶大書",
    zhSimplified: "犹大书",
    zhAbbr: ["猶", "犹"],
    en: ["Jude", "Jud"],
    slugFolder: "65-猶大書",
  },
  {
    number: 66,
    zh: "啟示錄",
    zhSimplified: "启示录",
    zhAbbr: ["啟", "启"],
    en: ["Revelation", "Rev", "Rv"],
    slugFolder: "66-啟示錄",
  },
] as const;

interface BookAlias {
  alias: string;
  book: BibleBook;
}

interface ParsedTail {
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

const BOOK_ALIASES: BookAlias[] = [];
for (const book of BIBLE_BOOKS) {
  const seen = new Set<string>();
  for (const alias of [book.zh, book.zhSimplified, ...book.zhAbbr, ...book.en]) {
    const normalizedAlias = alias.normalize("NFKC").toLowerCase();
    if (!seen.has(normalizedAlias)) {
      seen.add(normalizedAlias);
      BOOK_ALIASES.push({ alias: normalizedAlias, book });
    }
  }
}
BOOK_ALIASES.sort((a, b) => b.alias.length - a.alias.length);

function parseReferenceTail(tail: string): ParsedTail | null {
  const chapterMatch = tail.match(/^\s*第?\s*(\d+)([\s\S]*)$/);
  if (!chapterMatch) return null;

  const chapter = Number(chapterMatch[1]);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) return null;

  const suffix = (chapterMatch[2] ?? "").trim();
  if (suffix.length === 0) return { chapter };

  const chineseChapterMatch = suffix.match(
    /^章(?:\s*(\d+)(?:\s*[-–—~～至]\s*(\d+))?\s*(?:節|节)?)?$/,
  );
  if (chineseChapterMatch) {
    const verseText = chineseChapterMatch[1];
    if (verseText === undefined) return { chapter };

    const verse = Number(verseText);
    const verseEndText = chineseChapterMatch[2];
    const verseEnd = verseEndText === undefined ? undefined : Number(verseEndText);
    if (
      !Number.isInteger(verse) ||
      verse < 1 ||
      verse > 200 ||
      (verseEnd !== undefined &&
        (!Number.isInteger(verseEnd) || verseEnd < verse || verseEnd > 200))
    ) {
      return null;
    }

    return verseEnd === undefined ? { chapter, verse } : { chapter, verse, verseEnd };
  }

  const colonMatch = suffix.match(
    /^:\s*(\d+)(?:\s*[-–—~～至]\s*(\d+)(?:\s*:\s*(\d+))?)?\s*(?:節|节)?$/,
  );
  if (!colonMatch) return null;

  const verse = Number(colonMatch[1]);
  const rangePartText = colonMatch[2];
  const rangeChapterText = colonMatch[3];
  if (!Number.isInteger(verse) || verse < 1 || verse > 200) return null;

  if (rangeChapterText !== undefined) {
    const rangeChapter = Number(rangePartText);
    const rangeVerse = Number(rangeChapterText);
    if (
      !Number.isInteger(rangeChapter) ||
      rangeChapter < 1 ||
      rangeChapter > 150 ||
      !Number.isInteger(rangeVerse) ||
      rangeVerse < 1 ||
      rangeVerse > 200
    ) {
      return null;
    }

    if (rangeChapter === chapter) {
      if (rangeVerse < verse) return null;
      return { chapter, verse, verseEnd: rangeVerse };
    }

    return { chapter, verse };
  }

  if (rangePartText !== undefined) {
    const verseEnd = Number(rangePartText);
    if (!Number.isInteger(verseEnd) || verseEnd < verse || verseEnd > 200) return null;
    return { chapter, verse, verseEnd };
  }

  return { chapter, verse };
}

/** Parse a Chinese or English Bible reference, returning null for other text. */
export function parseScriptureRef(input: string): ScriptureRef | null {
  const normalizedInput = input.normalize("NFKC").trim().toLowerCase();
  if (normalizedInput.length === 0) return null;

  for (const { alias, book } of BOOK_ALIASES) {
    if (!normalizedInput.startsWith(alias)) continue;

    const parsedTail = parseReferenceTail(normalizedInput.slice(alias.length));
    if (parsedTail) {
      return {
        book,
        chapter: parsedTail.chapter,
        ...(parsedTail.verse === undefined ? {} : { verse: parsedTail.verse }),
        ...(parsedTail.verseEnd === undefined ? {} : { verseEnd: parsedTail.verseEnd }),
      };
    }
  }

  return null;
}

/** Return the Quartz slug for a chapter page. */
export function chapterSlug(ref: ScriptureRef): string {
  return `${ref.book.slugFolder}/第${ref.chapter}章`;
}

/** Resolve a reference to a chapter page, book outline, or missing book. */
export function resolveScriptureTarget(
  ref: ScriptureRef,
  hasSlug: (slug: string) => boolean,
): ScriptureTarget {
  const slug = chapterSlug(ref);
  if (hasSlug(slug)) {
    return {
      kind: "chapter",
      slug,
      ...(ref.verse === undefined ? {} : { verse: ref.verse }),
      ...(ref.verseEnd === undefined ? {} : { verseEnd: ref.verseEnd }),
    };
  }

  const bookOnlySlug = `${ref.book.slugFolder}/全書目錄及綱要`;
  if (hasSlug(bookOnlySlug)) {
    return { kind: "book-only", slug: bookOnlySlug, book: ref.book };
  }

  return { kind: "missing", book: ref.book };
}

/** Format a reference for display using the traditional Chinese book name. */
export function formatScriptureRef(ref: ScriptureRef): string {
  const chapter = `${ref.book.zh} ${ref.chapter}`;
  if (ref.verse === undefined) return chapter;

  const range =
    ref.verseEnd === undefined ? "" : `–${ref.verseEnd}`;
  return `${chapter}:${ref.verse}${range}`;
}
