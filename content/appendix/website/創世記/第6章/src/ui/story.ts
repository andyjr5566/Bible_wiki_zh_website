import { EPIGRAPH, SCENES, TITLE } from '../data/scenes';
import type { Scene } from '../data/types';
import type { Engine } from '../three/engine';
import type { Sound } from '../audio/sound';
import { factLine, refChip, voiceBlock } from './evidence';
import { h, motionOff, svg } from './dom';
import { ICONS } from './icons';
import { reveal, smoothScrollTo } from './motion';

/** 一幕的卡片 */
function card(s: Scene, i: number): HTMLElement {
  const facts = s.facts?.length
    ? h('ul', { class: 'facts' }, ...s.facts.map((f, k) => h('li', { class: f.status === 'not_stated' ? 'unsaid' : '', style: `--i:${k}` }, factLine(f))))
    : null;
  const voices = s.voices?.length
    ? h('details', { class: 'voices interp-layer' }, h('summary', null, `註釋家怎麼讀（${s.voices.length}）`), h('div', { class: 'voices-in' }, ...s.voices.map(voiceBlock)))
    : null;
  const outside = s.outside?.length
    ? h('details', { class: 'outside' }, h('summary', null, '知識庫以外的現代研究'),
        h('div', { class: 'voices-in' }, ...s.outside.map((o) => h('div', { class: 'ext' }, h('div', { class: 'who' }, o.who), h('div', null, o.says))),
          h('p', { class: 'ext-note' }, '這些不在本庫的四套註釋裡，網站沒有逐字查核，只作背景參考。')))
    : null;
  return h('article', { class: 'scard rv', 'aria-labelledby': `h-${s.id}` },
    h('div', { class: 'scard-top' }, h('span', { class: 'snum' }, `${String(i + 1).padStart(2, '0')} / ${SCENES.length}`), h('span', { class: 'span' }, s.span)),
    h('h2', { id: `h-${s.id}` }, s.title),
    h('blockquote', { class: 'verse' }, h('p', null, s.verse.q), refChip(s.verse.ref, s.verse.q)),
    h('p', { class: 'body' }, s.body),
    facts, voices, outside,
    s.shown ? h('p', { class: 'shown' }, s.shown) : null,
  );
}

export function mountStory(root: HTMLElement, engine: Engine, sound: Sound, labels: HTMLElement) {
  // ---------------------------------------------------------------- 開場
  const soundBtn = h('button', { class: 'hbtn', type: 'button', 'aria-pressed': 'false' }, svg(ICONS.mute), h('span', null, '開聲音'));
  const playBtn = h('button', { class: 'hbtn', type: 'button' }, svg(ICONS.play), h('span', null, '自動播放'));
  const startBtn = h('button', { class: 'hbtn primary', type: 'button' }, h('span', null, '從頭看'), svg(ICONS.chev));
  const loadbar = h('div', { class: 'loadbar', role: 'status' }, h('i'), h('span', null, '正在準備方舟…'));
  const title = h('h1', null, ...[...TITLE].map((ch, i) => h('span', { class: 'ch', style: `--i:${i}` }, ch)));
  const hero = h('section', { class: 'hero-sec', id: 'top', 'aria-label': '開場' },
    h('div', { class: 'hero-in' },
      h('div', { class: 'title-block' }, title,
        h('div', { class: 'epi' }, h('p', { class: 'epigraph' }, EPIGRAPH.text), refChip(EPIGRAPH.ref, EPIGRAPH.text))),
      h('div', { class: 'hero-copy' },
        h('p', { class: 'kicker' }, '創世記 6–9 章'),
        h('p', { class: 'lede' }, '神吩咐挪亞造方舟，洪水來了又退去，雲裡出現了虹。往下捲動，故事就往前走；看完可以自己走進方舟。'),
        h('div', { class: 'hero-actions' }, startBtn, playBtn, soundBtn),
        loadbar,
      ),
    ),
    h('button', { class: 'scroll-cue', type: 'button', 'aria-label': '往下看' }, svg(ICONS.chev)),
  );

  // ---------------------------------------------------------------- 各幕
  const secs: HTMLElement[] = [hero];
  const scenesWrap = h('div', { class: 'scenes' });
  SCENES.forEach((s, i) => {
    const sec = h('section', { class: `scene scene-${s.id}`, id: `s-${s.id}`, 'data-i': i + 1 }, card(s, i));
    scenesWrap.append(sec);
    secs.push(sec);
  });
  const end = h('div', { class: 'story-end' }, h('p', null, '故事到這裡。'), h('a', { class: 'hbtn primary', href: '#explore' }, svg(ICONS.walk), h('span', null, '自己走進方舟')));
  root.append(hero, scenesWrap, end);
  reveal(root.querySelectorAll('.scard'), '0px 0px -8% 0px');

  // ---------------------------------------------------------------- 進度軌
  const dots = SCENES.map((s, i) => h('button', { class: 'dot', type: 'button', 'aria-label': `第 ${i + 1} 幕：${s.title}` }, h('span', null, s.title)));
  const fill = h('i', { class: 'rail-fill' });
  const rail = h('nav', { class: 'srail', 'aria-label': '故事進度' }, fill, ...dots);
  document.body.append(rail);
  const goTo = (i: number) => {
    // 落在這一幕轉場剛結束的位置（畫面中線 = 區塊頂端 + 高度 × 0.34）
    const r = secs[i].getBoundingClientRect();
    stopAuto();
    smoothScrollTo(r.top + scrollY + r.height * 0.34 - innerHeight * 0.5);
  };
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i + 1)));
  startBtn.addEventListener('click', () => goTo(1));
  hero.querySelector('.scroll-cue')!.addEventListener('click', () => goTo(1));

  // ---------------------------------------------------------------- 尺寸標籤
  const dimText: [string, [number, number, number]][] = [
    ['長 300 肘・約 135 公尺', [0, 2.2, -22]],
    ['高 30 肘・約 13.5 公尺', [80, 7, -12]],
    ['寬 50 肘・約 22.5 公尺', [-79, 1.4, 4]],
  ];
  dimText.forEach(([t, at]) => {
    const el = h('div', { class: 'dimlabel' }, t);
    labels.append(el);
    engine.addDimLabel(el, at);
  });

  // ---------------------------------------------------------------- 捲動 → 進度
  let current = -1;
  function measure() {
    const mid = scrollY + innerHeight * 0.5;
    let P = 0;
    for (let i = 0; i < secs.length; i++) {
      const r = secs[i].getBoundingClientRect();
      const top = r.top + scrollY, hgt = r.height;
      if (mid >= top) P = i + Math.min(0.999, (mid - top) / hgt);
    }
    engine.setProgress(P);
    const idx = Math.floor(P) - 1;
    if (idx !== current) {
      current = idx;
      dots.forEach((d, k) => {
        d.classList.toggle('on', k === idx);
        d.classList.toggle('past', k < idx);
      });
      secs.forEach((s, k) => s.classList.toggle('now', k === idx + 1));
    }
    fill.style.transform = `scaleY(${Math.max(0, Math.min(1, (P - 1) / (SCENES.length - 0.001)))})`;
    rail.classList.toggle('show', P > 0.9 && P < SCENES.length + 1);
  }
  // 手機上卡片停在畫面下半，這一幕結束時卡片會被推著往上滑，蓋住上半部的 3D 畫面；
  // 卡片一離開停住的位置就淡出，不讓它滑過上半部
  const narrow = matchMedia('(max-width: 760px)');
  const cards = [...root.querySelectorAll<HTMLElement>('.scard')];
  function fadeCards() {
    const stuck = innerHeight * 0.46;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const v = narrow.matches ? Math.max(0, Math.min(1, 1 - (stuck - r.top - 2) / 56)) : 1;
      c.style.setProperty('--fade', v.toFixed(2));
    }
  }
  addEventListener('scroll', () => { measure(); fadeCards(); }, { passive: true });
  addEventListener('resize', () => { measure(); fadeCards(); });
  measure();
  fadeCards();

  // ---------------------------------------------------------------- 自動播放：勻速往下捲，碰到就停
  let auto = 0;
  let autoLast = 0;
  const SECONDS_PER_SCENE = 11;
  const emitAuto = () => document.dispatchEvent(new CustomEvent('auto-change', { detail: !!auto }));
  function stopAuto() {
    if (!auto) return;
    cancelAnimationFrame(auto);
    auto = 0;
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.replaceChildren(svg(ICONS.play), h('span', null, '自動播放'));
    document.body.classList.remove('autoplay');
    emitAuto();
  }
  function stepAuto(now: number) {
    const dt = Math.min(0.05, (now - autoLast) / 1000);
    autoLast = now;
    const sceneH = secs[1].getBoundingClientRect().height;
    scrollBy(0, (sceneH / SECONDS_PER_SCENE) * dt * (motionOff() ? 3 : 1));
    const endTop = end.getBoundingClientRect().top;
    if (endTop < innerHeight * 0.5) return stopAuto();
    auto = requestAnimationFrame(stepAuto);
  }
  /** 播放；已在播就暫停。還沒進故事就從第一幕開始，故事看完了就從頭再來 */
  function startAuto() {
    if (auto) return stopAuto();
    const endTop = end.getBoundingClientRect().top;
    if (scrollY < secs[1].offsetTop - innerHeight || endTop < innerHeight * 0.6) {
      const r = secs[1].getBoundingClientRect();
      scrollTo(0, r.top + scrollY + r.height * 0.05 - innerHeight * 0.5);
    }
    autoLast = performance.now();
    auto = requestAnimationFrame(stepAuto);
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.replaceChildren(svg(ICONS.pause), h('span', null, '暫停'));
    document.body.classList.add('autoplay');
    emitAuto();
  }
  playBtn.addEventListener('click', startAuto);
  // 使用者自己捲動就暫停；播放鍵本身不算
  for (const evn of ['wheel', 'touchstart', 'pointerdown'] as const) {
    addEventListener(evn, (e) => {
      if (!auto) return;
      if (evn !== 'wheel' && (e.target as HTMLElement).closest?.('.hbtn, .playtool')) return;
      stopAuto();
    }, { passive: true });
  }
  // 空白鍵：播放／暫停（焦點在按鈕、輸入框時不攔）
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === ' ' && !t.closest('button, a, input, textarea, select, summary, [contenteditable]') && !document.body.classList.contains('exploring')) {
      e.preventDefault();
      startAuto();
      return;
    }
    if (auto && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) stopAuto();
  });

  const syncSound = () => {
    const on = sound.on;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.replaceChildren(svg(on ? ICONS.sound : ICONS.mute), h('span', null, on ? '關聲音' : '開聲音'));
  };
  soundBtn.addEventListener('click', async () => {
    await sound.toggle();
    syncSound();
    document.dispatchEvent(new CustomEvent('sound-change'));
  });
  document.addEventListener('sound-change', syncSound);

  return {
    loadProgress(v: number, ready: boolean) {
      loadbar.querySelector('i')!.setAttribute('style', `transform: scaleX(${v})`);
      loadbar.querySelector('span')!.textContent = ready ? (v >= 1 ? '準備好了' : `方舟已就位，動物陸續抵達…`) : `正在準備方舟… ${Math.round(v * 100)}%`;
      loadbar.classList.toggle('done', v >= 1);
    },
    startAuto,
    stopAuto,
  };
}
