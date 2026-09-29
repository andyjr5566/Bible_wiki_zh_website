import { BALAAM_FACTS, COUNT_FACTS, LEVI_OUT_FACT, OVERVIEW_FACTS, PRIEST_TRUMPET_FACT, SAME_ORDER_FACT, TABERNACLE_FACTS, TOTAL_FACT } from './center';
import { DEBATES } from './debates';
import { CLANS, LOADS, clanFacts } from './levites';
import { ARK_WORDS, MARCHES, MARCH_DIFF, MARCH_END, TRIGGER } from './march';
import { CAMPS, MOTHER_Q, MOTHER_REF, TRIBES, campFacts, tribeExtraFacts, tribeFacts } from './tribes';
import { SIGNALS, TRUMPET_FACTS, WEST_NORTH_SILENT, signalFact } from './trumpets';
import type { Fact, Voice } from './types';
import { VOICES } from './voices';

export function loadFacts(): Fact[] {
  return LOADS.map((l) => ({
    text: `${l.name}：最外面蓋的是${l.outer === 'blue' ? '純藍色的毯子' : '海狗皮'}`,
    status: 'explicit' as const,
    refs: [l.ref],
    q: l.q,
  }));
}

export function motherFacts(): Fact[] {
  return (Object.keys(MOTHER_Q) as (keyof typeof MOTHER_Q)[]).map((m) => ({
    text: `${m}`,
    status: 'explicit' as const,
    refs: [MOTHER_REF],
    q: MOTHER_Q[m],
  }));
}

/** 閘門要逐條檢查的所有「事實」（含出處與摘句） */
export function allFacts(): Fact[] {
  const out: Fact[] = [];
  for (const t of TRIBES) out.push(...tribeFacts(t), ...tribeExtraFacts(t));
  for (const c of CAMPS) {
    out.push(...campFacts(c));
    out.push({ text: `${c.id}營總數`, status: 'explicit', refs: [c.total.ref], q: c.total.zh });
  }
  for (const c of CLANS) out.push(...clanFacts(c));
  out.push(TOTAL_FACT, LEVI_OUT_FACT, PRIEST_TRUMPET_FACT, SAME_ORDER_FACT, ...BALAAM_FACTS, ...COUNT_FACTS, ...OVERVIEW_FACTS, ...TABERNACLE_FACTS);
  out.push(...loadFacts(), ...motherFacts());
  out.push(...TRUMPET_FACTS, ...SIGNALS.map(signalFact), WEST_NORTH_SILENT, ...TRIGGER, ...ARK_WORDS, ...MARCH_END, ...MARCH_DIFF);
  for (const m of Object.values(MARCHES)) {
    for (const s of m.steps) out.push({ text: s.label, status: s.status, refs: [s.ref], q: s.q });
  }
  for (const d of DEBATES) out.push(...d.facts);
  return out;
}

/** 所有註釋家原話與轉述，閘門逐條對主檔 */
export function allVoices(): Voice[] {
  const out: Voice[] = [];
  for (const list of Object.values(VOICES)) out.push(...list);
  for (const d of DEBATES) out.push(...d.voices);
  return out;
}
