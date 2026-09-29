/**
 * 資料契約。
 *
 * - `q` 是和合本逐字摘句，必須是 `refs` 所指經節（raw_scripture）的子字串；
 *   `src/data/data.test.ts` 會逐條比對，對不上就讓 build 失敗。
 * - `Voice.quote` 是註釋家原話，必須逐字出現在本庫民數記該章主檔
 *   （`04 民數記/第{ch}章.md`）的「」裡；那些主檔已經過引句回查。
 * - 人數一律同時存數字與經文裡的中文數字（`zh`），閘門會確認兩者相等。
 */

/** 證據等級：經文明說／綜合整理／註釋解讀／經文沒交代 */
export type Status = 'explicit' | 'synthesis' | 'interpretation' | 'not_stated';

/** 經文出處，例如 `民2:3`、`民10:14-16`、`創35:23-26` */
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
  /** 沒有逐字引號時，主檔裡一定要出現的關鍵詞，閘門用來確認轉述有出處 */
  keys?: string[];
  /** 引句出自民數記第幾章主檔 */
  ch: 2 | 3 | 10;
}

export type Side = 'east' | 'south' | 'west' | 'north';
export type CampId = 'judah' | 'reuben' | 'ephraim' | 'dan';
export type TribeId =
  | 'judah' | 'issachar' | 'zebulun'
  | 'reuben' | 'simeon' | 'gad'
  | 'ephraim' | 'manasseh' | 'benjamin'
  | 'dan' | 'asher' | 'naphtali';
export type ClanId = 'gershon' | 'kohath' | 'merari' | 'priests';
export type Matriarch = 'leah' | 'rachel' | 'bilhah' | 'zilpah';

/** 一個數字：經文裡的中文寫法＋出處 */
export interface Count {
  n: number;
  zh: string;
  ref: Ref;
}
