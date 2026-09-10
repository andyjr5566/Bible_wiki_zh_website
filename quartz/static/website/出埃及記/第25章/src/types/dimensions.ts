import type { Vector3Data } from './core';

export interface DimensionSpec {
  id: string;
  name: string;
  status: 'verified' | 'unresolved';
  center: Vector3Data;
  sizeCubits: { x: number; y: number; z: number } | null;
  customLabels?: { length?: string | undefined; height?: string | undefined; width?: string | undefined } | undefined;
}
export interface DimensionSpecsData { specs: DimensionSpec[]; }
