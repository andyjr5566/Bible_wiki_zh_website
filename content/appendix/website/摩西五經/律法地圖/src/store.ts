/**
 * 全站狀態：深淺色、大字，以及條文頁上讀者打開過哪幾層。
 * 沒有「閱讀深度」模式：每條律法都由淺到深排好，讀者自己決定打開到哪一層；
 * 換到下一條時沿用剛才打開的層，免得每條都要重按。
 * 存 localStorage（前綴 lawmap:），讀寫都包 try/catch——私密視窗或被擋時照樣能用。
 */
const KEY = 'lawmap:';
const load = <T>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(KEY + k);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(KEY + k, JSON.stringify(v));
  } catch {
    /* 存不了就算了，只是偏好 */
  }
};

/** 條文頁的四層：一句話（永遠開著）之後的三層 */
export type Layer = 'text' | 'others' | 'sources';

type Topic = 'prefs';
const listeners = new Map<Topic, Set<() => void>>();

export const store = {
  theme: load<'auto' | 'light' | 'dark'>('theme', 'auto'),
  big: load<boolean>('big', false),
  /** 看過導覽了（第一次來才自動打開） */
  guided: load<boolean>('guided', false),
  layers: new Set<Layer>(load<Layer[]>('layers', []).filter((l) => l !== 'sources')),

  on(topic: Topic, fn: () => void) {
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic)!.add(fn);
  },
  emit(topic: Topic) {
    listeners.get(topic)?.forEach((fn) => fn());
  },

  setLayer(l: Layer, open: boolean) {
    // 「出處」那一層資料多，打開了也不帶到下一條，免得蓋過下一條的一句話
    if (l === 'sources') return;
    if (open) this.layers.add(l);
    else this.layers.delete(l);
    save('layers', [...this.layers]);
  },

  setTheme(t: 'auto' | 'light' | 'dark') {
    this.theme = t;
    save('theme', t);
    this.emit('prefs');
  },
  setGuided(g: boolean) {
    this.guided = g;
    save('guided', g);
  },
  setBig(b: boolean) {
    this.big = b;
    save('big', b);
    this.emit('prefs');
  },
};
