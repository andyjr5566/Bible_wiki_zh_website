/**
 * 資料契約。
 *
 * - `q` 是和合本逐字摘句，必須是 `refs` 所指經節（raw_scripture）的子字串；
 *   `src/data/data.test.ts` 會逐條比對，對不上就讓 build 失敗。
 * - `Voice.quote` 是註釋家原話，必須逐字出現在本庫創世記該章主檔
 *   （`01 創世記/第{ch}章.md`）的「」裡；那些主檔已經過引句回查。
 * - `Outside` 是知識庫以外的現代研究，不進閘門，畫面上一律標明。
 */

/** 證據等級：經文明說／綜合整理／註釋解讀／經文沒交代 */
export type Status = 'explicit' | 'synthesis' | 'interpretation' | 'not_stated';

/** 經文出處，例如 `創6:14`、`創7:19-20` */
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
  /** 引句出自創世記第幾章主檔 */
  ch: number;
}

/** 知識庫以外的現代研究或重建，網站沒有逐字查核 */
export interface Outside {
  who: string;
  says: string;
}

/** 故事裡的一幕 */
export interface Scene {
  id: SceneId;
  /** 畫面左上角的小字，例如「創6:11–13」 */
  span: string;
  title: string;
  verse: { ref: Ref; q: string };
  body: string;
  facts?: Fact[];
  voices?: Voice[];
  outside?: Outside[];
  /** 這一幕畫面裡屬於示意的部分，寫在卡片最下面 */
  shown?: string;
}

export type SceneId =
  | 'corrupt'
  | 'command'
  | 'size'
  | 'decks'
  | 'pitch'
  | 'animals'
  | 'family'
  | 'door'
  | 'deep'
  | 'lifted'
  | 'mountains'
  | 'inside'
  | 'remember'
  | 'ararat'
  | 'birds'
  | 'dry'
  | 'exit'
  | 'altar'
  | 'bow';
