import {
  BIRDS, BIRD_RULE, CONTACT, CREEPERS, CREEP_EIGHT, CREEP_RULE, HEBREW_11, INSECTS, INSECT_EXCEPT, INSECT_RULE, KITCHEN, LAND, LAND_EXTRA,
  LAND_RULE, LINK_10_10, NAME_NOTES, NT_11, SEPARATE, VERDICT_LABEL, VOICES_11, WATER_NAMES, WATER_NO, WATER_RULE, WHY,
  type KitchenThing, type NamedCreature,
} from '../data/ch11';
import { REEL_11 } from '../data/reels';
import { fill, h, svg } from './dom';
import { factLine, quoteLine, refChip, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { answerBridge, layer, readingMore, study } from './common';
import { mountReel } from './reel';
import { kicker, sceneHref, sceneNav } from './shell';
import { sil } from './sil';

const yes = (on: boolean, label: string) => h('span', { class: `crit ${on ? 'ok' : 'no'}` }, svg(ICONS[on ? 'check' : 'x']), label);

/* ------------------------------------------------------------ 圖鑑 */

function landPanel(): HTMLElement {
  const cards = LAND.map((a) => {
    const card = h('button', { class: `beast card v-${a.verdict}`, type: 'button', 'aria-pressed': 'false', 'aria-label': `${a.name}：猜猜看可不可以吃` },
      h('span', { class: 'beast-art' }, a.sil ? sil(a.sil) : svg(ICONS.paw)),
      h('b', { class: 'beast-name' }, a.name),
      h('span', { class: 'beast-guess' }, '？'),
      h('span', { class: 'beast-crit' }, yes(a.hoof, '蹄分兩瓣'), yes(a.cud, '倒嚼')),
      h('span', { class: 'stamp' }, VERDICT_LABEL[a.verdict]));
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.ref')) return;
      const on = card.getAttribute('aria-pressed') !== 'true';
      card.setAttribute('aria-pressed', String(on));
      foot.replaceChildren(factLine(a.fact, { quote: true }));
    });
    return card;
  });
  const foot = h('div', { class: 'beast-foot' }, '點一張卡，先猜，再翻開看經文怎麼說。');
  const all = h('button', { class: 'chipbtn', type: 'button', onclick: () => cards.forEach((c) => c.setAttribute('aria-pressed', 'true')) }, '全部翻開');
  return h('div', { class: 'guide-panel' },
    h('p', { class: 'guide-rule' }, quoteLine(LAND_RULE)),
    h('div', { class: 'guide-tools' }, h('span', { class: 'legend' }, yes(true, '有'), yes(false, '沒有')), all),
    h('div', { class: 'beasts' }, ...cards),
    foot,
    h('ul', { class: 'key-lines' }, ...LAND_EXTRA.map((f) => h('li', null, factLine(f)))),
    voiceBlock(VOICES_11.pair),
    study('為什麼沙番和兔子算「倒嚼」', voiceBlock(VOICES_11.sight), voiceBlock(VOICES_11.hyrax),
      h('p', { class: 'study-p' }, factLine(HEBREW_11[3]))));
}

function waterPanel(): HTMLElement {
  return h('div', { class: 'guide-panel' },
    h('p', { class: 'guide-rule' }, quoteLine(WATER_RULE)),
    h('div', { class: 'water' },
      h('div', { class: 'fishcard card v-clean' }, sil('fish', 'fish'), h('span', { class: 'beast-crit' }, yes(true, '有翅'), yes(true, '有鱗')), h('span', { class: 'stamp' }, '可以吃')),
      h('div', { class: 'fishcard card v-detest dashed' }, h('span', { class: 'fish-ghost' }, sil('fish', 'fish')), h('span', { class: 'beast-crit' }, yes(false, '無翅'), yes(false, '無鱗')), h('span', { class: 'stamp' }, '可憎'),
        h('small', null, '經文沒有點名是哪些'))),
    h('ul', { class: 'key-lines' }, h('li', null, factLine(WATER_NO, { quote: true })), h('li', null, factLine(WATER_NAMES))));
}

function namesGrid(list: NamedCreature[], numbered = true): HTMLElement {
  return h('ol', { class: `names${numbered ? ' numbered' : ''}` }, ...list.map((c) => h('li', { class: 'name-tile' },
    h('b', null, c.zh), refChip(c.ref, c.zh),
    h('span', { class: 'he-row' }, h('span', { class: 'he', lang: 'he', dir: 'rtl' }, c.he), h('small', null, c.tr)),
    h('span', { class: 'gloss-row' }, h('small', null, 'STEP 本節譯義'), h('span', { lang: 'en' }, c.gloss), c.lex !== c.gloss ? h('small', { class: 'lex' }, `辭典：${c.lex}`) : null))));
}

function birdPanel(): HTMLElement {
  return h('div', { class: 'guide-panel' },
    h('div', { class: 'guide-split' },
      h('div', null,
        h('p', { class: 'guide-rule' }, factLine(BIRD_RULE)),
        voiceBlock(VOICES_11.birds)),
      h('div', { class: 'guide-art' }, sil('raven'), sil('bat'))),
    h('p', { class: 'names-cap' }, '二十種，照經文的次序。名單裡最後一種是蝙蝠。打開研經模式，每一格會加上原文和 STEP 的詞義。'),
    namesGrid(BIRDS),
    study('譯名對照', ...NAME_NOTES.map((f) => h('p', { class: 'study-p' }, factLine(f)))));
}

function insectPanel(): HTMLElement {
  return h('div', { class: 'guide-panel' },
    h('div', { class: 'guide-split' },
      h('div', null,
        h('p', { class: 'guide-rule' }, quoteLine(INSECT_RULE)),
        h('p', { class: 'guide-rule except' }, h('span', { class: 'except-tag' }, '例外'), quoteLine(INSECT_EXCEPT))),
      h('div', { class: 'guide-art' }, sil('locust'))),
    namesGrid(INSECTS, false),
    voiceBlock(VOICES_11.locust));
}

function creepPanel(): HTMLElement {
  return h('div', { class: 'guide-panel' },
    h('p', { class: 'guide-rule' }, quoteLine(CREEP_RULE)),
    h('div', { class: 'gaits' },
      h('div', { class: 'gait card' }, sil('snake'), h('b', null, '用肚子行走的')),
      h('div', { class: 'gait card' }, sil('lizard'), h('b', null, '用四足行走的')),
      h('div', { class: 'gait card' }, h('span', { class: 'gait-ico' }, svg(ICONS.q)), h('b', null, '有許多足的'), h('small', null, '經文沒有點名'))),
    h('p', { class: 'names-cap' }, factLine(CREEP_EIGHT)),
    namesGrid(CREEPERS));
}

function fieldGuide(): HTMLElement {
  const tabs: [string, string, () => HTMLElement][] = [
    ['land', '走獸', landPanel], ['water', '水族', waterPanel], ['bird', '飛鳥', birdPanel], ['insect', '有翅膀的爬物', insectPanel], ['creep', '地上的爬物', creepPanel],
  ];
  const panelHost = h('div', { class: 'guide-host', role: 'tabpanel' });
  const built = new Map<string, HTMLElement>();
  const bar = h('div', { class: 'guide-tabs', role: 'tablist', 'aria-label': '動物分類' });
  const pick = (id: string) => {
    const t = tabs.find((x) => x[0] === id)!;
    if (!built.has(id)) built.set(id, t[2]());
    panelHost.replaceChildren(built.get(id)!);
    bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
  };
  for (const [id, label] of tabs) {
    bar.append(h('button', { type: 'button', role: 'tab', 'data-id': id, 'aria-selected': 'false', onclick: () => pick(id) },
      h('span', { class: 'tab-art' }, sil({ land: 'camel', water: 'fish', bird: 'raven', insect: 'locust', creep: 'lizard' }[id]!)), label));
  }
  pick('land');
  return h('div', { class: 'guide card' }, bar, panelHost);
}

/* ------------------------------------------------------------ 廚房 */

const RESULT_TEXT: Record<KitchenThing['result'], string> = {
  break: '要打破', water: '放在水中，到晚上', clean: '仍是潔淨', unclean: '不潔淨', evening: '不潔淨到晚上',
};

function kitchen(): HTMLElement {
  const out = h('div', { class: 'k-out', 'aria-live': 'polite' },
    h('p', { class: 'k-empty' }, '把死蜥蜴拖到一樣東西上，或直接點那樣東西。'));
  const tiles = KITCHEN.map((k) => h('button', { class: 'k-tile', type: 'button', 'data-id': k.id, onclick: () => choose(k) },
    h('span', { class: 'k-ico' }, svg(ICONS[k.icon] ?? ICONS.q)), h('b', null, k.name)));
  function choose(k: KitchenThing) {
    tiles.forEach((t) => t.classList.toggle('on', t.dataset.id === k.id));
    const v = k.id === 'clay' ? VOICES_11.clay : k.id === 'spring' ? VOICES_11.spring : null;
    fill(out,
      h('div', { class: `k-verdict r-${k.result}` }, h('small', null, `掉在${k.name}上`), h('b', null, RESULT_TEXT[k.result])),
      h('p', { class: 'k-q' }, quoteLine(k.fact)),
      h('p', { class: 'k-plain' }, k.fact.text),
      v ? voiceBlock(v) : null,
      k.id === 'spring' ? voiceBlock(VOICES_11.springGrace) : null);
    out.classList.remove('pop-in');
    void out.offsetWidth;
    out.classList.add('pop-in');
  }
  // 拖曳：手指或滑鼠拖著死蜥蜴，放開時落在哪一格就算哪一格
  const token = h('div', { class: 'k-token', tabindex: 0, role: 'button', 'aria-label': '死蜥蜴：拖到一樣東西上' }, sil('lizard'), h('small', null, '死蜥蜴'));
  let ghost: HTMLElement | null = null;
  token.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    token.setPointerCapture(e.pointerId);
    ghost = token.cloneNode(true) as HTMLElement;
    ghost.classList.add('k-ghost');
    document.body.append(ghost);
    move(e);
  });
  const hit = (e: PointerEvent) => {
    if (ghost) ghost.style.display = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.k-tile') ?? null;
    if (ghost) ghost.style.display = '';
    return el;
  };
  const move = (e: PointerEvent) => {
    if (!ghost) return;
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    const t = hit(e);
    tiles.forEach((x) => x.classList.toggle('hover', x === t));
  };
  token.addEventListener('pointermove', move);
  token.addEventListener('pointerup', (e) => {
    const t = hit(e);
    ghost?.remove();
    ghost = null;
    tiles.forEach((x) => x.classList.remove('hover'));
    const k = KITCHEN.find((x) => x.id === t?.dataset.id);
    if (k) choose(k);
  });
  token.addEventListener('pointercancel', () => { ghost?.remove(); ghost = null; });
  return h('div', { class: 'kitchen card' },
    h('div', { class: 'k-left' }, token, h('div', { class: 'k-grid' }, ...tiles)),
    out);
}

/* ------------------------------------------------------------ 摸、拿、吃 */

function ladder(): HTMLElement {
  const dot = (on: boolean) => h('span', { class: `dotc ${on ? 'on' : ''}`, 'aria-label': on ? '要' : '不用' }, on ? '●' : '—');
  return h('div', { class: 'ladder card' },
    h('table', { class: 'ladder-t' },
      h('thead', null, h('tr', null, h('th', null, '做了什麼'), h('th', null, '對象'), h('th', null, '不潔淨到晚上'), h('th', null, '還要洗衣服'), h('th', null, '經文'))),
      h('tbody', null, ...CONTACT.map((c) => h('tr', null,
        h('td', { class: 'verb' }, c.verb), h('td', null, c.what), h('td', null, dot(c.evening)), h('td', null, dot(c.wash)),
        h('td', null, ...refChips(c.fact.refs, c.fact.q)))))),
    voiceBlock(VOICES_11.carry));
}

/* ------------------------------------------------------------ 這一幕 */

export function buildC11(): HTMLElement {
  const reel = mountReel(REEL_11);
  const keys = h('div', { class: 'keys' },
    h('div', { class: 'key card' }, h('h3', null, '四類動物，四種分法'),
      h('ul', { class: 'key-lines' },
        h('li', null, '走獸看兩個條件：蹄分兩瓣，又倒嚼 ', ...refChips(['利11:3'])),
        h('li', null, '水族看兩樣：有翅、有鱗 ', ...refChips(['利11:9'])),
        h('li', null, '飛鳥沒有條件，只有一份二十種的名單 ', ...refChips(['利11:13-19'])),
        h('li', null, '有翅膀的爬物一律可憎，只有蹦跳的例外 ', ...refChips(['利11:20-22'])))),
    h('div', { class: 'key card' }, h('h3', null, '碰到死的'),
      h('ul', { class: 'key-lines' },
        h('li', null, '摸了，不潔淨到晚上 ', ...refChips(['利11:24'])),
        h('li', null, '拿了，還要洗衣服 ', ...refChips(['利11:25'])),
        h('li', null, '器物看材質：瓦器打破，木器泡水 ', ...refChips(['利11:32-33'])),
        h('li', null, '泉源、水池、乾的種子仍是潔淨 ', ...refChips(['利11:36-37'])))),
    h('div', { class: 'key card wide why' }, h('h3', null, '為什麼'),
      h('p', { class: 'why-q' }, `「${WHY.q}」`),
      h('p', null, factLine(WHY)),
      h('p', null, factLine(LINK_10_10, { quote: true }), ' ', factLine(SEPARATE))));

  const bridge = answerBridge({ id: 'mother', label: '母親回答女兒' },
    '「經文都寫了，我們一樣一樣看。先看哪些動物可以吃，再看碰到死的要怎麼辦。最後經文自己說了為什麼要這樣分。」', reel.el, keys);

  return h('article', { class: 'scene', style: '--c:var(--c11)' },
    h('div', { class: 'wrap' }, h('header', { class: 'scene-head' },
      h('div', { class: 'kicker' }, kicker('c11')),
      h('h1', null, '吃什麼、碰到死的'),
      h('p', { class: 'lede' }, '這一章先講哪些動物可以吃，再講碰到動物的屍體要怎麼處理。我們從這家人的一頓晚飯看起。'))),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      layer('重點', '母親說的三件事', keys),
      layer('圖鑑：什麼可以吃', '剪影只畫原文和和合本都認得出來的動物', fieldGuide()),
      layer('死了掉進來怎麼辦', '利11:32-38：同一隻死蜥蜴，掉在不同的東西上，結果不一樣', kitchen()),
      layer('摸、拿、吃', '拿和吃，比摸多一道洗衣服的手續', ladder()),
      layer('今天怎麼讀', '新約裡的一句話',
        h('div', { class: 'nt card' }, h('span', { class: 'nt-tag' }, '新約'), h('p', null, factLine(NT_11, { quote: true })))),
      study('原文裡看得見的事', ...HEBREW_11.slice(0, 3).map((f) => h('p', { class: 'study-p' }, factLine(f))), voiceBlock(VOICES_11.holy)),
      h('div', { class: 'mores' }, readingMore([
        { ch: 11, from: 1, to: 23, title: '利未記 11:1-23：可吃與不可吃' },
        { ch: 11, from: 24, to: 40, title: '利未記 11:24-40：碰到死的' },
        { ch: 11, from: 41, to: 47, title: '利未記 11:41-47：爬物，和全章的理由' },
      ])),
      h('a', { class: 'voices-link card', href: `${sceneHref('voices')}/animals` },
        svg(ICONS.scale), h('span', null, h('b', null, '為什麼偏偏是這些動物？'), h('small', null, '衛生、和異教切割、分類上的「正常」、神的「飲食」、遠離死亡：本章的來源給了五種答案'),
          h('small', null, '全部集中在最後一幕「各家怎麼讀」')),
        svg(ICONS.next)),
      sceneNav('c11')));
}
