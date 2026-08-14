import type { AssetProfile } from './assets';
import type { ConfidenceLevel } from './core';
import type { RitualPlaybackState } from './rituals';

export interface TourStopView { id: string; title: string; locationId: string; objectId: string | null; scriptureReference: string | null; scriptureText: string | null; }
export interface TourViewState { playing: boolean; index: number; total: number; current: TourStopView | null; }
export type ScriptureContext = 'design' | 'construction' | 'placement' | 'service' | 'reflection';
export interface LearningViewState {
  objectId: string | null;
  objectName: string | null;
  confidence: ConfidenceLevel | null;
  locationName: string | null;
  scriptureReferences: Array<{ id: string; summary: string; annotation: string; originalText: string; context: ScriptureContext; sourceUrl: string }>;
  ritualIds: string[];
  characterIds: string[];
}
export interface RitualViewState {
  playback: RitualPlaybackState;
  name: string | null;
  stepTitle: string | null;
  instruction: string | null;
  confidence: ConfidenceLevel | null;
  scriptureReferences: string[];
}
export interface MapMarkerView { id: string; label: string; x: number; y: number; kind: 'location' | 'player'; }
export interface CharacterViewState { id: string; name: string; status: 'omitted'; position: null; disclosure: string; }
export interface AttributionView { id: string; title: string; author: string; sourceUrl: string; license: string; attribution: string; }

export interface ExperienceState {
  tour: TourViewState;
  learning: LearningViewState;
  ritual: RitualViewState;
  character: CharacterViewState;
  creditsOpen: boolean;
  assetProfile: AssetProfile;
}

export type TourCommand = 'previous' | 'next' | 'close';
export type RitualCommand = 'play-pause' | 'next' | 'close';
