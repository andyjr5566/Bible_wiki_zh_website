// 場景共用的小工具：擺放實例、做小山、做衣袍材質。
import { Group, InstancedMesh, Mesh, Object3D, PlaneGeometry, ShaderMaterial, SphereGeometry, type Matrix4 } from 'three';
import { FIXED, glowMat, litMat } from './materials';

export interface FrameLite {
  dt: number;
  time: number;
  motionOff: boolean;
}

const _o = new Object3D();

/** 設定第 i 個實例：位置、繞 y 轉角、均勻縮放（可另給 sx/sy/sz 與 x/z 傾角） */
export function setInst(m: InstancedMesh, i: number, x: number, y: number, z: number, ry = 0, sc = 1, sy = sc, rx = 0, rz = 0): void {
  _o.position.set(x, y, z);
  _o.rotation.set(rx, ry, rz);
  _o.scale.set(sc, sy, sc);
  _o.updateMatrix();
  m.setMatrixAt(i, _o.matrix);
}

export function matrixOf(x: number, y: number, z: number, ry = 0, sc = 1, sy = sc): Matrix4 {
  _o.position.set(x, y, z);
  _o.rotation.set(0, ry, 0);
  _o.scale.set(sc, sy, sc);
  _o.updateMatrix();
  return _o.matrix.clone();
}

const HILL_GEO = new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
/** 半球形的小山（共用幾何） */
export function hillMesh(mat: ShaderMaterial, x: number, z: number, sx: number, sy: number, sz: number): Mesh {
  const m = new Mesh(HILL_GEO, mat);
  m.position.set(x, 0, z);
  m.scale.set(sx, sy, sz);
  return m;
}

/** 長袍材質：part 0 袍色可換，其餘照規格（0 袍、1 頭與手、2 頭巾、3 杖、4 腰帶、5 包袱布） */
export function robeMat(robe: string, seed = 17, head = '#14110e', wrap = '#2b2218'): ShaderMaterial {
  return litMat({ base: FIXED.ochre, parts: [robe, head, wrap, '#4e3a22', '#14110e', '#d8cdb4'], angle: 40, space: 4.4, seed });
}

/** 地上的光池（營火、燈火）：圓形刻線光斑，平放在地面 */
export function poolMesh(mat: ShaderMaterial, size: number, x: number, z: number): Mesh {
  const m = new Mesh(new PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.035, z);
  m.renderOrder = 4;
  return m;
}

export const fireGlow = (): ShaderMaterial => glowMat({ on: '#f6c15a', edge: '#b24a14', hatch: 0.9, flick: 0.35 });
export const poolGlow = (): ShaderMaterial => glowMat({ pool: true, on: '#f0b04a' });

export function disposeGroup(g: Group): void {
  g.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as ShaderMaterial | ShaderMaterial[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}
