import { timeLabel } from '../data/dates';
import { STATIONS } from '../data/stations';
import * as store from '../store';
import { fill, h, svg } from './dom';
import { ICONS } from './icons';
import * as playhead from './playhead';

/**
 * 播放列：按鈕與目前的站、時間。移動本身由播放頭（playhead.ts）驅動，這裡只負責操作與顯示。
 *   每站一樣久：起步、加速、減速、停一下，再走下一段。
 *   照時間比例：四十年壓縮成約一分鐘，前十二站一眨眼，接著是漫長的三十八年，中間不停。
 */
export function createPlayer(): HTMLElement {
  const status = h('div', { class: 'player-status', 'aria-live': 'off' });
  const btn = (icon: string, label: string, onclick: () => void) =>
    h('button', { class: 'btn icon', type: 'button', title: label, 'aria-label': label, onclick }, svg(ICONS[icon]));

  const playBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
    const st = store.get();
    if (st.playing) store.set({ playing: false });
    else {
      const from = st.at >= 42 ? 1 : st.at;
      store.set({ playing: true, follow: true, at: from, sel: from });
    }
  } });
  const step = (d: number) => () => {
    const n = Math.max(1, Math.min(42, (store.get().sel ?? store.get().at) + d));
    store.set({ playing: false });
    store.selectStation(n);
  };
  const paceBtns = ([['steady', '每站一樣久'], ['time', '照時間比例']] as const).map(([k, label]) => h('button', {
    class: 'seg-btn', type: 'button', 'data-pace': k, title: k === 'time' ? '四十年壓縮成約一分鐘：前十二站一眨眼，接著是三十八年' : '每一站停一樣久', onclick: () => store.set({ pace: k }),
  }, label));
  const nightBtn = h('button', { class: 'btn icon', type: 'button', title: '日／夜（雲柱與火柱）', 'aria-label': '切換日夜', 'aria-pressed': 'false', onclick: () => store.set({ night: !store.get().night }) }, svg(ICONS.moon));
  const followBtn = h('button', { class: 'btn icon', type: 'button', title: '地圖跟著走', 'aria-label': '地圖跟著走動的人', 'aria-pressed': 'true', onclick: () => store.set({ follow: !store.get().follow }) }, svg(ICONS.target));

  const el = h('div', { class: 'player' },
    h('div', { class: 'ctrls' },
      btn('reset', '回到第 1 站', () => { store.set({ playing: false }); store.selectStation(1); }),
      btn('prev', '上一站', step(-1)), playBtn, btn('next', '下一站', step(1)), nightBtn, followBtn),
    h('div', { class: 'seg small', role: 'group', 'aria-label': '播放速度' }, ...paceBtns),
    status);

  const render = (st: Readonly<store.State>) => {
    fill(playBtn, svg(st.playing ? ICONS.pause : ICONS.play), st.playing ? '暫停' : st.at >= 42 ? '再走一次' : '開始走');
    paceBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pace === st.pace)));
    nightBtn.setAttribute('aria-pressed', String(st.night));
    followBtn.setAttribute('aria-pressed', String(st.follow));
  };
  store.subscribe(render);
  render(store.get());

  // 目前的站與時間：跟著播放頭連續更新（兩站之間依位置內插）
  let lastText = '';
  const paint = (p: number) => {
    const n = Math.max(1, Math.min(42, Math.round(p)));
    const text = `第 ${n} 站 ${STATIONS[n - 1].name}・${timeLabel(playhead.monthsAt(p))}`;
    if (text !== lastText) { lastText = text; status.textContent = text; }
  };
  playhead.onMove(paint);
  paint(playhead.getP());
  return el;
}
