/**
 * 資料契約。
 *
 * - `q` 是和合本逐字摘句，必須是 `refs` 所指經節（raw_scripture）的子字串；
 *   `src/data/data.test.ts` 會逐條比對，對不上就讓 build 失敗。
 * - `Voice.quote` 是註釋家或地圖說明的原話，必須逐字出現在 `Voice.file` 指的檔案裡：
 *   本庫章節主檔／地點條目的「」內，或 raw_data 的來源檔、FHL 地圖說明。
 * - 每一站的座標都是「現代候選地點」，不是經文給的；一律標示意。
 */

/** 證據等級：經文明說／綜合整理／註釋解讀／經文沒交代 */
export type Status = 'explicit' | 'synthesis' | 'interpretation' | 'not_stated';

/** 經文出處，例如 `民33:5`、`出14:21-22`、`申10:6-7` */
export type Ref = string;

export interface Fact {
  text: string;
  status: Status;
  refs?: Ref[];
  q?: string;
  note?: string;
}

/**
 * 一段有出處的話（註釋家、地圖說明、地點條目）。
 * - `file`：vault 根目錄起算的路徑。`.md` 檔要求引句在「」內（主檔、條目已經過引句回查）；
 *   raw_data 與 FHL 地圖說明不在此限（`plain`）。
 * - 沒有逐字引號時，用 `keys`：這些關鍵詞必須出現在該檔。
 */
export interface Voice {
  who: string;
  says: string;
  quote?: string;
  keys?: string[];
  file: string;
  plain?: boolean;
}

/** OpenBible 給的一個候選現代地點 */
export interface Candidate {
  name: string;
  lon: number;
  lat: number;
  /** point＝一個遺址；center／representative point＝只知道大概的一帶 */
  kind: string;
  /** OpenBible 的綜合分數（網友投票加路線時間一致性），約 −200 到 1000 */
  score: number;
}
