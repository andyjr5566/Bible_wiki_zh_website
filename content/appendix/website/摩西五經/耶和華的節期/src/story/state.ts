/**
 * 捲動狀態：唯一的共享可變物件。
 * - 介面層（src/ui、src/story/scroll.ts）在每次捲動時寫入。
 * - 場景層（src/scene）每一幀讀取，不寫入（互動結果除外，見 hyssop）。
 * 不用框架的響應式狀態；每幀直接讀這個物件，避免捲動時大量重繪。
 */

export type HyssopPart = 'lintel' | 'left' | 'right';

export interface StoryState {
  /** 目前所在的章（opening、passover……）與拍 */
  chapter: string;
  beat: string;
  /** 目前這一拍的場景提示（story.yaml 的 cue） */
  cue: string;
  /** 前一拍的 cue（場景做轉場用） */
  prevCue: string;
  /** 0–1：在目前這一拍裡捲到哪裡 */
  beatProgress: number;
  /** 0–1：在目前這一章裡捲到哪裡 */
  chapterProgress: number;
  /** 0–1：整頁 */
  pageProgress: number;
  /**
   * 月亮的日子（1–30，可為小數，隨捲動連續變化）：開場 1→14、無酵節 15→21、二月逾越節 14。
   * 介面層依各拍的 day 內插寫入；場景據此畫月相。
   */
  day: number;
  /** 目前的月份（1–12）；沒有經文日期的章（初熟禾捆、七七節）維持前一個值 */
  month: number;
  /** 七七節的數算：0–50，可為小數（介面層依 count 拍的捲動寫入；其他時候是 0 或 50） */
  count: number;
  /** 烤無酵餅：介面層的長按按鈕寫入 progress（0–1）；場景讀取畫麵團變化 */
  bake: { progress: number; done: boolean; auto: boolean };
  /** 搖禾捆：場景寫入（拖曳甩動或 waveAction），介面層讀取更新提示 */
  wave: { swings: number; done: boolean; auto: boolean };
  /**
   * 吹角：介面層的長按按鈕寫入。按住時 level 0→1（約 1.2 秒），放開後回落；
   * level 到 1 算吹了一聲（blasts+1），第一聲就 done。場景依 level 畫聲波與畫面震動。
   * 讀者觸發的動作：動態關也照常播放。捲過去沒做 → auto: true、done: true（不補畫聲波）。
   */
  blow: { level: number; holding: boolean; blasts: number; done: boolean; auto: boolean };
  /** 目前這一拍是回聲拍（後來的歷史）：介面層依 Beat.echoes 寫入；場景改用舊紙配色 */
  later: boolean;
  /** 系統偏好：暗色模式 */
  dark: boolean;
  /**
   * 讀者用標題列「動態」開關關掉動態（不跟作業系統）。只停環境與小動作（風吹麥浪、紙紋閃動、鏡頭漂移），
   * 捲動帶動的動作與讀者自己觸發的動作照常播放，不能變成跳格。
   */
  motionOff: boolean;
  /** 塗血互動的進度：由場景寫入（讀者在畫布上操作），介面層讀取更新提示與音效 */
  hyssop: {
    dipped: boolean;
    marks: Record<HyssopPart, boolean>;
    /** 三處都打過了；讀者沒做就捲過去時，場景會自動補完並設為 true */
    done: boolean;
    auto: boolean;
  };
}

export const story: StoryState = {
  chapter: 'opening',
  beat: 'title',
  cue: 'title',
  prevCue: 'title',
  beatProgress: 0,
  chapterProgress: 0,
  pageProgress: 0,
  day: 1,
  month: 1,
  count: 0,
  bake: { progress: 0, done: false, auto: false },
  wave: { swings: 0, done: false, auto: false },
  blow: { level: 0, holding: false, blasts: 0, done: false, auto: false },
  later: false,
  dark: false,
  motionOff: false,
  hyssop: {
    dipped: false,
    marks: { lintel: false, left: false, right: false },
    done: false,
    auto: false,
  },
};
