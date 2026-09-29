import { playSignal, unlockAudio } from '../audio/trumpet';
import { clan } from '../data/levites';
import { ARK_WORDS, MARCHES, MARCH_DIFF, MARCH_END, TRIGGER } from '../data/march';
import type { MarchMode, MarchStep } from '../data/march';
import { SIGNALS, TRUMPET_FACTS, WEST_NORTH_SILENT, signal, signalFact } from '../data/trumpets';
import type { SignalId } from '../data/trumpets';
import { camp } from '../data/tribes';
import { VOICES } from '../data/voices';
import { phasesOf, viewAt } from '../phases';
import type { Phase } from '../phases';
import * as store from '../store';
import { CAMP_RECT, CLAN_RECT, CX } from '../layout';
import { centerMapOn, createCampMap } from './campmap';
import { fill, h, svg } from './dom';
import { badge, factLine, interpHeading, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { CAMP_STYLE } from './meta';
import { smoothScrollTo } from './motion';

const dwell = (p: Phase): number => {
  switch (p.kind) {
    case 'rest': return 1400;
    case 'cloud': return 2600;
    case 'step': return p.step.signal ? 3800 : 2800;
    case 'done': return 0;
  }
};

const phaseTitle = (p: Phase): string => {
  switch (p.kind) {
    case 'rest': return '住營：雲彩遮蓋帳幕';
    case 'cloud': return '雲彩從帳幕收上去';
    case 'step': return p.step.label;
    case 'done': return '全部出發了';
  }
};

const chipFor = (step: MarchStep): HTMLElement => {
  const first = step.camps?.[0];
  const mark = first
    ? h('span', { class: 'omark', 'data-shape': CAMP_STYLE[first].shape, style: `--c:${CAMP_STYLE[first].color}` })
    : h('span', { class: 'omark', 'data-shape': 'star', style: '--c:var(--levi)' });
  const name = step.camps ? camp(step.camps[0]).bannerName.replace('的纛', '')
    : step.tabernacle ? '會幕' : step.clans!.map((c) => clan(c).name).join('、');
  return h('span', { class: 'chip-inner' }, mark, h('b', null, name));
};

export function mountMarch(host: HTMLElement) {
  const map = createCampMap({ label: '拔營示意圖：依次序出發的營與族會變成虛線' });
  const caption = h('div', { class: 'stage-caption', 'aria-live': 'polite' });
  const details = h('div', { class: 'phase-detail' });
  const list = h('ol', { class: 'phase-list' });
  const strip = h('div', { class: 'strip', role: 'list', 'aria-label': '行軍縱隊（前進方向為示意，經文沒有記）' });
  const scroller = h('div', { class: 'map-scroll' }, map.el);
  const stage = h('div', { class: 'card stage' }, scroller, h('p', { class: 'swipe-hint' }, '← 左右滑動看整張圖 →'), caption);

  /** 手機上地圖比畫面寬：跟著正在出發的營／族左右捲 */
  function follow(st: Readonly<store.State>, smooth: boolean) {
    const s = viewAt(st.mode, st.phase).step;
    let x = CX;
    if (s?.camps?.length) {
      const r = CAMP_RECT[s.camps[0]];
      x = r.x + r.w / 2;
    } else if (s?.clans?.length) {
      x = s.clans.reduce((a, c) => a + CLAN_RECT[c].x + CLAN_RECT[c].w / 2, 0) / s.clans.length;
    }
    centerMapOn(scroller, x, smooth);
  }

  /* ---- 控制列 ---- */
  const modeBtns = (Object.keys(MARCHES) as MarchMode[]).map((m) => h('button', {
    class: 'seg-btn', type: 'button', 'aria-pressed': String(store.get().mode === m),
    onclick: () => { store.set({ mode: m, phase: 0, playing: false }); },
  }, m === 'num10' ? '民10 實際上路' : '民2 安營次序'));
  const playBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
    const st = store.get();
    const last = phasesOf(st.mode).length - 1;
    if (st.playing) store.set({ playing: false });
    else store.set({ playing: true, phase: st.phase >= last ? 0 : st.phase });
  } });
  const stepBtn = (label: string, icon: string, delta: number) => h('button', {
    class: 'btn icon', type: 'button', title: label, 'aria-label': label,
    onclick: () => go(store.get().phase + delta, true),
  }, svg(ICONS[icon]));
  const resetBtn = h('button', { class: 'btn icon', type: 'button', title: '回到住營', 'aria-label': '回到住營', onclick: () => store.set({ phase: 0, playing: false }) }, svg(ICONS.reset));
  const nightBtn = h('button', { class: 'btn icon', type: 'button', title: '日／夜（夜間雲彩形狀如火）', 'aria-label': '切換日夜', 'aria-pressed': 'false',
    onclick: () => store.set({ night: !store.get().night }) }, svg(ICONS.moon));
  const soundBtn = h('button', { class: 'btn icon', type: 'button', title: '銀號聲音', 'aria-label': '開關銀號聲音', 'aria-pressed': 'false',
    onclick: () => { const on = !store.get().sound; if (on) unlockAudio(); store.set({ sound: on }); } }, svg(ICONS.mute));
  const ctrl = h('div', { class: 'march-top' },
    h('div', { class: 'seg', role: 'group', 'aria-label': '次序版本' }, ...modeBtns),
    h('div', { class: 'ctrls' }, resetBtn, stepBtn('上一步', 'prev', -1), playBtn, stepBtn('下一步', 'next', 1), nightBtn, soundBtn));

  /* ---- 號聲面板 ---- */
  const sigBtns = SIGNALS.map((sg) => h('button', {
    class: 'sig', type: 'button', 'data-sig': sg.id, onclick: () => blow(sg.id),
  }, svg(ICONS.trumpet),
  h('span', { class: 'sig-main' }, h('b', null, sg.label), h('small', null, `${sg.how} → ${sg.effect}`)),
  ...refChips([sg.ref], sg.q)));
  const silent = ['西邊', '北邊'].map((w) => h('div', { class: 'sig silent' }, svg(ICONS.trumpet),
    h('span', { class: 'sig-main' }, h('b', null, `${w}的營`), h('small', null, '經文沒有記載號聲')),
    badge('not_stated'), ...refChips(WEST_NORTH_SILENT.refs)));
  const sigNote = h('div', { class: 'sig-note', 'aria-live': 'polite' }, '按一下號，看誰聽到了。');
  const trumpets = h('div', { class: 'card trumpets' },
    h('h3', null, '銀號怎麼吹'),
    h('p', { class: 'muted' }, '兩枝銀號，由祭司吹。長聲招聚，大聲叫營起行。'),
    h('div', { class: 'sigs' }, ...sigBtns, ...silent),
    sigNote,
    h('ul', { class: 'facts small' }, ...[TRUMPET_FACTS[0], TRUMPET_FACTS[3], TRUMPET_FACTS[4]].map((f) => h('li', null, factLine(f)))),
    h('details', { class: 'more' }, h('summary', null, '註釋家怎麼讀號聲'),
      interpHeading(), ...VOICES.trumpet.map(voiceBlock)),
    h('p', { class: 'fine' }, '聲音是即時合成的示意：經文沒有記音高與節奏；長聲、短促聲的區分借自 BH 說的 tekiah／teruah。'));

  function blow(id: SignalId) {
    const sg = signal(id);
    const st = store.get();
    const secs = playSignal(id, st.sound);
    sigNote.textContent = `${sg.how}：${sg.effect}（${sg.ref}）`;
    // 窄螢幕的號聲面板在地圖下面：捲回地圖，才看得到誰聽到了
    const r = stage.getBoundingClientRect();
    if (matchMedia('(max-width: 980px)').matches && (r.bottom < 120 || r.top > innerHeight - 120)) smoothScrollTo(r.top + scrollY - 70, 500);
    store.set({ pulse: { id, t: Date.now() }, playing: false });
    // 兩次大聲各自對應一個營起行：把行列跳到那一步
    if (sg.camp) {
      const mode: MarchMode = 'num10';
      const phases = phasesOf(mode);
      const target = phases.findIndex((p) => p.kind === 'step' && p.step.signal === id);
      if (target >= 0) setTimeout(() => store.set({ mode, phase: target }), Math.min(secs * 1000, 1600));
    }
  }

  /* ---- 階段控制 ---- */
  let timer: ReturnType<typeof setTimeout> | undefined;

  function go(p: number, manual = false) {
    const st = store.get();
    const phases = phasesOf(st.mode);
    const n = Math.max(0, Math.min(p, phases.length - 1));
    if (manual) store.set({ playing: false });
    store.set({ phase: n });
  }

  function announce(st: Readonly<store.State>) {
    const phases = phasesOf(st.mode);
    const p = phases[Math.min(st.phase, phases.length - 1)];
    if (p.kind === 'step' && p.step.signal) {
      const sg = signal(p.step.signal);
      const secs = playSignal(sg.id, st.sound);
      sigNote.textContent = `${sg.how}：${sg.effect}（${sg.ref}）`;
      store.set({ pulse: { id: sg.id, t: Date.now() } });
      return secs;
    }
    return 0;
  }

  let lastMode: MarchMode | null = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    const st = store.get();
    if (!st.playing) return;
    const phases = phasesOf(st.mode);
    const cur = phases[st.phase];
    if (!cur || cur.kind === 'done') { store.set({ playing: false }); return; }
    timer = setTimeout(() => {
      if (!store.get().playing) return;
      store.set({ phase: store.get().phase + 1 });
    }, dwell(cur));
  }

  /* ---- 畫面 ---- */
  function render(st: Readonly<store.State>) {
    const phases = phasesOf(st.mode);
    const p = phases[Math.min(st.phase, phases.length - 1)];
    const v = viewAt(st.mode, st.phase);
    const m = MARCHES[st.mode];

    modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((Object.keys(MARCHES) as MarchMode[])[i] === st.mode)));
    fill(playBtn, svg(st.playing ? ICONS.pause : ICONS.play), st.playing ? '暫停' : st.phase >= phases.length - 1 ? '再播一次' : '開始拔營');
    nightBtn.setAttribute('aria-pressed', String(st.night));
    soundBtn.setAttribute('aria-pressed', String(st.sound));
    fill(soundBtn, svg(st.sound ? ICONS.sound : ICONS.mute));

    caption.textContent = p.kind === 'step' ? `第 ${p.index + 1} 步：${phaseTitle(p)}` : phaseTitle(p);

    /* 縱隊與階段清單只在模式或階段改變時重畫 */
    if (lastMode !== st.mode) {
      lastMode = st.mode;
      fill(strip,
        h('span', { class: 'strip-cap' }, '起行 →'),
        h('span', { class: 'chip cloudchip', role: 'listitem' }, svg(ICONS.cloud), h('b', null, '雲彩收上去')),
        ...m.steps.map((s, i) => h('span', { class: 'chip', role: 'listitem', 'data-i': i }, h('em', null, String(i + 1)), chipFor(s), s.signal ? svg(ICONS.trumpet, 'chip-trumpet') : null)),
        h('span', { class: 'strip-cap end' }, '前進方向為示意'));
      fill(list, ...phases.map((ph, i) => h('li', null, h('button', {
        class: 'phase-item', type: 'button', 'data-p': i, onclick: () => go(i, true),
      }, h('span', { class: 'pi-n' }, i === 0 ? '住' : i === 1 ? '雲' : ph.kind === 'done' ? '完' : String((ph as { index: number }).index + 1)),
      h('span', { class: 'pi-t' }, phaseTitle(ph)),
      ph.kind === 'step' && ph.step.signal ? svg(ICONS.trumpet, 'chip-trumpet') : null))));
    }
    [...strip.querySelectorAll('.chip[data-i]')].forEach((el, i) => {
      const stepPhase = i + 2;
      el.classList.toggle('done', st.phase > stepPhase || st.phase === phases.length - 1);
      el.classList.toggle('now', st.phase === stepPhase);
    });
    strip.querySelector('.cloudchip')?.classList.toggle('done', st.phase >= 1);
    strip.querySelector('.cloudchip')?.classList.toggle('now', st.phase === 1);
    [...list.querySelectorAll('.phase-item')].forEach((el, i) => {
      el.classList.toggle('now', i === st.phase);
      el.classList.toggle('done', i < st.phase);
      if (i === st.phase) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });

    /* 這一階段的說明 */
    const body: (Node | null)[] = [h('h3', null, phaseTitle(p))];
    if (p.kind === 'rest') {
      body.push(h('p', null, '以色列人照著纛下安營，帳幕在正中間。雲彩遮蓋帳幕，雲彩停在哪裡，他們就住營多久。'),
        h('ul', { class: 'facts' }, h('li', null, factLine(TRIGGER[2])), h('li', null, factLine(TRIGGER[3]))));
    } else if (p.kind === 'cloud') {
      body.push(h('p', null, '起行的信號不是人決定的。雲彩一收上去，以色列人就起行。'),
        h('ul', { class: 'facts' }, h('li', null, factLine(TRIGGER[0])), h('li', null, factLine(TRIGGER[1])), h('li', null, factLine(TRIGGER[4]))));
    } else if (p.kind === 'step') {
      const s = p.step;
      body.push(
        s.carries ? h('p', null, h('b', null, '帶著：'), s.carries) : null,
        h('ul', { class: 'facts' },
          h('li', null, factLine({ text: s.label, status: s.status, refs: [s.ref], q: s.q }, { showQuote: true })),
          s.signal ? h('li', null, factLine(signalFact(signal(s.signal)))) : null,
          s.note ? h('li', { class: 'note-li' }, s.note) : null));
      if (v.goingTabernacle) body.push(h('p', { class: 'muted' }, '帳幕在這一步拆卸，由利未人抬著。'));
    } else {
      body.push(h('ul', { class: 'facts' }, ...MARCH_END.map((f) => h('li', null, factLine(f)))),
        h('h4', { class: 'sub' }, '約櫃起行、停住的時候'),
        h('ul', { class: 'facts ark-words' }, ...ARK_WORDS.map((f) => h('li', null, factLine(f, { showQuote: true })))),
        h('h4', { class: 'sub' }, '民2 與民10 的差別'),
        h('ul', { class: 'facts' }, ...MARCH_DIFF.map((f) => h('li', null, factLine(f)))));
    }
    fill(details, ...body);
  }

  store.subscribe((st, prev) => {
    render(st);
    if (st.phase !== prev.phase || st.mode !== prev.mode) follow(st, true);
    if (!st.playing) {
      if (timer) clearTimeout(timer);
      return;
    }
    // 自動播放時，每進入一個階段：有號聲就吹一次，再排下一步
    if (st.phase !== prev.phase || st.mode !== prev.mode || st.playing !== prev.playing) {
      announce(st);
      schedule();
    }
  });
  render(store.get());

  host.append(ctrl,
    h('div', { class: 'march-grid' }, stage,
      h('div', { class: 'march-side' }, h('div', { class: 'card' }, details, h('h4', { class: 'sub' }, '每一步'), list), trumpets)),
    strip);
  requestAnimationFrame(() => follow(store.get(), false));
}
