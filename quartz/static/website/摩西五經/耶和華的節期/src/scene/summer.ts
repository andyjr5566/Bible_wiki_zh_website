// 夏日過場（沿用七七節的麥田）：田收完只剩麥茬；田邊的葡萄樹結串、果樹由青轉熟（隨捲動）。
// 沒有任何文字、沒有人物。太陽與月亮的交替在 tracks.ts（summerSky）。
import { Group, type ShaderMaterial, Vector3 } from 'three';
import { fruitTreeGeo, vineGeo } from './geo3';
import { litMat, solid } from './materials';
import type { FrameLite } from './props';
import { c, inSummer } from './tracks';
import { clamp, hexTo, mulberry32, smooth } from './util';

const GREEN_G = hexTo('#92a84c', new Vector3());
const PURPLE_G = hexTo('#4f2a58', new Vector3());
const GREEN_F = hexTo('#9db255', new Vector3());
const RIPE_FIG = hexTo('#5c3158', new Vector3());
const GREEN_O = hexTo('#a8b25e', new Vector3());
const RIPE_O = hexTo('#2d2b22', new Vector3());

function setPart(m: ShaderMaterial, i: number, a: Vector3, b: Vector3, k: number): void {
  (m.uniforms.uPartCol.value as Vector3[])[i].lerpVectors(a, b, k);
}

export class Summer {
  group = new Group();
  private vines: Group[] = [];
  private trees: Group[] = [];
  private mVine: ShaderMaterial;
  private mFig: ShaderMaterial;
  private mOlive: ShaderMaterial;

  constructor() {
    const rnd = mulberry32(501);
    this.mVine = litMat({ base: '#6a5a3a', parts: ['#6a5a3a', '#6f9a3a', '#92a84c'], angle: 62, space: 4.2, seed: 501 });
    this.mFig = litMat({ base: '#6a5a3a', parts: ['#6a5238', '#7a9a48', '#9db255'], angle: 55, space: 4.4, seed: 502 });
    this.mOlive = litMat({ base: '#6a5a3a', parts: ['#5e4c34', '#8a9a68', '#a8b25e'], angle: 50, space: 4.4, seed: 503 });
    // 葡萄架：沿田邊一排（x 8.5–24，z = -0.6）
    for (let i = 0; i < 6; i++) {
      const v = solid(vineGeo(10 + i), this.mVine, 1.4);
      v.position.set(8.8 + i * 2.55, 0, -0.6 + (rnd() - 0.5) * 0.15);
      v.rotation.y = (rnd() - 0.5) * 0.06;
      this.group.add(v);
      this.vines.push(v);
    }
    // 第二排（更遠）
    for (let i = 0; i < 6; i++) {
      const v = solid(vineGeo(30 + i), this.mVine, 1.3);
      v.position.set(9.4 + i * 2.55, 0, -3.4 + (rnd() - 0.5) * 0.2);
      this.group.add(v);
      this.vines.push(v);
    }
    // 果樹：無花果、橄欖（只畫大輪廓）
    const spots: [number, number, number, number, 'fig' | 'olive'][] = [
      [3.6, -3.2, 1.3, 1, 'fig'],
      [26.5, -4.5, 1.5, 2, 'olive'],
      [31, -1.2, 1.2, 3, 'fig'],
      [0.2, -8.5, 1.6, 4, 'olive'],
      [22, -10.5, 1.4, 5, 'fig'],
      [34, -8, 1.5, 6, 'olive'],
    ];
    for (const [x, z, cr, sd, kind] of spots) {
      const t = solid(fruitTreeGeo(sd, cr), kind === 'fig' ? this.mFig : this.mOlive, 1.6);
      t.position.set(x, 0, z);
      t.rotation.y = rnd() * 6;
      this.group.add(t);
      this.trees.push(t);
    }
    this.group.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const on = inSummer(s);
    this.group.visible = on;
    if (!on) return;
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = clamp(s - c('summer'));
    // 隨捲動轉熟：葡萄由青轉紫、果子由青轉熟
    const ripe = smooth(0.12, 0.85, p);
    setPart(this.mVine, 2, GREEN_G, PURPLE_G, ripe);
    setPart(this.mFig, 2, GREEN_F, RIPE_FIG, smooth(0.2, 0.9, p));
    setPart(this.mOlive, 2, GREEN_O, RIPE_O, smooth(0.3, 0.95, p));
    // 環境：葡萄架與樹隨風輕輕搖（動態關就停）
    const k = mo ? 1 : 0;
    for (let i = 0; i < this.vines.length; i++) this.vines[i].rotation.z = k * 0.012 * Math.sin(t * 1.1 + i * 1.7);
    for (let i = 0; i < this.trees.length; i++) {
      this.trees[i].rotation.z = k * 0.018 * Math.sin(t * 0.8 + i * 2.3);
      this.trees[i].rotation.x = k * 0.012 * Math.sin(t * 0.63 + i * 1.1);
    }
  }
}
