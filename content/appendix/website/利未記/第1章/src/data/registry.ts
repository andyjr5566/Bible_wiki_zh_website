import { COMPARE } from './compare';
import { EPIGRAPH, allEntryFacts } from './entry';
import { DEBATES, TRIVIA, TWO_BIRDS_VOICE } from './debates';
import { OBJECTS } from './objects';
import { OFFERINGS } from './offerings';
import {
  BODY_MARKS, BODY_VOICES, EIGHTH_DAY, EIGHTH_DAY_ORDER_VOICES, GARMENTS, GARMENT_FACTS, GARMENT_VOICES, ORDINATION,
  PRIESTHOOD_FACTS, SEVEN_DAYS,
} from './priesthood';
import { EIGHTH_VARIANT, laterFacts } from './later';
import { storyFacts } from './story';
import type { Fact, Outcome, Step, Voice } from './types';

const outcomeFacts = (o: Outcome): Fact[] => Object.values(o);

/** 全站所有帶出處的事實，給資料閘門測試逐條檢查 */
export function allFacts(): Fact[] {
  const out: Fact[] = [];
  for (const o of OFFERINGS) {
    out.push(o.why, ...o.rules);
    for (const v of o.variants) out.push(...outcomeFacts(v.outcome));
  }
  for (const v of ORDINATION) out.push(...outcomeFacts(v.outcome));
  for (const g of GARMENTS) out.push(g.put, ...g.made);
  out.push(...GARMENT_FACTS, ...PRIESTHOOD_FACTS);
  for (const b of BODY_MARKS) out.push(b.fact);
  for (const t of [...SEVEN_DAYS, ...EIGHTH_DAY]) out.push(t.fact);
  for (const d of DEBATES) out.push(d.text);
  for (const t of TRIVIA) out.push(t.back);
  for (const o of OBJECTS) out.push(...o.facts);
  for (const r of COMPARE) out.push(...Object.values(r.cells));
  out.push(...allEntryFacts(), { text: '題辭', status: 'explicit', refs: [EPIGRAPH.ref], q: EPIGRAPH.text });
  out.push(...storyFacts(), ...laterFacts());
  return out;
}

export function allSteps(): Step[] {
  return [...OFFERINGS.flatMap((o) => o.variants), ...ORDINATION, EIGHTH_VARIANT].flatMap((v) => v.steps);
}

export function allVoices(): Voice[] {
  return [
    ...DEBATES.flatMap((d) => [...d.voices, ...(d.lexical ? [d.lexical] : [])]),
    ...OBJECTS.flatMap((o) => o.voices ?? []),
    ...GARMENT_VOICES, ...BODY_VOICES, ...EIGHTH_DAY_ORDER_VOICES, TWO_BIRDS_VOICE,
  ];
}
