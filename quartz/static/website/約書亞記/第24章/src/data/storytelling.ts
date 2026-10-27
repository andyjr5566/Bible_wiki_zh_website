import type { SiteData, StoryBeat } from './types';
import { siteData } from './site';
import { beatRhythm, stationRhythm, type ContentStation } from './story-content.mjs';
export { splitSentences } from './story-content.mjs';

export type VersePosition = 'upper-left' | 'upper-center' | 'upper-right' | 'horizon';
export interface VerseLayout { position: VersePosition; tone: 'ink' | 'ivory'; width: number; mobileWidth: number }
const layout = (position: VersePosition, tone: 'ink' | 'ivory' = 'ink', width = 56, mobileWidth = 60): VerseLayout =>
  ({ position, tone, width, mobileWidth });
/** 每拍的文字留白；數字為視窗寬度百分比。經文文字仍只取正式資料。 */
export const verseLayouts: Record<string, VerseLayout> = {
  prologue: layout('upper-left', 'ink', 48, 48),
  gather: layout('upper-right', 'ink', 53, 57), leaders: layout('upper-right'),
  'before-god': layout('upper-right'), 'family-1': layout('upper-left'),
  'beyond-river': layout('upper-left', 'ivory'), abraham: layout('upper-right', 'ivory'),
  egypt: layout('upper-left', 'ivory'), east: layout('upper-left', 'ivory'),
  jericho: layout('upper-left', 'ivory'), gifts: layout('upper-left', 'ivory'),
  'family-2': layout('upper-left'), now: layout('upper-right'),
  'three-gods': layout('upper-right'), 'my-house': layout('upper-right', 'ink', 57, 62),
  'family-3': layout('upper-left'), 'answer-1': layout('upper-right'),
  cannot: layout('upper-center', 'ink', 68, 72), 'answer-2': layout('upper-right'),
  witness: layout('upper-right'), 'put-away': layout('upper-right'),
  'answer-3': layout('upper-right'), 'family-4': layout('upper-left'),
  covenant: layout('upper-right'), write: layout('upper-right'),
  raise: layout('upper-left', 'ink', 50, 42), 'the-stone': layout('upper-right'),
  dismiss: layout('upper-left', 'ink', 52, 58), 'family-5': layout('upper-left'),
  'joshua-dies': layout('upper-right'), elders: layout('upper-right'),
  bones: layout('upper-right'), eleazar: layout('upper-right'),
  'family-6': layout('upper-left'), 'epilogue-diff': layout('upper-right'),
  'epilogue-stone': layout('upper-left'),
};
export const stationLayouts: Record<string, VerseLayout> = {
  'beyond-river': layout('upper-left', 'ivory'), ford: layout('upper-left', 'ivory'),
  isaac: layout('upper-right', 'ivory'), 'esau-jacob': layout('upper-left', 'ivory'),
  egypt: layout('upper-left', 'ivory'), redsea: layout('upper-left', 'ivory', 58, 65),
  wilderness: layout('upper-left', 'ivory'), east: layout('upper-left', 'ivory'),
  moab: layout('upper-left', 'ivory'), jordan: layout('upper-left', 'ivory'),
  canaan: layout('upper-left', 'ivory'),
};
export const FLIGHT_PX = 800;
export const ENTER_PX = 180;
export function stationReadPx(station: ContentStation): number {
  return stationRhythm(station, siteData).px;
}
export function beatReadPx(beat: StoryBeat, data: SiteData): number {
  return beatRhythm(beat, data).px;
}
/** 經文完全消失後留出空拍，再讓短註入場。 */
export function voiceWeights(progress: number, hasNote: boolean) {
  const smooth = (a: number, b: number) => {
    const t = Math.max(0, Math.min(1, (progress - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return { verse: 1 - smooth(hasNote ? .70 : .86, hasNote ? .77 : .96), note: hasNote ? smooth(.80, .88) : 0 };
}
