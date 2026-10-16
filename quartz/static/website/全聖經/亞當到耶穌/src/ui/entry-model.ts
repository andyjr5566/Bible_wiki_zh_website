import type { ReadingData, ReadingSegment, StageId, TourStop } from '../data/types';

/**
 * 目錄與「歸回的名單」兩個分頁、導覽最後兩站：不碰 DOM 的純函式。
 */

export interface CatalogItem {
  /** 在讀經路線裡的第幾段 */
  index: number;
  id: string;
  title: string;
  range: string;
  stage: StageId;
  intro: string;
  /** 點了從這一節開始讀，例如「創4:17」 */
  start: string;
}

export interface CatalogGroup {
  group: string;
  items: CatalogItem[];
}

/** 一段的第一節（讀經的 #read= 用的 key） */
export function segmentStartKey(segment: ReadingSegment): string {
  const chapter = segment.chapters[0];
  const verse = chapter?.verses[0];
  return chapter && verse ? `${chapter.book}${chapter.n}:${verse.v}` : '';
}

function itemOf(segment: ReadingSegment, index: number): CatalogItem {
  return {
    index, id: segment.id, title: segment.title, range: segment.range, stage: segment.stage,
    intro: segment.intro ?? '', start: segmentStartKey(segment),
  };
}

/** 讀經路線的全部段落，照 group 分組；組的次序、組內段落的次序都照讀經路線 */
export function catalogGroups(reading: Pick<ReadingData, 'segments'>): CatalogGroup[] {
  const groups: CatalogGroup[] = [];
  reading.segments.forEach((segment, index) => {
    let group = groups.find((g) => g.group === segment.group);
    if (!group) { group = { group: segment.group, items: [] }; groups.push(group); }
    group.items.push(itemOf(segment, index));
  });
  return groups;
}

/** 「歸回的名單」分頁的六張卡，照讀經路線的次序 */
export const RETURN_IDS = ['ezra2', 'ezra8', 'ezra10', 'neh3', 'neh7', 'neh10'] as const;

export function returnCards(reading: Pick<ReadingData, 'segments'>): CatalogItem[] {
  const cards: CatalogItem[] = [];
  reading.segments.forEach((segment, index) => {
    if ((RETURN_IDS as readonly string[]).includes(segment.id)) cards.push(itemOf(segment, index));
  });
  return cards;
}

/** 導覽的一站要做什麼：一般站對準家譜樹；reading 站標亮「帶你讀經」；catalog 站切到目錄 */
export type StopMode = 'tree' | 'reading' | 'catalog';

export function stopMode(stop: Pick<TourStop, 'kind'>): StopMode {
  return stop.kind === 'reading' ? 'reading' : stop.kind === 'catalog' ? 'catalog' : 'tree';
}

/** 這一站在家譜樹上要鏡頭對準的人；reading、catalog 站沒有 */
export function stopFocus(stop: Pick<TourStop, 'kind' | 'focus' | 'sequence'>): string[] {
  if (stopMode(stop) !== 'tree') return [];
  return stop.sequence?.length ? stop.sequence : stop.focus ?? [];
}

export function stopRefs(stop: Pick<TourStop, 'refs'>): string[] {
  return Array.isArray(stop.refs) ? stop.refs : stop.refs ? [stop.refs] : [];
}
