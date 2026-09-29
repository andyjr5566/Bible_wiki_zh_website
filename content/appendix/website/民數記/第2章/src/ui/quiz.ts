import { MARCH_NUM10 } from '../data/march';
import { CAMPS, SIDE_LABEL, TRIBES, camp, tribe } from '../data/tribes';
import type { Side, TribeId } from '../data/types';
import { fill, h } from './dom';
import { refChips } from './evidence';
import { CAMP_STYLE, SIDE_NAME } from './meta';

const shuffle = <T>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

const sideOf = (id: TribeId): Side => camp(tribe(id).camp).side;

/** 測驗一：十二支派放到東南西北 */
function sideQuiz(): HTMLElement {
  const placed = new Map<TribeId, Side>();
  let held: TribeId | null = null;
  let order = shuffle(TRIBES.map((t) => t.id));
  let msg: (Node | string)[] = ['點一個支派，再點它的方位；也可以直接拖過去。'];
  let shakeId: TribeId | null = null;
  const root = h('div', { class: 'card pad quiz' });

  const chip = (id: TribeId, locked = false) => {
    const t = tribe(id);
    const b = h('button', {
      class: `q-chip${held === id ? ' held' : ''}${locked ? ' ok' : ''}${shakeId === id ? ' shake' : ''}`,
      type: 'button', draggable: locked ? 'false' : 'true', 'data-id': id, disabled: locked,
      'aria-pressed': String(held === id),
      onclick: () => { held = held === id ? null : id; render(); },
      ondragstart: (e: DragEvent) => { e.dataTransfer?.setData('text/plain', id); held = id; },
    }, t.name);
    return b;
  };

  function drop(side: Side, id: TribeId | null) {
    if (!id || placed.has(id)) return;
    const t = tribe(id);
    if (sideOf(id) === side) {
      placed.set(id, side);
      held = null;
      shakeId = null;
      msg = [h('b', null, `${t.name}在${SIDE_NAME[side]}。`), ' ', `${t.name}屬於${camp(t.camp).bannerName}。`, ...refChips([t.campRef], t.placeQ)];
    } else {
      shakeId = id;
      msg = [`${t.name}不在${SIDE_NAME[side]}，再想想。`];
    }
    render();
  }

  function render() {
    const left = order.filter((id) => !placed.has(id));
    const done = placed.size === 12;
    const zone = (side: Side) => {
      const inside = TRIBES.filter((t) => placed.get(t.id) === side);
      return h('div', {
        class: `q-zone z-${side}${held ? ' target' : ''}`, role: 'button', tabindex: 0,
        'aria-label': `${SIDE_NAME[side]}，已放 ${inside.length}／3`,
        onclick: () => drop(side, held),
        onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(side, held); } },
        ondragover: (e: DragEvent) => e.preventDefault(),
        ondrop: (e: DragEvent) => { e.preventDefault(); drop(side, (e.dataTransfer?.getData('text/plain') as TribeId) || held); },
      }, h('span', { class: 'z-name' }, SIDE_LABEL[side]),
      h('span', { class: 'z-items' }, ...inside.map((t) => chip(t.id, true))));
    };
    fill(root,
      h('h3', null, '小測驗一：誰在哪一邊？'),
      h('p', { class: 'muted' }, '把十二個支派放到正確的方位（每一邊三個）。'),
      h('div', { class: 'q-pool', 'aria-label': '還沒放的支派' }, ...(left.length ? left.map((id) => chip(id)) : [h('span', { class: 'muted' }, '全部放好了。')])),
      h('div', { class: 'q-compass' },
        zone('north'), zone('west'),
        h('div', { class: 'q-center' }, '會幕'),
        zone('east'), zone('south')),
      h('div', { class: 'q-msg', 'aria-live': 'polite' }, ...msg),
      done ? h('div', { class: 'q-done' },
        h('b', null, '全部答對。'),
        ...CAMPS.map((c) => h('div', null, h('span', { class: 'omark', 'data-shape': CAMP_STYLE[c.id].shape, style: `--c:${CAMP_STYLE[c.id].color}` }), ` ${SIDE_NAME[c.side]}：`, c.members.map((m) => tribe(m).name).join('、'), ' ', ...refChips([c.sideRef], c.sideQ)))) : null,
      h('button', { class: 'btn', type: 'button', onclick: () => { placed.clear(); held = null; shakeId = null; order = shuffle(order); msg = ['再來一次。']; render(); } }, '重玩'));
  }
  render();
  return root;
}

/** 測驗二：民10 六批出發的先後 */
function orderQuiz(): HTMLElement {
  const steps = MARCH_NUM10;
  let cards = shuffle(steps.map((_, i) => i));
  let next = 0;
  let wrong: number | null = null;
  let msg: (Node | string)[] = ['照民10 上路的先後，一個一個點。'];
  const root = h('div', { class: 'card pad quiz' });

  function render() {
    const done = next === steps.length;
    fill(root,
      h('h3', null, '小測驗二：誰先走？'),
      h('p', { class: 'muted' }, '民10 實際上路一共分六批。從第一批點起。'),
      h('div', { class: 'q-cards' }, ...cards.map((i) => {
        const s = steps[i];
        const rank = i < next ? i + 1 : 0;
        const isDone = i < next;
        return h('button', {
          class: `q-card${isDone ? ' ok' : ''}${wrong === i ? ' shake' : ''}`, type: 'button', disabled: isDone,
          onclick: () => {
            if (i === next) {
              next++; wrong = null;
              msg = [h('b', null, `第 ${next} 批：${s.label}。`), ' ', ...refChips([s.ref], s.q)];
            } else {
              wrong = i;
              msg = ['這一批不是現在走。再看看：誰先、誰跟在後面？'];
            }
            render();
          },
        }, isDone ? h('em', null, String(rank)) : null, h('b', null, s.label), s.carries ? h('small', null, `帶著：${s.carries}`) : null);
      })),
      h('div', { class: 'q-msg', 'aria-live': 'polite' }, ...msg),
      done ? h('div', { class: 'q-done' }, h('b', null, '全部答對。'), ' 注意民2:17 把會幕放在流便營之後；民10 上路時，帳幕先由革順、米拉利抬走，聖物由哥轄抬著跟在流便營後面。') : null,
      h('button', { class: 'btn', type: 'button', onclick: () => { cards = shuffle(cards); next = 0; wrong = null; msg = ['再來一次。']; render(); } }, '重玩'));
  }
  render();
  return root;
}

export function mountQuiz(host: HTMLElement) {
  host.append(h('div', { class: 'quiz-grid' }, sideQuiz(), orderQuiz()));
}
