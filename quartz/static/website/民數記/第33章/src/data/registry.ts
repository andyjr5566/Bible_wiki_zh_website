import { COMPARE_A, COMPARE_B } from './compare';
import type { CmpItem } from './compare';
import { DATES, SPANS } from './dates';
import { DEBATES } from './debates';
import { EVENTS } from './events';
import { FHL_STATEMENTS, SITE_VOICES } from './sites';
import { LANDMARKS, STATIONS } from './stations';
import type { Fact, Voice } from './types';
import { CROSSING_FACTS, CROSSING_VOICES, GT_PATTERNS, OVERVIEW_FACTS, SEGMENT_VOICES } from './voices';
import { WHY_DIFFERENT } from './compare';

const cmpFact = (i: CmpItem): Fact => ({ text: i.name, status: 'explicit', refs: [i.ref], q: i.q });

/** 閘門要逐條檢查的所有「事實」（含出處與摘句） */
export function allFacts(): Fact[] {
  const out: Fact[] = [];
  for (const s of STATIONS) out.push({ text: `第${s.n}站 ${s.name}`, status: 'explicit', refs: [`民33:${s.verse}`], q: s.q });
  for (const l of LANDMARKS) out.push({ text: l.name, status: 'explicit', refs: [`民33:${l.verse}`], q: l.q });
  for (const e of EVENTS) out.push({ text: e.text, status: e.status, refs: e.refs, q: e.q, note: e.note });
  for (const d of DATES) out.push({ text: d.label, status: d.status, refs: [d.ref], q: d.q, note: d.note });
  for (const s of SPANS) out.push({ text: s.label, status: 'explicit', refs: [s.ref], q: s.q });
  for (const d of DEBATES) out.push(...d.facts);
  out.push(...CROSSING_FACTS, ...OVERVIEW_FACTS);
  for (const c of [COMPARE_A, COMPARE_B]) for (const i of [...c.left.items, ...c.right.items]) out.push(cmpFact(i));
  return out;
}

/** 所有註釋家原話、地圖說明與轉述，閘門逐條對出處檔 */
export function allVoices(): Voice[] {
  const out: Voice[] = [];
  for (const list of Object.values(SITE_VOICES)) out.push(...list);
  out.push(...Object.values(FHL_STATEMENTS));
  out.push(...SEGMENT_VOICES.ct, ...SEGMENT_VOICES.gt);
  for (const p of GT_PATTERNS) out.push({ who: 'GT《民數記串珠聖經註釋》', says: p.text, keys: p.keys, file: '04 民數記/第33章.md' });
  for (const d of DEBATES) out.push(...d.voices);
  out.push(...COMPARE_A.voices, ...COMPARE_B.voices, ...WHY_DIFFERENT, ...CROSSING_VOICES);
  return out;
}
