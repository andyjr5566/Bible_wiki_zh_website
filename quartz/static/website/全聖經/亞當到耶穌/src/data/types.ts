export type LineName = 'common' | '馬太' | '路加' | string;

export interface Relation {
  id: string;
  ref?: string;
  qualifier?: string;
  idQualifier?: string;
  who_ref?: string;
  role?: string;
  type?: string;
  rel?: string;
  note?: string;
  source?: string;
  [key: string]: unknown;
}

export interface NameForm {
  as: string;
  ref?: string;
  [key: string]: unknown;
}

export interface PersonMark {
  witness?: string;
  label: string;
  [key: string]: unknown;
}

export interface MaybeSamePerson {
  id: string;
  refs: string[];
}

export interface NameMeaning {
  orig: string;
  translit: string;
  strong: string;
  nameEn: string;
  meaningEn: string;
  meaningZh: string;
  via?: string;
  ref: string;
  scripture: Array<{ ref: string; quote: string }>;
}

export interface Person {
  id: string;
  name: string;
  qualifier?: string;
  sex?: string | null;
  kind?: string;
  names?: NameForm[];
  parents?: Relation[];
  spouses?: Relation[];
  siblings?: Relation[];
  kin?: Relation[];
  descends?: Relation[];
  maybeSame?: MaybeSamePerson[];
  desc?: string | null;
  note?: string | null;
  entry?: string | null;
  entryGloss?: string;
  mother_name?: string | null;
  gen?: Record<string, number>;
  lines?: LineName[];
  marks?: PersonMark[];
  notes?: string[];
  imported?: unknown;
  anchor?: string | null;
  nameMeaning?: NameMeaning | null;
  [key: string]: unknown;
}

export interface SpineSegment {
  id: string;
  title: string;
  lines: Record<string, string[]>;
}

export interface Spine {
  segments: SpineSegment[];
  lines: Record<string, string[]>;
}

export interface WitnessEntry {
  id?: string;
  name?: string;
  as?: string;
  ref?: string;
  qualifier?: string;
  [key: string]: unknown;
}

export interface Witness {
  id: string;
  title: string;
  ref?: string;
  line?: string;
  direction?: string;
  marks?: Record<string, string>;
  entries?: WitnessEntry[];
  [key: string]: unknown;
}

export interface AgePerson {
  id: string;
  born: number;
  died: number;
  total?: number;
  refs?: string[];
  [key: string]: unknown;
}

export interface Ages {
  people: AgePerson[];
  events: Array<Record<string, unknown>>;
  notes: Array<string | Record<string, unknown>>;
}

export interface NoteScripture {
  ref: string;
  quote?: string;
  [key: string]: unknown;
}

export interface NoteView {
  source?: string;
  quote?: string;
  translation?: string;
  paraphrase?: string;
  url?: string;
  [key: string]: unknown;
}

export interface GenealogyNote {
  id: string;
  title: string;
  attach?: string[];
  scripture?: NoteScripture[];
  text?: string;
  views?: NoteView[];
  [key: string]: unknown;
}

export interface TourStop {
  id: string;
  title: string;
  focus: string[];
  sequence?: string[];
  refs: string | string[];
  text: string;
}

export interface Family {
  id: string;
  title: string;
  roots?: string[];
  members?: string[];
  count?: number;
  intro?: string;
  imported?: unknown;
  [key: string]: unknown;
}

export interface GenealogyData {
  persons: Person[];
  unattached?: string[];
  spine: Spine;
  witnesses: Witness[];
  ages: Ages;
  notes: GenealogyNote[];
  tour: TourStop[];
  families: Family[];
  ntFamilies: Family[];
  sources?: Array<Record<string, unknown>>;
}

export type VerseMap = Record<string, string>;
