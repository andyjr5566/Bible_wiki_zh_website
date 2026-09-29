import { DEBATES } from '../data/debates';
import { GIVING, MATERIALS } from '../data/materials';
import { EPIGRAPH, ORDER_VOICES, REVEAL, STOPS, TITLE, WALK, type Stop } from '../data/stops';
import type { LayerId, Stage } from '../three/tabernacle';
import { fill, h, motionOff, svg } from './dom';
import { openDrawer } from './drawer';
import { factLine, interpHeading, refChip, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { METAL } from './meta';
import { reveal, smoothScrollTo } from './motion';

const LAYERS: { id: LayerId; name: string; swatch: string; ref: string }[] = [
  { id: 'seacow', name: '海狗皮（最外層）', swatch: '#3a3a3a', ref: '出26:14' },
  { id: 'ramskin', name: '染紅的公羊皮', swatch: '#c96a78', ref: '出26:14' },
  { id: 'goathair', name: '山羊毛罩棚', swatch: '#4a3a2e', ref: '出26:7' },
  { id: 'linen', name: '細麻幔子（最內層）', swatch: '#8a4fb0', ref: '出26:1' },
];

type Order = 'walk' | 'reveal';

/** 停在某一站時鏡頭定住的範圍（卡片中心前後各占兩站間距的比例） */
const DWELL = 0.22;

export function mountTour(host: HTMLElement) {
  const stageHost = h('div', { class: 'stage-canvas' });
  const poster = h('div', { class: 'stage-poster' }, h('span', { class: 'loading' }, '載入會幕模型…'));
  const now = h('div', { class: 'stage-now', 'aria-live': 'polite' });
  const rail = h('nav', { class: 'rail', 'aria-label': '導覽進度' });
  const railFill = h('i', { class: 'rail-fill' });
  const btnPeel = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false', disabled: true }, '掀開頂');
  const btnAll = h('button', { class: 'chipbtn', type: 'button', disabled: true }, '看全景');
  const btnAuto = h('button', { class: 'chipbtn strong', type: 'button', disabled: true }, svg(ICONS.play), '自動導覽');
  const stage = h('div', { class: 'tour-stage' }, stageHost, poster, now, rail, h('div', { class: 'stage-controls' }, btnAuto, btnPeel, btnAll));

  let world: Stage | null = null;
  let order: Order = 'walk';
  let list: Stop[] = WALK;
  let activeIdx = -1;

  /* ---------------------------------------------------------- 開場 */
  const result = h('div', { class: 'entry-result', 'aria-live': 'polite' });
  const sel = h('select', { class: 'slot', 'aria-label': '帶著什麼' },
    h('option', { value: '' }, '選一樣'), ...MATERIALS.map((m) => h('option', { value: m.id }, m.name)));
  const fit = () => {
    const probe = h('span', { class: 'slot-probe' }, sel.options[sel.selectedIndex].text);
    sel.after(probe);
    sel.style.width = `${probe.offsetWidth + 10}px`;
    probe.remove();
  };
  sel.addEventListener('change', () => {
    sel.classList.toggle('filled', !!sel.value);
    fit();
    const m = MATERIALS.find((x) => x.id === sel.value);
    if (!m) return fill(result, h('span', { class: 'entry-muted' }, '選一樣材料，看它最後用在哪裡。'));
    fill(result,
      h('div', { class: 'entry-muted' }, '它後來變成了：'),
      h('ul', { class: 'uses' }, ...m.uses.map((u, i) => h('li', { style: `--i:${i}` },
        h('span', { class: 'swatch', style: `background:${m.swatch}` }), u.text, ' ', refChip(u.ref, u.q),
        u.stop ? h('button', { class: 'go', type: 'button', onclick: () => goTo(u.stop!) }, '去看', svg(ICONS.next)) : null))));
  });
  requestAnimationFrame(fit);
  document.fonts?.ready.then(fit);
  fill(result, h('span', { class: 'entry-muted' }, '選一樣材料，看它最後用在哪裡。'));

  // 標題逐字出現
  const titleEl = h('h1', { 'aria-label': TITLE.text }, ...[...TITLE.text].map((c, i) => h('span', { class: 'ch', style: `--i:${i}`, 'aria-hidden': 'true' }, c)));
  const intro = h('header', { class: 'tour-intro' },
    h('div', { class: 'title-block' }, titleEl,
      h('div', { class: 'epi' }, h('p', { class: 'epigraph' }, `「${EPIGRAPH.text}」`), refChip(EPIGRAPH.ref, EPIGRAPH.text))),
    h('p', { class: 'intro-lede' }, '出埃及記 25 到 27 章，神在山上把會幕的樣式告訴摩西：一座可以拆開、抬著走的帳幕，和圍著它的院子。這裡照經文的尺寸和材料，一站一站走進去。'),
    h('p', { class: 'entry-line' }, '我帶著', sel, '送到會幕去。'),
    result,
    h('p', { class: 'giving' }, factLine(GIVING)),
    h('button', { class: 'scroll-hint', type: 'button', onclick: () => goTo(list[0].id) }, '往下捲動，從東門走進去'),
  );

  /* ---------------------------------------------------------- 次序切換 */
  const orderNote = h('div', { class: 'order-note' });
  const orderBtns = h('div', { class: 'order-btns', role: 'group', 'aria-label': '導覽次序' });
  const orderBox = h('div', { class: 'order card' }, h('b', null, '用哪個次序走？'), orderBtns, orderNote);

  /* ---------------------------------------------------------- 各站 */
  const cardsEl = h('div', { class: 'stops' });
  const cards = new Map<string, HTMLElement>();
  for (const s of STOPS) cards.set(s.id, stopCard(s));

  function stopCard(s: Stop): HTMLElement {
    const metal = METAL[s.metal];
    const related = DEBATES.filter((d) => d.stop === s.id);
    const body = h('div', { class: 'stop-body' },
      h('p', { class: 'lede' }, s.lede),
      h('ul', { class: 'facts' }, ...s.facts.map((f, i) => h('li', { class: f.status === 'not_stated' ? 'unsaid' : '', style: `--i:${i}` }, factLine(f)))),
    );
    if (s.id === 'layers') body.append(layerPanel());
    if (s.model) {
      body.append(h('button', { class: 'btn', type: 'button', onclick: () => openModel(s) }, svg(ICONS.cube), `轉一轉${s.model.name}的模型`));
    }
    if (s.voices.length) {
      body.append(h('details', { class: 'voices interp-layer' },
        h('summary', null, `註釋家怎麼讀（${s.voices.length}）`), h('div', { class: 'voices-in' }, interpHeading(), ...s.voices.map(voiceBlock))));
    }
    if (related.length) {
      body.append(h('div', { class: 'related' }, h('span', null, '經文沒說的：'),
        ...related.map((d) => h('a', { href: `#deb-${d.id}`, onclick: () => ((document.getElementById(`deb-${d.id}`) as HTMLDetailsElement | null)?.setAttribute('open', '')) }, d.question))));
    }
    return h('article', { class: 'stop card', 'data-stop': s.id, id: `stop-${s.id}`, style: `--m:${metal.color}` },
      h('div', { class: 'stop-head' },
        h('span', { class: 'stop-n' }),
        h('span', { class: 'metal', title: '這一站主要的材料' }, metal.label),
        h('h2', null, s.title),
        h('span', { class: 'stop-ref' }, refChip(s.refs))),
      body);
  }

  function layerPanel(): HTMLElement {
    const box = h('div', { class: 'layers' }, h('b', null, '一層一層掀開看'));
    const state: Record<LayerId, boolean> = { seacow: true, ramskin: true, goathair: true, linen: true };
    for (const l of LAYERS) {
      const missing = l.id === 'goathair';
      box.append(h('button', {
        class: 'layer', type: 'button', 'aria-pressed': 'true', disabled: missing,
        onclick: (e: Event) => {
          state[l.id] = !state[l.id];
          (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(state[l.id]));
          world?.setLayer(l.id, state[l.id]);
        },
      }, h('span', { class: 'swatch', style: `background:${l.swatch}` }), h('span', null, l.name), refChip(l.ref),
      missing ? h('small', null, '這個 3D 模型沒有做這一層') : null));
    }
    box.append(h('p', { class: 'layer-note' }, '按一下，那一層就慢慢淡出；再按一下蓋回去。模型沒有做山羊毛罩棚，所以那一層沒辦法掀。'));
    return box;
  }

  function openModel(s: Stop) {
    const view = h('div', { class: 'detail-view' }, h('span', { class: 'loading' }, '載入模型…'));
    openDrawer(s.model!.name,
      view,
      h('p', { style: 'font-size:.85em;color:var(--ink-3)' }, '拖曳轉動，滾輪或兩指縮放。模型是示意重建，作者 thedeserttabernacle（CC BY-NC）。',
        s.model!.gold ? '約櫃的材質統一改成金色，照出25:11「裡外包上精金」。' : ''),
      h('ul', null, ...s.facts.map((f) => h('li', null, factLine(f)))));
    import('../three/detail').then(({ mountDetail }) => mountDetail(view, s.model!.file, { gold: s.model!.gold, reducedMotion: motionOff() }))
      .then(() => view.classList.add('ready'))
      .catch(() => fill(view, h('span', { class: 'loading' }, '模型載入失敗。')));
  }

  /* ---------------------------------------------------------- 進度軌 */
  function renderRail() {
    fill(rail, railFill,
      h('button', { class: 'dot', type: 'button', 'data-i': -1, title: '全景', 'aria-label': '回到開頭', onclick: () => smoothScrollTo(0) }),
      ...list.map((s, i) => h('button', { class: 'dot', type: 'button', 'data-i': i, title: s.title, 'aria-label': `第 ${i + 1} 站：${s.title}`, onclick: () => goTo(s.id) },
        h('span', null, s.label))));
  }

  function renderOrder() {
    list = order === 'walk' ? WALK : REVEAL;
    fill(orderBtns,
      h('button', { class: 'opt', type: 'button', 'aria-pressed': String(order === 'walk'), onclick: () => setOrder('walk') }, '人走進去的次序'),
      h('button', { class: 'opt', type: 'button', 'aria-pressed': String(order === 'reveal'), onclick: () => setOrder('reveal') }, '神吩咐的次序'));
    fill(orderNote,
      h('p', null, order === 'walk'
        ? '從東門進院子，經過燔祭壇，進帳幕，最後到幔子後面的約櫃。'
        : '出25 章先講約櫃，再講桌子和燈臺；出26 章講帳幕；出27 章才講燔祭壇和院子。從最裡面講到最外面。'),
      interpHeading(), voiceBlock(ORDER_VOICES[0]));
    list.forEach((s, i) => {
      const c = cards.get(s.id)!;
      c.querySelector('.stop-n')!.textContent = String(i + 1);
      cardsEl.append(c);
    });
    world?.setPath(list.map((s) => s.view), list.map((s) => (s.peel ? 1 : 0)));
    renderRail();
    activeIdx = -2;
    measure();
  }
  async function setOrder(o: Order) {
    if (o === order) return;
    cardsEl.classList.add('reorder');
    await new Promise((r) => setTimeout(r, motionOff() ? 0 : 260));
    order = o;
    renderOrder();
    cardsEl.classList.remove('reorder');
    goTo(list[0].id);
  }

  host.append(stage, h('div', { class: 'tour-cards' }, intro, orderBox, cardsEl,
    h('div', { class: 'tour-end card' }, h('b', null, '走完了。'),
      h('p', null, '出27 章最後兩節講點燈的油，接下來出28 章講祭司的衣服。想看這座會幕後來怎麼用來獻祭，下一站是利未記。'),
      h('a', { class: 'btn', href: '../../../利未記/第1章/dist/index.html' }, '會幕前的一天：利未記 1–9 章', svg(ICONS.next)))));

  /* ---------------------------------------------------------- 捲動 → 連續的鏡頭進度 */
  let anchors: number[] = [];
  const mobile = () => matchMedia('(max-width: 900px)').matches;
  /** 讀者目光所在的高度：桌機是畫面中間；手機扣掉上方的 3D 區 */
  const readLine = () => (mobile() ? (stage.getBoundingClientRect().bottom + innerHeight) / 2 : innerHeight * 0.5);
  function measure() {
    const top = (el: Element) => el.getBoundingClientRect().top + scrollY;
    anchors = [top(intro) + intro.offsetHeight * 0.35, ...list.map((s) => {
      const c = cards.get(s.id)!;
      return top(c) + Math.min(c.offsetHeight, innerHeight * 0.6) * 0.5;
    })];
    update();
  }
  function progressAt(y: number): number {
    if (!anchors.length || y <= anchors[0]) return 0;
    for (let i = 0; i < anchors.length - 1; i++) {
      if (y < anchors[i + 1]) {
        const f = (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
        const g = Math.min(1, Math.max(0, (f - DWELL) / (1 - 2 * DWELL)));
        return i + g;
      }
    }
    return anchors.length - 1;
  }
  let ticking = false;
  function update() {
    ticking = false;
    const p = progressAt(scrollY + readLine());
    world?.setProgress(p);
    railFill.style.transform = `scaleY(${list.length ? p / list.length : 0})`;
    const idx = Math.round(p) - 1;
    if (idx !== activeIdx) setActive(idx);
  }
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  new ResizeObserver(() => measure()).observe(cardsEl);
  addEventListener('resize', measure);

  function setActive(idx: number) {
    activeIdx = idx;
    const s = list[idx];
    cards.forEach((c, k) => c.classList.toggle('on', !!s && k === s.id));
    rail.querySelectorAll<HTMLElement>('.dot').forEach((d) => d.classList.toggle('on', +d.dataset.i! === idx));
    rail.querySelectorAll<HTMLElement>('.dot').forEach((d) => d.classList.toggle('past', +d.dataset.i! < idx));
    world?.setPeel(null);
    btnPeel.setAttribute('aria-pressed', String(!!s?.peel));
    now.classList.remove('swap');
    void now.offsetWidth;
    now.classList.add('swap');
    if (!s) fill(now, h('b', null, '會幕全景'), h('span', null, '往下捲動走進去・拖曳可以轉動'));
    else fill(now, h('span', { class: 'metal', style: `--m:${METAL[s.metal].color}` }, METAL[s.metal].label), h('b', null, s.title), h('span', null, s.refs));
  }

  function yFor(id: string): number {
    const i = list.findIndex((s) => s.id === id);
    return i < 0 ? scrollY : anchors[i + 1] - readLine();
  }
  function goTo(id: string) {
    return smoothScrollTo(yFor(id));
  }

  /* ---------------------------------------------------------- 自動導覽：連續滑過去，不是一站一站跳 */
  let autoToken = 0;
  const stopAuto = () => {
    if (!autoToken) return;
    autoToken = 0;
    fill(btnAuto, svg(ICONS.play), '自動導覽');
  };
  btnAuto.addEventListener('click', async () => {
    if (autoToken) return stopAuto();
    const my = (autoToken = Date.now());
    fill(btnAuto, svg(ICONS.pause), '停下來');
    const start = activeIdx + 1 >= list.length ? 0 : Math.max(0, activeIdx + 1);
    for (let i = start; i < list.length; i++) {
      if (autoToken !== my) return;
      const ok = await smoothScrollTo(yFor(list[i].id), motionOff() ? 0 : 3400, () => autoToken !== my);
      if (!ok || autoToken !== my) return;
      await new Promise((r) => setTimeout(r, 4200));
    }
    stopAuto();
  });
  for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, () => autoToken && stopAuto(), { passive: true });

  btnPeel.addEventListener('click', () => {
    const on = btnPeel.getAttribute('aria-pressed') !== 'true';
    btnPeel.setAttribute('aria-pressed', String(on));
    world?.setPeel(on);
  });
  btnAll.addEventListener('click', () => smoothScrollTo(0));

  renderOrder();
  reveal(cardsEl.querySelectorAll('.stop'));
  reveal([orderBox]);

  /* ---------------------------------------------------------- 載入 3D */
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia('(max-width: 560px)').matches;
  const canWebGL = (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  })();
  const loading = poster.querySelector('.loading')!;
  if (!canWebGL) loading.textContent = '這台裝置不支援 3D。文字導覽照樣可以讀。';
  else {
    import('../three/tabernacle').then(({ createStage }) => createStage(stageHost, {
      reducedMotion: motionOff(), lowPower, onProgress: (p) => (loading.textContent = `載入會幕模型… ${Math.round(p * 100)}%`),
    })).then((st) => {
      world = st;
      world.setPath(list.map((s) => s.view), list.map((s) => (s.peel ? 1 : 0)));
      poster.classList.add('gone');
      setTimeout(() => poster.remove(), 700);
      [btnPeel, btnAll, btnAuto].forEach((b) => b.removeAttribute('disabled'));
      update();
    }).catch((err) => {
      console.error(err);
      loading.textContent = '3D 模型載入失敗。文字導覽照樣可以讀。';
    });
  }
}
