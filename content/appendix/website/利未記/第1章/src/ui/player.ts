import type { Step, Variant } from '../data/types';
import { fill, h, animOff, svg } from './dom';
import { quietBadge, refChips } from './evidence';
import { ICONS } from './icons';
import { createMap, type MapApi } from './map';
import { ACTOR, PLACE_LABEL } from './meta';

/**
 * 逐步播放一個分支：地圖＋「現在這一步」卡片＋控制列＋步驟清單。
 * 模擬器與「承接聖職」共用。
 */
export class Player {
  readonly el: HTMLElement;
  private map: MapApi;
  private variant: Variant | null = null;
  private color = 'var(--bronze)';
  private i = -1;
  private playing = false;
  private token = 0;
  private now: HTMLElement;
  private list: HTMLOListElement;
  private bar: HTMLElement;
  private btnPlay: HTMLButtonElement;
  private btnPrev: HTMLButtonElement;
  private btnNext: HTMLButtonElement;
  private live: HTMLElement;
  private portrait = false;

  constructor(opts: { compactList?: boolean } = {}) {
    this.map = createMap();
    const stage = h('div', { class: 'card stage' }, this.map.root,
      h('div', { class: 'legend' },
        h('span', null, '示意圖，未按比例；方位照出27、40。'),
        h('span', null, '● 人物＝這一步由誰做'),
        h('span', null, '虛線圈＝這一步在哪裡'),
      ));
    this.now = h('div', { class: 'card nowcard', 'aria-live': 'polite' });
    this.live = h('div', { class: 'sr-only', 'aria-live': 'assertive' });
    const icon = (name: string) => svg(ICONS[name]);
    this.btnPrev = h('button', { class: 'btn', type: 'button', 'aria-label': '上一步', onclick: () => this.step(-1) }, icon('prev'));
    this.btnPlay = h('button', { class: 'btn primary', type: 'button', onclick: () => this.toggle() });
    this.btnNext = h('button', { class: 'btn', type: 'button', 'aria-label': '下一步', onclick: () => this.step(1) }, icon('next'));
    const btnReset = h('button', { class: 'btn', type: 'button', 'aria-label': '從頭開始', onclick: () => this.go(-1) }, icon('reset'));
    this.bar = h('i');
    const controls = h('div', { class: 'controls' }, this.btnPrev, this.btnPlay, this.btnNext, btnReset, h('div', { class: 'progress' }, this.bar));
    this.list = h('ol', { class: 'steps', 'aria-label': '步驟清單' });
    const side = h('div', { class: 'side', style: 'display:grid;gap:12px;align-content:start' }, this.now, controls,
      h('div', { class: 'card' }, h('div', { style: 'padding:10px 14px 0;font-weight:700;font-size:.9em' }, '全部步驟'), this.list));
    if (opts.compactList) this.list.style.maxHeight = '300px';
    this.el = h('div', { class: 'sim' }, stage, side, this.live);
    this.el.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest('input,textarea')) return;
      if (e.key === 'ArrowRight') { this.step(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { this.step(-1); e.preventDefault(); }
    });
    new ResizeObserver(() => {
      const p = stage.clientWidth < 560;
      if (p !== this.portrait) {
        this.portrait = p;
        this.map.setOrientation(p);
        this.go(this.i, false);
      }
    }).observe(stage);
    this.renderPlayButton();
  }

  load(variant: Variant, color: string) {
    this.stop();
    this.variant = variant;
    this.color = color;
    this.el.style.setProperty('--c', color);
    this.list.replaceChildren(...variant.steps.map((st, idx) => {
      const li = h('li', { class: [st.later ? 'later' : '', st.status === 'not_stated' ? 'unsaid' : ''].join(' ') },
        h('button', { type: 'button', onclick: () => this.go(idx) }, h('span', { class: 'n' }, st.status === 'not_stated' ? '?' : idx + 1), st.text));
      return li;
    }));
    this.go(-1, false);
  }

  /** 卡片內容換掉時交叉淡入，不要瞬間跳 */
  private swap() {
    this.now.classList.remove('swap');
    void this.now.offsetWidth;
    this.now.classList.add('swap');
  }

  get steps(): Step[] {
    return this.variant?.steps ?? [];
  }

  private renderPlayButton() {
    this.btnPlay.replaceChildren(svg(ICONS[this.playing ? 'pause' : 'play']), this.playing ? '暫停' : this.i < 0 ? '開始' : '自動播放');
    this.btnPlay.setAttribute('aria-pressed', String(this.playing));
  }

  private step(d: number) {
    this.stop();
    this.go(Math.max(-1, Math.min(this.steps.length - 1, this.i + d)));
  }

  stop() {
    this.playing = false;
    this.token++;
    this.renderPlayButton();
  }

  private async toggle() {
    if (this.playing) return this.stop();
    this.playing = true;
    const my = ++this.token;
    this.renderPlayButton();
    if (this.i >= this.steps.length - 1) await this.go(-1, false);
    while (this.playing && my === this.token && this.i < this.steps.length - 1) {
      await this.go(this.i + 1);
      if (my !== this.token) return;
      await new Promise((r) => setTimeout(r, animOff() ? 1600 : 1100));
    }
    if (my === this.token) this.stop();
  }

  async go(i: number, animate = true) {
    const my = this.playing ? this.token : ++this.token;
    this.i = i;
    this.map.reset();
    const steps = this.steps;
    for (let j = 0; j < i; j++) for (const m of steps[j].moves ?? []) await this.map.play(m, false);
    this.list.querySelectorAll('li').forEach((li, idx) => {
      li.classList.toggle('done', idx <= i);
      const b = li.querySelector('button')!;
      if (idx === i) {
        b.setAttribute('aria-current', 'step');
        if (animate) {
          // 只捲清單本身；scrollIntoView 會連整頁一起捲走
          const lr = this.list.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          if (br.top < lr.top || br.bottom > lr.bottom) {
            this.list.scrollTo({ top: this.list.scrollTop + br.top - lr.top - lr.height / 2 + br.height / 2, behavior: animOff() ? 'auto' : 'smooth' });
          }
        }
      } else b.removeAttribute('aria-current');
    });
    this.bar.style.width = `${steps.length ? ((i + 1) / steps.length) * 100 : 0}%`;
    this.btnPrev.disabled = i < 0;
    this.btnNext.disabled = i >= steps.length - 1;
    this.renderPlayButton();
    const st = steps[i];
    if (!st) {
      this.map.highlight(null, this.color);
      this.map.actor(null, 'front');
      this.swap();
      fill(this.now,
        h('div', { class: 'who' }, '準備好了'),
        h('div', { class: 'text' }, `共 ${steps.length} 步。按「開始」，或直接點步驟清單裡的任何一步。`),
        this.variant?.note ? h('div', { class: 'note' }, this.variant.note) : null,
        h('div', null, '經文範圍 ', ...refChips(this.variant?.refs ?? [])),
      );
      return;
    }
    const a = ACTOR[st.actor];
    this.map.highlight(st.at, this.color);
    this.map.actor(st.actor, st.at);
    this.swap();
    fill(this.now,
      h('div', { class: 'who' },
        h('span', { class: 'dot', style: `background:${a.color}` }, a.glyph), a.label,
        h('span', { style: 'font-weight:400;color:var(--ink-3)' }, `・${PLACE_LABEL[st.at]}`),
        h('span', { style: 'margin-left:auto;font-weight:400;color:var(--ink-3)' }, `${i + 1} / ${steps.length}`)),
      h('div', { class: 'text' }, st.text),
      st.q ? h('div', null, h('span', { class: 'q' }, st.q), ' ', ...refChips(st.refs, st.q)) : h('div', null, ...refChips(st.refs)),
      st.status !== 'explicit' || st.later
        ? h('div', null, quietBadge(st.status), st.later ? h('span', { style: 'font-size:.8em;color:var(--ink-3);margin-left:8px' }, '（事後／隔天）') : null)
        : null,
      st.note ? h('div', { class: 'note' }, st.note) : null,
    );
    this.live.textContent = `第 ${i + 1} 步：${a.label}。${st.text}`;
    for (const m of st.moves ?? []) {
      if (my !== this.token && !this.playing) break;
      await this.map.play(m, animate);
    }
  }
}
