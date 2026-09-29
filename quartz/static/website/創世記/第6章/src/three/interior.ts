import * as THREE from 'three';
import { softDot } from './textures';
import { mulberry32 } from './util';

/**
 * 船艙裡的擺設（都在方舟本地座標）：飼槽、墊草、水桶、乾草捆、吊籃、鳥籠、爐灶。
 * 經文沒有描寫船艙內部，這些都是示意，讓走進去的人看得懂每一層在做什麼。
 * 甲板面高度：下層 1.8、中層 5.8、上層 9.5 公尺。
 */
export const DECK_Y = [1.8, 5.8, 9.5];

/** 船身在某個 x 的內側半寬（和 build_ark.py 的 beam_at 一致，再往內縮一點） */
export function innerHalf(x: number) {
  const a = Math.abs(x) / 67.5;
  const k = a <= 0.58 ? 1 : 1 - 0.5 * Math.pow((a - 0.58) / 0.42, 1.7);
  return 11.25 * k - 0.6;
}

export function createInterior(root: THREE.Object3D) {
  const group = new THREE.Group();
  group.name = 'interior';
  root.add(group);
  const rnd = mulberry32(88);
  const dummy = new THREE.Object3D();
  const wood = new THREE.MeshStandardMaterial({ color: '#5e4127', roughness: 0.9 });
  const straw = new THREE.MeshStandardMaterial({ color: '#b8994f', roughness: 1 });
  const hayMat = new THREE.MeshStandardMaterial({ color: '#a38f4c', roughness: 1 });
  const clay = new THREE.MeshStandardMaterial({ color: '#a15d3a', roughness: 0.8 });
  const basket = new THREE.MeshStandardMaterial({ color: '#8c6b3d', roughness: 1 });

  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: { p: [number, number, number]; s?: [number, number, number]; r?: number }[]) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
      dummy.position.set(...o.p);
      dummy.rotation.set(0, o.r ?? 0, 0);
      dummy.scale.set(...(o.s ?? [1, 1, 1]));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
    return im;
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const lump = new THREE.IcosahedronGeometry(1, 1);
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.36, 1, 14);

  // ---------------------------------------------------------------- 下層：飼槽、墊草、水桶
  const y0 = DECK_Y[0];
  const troughs: { p: [number, number, number]; s: [number, number, number] }[] = [];
  const troughHay: typeof troughs = [];
  const piles: { p: [number, number, number]; s: [number, number, number]; r: number }[] = [];
  for (let x = -48; x <= 48; x += 6) {
    for (const side of [-1, 1]) {
      troughs.push({ p: [x + 1.5, y0 + 0.28, side * 4.0], s: [2.6, 0.5, 0.6] });
      troughHay.push({ p: [x + 1.5, y0 + 0.5, side * 4.0], s: [2.4, 0.12, 0.45] });
      const hw = innerHalf(x);
      piles.push({ p: [x + 1 + rnd() * 2, y0 + 0.05, side * (hw - 1.4)], s: [1.4, 0.35, 1.0], r: rnd() * 3 });
    }
  }
  inst(box, wood, troughs);
  inst(box, hayMat, troughHay);
  inst(lump, straw, piles);
  const barrels: { p: [number, number, number]; s: [number, number, number] }[] = [];
  for (const [x, z] of [[-40, -2.6], [-39.1, -2.6], [-40, -1.7], [-39.1, -1.7], [-38.2, -2.6], [44, 2.6], [43.1, 2.6], [44, 1.7]] as [number, number][]) {
    barrels.push({ p: [x, y0 + 0.55, z], s: [1, 1.1, 1] });
  }
  inst(barrelGeo, wood, barrels);

  // ---------------------------------------------------------------- 中層：乾草捆、吊籃
  const y1 = DECK_Y[1];
  const bales: { p: [number, number, number]; s: [number, number, number]; r: number }[] = [];
  for (let x = 13; x <= 27; x += 1.3) {
    for (let lvl = 0; lvl < 3; lvl++) {
      if (lvl === 2 && rnd() < 0.4) continue;
      bales.push({ p: [x + (lvl % 2) * 0.4, y1 + 0.3 + lvl * 0.58, 4.8], s: [1.15, 0.56, 0.8], r: (rnd() - 0.5) * 0.08 });
    }
  }
  for (let x = -40; x <= -30; x += 1.3) {
    for (let lvl = 0; lvl < 2; lvl++) bales.push({ p: [x, y1 + 0.3 + lvl * 0.58, -4.8], s: [1.15, 0.56, 0.8], r: (rnd() - 0.5) * 0.08 });
  }
  inst(box, hayMat, bales);
  const baskets: { p: [number, number, number]; s: [number, number, number] }[] = [];
  for (let x = -36; x <= 36; x += 4.5) baskets.push({ p: [x, y1 + 2.5 + rnd() * 0.3, (rnd() - 0.5) * 3], s: [0.8, 0.5, 0.8] });
  inst(cyl, basket, baskets);
  // 吊繩
  const ropeGeo = new THREE.BufferGeometry().setFromPoints(baskets.flatMap((b) => [new THREE.Vector3(b.p[0], b.p[1] + 0.25, b.p[2]), new THREE.Vector3(b.p[0], y1 + 3.3, b.p[2])]));
  group.add(new THREE.LineSegments(ropeGeo, new THREE.LineBasicMaterial({ color: '#6b5436' })));

  // ---------------------------------------------------------------- 上層：鳥籠、爐灶、水罐
  const y2 = DECK_Y[2];
  const cageEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.3, 1.0, 1.0, 3, 2, 2));
  const cageMat = new THREE.LineBasicMaterial({ color: '#5e452c' });
  const standGeo: { p: [number, number, number]; s: [number, number, number] }[] = [];
  for (let x = -34; x <= 38; x += 3.2) {
    const z = innerHalf(x) - 2.6;
    if (z < 5) continue;
    for (const lvl of [0, 1]) {
      const c = new THREE.LineSegments(cageEdges, cageMat);
      c.position.set(x, y2 + 0.9 + lvl * 1.05, z);
      group.add(c);
    }
    standGeo.push({ p: [x, y2 + 0.2, z], s: [1.4, 0.4, 1.1] });
  }
  inst(box, wood, standGeo);
  // 爐灶
  const oven = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.0, 16, 1, true), clay);
  oven.position.set(-28, y2 + 0.5, -3.2);
  group.add(oven);
  const ovenTop = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.12, 8, 18), clay);
  ovenTop.rotation.x = Math.PI / 2;
  ovenTop.position.set(-28, y2 + 1.0, -3.2);
  group.add(ovenTop);
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: '#3b2c22', roughness: 0.6 }));
  pot.rotation.x = Math.PI;
  pot.position.set(-28, y2 + 1.2, -3.2);
  group.add(pot);
  const ember = new THREE.PointLight(0xff7a30, 6, 7, 1.8);
  ember.position.set(-28, y2 + 0.6, -3.2);
  group.add(ember);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,150,70,1)'), color: 0xff8a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.3);
  glow.position.set(-28, y2 + 0.55, -3.2);
  group.add(glow);
  const jars: { p: [number, number, number]; s: [number, number, number] }[] = [];
  for (let k = 0; k < 7; k++) jars.push({ p: [-31.2 + (k % 4) * 0.6, y2 + 0.45, -6.2 - Math.floor(k / 4) * 0.6], s: [0.7, 0.9, 0.7] });
  inst(cyl, clay, jars);
  const stools = [[-26.6, -3.6], [-21.4, -3.6], [-24, -6.2], [-26.6, -6.0], [-21.4, -6.0]].map(([x, z]) => ({ p: [x, y2 + 0.25, z] as [number, number, number], s: [0.45, 0.5, 0.45] as [number, number, number] }));
  inst(cyl, wood, stools);

  // 走在船艙裡時補一點暖色的環境光，不然燈照不到的地方全黑
  const fillLight = new THREE.HemisphereLight(0xffc98a, 0x3a2614, 0);
  root.add(fillLight);
  // 每層多掛幾盞燈
  const lampGlow = new THREE.SpriteMaterial({ map: softDot('rgba(255,190,110,1)'), color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const extra: THREE.PointLight[] = [];
  for (const [x, d] of [[-30, 1], [12, 1], [28, 1], [-40, 0], [22, 0], [-22, 2], [20, 2], [34, 2]] as [number, number][]) {
    const l = new THREE.PointLight(0xffa65a, 0, 14, 1.7);
    l.position.set(x, DECK_Y[d] + (d === 2 ? 2.4 : 2.9), 0);
    const g = new THREE.Sprite(lampGlow);
    g.scale.setScalar(0.8);
    l.add(g);
    group.add(l);
    extra.push(l);
  }
  return {
    group,
    update(t: number, on: boolean, walking = false) {
      group.visible = on;
      fillLight.intensity = walking ? 0.55 : 0;
      extra.forEach((l, i) => (l.intensity = walking ? 20 + Math.sin(t * 6 + i * 2.3) * 2.5 : 0));
      ember.intensity = 5 + Math.sin(t * 9) * 1.2 + Math.sin(t * 23) * 0.8;
    },
  };
}
