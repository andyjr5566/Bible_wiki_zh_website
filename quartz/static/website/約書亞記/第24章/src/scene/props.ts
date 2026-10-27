import * as THREE from 'three';
import oakDayUrl from '../assets/shechem-env/oak.webp';
import oakNightUrl from '../assets/shechem-env/oak-night.webp';
import stoneTextureUrl from '../assets/shechem-env/stone-texture.webp';
import { deferredTexture } from './texture';

export const OAK_POS = new THREE.Vector3(2.8, 0, -8.5);
export const STONE_BASE_POS = new THREE.Vector3(2.45, 0.08, -3.15);
export const SCROLL_TABLE_POS = new THREE.Vector3(0.85, 0, -2.35);
export const BONES_PLOT_POS = new THREE.Vector3(-3.8, 0, -1.6);

export interface ScenePropsHandle {
  root: THREE.Group;
  oakGroup: THREE.Group;
  canopyClusters: THREE.Object3D[];
  stonePivot: THREE.Group;
  stoneMesh: THREE.Object3D;
  soilMound: THREE.Mesh;
  dustGroup: THREE.Group;
  prologueGroup: THREE.Group;
  scrollGroup: THREE.Group;
  reedPen: THREE.Object3D;
  pastPit: THREE.Mesh;
  pastBundle: THREE.Group;
  coffinFull: THREE.Group;
  timeSkyGroup: THREE.Group;
  sunDisc: THREE.Mesh;
  moonDisc: THREE.Group;
  timeRings: THREE.Mesh[];
  /** u=0 平躺在地，u=1 直立（共用同一塊石頭網格） */
  setStoneUpright(u: number): void;
  triggerDust(t: number): void;
  updateIdle(time: number, dt: number, motionOff: boolean, windStrength: number): void;
  setOrbitPhase(turns: number, visible: boolean): void;
  updateOakBillboard(camera: THREE.Camera, nightMix: number): void;
  preloadNight(): void;
  swapFromBlenderGltf(lib: THREE.Group): void;
}

const oakDay = deferredTexture(oakDayUrl);
const oakNight = deferredTexture(oakNightUrl);
const stone = deferredTexture(stoneTextureUrl, [162, 146, 120, 255]);
const oakDayTexture = oakDay.texture;
const oakNightTexture = oakNight.texture;
const stoneTexture = stone.texture;
void oakDay.load();
void stone.load();
let nightReadyAt = 0;
for (const texture of [oakDayTexture, oakNightTexture, stoneTexture]) {
  texture.colorSpace = THREE.SRGBColorSpace;
}
stoneTexture.wrapS = THREE.RepeatWrapping;
stoneTexture.wrapT = THREE.RepeatWrapping;
stoneTexture.repeat.set(1.1, 1.5);

/** 建立可重用的約瑟棺材模型（創50:26「收殮在棺材裡」；第二幕地圖縮小版與第32節全尺寸共用） */
export function buildCoffinModel(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#7c5333', roughness: 0.82 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#c49347', roughness: 0.65 });
  const darkBand = new THREE.MeshStandardMaterial({ color: '#3b2819', roughness: 0.88 });

  // 箱身（梯形長木棺）
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.48, 0.56), woodMat);
  box.position.y = 0.32;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  // 弧拱棺蓋
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.8, 12, 1, false, 0, Math.PI), woodMat);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2; // 沿 X 軸長向
  lid.scale.set(1, 0.55, 3.15);
  // 改用更乾淨的梯形脊蓋避免旋轉軸混淆
  lid.visible = false;

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.16, 0.46), woodMat);
  ridge.position.y = 0.62;
  ridge.castShadow = true;
  g.add(ridge);

  // 金赭色邊飾橫帶（無任何神像圖案）
  for (const xOff of [-0.62, 0, 0.62]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.59), trimMat);
    band.position.set(xOff, 0.33, 0);
    g.add(band);
  }

  // 兩側抬槓
  for (const zOff of [-0.34, 0.34]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 2.55, 8), darkBand);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, 0.16, zOff);
    pole.castShadow = true;
    g.add(pole);
  }

  g.scale.setScalar(scale);
  return g;
}

/** 建立未加工長形大石頭網格，原點在底部支點 (0,0,0)，直立時高約 2.38m */
function paintedStoneMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: stoneTexture,
    roughness: 1,
    flatShading: true,
  });
}

function ensureStoneUv(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute('uv')) return;
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!positions) return;

  const bounds = new THREE.Box3().setFromBufferAttribute(positions);
  const height = Math.max(1e-6, bounds.max.y - bounds.min.y);
  const uvs = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const u = (Math.atan2(positions.getZ(i), positions.getX(i)) / (Math.PI * 2) + 1) % 1;
    const v = (positions.getY(i) - bounds.min.y) / height;
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
}

function buildUncarvedWitnessStone(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.36, 0.48, 2.38, 9, 5);
  // 將原點移至石頭底部 (y: 0 -> 2.38)，並對頂點做固定種子的天然石面微切角（不刻任何字）
  geo.translate(0, 1.19, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    // 扁長截面（寬 X 約 0.92m，厚 Z 約 0.54m）
    const sx = vx * 1.15 + Math.sin(vy * 2.7 + vz * 3.1) * 0.045;
    const sz = vz * 0.68 + Math.cos(vy * 3.4 - vx * 2.5) * 0.035;
    const sy = vy + (vy > 2.1 ? Math.sin(vx * 4.2 + vz * 2.8) * 0.08 : 0);
    pos.setXYZ(i, sx, Math.max(0, sy), sz);
  }
  geo.computeVertexNormals();

  const mat = paintedStoneMaterial();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = 'witness_stone_mesh';
  return m;
}

/** 以白底去背的橡樹卡片取代低面數模型，影子柔化落在谷底地面。 */
function buildTaborOak(): {
  group: THREE.Group;
  canopyClusters: THREE.Object3D[];
  dayCard: THREE.Mesh;
  nightCard: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = 'tabor_oak_group';
  const cardHeight = 5.2;
  const geometry = new THREE.PlaneGeometry(5.0, cardHeight);
  const dayMaterial = new THREE.MeshBasicMaterial({
    map: oakDayTexture, color: '#ffffff', transparent: true,
    alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide,
  });
  const nightMaterial = new THREE.MeshBasicMaterial({
    map: oakNightTexture, color: '#ffffff', transparent: true,
    alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
  });
  const dayCard = new THREE.Mesh(geometry, dayMaterial);
  dayCard.name = 'tabor_oak_day_card';
  dayCard.position.y = cardHeight / 2 + 0.02;
  const nightCard = new THREE.Mesh(geometry, nightMaterial);
  nightCard.name = 'tabor_oak_night_card';
  nightCard.position.set(0, cardHeight / 2 + 0.02, 0.004);
  nightCard.visible = false;
  group.add(dayCard, nightCard);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(45, 35, 24, 0.32)');
  gradient.addColorStop(0.55, 'rgba(45, 35, 24, 0.16)');
  gradient.addColorStop(1, 'rgba(45, 35, 24, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({
      map: shadowTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  shadow.name = 'tabor_oak_soft_shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.028;
  shadow.scale.set(3.35, 2.15, 1);
  group.add(shadow);
  return { group, canopyClusters: [], dayCard, nightCard };
}

export function createSceneProps(): ScenePropsHandle {
  const root = new THREE.Group();
  root.name = 'jos_props_root';

  // 1. 泰博橡樹
  const oakBuilt = buildTaborOak();
  const oakGroup = oakBuilt.group;
  oakGroup.position.copy(OAK_POS);
  root.add(oakGroup);
  let canopyClusters = oakBuilt.canopyClusters;

  // 2. 見證的大石頭（躺與立共用同一個網格）
  const stonePivot = new THREE.Group();
  stonePivot.name = 'witness_stone_pivot';
  stonePivot.position.copy(STONE_BASE_POS);

  let stoneMesh: THREE.Object3D = buildUncarvedWitnessStone();
  stonePivot.add(stoneMesh);
  root.add(stonePivot);

  // 石頭底座翻起的鬆土圈
  const soilMound = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.92, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: '#b59f7e', roughness: 0.98 }),
  );
  soilMound.position.set(STONE_BASE_POS.x, 0.04, STONE_BASE_POS.z);
  soilMound.scale.set(1, 0.4, 0.85);
  soilMound.receiveShadow = true;
  root.add(soilMound);

  // 石頭落定時的塵土粒子
  const dustGroup = new THREE.Group();
  dustGroup.position.set(STONE_BASE_POS.x, 0.14, STONE_BASE_POS.z);
  dustGroup.visible = false;
  const dustMat = new THREE.MeshBasicMaterial({
    color: '#d9ccb2',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (i % 3) * 0.06, 8, 6), dustMat);
    const a = (i / 10) * Math.PI * 2;
    p.userData.dir = new THREE.Vector3(Math.cos(a), 0.35 + (i % 2) * 0.2, Math.sin(a));
    dustGroup.add(p);
  }
  root.add(dustGroup);
  let dustTimer = -1;

  // 3. 序幕：6 個已立石記號＋第 7 個空圈指向地上這塊大石頭
  const prologueGroup = new THREE.Group();
  prologueGroup.position.set(-1.2, 0.15, 2.2);
  const barMesh = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.05, 0.22),
    new THREE.MeshStandardMaterial({ color: '#c4b598', roughness: 0.9 }),
  );
  barMesh.position.set(0, 0.03, 0);
  prologueGroup.add(barMesh);

  const miniStoneMat = new THREE.MeshStandardMaterial({ color: '#8c7d65', roughness: 0.88, flatShading: true });
  const stoneChapters = [4, 7, 8, 8.6, 10, 22];
  stoneChapters.forEach((ch, idx) => {
    const t = (ch - 1) / 23;
    const sx = -3.4 + t * 6.8;
    const ms = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 + (idx % 2) * 0.03, 0), miniStoneMat);
    ms.position.set(sx, 0.16, 0);
    ms.scale.set(0.85, 1.45, 0.7);
    ms.castShadow = true;
    prologueGroup.add(ms);
  });
  // 第 24 章第 7 個空位圓環
  const emptySlotRing = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.25, 24),
    new THREE.MeshBasicMaterial({ color: '#9a4a2a', side: THREE.DoubleSide }),
  );
  emptySlotRing.rotation.x = -Math.PI / 2;
  emptySlotRing.position.set(3.4, 0.07, 0);
  prologueGroup.add(emptySlotRing);
  root.add(prologueGroup);

  // 4. 第26節上：寫律法書的木案、展開皮卷與蘆葦筆（不含約櫃）
  const scrollGroup = new THREE.Group();
  scrollGroup.position.copy(SCROLL_TABLE_POS);
  scrollGroup.visible = false;

  const deskWood = new THREE.MeshStandardMaterial({ color: '#6e4e32', roughness: 0.86 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.78 });
  const inkLineMat = new THREE.MeshBasicMaterial({ color: '#2b221a' });

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.68), deskWood);
  tableTop.position.y = 0.92;
  tableTop.rotation.x = 0.16; // 微微朝鏡頭傾斜，正面清楚看見皮卷與手
  tableTop.castShadow = true;
  scrollGroup.add(tableTop);

  for (const [lx, lz] of [
    [-0.44, -0.26],
    [0.44, -0.26],
    [-0.44, 0.26],
    [0.44, 0.26],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 8), deskWood);
    leg.position.set(lx, 0.45, lz);
    scrollGroup.add(leg);
  }

  // 攤開的皮卷與兩端卷軸
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.015, 0.46), parchmentMat);
  sheet.position.set(0, 0.96, 0);
  sheet.rotation.x = 0.16;
  scrollGroup.add(sheet);

  for (const rx of [-0.38, 0.38]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.52, 12), parchmentMat);
    roller.rotation.x = Math.PI / 2 + 0.16;
    roller.position.set(rx, 0.97, 0);
    scrollGroup.add(roller);
  }
  // 皮卷上的墨跡細行（隨寫字進度顯現）
  for (let row = 0; row < 5; row++) {
    const ln = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.004, 0.014), inkLineMat);
    ln.position.set(0.02, 0.972 - row * 0.012, -0.14 + row * 0.07);
    ln.rotation.x = 0.16;
    ln.userData.inkRow = row;
    scrollGroup.add(ln);
  }

  const reedPen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.32, 6),
    new THREE.MeshStandardMaterial({ color: '#9c7844', roughness: 0.7 }),
  );
  reedPen.rotation.z = 0.48;
  reedPen.position.set(0.1, 1.09, 0.02);
  scrollGroup.add(reedPen);
  root.add(scrollGroup);

  // 5. 第23節「從前」（創35:4）：橡樹根部土坑＋包裹與耳環
  const pastPit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.38, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: '#5c4631', roughness: 1 }),
  );
  pastPit.position.set(OAK_POS.x - 0.85, 0.03, OAK_POS.z + 1.85);
  pastPit.visible = false;
  root.add(pastPit);

  const pastBundle = new THREE.Group();
  const pouch = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#b59b78', roughness: 0.9 }),
  );
  pouch.scale.set(1.2, 0.82, 1.0);
  pastBundle.add(pouch);
  const ringMat = new THREE.MeshStandardMaterial({ color: '#c89b3c', roughness: 0.35, metalness: 0.6 });
  for (const s of [-1, 1]) {
    const earring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 14), ringMat);
    earring.position.set(s * 0.09, 0.12, 0.06);
    earring.rotation.x = 0.8;
    pastBundle.add(earring);
  }
  pastBundle.visible = false;
  root.add(pastBundle);

  // 6. 第32節：約瑟全尺寸木棺
  const coffinFull = buildCoffinModel(1);
  coffinFull.position.copy(BONES_PLOT_POS);
  coffinFull.visible = false;
  root.add(coffinFull);

  // 7. 第六幕「石頭旁的時間」：天上繞圈的太陽與月亮（不閃爍畫面明暗）＋地面淡年輪圈
  const timeSkyGroup = new THREE.Group();
  timeSkyGroup.position.set(OAK_POS.x, 0, OAK_POS.z - 26);
  timeSkyGroup.visible = false;

  // 淡淡的天穹軌道細弧線
  const arcPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI * 0.12 + (i / 48) * Math.PI * 0.76;
    arcPts.push(new THREE.Vector3(Math.cos(a) * 18, 3.5 + Math.sin(a) * 11.5, 0));
  }
  const orbitArc = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(arcPts),
    new THREE.LineBasicMaterial({ color: '#c9b489', transparent: true, opacity: 0.42 }),
  );
  timeSkyGroup.add(orbitArc);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#e5a93c' }),
  );
  const sunHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.12, 1.55, 28),
    new THREE.MeshBasicMaterial({
      color: '#f0c465',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    }),
  );
  sunDisc.add(sunHalo);
  timeSkyGroup.add(sunDisc);

  const moonDisc = new THREE.Group();
  const moonBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 18, 14),
    new THREE.MeshBasicMaterial({ color: '#e8e2d0' }),
  );
  moonDisc.add(moonBody);
  timeSkyGroup.add(moonDisc);
  root.add(timeSkyGroup);

  // 石頭周圍一圈一圈變淡的年輪細線（不寫年數）
  const timeRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const r = 1.2 + i * 0.85;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 0.045, 40),
      new THREE.MeshBasicMaterial({
        color: '#8f7d60',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(STONE_BASE_POS.x, 0.1, STONE_BASE_POS.z);
    root.add(ring);
    timeRings.push(ring);
  }

  function setStoneUpright(u: number): void {
    const clamped = Math.max(0, Math.min(1, u));
    // u=0 時向 -X/+Z 平躺在橡樹旁地上（rotation.z = +1.47 rad ≈ 84°），u=1 時直立（0 rad）
    stonePivot.rotation.z = (1 - clamped) * 1.47;
    stonePivot.rotation.x = (1 - clamped) * 0.08;
    stonePivot.position.y = 0.08 + Math.sin(clamped * Math.PI) * 0.06;
    soilMound.scale.set(0.85 + clamped * 0.35, 0.25 + clamped * 0.55, 0.85 + clamped * 0.25);
  }

  // 預設躺下（開場即在橡樹旁）
  setStoneUpright(0);

  return {
    root,
    oakGroup,
    canopyClusters,
    stonePivot,
    stoneMesh,
    soilMound,
    dustGroup,
    prologueGroup,
    scrollGroup,
    reedPen,
    pastPit,
    pastBundle,
    coffinFull,
    timeSkyGroup,
    sunDisc,
    moonDisc,
    timeRings,
    setStoneUpright,
    triggerDust() {
      dustTimer = 0;
      dustGroup.visible = true;
    },
    updateIdle(time: number, dt: number, motionOff: boolean, windStrength: number) {
      if (!motionOff) {
        for (const c of canopyClusters) {
          const base = c.userData.basePos as THREE.Vector3 | undefined;
          const ph = (c.userData.phase as number) ?? 0;
          if (base) {
            c.position.x = base.x + Math.sin(time * 1.35 + ph) * 0.055 * windStrength;
            c.position.y = base.y + Math.cos(time * 1.05 + ph * 0.7) * 0.028 * windStrength;
          }
          c.rotation.z = Math.sin(time * 1.5 + ph) * 0.025 * windStrength;
        }
      }

      if (dustTimer >= 0) {
        dustTimer += dt;
        const p = Math.min(1, dustTimer / 1.15);
        dustMat.opacity = (1 - p) * 0.52;
        dustGroup.children.forEach((ch, idx) => {
          const dir = ch.userData.dir as THREE.Vector3;
          const dist = 0.45 + p * (1.35 + (idx % 3) * 0.25);
          ch.position.set(dir.x * dist, dir.y * p * 0.85, dir.z * dist);
          ch.scale.setScalar(0.7 + p * 1.4);
        });
        if (p >= 1) {
          dustTimer = -1;
          dustGroup.visible = false;
        }
      }
    },
    setOrbitPhase(turns: number, visible: boolean) {
      timeSkyGroup.visible = visible;
      for (let i = 0; i < timeRings.length; i++) {
        const mat = timeRings[i].material as THREE.MeshBasicMaterial;
        if (!visible) {
          mat.opacity = 0;
        } else {
          const appear = Math.max(0, Math.min(1, turns * 1.2 - i * 0.55));
          mat.opacity = appear * (0.34 - i * 0.06);
        }
      }
      if (!visible) return;

      // 太陽與月亮相差半圈，沿天穹圓弧繞行，高度維持在可見天空區間
      const sunAngle = (turns * Math.PI * 2) % (Math.PI * 2);
      const moonAngle = (sunAngle + Math.PI) % (Math.PI * 2);

      sunDisc.position.set(-Math.cos(sunAngle) * 17.5, 6.2 + Math.sin(sunAngle) * 7.8, 0);
      sunDisc.visible = sunDisc.position.y > 0.6;

      moonDisc.position.set(-Math.cos(moonAngle) * 17.5, 6.2 + Math.sin(moonAngle) * 7.8, 0);
      moonDisc.visible = moonDisc.position.y > 0.6;
    },
    preloadNight() { void oakNight.load(); },
    updateOakBillboard(camera: THREE.Camera, nightMix: number) {
      const dx = camera.position.x - OAK_POS.x;
      const dz = camera.position.z - OAK_POS.z;
      oakGroup.rotation.y = Math.atan2(dx, dz);
      if (nightMix > 0) void oakNight.load();
      if (oakNight.ready && !nightReadyAt) nightReadyAt = performance.now();
      const readyFade = nightReadyAt ? Math.min(1, (performance.now() - nightReadyAt) / 600) : 0;
      const mix = Math.max(0, Math.min(1, nightMix)) * readyFade;
      const dayMaterial = oakBuilt.dayCard.material as THREE.MeshBasicMaterial;
      const nightMaterial = oakBuilt.nightCard.material as THREE.MeshBasicMaterial;
      dayMaterial.opacity = 1 - mix;
      nightMaterial.opacity = mix;
      oakBuilt.dayCard.visible = mix < 0.999;
      oakBuilt.nightCard.visible = mix > 0.001;
    },
    swapFromBlenderGltf(lib: THREE.Group) {
      const bStone = lib.children.find((c) => c.name === 'prop_witness_stone');
      if (bStone) {
        stonePivot.remove(stoneMesh);
        const cloned = bStone.clone(true);
        cloned.position.set(0, 0, 0);
        cloned.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.geometry = mesh.geometry.clone();
          ensureStoneUv(mesh.geometry);
          mesh.material = paintedStoneMaterial();
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        stoneMesh = cloned;
        stonePivot.add(stoneMesh);
      }

      const bCoffin = lib.children.find((c) => c.name === 'prop_joseph_coffin');
      if (bCoffin) {
        coffinFull.clear();
        const cloned = bCoffin.clone(true);
        cloned.position.set(0, 0, 0);
        cloned.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        coffinFull.add(cloned);
      }

      const bTable = lib.children.find((c) => c.name === 'prop_scroll_table');
      if (bTable) {
        const keep = scrollGroup.children.filter(
          (ch) => ch === reedPen || ch.userData.inkRow !== undefined,
        );
        scrollGroup.clear();
        const cloned = bTable.clone(true);
        cloned.position.set(0, 0, 0);
        cloned.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        scrollGroup.add(cloned);
        for (const k of keep) scrollGroup.add(k);
      }
    },
  };
}
