import type { EntityId, ScriptureReference } from './core';

export type BibleBook = 'Exodus' | 'Leviticus' | 'Numbers' | 'Hebrews';
export type ScriptureContext = 'design' | 'construction' | 'placement' | 'service' | 'reflection';

export interface ScriptureLinks {
  objectIds: EntityId[];
  ritualIds: EntityId[];
  locationIds: EntityId[];
  characterIds: EntityId[];
}

export interface ScripturePassage {
  id: ScriptureReference;
  book: BibleBook;
  chapter: number;
  verses: string;
  summary: string;
  annotation: string;
  originalText: string;
  context: ScriptureContext;
  sourceUrl: string;
  links: ScriptureLinks;
}

export interface EntityScriptureQuery {
  kind: keyof ScriptureLinks;
  entityId: EntityId;
}
