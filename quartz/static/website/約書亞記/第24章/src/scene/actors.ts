import * as THREE from 'three';
import { createCardCast } from './card-cast';
export type { CardActor as CharacterActor, CardCast as CastAndCrowdHandle } from './card-cast';
export const createCastAndCrowd = createCardCast;
export type ActorId =
  | 'joshua'
  | 'grandfather'
  | 'father'
  | 'mother'
  | 'daughter'
  | 'daughter_grown'
  | 'jacob'
  | 'jacob_kin'
  | 'elder_1'
  | 'elder_2'
  | 'helper_1'
  | 'helper_2'
  | 'joshua_house_1'
  | 'joshua_house_2';

export type ArmPose =
  | 'idle'
  | 'walk'
  | 'speak'
  | 'point'
  | 'write'
  | 'push-stone'
  | 'hand-over'
  | 'receive-bury'
  | 'carry-pole'
  | 'pull-sleeve';

export type CrowdMode =
  | 'hidden'
  | 'gather'
  | 'leaders'
  | 'standing'
  | 'wave-answer'
  | 'cannot-hush'
  | 'witness-step'
  | 'dismiss'
  | 'hillside-mourn';

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export function walkPaceCurve(t: number): { s: number; stride: number } {
  const c = Math.max(0, Math.min(1, t));
  if (c <= 0.001 || c >= 0.999) {
    return { s: c <= 0.001 ? 0 : 1, stride: 0 };
  }
  if (c < 0.22) {
    const u = c / 0.22;
    return { s: u * 0.12, stride: 0.65 };
  }
  if (c < 0.78) {
    const u = (c - 0.22) / 0.56;
    const smooth = u * u * (3 - 2 * u);
    return { s: 0.12 + smooth * 0.76, stride: 1.0 };
  }
  const u = (c - 0.78) / 0.22;
  return { s: 0.88 + (1 - (1 - u) * (1 - u)) * 0.12, stride: 0.65 * (1 - u * 0.6) };
}

/** 規則 10：「看向某人」只轉水平身向（Y 軸），絕不彎腰鞠躬 */
export function faceTargetYaw(obj: THREE.Object3D, targetX: number, targetZ: number): void {
  const dx = targetX - obj.position.x;
  const dz = targetZ - obj.position.z;
  if (dx * dx + dz * dz < 1e-5) return;
  obj.rotation.set(0, Math.atan2(dx, dz), 0);
}

