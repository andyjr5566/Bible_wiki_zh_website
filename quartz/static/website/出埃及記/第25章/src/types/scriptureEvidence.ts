export interface ScriptureExcerpt {
  id: string;
  book: 'Exodus' | 'Leviticus' | 'Numbers' | 'Hebrews';
  chapter: number;
  ranges: Array<{ startVerse: number; endVerse: number }>;
  reference: string;
  text: string;
  sourcePath: string;
  sourceSha256: string;
}

export interface ScriptureExcerptsData {
  version: string;
  generatedAt: string;
  excerpts: ScriptureExcerpt[];
}
