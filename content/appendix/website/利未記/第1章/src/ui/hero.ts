import { BRING, EPIGRAPH, WHY, resolveEntry, type BringId, type WhyId } from '../data/entry';
import { OBJECTS } from '../data/objects';
import { OFFERING_BY_ID } from '../data/offerings';
import type { Courtyard } from '../three/courtyard';
import { emit, fill, h, motionOff, on, svg } from './dom';
import { badge, refChip, refChips } from './evidence';
import { ICONS } from './icons';
import { createMap } from './map';
import { OFFERING_STYLE } from './meta';
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

function slot<T extends string>(label: string, options: readonly { id: T; label: string }[], onChange: (v: T | '') => void) {
  const sel = h('select', { class: 'slot', 'aria-label': label },
    h('option', { value: '' }, '選一樣'),
    ...options.map((o) => h('option', { value: o.id }, o.label)));
  // 下拉框的寬度跟著目前選到的字走，不被最長的選項撐開
  const fit = () => {
    const probe = h('span', { class: 'slot-probe' }, sel.options[sel.selectedIndex].text);
    sel.after(probe);
    sel.style.width = `${probe.offsetWidth + 10}px`;
    probe.remove();
  };
  sel.addEventListener('change', () => {
    sel.classList.toggle('filled', !!sel.value);
    fit();
    onChange(sel.value as T | '');
  });
  requestAnimationFrame(fit);
  document.fonts?.ready.then(fit);
  return sel;
}

export function mountHero(host: HTMLElement) {
  const stage = h('div', { class: 'hero-stage' });
  const poster = h('div', { class: 'hero-poster', 'aria-hidden': 'true' });
  poster.append(createMap().root);
  const labels = h('div', { class: 'labels3d' });
  stage.append(poster, labels);

  const roofBtn = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false', hidden: true }, '掀開會幕的頂');
  const overviewBtn = h('button', { class: 'chipbtn', type: 'button', hidden: true }, '回到全景');
  const controls = h('div', { class: 'hero-controls' }, roofBtn, overviewBtn);

  // 直排的標題與題辭
  const title = h('div', { class: 'hero-title' },
    h('h1', { 'aria-label': '會幕前的一天' }, ...[...'會幕前的一天'].map((c, i) => h('span', { class: 'ch', style: `--i:${i}`, 'aria-hidden': 'true' }, c))),
    h('div', { class: 'epi' }, h('p', { class: 'epigraph' }, `「${EPIGRAPH.text}」`), refChip(EPIGRAPH.ref, EPIGRAPH.text)),
  );

  // 填空句
  let bring: BringId | '' = '';
  let why: WhyId | '' = '';
  const result = h('div', { class: 'entry-result', 'aria-live': 'polite' });
  const selBring = slot('帶著什麼', BRING, (v) => { bring = v; update(); });
  const selWhy = slot('因為什麼', WHY, (v) => { why = v; update(); });
  const sentence = h('p', { class: 'entry-line' }, '我帶著', selBring, '來到會幕門口，因為', selWhy, '。');

  function update() {
    if (!bring || !why) {
      fill(result, h('span', { class: 'entry-muted' }, bring || why ? '再填另一格。' : '填上兩格，看看經文怎麼說。'));
      return;
    }
    const r = resolveEntry(bring, why);
    if (r.ok) {
      const o = OFFERING_BY_ID[r.offering];
      const st = OFFERING_STYLE[r.offering];
      fill(result,
        h('span', { class: 'entry-name', style: `--c:${st.color}` }, h('span', { class: 'omark', 'data-shape': st.shape, style: `--c:${st.color}` }), o.name),
        h('span', { class: 'entry-why' }, r.fact.text, ' ', ...refChips(r.fact.refs, r.fact.q)),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { court?.focus('altar'); emit('choose-offering', { offering: r.offering, pick: r.pick }); } },
          '照著走一次', svg(ICONS.next)));
    } else {
      fill(result,
        h('span', { class: 'entry-name no' }, '經文沒有這樣獻的'),
        h('span', { class: 'entry-why' }, r.fact.text, ' ', badge(r.fact.status), ' ', ...refChips(r.fact.refs, r.fact.q)));
    }
  }
  update();

  const entry = h('div', { class: 'entry' }, h('div', { class: 'wrap' }, sentence, result));
  host.append(stage, title, controls, entry);

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
  on('focus-3d', (node: string) => {
    host.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth' });
    setTimeout(() => {
      court?.focus(node);
      roofBtn.setAttribute('aria-pressed', String(node === 'incense_altar' || node === 'veil'));
    }, 400);
  });
  on('motion', (off: boolean) => court?.setAutoRotate(!off));
  // three.js 等瀏覽器空閒才載入，首屏先顯示平面圖
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
  idle(() => start3d());
}
