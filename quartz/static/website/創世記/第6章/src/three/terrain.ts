import * as THREE from 'three';
import { GLSL_NOISE, clamp, fbm, hash2, mulberry32, ridged, smooth } from './util';

/**
 * 世界地形。原點是洪水前造方舟的山谷；亞拉臘山區在 ARARAT，最高處是一塊平台，
 * 方舟最後停在那裡。其他山都比平台低，所以退水時山頂是在方舟停住之後才陸續現出（創8:4–5）。
 * 山的高度、距離都是想像，不按實際比例。
 */
export const ARARAT = { x: -1500, z: -2500, h: 300 };
/** 第 11 幕拿來拍「高山都淹沒了」的一座尖峰 */
export const PEAK = { x: -760, z: -1180, h: 262 };
export const FLOOD_TOP = ARARAT.h + 15 * 0.45; // 水勢比山高過十五肘

export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x / 1.35, z);
  // 山谷：方舟周圍一片平地，往外慢慢起伏
  const open = smooth((r - 240) / 700);
  let h = (fbm(x * 0.0021 + 3.1, z * 0.0021 + 7.7, 4) - 0.35) * 110 * open;
  h += (fbm(x * 0.012 + 1.3, z * 0.012 + 2.9, 3) - 0.5) * 6 * smooth((r - 120) / 200);
  // 遠山：一圈稜線
  const far = smooth((r - 1100) / 1600);
  h += ridged(x * 0.0009 + 11.2, z * 0.0009 + 5.4, 5) * 250 * far;
  // 亞拉臘山體：多道山脊，頂上一塊邊緣不規則的平台
  const dx = x - ARARAT.x, dz = z - ARARAT.z;
  const warp = (fbm(x * 0.006 + 4.4, z * 0.006 + 1.7, 3) - 0.5) * 0.45;
  const da = Math.hypot(dx, dz) * (1 + warp);
  const ang = Math.atan2(dz, dx);
  const spokes = 0.5 + 0.5 * Math.cos(ang * 5 + fbm(x * 0.002, z * 0.002, 2) * 6);
  let mass = ARARAT.h * Math.pow(clamp(1 - da / 1300), 1.25);
  mass += (ridged(x * 0.0035 + 2.2, z * 0.0035 + 9.1, 5) - 0.45) * 110 * clamp(1 - da / 1100) * smooth((da - 170) / 220);
  mass += spokes * 40 * clamp(1 - da / 900) * smooth((da - 200) / 200);
  const foot = Math.hypot(dx / 86, dz / 34);
  const plateau = ARARAT.h - 0.6 + (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 1.6 + (fbm(x * 0.018 + 7, z * 0.018 + 3, 3) - 0.45) * 9 * smooth((foot - 1) / 0.8);
  const m0 = Math.min(mass, plateau - 2);
  mass = m0 + (plateau - m0) * (1 - smooth((da - 150) / 90));
  h = Math.max(h, mass);
  // 尖峰
  const dp = Math.hypot(x - PEAK.x, z - PEAK.z);
  const peak = PEAK.h * Math.pow(clamp(1 - dp / 560), 1.6) + (ridged(x * 0.008 + 3.3, z * 0.008 + 1.1, 4) - 0.45) * 60 * clamp(1 - dp / 460);
  h = Math.max(h, peak);
  // 除了平台，其他地方都比平台低一點
  const cap = ARARAT.h - 18;
  if (da > 250 && h > cap) h = cap + (h - cap) * 0.15;
  return h;
}

const C = {
  grass: new THREE.Color('#5f7f3e'),
  dry: new THREE.Color('#9c9258'),
  soil: new THREE.Color('#7d664a'),
  rock: new THREE.Color('#7e776d'),
  snow: new THREE.Color('#e9edf1'),
};

function colorAt(x: number, z: number, h: number, slope: number, out: THREE.Color) {
  const patch = fbm(x * 0.013 + 31.4, z * 0.013 + 17.9, 3);
  out.copy(C.grass).lerp(C.dry, clamp(patch * 1.8 - 0.45));
  out.lerp(C.soil, smooth((slope - 0.35) / 0.3) * 0.8);
  out.lerp(C.rock, smooth((slope - 0.6) / 0.35));
  out.lerp(C.rock, smooth((h - 170) / 60) * 0.7);
  out.lerp(C.snow, smooth((h - 235) / 30) * smooth((slope - 0.1) / -0.3 + 1) * 0.9);
  return out;
}

export interface TerrainUniforms {
  uMud: { value: number };
  uFloodTop: { value: number };
  uGreen: { value: number };
  uWater: { value: number };
}

function terrainMaterial(u: TerrainUniforms) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.5 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uMud, uFloodTop, uGreen, uWater;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float nn = fbm3(vWPos.xz * 0.06);
        float n2 = fbm3(vWPos.xz * 0.35 + 4.0);
        float n3 = fbm3(vWPos.xz * 1.7 + 11.0);
        diffuseColor.rgb *= 0.8 + 0.32 * nn + 0.16 * (n2 - 0.5) + 0.14 * (n3 - 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.05, 0.7), smoothstep(0.45, 0.75, n2) * 0.5);
        // 造船的工地：方舟周圍被踩成泥土地
        float site = length(vWPos.xz / vec2(92.0, 40.0)) + (nn - 0.5) * 0.5 + (n3 - 0.5) * 0.18;
        vec3 dirt = vec3(0.2, 0.16, 0.115) * (0.8 + 0.35 * n2);
        diffuseColor.rgb = mix(diffuseColor.rgb, dirt, smoothstep(1.15, 0.8, site));
        float below = smoothstep(uFloodTop + 1.0, uFloodTop - 1.0, vWPos.y);
        vec3 mud = vec3(0.15, 0.115, 0.08) * (0.75 + 0.5 * nn) * (0.85 + 0.3 * n3);
        diffuseColor.rgb = mix(diffuseColor.rgb, mud, uMud * below);
        float sprout = smoothstep(0.38, 0.7, fbm3(vWPos.xz * 0.11 + 9.0) * 0.7 + n3 * 0.3 + uGreen * 0.35);
        vec3 fresh = vec3(0.24, 0.3, 0.11) * (0.8 + 0.4 * n2);
        diffuseColor.rgb = mix(diffuseColor.rgb, fresh, uGreen * below * sprout);
        float wet = smoothstep(uWater + 2.5, uWater + 0.2, vWPos.y);
        diffuseColor.rgb *= 1.0 - 0.4 * wet;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.45, smoothstep(uWater + 2.5, uWater + 0.2, vWPos.y));
        roughnessFactor = mix(roughnessFactor, 0.82, uMud * below * (1.0 - uGreen));`);
  };
  return m;
}

function patch(size: number, segs: number, cx: number, cz: number, sink?: (x: number, z: number) => number) {
  const g = new THREE.PlaneGeometry(size, size, segs, segs);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, z = p.getZ(i) + cz;
    const h = heightAt(x, z) - (sink ? sink(x, z) : 0);
    const e = size / segs;
    const sx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const sz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    p.setY(i, h);
    colorAt(x, z, h, clamp(Math.hypot(sx, sz) * 1.2), c);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.translate(cx, 0, cz);
  return g;
}

function mergeGeos(list: THREE.BufferGeometry[]) {
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let vc = 0;
  flat.forEach((g) => (vc += g.attributes.position.count));
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  let o = 0;
  flat.forEach((g) => {
    g.computeVertexNormals();
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, o * 2);
    o += g.attributes.position.count;
  });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return m;
}

export function createTerrain(quality: 'high' | 'low') {
  const u: TerrainUniforms = { uMud: { value: 0 }, uFloodTop: { value: FLOOD_TOP }, uGreen: { value: 0 }, uWater: { value: -100 } };
  const mat = terrainMaterial(u);
  const group = new THREE.Group();
  const hi = quality === 'high';
  const VALLEY = { x: 0, z: -40, s: 900 };
  const ARAR = { x: ARARAT.x, z: ARARAT.z, s: 760 };
  // 細的兩塊之外，粗的一塊墊在下面，重疊處往下壓一點免得閃爍
  const inside = (x: number, z: number, p: { x: number; z: number; s: number }) => {
    const d = Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) / (p.s / 2);
    return clamp((1 - d) / 0.12);
  };
  const far = patch(10000, hi ? 320 : 200, -700, -1200, (x, z) => 4 * Math.max(inside(x, z, VALLEY), inside(x, z, ARAR)));
  const valley = patch(VALLEY.s, hi ? 180 : 110, VALLEY.x, VALLEY.z);
  const arar = patch(ARAR.s, hi ? 150 : 90, ARAR.x, ARAR.z);
  for (const g of [far, valley, arar]) {
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------------------------------------------------------------- 洪水前的樹林
  const rnd = mulberry32(61);
  const cone = new THREE.ConeGeometry(1.8, 5.5, 7);
  cone.translate(0, 5.2, 0);
  const cone2 = new THREE.ConeGeometry(1.3, 4.2, 7);
  cone2.translate(0, 7.6, 0);
  const trunk = new THREE.CylinderGeometry(0.2, 0.34, 3.2, 6);
  trunk.translate(0, 1.6, 0);
  const crown = new THREE.IcosahedronGeometry(2.8, 1);
  crown.scale(1, 0.78, 1);
  crown.translate(0, 5.1, 0);
  const needle = new THREE.MeshStandardMaterial({ color: '#2f4a27', roughness: 0.9, flatShading: true });
  const leaf = new THREE.MeshStandardMaterial({ color: '#4c6a2c', roughness: 0.9, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.95 });
  const spots: { x: number; y: number; z: number; s: number; r: number; con: boolean }[] = [];
  let tries = 0;
  while (spots.length < (hi ? 1400 : 700) && tries++ < 20000) {
    const a = rnd() * Math.PI * 2;
    const rr = 150 + Math.pow(rnd(), 0.7) * 1300;
    const x = Math.cos(a) * rr * 1.3, z = Math.sin(a) * rr - 40;
    if (Math.abs(x) < 110 && Math.abs(z + 20) < 70) continue;
    const h = heightAt(x, z);
    if (h > 190 || h < -2) continue;
    if (fbm(x * 0.004, z * 0.004, 2) < 0.42) continue; // 成片的林子，不是撒芝麻
    spots.push({ x, y: h, z, s: 0.8 + rnd() * 1.1, r: rnd() * 6.28, con: rnd() < 0.55 });
  }
  const dummy = new THREE.Object3D();
  const inst = (geo: THREE.BufferGeometry, m: THREE.Material, list: typeof spots) => {
    const im = new THREE.InstancedMesh(geo, m, list.length);
    list.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.r, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = hi;
    im.receiveShadow = true;
    group.add(im);
    return im;
  };
  const conif = spots.filter((s) => s.con);
  const broad = spots.filter((s) => !s.con);
  inst(cone, needle, conif);
  inst(cone2, needle, conif);
  inst(trunk, bark, spots);
  inst(crown, leaf, broad);

  let grassMesh: THREE.InstancedMesh | null = null;
  // ---------------------------------------------------------------- 工地周圍的草叢：兩片交叉的草葉貼圖
  {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const g = cv.getContext('2d')!;
    for (let k = 0; k < 26; k++) {
      const x0 = 64 + (rnd() - 0.5) * 70, hgt = 60 + rnd() * 66, lean = (rnd() - 0.5) * 60;
      g.strokeStyle = `hsl(${62 + rnd() * 30}, ${28 + rnd() * 22}%, ${24 + rnd() * 24}%)`;
      g.lineWidth = 1 + rnd() * 1.4;
      g.beginPath();
      g.moveTo(x0, 128);
      g.quadraticCurveTo(x0 + lean * 0.3, 128 - hgt * 0.6, x0 + lean, 128 - hgt);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const q1 = new THREE.PlaneGeometry(1.1, 0.8, 1, 1);
    q1.translate(0, -0.1, 0);
    q1.translate(0, 0.5, 0);
    const q2 = q1.clone();
    q2.rotateY(Math.PI / 2);
    const tuft = mergeGeos([q1, q2]);
    const grassMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1 });
    const N = hi ? 7000 : 2500;
    const im = new THREE.InstancedMesh(tuft, grassMat, N);
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < N * 3 && n < N; i++) {
      const a = rnd() * Math.PI * 2, rr = 20 + Math.pow(rnd(), 0.9) * 170;
      const x = Math.cos(a) * rr * 1.6, z = Math.sin(a) * rr * 0.9 - 20;
      if (Math.hypot(x / 98, z / 44) < 1.08) continue;
      dummy.position.set(x, heightAt(x, z), z);
      dummy.rotation.set(0, rnd() * 6.28, 0);
      const sc = 0.5 + rnd() * 0.9;
      dummy.scale.set(sc, sc * (0.6 + rnd() * 0.7), sc);
      dummy.updateMatrix();
      im.setMatrixAt(n, dummy.matrix);
      im.setColorAt(n, col.setHSL(0.22, 0.2, 0.55 + rnd() * 0.35));
      n++;
    }
    im.count = n;
    im.receiveShadow = true;
    group.add(im);
    grassMesh = im;
  }

  // ---------------------------------------------------------------- 洪水後在亞拉臘長出的新綠（創8:11 橄欖葉）
  const newGrowth = new THREE.Group();
  const bush = new THREE.IcosahedronGeometry(1, 1);
  const olive = new THREE.MeshStandardMaterial({ color: '#6d7d45', roughness: 0.9, flatShading: true });
  const grow: { x: number; y: number; z: number; s: number }[] = [];
  tries = 0;
  while (grow.length < 140 && tries++ < 4000) {
    const a = rnd() * Math.PI * 2, rr = 110 + rnd() * 330;
    const x = ARARAT.x + Math.cos(a) * rr, z = ARARAT.z + Math.sin(a) * rr;
    const h = heightAt(x, z);
    grow.push({ x, y: h, z, s: 0.5 + rnd() * 1.4 });
  }
  // 平台四周的岩塊
  {
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rp = rockGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * (0.8 + hash2(i, 1) * 0.5), rp.getY(i) * (0.6 + hash2(i, 2) * 0.5), rp.getZ(i) * (0.8 + hash2(i, 3) * 0.5));
    rockGeo.computeVertexNormals();
    const rockMat = new THREE.MeshStandardMaterial({ color: '#5d5750', roughness: 0.95, flatShading: true });
    const rocks: { x: number; y: number; z: number; s: number }[] = [];
    let t2 = 0;
    while (rocks.length < 260 && t2++ < 6000) {
      const a = rnd() * Math.PI * 2, rr = 175 + Math.pow(rnd(), 1.4) * 480;
      const x = ARARAT.x + Math.cos(a) * rr, z = ARARAT.z + Math.sin(a) * rr;
      rocks.push({ x, y: heightAt(x, z), z, s: 0.6 + Math.pow(rnd(), 2.5) * 4.5 });
    }
    const im = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.y - r.s * 0.15, r.z);
      dummy.rotation.set(rnd(), rnd() * 6, rnd());
      dummy.scale.set(r.s, r.s * (0.5 + rnd() * 0.5), r.s * (0.7 + rnd() * 0.6));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  const bushes = new THREE.InstancedMesh(bush, olive, grow.length);
  grow.forEach((t, i) => {
    dummy.position.set(t.x, t.y + t.s * 0.4, t.z);
    dummy.rotation.set(0, i, 0);
    dummy.scale.set(t.s * 1.3, t.s, t.s * 1.3);
    dummy.updateMatrix();
    bushes.setMatrixAt(i, dummy.matrix);
  });
  bushes.castShadow = true;
  newGrowth.add(bushes);
  group.add(newGrowth);

  // ---------------------------------------------------------------- 洪水前的村落與炊煙（示意）
  const villages = new THREE.Group();
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  houseGeo.translate(0, 0.5, 0);
  const houseMat = new THREE.MeshStandardMaterial({ color: '#a08b6c', roughness: 1 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#6d5a42', roughness: 1 });
  const smokeTex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return c;
  })());
  const smokes: THREE.Sprite[] = [];
  const CENTERS = [[-170, 330], [70, 430], [-340, 170], [300, 260]];
  const houses: { x: number; y: number; z: number; w: number; d: number; h: number; r: number }[] = [];
  for (const [cx, cz] of CENTERS) {
    for (let k = 0; k < 26; k++) {
      const x = cx + (rnd() - 0.5) * 70, z = cz + (rnd() - 0.5) * 50;
      houses.push({ x, y: heightAt(x, z), z, w: 3 + rnd() * 4, d: 3 + rnd() * 4, h: 2.4 + rnd() * 1.6, r: rnd() * 3 });
    }
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xbab3a8, transparent: true, depthWrite: false, opacity: 0 }));
      const x = cx + (rnd() - 0.5) * 50, z = cz + (rnd() - 0.5) * 40;
      sp.userData = { x, y: heightAt(x, z) + 3, z, ph: rnd() };
      villages.add(sp);
      smokes.push(sp);
    }
  }
  const walls = new THREE.InstancedMesh(houseGeo, houseMat, houses.length);
  const roofs = new THREE.InstancedMesh(houseGeo, roofMat, houses.length);
  houses.forEach((hh, i) => {
    dummy.position.set(hh.x, hh.y - 0.3, hh.z);
    dummy.rotation.set(0, hh.r, 0);
    dummy.scale.set(hh.w, hh.h, hh.d);
    dummy.updateMatrix();
    walls.setMatrixAt(i, dummy.matrix);
    dummy.position.y = hh.y - 0.3 + hh.h;
    dummy.scale.set(hh.w + 0.4, 0.3, hh.d + 0.4);
    dummy.updateMatrix();
    roofs.setMatrixAt(i, dummy.matrix);
  });
  walls.castShadow = roofs.castShadow = hi;
  walls.receiveShadow = true;
  villages.add(walls, roofs);
  group.add(villages);

  return {
    group,
    uniforms: u,
    /** 村落的炊煙；水淹過之後就不再冒 */
    smoke(t: number, water: number) {
      villages.visible = water < 60;
      if (!villages.visible) return;
      for (const sp of smokes) {
        const d = sp.userData as { x: number; y: number; z: number; ph: number };
        const ph = (t * 0.05 + d.ph) % 1;
        sp.position.set(d.x + ph * 8, d.y + ph * 26, d.z + ph * 3);
        const sc = 3 + ph * 14;
        sp.scale.set(sc, sc, 1);
        (sp.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * ph) * 0.35 * (d.y + 3 > water ? 1 : 0);
      }
    },
    /** 鏡頭高過 30 公尺，草葉看起來只是雜點，乾脆不畫 */
    grass(camY: number, water: number) {
      if (grassMesh) grassMesh.visible = camY < 32 && water < 0;
    },
    set(opts: { mud: number; green: number; water: number }) {
      u.uMud.value = opts.mud;
      u.uGreen.value = opts.green;
      u.uWater.value = opts.water;
      newGrowth.visible = opts.green > 0.02;
      newGrowth.scale.setScalar(1);
      newGrowth.position.y = (1 - smooth(opts.green)) * -3;
    },
  };
}
export type Terrain = ReturnType<typeof createTerrain>;
