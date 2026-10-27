import type { StageSpace } from '../data/types';
import { readPlaybackRate } from './playback-speed';

export interface ReturnBookmark {
  scrollY: number;
  label: string;
}

export interface StoryState {
  segment: string;
  beat: string;
  cue: string;
  prevCue: string;
  space: StageSpace;
  /** 0–1：第2節升空成地圖(valley→map)、第14節落回山谷(map→valley)的連續插值 */
  mapElevation: number;
  beatProgress: number;
  segmentProgress: number;
  pageProgress: number;
  /** 第二幕開關：只留下神說『我』的地方（20 個 1cs 動詞） */
  onlyI: boolean;
  /** 原文層小切換：同一個『給』（7 處 H5414） */
  sameGive: boolean;
  /** 第13節四張翻轉卡狀態 */
  flippedGifts: Record<'land' | 'cities' | 'vineyards' | 'oliveyards', boolean>;
  /** 第26節長按把石頭立起來 */
  raiseStone: { holding: boolean; progress: number; done: boolean; auto: boolean };
  /** 02 整理區「同一棵橡樹，三個時候」滑桿：0(創12) | 1(創35) | 2(書24) */
  oakSlider: number;
  /** 第四幕 put-away 進入創35「從前」暖棕回憶態（0–1） */
  pastBlend: number;
  /** 終幕進入士師記「後來」舊紙色態 */
  later: boolean;
  /** 桌機首屏滑鼠輕微視差 [-1, 1]（動態關時歸零） */
  pointerParallax: { x: number; y: number };
  dark: boolean;
  /** 頂列「動態」開關（預設 false = 有動態，不跟作業系統 prefers-reduced-motion） */
  motionOff: boolean;
  /** 頂列「聲音」開關（預設開；瀏覽器要等讀者第一次點擊或按鍵才准播放） */
  soundOn: boolean;
  /** 讀者已經操作過頁面，瀏覽器允許出聲；在這之前不載入音檔 */
  audioReady: boolean;
  playbackRate: number;
  autoplaying: boolean;
  /** 「更多」小卡是否開著（新手教學偵測用） */
  moreOpen: boolean;
  /** 點擊「到地圖看」或「在故事裡看」跳轉後留下的返回書籤 */
  returnSpot: ReturnBookmark | null;
}

const MOTION_STORAGE_KEY = 'jos24-motion-off';
const THEME_STORAGE_KEY = 'jos24-dark';
const SOUND_OFF_STORAGE_KEY = 'jos24-sound-off';

function readBoolStorage(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // localStorage 可能在 file:// 或無痕環境不可用
  }
  return fallback;
}

export function writeBoolStorage(key: string, val: boolean): void {
  try {
    window.localStorage.setItem(key, val ? '1' : '0');
  } catch {
    // 忽略寫入失敗
  }
}

export function createInitialState(): StoryState {
  const hasWindow = typeof window !== 'undefined';
  return {
    segment: 'prologue',
    beat: 'prologue',
    cue: 'prologue',
    prevCue: 'prologue',
    space: 'prologue-bar',
    mapElevation: 0,
    beatProgress: 0,
    segmentProgress: 0,
    pageProgress: 0,
    onlyI: false,
    sameGive: false,
    flippedGifts: {
      land: false,
      cities: false,
      vineyards: false,
      oliveyards: false,
    },
    raiseStone: { holding: false, progress: 0, done: false, auto: false },
    oakSlider: 2,
    pastBlend: 0,
    later: false,
    pointerParallax: { x: 0, y: 0 },
    dark: hasWindow ? readBoolStorage(THEME_STORAGE_KEY, false) : false,
    // 預設一律有動態（motionOff = false），不讀作業系統 prefers-reduced-motion
    motionOff: hasWindow ? readBoolStorage(MOTION_STORAGE_KEY, false) : false,
    soundOn: hasWindow ? !readBoolStorage(SOUND_OFF_STORAGE_KEY, false) : true,
    audioReady: hasWindow && Boolean((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive),
    playbackRate: readPlaybackRate(),
    autoplaying: false,
    moreOpen: false,
    returnSpot: null,
  };
}

export function saveMotionOff(motionOff: boolean): void {
  writeBoolStorage(MOTION_STORAGE_KEY, motionOff);
}

export function saveSoundOn(on: boolean): void {
  writeBoolStorage(SOUND_OFF_STORAGE_KEY, !on);
}

export function saveDarkMode(dark: boolean): void {
  writeBoolStorage(THEME_STORAGE_KEY, dark);
}

export function clamp01(v: number): number {
  if (Number.isNaN(v) || v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

export function clampDt(dt: number): number {
  if (Number.isNaN(dt) || dt <= 0) return 0;
  return dt > 0.25 ? 0.25 : dt;
}
