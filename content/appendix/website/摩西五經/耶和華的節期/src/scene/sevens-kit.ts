// 第三批各小地點共用的小工具。
import { Group, Mesh, PlaneGeometry } from 'three';
import { litMat } from './materials';
import { hillMesh } from './props';
import { c, CUT } from './tracks';

/** cue 的切換點：有抹除轉場的 cue 在抹除全蓋的時刻，其餘在 cue 開始 */
export const cutOf = (name: string): number => CUT[name] ?? c(name);

/** 一般的地面（秋天的土色）：900×700，中心在 z=-150 */
export function groundMesh(seed = 1002, color = '#c8ad72', line = '#6a4f22'): Mesh {
  const m = new Mesh(new PlaneGeometry(900, 700), litMat({ base: color, line, angle: 84, angle2: 80, space: 5, seed, cross: true }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.02, -150);
  return m;
}
export function bigHills(g: Group, seed = 6, color = '#b9985a', line = '#5d4623'): void {
  const mHill = litMat({ base: color, line, angle: 4, space: 5, seed, bias: -0.2 });
  g.add(hillMesh(mHill, -80, -190, 120, 13, 50), hillMesh(mHill, 100, -210, 150, 17, 60), hillMesh(mHill, 10, -290, 200, 12, 50));
}
