import type { Fact, OfferingId } from './types';

/**
 * 首頁的填空句：「我帶著＿＿來到會幕門口，因為＿＿。」
 * 組合合乎經文就導到對應的分支；不合就用經文說明為什麼。
 */

const f = (text: string, status: Fact['status'], refs: string[] = [], q?: string): Fact => ({ text, status, refs, q });

export const BRING = [
  { id: 'bull', label: '一頭公牛' },
  { id: 'cow', label: '一頭母牛' },
  { id: 'ram', label: '一隻公綿羊' },
  { id: 'ewe', label: '一隻母綿羊羔' },
  { id: 'he-goat', label: '一隻公山羊' },
  { id: 'she-goat', label: '一隻母山羊' },
  { id: 'birds', label: '斑鳩或雛鴿' },
  { id: 'flour', label: '一份細麵' },
] as const;

export const WHY = [
  { id: 'gift', label: '想獻給耶和華，沒有特別的事' },
  { id: 'thanks', label: '要感謝' },
  { id: 'vow', label: '要還願' },
  { id: 'free', label: '甘心樂意' },
  { id: 'sin-people', label: '我誤犯了耶和華吩咐不可行的事' },
  { id: 'sin-ruler', label: '我是官長，誤犯了罪' },
  { id: 'sin-priest', label: '我是受膏的祭司，犯了罪' },
  { id: 'holy', label: '我在耶和華的聖物上有了差錯' },
  { id: 'neighbor', label: '我虧負了鄰舍' },
] as const;

export type BringId = (typeof BRING)[number]['id'];
export type WhyId = (typeof WHY)[number]['id'];

export type EntryResult =
  | { ok: true; offering: OfferingId; pick: Record<string, string>; fact: Fact }
  | { ok: false; fact: Fact };

const NOT_MALE = f('燔祭的牛和羊都要公的。母的可以獻為平安祭。', 'explicit', ['利1:3', '利1:10', '利3:1'], '無論是公的是母的');
const PEACE_NO_BIRD = f('平安祭的條例只列牛、綿羊、山羊，沒有列鳥。', 'not_stated', ['利3:1-16']);
const PEACE_NO_FLOUR = f('平安祭要獻牲畜；為感謝獻的時候，餅是跟著一起獻的。', 'explicit', ['利7:12'], '與感謝祭一同獻上');
const SIN_PEOPLE = f('百姓的贖罪祭，經文列的是母山羊或母綿羊羔；力量不夠的，可以改獻兩隻鳥或細麵。', 'explicit',
  ['利4:28', '利4:32', '利5:7', '利5:11'], '牽一隻沒有殘疾的母山羊為供物');
const SIN_RULER = f('官長的贖罪祭是一隻沒有殘疾的公山羊。', 'explicit', ['利4:23'], '就要牽一隻沒有殘疾的公山羊為供物');
const SIN_PRIEST = f('受膏的祭司要獻沒有殘疾的公牛犢。', 'explicit', ['利4:3'], '把沒有殘疾的公牛犢獻給耶和華為贖罪祭');
const GUILT_HOLY = f('贖愆祭只列一種祭牲：照估定的價，一隻沒有殘疾的公綿羊。', 'explicit', ['利5:15'], '羊群中一隻沒有殘疾的公綿羊');
const GUILT_NEIGHBOR = f('先如數歸還、另加五分之一，再牽一隻沒有殘疾的公綿羊來。', 'explicit', ['利6:5-6'], '羊群中一隻沒有殘疾的公綿羊');

const yes = (offering: OfferingId, pick: Record<string, string>, fact: Fact): EntryResult => ({ ok: true, offering, pick, fact });
const no = (fact: Fact): EntryResult => ({ ok: false, fact });

export function resolveEntry(bring: BringId, why: WhyId): EntryResult {
  switch (why) {
    case 'gift':
      if (bring === 'bull') return yes('burnt', { animal: 'bull' }, f('燔祭，用沒有殘疾的公牛。', 'explicit', ['利1:3'], '他的供物若以牛為燔祭'));
      if (bring === 'ram' || bring === 'he-goat') return yes('burnt', { animal: 'flock' }, f('燔祭，用沒有殘疾的公羊。', 'explicit', ['利1:10'], '就要獻上沒有殘疾的公羊'));
      if (bring === 'birds') return yes('burnt', { animal: 'bird' }, f('燔祭，用斑鳩或雛鴿。', 'explicit', ['利1:14'], '若以鳥為燔祭'));
      if (bring === 'flour') return yes('grain', { form: 'flour' }, f('素祭：細麵澆上油，加上乳香。', 'explicit', ['利2:1'], '要用細麵澆上油，加上乳香'));
      return no(NOT_MALE);
    case 'thanks':
    case 'vow':
    case 'free': {
      const kind = why;
      if (bring === 'bull' || bring === 'cow') return yes('peace', { animal: 'herd', kind }, f('平安祭，牛公母都可以。', 'explicit', ['利3:1'], '無論是公的是母的'));
      if (bring === 'ram' || bring === 'ewe') return yes('peace', { animal: 'sheep', kind }, f('平安祭，綿羊公母都可以。', 'explicit', ['利3:6'], '無論是公的是母的'));
      if (bring === 'he-goat' || bring === 'she-goat') return yes('peace', { animal: 'goat', kind }, f('平安祭，用山羊。', 'explicit', ['利3:12'], '人的供物若是山羊'));
      return no(bring === 'birds' ? PEACE_NO_BIRD : PEACE_NO_FLOUR);
    }
    case 'sin-people':
      if (bring === 'she-goat') return yes('sin', { who: 'people', bring: 'goat' }, f('贖罪祭，百姓獻母山羊。', 'explicit', ['利4:28'], '沒有殘疾的母山羊'));
      if (bring === 'ewe') return yes('sin', { who: 'people', bring: 'lamb' }, f('贖罪祭，百姓也可以獻母綿羊羔。', 'explicit', ['利4:32'], '必要牽一隻沒有殘疾的母羊'));
      if (bring === 'birds') return yes('sin', { who: 'people', bring: 'birds' }, f('贖罪祭，力量不夠獻羊羔的，帶兩隻鳥來。', 'explicit', ['利5:7'], '他的力量若不夠獻一隻羊羔'));
      if (bring === 'flour') return yes('sin', { who: 'people', bring: 'flour' }, f('贖罪祭，連兩隻鳥也不夠的，帶細麵來。', 'explicit', ['利5:11'], '細麵伊法十分之一為贖罪祭'));
      return no(SIN_PEOPLE);
    case 'sin-ruler':
      if (bring === 'he-goat') return yes('sin', { who: 'ruler' }, SIN_RULER);
      return no(SIN_RULER);
    case 'sin-priest':
      if (bring === 'bull') return yes('sin', { who: 'anointed' }, SIN_PRIEST);
      return no(SIN_PRIEST);
    case 'holy':
      if (bring === 'ram') return yes('guilt', { case: 'holy' }, GUILT_HOLY);
      return no(GUILT_HOLY);
    case 'neighbor':
      if (bring === 'ram') return yes('guilt', { case: 'neighbor' }, GUILT_NEIGHBOR);
      return no(GUILT_NEIGHBOR);
  }
}

/** 給資料閘門測試：所有可能出現的說明 */
export function allEntryFacts(): Fact[] {
  const out: Fact[] = [];
  for (const b of BRING) for (const w of WHY) out.push(resolveEntry(b.id, w.id).fact);
  return out;
}

export const EPIGRAPH = { text: '耶和華從會幕中呼叫摩西', ref: '利1:1' };
