import { DEBATES } from './debates';
import { SPOTS } from './inside';
import { EPIGRAPH, SCENES } from './scenes';
import { DAYS } from './timeline';
import type { Fact, Voice } from './types';

/** 全站所有帶出處的事實，給資料閘門逐條檢查 */
export function allFacts(): Fact[] {
  const out: Fact[] = [{ text: '題辭', status: 'explicit', refs: [EPIGRAPH.ref], q: EPIGRAPH.text }];
  for (const s of SCENES) {
    out.push({ text: s.title, status: 'explicit', refs: [s.verse.ref], q: s.verse.q });
    out.push(...(s.facts ?? []));
  }
  for (const d of DEBATES) out.push(d.said);
  for (const d of DAYS) out.push(d.what);
  for (const sp of SPOTS) out.push(...sp.facts);
  return out;
}

export function allVoices(): Voice[] {
  return [...SCENES.flatMap((s) => s.voices ?? []), ...DEBATES.flatMap((d) => d.voices), ...SPOTS.flatMap((s) => s.voices ?? [])];
}
