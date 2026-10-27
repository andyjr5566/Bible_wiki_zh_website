import type { SiteData, StoryBeat, VerseLine } from './types';
export interface ContentStation { id: string; beat: string; verses: number[] }
export interface Rhythm { characters: number; noteCharacters: number; readingPx: number; actionPx: number; transitionPx: number; px: number; seconds: number }
export const beatSlices: Record<string, Record<number, number[]>>;
export const stationSlices: Record<string, Record<number, number[]>>;
export function splitSentences(text: string): string[];
export function primaryRefOf(beat: StoryBeat): string | undefined;
export function storyLines(beat: StoryBeat, data: SiteData, station?: ContentStation): VerseLine[];
export function readingCharacters(text: string): number;
export function contentRhythm(text: string, actionPx?: number, note?: string): Rhythm;
export function beatRhythm(beat: StoryBeat, data: SiteData): Rhythm;
export const COMPARE_ROW_PX: number;
export const COMPARE_ROW_SECONDS: number;
export function compareRowCount(beat: StoryBeat, data: SiteData): number;
export function stationRhythm(station: ContentStation, data: SiteData): Rhythm;
export function validateStoryContent(data: SiteData, stations: ContentStation[]): { units: number; verses: number; sentences: number; duplicates: number };
