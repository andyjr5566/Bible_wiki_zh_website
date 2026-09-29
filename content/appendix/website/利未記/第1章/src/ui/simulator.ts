import { OFFERINGS, OFFERING_BY_ID, OUTCOME_LABELS, findVariant } from '../data/offerings';
import type { Offering, OfferingId, Outcome, OutcomeKey, Variant } from '../data/types';
import { h, on } from './dom';
import { badge, factLine, refChips } from './evidence';
import { OFFERING_STYLE } from './meta';
import { Player } from './player';

export const omark = (id: keyof typeof OFFERING_STYLE) =>
  h('span', { class: 'omark', 'data-shape': OFFERING_STYLE[id].shape, style: `--c:${OFFERING_STYLE[id].color}`, 'aria-hidden': 'true' });

interface State {
  offering: Offering;
  pick: Record<string, string>;
  variant: Variant;
}

export function mountSimulator(host: HTMLElement) {
  const player = new Player();
  const tabs = h('div', { class: 'otabs', role: 'tablist', 'aria-label': '選一種祭' });
  const reveal = h('div', { class: 'card reveal' });
  const axesEl = h('div', { class: 'axes' });
  const fpBody = h('div', { class: 'fp' });
  const fpNote = h('div', { class: 'diffnote', 'aria-live': 'polite' });
  const rulesEl = h('div', { style: 'padding:12px 14px;border-top:1px solid var(--line);display:grid;gap:6px;font-size:.92em' });
  const fp = h('div', { class: 'card sim-extra' },
    h('div', { class: 'fp-head' }, h('h3', null, '這一次的「結果」'), fpNote), fpBody, rulesEl);

  player.el.append(fp);
  host.append(tabs, reveal, axesEl, player.el);

  let state: State;
  let prev: { outcome: Outcome; label: string; changed: string } | null = null;

  function set(offeringId: OfferingId, pick?: Record<string, string>, changed?: string) {
    const offering = OFFERING_BY_ID[offeringId];
    const p = { ...(pick ?? offering.variants[0].axis) };
    // 補上缺的軸（例如切到百姓時，預設母山羊）
    for (const a of offering.axes) if (!(a.id in p)) p[a.id] = a.options[0].id;
    const variant = findVariant(offering, p);
    if (state) prev = { outcome: state.variant.outcome, label: `${state.offering.name}・${state.variant.label}`, changed: changed ?? '' };
    state = { offering, pick: p, variant };
    render();
  }

  function render() {
    const { offering, variant } = state;
    const st = OFFERING_STYLE[offering.id];
    host.style.setProperty('--c', st.color);
    tabs.replaceChildren(...OFFERINGS.map((o) => h('button', {
      class: 'otab', role: 'tab', type: 'button', 'aria-selected': String(o.id === offering.id),
      style: `--c:${OFFERING_STYLE[o.id].color}`,
      onclick: () => set(o.id, undefined, `換成${o.name}`),
    }, omark(o.id), o.name)));
    reveal.style.setProperty('--c', st.color);
    reveal.replaceChildren(omark(offering.id), h('div', null,
      h('b', null, offering.name), ' ', h('span', { class: 'tagline' }, offering.tagline),
      h('div', { style: 'font-size:.88em;color:var(--ink-2);margin-top:2px' }, '為什麼獻：', factLine(offering.why)),
    ));
    reveal.classList.remove('fade-in');
    void reveal.offsetWidth;
    reveal.classList.add('fade-in');

    // 軸：只顯示這個分支用得到的
    axesEl.replaceChildren(...offering.axes.filter((a) => a.id in variant.axis).map((a) => h('div', { class: 'axis', role: 'group', 'aria-label': a.label },
      h('span', null, a.label),
      ...a.options.map((op) => h('button', {
        class: 'opt', type: 'button', 'aria-pressed': String(state.pick[a.id] === op.id),
        onclick: () => {
          if (state.pick[a.id] === op.id) return;
          const was = a.options.find((x) => x.id === state.pick[a.id])?.label ?? '';
          set(offering.id, { ...state.pick, [a.id]: op.id }, `「${a.label}」${was} → ${op.label}`);
        },
      }, op.label)),
    )));
    // 贖罪祭：百姓以外的人，也要看得到「百姓帶什麼來」這一軸被停用的原因
    if (offering.id === 'sin' && !('bring' in variant.axis)) {
      axesEl.append(h('div', { class: 'axis' }, h('span', null, '百姓帶什麼來'),
        h('small', { style: 'color:var(--ink-3)' }, '只有「百姓」這一級有替代祭物（利4:28、4:32、5:7、5:11）。')));
    }

    player.load(variant, st.color);
    renderFingerprint();
  }

  function renderFingerprint() {
    const { variant } = state;
    const changedKeys: OutcomeKey[] = [];
    if (prev) for (const k of Object.keys(OUTCOME_LABELS) as OutcomeKey[]) if (prev.outcome[k].text !== variant.outcome[k].text) changedKeys.push(k);
    fpBody.replaceChildren(...(Object.keys(OUTCOME_LABELS) as OutcomeKey[]).map((k) => {
      const fact = variant.outcome[k];
      const changed = changedKeys.includes(k);
      const v = fact.status === 'not_stated'
        ? h('span', null, h('span', { class: 'unsaid-box', style: 'display:inline-block;padding:2px 8px' }, fact.text), ' ', badge(fact.status), ' ', ...refChips(fact.refs, fact.q))
        : factLine(fact);
      return h('div', { class: `fp-row${changed ? ' changed' : ''}` },
        h('div', { class: 'k' }, OUTCOME_LABELS[k]),
        h('div', null, v, changed && prev ? h('span', { class: 'was' }, `原本：${prev.outcome[k].text}`) : null));
    }));
    if (prev && prev.changed) {
      fpNote.textContent = changedKeys.length
        ? `你只改了一件事（${prev.changed}），下面 ${changedKeys.length} 項跟著變了（黃底）。`
        : `你改了 ${prev.changed}，這 8 項都沒有變。`;
    } else fpNote.textContent = '試著只改上面的一個選項，看哪幾項會跟著變。';
    rulesEl.replaceChildren(h('div', { style: 'font-weight:700;font-size:.9em;color:var(--ink-2)' }, `${state.offering.name}不管怎麼獻都一樣的規矩`),
      ...state.offering.rules.map((r) => h('div', null, '・', factLine(r))));
  }

  on('choose-offering', (d: { offering: OfferingId; pick?: Record<string, string> }) => {
    prev = null;
    set(d.offering, d.pick, '');
    prev = null;
    renderFingerprint();
    document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' });
  });

  set('burnt');
  prev = null;
  renderFingerprint();
}
