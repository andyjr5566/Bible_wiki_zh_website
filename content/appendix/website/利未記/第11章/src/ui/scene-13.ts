import {
  CLOTH, FOUR_ACTS, HEBREW_13, INSPECT, MOURN_PRIEST, MOURN_SAME, MOURN_SICK, NT_13, REEL_13, SPECIAL, VOICES_13,
} from '../data/ch13';
import type { Fact } from '../data/types';
import { h } from './dom';
import { factLine, quoteLine, refChips, voiceBlock } from './evidence';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

/*
 * 第 13 章的呈現（2026-10 重新編排，內容全部沿用 data/ch13.ts）：
 * 這一章的知識是「一套隨時間走的判斷程序」：第 1 天看、關七天、第 7 天再看、第 14 天再看。
 *   1. 整套程序畫成一張流程圖：橫軸是第 1／7／14 天，皮膚和衣服兩條路並排（節奏一樣，結局不同）
 *      按「父親走的路」，標出 3D 故事裡那一條
 *   2. 特別的情況依判定結果分成「潔淨」「不潔淨」兩欄
 *   3. 確診以後的動作，和利10:6 祭司被禁止的動作，畫成鏡子：同樣兩個字
 */

const C = (id: string) => CLOTH.find((c) => c.id === id)!.fact;

type Out = 'unclean' | 'wait' | 'clean' | 'burn' | 'tear' | 'again';
interface Branch { fact: Fact; out: Out; father?: boolean }
interface Step { when: string; ask: string; branches: Branch[] }

/** 每一欄是一個時間點；欄裡是祭司看的事和分岔 */
const SKIN: Step[] = [
  { when: '第 1 天', ask: '毛變白了嗎？深於皮嗎？', branches: [
    { fact: INSPECT.both, out: 'unclean' }, { fact: INSPECT.shut1, out: 'wait', father: true }] },
  { when: '第 7 天', ask: '斑有沒有擴散？', branches: [
    { fact: INSPECT.spread, out: 'unclean' }, { fact: INSPECT.shut2, out: 'wait', father: true }] },
  { when: '第 14 天', ask: '第三次看', branches: [
    { fact: INSPECT.clean, out: 'clean' }, { fact: INSPECT.spread, out: 'unclean', father: true }] },
  { when: '以後', ask: '定為潔淨以後', branches: [{ fact: INSPECT.later, out: 'again' }] },
];
const CLOTHES: Step[] = [
  { when: '第 1 天', ask: '發綠或發紅的斑', branches: [{ fact: C('see'), out: 'wait' }] },
  { when: '第 7 天', ask: '斑有沒有擴散？', branches: [{ fact: C('spread'), out: 'burn' }, { fact: C('wash'), out: 'wait' }] },
  { when: '第 14 天', ask: '洗過，又過了七天', branches: [{ fact: C('same'), out: 'burn' }, { fact: C('dim'), out: 'tear' }] },
  { when: '以後', ask: '撕去以後', branches: [{ fact: C('back'), out: 'burn' }, { fact: C('gone'), out: 'clean' }] },
];
const OUT_LABEL: Record<Out, string> = { unclean: '不潔淨', wait: '關鎖七天', clean: '潔淨', burn: '燒掉', tear: '撕去', again: '再給祭司看' };

function lane(name: string, sub: string, steps: Step[], id: string): HTMLElement {
  return h('div', { class: 'c13f-lane', 'data-lane': id },
    h('div', { class: 'c13f-lane-name' }, h('b', null, name), h('small', null, sub)),
    ...steps.map((st, i) => h('div', { class: 'c13f-step', style: `--col:${i + 2}` },
      h('div', { class: 'c13f-ask' }, h('small', null, st.when), h('span', null, st.ask)),
      h('ul', { class: 'c13f-branches' }, ...st.branches.map((b) => h('li', { class: `c13f-br o-${b.out}${b.father ? ' father' : ''}` },
        h('span', { class: 'c13f-tag' }, OUT_LABEL[b.out]),
        h('span', { class: 'c13f-text' }, b.fact.text, ' ', ...refChips(b.fact.refs, b.fact.q))))))));
}

function flow(): HTMLElement {
  const heads = h('div', { class: 'c13f-heads', 'aria-hidden': 'true' }, h('span'), ...SKIN.map((s) => h('span', null, s.when)));
  const box = h('div', { class: 'c13f' }, heads,
    lane('皮膚上的斑', '利13:1-46', SKIN, 'skin'),
    lane('衣服、皮子上的斑', '利13:47-59', CLOTHES, 'cloth'));
  const btn = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false' }, '標出父親走的路');
  btn.addEventListener('click', () => {
    const on = box.classList.toggle('show-father');
    btn.setAttribute('aria-pressed', String(on));
  });
  const key = h('div', { class: 'c13f-key' }, ...(['wait', 'again', 'clean', 'unclean', 'burn', 'tear'] as Out[]).map((o) => h('span', { class: `c13f-tag o-${o}` }, OUT_LABEL[o])));
  return h('figure', { class: 'c13f-fig', 'aria-label': '祭司察看的流程：第 1 天看，看不準就關鎖七天；第 7 天、第 14 天再看。皮膚和衣服都照這個節奏，結局不同。' },
    h('div', { class: 'c13f-tools' }, key, btn),
    h('div', { class: 'c13f-scroll' }, box));
}

/** 特別的情況：依判定結果分兩欄 */
function specials(): HTMLElement {
  const col = (v: 'clean' | 'unclean', title: string) => h('div', { class: `c13s-col v-${v}` },
    h('h3', null, title),
    ...SPECIAL.filter((x) => x.verdict === v).map((x) => h('div', { class: 'c13s-item' },
      h('b', null, x.title),
      // 「可是一出現紅肉」是接著「全身都白了」說的，分欄以後指回去
      x.title.startsWith('可是') ? h('small', { class: 'c13s-link' }, `接著左邊「${SPECIAL[SPECIAL.indexOf(x) - 1].title}」`) : null,
      h('p', null, quoteLine(x.fact)),
      x.voice ? voiceBlock(x.voice) : null)));
  return h('div', { class: 'c13s' }, col('clean', '潔淨'), col('unclean', '不潔淨'));
}

/** 確診以後：四個動作；和利10:6 的祭司是同樣兩個字，一邊被命令做，一邊被禁止做 */
function mourning(): HTMLElement {
  return h('div', { class: 'c13m' },
    h('ol', { class: 'c13m-acts' }, ...FOUR_ACTS.map((a) => h('li', null, h('b', null, a.label), ...refChips(a.fact.refs, a.fact.q)))),
    h('div', { class: 'c13m-mirror' },
      h('div', { class: 'c13m-side sick' }, h('small', null, '長大痲瘋的人：要'), h('p', null, quoteLine(MOURN_SICK))),
      h('div', { class: 'c13m-words', 'aria-label': '兩處用的是同樣兩個希伯來字' },
        h('span', null, h('b', { lang: 'he', dir: 'rtl' }, 'פָּרַם'), h('small', null, '撕裂')),
        h('span', null, h('b', { lang: 'he', dir: 'rtl' }, 'פָּרַע'), h('small', null, '蓬頭散髮'))),
      h('div', { class: 'c13m-side priest' }, h('small', null, '祭司（利10:6）：不可'), h('p', null, quoteLine(MOURN_PRIEST)))),
    h('p', { class: 'c13m-note' }, factLine(MOURN_SAME)),
    h('div', { class: 'c13-voices' }, voiceBlock(VOICES_13.mourn), voiceBlock(VOICES_13.breath), voiceBlock(VOICES_13.women)));
}

export function buildC13(): HTMLElement {
  const reel = mountReel(REEL_13);
  const specialsLayer = layer('幾種特別的情況', '有的看起來很嚴重，卻是潔淨的', specials());
  // 女兒在故事最後問「爸爸什麼時候可以回來？」：母親的回答接在故事下面
  const bridge = answerBridge({ id: 'mother', label: '母親回答女兒' },
    '「要等爸爸身上的病好了。病在他身上的日子，他就要一個人住在營外。病好了，祭司會出營去看他；還要照著潔淨的條例一步一步做完，他才能回到營裡，回到我們身邊。」', reel.el, specialsLayer);
  return h('article', { class: 'scene scene-13', style: '--c:var(--c13)' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, kicker('c13')),
        h('h1', null, '祭司察看'),
        h('p', { class: 'lede' }, '這一章五十九節，反覆出現的是同一句話：「祭司要察看」。皮膚上起了斑，該不該定為不潔淨，由祭司照經文的記號來判斷。')),
      layer('祭司怎麼判', '橫軸是日子；皮膚和衣服走同樣的七天節奏，結局不同', flow(),
        h('div', { class: 'c13-voices' }, voiceBlock(VOICES_13.hairWhite), voiceBlock(VOICES_13.twoErrors), voiceBlock(VOICES_13.slow)),
        h('div', { class: 'c13-voices two' }, voiceBlock(VOICES_13.cloth), voiceBlock(VOICES_13.noRite)))),
    h('div', { class: 'wrap' }, layer('父親的例子', '第 1 天關鎖、第 7 天再關、第 14 天擴散了', null)),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      specialsLayer,
      layer('確診以後', '四個動作，都是喪禮上的動作', mourning()),
      layer('今天怎麼讀', '新約裡的一句話', ntCard(h('p', null, factLine(NT_13, { quote: true })), voiceBlock(VOICES_13.outsideBH))),
      study('原文裡看得見的事', ...HEBREW_13.map((f) => h('p', { class: 'study-p' }, factLine(f))), voiceBlock(VOICES_13.heal)),
      h('div', { class: 'mores' }, readingMore([
        { ch: 13, from: 1, to: 46, title: '利未記 13:1-46：人身上的災病' },
        { ch: 13, from: 47, to: 59, title: '利未記 13:47-59：衣服上的災病' },
      ])),
      voicesLink('這到底是什麼病？染上了，是不是因為犯罪？', '今天的痲瘋病（漢森氏病）和經文寫的不一樣；有的註釋說不等於罪，有的讀成罪的圖畫。各家並陳', 'leprosySin'),
      sceneNav('c13')));
}
