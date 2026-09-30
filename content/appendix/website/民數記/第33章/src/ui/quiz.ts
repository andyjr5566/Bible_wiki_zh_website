import { EVENTS } from '../data/events';
import { station } from '../data/stations';
import { fill, h } from './dom';
import { refChips } from './evidence';

const shuffle = <T>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

/** 測驗一：把七個站排回順序 */
const ORDER_SET = [1, 5, 11, 12, 33, 34, 42];

function orderQuiz(): HTMLElement {
  let cards = shuffle(ORDER_SET);
  let next = 0;
  let wrong: number | null = null;
  let msg: (Node | string)[] = ['從出埃及的第一站點起，一個一個點。'];
  const root = h('div', { class: 'card pad quiz' });

  function render() {
    const done = next === ORDER_SET.length;
    fill(root,
      h('h3', null, '小測驗一：先後'),
      h('p', { class: 'muted' }, '這七站是清單裡的幾個座標。照民33 的先後，從第一站點到最後一站。'),
      h('div', { class: 'q-cards' }, ...cards.map((n) => {
        const st = station(n);
        const rank = ORDER_SET.indexOf(n);
        const isDone = rank < next;
        return h('button', {
          class: `q-card${isDone ? ' ok' : ''}${wrong === n ? ' shake' : ''}`, type: 'button', disabled: isDone,
          onclick: () => {
            if (n === ORDER_SET[next]) {
              next++; wrong = null;
              msg = [h('b', null, `第 ${n} 站：${st.name}。`), ' ', ...refChips([`民33:${st.verse}`], st.q)];
            } else {
              wrong = n;
              msg = ['這一站不是現在。想一想：哪一站在前面？'];
            }
            render();
          },
        }, isDone ? h('em', null, String(n)) : null, h('b', null, st.name), isDone ? h('small', null, `第 ${n} 站`) : null);
      })),
      h('div', { class: 'q-msg', 'aria-live': 'polite' }, ...msg),
      done ? h('div', { class: 'q-done' }, h('b', null, '全部答對。'), ' 蘭塞是第 1 站，摩押平原是第 42 站；亞倫死在第 34 站何珥山。') : null,
      h('button', { class: 'btn', type: 'button', onclick: () => { cards = shuffle(ORDER_SET); next = 0; wrong = null; msg = ['再來一次。']; render(); } }, '重玩'));
  }
  render();
  return root;
}

/** 測驗二：事件發生在哪一站 */
const POOL = EVENTS.filter((e) => e.status === 'explicit').filter((e, i, all) => all.findIndex((x) => x.st === e.st) === i);

function eventQuiz(): HTMLElement {
  const total = 6;
  let qs = shuffle(POOL).slice(0, total);
  let i = 0;
  let score = 0;
  let chosen: number | null = null;
  let options: number[] = [];
  const root = h('div', { class: 'card pad quiz' });

  const makeOptions = () => {
    const cur = qs[i];
    const others = shuffle(POOL.map((e) => e.st).filter((n) => n !== cur.st)).slice(0, 3);
    options = shuffle([cur.st, ...others]);
    chosen = null;
  };
  makeOptions();

  function render() {
    if (i >= total) {
      fill(root,
        h('h3', null, '小測驗二：這件事在哪一站'),
        h('div', { class: 'q-done' }, h('b', null, `答對 ${score}／${total}`), ' 每一題的經節都可以點開看原文。'),
        h('button', { class: 'btn', type: 'button', onclick: () => { qs = shuffle(POOL).slice(0, total); i = 0; score = 0; makeOptions(); render(); } }, '重玩'));
      return;
    }
    const cur = qs[i];
    fill(root,
      h('h3', null, '小測驗二：這件事在哪一站'),
      h('p', { class: 'muted' }, `第 ${i + 1}／${total} 題`),
      h('p', { class: 'q-ask' }, cur.text, '。'),
      h('div', { class: 'q-options' }, ...options.map((n) => h('button', {
        class: `q-opt${chosen !== null && n === cur.st ? ' ok' : ''}${chosen === n && n !== cur.st ? ' bad' : ''}`, type: 'button', disabled: chosen !== null,
        onclick: () => { chosen = n; if (n === cur.st) score++; render(); },
      }, h('em', null, String(n)), station(n).name))),
      chosen !== null ? h('div', { class: 'q-msg', 'aria-live': 'polite' },
        chosen === cur.st ? h('b', null, '答對了。') : h('b', null, `是第 ${cur.st} 站 ${station(cur.st).name}。`), ' ', ...refChips(cur.refs, cur.q)) : h('div', { class: 'q-msg' }, '選一個站。'),
      chosen !== null ? h('button', { class: 'btn primary', type: 'button', onclick: () => { i++; makeOptions(); render(); } }, i + 1 >= total ? '看結果' : '下一題') : null);
  }
  render();
  return root;
}

export function mountQuiz(host: HTMLElement) {
  host.append(h('div', { class: 'quiz-grid' }, orderQuiz(), eventQuiz()));
}
