import type { MarchMode } from './data/march';
import type { CampId, ClanId, TribeId } from './data/types';
import type { SignalId } from './data/trumpets';

/** 目前選中的東西：一個支派、一整營、一個利未族，或會幕 */
export type Selection =
  | { kind: 'tribe'; id: TribeId }
  | { kind: 'camp'; id: CampId }
  | { kind: 'clan'; id: ClanId }
  | { kind: 'tabernacle' }
  | null;

export interface Layers {
  levites: boolean;
  mother: boolean;
  banner: boolean;
  c26: boolean;
}

export interface State {
  sel: Selection;
  mode: MarchMode;
  /** 行軍階段：0 住營（雲彩在帳幕上）、1 雲彩收上去、2… 各批出發 */
  phase: number;
  playing: boolean;
  layers: Layers;
  night: boolean;
  sound: boolean;
  /** 最近一次吹號，地圖上短暫亮起 */
  pulse: { id: SignalId; t: number } | null;
}

const state: State = {
  sel: null,
  mode: 'num10',
  phase: 0,
  playing: false,
  layers: { levites: true, mother: false, banner: false, c26: false },
  night: false,
  sound: false,
  pulse: null,
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

export const sameSel = (a: Selection, b: Selection) =>
  a === b || (!!a && !!b && a.kind === b.kind && ('id' in a ? 'id' in b && a.id === b.id : true));
