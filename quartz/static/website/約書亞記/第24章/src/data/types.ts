export type SourceId = 'CT' | 'GT' | 'KC' | 'BH';
export type StageSpace = 'prologue-bar' | 'valley' | 'map' | 'stone-time';
export type OakEra = 0 | 1 | 2;

export interface VerseLine {
  v: number;
  text: string;
}

export interface VerseBlock {
  ref: string;
  book: string;
  abbr: string;
  chapter: number;
  lines: VerseLine[];
  kb: boolean;
}

export interface CommentaryItem {
  id: string;
  source: SourceId;
  work: string;
  url: string;
  verse: string;
  quote?: string;
  quoteZh?: string;
  paraphrase?: string;
  /** 驗證專用（畫面不顯示）：從 raw_data/*_joshua_24.txt 逐字複製至少 8 個字，不可取自章節主檔 */
  evidence: string;
  /** 驗證專用（畫面不顯示）：raw_data 原檔 1-based 行號，閘門驗證 evidence 出現在 line±2 行內 */
  line: number;
}

export interface StepWordItem {
  id: string;
  label: string;
  ref: string;
  verse: number;
  position: number;
  hebrew: string;
  translit: string;
  gloss: string;
  strong: string;
  morph: string;
  morphText: string;
  lexicon: string;
  headword: string;
  headwordTranslit: string;
  lexiconGloss: string;
  note: string;
}

export interface CuvSpanRef {
  text: string;
  occurrence?: number;
}

export interface OneCsVerbItem {
  index: number;
  verse: number;
  position: number;
  hebrew: string;
  translit: string;
  strong: string;
  morph: string;
  gloss: string;
  cuvSpans: CuvSpanRef[];
  placeId: string;
}

export interface GiveOccurrenceItem {
  index: number;
  verse: number;
  position: number;
  hebrew: string;
  translit: string;
  strong: string;
  morph: string;
  gloss: string;
  cuvSpans: CuvSpanRef[];
  passive?: boolean;
}

export interface ServeKnotItem {
  index: number;
  verse: number;
  position: number;
  hebrew: string;
  translit: string;
  strong: string;
  baseStrong: 'H5647' | 'H5650';
  gloss: string;
  kind: 'yhwh' | 'other-gods' | 'bondage' | 'servant';
  affirmationOrder?: 1 | 2 | 3;
  cuvWord: string;
  cuvOccurrence: number;
}

export interface FamilyLine {
  speaker: 'grandfather' | 'father' | 'daughter';
  kind: 'question' | 'cuv-quote';
  text: string;
  ref?: string;
}

export interface DaughterQA {
  question: string;
  answerer: 'grandfather' | 'father';
  verses: string[];
  notes: CommentaryItem[];
  entryLinks?: string[];
}

export interface GiftFlipCard {
  id: 'land' | 'cities' | 'vineyards' | 'oliveyards';
  frontTitle: string;
  jos24Quote: string;
  deut6Quote: string;
  deut6Ref: string;
}

export interface BalakStage {
  step: 1 | 2 | 3;
  speaker: string;
  ref: string;
  quote: string;
}

export interface ExternalLinkItem {
  kind: 'wilderness' | 'genealogy';
  label: string;
  targetId?: string;
}

export interface StoryBeat {
  id: string;
  cue: string;
  space: StageSpace;
  verse?: string;
  focusSubstrings?: string[];
  bgVerses?: string[];
  moreVerses?: string[];
  compareRefs?: { left: string; right: string; extraRight: string };
  summary: string;
  /** 一句具名短註（≤ 40 字、出處開頭）：該拍捲動後段，經文框淡出換成這句 */
  note?: string;
  familyLines?: FamilyLine[];
  daughterQA?: DaughterQA;
  commentaryPreview?: string;
  commentaries?: CommentaryItem[];
  wordPreview?: string;
  words?: StepWordItem[];
  entryLinks?: string[];
  placeLinks?: string[];
  personLinks?: { label: string; targetId: string }[];
  externalLinks?: ExternalLinkItem[];
  interaction?:
    | 'only-i'
    | 'balak-scroll'
    | 'gift-cards'
    | 'cannot-pause'
    | 'put-away-past'
    | 'raise-stone'
    | 'epilogue-diff';
  balakStages?: BalakStage[];
  giftCards?: GiftFlipCard[];
  soundCue: string;
}

export interface StorySegment {
  id: string;
  label: string;
  title: string;
  rangeLabel: string;
  treatyNote?: string;
  beats: StoryBeat[];
}

export interface EntryMeta {
  key: string;
  type: string;
  title: string;
  summary: string;
}

export interface PlaceCandidate {
  name: string;
  lon: number;
  lat: number;
  kind: string;
  score: number;
}

export interface PlaceInfo {
  id: string;
  nameZh: string;
  lon: number;
  lat: number;
  level: 'high' | 'mid' | 'low' | 'none';
  uncertain: boolean;
  unlocated?: boolean;
  rKm?: number;
  modernLabel: string;
  summary: string;
  controversy?: string;
  verses: string[];
  entryKey?: string;
  openBibleFriendly?: string;
  openBibleSlug?: string;
  candidates?: PlaceCandidate[];
}

export interface ReadingQuestionCard {
  id: string;
  number: number;
  question: string;
  verses: string[];
  views: CommentaryItem[];
  entryLinks?: string[];
}

export interface OakMomentItem {
  era: OakEra;
  title: string;
  ref: string;
  summary: string;
  note?: CommentaryItem;
}

export interface ShechemEventItem {
  id: string;
  ref: string;
  era: 'before' | 'jos24' | 'later';
  title: string;
  summary?: string;
  verbatimOnly?: boolean;
  linkedBy?: CommentaryItem[];
  storyCue?: string;
}

export interface StoneItem {
  id: string;
  order: number;
  chapter: number;
  placeName: string;
  placeId: string;
  ref: string;
  what: string;
  markerKind: 'until-today' | 'children-ask' | 'witness-stone' | 'law-stone';
  markerRef?: string;
  markerQuote?: string;
  storyCue?: string;
}

export interface OtherStoneItem {
  id: string;
  title: string;
  ref: string;
  meaning: string;
  note: CommentaryItem;
}

export interface BurialItem {
  id: string;
  person: string;
  genealogyId: string;
  ref: string;
  placeName: string;
  placeId: string;
  ageNote?: string;
  detail: string;
  notes: CommentaryItem[];
  entryKey?: string;
  storyCue: string;
}

export interface LestForgetStop {
  id: string;
  order: number;
  stageLabel: string;
  refs: string[];
  notes: CommentaryItem[];
  storyCue?: string;
}

export interface BeadQuestionItem {
  number: number;
  text: string;
  line: number;
  evidence: string;
}

export interface BasemapLayer {
  bbox: { w: number; e: number; s: number; n: number };
  land: [number, number][][][];
  lakes: { name: string; rings: [number, number][][] }[];
  rivers: { name: string; pts: [number, number][] }[];
}

export interface GeoData {
  wide: BasemapLayer;
  canaan: BasemapLayer;
  wildernessRoute: [number, number][];
  places: Record<string, PlaceInfo>;
}

export interface StepStats {
  oneCsVerbCount: number;
  oneCsByVerse: Record<string, number>;
  giveCount: number;
  serveVerbCount: number;
  servantNounCount: number;
  serveByVerse: Record<string, number>;
  oneCsVerbs: OneCsVerbItem[];
  gives: GiveOccurrenceItem[];
  serveKnots: ServeKnotItem[];
}

export interface SiteData {
  meta: {
    title: string;
    subtitle: string;
    sources: Record<SourceId, { label: string; url: string }>;
    stepSource: { label: string; url: string; license: string };
  };
  verses: Record<string, string>;
  verseBlocks: Record<string, VerseBlock>;
  entries: Record<string, EntryMeta>;
  places: Record<string, PlaceInfo>;
  geo: GeoData;
  step: StepStats;
  segments: StorySegment[];
  onlyIBasis: CommentaryItem[];
  shapeTreatyNotes: CommentaryItem[];
  oakMoments: OakMomentItem[];
  oakSameTreeNote: CommentaryItem;
  shechemEvents: ShechemEventItem[];
  shechemArchaeology: {
    title: string;
    points: string[];
    sourceNote: CommentaryItem;
  };
  sevenStones: StoneItem[];
  sevenStonesNotes: CommentaryItem[];
  otherStones: OtherStoneItem[];
  burialsIntro: CommentaryItem;
  threeBurials: BurialItem[];
  section05Title: string;
  lestForget: LestForgetStop[];
  readingCards: ReadingQuestionCard[];
  beadQuestions: {
    work: string;
    url: string;
    attributionLine: number;
    attributionEvidence: string;
    items: BeadQuestionItem[];
  };
}
