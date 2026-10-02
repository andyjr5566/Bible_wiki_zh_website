import type { Scene } from '../data/story';
import { h } from './dom';
import { badge } from './evidence';
import { STATUS_HELP } from './meta';
import { kicker, sceneHref, sceneNav } from './shell';
import { LICENSE_NAME, SILHOUETTES, sil } from './sil';

/** 原型階段：還沒做好的幕，先說明這一幕會放什麼 */
export function buildPlaceholder(s: Scene): HTMLElement {
  return h('article', { class: 'scene scene-soon', style: `--c:${s.color}` },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' }, h('div', { class: 'kicker' }, kicker(s.id)), h('h1', null, s.short)),
      h('div', { class: 'card soon-card' },
        h('p', null, h('b', null, '這一幕還在做。'), '利未記 11–15 章的五幕已經完成，這一幕是最後收尾的部分。'),
        h('p', { style: 'margin-top:12px' }, '這一幕會放：'),
        h('ul', null, ...(s.plan ?? []).map((t) => h('li', null, t)))),
      sceneNav(s.id)));
}

export function buildAbout(): HTMLElement {
  const credits = Object.entries(SILHOUETTES).map(([id, d]) => h('li', { class: 'credit' },
    sil(id), h('span', null, h('i', null, d.name), '：', d.attribution, '，', h('a', { href: d.license, rel: 'noopener' }, LICENSE_NAME(d.license)), '，',
      h('a', { href: d.page, rel: 'noopener' }, 'PhyloPic'))));
  return h('article', { class: 'scene' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' }, h('div', { class: 'kicker' }, '關於'), h('h1', null, '這個網站怎麼做的')),
      h('div', { class: 'about-grid' },
        h('div', { class: 'card' }, h('h3', null, '標記'), h('p', null, '沒有標記的句子，經文直接這樣寫。其他三種：'),
          h('div', { class: 'evlist' }, ...(['synthesis', 'not_stated', 'interpretation'] as const).map((st) => h('div', null, badge(st), ' ', STATUS_HELP[st])))),
        h('div', { class: 'card' }, h('h3', null, '故事和人物'),
          h('p', null, '我們用一家人為例子，每一章看他們碰到一件事。這家人是虛構的，但他們怎麼處理，都照經文的規矩，旁邊附上經節。帳棚擺在哪裡、那天煮什麼這類細節，經文沒有交代，只是畫面的佈景。')),
        h('div', { class: 'card' }, h('h3', null, '資料從哪裡來'),
          h('p', null, '經文：和合本，取自本知識庫的 raw_scripture。'),
          h('p', null, '註釋家的讀法：取自本知識庫《利未記》11–15 章主檔的「本章整理」，那些整理讀過四套註釋：CT、GT（ccbiblestudy 的兩套）、KC（KingComments）、BH（BibleHub Study）。引號裡的話是中文註釋的原話；KC 和 BH 是英文來源，網站只轉述，不加引號。'),
          h('p', null, '原文與詞義：STEP Bible／STEPBible-Data（',
            h('a', { href: 'https://github.com/STEPBible/STEPBible-Data', rel: 'noopener' }, 'github.com/STEPBible/STEPBible-Data'),
            '），依 ', h('a', { href: 'https://creativecommons.org/licenses/by/4.0/', rel: 'noopener' }, 'CC BY 4.0'), ' 授權。辭典列的是可能的義域，不等於這一節的意思。')),
        h('div', { class: 'card' }, h('h3', null, '圖和模型'),
          h('p', null, '3D 營地是示意：會幕院子依出埃及記 26–30 章的尺寸建模，四周帳棚的數目、間距、這一家的位置都不按比例。祭物和動作用符號表示，不畫寫實的畫面。'),
          h('p', null, '動物剪影只畫原文和和合本都認得出來的動物；飛鳥和多數爬物的名稱，各譯本、辭典的認定不一，所以只列名稱，不配圖。')),
        h('div', { class: 'card' }, h('h3', null, '自動檢查'),
          h('p', null, '網站建置前會自動比對：每一段引號裡的經文都必須逐字出現在所引的經節；每一句註釋家原話都必須逐字出現在主檔的引號裡。對不上，網站就不會建置。')),
        h('div', { class: 'card' }, h('h3', null, '同一系列'),
          h('p', null, '前面九章（五種祭、祭司承接聖職）：'),
          h('a', { href: '../../第1章/dist/index.html' }, '會幕前的一天：利未記 1–9 章'))),
      h('section', { class: 'layer' }, h('h2', { class: 'layer-title' }, '動物剪影的作者與授權'),
        h('ul', { class: 'credits' }, ...credits)),
      h('p', { style: 'margin-top:24px' }, h('a', { href: sceneHref('intro') }, '回到序幕'))));
}
