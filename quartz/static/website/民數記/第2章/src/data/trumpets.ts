import type { Fact, Ref, Side } from './types';

/**
 * 民10:1-10 的號聲。只收經文記了的：
 * - 兩枝齊吹、單吹一枝（招聚，不吹大聲）
 * - 第一次吹大聲→東邊的營起行；二次吹大聲→南邊的營起行
 * 西邊、北邊沒有記載號聲；網站不替它補。
 */
export type SignalId = 'both' | 'one' | 'alarm1' | 'alarm2';

export interface Signal {
  id: SignalId;
  /** 幾枝號、什麼聲 */
  how: string;
  /** 畫面上的名稱 */
  label: string;
  /** 誰聽到要動 */
  effect: string;
  /** 對應的營：只有起行號有 */
  camp?: Side;
  ref: Ref;
  q: string;
  status: 'explicit';
}

export const SIGNALS: Signal[] = [
  { id: 'both', how: '兩枝齊吹，不吹大聲', label: '兩枝齊吹', effect: '全會眾到會幕門口聚集', ref: '民10:3', q: '吹這號的時候，全會眾要到你那裡，聚集在會幕門口', status: 'explicit' },
  { id: 'one', how: '單吹一枝，不吹大聲', label: '單吹一枝', effect: '眾首領（以色列軍中的統領）到摩西那裡聚集', ref: '民10:4', q: '若單吹一枝，眾首領，就是以色列軍中的統領，要聚集到你那裡', status: 'explicit' },
  { id: 'alarm1', how: '吹出大聲', label: '吹出大聲', effect: '東邊安的營起行', camp: 'east', ref: '民10:5', q: '吹出大聲的時候，東邊安的營都要起行', status: 'explicit' },
  { id: 'alarm2', how: '二次吹出大聲', label: '二次吹出大聲', effect: '南邊安的營起行', camp: 'south', ref: '民10:6', q: '二次吹出大聲的時候，南邊安的營都要起行', status: 'explicit' },
];

export const signal = (id: SignalId): Signal => SIGNALS.find((s) => s.id === id)!;

/** 一種號聲的事實列，畫面與資料閘門共用 */
export const signalFact = (s: Signal): Fact => ({ text: `${s.how}：${s.effect}`, status: s.status, refs: [s.ref], q: s.q });

/** 西、北兩營：經文沒有記他們的號聲 */
export const WEST_NORTH_SILENT: Fact = {
  text: '西邊、北邊的營要怎樣吹號才起行，民10 沒有記載',
  status: 'not_stated',
  refs: ['民10:5-6'],
  note: '經文只記了東、南兩次大聲。網站不補第三、第四聲。',
};

export const TRUMPET_FACTS: Fact[] = [
  { text: '做兩枝銀號，都要錘出來的', status: 'explicit', refs: ['民10:2'], q: '你要用銀子做兩枝號，都要錘出來的' },
  { text: '用來招聚會眾，並叫眾營起行', status: 'explicit', refs: ['民10:2'], q: '用以招聚會眾，並叫眾營起行' },
  { text: '招聚會眾的時候要吹，卻不要吹出大聲', status: 'explicit', refs: ['民10:7'], q: '招聚會眾的時候，你們要吹號，卻不要吹出大聲' },
  { text: '吹號的是亞倫子孫作祭司的，是世世代代永遠的定例', status: 'explicit', refs: ['民10:8'], q: '亞倫子孫作祭司的要吹這號' },
  { text: '與仇敵打仗，要用號吹出大聲，就在神面前得蒙紀念、蒙拯救', status: 'explicit', refs: ['民10:9'], q: '便在耶和華─你們的神面前得蒙紀念，也蒙拯救脫離仇敵' },
  { text: '快樂的日子、節期和月朔獻燔祭、平安祭時也要吹號，作為紀念', status: 'explicit', refs: ['民10:10'], q: '獻燔祭和平安祭，也要吹號' },
];
