import type { Scene, SceneId } from '../data/story';
import type { OfferingId } from '../data/types';
import { h } from './dom';
import { TWO_BIRDS_VOICE } from '../data/debates';
import { EIGHTH_DAY_ORDER_VOICES } from '../data/priesthood';
import { badge, interpHeading, voiceBlock } from './evidence';
import { mountDebates } from './debates';
import { OFFERING_STYLE, STATUS_HELP } from './meta';
import { sceneHref, sceneNav } from './shell';
import { omark } from './simulator';

const head = (kicker: string, title: string, mark?: HTMLElement | null, lede?: string) => h('header', { class: 'scene-head' },
  h('div', { class: 'kicker' }, kicker),
  h('h1', null, mark ?? null, title),
  lede ? h('p', { class: 'lede' }, lede) : null);

/** 原型階段：還沒做好的幕，先說明這一幕會放什麼 */
export function buildPlaceholder(s: Scene): HTMLElement {
  const mark = s.id in OFFERING_STYLE ? omark(s.id as OfferingId) : null;
  return h('article', { class: 'scene scene-soon' },
    h('div', { class: 'wrap' },
      head(s.range || '附錄', s.short, mark),
      h('div', { class: 'card soon-card' },
        h('p', null, h('b', null, '這一幕還在做。'), '這一版原型先完成「開場」和「燔祭」兩幕，確定方向對了，再照同樣的版型做完其他幕。'),
        h('p', { style: 'margin-top:12px' }, '這一幕會放：'),
        h('ul', null, ...(s.plan ?? []).map((t) => h('li', null, t)))),
      sceneNav(s.id)));
}

export function buildVoices(): HTMLElement {
  const host = h('div');
  mountDebates(host);
  return h('article', { class: 'scene scene-voices' },
    h('div', { class: 'wrap' },
      head('附錄', '各家怎麼讀', null,
        '前面各幕只講經文寫了什麼。經文沒有給理由、或讀法不一的地方，四套註釋的看法都收在這裡，網站不替它們下結論。'),
      host,
      h('h3', { style: 'margin-top:30px' }, '其他兩處讀法'),
      h('div', { class: 'deb-grid', style: 'margin-top:10px' },
        h('div', { class: 'card', style: 'padding:14px 16px;border-top:3px solid var(--priest)' },
          h('h3', { style: 'font-size:1.02em' }, '第八天為什麼先為自己、再為百姓？'), interpHeading(), ...EIGHTH_DAY_ORDER_VOICES.map(voiceBlock)),
        h('div', { class: 'card', style: 'padding:14px 16px;border-top:3px solid var(--sin)' },
          h('h3', { style: 'font-size:1.02em' }, '窮人贖罪，為什麼要帶「兩隻」鳥？'), interpHeading(), voiceBlock(TWO_BIRDS_VOICE))),
      sceneNav('voices')));
}

export function buildAbout(): HTMLElement {
  return h('article', { class: 'scene' },
    h('div', { class: 'wrap' },
      head('關於', '這個網站怎麼做的'),
      h('div', { class: 'about-grid' },
        h('div', { class: 'card' }, h('h3', null, '標記'), h('p', null, '沒有標記的句子，經文直接這樣寫。其他三種：'),
          h('div', { class: 'evlist' }, ...(['synthesis', 'not_stated', 'interpretation'] as const).map((st) => h('div', null, badge(st), ' ', STATUS_HELP[st])))),
        h('div', { class: 'card' }, h('h3', null, '資料從哪裡來'),
          h('p', null, '經文：和合本，取自本知識庫的 raw_scripture。點任何經節（例如 利1:5）都會顯示經文，引號裡的摘句會標出來。'),
          h('p', null, '註釋家的讀法：取自本知識庫《利未記》1–9 章主檔的「本章整理」，那些整理讀過四套註釋：CT、GT（ccbiblestudy 的兩套）、KC（KingComments）、BH（BibleHub Study）。引號裡的話都是註釋家原話，沒有引號的是轉述。')),
        h('div', { class: 'card' }, h('h3', null, '圖和模型'),
          h('p', null, '流程地圖是示意圖，未按比例；方位照出埃及記 27、40 章。祭物用符號和標籤表示，不畫寫實的宰殺畫面。'),
          h('p', null, '3D 院子用 Blender 依出埃及記 26–30 章的尺寸建模：院子 100×50 肘、燔祭壇 5×5×3 肘、香壇 1×1×2 肘。經文沒給尺寸的部分（會幕的外觀、洗濯盆的形狀）都是示意重建。')),
        h('div', { class: 'card' }, h('h3', null, '自動檢查'),
          h('p', null, '網站建置前會自動比對：每一段引號裡的經文都必須逐字出現在所引的經節；每一句註釋家原話都必須逐字出現在主檔的引號裡。對不上，網站就不會建置。')),
        h('div', { class: 'card' }, h('h3', null, '同一系列'),
          h('p', null, '這座會幕是怎麼造的，尺寸和材料在出埃及記 25–27 章：'),
          h('a', { href: '../../../出埃及記/第25章/dist/index.html' }, '照山上的樣式：出埃及記 25–27 章')),
      ),
      h('p', { style: 'margin-top:24px' }, h('a', { href: sceneHref('intro') }, '回到開場'))));
}

export type { SceneId };
