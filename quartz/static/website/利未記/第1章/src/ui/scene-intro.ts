import { EPIGRAPH } from '../data/entry';
import { OFFERINGS } from '../data/offerings';
import { INTRO, ROADMAP, ROADMAP_FACTS, SCENE_BY_ID } from '../data/story';
import type { OfferingId } from '../data/types';
import { h, on, svg } from './dom';
import { badge, factLine, refChip, refChips } from './evidence';
import { mountCourt } from './court';
import { ICONS } from './icons';
import { OFFERING_STYLE } from './meta';
import { sceneHref, sceneNav } from './shell';
import { omark } from './simulator';

export function buildIntro(): HTMLElement {
  const court = mountCourt();
  on('focus-3d', (node: string) => {
    if (location.hash !== sceneHref('intro')) location.hash = sceneHref('intro');
    setTimeout(() => court.focus(node), 300);
  });

  const beats = h('ol', { class: 'beats' }, ...INTRO.beats.map((b) => h('li', null, factLine(b))));

  const road = h('ol', { class: 'roadmap' }, ...ROADMAP.map((seg, i) => {
    const fact = ROADMAP_FACTS[i];
    return h('li', { class: 'road-seg' },
      h('div', { class: 'road-range' }, seg.range),
      h('h3', null, seg.title),
      h('p', null, seg.text, ' ', ...refChips(fact.refs, fact.q)),
      h('div', { class: 'road-scenes' }, ...seg.scenes.map((id) => {
        const s = SCENE_BY_ID[id];
        const mark = id in OFFERING_STYLE ? omark(id as OfferingId) : null;
        return h('a', { class: `road-chip${s.ready ? '' : ' soon'}`, href: sceneHref(id) }, mark, s.short);
      })));
  }));

  const five = h('div', { class: 'five' }, ...OFFERINGS.map((o) => {
    const s = SCENE_BY_ID[o.id];
    return h('a', { class: `five-card${s.ready ? '' : ' soon'}`, href: sceneHref(o.id), style: `--c:${OFFERING_STYLE[o.id].color}` },
      h('span', { class: 'five-name' }, omark(o.id), o.name, h('small', null, s.range)),
      h('span', { class: 'five-tag' }, o.tagline));
  }));

  const howto = h('div', { class: 'card howto' },
    h('h3', null, svg(ICONS.book), '這個網站怎麼讀'),
    h('ul', null, ...INTRO.howto.map((t) => h('li', null, t))),
    h('div', { class: 'howto-tags' }, badge('synthesis'), badge('not_stated'), badge('interpretation')));

  // 大的 3D 院子當開場畫面，直排標題壓在左上（和前一版一樣）
  court.el.classList.add('hero-court');
  court.el.classList.remove('card');
  court.el.append(h('div', { class: 'hero-title' },
    h('h1', { 'aria-label': '會幕前的一天' }, ...[...'會幕前的一天'].map((c, i) => h('span', { class: 'ch', style: `--i:${i}`, 'aria-hidden': 'true' }, c))),
    h('div', { class: 'epi' }, h('p', { class: 'epigraph' }, `「${EPIGRAPH.text}」`), refChip(EPIGRAPH.ref, EPIGRAPH.text))));

  return h('article', { class: 'scene scene-intro' },
    court.el,
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, '利未記 1–9 章・開場'),
        h('h2', { class: 'intro-h' }, INTRO.title)),
      beats,
      h('section', { class: 'block-s' },
        h('h2', { class: 'layer-title' }, '1–9 章分成五段'),
        road),
      h('section', { class: 'block-s' },
        h('h2', { class: 'layer-title' }, '五種祭，先認個臉', h('small', null, '每一種都有自己的一幕')),
        five),
      h('section', { class: 'block-s' }, howto),
      sceneNav('intro')));
}
