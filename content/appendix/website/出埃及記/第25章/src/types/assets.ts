import type { EntityId, Vector3Data } from './core';

export type AssetQualityTier = 'hero' | 'detail' | 'structural' | 'library' | 'fallback';
export type RuntimePolicy = 'default' | 'on-demand' | 'mode-only' | 'deferred' | 'manual-fallback';
export type AssetProfile = 'desktop-high' | 'desktop-structural' | 'fallback-low';
export type AssetUsage = 'world' | 'detail' | 'structural' | 'library' | 'fallback';
export type HistoricalStatus = 'textual' | 'reconstructed' | 'illustrative' | 'technical-base' | 'reference-only';

export interface AssetTransform {
  position: Vector3Data;
  rotation: Vector3Data;
  scale: number;
}

export interface AssetDefinition {
  id: EntityId;
  kind: 'model' | 'texture' | 'audio' | 'font';
  qualityTier: AssetQualityTier;
  runtimePolicy: RuntimePolicy;
  usage: AssetUsage;
  historicalStatus: HistoricalStatus;
  url: string;
  runtimeFile: string;
  sourceFile: string;
  processedFile: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  downloadAvailable: true;
  commercialUse: false;
  downloadDate: string;
  sha256: string;
  triangleCount: number;
  vertexCount: number;
  attribution: string;
  transform: AssetTransform;
}

export type AssetRuntimePhase = 'idle' | 'loading' | 'ready' | 'error';

export interface AssetWorldBounds {
  min: Vector3Data;
  max: Vector3Data;
  center: Vector3Data;
  size: Vector3Data;
}

export interface AssetRuntimeError {
  assetId: string;
  message: string;
  fallbackAvailable: boolean;
}

export interface AssetRuntimeState {
  phase: AssetRuntimePhase;
  profile: AssetProfile;
  activeAssetIds: string[];
  boundsByAssetId: Readonly<Record<string, AssetWorldBounds>>;
  progress: { assetId: string; phase: 'download' | 'parse' | 'validate' | 'ready' | 'error'; loadedBytes: number; totalBytes: number | null; ratio: number | null } | null;
  error: AssetRuntimeError | null;
}
