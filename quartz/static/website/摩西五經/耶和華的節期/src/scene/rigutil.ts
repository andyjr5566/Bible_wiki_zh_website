// 場景共用的人物與小東西工具：讓手伸向某點、轉向、細繩、成組的小件（水滴、血滴）。
import { CylinderGeometry, InstancedMesh, Mesh, Object3D, type ShaderMaterial, type SphereGeometry, Vector3 } from 'three';
import type { RigPerson } from './rig';

const PI = Math.PI;
const _v1 = new Vector3();
const _v2 = new Vector3();
const _o = new Object3D();

/** 讓人物的一隻手伸向院子座標裡的一點（身體正立時） */
export function aimAt(r: RigPerson, side: 'L' | 'R', x: number, y: number, z: number): void {
  const yaw = r.group.rotation.y;
  const dx = x - r.group.position.x;
  const dz = z - r.group.position.z;
  const dy = y - r.group.position.y;
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const lx = dx * cs - dz * sn;
  const lz = dx * sn + dz * cs;
  const sc = r.baseScale;
  const sx = (side === 'L' ? 0.235 : -0.235) * sc;
  r.aim(side, (lx - sx) / sc, (dy - 1.38 * sc) / sc, lz / sc);
}
/** 0→1→0 的小山丘（以 c 為中心、半寬 w） */
export const pulse = (x: number, c: number, w: number): number => Math.max(0, 1 - Math.abs(x - c) / w);
export const faceTo = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);
/** 轉向（取最短角度）的插值 */
export function lerpAng(a: number, b: number, t: number): number {
  let d = (b - a) % (2 * PI);
  if (d > PI) d -= 2 * PI;
  if (d < -PI) d += 2 * PI;
  return a + d * t;
}

/** 一條細繩：單位長圓柱，兩端點隨人與羊移動 */
export class Rope {
  mesh: Mesh;
  constructor(mat: ShaderMaterial) {
    const g = new CylinderGeometry(0.012, 0.012, 1, 4);
    g.translate(0, 0.5, 0);
    this.mesh = new Mesh(g, mat);
  }
  set(a: Vector3, b: Vector3): void {
    this.mesh.position.copy(a);
    _v1.subVectors(b, a);
    const len = _v1.length();
    this.mesh.scale.set(1, Math.max(len, 1e-3), 1);
    this.mesh.quaternion.setFromUnitVectors(_v2.set(0, 1, 0), _v1.multiplyScalar(1 / Math.max(len, 1e-4)));
  }
}

/** 一組小東西（水滴、血滴、血跡）：InstancedMesh，每幀只改矩陣 */
export class Bits {
  mesh: InstancedMesh;
  n: number;
  constructor(geo: SphereGeometry, mat: ShaderMaterial, n: number, order = 0) {
    this.n = n;
    this.mesh = new InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
    this.hideAll();
  }
  hideAll(): void {
    for (let i = 0; i < this.n; i++) this.put(i, 0, -50, 0, 0.0001, 0.0001, 0.0001);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  put(i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
    _o.position.set(x, y, z);
    _o.rotation.set(0, 0, 0);
    _o.scale.set(sx, sy, sz);
    _o.updateMatrix();
    this.mesh.setMatrixAt(i, _o.matrix);
  }
}

