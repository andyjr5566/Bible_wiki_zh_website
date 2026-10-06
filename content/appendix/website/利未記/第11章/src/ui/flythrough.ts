import { RETURN } from '../data/story';
import { animOff, h } from './dom';
import { quoteLine } from './evidence';

/**
 * 「怎麼走回來」的鏡頭：Blender 渲染的 100 格畫面（public/images/fly/），
 * 從營外沿著營中的路走進院門，停在會幕門口（利14:3-20 的五站）。
 * 往下捲，鏡頭往前走；每一站的經文疊在畫面上。
 * 鏡頭跟著讀者自己的捲動走，所以和 3D 故事的播放一樣，只看本站的「減少動態」開關（animOff）；
 * 開關打開時改成五張靜止畫面並排，內容一樣。
 */
const FRAMES = 100;
/** 五站各落在第幾格（和 Blender 的鏡頭關鍵格一致） */
const STOPS = [1, 26, 50, 80, 100];
const src = (f: number) => `images/fly/f_${String(f).padStart(4, '0')}.webp`;

export function flythrough(): HTMLElement {
  const steps = RETURN.map((r, i) => h('li', { class: 'fly-step', 'data-i': String(i) },
    h('span', { class: 'fly-n' }, String(i + 1)),
    h('b', null, r.label),
    h('span', { class: 'fly-text' }, r.fact.text),
    h('span', { class: 'fly-q' }, quoteLine(r.fact))));

  if (animOff()) {
    return h('figure', { class: 'fly fly-still' },
      h('ol', { class: 'fly-stills' }, ...STOPS.map((f, i) => h('li', null,
        h('img', { src: src(f), alt: '', loading: 'lazy', decoding: 'async' }), steps[i]))),
      h('figcaption', null, '示意：Blender 渲染的營地，鏡頭從營外走到會幕門口。'));
  }

  const canvas = h('canvas', { class: 'fly-canvas', 'aria-hidden': 'true' });
  const list = h('ol', { class: 'fly-steps' }, ...steps);
  const bar = h('i');
  const sticky = h('div', { class: 'fly-sticky' }, canvas, h('div', { class: 'fly-shade' }), list, h('div', { class: 'fly-prog', 'aria-hidden': 'true' }, bar),
    h('p', { class: 'fly-note' }, '往下捲，鏡頭往前走。示意：Blender 渲染，營地與帳棚數目不按比例。'));
  const el = h('figure', { class: 'fly', 'aria-label': '從營外走回會幕門口的五站' }, sticky);

  const imgs: (HTMLImageElement | undefined)[] = [];
  const load = (f: number) => {
    if (imgs[f]) return imgs[f]!;
    const im = new Image();
    im.decoding = 'async';
    im.src = src(f);
    im.onload = () => { if (f === want) draw(); };
    // 第一格就載不到（例如畫面檔還沒放進來），整段收起來，不留一塊黑畫面
    if (f === 1) im.onerror = () => { el.hidden = true; };
    imgs[f] = im;
    return im;
  };
  let want = 1;
  let shown = -1;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    if (!ctx) return;
    // 想要的那一格還沒載好，就畫最近已經載好的一格
    let f = want;
    for (let d = 0; d < FRAMES; d++) {
      const a = imgs[want - d];
      const b = imgs[want + d];
      if (a?.complete && a.naturalWidth) { f = want - d; break; }
      if (b?.complete && b.naturalWidth) { f = want + d; break; }
    }
    const im = imgs[f];
    if (!im?.complete || !im.naturalWidth || f === shown) return;
    const w = canvas.width;
    const hgt = canvas.height;
    const s = Math.max(w / im.naturalWidth, hgt / im.naturalHeight);
    const dw = im.naturalWidth * s;
    const dh = im.naturalHeight * s;
    ctx.drawImage(im, (w - dw) / 2, (hgt - dh) / 2, dw, dh);
    shown = f;
  };
  const size = () => {
    // 黏在頂列下面：頂列的高度在手機和桌機不一樣，量了再設
    el.style.setProperty('--fly-top', `${document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0}px`);
    const r = sticky.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    shown = -1;
    draw();
  };
  const update = () => {
    const r = el.getBoundingClientRect();
    const total = r.height - sticky.offsetHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    want = Math.round(1 + p * (FRAMES - 1));
    bar.style.width = `${p * 100}%`;
    let cur = 0;
    STOPS.forEach((f, i) => { if (want >= f - 6) cur = i; });
    steps.forEach((s, i) => s.classList.toggle('on', i === cur));
    load(want);
    draw();
  };

  // 進到畫面附近才開始載入；先載五站，再載全部
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    STOPS.forEach(load);
    for (let f = 1; f <= FRAMES; f++) load(f);
    size();
    update();
  }, { rootMargin: '600px 0px' });
  io.observe(el);
  addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  new ResizeObserver(size).observe(sticky);
  return el;
}
