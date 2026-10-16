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
  /** reading：介紹帶你讀經；catalog：打開目錄分頁。這兩種站不對準家譜樹上的人（沒有 focus、refs） */
  kind?: 'reading' | 'catalog';
  focus?: string[];
  sequence?: string[];
  refs?: string | string[];
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

/** 大圖上的名單牌子（list）、同時代區域（region）、區域裡各家的牌子（family）。 */
export interface PlacementNode {
  id: string;
  kind: 'list' | 'region' | 'family';
  title: string;
  ref: string;
  under: string;
  basis: string;
  family?: string;
}

/** 主線往下接不到的一家，掛在哪裡；via 是畫在圖上的那條經文關係。 */
export interface PlacementItem {
  root: string;
  under: string;
  via: { from: string; to: string; kind: 'parent' | 'mother' | 'spouse' | 'sibling' | 'kin' | 'descends' } | null;
  side: 'same' | 'opposite';
}

export interface Placements {
  nodes: PlacementNode[];
  items: PlacementItem[];
}

export interface GenealogyData {
  persons: Person[];
  placements?: Placements;
  spine: Spine;
  witnesses: Witness[];
  ages: Ages;
  notes: GenealogyNote[];
  tour: TourStop[];
  families: Family[];
  ntFamilies: Family[];
  sources?: Array<Record<string, unknown>>;
  /** 家譜樹上的職位印（大衛立的職位） */
  roleSeals?: RoleSeal[];
}

export type VerseMap = Record<string, string>;

/**
 * 讀經模式的逐節標記。s/e 是經文裡的字元位置（左閉右開）。
 * k：p 人名（id 是人物；沒有 id 表示經文沒交代是哪一位，只在經文裡亮）、t 職稱（of 是屬於誰）、
 *    r 親屬詞、l 地名、n 數字。from：讀到這個人名時，從哪些人畫墨線過來（經文記載的父母或祖先）。
 */
export interface ReadingToken {
  s: number;
  e: number;
  k: 'p' | 't' | 'r' | 'l' | 'n';
  /** 家譜樹上的人物 */
  id?: string;
  /** 只在職位圖上的人（RolesData.people 的 rid）。和 id 不會同時出現 */
  rid?: string;
  /** 職稱屬於誰（家譜樹人物 id，或職位圖的 rid） */
  of?: string;
  from?: string[];
  /** 倒著數的家譜：讀到這位父親時，畫到前面已經讀過的兒子 */
  to?: string[];
  /** 歸回的家族連回祖先：ReadingData.links 的索引 */
  link?: number;
}

/** 讀經的三個畫面：家譜樹、大衛立的職位（組織圖）、歸回的名冊（拉 2、尼 7） */
export type StageId = 'tree' | 'roles' | 'roster' | 'wall';

export interface ReadingVerse {
  v: number;
  text: string;
  t: ReadingToken[];
  /** 這一節用哪個畫面；沒寫就用所屬段落的 stage */
  stage?: StageId;
  /** 所屬小段的標題（代上 1–9 的附錄段落） */
  sec?: string;
  /** 這段經文是一塊名單牌子：沒有人名的節，鏡頭停在牌子上 */
  hold?: string;
  /** 讀經提醒（notes 的索引） */
  note?: number;
  /** 平行經文差異小卡（diffs 的索引） */
  diff?: number[];
  /** 職位圖上這一節對應的職位方塊（RoleBox.id）；沒有人名的節，鏡頭停在這個方塊 */
  box?: string;
}

export interface ReadingChapter {
  /** 書卷簡稱，例如「創」「代上」 */
  book: string;
  /** 書卷全名，例如「創世記」 */
  bookName: string;
  n: number;
  /** 章名卡上的標題（代上 1–9 用附錄章名；其他書卷用段落標題） */
  title: string;
  verses: ReadingVerse[];
}

/** 讀經路線上的一段（例如「以掃的後代　創 36:1–43」）；一段可以跨章 */
export interface ReadingSegment {
  id: string;
  /** 讀者看得懂的段落名 */
  title: string;
  /** 段落選單的分組（例如「創世記」「大衛立的職位」「歸回」「新約」） */
  group: string;
  /** 目錄裡這一段的一句介紹 */
  intro?: string;
  /** 經文範圍的顯示文字，例如「創 36:1–43」 */
  range: string;
  /** 預設畫面 */
  stage: StageId;
  chapters: ReadingChapter[];
}

/** 平行經文差異小卡：只列兩處（或三處）各自的寫法與經節，不解釋原因。text 是該節經文裡逐字存在的字串 */
export interface ReadingDiff {
  title: string;
  sides: Array<{ ref: string; text: string }>;
}

/**
 * 歸回的家族連回祖先（拉 2、尼 7、尼 11–12）。
 * to：連到家譜樹上的人（tree）或職位圖上的方塊成員（role＝RoleBox.id，member＝成員 key）。
 * effect：returned＝子孫歸回（二十四班那一格變紅）；lost＝族譜尋不著（虛線）；link＝只是連回祖先；
 *         town＝這座城在前面的家譜裡記過（名冊上較淡的「家譜裡有這座城」，不說住在那城的人是誰的子孫）。
 */
export interface ReadingLink {
  at: string;
  word: string;
  to: Array<{ tree?: string; role?: string; member?: string }>;
  effect: 'returned' | 'lost' | 'link' | 'town';
  /** 小卡上的一句話（逐字經文用「」） */
  card?: string;
  /** 小卡要列的經節 */
  refs: string[];
  /** 子母畫面標題裡的名字（城：經文裡的「伯利恆之祖薩瑪」）；沒寫就用連到的人的名字 */
  pip?: string;
}

export interface ReadingData {
  /** 第一次按「帶你讀經」從哪一節開始 */
  start: string;
  segments: ReadingSegment[];
  notes: Array<{ text: string; verses: string[] }>;
  diffs: ReadingDiff[];
  links: ReadingLink[];
}

// ── 歸回的名冊（roster.json，讀到拉 2、尼 7 時才載入） ─────────────
// 照經文本身的分段排；只有經文寫出來的數字，不算累計。s、ls、n 都是那一節經文裡的字元位置，
// 讀經讀到那個位置，那一行（名字、人數條）才出現。

export interface RosterName {
  t: string;
  s: number;
  /** 這個名字連回前面家譜的歸回連結（ReadingData.links 的索引） */
  link?: number;
  /** 這個名字屬於的家族軌跡（RosterData.families／WallData.families 的索引） */
  fam?: number[];
}

export interface RosterRow {
  /** 經節，例如「拉2:3」 */
  at: string;
  /** 這一行在經文裡最早出現的位置：讀到這裡這一行才出現 */
  s: number;
  label?: string;
  ls?: number;
  count?: number;
  /** 量詞（名、人、匹、隻、達利克、彌拿、件、個）；空字串＝經文沒有量詞（拉 8:4「男丁二百」） */
  unit?: string;
  /** 數字在經文裡的起點：讀到這裡人數條才伸長 */
  n?: number;
  /** 只列名字的節（尼提寧、守門的）：名字一個個出現 */
  names?: RosterName[];
  /** 這一節要原句引出的經文 */
  quote?: { t: string; s: number };
  /** 誰捐的（尼 7:70–72） */
  who?: string;
  /** 經文自己寫的「共……名」 */
  total?: boolean;
  /** 會眾總數，畫大字 */
  big?: boolean;
  /** 畫人數條 */
  bar?: boolean;
  /** 這一行裡的歸回連結（冊上有名、家譜裡有這座城、尋不著） */
  links?: number[];
  /** 尼 7 這一行和拉 2 的寫法或人數不同 */
  differs?: boolean;
  /** 這一行屬於的家族軌跡（RosterData.families 的索引） */
  fam?: number[];
}

export interface RosterSection {
  title: string;
  /** 不能指明譜系、尋不著譜系的：虛線框 */
  lost?: boolean;
  bars?: boolean;
  rows: RosterRow[];
}

export interface Roster {
  /** 讀經路線的段落 id（ezra2、neh7） */
  segment: string;
  title: string;
  /** 名冊開頭的經文（尼 7:5） */
  quote?: { ref: string; text: string };
  /** 這一段的經節，依次序 */
  verses: string[];
  /** 人數條滿格的人數（這份名冊最大的一行） */
  max: number;
  sections: RosterSection[];
  /** plain：口氣中性（拉 10），不加金色、不蓋「冊上有名」、不開子母畫面；家族軌跡照常 */
  tone?: 'plain';
  /** 名字像簽名一樣一個個蓋上去（尼 10） */
  seal?: boolean;
}

export interface RosterData {
  rosters: Roster[];
  /** 家族軌跡：同一個家族（或同一個人）在好幾份名單都出現 */
  families?: RosterFamily[];
}

/** 家族軌跡：名冊行（或名字）底下一排小籤「也在：……」，點了跳到那一節讀 */
export interface RosterFamily {
  name: string;
  places: Array<{
    at: string;
    /** 那一節所屬的讀經段落 id */
    seg: string;
    /** 那一處掛到的名冊行有人數時才有 */
    count?: number;
    unit?: string;
  }>;
}

// ── 修城牆的人（wall.json，讀到尼 3 時才載入） ─────────────
// 示意的一圈（不照真實比例）：照經文出現的次序，從羊門出發繞一圈回到羊門。

export interface WallItem {
  /** 經節，例如「尼3:1」 */
  at: string;
  /** gate 城門、tower 城樓、place 牆上別的地方、part 一段（修造的人） */
  kind: 'gate' | 'tower' | 'place' | 'part';
  /** 門、樓、地方的名字（part 沒有） */
  t?: string;
  /** 在那一節經文裡的字元位置 */
  s?: number;
  /** 繞回起點（尼 3:32 回到羊門） */
  back?: boolean;
  /** part：修造的人，讀到哪寫到哪 */
  names?: RosterName[];
}

export interface WallData {
  segment: string;
  verses: string[];
  ring: WallItem[];
  families?: RosterFamily[];
}

// ── 大衛立的職位（roles.json，分頁打開或讀到時才載入） ─────────────

/** 一個職位方塊裡的一位（或一班） */
export interface RoleMember {
  /** 方塊內唯一的 key（歸回連結、讀經標亮用） */
  key: string;
  /** 家譜樹上有這個人時的人物 id */
  id?: string;
  /** 只在職位圖上的人 */
  rid?: string;
  /** 方塊裡顯示的名字 */
  name: string;
  /** 一兩個字的補充，例如「哈律人」「第二班」「十月」「二萬四千人」 */
  detail?: string;
  /** 出處經節（可多處，逗號分隔） */
  ref: string;
  /** 二十四班、十二月輪盤的序號（1 起算） */
  order?: number;
  /** 十二個官吏裡娶了所羅門女兒的：名牌連到家譜樹上的妻子 */
  spouse?: { id: string; name: string };
}

export interface RoleBox {
  id: string;
  title: string;
  /** 經文範圍的顯示文字 */
  ref: string;
  /** 畫法：一般名單、二十四格環、十二月輪盤、依支派分組 */
  kind: 'list' | 'ring24' | 'wheel12' | 'groups' | 'compare' | 'tiles';
  /** 家譜樹上職位印的字 */
  seal: string;
  /** 方塊底下一句說明 */
  note?: string;
  members: RoleMember[];
  /** kind=groups 時：分組名（例如支派名）→ 成員 key（有些組只有人數、沒有名字，keys 是空的） */
  groups?: Array<{ title: string; ref: string; keys: string[] }>;
  /** 照經文寫的人數（count 是經文裡逐字的寫法，例如「六千八百人」）；只列數字，不畫比例 */
  figures?: Array<{ label: string; count: string; ref: string }>;
  /** kind=compare（從大衛到所羅門）：一個職位一列 */
  rows?: CompareRow[];
  /** 方塊標題下原句引出的經文（十二個官吏：王上 4:7「每年各人供給一月」） */
  quote?: { ref: string; text: string };
}

export interface RoleCategory {
  id: 'court' | 'army' | 'temple' | 'tribes' | 'solomon';
  title: string;
  boxes: RoleBox[];
}

/** 只在職位圖上的人：小卡寫他是哪裡人、擔任什麼、出處經節 */
export interface RolePerson {
  rid: string;
  name: string;
  /** 例如「哈律人」「耶何耶大的兒子」 */
  qualifier?: string;
  /** 別的寫法（亞多蘭在王上 4:6 寫亞多尼蘭） */
  aliases?: string[];
  refs: string[];
}

export interface RolesData {
  categories: RoleCategory[];
  people: RolePerson[];
}

/** 家譜樹上的職位印：人物 id → 職位（genealogy.json 的 roleSeals） */
export interface RoleSeal {
  id: string;
  /** 印上的字，兩三個字（「元帥」「勇士」「第三班」） */
  label: string;
  /** 對應的職位方塊 */
  box: string;
  ref: string;
}

/** 從大衛到所羅門：一個職位一列，左欄大衛時、右欄所羅門時 */
export interface CompareRow {
  office: string;
  /** 大衛時的人（只顯示；id＝家譜樹人物，rid＝職位圖上的人） */
  david: Array<{ name: string; ref: string; id?: string; rid?: string; detail?: string }>;
  /** 所羅門時的人：方塊 members 的 key */
  solomon: string[];
  /** 同一個人：金框卡橫跨兩欄（方塊 members 的 key） */
  same?: string;
  /** 換了職位的人：紅框，寫原本的職位 */
  moved?: { key: string; from: string };
}
