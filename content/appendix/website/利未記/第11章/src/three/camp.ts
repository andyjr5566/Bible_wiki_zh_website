import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Beat, CastId, Cue, Mark, PropId, Sky, Spot } from '../data/types';

/**
 * 3D 營地：會幕院子在中間（模型單位是肘，+X 東、院子的門在東邊），
 * 四周是帳棚，這一家的帳棚在東邊。營地的大小、帳棚的數目都是示意，不按比例。
 */

type V = [number, number, number];
const V3 = THREE.Vector3;
const v3 = (p: V) => new V3(...p);

/* ------------------------------------------------------------ 位置 */

const HOME: V = [119, 0, 27];
const SPOT: Record<Spot, V> = {
  home: [111, 0, 27],
  yard: [106.5, 0, 31.5],
  pot: [104.9, 0, 28.6],
  basin: [104.8, 0, 22.4],
  beside: [108.2, 0, 26.2],
  seatBy: [105.9, 0, 36.8],
  path: [84, 0, 10],
  gate: [57, 0, 1],
  gateF: [62.5, 0, 3.2],
  pathD: [86.5, 0, 14.5],
  pathF: [87.5, 0, 6.5],
  doorD: [27.0, 0, 8.6],
  doorF: [32, 0, 2],
  // 會幕門口：獻祭的人站在壇的東邊，祭司面向他（院子模型：壇在 x=18，院門在 x=50）
  door: [28, 0, 4.5],
  doorP: [23.5, 0, 2],
  aisle: [128, 0, 3],
  exit: [268, 0, 3],
  outside: [302, 0, 58],
  outP: [296.5, 0, 62.5],
  tentOut: [125, 0, 37.5],
  onSeat: [108, 0, 35.2],
  onMat: [111.5, 0, 36.3],
  matBy: [115.0, 0, 35.5],
  cook: [104.6, 0, 30.4],
  potBack: [106.9, 0, 29.9],
  potF: [104.6, 0, 26.2],
  peek: [107.2, 0, 24.2],
  bowlBy: [105.0, 0, 24.4],
  basinM: [104.6, 0, 21.2],
  edge: [104.0, 0, 15.5],
  fireF: [100.4, 0, 29.4],
  fireM: [104.9, 0, 32.4],
  fireD: [102.2, 0, 34.0],
  inTent: [117.2, 0, 27],
  roadM: [92.0, 0, 14.8],
  roadF: [95.2, 0, 11.4],
  roadD: [93.5, 0, 13.2],
  circM: [105.3, 0, 30.1],
  circD: [108.0, 0, 32.6],
  doorHand: [29.0, 0, 6.6],
  passBy: [111.5, 0, 8.0],
  seeM: [107.5, 0, 15.2],
  seeD: [109.6, 0, 15.9],
};
const SEAT: V = [108, 0, 35.2];
const MAT: V = [111.5, 0, 35.5];
const SHELTER: V = [307, 0, 54];
const ALTAR_TOP: V = [18, 3.05, 0];
const POT: V = [102.9, 0, 27.4];
/** 瓦罐口的高度（Blender 模型）、湯面高度、死蜥蜴的縮放 */
const POT_RIM = 1.46;
const SOUP_Y = 1.12;
const LIZ_SCALE = 0.62;
const FIRE: V = [102.6, 0, 30.6];
const BASIN: V = [102.6, 0, 22.4];
const TABLE: V = [103.4, 0, 25.0];

type View = [V, V];
const VIEWS: Record<string, View> = {
  hero: [[330, 190, 300], [20, 0, 0]],
  camp: [[400, 280, 360], [40, 0, 0]],
  yard: [[90, 10, 43], [106, 1.6, 26]],
  pot: [[94.5, 7, 35.5], [103.4, 1.6, 27.5]],
  basin: [[95.5, 5.5, 17], [103, 0.8, 22.8]],
  reach: [[175, 85, 120], [62, 0, 8]],
  night: [[88, 13, 47], [107, 2, 25]],
  talk: [[115.5, 7.5, 41], [106.4, 3.6, 27.4]],
  yardWide: [[94, 15, 54], [110, 1.5, 29]],
  seat: [[99, 8, 46], [109, 1.4, 33.5]],
  furniture: [[97, 8.5, 47.5], [110, 1.6, 33.5]],
  washing: [[91, 8.5, 12.5], [104, 2.2, 23]],
  homeward: [[103, 6.5, 11], [84, 2.6, 10.5]],
  gate: [[74, 11, 26], [52, 2, 2]],
  door: [[38.5, 6.8, 15.5], [25.5, 2.4, 3.6]],
  altar: [[34, 8.5, 13.5], [20.5, 2.8, 2]],
  exit: [[236, 95, 165], [190, 0, 25]],
  outside: [[322, 11, 84], [301, 2.5, 58]],
  tentOut: [[138, 9, 52], [123, 2, 35]],
  campE: [[215, 120, 170], [90, 0, 15]],
  homeOut: [[175, 70, 115], [125, 0, 25]],
  apart: [[212, 255, 265], [212, 0, 40]],
  rite: [[313, 8.5, 75], [299.5, 2.4, 60]],
  outClose: [[294.5, 5.6, 68], [303, 2.6, 57]],
  arm: [[107.5, 6.4, 35.5], [111, 3.0, 27.6]],
  inspectClose: [[60.6, 6.8, 17.5], [59.9, 3.2, 2.1]],
  mournFront: [[55.6, 4.2, -4.6], [62.5, 2.5, 3.2]],
  booth: [[70.5, 9, 17], [61.5, 2.2, 3]],
  outsideWide: [[290, 8, 82], [305, 3.2, 54]],
  tentWait: [[129, 10, 60], [114, 2.5, 31]],
  reunion: [[118, 6.5, 38], [106.5, 2.5, 29]],
  homeLook: [[99.5, 6.8, 41.5], [121, 3, 13]],
  pathView: [[96, 13, 32], [82, 2, 9]],
  doorFamily: [[41, 7.2, 16.5], [27.5, 2.4, 4.4]],
  birthNight: [[99, 10.5, 49], [113.5, 2.6, 28.5]],
  doorClose: [[21.2, 4.4, 10], [27.6, 2.6, 4.2]],
  homeBack: [[124, 11, 50], [110, 2, 29]],
  // 放低的鏡頭：一家人在前景，背後是天空，時間快轉時看得到太陽月亮轉
  skyline: [[92, 4.6, 52], [110, 5.8, 24]],
  inspect: [[69, 7, 17], [59.5, 2.6, 2]],
  // 第 11 章：帳棚前的空地
  yardOpen: [[95.5, 7.8, 42], [105.6, 2.2, 28.6]],
  lidFront: [[96.6, 4.6, 30.4], [104.4, 2.4, 27.8]],
  potPov: [[104.2, 5.4, 24.6], [102.9, 1.0, 27.4]],
  smash: [[96.5, 6.2, 21.6], [104.2, 2.2, 27]],
  bowlClose: [[100.2, 3.6, 21.6], [103.6, 0.8, 25.1]],
  dump: [[97, 7.5, 33.5], [105, 2.2, 21]],
  basinDip: [[98.8, 4.6, 18.6], [104, 1.6, 22]],
  reachLook: [[114, 6.4, 22.6], [60, 1, 4]],
  sunsetW: [[111.5, 3.4, 33.6], [80, 2.6, 30.5]],
  fireNight: [[95, 7, 40.5], [103, 2, 31.5]],
  // 圍著火堆說話：從側面斜拍，女兒問時偏女兒，母親答時偏母親，兩人的臉都看得到
  askD: [[110.7, 4.8, 39.4], [102.8, 2.4, 33.8]],
  askM: [[105.6, 4.8, 42.4], [104.4, 2.8, 32.6]],
  // 第 12 章：帳棚門口、第八天圍著嬰孩、回家路上父女說話
  tentDoor: [[103.5, 5.5, 34.5], [113.5, 2.6, 27.2]],
  babyMom: [[100.5, 5.2, 31.5], [109.2, 2.6, 26.6]],
  babyClose: [[100.5, 5.0, 36.0], [106.3, 2.4, 31.4]],
  babyTight: [[103.4, 3.9, 34.6], [106.4, 2.7, 31.6]],
  askRoad: [[103, 4.6, 16.3], [94, 2.4, 12.5]],
  // 第 13 章：出營路上和家人遠遠對望（兩個鏡頭都在東側，不跨過兩人之間的線）、營外的夜裡
  lookBackB: [[115.5, 5.0, 23.5], [110.4, 2.6, 9.6]],
  lookBackA: [[115.6, 4.8, 2.4], [108.4, 2.6, 15.4]],
  outsideNight: [[294.5, 3.8, 61.5], [302.5, 2.0, 57.5]],
  // 第 14 章：抹血抹油從北側拍（父親面向西時，右耳、右手、右腳在北側），祭司和父親都在畫面裡
  daubView: [[29.8, 4.2, -3.8], [25.6, 2.4, 3.1]],
  askHome: [[112, 4.8, 23.5], [105.6, 2.6, 30.2]],
  // 第 15 章：躺到墊子上的近景；回家路上女兒問母親（從兩人側面拍）
  matClose: [[103.8, 4.8, 41.2], [110.2, 1.5, 35.4]],
  askRoad15: [[99.3, 4.6, 20.1], [92.8, 2.6, 14.0]],
};

/* ------------------------------------------------------------ 天色 */

interface SkyLook { bg: string; hemi: number; sun: number; sunCol: string; sunPos: V; ground: string; night: number }
const SKY: Record<Sky, SkyLook> = {
  day: { bg: '#eadfc8', hemi: 0.95, sun: 2.5, sunCol: '#fff0d0', sunPos: [260, 420, 160], ground: '#dcc59c', night: 0 },
  dusk: { bg: '#e9a678', hemi: 0.55, sun: 1.3, sunCol: '#ffaa66', sunPos: [-520, 90, 120], ground: '#c99a72', night: 0.35 },
  night: { bg: '#141b2d', hemi: 0.32, sun: 0.3, sunCol: '#8fa6ff', sunPos: [-200, 320, -120], ground: '#3e3a36', night: 1 },
  dawn: { bg: '#ead2b4', hemi: 0.75, sun: 1.7, sunCol: '#ffd6a4', sunPos: [520, 130, 60], ground: '#d6bd96', night: 0.1 },
};

/* ------------------------------------------------------------ 造型 */

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }));
  return matCache.get(key)!;
}
function mesh(geo: THREE.BufferGeometry, m: string | THREE.Material, pos: V = [0, 0, 0]) {
  const o = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m);
  o.position.set(...pos);
  o.castShadow = true;
  return o;
}

const SKIN = '#c9a07a';
const LOOK: Record<CastId, { robe: string; head: string; scale: number; priest?: boolean }> = {
  father: { robe: '#6f5236', head: '#d9cba8', scale: 1 },
  mother: { robe: '#8e4b3c', head: '#c9a46e', scale: 0.96 },
  daughter: { robe: '#b58a4f', head: '#e3cd9e', scale: 0.74 },
  priest: { robe: '#f3eee2', head: '#fbf8f0', scale: 1, priest: true },
};
export const CAST_NAME: Record<CastId, string> = { father: '父親', mother: '母親', daughter: '女兒', priest: '祭司' };

/** 從 Blender 模型（public/models/family.glb）複製一份，打開陰影 */
function part(lib: THREE.Object3D, name: string): THREE.Object3D {
  const src = lib.getObjectByName(name);
  if (!src) throw new Error(`family.glb 少了 ${name}`);
  const o = src.clone(true);
  o.position.set(0, 0, 0);
  o.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = true; });
  return o;
}

/**
 * 營中的人：身體、頭、臉、頭巾、鬍子在 Blender 做（scripts/blender/build_family.py），
 * 這裡組成可以動的骨架：本體朝 +Z，body 可以彎腰、躺下，兩隻手臂繞肩膀擺動。
 * 程式裡的 arm 放在 +X；人面向 +Z 時 +X 是他的左手，所以 body 左右鏡射，arm 才是右手
 * （利14:14 的右耳垂、右手大拇指、右腳大拇指都跟著到右邊）。
 */
function figure(id: CastId, lib: THREE.Object3D): THREE.Group {
  const L = LOOK[id];
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const body = new THREE.Group();
  body.scale.x = -1;
  g.add(body);
  const shell = part(lib, `${id}_body`);
  body.add(shell);
  // 袍子的材質每人一份：洗衣服時會亮一下
  const robe = new THREE.MeshStandardMaterial({ color: L.robe, roughness: 0.85 });
  const swapRobe = (o: THREE.Object3D) => o.traverse((m) => {
    const mm = m as THREE.Mesh;
    if (mm.isMesh && (mm.material as THREE.Material).name?.startsWith('robe_')) mm.material = robe;
  });
  swapRobe(shell);
  g.userData.robe = robe;
  g.userData.robeColor = L.robe;
  const cover: THREE.Object3D[] = [];
  if (L.priest) {
    body.add(part(lib, 'priest_cover'));
  } else if (id === 'father') {
    const c = part(lib, 'father_cover');
    body.add(c);
    cover.push(c);
    // 蓬頭散髮（哀悼時才出現）：幾綹亂髮
    const hair = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const lock = mesh(new THREE.ConeGeometry(0.1, 0.75, 5), '#3a2a1e', [Math.cos(a) * 0.42, 3.35, Math.sin(a) * 0.42]);
      lock.rotation.z = Math.cos(a) * 0.9;
      lock.rotation.x = -Math.sin(a) * 0.9;
      hair.add(lock);
    }
    hair.add(mesh(new THREE.SphereGeometry(0.53, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), '#3a2a1e', [0, 3.5, 0]));
    hair.visible = false;
    body.add(hair);
    g.userData.hair = hair;
    // 撕裂的衣服：胸前一道裂口
    const rip = new THREE.Group();
    rip.position.set(0, 2.05, 0.66);
    rip.rotation.x = -0.15;
    const gap = mesh(new THREE.PlaneGeometry(0.34, 1.9), mat('#24150c', { side: THREE.DoubleSide }));
    rip.add(gap);
    for (const sd of [1, -1]) {
      const flap = new THREE.Group();
      flap.position.x = sd * 0.17;
      const cloth = mesh(new THREE.PlaneGeometry(0.42, 1.9), mat(L.robe, { side: THREE.DoubleSide }), [sd * 0.21, 0, 0.02]);
      flap.add(cloth);
      flap.userData.side = sd;
      rip.add(flap);
    }
    rip.visible = false;
    body.add(rip);
    g.userData.rip = rip;
  }
  g.userData.cover = cover;
  // 手臂：Blender 模型的原點就在肩膀上
  const armSrc = lib.getObjectByName(`${id}_arm`)!;
  const shoulder = armSrc.position;
  const handY = new THREE.Box3().setFromObject(part(lib, `${id}_arm`)).min.y + 0.14;
  const arm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * Math.abs(shoulder.x), shoulder.y, 0);
    const a = part(lib, `${id}_arm`);
    swapRobe(a);
    pivot.add(a);
    pivot.rotation.z = side * 0.12;
    body.add(pivot);
    return pivot;
  };
  g.userData.arm = arm(1);
  g.userData.armL = arm(-1);
  g.userData.handY = handY;
  g.userData.body = body;
  g.scale.setScalar(L.scale);
  return g;
}

/** 帳棚：脊線沿 z，門在 +z 的山牆；頂點色讓門洞比較暗 */
function tentGeometry(): THREE.BufferGeometry {
  const W = 4.2, D = 3.6, H = 5.0;
  const tris: number[] = [];
  const cols: number[] = [];
  const tri = (a: number[], b: number[], c: number[], k: number) => {
    tris.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) cols.push(k, k, k);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], k: number) => { tri(a, b, c, k); tri(a, c, d, k); };
  quad([-W, 0, D], [-W, 0, -D], [0, H, -D], [0, H, D], 1.0);
  quad([W, 0, -D], [W, 0, D], [0, H, D], [0, H, -D], 0.9);
  tri([-W, 0, D], [0, H, D], [W, 0, D], 0.8);
  tri([W, 0, -D], [0, H, -D], [-W, 0, -D], 0.7);
  const e = D + 0.02;
  tri([-1.4, 0, e], [0, 3.2, e], [1.4, 0, e], 0.12);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function sandTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 214 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v * 0.92},${v * 0.8},${0.3 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(160, 160);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 小火堆：三片交叉的火焰面＋一盞點光 */
function campfire(): { group: THREE.Group; tick: (t: number) => void; light: THREE.PointLight } {
  const group = new THREE.Group();
  const fmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float sn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(n(i),n(i+vec2(1,0)),f.x), mix(n(i+vec2(0,1)),n(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv=vUv; float t=uTime*1.8;
        float shape = 1.0 - smoothstep(0.0, 0.5, abs(uv.x-0.5) * (1.4 + uv.y*2.0));
        float flick = sn(vec2(uv.x*5.0, uv.y*4.0 - t*2.0)) * 0.6 + sn(vec2(uv.x*11.0, uv.y*9.0 - t*3.5)) * 0.4;
        float a = shape * smoothstep(1.0, 0.1, uv.y) * (0.55 + flick*0.8);
        vec3 col = mix(vec3(1.0,0.35,0.05), vec3(1.0,0.85,0.4), smoothstep(0.55, 0.0, uv.y) * flick);
        gl_FragColor = vec4(col * a * 1.6, a);
      }`,
  });
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), fmat);
    p.position.y = 0.8;
    p.rotation.y = (i * Math.PI) / 3;
    group.add(p);
  }
  for (let i = 0; i < 4; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 6), '#4a3220', [0, 0.12, 0]);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i * Math.PI) / 4;
    group.add(log);
  }
  const ring = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ring.add(mesh(new THREE.DodecahedronGeometry(0.2, 0), '#8a8070', [Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75]));
  }
  group.add(ring);
  const light = new THREE.PointLight(0xff8a3a, 6, 22, 1.6);
  light.position.y = 1.2;
  group.add(light);
  return {
    group,
    light,
    tick: (t) => {
      fmat.uniforms.uTime.value = t;
      light.userData.flicker = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06;
    },
  };
}

/**
 * 瓦罐碎片怎麼飛：每片往外、往上彈出，落地彈一兩下、滑一點就停。
 * 用固定亂數預先算好每一格，播放、快轉、跳到某一步看到的結果都一樣。
 */
const SHATTER_MS = 1500;
type ShardPath = { obj: THREE.Object3D; rest: THREE.Vector3; pos: THREE.Vector3[]; rot: THREE.Euler[] };
function shatterPaths(list: THREE.Object3D[]): ShardPath[] {
  let seed = 33;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const steps = Math.round((SHATTER_MS / 1000) * 60);
  return list.map((obj) => {
    const rest = obj.position.clone();
    const out = new V3(rest.x, 0, rest.z);
    if (out.lengthSq() < 0.01) out.set(rnd() - 0.5, 0, rnd() - 0.5);
    out.normalize();
    const p = rest.clone();
    const v = out.multiplyScalar(1.6 + rnd() * 2.4).add(new V3(0, 1.2 + rnd() * 2.2 + rest.y * 0.8, 0));
    const r = new THREE.Euler(0, 0, 0);
    const w = new V3((rnd() - 0.5) * 14, (rnd() - 0.5) * 10, (rnd() - 0.5) * 14);
    const pos: THREE.Vector3[] = [];
    const rot: THREE.Euler[] = [];
    const dt = 1 / 60;
    for (let i = 0; i <= steps; i++) {
      pos.push(p.clone());
      rot.push(r.clone());
      v.y -= 22 * dt;
      p.addScaledVector(v, dt);
      const floor = 0.06;
      if (p.y < floor) {
        p.y = floor;
        v.y = Math.abs(v.y) * 0.3;
        v.x *= 0.55;
        v.z *= 0.55;
        w.multiplyScalar(0.5);
        if (v.y < 0.5) v.y = 0;
      }
      r.x += w.x * dt;
      r.y += w.y * dt;
      r.z += w.z * dt;
      // 落地以後翻滾慢慢停下來
      if (p.y <= 0.07) w.multiplyScalar(0.86);
    }
    return { obj, rest, pos, rot };
  });
}

function woodBowl(): THREE.Group {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.28, 0], [0.48, 0.18], [0.55, 0.38], [0.5, 0.4], [0.42, 0.22], [0.0, 0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(pts, 24), mat('#8a5a32', { side: THREE.DoubleSide })));
  g.scale.setScalar(1.3);
  return g;
}

function waterBasin(): THREE.Group {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.9, 0], [1.15, 0.2], [1.2, 0.62], [1.12, 0.64], [1.04, 0.25], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(pts, 28), mat('#9a7a58', { side: THREE.DoubleSide })));
  const water = mesh(new THREE.CircleGeometry(1.08, 26), mat('#5f93a8', { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }), [0, 0.5, 0]);
  water.rotation.x = -Math.PI / 2;
  g.add(water);
  return g;
}

/** 羊羔：四條腿可以擺，本體朝 +Z */
function lambModel(color = '#ebe3d0'): THREE.Group {
  const g = new THREE.Group();
  const h = 1.6, len = 2.2, r = h * 0.26, legH = h * 0.45;
  const body = mesh(new THREE.CapsuleGeometry(r, len * 0.5, 6, 14), color, [0, legH + r * 0.85, 0]);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const hip = new THREE.Group();
    hip.position.set(x * r * 0.55, legH, z * len * 0.3);
    hip.add(mesh(new THREE.CylinderGeometry(h * 0.07, h * 0.06, legH, 8), '#c9b894', [0, -legH / 2, 0]));
    g.add(hip);
    legs.push(hip);
  }
  const head = new THREE.Group();
  head.position.set(0, legH + r * 1.55, len * 0.48);
  head.add(mesh(new THREE.SphereGeometry(r * 0.62, 14, 10), '#c9b894'));
  head.add(mesh(new THREE.BoxGeometry(r * 0.7, r * 0.55, r * 0.7), '#c9b894', [0, -r * 0.18, r * 0.55]));
  g.add(head);
  g.userData.legs = legs;
  return g;
}

function doveModel(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.42, 14, 10), '#b8b3a8', [0, 0.45, 0]);
  body.scale.set(0.85, 0.8, 1.25);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.24, 12, 8), '#a8a296', [0, 0.82, 0.42]));
  const beak = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), '#d8a35a', [0, 0.8, 0.68]);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  const wings: THREE.Mesh[] = [];
  for (const s of [1, -1]) {
    const w = mesh(new THREE.SphereGeometry(0.3, 10, 6), '#9d978b', [s * 0.36, 0.5, -0.05]);
    w.scale.set(0.3, 0.7, 1.2);
    g.add(w);
    wings.push(w);
  }
  g.userData.wings = wings;
  g.scale.setScalar(1.15);
  return g;
}

/** 包在布裡的嬰孩 */
function babyModel(): THREE.Group {
  const g = new THREE.Group();
  const wrap = mesh(new THREE.CapsuleGeometry(0.28, 0.6, 6, 12), '#f3ead6');
  wrap.rotation.z = Math.PI / 2;
  g.add(wrap);
  g.add(mesh(new THREE.SphereGeometry(0.22, 14, 10), SKIN, [0.5, 0.05, 0]));
  return g;
}

/** 香柏木、朱紅色線、牛膝草綁成一束 */
function bundleModel(): THREE.Group {
  const g = new THREE.Group();
  const stick = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.4, 8), '#8a4a2a');
  stick.rotation.z = Math.PI / 2.4;
  g.add(stick);
  const thread = mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 16), '#c0182c', [0.05, 0.02, 0]);
  thread.rotation.y = Math.PI / 2;
  g.add(thread);
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), '#5f8a3a', [-0.55 + (i % 3) * 0.08, 0.32 + Math.floor(i / 3) * 0.1, (i % 2) * 0.08 - 0.04]));
  return g;
}

/** 瓦器盛活水 */
function vesselModel(): THREE.Group {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.45, 0.02], [0.68, 0.3], [0.7, 0.62], [0.62, 0.66], [0.58, 0.36], [0, 0.18]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(pts, 24), mat('#b4673e', { side: THREE.DoubleSide, roughness: 0.9 })));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.6, 22), new THREE.MeshStandardMaterial({ color: '#5f93a8', roughness: 0.15 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.55;
  g.add(water);
  g.userData.water = water;
  return g;
}

function flourModel(): THREE.Group {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.4, 0], [0.5, 0.3], [0.48, 0.42], [0, 0.42]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(pts, 20), '#9a7650'));
  g.add(mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#f4ecd8', [0, 0.38, 0]));
  return g;
}

function oilModel(): THREE.Group {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.28, 0], [0.36, 0.3], [0.3, 0.55], [0.14, 0.68], [0.12, 0.85], [0.16, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(pts, 20), '#c9a43a'));
  return g;
}

/** 營外的棚子：兩根柱子撐起一塊布 */
function shelterModel(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-2.6, 2.6]) g.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), '#6b4a2a', [-1.8, 1.8, z]));
  const cloth = mesh(new THREE.PlaneGeometry(5.6, 4.2), mat('#9d8a6a', { side: THREE.DoubleSide, roughness: 1 }), [0, 1.9, 0]);
  cloth.rotation.y = Math.PI / 2;
  cloth.rotation.x = -0.75;
  g.add(cloth);
  for (let i = 0; i < 5; i++) g.add(mesh(new THREE.DodecahedronGeometry(0.4 + (i % 2) * 0.2, 0), '#9a8f7c', [2.5 + (i % 3), 0.3, -2 + i]));
  return g;
}

function seatModel(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.7, 14), '#8a6a45', [0, 0.35, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.18, 14), '#b8604a', [0, 0.79, 0]));
  return g;
}

function matModel(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.3, 4.6), '#c9b48a', [0, 0.15, 0]));
  g.add(mesh(new THREE.BoxGeometry(2.2, 0.12, 1.2), '#e8dcc0', [0, 0.36, -1.6]));
  return g;
}

/** 關鎖用的小隔間：一圈木柱，掛著布幔 */
function boothModel(): THREE.Group {
  const g = new THREE.Group();
  const n = 10, r = 2.6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.2, 6), '#6b4a2a', [Math.cos(a) * r, 2.1, Math.sin(a) * r]));
  }
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3.2, 40, 1, true, 0.5, Math.PI * 1.55), new THREE.MeshStandardMaterial({ color: '#cdbb98', roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.82 }));
  cloth.position.y = 1.9;
  cloth.castShadow = true;
  g.add(cloth);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 48), mat('#7a5a3a'));
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 3.6;
  g.add(rope);
  return g;
}

/**
 * 地面光暈：碰到會不潔淨的東西。圓的給座位；rect＝[寬, 深] 時是貼著東西外緣的長方框（墊子），
 * 不用大圓圈，免得和站在旁邊的人的光圈疊在一起。
 */
function glowRing(r: number, rect?: [number, number]): THREE.Mesh {
  let geo: THREE.BufferGeometry = new THREE.RingGeometry(r, r + 0.3, 40);
  if (rect) {
    const [w, d] = rect;
    const box = (hw: number, hd: number) => [new THREE.Vector2(-hw, -hd), new THREE.Vector2(hw, -hd), new THREE.Vector2(hw, hd), new THREE.Vector2(-hw, hd)];
    const shape = new THREE.Shape(box(w / 2 + 0.55, d / 2 + 0.55));
    shape.holes.push(new THREE.Path(box(w / 2 + 0.25, d / 2 + 0.25)));
    geo = new THREE.ShapeGeometry(shape);
  }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#d9622b', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.07;
  return m;
}

/* ------------------------------------------------------------ 介面 */

export interface Camp {
  /** 演一步；animate=false 時直接跳到結果 */
  play(beat: Beat, animate: boolean): Promise<void>;
  /** 把正在演的動作快轉到結束 */
  stop(): Promise<void>;
  reset(): void;
  view(name: string, instant?: boolean): void;
  setAutoRotate(on: boolean): void;
  dispose(): void;
}

export interface CampOpts {
  reducedMotion: boolean;
  lowPower: boolean;
  /** 開場用：慢慢繞、顯示地名 */
  hero?: boolean;
}

export async function createCamp(host: HTMLElement, tagsHost: HTMLElement, opts: CampOpts): Promise<Camp> {
  const renderer = new THREE.WebGLRenderer({ antialias: !opts.lowPower, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, opts.lowPower ? 1 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !opts.lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '可以拖曳轉動的 3D 營地（示意重建，不按比例）');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY.day.bg);
  scene.fog = new THREE.Fog(SKY.day.bg, 420, 1500);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 4000);
  const start = opts.hero ? VIEWS.hero : VIEWS.camp;
  camera.position.copy(v3(start[0]));

  const hemi = new THREE.HemisphereLight(0xfff3dc, 0x8a6b44, SKY.day.hemi);
  const sun = new THREE.DirectionalLight(SKY.day.sunCol, SKY.day.sun);
  sun.castShadow = !opts.lowPower;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  const groundMat = new THREE.MeshStandardMaterial({ color: SKY.day.ground, map: sandTexture(), roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---- 會幕院子（Blender 模型，單位：肘）；人物、這一家的帳棚與瓦罐也是 Blender 做的 ---- */
  const loader = new GLTFLoader();
  const model = (f: string) => loader.loadAsync(new URL(`models/${f}`, document.baseURI).href);
  const [gltf, familyGltf, homeGltf] = await Promise.all([model('courtyard.glb'), model('family.glb'), model('home.glb')]);
  const lib = familyGltf.scene;
  const homeLib = homeGltf.scene;
  homeLib.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    o.castShadow = true;
    o.receiveShadow = !opts.lowPower;
  });
  // 用 glTF 節點（homeLib 的直接子節點）找：一個物件有幾種材質就會拆成幾片網格，
  // getObjectByName 可能只抓到其中一片（帳棚曾因此只剩深色的布、條紋處變成破洞）
  const homePart = (name: string) => {
    const o = homeLib.children.find((c) => c.name === name);
    if (!o) throw new Error(`home.glb 少了 ${name}`);
    return o;
  };
  const court = gltf.scene;
  court.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = !opts.lowPower;
    m.receiveShadow = !opts.lowPower;
    const mm = m.material as THREE.MeshStandardMaterial;
    if (mm.name === 'linen') { mm.side = THREE.DoubleSide; }
    if (mm.name === 'gate_weave' || mm.name === 'veil_weave') m.material = new THREE.MeshStandardMaterial({ color: '#7d4f8a', roughness: 0.85, side: THREE.DoubleSide });
  });
  scene.add(court);
  const courtFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 50), new THREE.MeshStandardMaterial({ color: '#e6d5b0', roughness: 1 }));
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.position.y = 0.03;
  courtFloor.receiveShadow = true;
  scene.add(courtFloor);

  /* ---- 雲彩：日間是雲，夜間雲中有火（出40:38） ---- */
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.93, emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 0 });
  const cloud = new THREE.Group();
  for (const [x, y, z, r] of [[0, 0, 0, 13], [-12, -4, 4, 9], [12, -2, -3, 10], [4, 9, 2, 8], [-6, 6, -5, 7], [16, -5, 6, 6]] as [number, number, number, number][]) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat);
    p.position.set(x, y, z);
    p.scale.set(1.2, 0.8, 1.05);
    cloud.add(p);
  }
  cloud.position.set(-36, 62, 0);
  scene.add(cloud);
  const cloudLight = new THREE.PointLight(0xff8a3c, 0, 260, 1.4);
  cloudLight.position.set(-36, 50, 0);
  scene.add(cloudLight);

  /* ---- 帳棚 ---- */
  const tentGeo = tentGeometry();
  const tentMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const spots: { x: number; z: number; tint: THREE.Color }[] = [];
  const near = (x: number, z: number, p: V, r: number) => Math.hypot(x - p[0], z - p[2]) < r;
  const tints = [new THREE.Color('#efe3c8'), new THREE.Color('#d9c4a0'), new THREE.Color('#c8ae86'), new THREE.Color('#8d7a62')];
  const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  // 利未人：圍著院子一圈（東邊留出到院門的路）
  for (let d = 0; d < 2; d++) {
    const ex = 66 + d * 13, ez = 40 + d * 13;
    for (let x = -ex; x <= ex; x += 13) for (const z of [-ez, ez]) spots.push({ x, z, tint: tints[0] });
    for (let z = -ez + 13; z <= ez - 13; z += 13) {
      spots.push({ x: -ex, z, tint: tints[0] });
      if (Math.abs(z) > 16) spots.push({ x: ex, z, tint: tints[0] });
    }
  }
  // 各支派：外圈（示意）
  for (let x = -240; x <= 240; x += 15) {
    for (let z = -205; z <= 205; z += 15) {
      if (Math.abs(x) < 112 && Math.abs(z) < 84) continue;
      if (x > 90 && Math.abs(z) < 9) continue; // 往東出營的路
      if (near(x, z, HOME, 15) || (x > 92 && x < 113 && z > 12 && z < 44)) continue; // 這一家和前面的空地
      const jx = (rand() - 0.5) * 4, jz = (rand() - 0.5) * 4;
      spots.push({ x: x + jx, z: z + jz, tint: tints[Math.floor(rand() * tints.length)] });
    }
  }
  const tents = new THREE.InstancedMesh(tentGeo, tentMat, spots.length);
  tents.castShadow = true;
  tents.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const up = new V3(0, 1, 0);
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, Math.atan2(-s.x, -s.z));
    m4.compose(new V3(s.x, 0, s.z), q, new V3(1, 1, 1));
    tents.setMatrixAt(i, m4);
    tents.setColorAt(i, col.copy(s.tint));
  });
  tents.instanceMatrix.needsUpdate = true;
  scene.add(tents);

  // 這一家的帳棚（Blender）：門朝西（朝會幕）
  const homeTent = homePart('home_tent');
  // 帳棚布是薄薄一層：從門口看進去也要看得到裡面，兩面都畫
  homeTent.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) m.side = THREE.DoubleSide;
  });
  homeTent.position.copy(v3(HOME));
  homeTent.rotation.y = -Math.PI / 2;
  scene.add(homeTent);

  // 夜裡帳棚門口的燈火
  const lampPos: number[] = [];
  spots.forEach((s, i) => {
    if (i % 3) return;
    const a = Math.atan2(-s.x, -s.z);
    lampPos.push(s.x + Math.sin(a) * 4.4, 1.3, s.z + Math.cos(a) * 4.4);
  });
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
  const glow = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,210,140,0.9)');
    grd.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const lampMat = new THREE.PointsMaterial({ color: '#ffb35a', map: glow, size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(lampGeo, lampMat));

  // 營的邊界（示意）
  const edgePts: THREE.Vector3[] = [];
  const EX = 262, EZ = 226, R = 40;
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const cx = Math.cos(t), cz = Math.sin(t);
    const x = Math.sign(cx) * (EX - R) + cx * R;
    const z = Math.sign(cz) * (EZ - R) + cz * R;
    edgePts.push(new V3(x, 0.4, z));
  }
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePts), new THREE.LineDashedMaterial({ color: '#8a5a2a', dashSize: 8, gapSize: 6, transparent: true, opacity: 0.7 }));
  edge.computeLineDistances();
  scene.add(edge);

  /* ---- 帳棚前的空地：火、瓦罐、木碗、水盆 ---- */
  const fire = campfire();
  fire.group.position.copy(v3(FIRE));
  scene.add(fire.group);
  // 瓦罐（Blender）：罐身含湯面、蓋子另外一件；打破時換成預先切好的碎片
  const pot = homePart('pot');
  pot.position.copy(v3(POT));
  scene.add(pot);
  const lid = homePart('pot_lid');
  scene.add(lid);
  const LID_ON = new V3(POT[0], POT_RIM, POT[2]);
  const LID_OFF = new V3(POT[0] - 0.4, 0.06, POT[2] + 1.55);
  const potShards = new THREE.Group();
  potShards.position.copy(v3(POT));
  potShards.visible = false;
  scene.add(potShards);
  const shardList = homeLib.children.filter((o) => o.name.startsWith('pot_shard_'));
  for (const s of shardList) potShards.add(s);
  const shardPath = shatterPaths(shardList);
  const spill = mesh(new THREE.CircleGeometry(1.25, 28), mat('#6e4324', { transparent: true, opacity: 0.85 }), [0, 0.03, 0]);
  spill.rotation.x = -Math.PI / 2;
  spill.castShadow = false;
  spill.receiveShadow = true;
  potShards.add(spill);
  const bowl = woodBowl();
  scene.add(bowl);
  const basin = waterBasin();
  basin.position.copy(v3(BASIN));
  scene.add(basin);
  const liz = homePart('lizard');
  liz.scale.setScalar(LIZ_SCALE);
  liz.visible = false;
  scene.add(liz);
  // 小桌（一塊平石）
  const table = mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.35, 10), '#a89a80', [TABLE[0], 0.17, TABLE[2]]);
  table.receiveShadow = true;
  scene.add(table);
  const BOWL_OUT = new V3(TABLE[0], 0.36, TABLE[2]);
  const BOWL_IN = new V3(BASIN[0], 0.42, BASIN[2]);

  /* ---- 12–15 章的道具：嬰孩、祭物、潔淨禮用的東西、家裡的床和座位 ---- */
  type Item = { obj: THREE.Object3D; home?: V; ring?: THREE.Mesh };
  const items = {} as Partial<Record<PropId, Item>>;
  const addItem = (id: PropId, obj: THREE.Object3D, home?: V, ring?: number, rect?: [number, number]) => {
    obj.visible = !!home && (id === 'seat' || id === 'mat');
    if (home) obj.position.copy(v3(home));
    scene.add(obj);
    const it: Item = { obj, home };
    if (ring) {
      it.ring = glowRing(ring, rect);
      it.ring.position.set(obj.position.x, 0.07, obj.position.z);
      scene.add(it.ring);
    }
    items[id] = it;
  };
  addItem('baby', babyModel());
  addItem('lamb', lambModel());
  addItem('lamb2', lambModel('#e6dcc6'));
  addItem('lamb3', lambModel('#f1ead8'));
  addItem('dove', doveModel());
  addItem('dove2', doveModel());
  addItem('bundle', bundleModel());
  addItem('vessel', vesselModel());
  addItem('flour', flourModel());
  addItem('oil', oilModel());
  addItem('shelter', shelterModel(), SHELTER);
  items.shelter!.obj.visible = false;
  addItem('booth', boothModel());
  addItem('seat', seatModel(), SEAT, 1.05);
  addItem('mat', matModel(), MAT, 1, [2.4, 4.6]);
  const altarFire = campfire();
  altarFire.group.scale.setScalar(2.2);
  altarFire.group.position.copy(v3(ALTAR_TOP));
  altarFire.group.visible = false;
  scene.add(altarFire.group);
  items.altar = { obj: altarFire.group };
  /** 跟著人走的道具：carry＝拿在手上或抱著，lead＝牽在身旁 */
  const follow = new Map<PropId, { who: CastId; how: 'carry' | 'lead'; k: number }>();
  /** 每樣道具放下時相對地點的偏移，避免疊在人身上 */
  const OFFSET: Partial<Record<PropId, V>> = {
    lamb: [1.8, 0, 0.8], lamb2: [2.8, 0, -0.6], lamb3: [3.6, 0, 1.0], dove: [-1.1, 0, 1.3], dove2: [-1.6, 0, 0.4],
    bundle: [-1.4, 0.05, 1.8], vessel: [0.2, 0, 2.1], booth: [0, 0, 0], flour: [-1.6, 0, -1.0], oil: [-2.2, 0, 0.3], baby: [0.9, 0.6, 0.9],
  };
  // 灑血、彈油用的小水滴
  const drops = new THREE.Group();
  for (let i = 0; i < 8; i++) drops.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: '#9e1b2a' })));
  drops.visible = false;
  scene.add(drops);

  /* ---- 聖物不能碰：院子四周一圈紅色警示 ---- */
  const barMat = new THREE.MeshBasicMaterial({ color: '#c0392b', transparent: true, opacity: 0, depthWrite: false });
  const bar = new THREE.Group();
  for (const [w, d, x, z] of [[112, 1.4, 0, 31], [112, 1.4, 0, -31], [1.4, 62, 56, 0], [1.4, 62, -56, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), barMat);
    b.position.set(x, 0.3, z);
    bar.add(b);
  }
  scene.add(bar);

  /* ---- 人物 ---- */
  const cast = {} as Record<CastId, THREE.Group>;
  const rings = {} as Record<CastId, THREE.Mesh>;
  const marks = {} as Record<CastId, Mark>;
  for (const id of ['father', 'mother', 'daughter', 'priest'] as CastId[]) {
    const f = figure(id, lib);
    f.visible = false;
    scene.add(f);
    cast[id] = f;
    const r = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.75, 40), new THREE.MeshBasicMaterial({ color: '#e0a030', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.08;
    f.add(r);
    rings[id] = r;
    marks[id] = 'clean';
  }
  // 父親手臂上的白斑：掛在右手臂上
  const spotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), new THREE.MeshStandardMaterial({ color: '#f4eadb', emissive: '#fff1d6', emissiveIntensity: 0.35, roughness: 0.85 }));
  spotMesh.scale.set(0.5, 1, 1);
  spotMesh.position.set(0.12, -0.75, 0.06);
  (cast.father.userData.arm as THREE.Group).add(spotMesh);
  spotMesh.visible = false;
  items.spot = { obj: spotMesh };
  const MARK_COLOR: Record<Mark, string> = {
    clean: '#2f7a48', evening: '#e0a030', seven: '#d9622b', purify: '#e8c060', shut: '#7a4ea2', unclean: '#b3263a', outside: '#b3263a', wait: '#2f6f8f', day8: '#2f6f8f',
  };
  const MARK_TEXT: Record<Mark, string> = {
    clean: '', evening: '不潔淨・到晚上', seven: '不潔淨・七天', purify: '潔淨的日子未滿', shut: '關鎖・七天', unclean: '不潔淨', outside: '獨居營外', wait: '帳棚外・七天', day8: '第八天・求潔淨',
  };
  // 頭上的日子計數（例如「第 8 天」）
  const dayTag = document.createElement('div');
  dayTag.className = 'day3d';
  tagsHost.append(dayTag);
  const sky3 = new THREE.Group();
  const discGlow = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.4)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const orb = (color: string, glowColor: string, r: number, glow: number) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshBasicMaterial({ color, fog: false }));
    // 淺色天空上用一般混色，光暈才看得見
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: discGlow, color: glowColor, transparent: true, opacity: glow, fog: false, depthWrite: false }));
    halo.scale.setScalar(r * 6.5);
    g.add(halo, m);
    return g;
  };
  const sunOrb = orb('#ff9d1f', '#ffb347', 46, 0.75);
  const moonOrb = orb('#cfdaf2', '#6f8fe0', 34, 0.6);
  // 月亮上的幾塊淡斑，一看就知道是月亮
  for (const [x, y, r] of [[-9, 8, 7], [10, -4, 9], [-4, -12, 5]] as [number, number, number][]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: '#a9b7d6', fog: false }));
    c.position.set(x, y, 34.5);
    moonOrb.add(c);
  }
  // 天上的軌道：一圈淡淡的虛線，看得出是在繞圈
  const trailPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    trailPts.push(new V3(Math.cos(a), Math.sin(a), 0));
  }
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(trailPts), new THREE.LineDashedMaterial({ color: '#c08a3a', dashSize: 0.03, gapSize: 0.025, transparent: true, opacity: 0.55, fog: false }));
  trail.computeLineDistances();
  sky3.add(trail);
  sky3.add(sunOrb, moonOrb);
  sky3.visible = false;
  scene.add(sky3);
  const orbC = new V3(), orbR = new V3(), orbF = new V3();
  /** 以目前的鏡頭方向，在遠方立一個直立的大圓；太陽、月亮在圓上相對而轉 */
  const ORB_R = 330;
  const aimOrbs = () => {
    // 鏡頭還在飛的話，用它要停下來的位置來對準
    const from = fly ? v3(fly.to[0]) : camera.position.clone();
    const to = fly ? v3(fly.to[1]) : controls.target.clone();
    orbF.subVectors(to, from);
    orbF.y = 0;
    orbF.normalize();
    orbR.set(-orbF.z, 0, orbF.x);
    orbC.copy(from).addScaledVector(orbF, 1100);
    orbC.y = -40;
    // 軌道放在同一個直立的平面上
    trail.position.copy(orbC);
    trail.scale.setScalar(ORB_R);
    trail.lookAt(orbC.clone().sub(orbF));
    moonOrb.lookAt(from);
  };
  const placeOrbs = (angle: number) => {
    const R = ORB_R;
    sunOrb.position.copy(orbC).addScaledVector(orbR, Math.cos(angle) * R).add(new V3(0, Math.sin(angle) * R, 0));
    moonOrb.position.copy(orbC).addScaledVector(orbR, Math.cos(angle + Math.PI) * R).add(new V3(0, Math.sin(angle + Math.PI) * R, 0));
  };
  const flashEl = document.createElement('div');
  flashEl.className = 'flash3d';
  tagsHost.append(flashEl);
  let followWho: CastId | null = null;
  const followOff = new V3(15, 10, 17);
  const followSm = new V3();
  const followPrev = new V3();
  let followSpeed = 0;
  let followFresh = true;
  const followT = new V3();
  let dolly = -1;
  const freeSays: HTMLElement[] = [];
  const rank = (el: HTMLElement) => (el.classList.contains('say') ? 0 : el.classList.contains('who') ? 1 : 2);

  /* ---- 名牌與地名（HTML） ---- */
  const tags: { el: HTMLElement; at: () => THREE.Vector3; show: () => boolean }[] = [];
  const addTag = (text: string, cls: string, at: () => THREE.Vector3, show: () => boolean = () => true) => {
    const el = document.createElement('div');
    el.className = `tag3d ${cls}`;
    el.textContent = text;
    tagsHost.append(el);
    tags.push({ el, at, show });
    return el;
  };
  const castTags = {} as Record<CastId, HTMLElement>;
  const tmpV = new V3();
  for (const id of Object.keys(cast) as CastId[]) {
    castTags[id] = addTag(CAST_NAME[id], `who who-${id}`, () => tmpV.copy(cast[id].position).add(new V3(0, 4.6 * LOOK[id].scale, 0)), () => cast[id].visible);
    castTags[id].dataset.who = id;
  }
  // 對話泡泡：在名牌上面
  const sayTags = {} as Record<CastId, HTMLElement>;
  const sayV = new V3();
  for (const id of Object.keys(cast) as CastId[]) {
    const el = addTag('', 'say', () => sayV.copy(cast[id].position).add(new V3(0, 4.0 * LOOK[id].scale + 1.0, 0)), () => cast[id].visible && !!sayTags[id]?.textContent);
    sayTags[id] = el;
  }
  const bigTag = (text: string, p: V) => addTag(text, 'place', () => v3(p));
  bigTag('會幕', [-20, 26, 0]);
  const homeTag = bigTag('這一家的帳棚', [HOME[0], 9, HOME[2]]);
  homeTag.classList.add('home');
  if (opts.hero) {
    bigTag('營中', [40, 8, 175]);
    bigTag('營外', [330, 4, -60]);
    bigTag('營的邊界（示意）', [262, 4, 120]);
  }
  const barTag = addTag('聖物：現在不能碰', 'warn', () => new V3(0, 14, 31), () => barMat.opacity > 0.05);

  /* ---- 相機 ---- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(v3(start[1]));
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 6;
  controls.maxDistance = 900;
  controls.autoRotate = !!opts.hero && !opts.reducedMotion;
  controls.autoRotateSpeed = 0.28;
  controls.screenSpacePanning = false;

  /** 鏡頭飛行：近的 1.2 秒、遠的最多 3 秒；遠距離時中途往上拱，不從帳棚、幔子中間穿過去 */
  let fly: { from: View; to: View; t: number; T: number; lift: number } | null = null;
  /**
   * 鏡頭位置依畫面寬窄調整：手機直式畫面左右比較窄，近景會把人切到畫面外，
   * 所以沿著視線往後拉，讓左右看得到的範圍和桌機差不多（最多拉遠 1.6 倍）。
   */
  const fitView = (v: View): View => {
    const wide = Math.tan(THREE.MathUtils.degToRad(19)) * 1.46;
    const now = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const k = Math.min(1.6, Math.max(1, wide / now));
    if (k === 1) return v;
    const t = v3(v[1]);
    return [v3(v[0]).sub(t).multiplyScalar(k).add(t).toArray() as V, v[1]];
  };
  const view = (name: string, instant = false) => {
    const raw = VIEWS[name];
    if (!raw) return;
    const v = fitView(raw);
    controls.autoRotate = false;
    if (instant || opts.reducedMotion) {
      camera.position.copy(v3(v[0]));
      controls.target.copy(v3(v[1]));
      fly = null;
    } else {
      const d = camera.position.distanceTo(v3(v[0]));
      fly = { from: [camera.position.toArray() as V, controls.target.toArray() as V], to: v, t: 0, T: Math.min(3, Math.max(1.2, 1.1 + d / 90)), lift: d > 30 ? Math.min(40, d * 0.2) : 0 };
    }
  };


  /* ---- 動畫：每個 tween 都能被快轉 ---- */
  type Anim = { t: number; ms: number; fn: (e: number) => void; done: () => void };
  const anims = new Set<Anim>();
  let skipping = false;
  let instantMode = false;
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const tween = (ms: number, fn: (e: number) => void, linear = false) => new Promise<void>((done) => {
    if (skipping || instantMode || opts.reducedMotion) { fn(1); done(); return; }
    anims.add({ t: 0, ms, fn: linear ? fn : (e) => fn(ease(e)), done });
  });
  const flush = () => {
    for (const a of anims) { a.fn(1); a.done(); }
    anims.clear();
  };

  /* ---- 天色 ---- */
  let skyFrom: SkyLook = SKY.day;
  let skyTo: SkyLook = SKY.day;
  let skyT = 1;
  const cA = new THREE.Color(), cB = new THREE.Color();
  const lerpC = (a: string, b: string, k: number) => cA.set(a).lerp(cB.set(b), k);
  function applySky(k: number) {
    const a = skyFrom, b = skyTo;
    const bg = lerpC(a.bg, b.bg, k).clone();
    (scene.background as THREE.Color).copy(bg);
    (scene.fog as THREE.Fog).color.copy(bg);
    hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;
    sun.intensity = a.sun + (b.sun - a.sun) * k;
    sun.color.copy(lerpC(a.sunCol, b.sunCol, k));
    sun.userData.dir = new V3(...a.sunPos).lerp(new V3(...b.sunPos), k).normalize();
    groundMat.color.copy(lerpC(a.ground, b.ground, k));
    const night = a.night + (b.night - a.night) * k;
    lampMat.opacity = Math.max(0, night - 0.2) * 1.1;
    cloudMat.emissiveIntensity = night * 1.4;
    cloudLight.intensity = night * 260;
    // 環境光也要跟著暗下來，不然夜裡帳棚還是白天的亮度
    scene.environmentIntensity = 0.6 * (1 - night * 0.85);
    tentMat.color.setScalar(1 - night * 0.55);
    renderer.toneMappingExposure = 1.05 + night * 0.1;
    homeLamp.intensity = night * 30;
  }
  const homeLamp = new THREE.PointLight(0xffb060, 0, 30, 1.5);
  homeLamp.position.set(HOME[0] - 5, 2.4, HOME[2]);
  scene.add(homeLamp);
  const setSky = (s: Sky) => {
    skyFrom = { ...skyTo };
    skyTo = SKY[s];
    if (skipping || instantMode || opts.reducedMotion) { skyT = 1; applySky(1); return; }
    skyT = 0;
  };
  applySky(1);

  /* ---- 動作 ---- */
  const at = (who: CastId, s: Spot) => {
    const f = cast[who];
    f.visible = true;
    f.position.copy(v3(SPOT[s]));
  };
  const faceTo = (f: THREE.Object3D, p: THREE.Vector3) => {
    f.rotation.y = Math.atan2(p.x - f.position.x, p.z - f.position.z);
  };
  /**
   * 走路：整條路線（含途經的地點）一次走完。
   * 短路程照正常步速；長路程（往會幕、出營、回家）開頭和結尾各約一秒照正常步速，
   * 中間加速快轉，不跳過、也不拖時間。回傳每個時間點（0–1）走到全程的幾成，以及總毫秒數。
   */
  const WALK_V = 7;
  function pace(dist: number): { ms: number; at: (e: number) => number; fast: (e: number) => number } {
    if (dist <= 26) {
      const ms = Math.max(450, (dist / WALK_V) * 1000);
      return { ms, at: (e) => e, fast: () => 0 };
    }
    const tA = 0.9, r = 0.5;
    let vf = Math.max(24, dist / 2.6);
    let hold = (dist - 2 * WALK_V * tA - (WALK_V + vf) * r) / vf;
    if (hold < 0) { vf = (dist - 2 * WALK_V * tA) / r - WALK_V; hold = 0; }
    const T = 2 * tA + 2 * r + hold;
    const sm = (x: number) => x * x * (3 - 2 * x);
    const vAt = (t: number) => {
      if (t < tA || t > T - tA) return WALK_V;
      if (t < tA + r) return WALK_V + (vf - WALK_V) * sm((t - tA) / r);
      if (t > T - tA - r) return WALK_V + (vf - WALK_V) * sm((T - tA - t) / r);
      return vf;
    };
    const N = 240;
    const cum = [0];
    for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + vAt(((i - 0.5) / N) * T) * (T / N));
    const total = cum[N];
    return {
      ms: T * 1000,
      at: (e) => {
        const x = Math.max(0, Math.min(1, e)) * N;
        const i = Math.min(N - 1, Math.floor(x));
        return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / total;
      },
      fast: (e) => (vAt(e * T) - WALK_V) / Math.max(1, vf - WALK_V),
    };
  }
  async function walk(who: CastId, to: Spot, via: Spot[] = []) {
    const f = cast[who];
    if (!f.visible) { at(who, to); return; }
    // 走開了，話就說完了：留在原地的泡泡會讓人以為還在那裡說
    sayTags[who].textContent = '';
    sayTags[who].classList.remove('now', 'say-in');
    (f.userData.arm as THREE.Group).rotation.set(0, 0, 0.12);
    const body = f.userData.body as THREE.Group;
    body.rotation.x = 0;
    const pts = [f.position.clone(), ...via.map((v) => v3(SPOT[v])), v3(SPOT[to])].filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]) > 0.05);
    if (pts.length < 2) return;
    const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const dist = lens.reduce((x, y) => x + y, 0);
    const p = pace(dist);
    faceTo(f, pts[1]);
    const tmp = new V3();
    await tween(p.ms, (e) => {
      // 走到路線上的哪一點
      let d = p.at(e) * dist;
      let k = 0;
      while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
      f.position.lerpVectors(pts[k], pts[k + 1], Math.min(1, d / Math.max(lens[k], 1e-6)));
      // 轉彎：看著前面一小段路，慢慢轉過去
      tmp.copy(pts[k + 1]);
      const want = Math.atan2(tmp.x - f.position.x, tmp.z - f.position.z);
      let dy = want - f.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      f.rotation.y += dy * 0.25;
      const fast = p.fast(e);
      body.position.y = e < 1 ? Math.abs(Math.sin(e * p.ms * 0.011)) * (0.18 - 0.08 * fast) : 0;
      body.rotation.x = e < 1 ? 0.14 * fast : 0;
    }, true);
    f.rotation.y = Math.atan2(pts[pts.length - 1].x - pts[pts.length - 2].x, pts[pts.length - 1].z - pts[pts.length - 2].z);
    body.position.y = 0;
    body.rotation.x = 0;
  }
  const handWorld = (f: THREE.Group, out = new V3(), left = false) => {
    const arm = f.userData[left ? 'armL' : 'arm'] as THREE.Group;
    return arm.localToWorld(out.set(0, f.userData.handY as number, 0));
  };
  let lizardInHand: CastId | null = null;
  /** 拿在手上的木碗、舉在胸前的瓦罐 */
  let bowlInHand: CastId | null = null;
  let potInHands: CastId | null = null;
  const handL = new V3(), handR = new V3();

  /**
   * 往後躺的角度 th（0＝坐直、π/2＝平躺）：身體繞臀部轉，臀部一直留在離地約 0.95 的高度，
   * 不是整個人從腳底翻倒。
   */
  const HIP = 1.4;
  const recline = (body: THREE.Group, th: number) => {
    body.rotation.x = -th;
    body.position.set(0, 0.95 - HIP * Math.cos(th), HIP * Math.sin(th));
  };

  async function act(who: CastId, a: string, to?: CastId, toward?: Spot) {
    const f = cast[who];
    const body = f.userData.body as THREE.Group;
    const arm = f.userData.arm as THREE.Group;
    if (a === 'sleeve') {
      // 抬起右手臂、低頭看
      await tween(700, (e) => { arm.rotation.x = -1.45 * e; arm.rotation.z = 0.12 - 0.5 * e; body.rotation.x = 0.22 * e; });
      return;
    }
    if (a === 'lean' && to) {
      // 祭司湊近，看很久
      faceTo(f, cast[to].position);
      await tween(500, (e) => (body.rotation.x = 0.42 * e));
      await tween(700, () => {});
      await tween(400, (e) => (body.rotation.x = 0.42 * (1 - e)));
      return;
    }
    if (a === 'rip' || a === 'loosen' || a === 'cover') {
      const cover = f.userData.cover as THREE.Object3D[];
      const hair = f.userData.hair as THREE.Group | undefined;
      const rip = f.userData.rip as THREE.Mesh | undefined;
      const armL = f.userData.armL as THREE.Group;
      if (a === 'rip' && rip) {
        // 雙手抓住胸前的衣襟，用力往兩邊拉開
        await tween(500, (e) => { arm.rotation.x = -1.25 * e; armL.rotation.x = -1.25 * e; arm.rotation.z = 0.12 - 0.35 * e; armL.rotation.z = -0.12 + 0.35 * e; });
        rip.visible = true;
        const flaps = rip.children.slice(1) as THREE.Group[];
        await tween(800, (e) => {
          rip.scale.set(1, Math.max(0.01, e), 1);
          flaps.forEach((f) => (f.rotation.y = -(f.userData.side as number) * 0.9 * e));
          arm.rotation.z = -0.23 + 0.95 * e;
          armL.rotation.z = 0.23 - 0.95 * e;
          body.rotation.x = -0.12 * Math.sin(e * Math.PI);
        });
        await tween(450, (e) => { arm.rotation.x = -1.25 * (1 - e); armL.rotation.x = -1.25 * (1 - e); arm.rotation.z = 0.72 - 0.6 * e; armL.rotation.z = -0.72 + 0.6 * e; });
      } else if (a === 'loosen') {
        await tween(400, (e) => (armL.rotation.x = -2.8 * e));
        cover.forEach((c) => (c.visible = false));
        if (hair) { hair.visible = true; hair.scale.setScalar(0.01); await tween(400, (e) => hair.scale.setScalar(Math.max(0.01, e))); }
        await tween(300, (e) => (armL.rotation.x = -2.8 * (1 - e)));
      } else {
        await tween(500, (e) => { armL.rotation.x = -2.55 * e; armL.rotation.z = -0.12 - 0.33 * e; });
      }
      return;
    }
    if (a === 'look') {
      // 看向某人／某處：慢慢轉過去，看著停一下；身體不彎（彎腰看起來像鞠躬）
      const p = to ? cast[to].position : toward ? v3(SPOT[toward]) : null;
      if (p) {
        const y0 = f.rotation.y;
        let dy = Math.atan2(p.x - f.position.x, p.z - f.position.z) - y0;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        if (Math.abs(dy) > 0.05) await tween(450, (e) => (f.rotation.y = y0 + dy * e));
      }
      await tween(450, () => {});
    } else if (a === 'bow') {
      if (to) faceTo(f, cast[to].position);
      await tween(500, (e) => (body.rotation.x = 0.5 * e));
      await tween(500, (e) => (body.rotation.x = 0.5 * (1 - e)));
    } else if (a === 'give' && to) {
      // 雙手捧著往前遞給對方，停一下，再收回來
      const armL = f.userData.armL as THREE.Group;
      faceTo(f, cast[to].position);
      faceTo(cast[to], f.position);
      await tween(500, (e) => { arm.rotation.x = -1.3 * e; armL.rotation.x = -1.3 * e; arm.rotation.z = 0.12 - 0.25 * e; armL.rotation.z = -0.12 + 0.25 * e; body.rotation.x = 0.12 * e; });
      // 手伸到對方面前的那一刻，手上的東西（抱著的、牽著的）都交到對方手上
      for (const [id, fl] of follow) if (fl.who === who) follow.set(id, { ...fl, who: to });
      await tween(500, () => {});
      await tween(450, (e) => { arm.rotation.x = -1.3 * (1 - e); armL.rotation.x = -1.3 * (1 - e); arm.rotation.z = -0.13 + 0.25 * e; armL.rotation.z = 0.13 - 0.25 * e; body.rotation.x = 0.12 * (1 - e); });
    } else if (a === 'pick') {
      // 彎腰從蜥蜴所在的地方（木碗裡）撿起來
      faceTo(f, liz.position);
      await tween(500, (e) => { arm.rotation.x = -1.0 * e; body.rotation.x = 0.38 * e; });
      lizardInHand = who;
      liz.visible = true;
      await tween(450, (e) => { arm.rotation.x = -1.0 + 0.2 * e; body.rotation.x = 0.38 * (1 - e); });
    } else if (a === 'throw') {
      // 往空地外面丟（北邊，沒有人的方向）
      const target = new V3(f.position.x - 2, 0.1, f.position.z - 10);
      faceTo(f, target);
      await tween(320, (e) => (arm.rotation.x = -0.8 - 1.7 * e));
      lizardInHand = null;
      const from = handWorld(f);
      await tween(800, (e) => {
        liz.position.lerpVectors(from, target, e);
        liz.position.y = from.y * (1 - e) + Math.sin(e * Math.PI) * 3.2 + 0.1 * e;
        liz.rotation.x = e * 9;
      }, true);
      liz.visible = false;
      await tween(350, (e) => (arm.rotation.x = -2.5 * (1 - e)));
    } else if (a === 'stir') {
      // 蹲在火邊照顧火、攪一攪湯
      faceTo(f, v3(FIRE));
      await tween(450, (e) => { body.position.y = -0.35 * e; body.rotation.x = 0.3 * e; arm.rotation.x = -0.9 * e; });
      await tween(1600, (e) => { arm.rotation.x = -0.9 - 0.25 * Math.sin(e * Math.PI * 4); arm.rotation.y = 0.35 * Math.cos(e * Math.PI * 4); }, true);
      await tween(450, (e) => { body.position.y = -0.35 * (1 - e); body.rotation.x = 0.3 * (1 - e); arm.rotation.x = -0.9 * (1 - e); arm.rotation.y = 0; });
    } else if (a === 'lift') {
      // 掀開瓦罐的蓋子，擱在旁邊地上
      faceTo(f, v3(POT));
      await tween(450, (e) => { arm.rotation.x = -1.25 * e; body.rotation.x = 0.25 * e; });
      const from = lid.position.clone();
      const up = from.clone().add(new V3(0, 0.7, 0));
      await tween(450, (e) => { lid.position.lerpVectors(from, up, e); lid.rotation.z = 0.5 * e; });
      await tween(550, (e) => {
        lid.position.lerpVectors(up, LID_OFF, e);
        lid.position.y += Math.sin(e * Math.PI) * 0.5;
        lid.rotation.z = 0.5 + 0.9 * e;
        arm.rotation.x = -1.25 + 0.5 * e;
      });
      await tween(350, (e) => { arm.rotation.x = -0.75 * (1 - e); body.rotation.x = 0.25 * (1 - e) + 0.32 * e; });
    } else if (a === 'recoil') {
      // 嚇一跳：兩手縮到胸前、身體往後仰、退一步
      const armL = f.userData.armL as THREE.Group;
      const back = new V3(Math.sin(f.rotation.y), 0, Math.cos(f.rotation.y)).multiplyScalar(-1.1);
      const from = f.position.clone();
      await tween(380, (e) => {
        arm.rotation.x = -1.7 * e; armL.rotation.x = -1.7 * e;
        arm.rotation.z = 0.12 - 0.5 * e; armL.rotation.z = -0.12 + 0.5 * e;
        body.rotation.x = 0.32 - 0.5 * e;
        f.position.copy(from).addScaledVector(back, e);
      });
      await tween(700, () => {});
      await tween(500, (e) => {
        arm.rotation.x = -1.7 * (1 - e); armL.rotation.x = -1.7 * (1 - e);
        arm.rotation.z = -0.38 + 0.5 * e; armL.rotation.z = 0.38 - 0.5 * e;
        body.rotation.x = -0.18 * (1 - e);
      });
    } else if (a === 'smash') {
      // 彎腰把瓦罐抱起來，舉過胸口，往地上一摔
      const armL = f.userData.armL as THREE.Group;
      faceTo(f, v3(POT));
      const both = (x: number) => { arm.rotation.x = x; armL.rotation.x = x; };
      await tween(500, (e) => { both(-0.9 * e); body.rotation.x = 0.45 * e; arm.rotation.z = 0.12 - 0.3 * e; armL.rotation.z = -0.12 + 0.3 * e; });
      potInHands = who;
      await tween(650, (e) => { both(-0.9 - 0.9 * e); body.rotation.x = 0.45 - 0.6 * e; });
      await tween(300, () => {});
      // 往前下方摔：瓦罐離手，加速落回原來的地方
      potInHands = null;
      const from = pot.position.clone();
      const fromQ = pot.rotation.x;
      await tween(330, (e) => { both(-1.8 + 1.3 * e); body.rotation.x = -0.15 + 0.5 * e; pot.position.lerpVectors(from, v3(POT), e * e); pot.rotation.x = fromQ + 0.4 * e; }, true);
      pot.rotation.x = 0;
      await prop('pot', 'broken');
      await tween(400, (e) => { both(-0.5 * (1 - e)); body.rotation.x = 0.35 * (1 - e); arm.rotation.z = -0.18 + 0.3 * e; armL.rotation.z = 0.18 - 0.3 * e; });
    } else if (a === 'dip') {
      faceTo(f, v3(BASIN));
      await tween(400, (e) => (arm.rotation.x = -1.0 * e));
      await tween(400, (e) => (arm.rotation.x = -1.0 * (1 - e)));
    } else if (a === 'wave') {
      // 搖祭：雙手捧著，在耶和華面前前後搖
      const armL = f.userData.armL as THREE.Group;
      if (to) faceTo(f, cast[to].position);
      await tween(350, (e) => { arm.rotation.x = -1.4 * e; armL.rotation.x = -1.4 * e; });
      for (let i = 0; i < 3; i++) {
        await tween(380, (e) => { const k = -1.4 - 0.5 * Math.sin(e * Math.PI); arm.rotation.x = k; armL.rotation.x = k; body.rotation.x = 0.12 * Math.sin(e * Math.PI); });
      }
      await tween(350, (e) => { arm.rotation.x = -1.4 * (1 - e); armL.rotation.x = -1.4 * (1 - e); });
    } else if (a === 'sprinkle' && to) {
      // 灑七次：每一次一顆水滴飛到那人身上，頭上的泡泡數次數
      const target = cast[to];
      faceTo(f, target.position);
      drops.visible = true;
      const d0 = drops.children[0] as THREE.Mesh;
      for (let n = 1; n <= 7; n++) {
        sayTags[who].textContent = `灑第 ${n} 次`;
        sayTags[who].classList.add('now');
        await tween(160, (e) => (arm.rotation.x = -0.6 - 0.9 * e));
        const from = handWorld(f);
        const dest = target.position.clone().add(new V3(0, 2.4, 0));
        await tween(260, (e) => {
          d0.position.lerpVectors(from, dest, e);
          d0.position.y += Math.sin(e * Math.PI) * 0.8;
        }, true);
        await tween(140, (e) => (arm.rotation.x = -1.5 + 0.9 * e));
      }
      drops.visible = false;
      arm.rotation.x = 0;
      sayTags[who].textContent = '';
    } else if ((a === 'daub' || a === 'oil') && to) {
      // 右耳垂、右手大拇指、右腳大拇指；油還要抹在頭上
      const target = cast[to];
      faceTo(f, target.position);
      faceTo(target, f.position);
      const tb = target.userData.body as THREE.Group;
      const tarm = target.userData.arm as THREE.Group;
      const color = a === 'daub' ? '#a01d2c' : '#e2b23a';
      const dy = a === 'oil' ? 0.06 : 0;
      const spots: [THREE.Object3D, V][] = [[tb, [0.5, 3.43 + dy, 0.08]], [tarm, [0, -1.36 + dy, 0.12]], [tb, [0.42, 0.08 + dy, 0.95]]];
      if (a === 'oil') spots.push([tb, [0, 3.96, 0.1]]);
      const list = (target.userData.dots ??= []) as THREE.Object3D[];
      for (const [parent, p] of spots) {
        await tween(300, (e) => (arm.rotation.x = -1.2 * e));
        const dot = new THREE.Mesh(new THREE.SphereGeometry(a === 'oil' && p[1] > 3.9 ? 0.22 : 0.13, 10, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 }));
        dot.position.set(...p);
        parent.add(dot);
        list.push(dot);
        await tween(260, (e) => dot.scale.setScalar(Math.max(0.01, e)));
        await tween(220, (e) => (arm.rotation.x = -1.2 * (1 - e)));
      }
    } else if (a === 'mourn') {
      // 撕裂衣服、蓬頭散髮、蒙著上唇（利13:45）
      const cover = f.userData.cover as THREE.Object3D[];
      const hair = f.userData.hair as THREE.Group | undefined;
      const rip = f.userData.rip as THREE.Mesh | undefined;
      const armL = f.userData.armL as THREE.Group;
      if (rip) { rip.visible = true; await tween(350, (e) => rip.scale.set(1, Math.max(0.01, e), 1)); }
      cover.forEach((c) => (c.visible = false));
      if (hair) hair.visible = true;
      await tween(500, (e) => { armL.rotation.x = -2.55 * e; armL.rotation.z = -0.45 * e; });
    } else if (a === 'shave') {
      const cover = f.userData.cover as THREE.Object3D[];
      const hair = f.userData.hair as THREE.Group | undefined;
      const armL = f.userData.armL as THREE.Group;
      await tween(300, (e) => { armL.rotation.x = -2.55 * (1 - e); armL.rotation.z = -0.45 * (1 - e); });
      cover.forEach((c) => (c.visible = false));
      if (hair) await tween(500, (e) => hair.scale.setScalar(Math.max(0.01, 1 - e)));
      if (hair) { hair.visible = false; hair.scale.setScalar(1); }
    } else if (a === 'restore') {
      const cover = f.userData.cover as THREE.Object3D[];
      const rip = f.userData.rip as THREE.Mesh | undefined;
      const armL = f.userData.armL as THREE.Group;
      if (rip) rip.visible = false;
      cover.forEach((c) => (c.visible = true));
      armL.rotation.set(0, 0, -0.12);
      (f.userData.robe as THREE.MeshStandardMaterial).color.set(f.userData.robeColor as string);
    } else if (a === 'flick') {
      // 在耶和華面前用指頭彈油七次（朝會幕的方向）
      const armL = f.userData.armL as THREE.Group;
      f.rotation.y = -Math.PI / 2;
      await tween(300, (e) => (armL.rotation.x = -1.2 * e));
      drops.visible = true;
      const d0 = drops.children[0] as THREE.Mesh;
      (d0.material as THREE.MeshBasicMaterial).color.set('#e2b23a');
      for (let n = 1; n <= 7; n++) {
        sayTags[who].textContent = `彈第 ${n} 次`;
        sayTags[who].classList.add('now');
        await tween(150, (e) => (arm.rotation.x = -0.9 - 0.6 * e));
        const from = handWorld(f);
        const dest = from.clone().add(new V3(-3, 0.4, 0));
        await tween(240, (e) => d0.position.lerpVectors(from, dest, e), true);
        await tween(120, (e) => (arm.rotation.x = -1.5 + 0.6 * e));
      }
      drops.visible = false;
      (d0.material as THREE.MeshBasicMaterial).color.set('#9e1b2a');
      sayTags[who].textContent = '';
      arm.rotation.x = 0;
      armL.rotation.x = 0;
    } else if (a === 'wash') {
      // 洗衣服、洗澡：衣服顏色亮起來一下；撕裂的衣服也換掉
      const rip = f.userData.rip as THREE.Object3D | undefined;
      if (rip) rip.visible = false;
      (f.userData.armL as THREE.Group).rotation.set(0, 0, -0.12);
      const robe = f.userData.robe as THREE.MeshStandardMaterial;
      const c0 = new THREE.Color(f.userData.robeColor as string);
      await tween(700, (e) => robe.color.copy(c0).lerp(new THREE.Color('#ffffff'), Math.sin(e * Math.PI) * 0.6));
      robe.color.copy(c0);
    } else if (a === 'offer') {
      // 獻在壇上：祭司舉手，壇上的火旺起來
      const armL = f.userData.armL as THREE.Group;
      altarFire.group.visible = true;
      await tween(500, (e) => { arm.rotation.x = -2.2 * e; armL.rotation.x = -2.2 * e; altarFire.group.scale.setScalar(2.2 + 1.2 * e); });
      await tween(700, (e) => { arm.rotation.x = -2.2 * (1 - e); armL.rotation.x = -2.2 * (1 - e); altarFire.group.scale.setScalar(3.4 - 1.2 * e); });
    } else if (a === 'sit') {
      // 坐下：面向煮飯的地方，身體往下沉一點、微微後仰
      faceTo(f, v3(SPOT.yard));
      await tween(450, (e) => { body.position.y = -0.55 * e; body.rotation.x = -0.1 * e; });
    } else if (a === 'stand') {
      if (body.rotation.x < -1) {
        // 從躺著起身：照躺下的路倒回去，先坐起來再站
        await tween(900, (e) => recline(body, (1 - e) * (Math.PI / 2 + 0.15) - 0.15));
        await tween(450, (e) => { body.position.set(0, -0.45 * (1 - e), 0); body.rotation.x = 0.15 * (1 - e); });
        return;
      }
      const y0 = body.position.y;
      const z0 = body.position.z;
      const x0 = body.rotation.x;
      await tween(450, (e) => { body.position.y = y0 * (1 - e); body.position.z = z0 * (1 - e); body.rotation.x = x0 * (1 - e); });
    } else if (a === 'lie') {
      // 躺到墊子上：先坐下，再以臀部為軸往後躺平，頭朝北（−z）枕在枕頭上
      f.rotation.y = 0;
      await tween(500, (e) => { body.position.set(0, -0.45 * e, 0); body.rotation.x = 0.15 * e; });
      await tween(1000, (e) => recline(body, e * (Math.PI / 2 + 0.15) - 0.15));
    } else if (a === 'touch' && to === undefined) {
      const it = [items.seat!.obj, items.mat!.obj].sort((p, q) => p.position.distanceTo(f.position) - q.position.distanceTo(f.position))[0];
      faceTo(f, it.position);
      await tween(450, (e) => { arm.rotation.x = -1.1 * e; body.rotation.x = 0.3 * e; });
      await tween(450, (e) => { arm.rotation.x = -1.1 * (1 - e); body.rotation.x = 0.3 * (1 - e); });
    }
  }

  async function prop(id: PropId, state: string) {
    if (id === 'pot') {
      if (state === 'whole') { pot.visible = true; potShards.visible = false; return; }
      if (state === 'gone') { pot.visible = false; potShards.visible = false; return; }
      if (state === 'broken') {
        // 罐子一落地就碎：碎片往四面彈開，湯灑一地；湯裡的死蜥蜴被甩出來，掉進桌上的木碗（利11:32）
        pot.visible = false;
        potShards.visible = true;
        const lizFrom = liz.position.clone();
        const lizTo = BOWL_OUT.clone().add(new V3(0, 0.3, 0));
        const steps = shardPath[0].pos.length - 1;
        await tween(SHATTER_MS, (e) => {
          const i = Math.min(steps, Math.round(e * steps));
          for (const sp of shardPath) {
            sp.obj.position.copy(sp.pos[i]);
            sp.obj.rotation.copy(sp.rot[i]);
          }
          spill.scale.setScalar(0.25 + 0.75 * Math.min(1, e * 2.2));
          if (liz.visible && !lizardInHand) {
            const k = Math.min(1, e * 1.6);
            liz.position.lerpVectors(lizFrom, lizTo, k);
            liz.position.y += Math.sin(k * Math.PI) * 1.6;
            liz.rotation.y = 0.6 + k * 2.4;
          }
        }, true);
      }
    } else if (id === 'lizard') {
      if (state === 'pot') {
        // 浮在湯面上，肚子朝上
        liz.visible = true;
        liz.position.set(POT[0] + 0.05, SOUP_Y + 0.08, POT[2] - 0.05);
        liz.rotation.set(0, 0.6, 0);
        liz.scale.setScalar(LIZ_SCALE);
      } else liz.visible = false;
    } else if (id === 'bowl') {
      const [kind, who] = state.split(':');
      if (kind === 'carry') { bowlInHand = who as CastId; return; }
      bowlInHand = null;
      const from = bowl.position.clone();
      const to = state === 'water' ? BOWL_IN : BOWL_OUT;
      if (from.distanceTo(to) < 0.01) return;
      await tween(700, (e) => {
        bowl.position.lerpVectors(from, to, e);
        bowl.position.y += Math.sin(e * Math.PI) * 0.6;
      });
    } else if (id === 'fire') {
      fire.group.visible = state === 'on';
    } else {
      await itemState(id, state);
    }
  }

  async function itemState(id: PropId, state: string) {
    const it = items[id];
    if (!it) return;
    const o = it.obj;
    const [kind, arg] = state.split(':');
    if (kind === 'hide') { follow.delete(id); o.visible = false; return; }
    if (kind === 'off' && id === 'spot' && o.visible) {
      // 斑慢慢淡掉
      const s0 = o.scale.clone();
      await tween(1200, (e) => o.scale.copy(s0).multiplyScalar(Math.max(0.01, 1 - e)));
      o.visible = false;
      return;
    }
    if (kind === 'on' || kind === 'off') {
      o.visible = kind === 'on';
      if (id === 'spot' && kind === 'on') { o.scale.set(0.01, 0.01, 0.01); await tween(600, (e) => o.scale.set(Math.max(0.01, 0.5 * e), Math.max(0.01, e), Math.max(0.01, e))); }
      return;
    }
    if (kind === 'big') {
      // 斑擴散開來
      await tween(1400, (e) => o.scale.set(0.5 + 0.1 * e, 1 + 0.8 * e, 1 + 0.6 * e));
      return;
    }
    if (kind === 'at') {
      follow.delete(id);
      const off = OFFSET[id] ?? [0, 0, 0];
      const p = v3(SPOT[arg as Spot]).add(v3(off));
      const wasHidden = !o.visible;
      o.visible = true;
      o.rotation.set(0, Math.random() * 0.6 - 0.3 + (id.startsWith('lamb') ? -Math.PI / 2 : 0), 0);
      if (wasHidden && id === 'booth') {
        o.position.copy(p);
        o.rotation.y = 0;
        await tween(900, (e) => o.scale.set(1, Math.max(0.01, e), 1));
      } else if (wasHidden) {
        o.position.copy(p);
        const s0 = o.scale.x || 1;
        await tween(350, (e) => o.scale.setScalar(s0 * (0.3 + 0.7 * e)));
      } else {
        const from = o.position.clone();
        await tween(500, (e) => o.position.lerpVectors(from, p, e));
      }
      return;
    }
    if (kind === 'carry' || kind === 'lead') {
      o.visible = true;
      o.rotation.set(0, 0, 0);
      const k = [...follow.values()].filter((f) => f.who === arg && f.how === kind).length;
      follow.set(id, { who: arg as CastId, how: kind, k });
      return;
    }
    if (kind === 'fly') {
      // 活鳥飛走：往上、往遠處，翅膀拍動
      follow.delete(id);
      const from = o.position.clone();
      // 方向順著 outsideWide 鏡頭看出去的方向（營外的田野），整段都在畫面裡
      const to = from.clone().add(new V3(36, 10, -22));
      const wings = o.userData.wings as THREE.Mesh[];
      await tween(3200, (e) => {
        o.position.lerpVectors(from, to, e);
        o.position.y += Math.sin(Math.min(1, e * 2) * Math.PI / 2) * 2.4;
        o.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        wings.forEach((w, i) => (w.rotation.z = Math.sin(e * 70) * 0.9 * (i ? -1 : 1)));
        o.scale.setScalar(1.3 * (1 - e * 0.2));
      }, true);
      o.visible = false;
      o.scale.setScalar(1.15);
      return;
    }
    if (kind === 'slain') {
      // 宰在瓦器上面：只用符號表示，鳥躺下，瓦器裡的水染紅
      follow.delete(id);
      const v = items.vessel!.obj;
      const p = v.position.clone().add(new V3(0, 0.65, 0));
      const from = o.position.clone();
      await tween(500, (e) => o.position.lerpVectors(from, p, e));
      await tween(400, (e) => (o.rotation.z = 1.5 * e));
      const water = v.userData.water as THREE.Mesh;
      const wm = water.material as THREE.MeshStandardMaterial;
      const c0 = wm.color.clone();
      await tween(700, (e) => wm.color.copy(c0).lerp(new THREE.Color('#8e2a2a'), e));
      return;
    }
    if (kind === 'glow' || kind === 'plain') {
      const rm = it.ring?.material as THREE.MeshBasicMaterial | undefined;
      if (!rm) return;
      const from = rm.opacity;
      await tween(500, (e) => (rm.opacity = from + ((kind === 'glow' ? 0.8 : 0) - from) * e));
    }
  }

  async function setMark(who: CastId, m: Mark) {
    marks[who] = m;
    const ring = rings[who];
    const rm = ring.material as THREE.MeshBasicMaterial;
    rm.color.set(MARK_COLOR[m]);
    castTags[who].textContent = MARK_TEXT[m] ? `${CAST_NAME[who]}・${MARK_TEXT[m]}` : CAST_NAME[who];
    castTags[who].dataset.mark = m;
    const target = m === 'clean' ? 0 : 0.85;
    const from = rm.opacity;
    await tween(500, (e) => (rm.opacity = from + (target - from) * e));
  }

  async function setBar(on: boolean) {
    const from = barMat.opacity;
    await tween(600, (e) => (barMat.opacity = from + ((on ? 0.55 : 0) - from) * e));
  }

  async function cue(c: Cue) {
    switch (c.t) {
      case 'cam': followWho = null; view(c.view, skipping || instantMode || !!c.cut); return;
      case 'follow':
        followWho = c.who;
        fly = null;
        controls.autoRotate = false;
        followFresh = true;
        followSpeed = 0;
        followPrev.copy(cast[c.who].position);
        return;
      case 'wait': await tween(c.ms, () => {}); return;
      case 'together': await Promise.all(c.cues.map((x) => cue(x))); return;
      case 'flash':
        flashEl.style.setProperty('--fc', c.color);
        flashEl.classList.remove('on');
        void flashEl.offsetWidth;
        if (!(skipping || instantMode || opts.reducedMotion)) flashEl.classList.add('on');
        return;
      case 'sayAt': {
        const el = document.createElement('div');
        el.className = 'tag3d say now say-in';
        el.textContent = c.text;
        tagsHost.append(el);
        const near = c.near ? cast[c.near] : null;
        const p = v3(SPOT[c.at]).add(new V3(4, 7, 0));
        const nearV = new V3();
        tags.push({ el, at: () => (near ? nearV.copy(near.position).add(new V3(0, 3.2 * near.scale.y, 0)) : p), show: () => el.isConnected });
        freeSays.push(el);
        await tween(1400, () => {});
        return;
      }
      case 'count': {
        // 時間快轉：光線不變，只讓天數往上數、下面的小格子一格一格填滿
        const span = c.to - c.from;
        const total = Math.max(c.to, 1);
        const render = (n: number) => {
          dayTag.replaceChildren(
            Object.assign(document.createElement('b'), { textContent: c.label.replace('{n}', String(n)) }),
            Object.assign(document.createElement('i'), { className: 'day-bar', style: `--p:${(n / total) * 100}%` }));
          dayTag.classList.add('on');
        };
        // 太陽、月亮轉圈：一天一圈；天數很多時轉速有上限，免得變成閃爍
        const ms = Math.min(7500, 1800 + span * 280);
        const turns = Math.min(span, (ms / 1000) * 0.9);
        aimOrbs();
        sky3.visible = !(skipping || instantMode || opts.reducedMotion);
        await tween(ms, (e) => {
          render(Math.round(c.from + span * e));
          // 從東邊（右）升起、往西邊（左）落下
          placeOrbs(-Math.PI * 0.05 + e * turns * Math.PI * 2);
        }, true);
        sky3.visible = false;
        render(c.to);
        return;
      }
      case 'sky': setSky(c.sky); return;
      case 'sunset': {
        // 太陽在鏡頭前方慢慢沉到地平線下，天色同時轉暗（不是整個畫面閃一下）
        setSky('night');
        if (skipping || instantMode || opts.reducedMotion) return;
        aimOrbs();
        trail.visible = false;
        moonOrb.visible = false;
        sky3.visible = true;
        await tween(3400, (e) => {
          const el = 0.42 - 0.62 * e;
          sunOrb.position.copy(orbC).addScaledVector(orbR, -ORB_R * 0.18).add(new V3(0, Math.sin(el) * ORB_R + 30, 0));
          (sunOrb.children[1] as THREE.Mesh).scale.setScalar(1 + 0.15 * e);
        }, true);
        sky3.visible = false;
        trail.visible = true;
        moonOrb.visible = true;
        return;
      }
      case 'at': at(c.who, c.to); return;
      case 'walk': await walk(c.who, c.to, c.via); return;
      case 'day':
        dayTag.textContent = c.text;
        dayTag.classList.toggle('on', !!c.text);
        return;
      case 'show': cast[c.who].visible = c.on; return;
      case 'mark': await setMark(c.who, c.mark); return;
      case 'bar': await setBar(c.on); return;
      case 'prop': await prop(c.id, c.state); return;
      case 'act':
        if (c.toward && c.act !== 'look') faceTo(cast[c.who], v3(SPOT[c.toward]));
        await act(c.who, c.act, c.to, c.toward); return;
      case 'say': {
        const f = cast[c.who];
        if (c.to) faceTo(f, cast[c.to].position);
        for (const el of Object.values(sayTags)) el.classList.remove('now');
        const el = sayTags[c.who];
        el.textContent = c.text;
        el.classList.remove('say-in');
        void el.offsetWidth;
        el.classList.add('say-in', 'now');
        const arm = f.userData.armL as THREE.Group;
        await tween(420, (e) => (arm.rotation.x = -0.9 * Math.sin(e * Math.PI)));
        await tween(500, () => {});
        return;
      }
    }
  }

  let cur: Promise<void> = Promise.resolve();

  /* ---- 每一格 ---- */
  let running = true;
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(host);
  const clock = new THREE.Clock();
  const resize = () => {
    const w = host.clientWidth;
    const hh = host.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / Math.max(1, hh);
    camera.fov = w < 640 ? 50 : 38;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const sunDir = new V3(...SKY.day.sunPos).normalize();
  sun.userData.dir = sunDir.clone();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const dt = Math.max(0, Math.min(0.25, clock.getDelta()));
    const t = clock.elapsedTime;
    for (const a of [...anims]) {
      a.t += dt * 1000;
      const k = Math.min(1, a.t / a.ms);
      a.fn(k);
      if (k >= 1) { anims.delete(a); a.done(); }
    }
    if (skyT < 1) {
      skyT = Math.min(1, skyT + dt / 2.4);
      applySky(ease(skyT));
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / fly.T);
      const e = ease(fly.t);
      camera.position.lerpVectors(v3(fly.from[0]), v3(fly.to[0]), e);
      camera.position.y += Math.sin(e * Math.PI) * fly.lift;
      controls.target.lerpVectors(v3(fly.from[1]), v3(fly.to[1]), e);
      if (fly.t >= 1) {
        fly = null;
        if (opts.hero && !opts.reducedMotion) {
          controls.autoRotateSpeed = 0.28;
          controls.autoRotate = true;
        } else dolly = 0;
      }
    }
    // 跟拍：鏡頭在走路的人斜後上方，看得到他往哪裡走。
    // 位置直接跟住人（高速移動時才不會落後、穿過帳棚），只有角度和高度慢慢轉過去；
    // 走得越快，鏡頭升得越高、拉得越遠，越過帳棚和院子的幔子。
    if (followWho && !fly) {
      const f = cast[followWho];
      const ry = f.rotation.y;
      const speed = followPrev.distanceTo(f.position) / Math.max(dt, 1e-3);
      followPrev.copy(f.position);
      followSpeed += (Math.min(speed, 80) - followSpeed) * Math.min(1, dt * 3);
      const lift = Math.min(1, followSpeed / 40);
      const back = 13 + 9 * lift;
      followOff.set(-Math.sin(ry) * back + Math.cos(ry) * 5, 9 + 9 * lift, -Math.cos(ry) * back - Math.sin(ry) * 5);
      if (followFresh) {
        // 從上一個鏡頭接過來；但上一個鏡頭若貼在這個人身邊（近景），直接換到跟拍位置，免得貼著他的背走一段
        followSm.copy(camera.position).sub(f.position);
        if (followSm.length() < 11) followSm.copy(followOff);
        followFresh = false;
      }
      followSm.lerp(followOff, Math.min(1, dt * 2.2));
      camera.position.copy(f.position).add(followSm);
      controls.target.lerp(followT.copy(f.position).add(new V3(0, 2.2, 0)), Math.min(1, dt * 14));
    } else if (dolly >= 0 && dolly < 9 && !opts.reducedMotion) {
      // 讀字幕的時候，鏡頭很慢地往前推一點，畫面不會停死，也不會轉走
      dolly += dt;
      camera.position.lerp(controls.target, dt * 0.028);
    }
    controls.update();
    // 陰影跟著鏡頭看的地方走：近看清楚，遠看涵蓋整個營
    const dist = camera.position.distanceTo(controls.target);
    const span = Math.min(420, Math.max(30, dist * 0.75));
    const sc = sun.shadow.camera;
    if (Math.abs(sc.right - span) > 1) {
      Object.assign(sc, { left: -span, right: span, top: span, bottom: -span, near: 1, far: span * 6 });
      sc.updateProjectionMatrix();
    }
    const dir = sun.userData.dir as THREE.Vector3;
    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).addScaledVector(dir, span * 2.5);
    fire.tick(t);
    fire.light.intensity = 6 * (fire.light.userData.flicker ?? 1);
    for (const r of Object.values(rings)) {
      const m = r.material as THREE.MeshBasicMaterial;
      if (m.opacity > 0.05) r.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    }
    if (lizardInHand) {
      handWorld(cast[lizardInHand], liz.position);
    }
    if (bowlInHand) {
      handWorld(cast[bowlInHand], bowl.position);
      bowl.position.y -= 0.3;
    }
    if (potInHands) {
      // 兩手捧著罐腰
      const f = cast[potInHands];
      handWorld(f, handR);
      handWorld(f, handL, true);
      pot.position.copy(handR).add(handL).multiplyScalar(0.5);
      pot.position.y -= 0.75;
    }
    for (const [id, fl] of follow) {
      const o = items[id]!.obj;
      const f = cast[fl.who];
      const big = id === 'baby' || id.startsWith('lamb');
      if (fl.how === 'carry' && big) {
        // 抱在胸前
        f.localToWorld(o.position.set(0, id === 'baby' ? 2.25 : 2.0, 0.95));
        o.rotation.y = f.rotation.y + Math.PI / 2;
        o.scale.setScalar(id === 'baby' ? 1 : 0.62);
      } else if (fl.how === 'carry') {
        handWorld(f, o.position);
        o.position.y -= 0.15 + fl.k * 0.3;
        o.rotation.y = f.rotation.y;
      } else {
        // 牽在身旁、稍微落後
        const side = (fl.k % 2 ? -1 : 1) * (2.4 + Math.floor(fl.k / 2) * 1.4);
        const prev = o.position.clone();
        f.localToWorld(o.position.set(side, 0, -1.6 - fl.k * 0.9));
        o.position.y = 0;
        o.rotation.y = f.rotation.y;
        o.scale.setScalar(1);
        const moved = prev.distanceTo(o.position);
        const legs = o.userData.legs as THREE.Group[] | undefined;
        if (legs) legs.forEach((l, i) => (l.rotation.x = moved > 0.01 ? Math.sin(t * 12 + i * Math.PI) * 0.5 : 0));
      }
    }
    const fs = items.seat!.ring!.material as THREE.MeshBasicMaterial;
    const fm = items.mat!.ring!.material as THREE.MeshBasicMaterial;
    if (fs.opacity > 0.05) items.seat!.ring!.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    if (fm.opacity > 0.05) items.mat!.ring!.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
    if (altarFire.group.visible) altarFire.tick(t);
    renderer.render(scene, camera);
    const w = host.clientWidth;
    const hh = host.clientHeight;
    // 先算每個標籤的位置，再由上到下錯開：對話泡泡最優先，人名其次，地名最後
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const order = [...tags].sort((a, b) => rank(a.el) - rank(b.el));
    for (const tg of order) {
      const p = tmpV.copy(tg.at()).project(camera);
      let hidden = !tg.show() || p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05;
      const who = tg.el.dataset.who as CastId | undefined;
      if (who && sayTags[who]?.classList.contains('now') && sayTags[who].textContent) hidden = true;
      tg.el.style.opacity = hidden ? '0' : '1';
      if (hidden) continue;
      const bw = tg.el.offsetWidth, bh = tg.el.offsetHeight;
      // 窄畫面（手機）上，站在邊緣的人說的話不能被切掉：整個泡泡夾在畫面內，尖角仍指向說話的人
      const x0 = ((p.x + 1) / 2) * w;
      const x = bw < w ? Math.min(Math.max(x0, bw / 2 + 6), w - bw / 2 - 6) : x0;
      tg.el.style.setProperty('--tx', `${x0 - x}px`);
      let y = ((1 - p.y) / 2) * hh;
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find((r) => x - bw / 2 < r.x1 && x + bw / 2 > r.x0 && y - bh < r.y1 && y > r.y0);
        if (!hit) break;
        y = hit.y0 - 3;
      }
      // 對話泡泡被往上推時，不能推出畫面頂端
      const isSay = tg.el.classList.contains('say');
      if (isSay) y = Math.max(y, bh + 6);
      // 對話泡泡下面有一個小尖角，也要算進去，名牌才不會壓到它
      placed.push({ x0: x - bw / 2, x1: x + bw / 2, y0: y - bh, y1: y + (isSay ? 9 : 0) });
      tg.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
  }
  frame();

  function reset() {
    followWho = null;
    dolly = -1;
    for (const b of freeSays) b.remove();
    freeSays.length = 0;
    for (let i = tags.length - 1; i >= 0; i--) if (!tags[i].el.isConnected) tags.splice(i, 1);
    flashEl.classList.remove('on');
    flush();
    for (const id of Object.keys(cast) as CastId[]) {
      cast[id].visible = false;
      const rm = rings[id].material as THREE.MeshBasicMaterial;
      rm.opacity = 0;
      marks[id] = 'clean';
      castTags[id].textContent = CAST_NAME[id];
      castTags[id].dataset.mark = 'clean';
      sayTags[id].textContent = '';
      sayTags[id].classList.remove('say-in', 'now');
      cast[id].rotation.y = 0;
      (cast[id].userData.armL as THREE.Group).rotation.x = 0;
      const body = cast[id].userData.body as THREE.Group;
      body.rotation.x = 0;
      body.position.set(0, 0, 0);
      (cast[id].userData.arm as THREE.Group).rotation.x = 0;
      (cast[id].userData.armL as THREE.Group).rotation.set(0, 0, -0.12);
      for (const d of (cast[id].userData.dots ?? []) as THREE.Object3D[]) d.removeFromParent();
      cast[id].userData.dots = [];
      (cast[id].userData.cover as THREE.Object3D[]).forEach((c) => (c.visible = true));
      if (cast[id].userData.hair) (cast[id].userData.hair as THREE.Group).visible = false;
      if (cast[id].userData.rip) (cast[id].userData.rip as THREE.Mesh).visible = false;
      (cast[id].userData.robe as THREE.MeshStandardMaterial).color.set(cast[id].userData.robeColor as string);
    }
    follow.clear();
    for (const [id, it] of Object.entries(items) as [PropId, Item][]) {
      if (id === 'seat' || id === 'mat') { it.obj.visible = true; }
      else it.obj.visible = false;
      if (it.ring) (it.ring.material as THREE.MeshBasicMaterial).opacity = 0;
      if (id !== 'altar') { it.obj.rotation.set(0, 0, 0); it.obj.scale.setScalar(id.startsWith('dove') ? 1.15 : 1); }
      if (it.home) it.obj.position.copy(v3(it.home));
    }
    ((items.vessel!.obj.userData.water as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set('#5f93a8');
    altarFire.group.scale.setScalar(2.2);
    drops.visible = false;
    dayTag.textContent = '';
    dayTag.classList.remove('on');
    pot.visible = true;
    pot.position.set(...POT);
    pot.rotation.set(0, 0, 0);
    lid.position.copy(LID_ON);
    lid.rotation.set(0, 0, 0);
    potShards.visible = false;
    for (const sp of shardPath) { sp.obj.position.copy(sp.rest); sp.obj.rotation.set(0, 0, 0); }
    liz.visible = false;
    lizardInHand = null;
    bowlInHand = null;
    potInHands = null;
    bowl.position.copy(BOWL_OUT);
    fire.group.visible = true;
    barMat.opacity = 0;
    skyFrom = SKY.day;
    skyTo = SKY.day;
    skyT = 1;
    applySky(1);
  }
  // 沒有演的時候，這一家人在帳棚前
  const idle = () => {
    at('father', 'home');
    at('mother', 'yard');
    at('daughter', 'basin');
  };
  reset();
  idle();
  void barTag;

  return {
    async play(beat, animate) {
      instantMode = !animate;
      // 換一步就收起上一步的對話
      for (const el of Object.values(sayTags)) { el.textContent = ''; el.classList.remove('now', 'say-in'); }
      for (const b of freeSays) b.remove();
      freeSays.length = 0;
      const run = (async () => {
        for (const c of beat.cues) await cue(c);
      })();
      cur = run;
      await run;
      instantMode = false;
    },
    async stop() {
      skipping = true;
      flush();
      try { await cur; } finally { skipping = false; }
      flush();
    },
    reset() {
      reset();
      idle();
    },
    view,
    setAutoRotate(on) { controls.autoRotate = on && !opts.reducedMotion; },
    dispose() {
      running = false;
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
    },
  };
}
