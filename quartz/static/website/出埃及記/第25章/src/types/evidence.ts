import type { EntityId } from './core';

export type EvidenceKind = 'scripture' | 'commentary' | 'archaeology' | 'asset' | 'engineering';
export type EvidenceStatus = 'verified' | 'unresolved' | 'rejected';

export interface EvidenceSource {
  id: string;
  title: string;
  sourceType: EvidenceKind;
  date: string;
  scope: string;
  url: string | null;
  attribution: string;
}

export interface EvidenceSourceRef {
  sourceId: string;
  locator: string;
}

export interface EvidenceClaim {
  id: string;
  entityId: EntityId;
  statement: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  references: EvidenceSourceRef[];
  limits: string[];
}

export interface EvidenceData { sources: EvidenceSource[]; claims: EvidenceClaim[]; }
