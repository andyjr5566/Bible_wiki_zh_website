// 火星、煙、塵土：一個 InstancedMesh 涵蓋整個世界裡所有的火（或隊伍），位置全在頂點著色器算，CPU 每幀只改一個 uniform。
import { InstancedBufferAttribute, InstancedMesh, PlaneGeometry, type ShaderMaterial } from 'three';
import { fxMat } from './materials';
import { mulberry32 } from './util';

export interface FxSet {
  mesh: InstancedMesh;
  mat: ShaderMaterial;
}

/** origins：每個發射點 [x,y,z]；per：每個發射點的粒子數 */
export function makeFx(kind: 'spark' | 'smoke' | 'dust' | 'cloud', origins: [number, number, number][], per: number, size: number, seed = 1): FxSet {
  const n = origins.length * per;
  const geo = new PlaneGeometry(1, 1);
  const org = new Float32Array(n * 4);
  const rnd = mulberry32(seed);
  let k = 0;
  for (const o of origins) {
    for (let i = 0; i < per; i++) {
      org[k++] = o[0];
      org[k++] = o[1];
      org[k++] = o[2];
      org[k++] = (i + rnd() * 0.8) / per; // seed：粒子在一個週期裡均勻錯開
    }
  }
  geo.setAttribute('aOrg', new InstancedBufferAttribute(org, 4));
  const mat = fxMat(kind, size);
  const mesh = new InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return { mesh, mat };
}
