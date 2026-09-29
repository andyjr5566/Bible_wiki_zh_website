import { DEBATES, UNWRITTEN } from './debates';
import { GIVING, MATERIALS, ZONES } from './materials';
import { EPIGRAPH, ORDER_VOICES, STOPS, TITLE } from './stops';
import type { Fact, Voice } from './types';

/** 全站所有帶出處的事實，給資料閘門逐條檢查 */
export function allFacts(): Fact[] {
  const out: Fact[] = [GIVING];
  for (const s of STOPS) out.push(...s.facts);
  for (const m of MATERIALS) {
    out.push(m.listed);
    for (const u of m.uses) out.push({ text: u.text, status: 'explicit', refs: [u.ref], q: u.q });
  }
  for (const z of ZONES) out.push(z.fact);
  for (const d of DEBATES) out.push(d.text);
  out.push({ text: '標題', status: 'explicit', refs: [TITLE.ref], q: TITLE.q }, { text: '題辭', status: 'explicit', refs: [EPIGRAPH.ref], q: EPIGRAPH.text });
  return out;
}

export function allVoices(): Voice[] {
  return [
    ...STOPS.flatMap((s) => s.voices), ...ORDER_VOICES, ...DEBATES.flatMap((d) => d.voices),
    ...MATERIALS.flatMap((m) => (m.voice ? [m.voice] : [])), UNWRITTEN.source, UNWRITTEN.list,
  ];
}
