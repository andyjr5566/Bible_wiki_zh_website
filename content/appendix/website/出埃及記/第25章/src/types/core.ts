export type EntityId = string;
export type ScriptureReference = string;
export type ConfidenceLevel = 'textual' | 'strong-inference' | 'reconstructed' | 'illustrative';

export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}

export interface Disposable {
  dispose(): void;
}
