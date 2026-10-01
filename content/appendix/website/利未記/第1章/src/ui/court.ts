import { OBJECTS } from '../data/objects';
import type { Courtyard } from '../three/courtyard';
import { h, motionOff, on } from './dom';
import { createMap } from './map';
import { openObject } from './objects';

const LABELS = [
  { id: 'altar', text: '燔祭壇', node: 'altar' },
  { id: 'laver', text: '洗濯盆', node: 'laver' },
  { id: 'ash', text: '倒灰處', node: 'ash_heap', offset: [0, 1.2, 0] as [number, number, number] },
  { id: 'veil', text: '會幕', node: 'tent_roof', offset: [0, 1.5, 0] as [number, number, number] },
  { id: 'court', text: '院門', node: 'gate_screen' },
];
const LABEL_OBJECT: Record<string, string> = { altar: 'altar', laver: 'laver', ash: 'ash', veil: 'veil', court: 'court' };
const LABEL_FOCUS: Record<string, string> = { altar: 'altar', laver: 'laver', ash: 'ash_heap', veil: 'veil', court: 'gate_screen' };

/**
 * 3D 院子（three.js 等瀏覽器空閒才載入，先顯示平面圖）。
 * 點標籤會打開那件器具的說明。
 */
export function mountCourt(): { el: HTMLElement; focus(node: string): void } {
  const stage = h('div', { class: 'court-stage' });
  const poster = h('div', { class: 'hero-poster', 'aria-hidden': 'true' });
  poster.append(createMap().root);
  const labels = h('div', { class: 'labels3d' });
  stage.append(poster, labels);

  const roofBtn = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false', hidden: true }, '掀開會幕的頂');
  const overviewBtn = h('button', { class: 'chipbtn', type: 'button', hidden: true }, '回到全景');
  const controls = h('div', { class: 'hero-controls' }, roofBtn, overviewBtn);
  const hint = h('p', { class: 'court-hint' }, '拖曳可以轉動；點標籤看那件器具。');
  const el = h('div', { class: 'court card' }, stage, controls, hint);

  let court: Courtyard | null = null;
  const canWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  })();
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia('(max-width: 560px)').matches;
  const note = (t: string) => poster.append(h('p', { class: 'poster-note' }, t));

  async function start3d() {
    if (!canWebGL) return note('這台裝置不支援 3D，改用平面圖。');
    try {
      const { createCourtyard } = await import('../three/courtyard');
      court = await createCourtyard(stage, labels, LABELS, (id) => {
        court?.focus(LABEL_FOCUS[id]);
        roofBtn.setAttribute('aria-pressed', String(id === 'veil'));
        const o = OBJECTS.find((x) => x.id === LABEL_OBJECT[id]);
        if (o) openObject(o);
      }, { reducedMotion: motionOff(), lowPower });
      poster.remove();
      roofBtn.hidden = false;
      overviewBtn.hidden = false;
    } catch (err) {
      console.error(err);
      note('3D 模型載入失敗，改用平面圖。');
    }
  }
  roofBtn.addEventListener('click', () => {
    const open = roofBtn.getAttribute('aria-pressed') !== 'true';
    roofBtn.setAttribute('aria-pressed', String(open));
    court?.setRoof(open);
    if (open) court?.focus('incense_altar');
  });
  overviewBtn.addEventListener('click', () => {
    roofBtn.setAttribute('aria-pressed', 'false');
    court?.overview();
  });
  on('motion', (off: boolean) => court?.setAutoRotate(!off));
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
  idle(() => start3d());

  return {
    el,
    focus(node: string) {
      court?.focus(node);
      roofBtn.setAttribute('aria-pressed', String(node === 'incense_altar' || node === 'veil'));
    },
  };
}
