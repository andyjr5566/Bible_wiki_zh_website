import type { Fact } from '../data/types';
import { fill, h, svg } from './dom';
import { quoteLine } from './evidence';
import { ICONS } from './icons';

export type End = 'clean' | 'unclean' | 'burn' | 'tear' | 'demolish';
export interface Choice {
  label: string;
  facts?: Fact[];
  next?: string;
  end?: End;
}
export interface Node {
  id: string;
  /** 例如「第 7 天」 */
  when: string;
  ask: string;
  choices: Choice[];
}

const END_TEXT: Record<End, string> = { clean: '定為潔淨', unclean: '定為不潔淨', burn: '在火中焚燒', tear: '撕去那一塊', demolish: '拆毀房子' };

/**
 * 一步一步判斷：每選一次，左邊的紀錄多一行（附經文），右邊的圖跟著變。
 * art(nodeId, end) 讓呼叫的人畫自己的圖（皮膚上的斑、衣服）。
 */
export function decide(nodes: Node[], art: (state: string) => SVGElement | HTMLElement, opts: { title: string; startLabel: string }): HTMLElement {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const log = h('ol', { class: 'dc-log' });
  const ask = h('div', { class: 'dc-ask', 'aria-live': 'polite' });
  const pic = h('div', { class: 'dc-art' });
  const reset = h('button', { class: 'chipbtn', type: 'button', onclick: () => start() }, svg(ICONS.reset), '從頭再來');

  function setArt(state: string) {
    pic.replaceChildren(art(state));
  }

  function go(id: string) {
    const n = byId[id];
    setArt(id);
    fill(ask,
      h('span', { class: 'dc-when' }, n.when),
      h('b', null, n.ask),
      h('div', { class: 'dc-choices' }, ...n.choices.map((c) => h('button', { class: 'dc-choice', type: 'button', onclick: () => pick(n, c) }, c.label))));
  }

  function pick(n: Node, c: Choice) {
    log.append(h('li', { class: `dc-step${c.end ? ` end-${c.end}` : ''}` },
      h('span', { class: 'dc-when' }, n.when),
      h('b', null, c.label),
      ...(c.facts ?? []).map((f) => h('span', { class: 'dc-fact' }, quoteLine(f)))));
    if (c.next) go(c.next);
    else if (c.end) {
      setArt(c.end);
      fill(ask, h('div', { class: `dc-end end-${c.end}` }, h('b', null, END_TEXT[c.end])), h('p', { class: 'dc-hint' }, '換一條路試試看：按「從頭再來」。'));
    }
  }

  function start() {
    log.replaceChildren();
    go(nodes[0].id);
  }
  start();

  return h('div', { class: 'dc card' },
    h('div', { class: 'dc-top' }, h('b', null, opts.title), reset),
    h('div', { class: 'dc-body' },
      h('div', { class: 'dc-left' }, h('small', { class: 'dc-cap' }, opts.startLabel), log, ask),
      pic));
}
