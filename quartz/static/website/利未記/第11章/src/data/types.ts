/**
 * 資料契約。
 *
 * - `q` 是和合本逐字摘句，必須是 `refs` 所指經節（raw_scripture）的子字串；
 *   `src/data/data.test.ts` 會逐條比對，對不上就讓 build 失敗。
 * - `Voice.quote` 是註釋家原話，必須逐字出現在本庫利未記該章主檔
 *   （`03 利未記/第{ch}章.md`）「」引號裡；英文來源（KC、BH）只轉述、不加引號。
 * - 故事（`Beat.story`）是示意情境，人物是虛構的；規矩一律寫在 `rule`，附經節。
 */

/** 證據等級：經文明說／綜合整理／註釋解讀／經文沒交代 */
export type Status = 'explicit' | 'synthesis' | 'interpretation' | 'not_stated';

/** 經文出處，例如 `利11:33`、`利14:1-9`、`申14:4` */
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

/* ------------------------------------------------------------ 3D 故事 */

export type CastId = 'father' | 'mother' | 'daughter' | 'priest';

/** 營地裡的地點（3D 座標在 three/camp.ts） */
export type Spot =
  | 'home' // 這一家的帳棚門口
  | 'yard' // 帳棚前的空地（煮飯的地方）
  | 'pot'
  | 'basin'
  | 'beside' // 母親身旁（對話的位置）
  | 'seatBy' // 座位旁
  | 'path' // 往會幕的路上
  | 'gate' // 會幕院子的門
  | 'gateF' // 院門外，面對祭司
  | 'pathD' | 'pathF' // 往會幕的路上（女兒、父親並排）
  | 'doorD' | 'doorF' // 會幕門口（女兒、父親站的地方）
  | 'door' // 會幕門口（獻祭的人站的地方）
  | 'doorP' // 會幕門口（祭司站的地方）
  | 'aisle' // 往東出營的路口
  | 'exit' // 營的東邊出口
  | 'outside' // 營外
  | 'outP' // 營外（祭司站的地方）
  | 'tentOut' // 自己帳棚外
  | 'onSeat' // 坐在座位上
  | 'onMat' // 躺在墊子上（頭朝北）
  | 'matBy' // 墊子東邊
  | 'cook' // 火堆旁（煮飯的人蹲的地方）
  | 'potBack' // 瓦罐後面退開一步
  | 'potF' // 瓦罐東南邊（搬瓦罐的人站的地方）
  | 'peek' // 桌子東邊（湊過來看的人）
  | 'bowlBy' // 桌子旁（拿木碗的人）
  | 'basinM' // 水盆旁（泡木碗的人）
  | 'edge' // 空地北邊（往外丟東西的地方）
  | 'fireF' | 'fireM' | 'fireD' // 晚上圍著火堆：父親、母親、女兒
  | 'inTent' // 帳棚裡（門內）
  | 'roadM' | 'roadF' | 'roadD' // 回家路上停下來說話：母親、父親、女兒
  | 'circM' | 'circD' // 全家圍在抱著嬰孩的父親身邊：母親、女兒
  | 'doorHand' // 會幕門口，女兒走到母親身邊（把東西遞給母親）
  | 'passBy' // 出營路上經過自家帳棚的地方
  | 'seeM' | 'seeD'; // 母親、女兒走到路邊看他

export type PropId =
  | 'pot' | 'bowl' | 'lizard' | 'basin' | 'fire'
  | 'baby' | 'lamb' | 'lamb2' | 'lamb3' | 'dove' | 'dove2'
  | 'bundle' | 'vessel' | 'flour' | 'oil' | 'altar' | 'shelter' | 'seat' | 'mat' | 'spot' | 'booth';
export type Sky = 'day' | 'dusk' | 'night' | 'dawn';
/** 人身上的狀態：潔淨、不潔淨到晚上、七天、潔淨期、關鎖、帳棚外等候、獨居營外… */
export type Mark = 'clean' | 'evening' | 'seven' | 'purify' | 'shut' | 'unclean' | 'outside' | 'wait' | 'day8';

export type Act =
  | 'look' | 'pick' | 'throw' | 'dip' | 'bow'
  | 'wave' | 'sprinkle' | 'flick' | 'daub' | 'oil' | 'mourn' | 'rip' | 'loosen' | 'cover' | 'shave' | 'restore' | 'offer' | 'touch' | 'wash'
  | 'sleeve' | 'lean' | 'sit' | 'stand' | 'lie'
  | 'stir' // 照顧火堆／攪湯
  | 'lift' // 掀開瓦罐的蓋子
  | 'recoil' // 嚇一跳、往後退
  | 'smash' // 把瓦罐舉起來摔在地上
  | 'give'; // 雙手把東西遞給 to（例如把祭物交給祭司）

export type Cue =
  /** 鏡頭：預設飛過去；cut＝直接切換（換場、距離很遠時用，像電影剪接） */
  | { t: 'cam'; view: string; cut?: boolean }
  /** 太陽在西邊慢慢落下，天色轉暗（不是整個畫面閃一下） */
  | { t: 'sunset' }
  | { t: 'walk'; who: CastId; to: Spot; via?: Spot[] }
  | { t: 'at'; who: CastId; to: Spot }
  | { t: 'show'; who: CastId; on: boolean }
  | { t: 'sky'; sky: Sky }
  | { t: 'mark'; who: CastId; mark: Mark }
  | { t: 'bar'; on: boolean }
  /** 道具：hide、at:地點、carry:人（拿在手上／抱著）、lead:人（牽著走）、fly、slain、glow、plain、on、off */
  | { t: 'prop'; id: PropId; state: string }
  /** to＝轉向某人；toward＝轉向某個地點（例如望向會幕） */
  | { t: 'act'; who: CastId; act: Act; to?: CastId; toward?: Spot }
  /** 頭上的日子計數，例如「第 8 天」；空字串＝收起 */
  | { t: 'day'; text: string }
  /** 時間快轉：天數從 from 數到 to，天色日夜交替；label 裡的 {n} 換成數字 */
  | { t: 'count'; from: number; to: number; label: string }
  /** 鏡頭跟著一個人走，直到下一個 cam */
  | { t: 'follow'; who: CastId }
  /** 某個地點冒出一句話（例如帳棚裡的哭聲）；near＝冒在某人身旁（例如他抱著的嬰孩在哭） */
  | { t: 'sayAt'; at: Spot; text: string; near?: CastId }
  /** 停一下，製造節奏 */
  | { t: 'wait'; ms: number }
  /** 畫面閃一下（判定的那一刻） */
  | { t: 'flash'; color: string }
  /** 幾件事同時發生（例如一家人一起走） */
  | { t: 'together'; cues: Cue[] }
  /** 對話泡泡（示意情境的台詞）；to＝轉身面向誰 */
  | { t: 'say'; who: CastId; text: string; to?: CastId };

export interface Beat {
  /** 畫面上方的時間標籤，例如「下午」「第 8 天」 */
  time: string;
  /** 示意情境的一句話（虛構） */
  story: string;
  /** 這一步背後的經文規矩 */
  rule: Fact;
  /** 註釋家補充（選用） */
  voice?: Voice;
  cues: Cue[];
}

export interface Reel {
  id: string;
  title: string;
  color: string;
  beats: Beat[];
  /** 最後一步的字幕底下，提示下面接著看什麼 */
  next?: string;
}
