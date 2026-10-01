/**
 * 資料契約。
 *
 * - `q` 是和合本逐字摘句，必須是 `refs` 所指經節（raw_scripture）的子字串；
 *   `src/data/data.test.ts` 會逐條比對，對不上就讓 build 失敗。
 * - `Voice.quote` 是註釋家原話，必須逐字出現在本庫利未記該章主檔
 *   （`03 利未記/第{ch}章.md`）的「本章整理」裡；那些主檔已經過引句回查。
 */

/** 證據等級：經文明說／綜合整理／註釋解讀／經文沒交代 */
export type Status = 'explicit' | 'synthesis' | 'interpretation' | 'not_stated';

/** 經文出處，例如 `利1:5`、`利1:3-9`、`出27:1` */
export type Ref = string;

export interface Fact {
  text: string;
  status: Status;
  refs?: Ref[];
  q?: string;
  note?: string;
}

/** 註釋家的一種讀法 */
export interface Voice {
  who: string;
  says: string;
  quote?: string;
  /** 引句出自利未記第幾章主檔 */
  ch: number;
}

export type Actor =
  | 'offerer'
  | 'priest'
  | 'anointed'
  | 'elders'
  | 'moses'
  | 'aaron'
  | 'sons'
  | 'people'
  | 'unstated';

export type PlaceId =
  | 'gate'
  | 'front'
  | 'north'
  | 'altar'
  | 'around'
  | 'horns'
  | 'base'
  | 'side'
  | 'east'
  | 'laver'
  | 'door'
  | 'veil'
  | 'incense'
  | 'court'
  | 'camp'
  | 'outside';

export type Item =
  | 'bull'
  | 'ram'
  | 'goat'
  | 'lamb'
  | 'bird'
  | 'flour'
  | 'cake'
  | 'grain'
  | 'blood'
  | 'fat'
  | 'meat'
  | 'skin'
  | 'breast'
  | 'thigh'
  | 'bread'
  | 'ash'
  | 'silver'
  | 'fire'
  | 'smoke'
  | 'hand'
  | 'oil';

export type Motion = 'carry' | 'splash' | 'daub' | 'pour' | 'sprinkle' | 'drain' | 'burn' | 'wave' | 'eat' | 'place';

export interface Move {
  item: Item;
  from?: PlaceId;
  to: PlaceId;
  how: Motion;
  /** 彈血次數等 */
  count?: number;
  /** 只取其中一部分（例如素祭抓一把燒在壇上，其餘留著） */
  part?: boolean;
}

export interface Step {
  actor: Actor;
  /** 白話的一句話 */
  text: string;
  at: PlaceId;
  refs: Ref[];
  q?: string;
  status: Status;
  moves?: Move[];
  note?: string;
  /** 這一步放在事後（例如隔天清灰），畫面上以虛線區隔 */
  later?: boolean;
  /** 3D 演練的演出提示（平面圖不用）：宰、切塊、洗、撕開。只影響畫面，不是經文內容 */
  act?: 'slay' | 'cut' | 'wash' | 'tear' | 'change' | 'bake' | 'mark' | 'gather' | 'bless' | 'glory' | 'godfire';
}

/** 一次獻祭的「結果指紋」，用來做比較與「只改一件事」的差異 */
export interface Outcome {
  animal: Fact;
  blood: Fact;
  altar: Fact;
  priest: Fact;
  offerer: Fact;
  outside: Fact;
  when: Fact;
  where: Fact;
}

export type OutcomeKey = keyof Outcome;

export interface Variant {
  id: string;
  /** 選項上的字 */
  label: string;
  /** 這個選項屬於哪一組選擇（例如「誰犯了罪」「祭物」） */
  axis: Record<string, string>;
  refs: Ref[];
  steps: Step[];
  outcome: Outcome;
  note?: string;
}

export type OfferingId = 'burnt' | 'grain' | 'peace' | 'sin' | 'guilt';

export interface Axis {
  id: string;
  label: string;
  options: { id: string; label: string }[];
}

export interface Offering {
  id: OfferingId;
  name: string;
  /** 一句話抓重點 */
  tagline: string;
  chapters: string;
  why: Fact;
  axes: Axis[];
  variants: Variant[];
  /** 共通的規則，不隨選項改變 */
  rules: Fact[];
}
