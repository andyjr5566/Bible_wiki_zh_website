import type { SegMode } from './data/stations';

/** 左欄怎麼看：地理（站的清單）、時間（比例時間軸）、經文（民33 全文，站名可點） */
export type Mode = 'geo' | 'time' | 'text';

export interface Layers {
  /** 其他候選地點 */
  candidates: boolean;
  /** 每站的事件小圖示 */
  events: boolean;
  /** 站名標籤（全部顯示；關掉時只顯示重點站與選到的站） */
  labels: boolean;
}

export interface State {
  /** 選到的站（顯示資訊卡）；null 是總覽 */
  sel: number | null;
  /** 走動的人所在的站 */
  at: number;
  mode: Mode;
  seg: SegMode;
  playing: boolean;
  /** steady：每站一樣久；time：照時間比例（四十年壓縮成一分鐘） */
  pace: 'steady' | 'time';
  layers: Layers;
  night: boolean;
  /** 地圖跟著走動的人 */
  follow: boolean;
  /** 地圖上被點亮的候選地點（站號與候選序號） */
  cand: { n: number; i: number } | null;
}

const state: State = {
  sel: null,
  at: 1,
  mode: 'geo',
  seg: 'ct',
  playing: false,
  pace: 'steady',
  layers: { candidates: false, events: true, labels: false },
  night: false,
  follow: true,
  cand: null,
};

type Listener = (s: Readonly<State>, prev: Readonly<State>) => void;
const listeners = new Set<Listener>();

export const get = (): Readonly<State> => state;

export function set(patch: Partial<State>) {
  const prev = { ...state, layers: { ...state.layers } };
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state, prev));
}

export function setLayer(k: keyof Layers, v: boolean) {
  set({ layers: { ...state.layers, [k]: v } });
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 選一站：資訊卡與走動的人都到那一站 */
export function selectStation(n: number | null, opts: { walk?: boolean } = {}) {
  if (n === null) return set({ sel: null, cand: null });
  set({ sel: n, ...(opts.walk === false ? {} : { at: n }), cand: null });
}
