import * as THREE from 'three';
import type { SiteData } from '../data/types';
import { stations } from './stations';

const SHECHEM_LON = 35.288;
const SHECHEM_LAT = 32.214;
const DEG_LAT_M = 6.2;
const DEG_LON_M = DEG_LAT_M * Math.cos((SHECHEM_LAT * Math.PI) / 180);

/** 將經緯度投影至以示劍 (0, 0) 為原點的 3D 記憶地圖平面 (+X 東, -Z 北, +Z 南) */
export function lonLatToMapXZ(lon: number, lat: number): [number, number] {
  const x = (lon - SHECHEM_LON) * DEG_LON_M;
  const z = -(lat - SHECHEM_LAT) * DEG_LAT_M;
  return [x, z];
}

export interface MemoryMapHandle {
  group: THREE.Group;
  coffinMarker: THREE.Group;
  coffinWorldPos: THREE.Vector3;
  coffinVisible: boolean;
  setVisibility(alpha: number): void;
  update(
    cue: string,
    beatProgress: number,
    onlyI: boolean,
    sameGive: boolean,
    dark: boolean,
    time: number,
    motionOff: boolean,
  ): void;
  applyReliefImage(img: HTMLImageElement): void;
  stationFlight(index: number, progress: number, verse: number, onlyI: boolean, time?: number): THREE.Vector3;
}

export function createMemoryMap(data: SiteData): MemoryMapHandle {
  const group = new THREE.Group();
  group.name = 'jos_memory_map';
  group.position.y = 0.28;
  group.visible = false;

  const bbox = data.geo.wide.bbox; // w:28.5, e:48.0, s:26.5, n:38.5
  const [xMin, zMax] = lonLatToMapXZ(bbox.w, bbox.s);
  const [xMax, zMin] = lonLatToMapXZ(bbox.e, bbox.n);
  const mapW = xMax - xMin;
  const mapD = zMax - zMin;
  const centerX = (xMin + xMax) / 2;
  const centerZ = (zMin + zMax) / 2;

  const texCanvas = document.createElement('canvas');
  texCanvas.width = 2048;
  texCanvas.height = 1536;
  const ctx = texCanvas.getContext('2d')!;
  let reliefImg: HTMLImageElement | null = null;
  let lastDarkState: boolean | null = null;

  const mapTexture = new THREE.CanvasTexture(texCanvas);
  mapTexture.colorSpace = THREE.SRGBColorSpace;
  mapTexture.anisotropy = 4;

  function toPx(lon: number, lat: number): [number, number] {
    const u = (lon - bbox.w) / (bbox.e - bbox.w);
    const v = (bbox.n - lat) / (bbox.n - bbox.s);
    return [u * texCanvas.width, v * texCanvas.height];
  }

  function redrawMapCanvas(dark: boolean): void {
    const W = texCanvas.width;
    const H = texCanvas.height;

    // 1. 海面底色
    ctx.fillStyle = dark ? '#1a2a34' : '#cfc2a6';
    ctx.fillRect(0, 0, W, H);

    // 海面細微橫向版畫水紋
    ctx.strokeStyle = dark ? 'rgba(235,227,210,0.04)' : 'rgba(30,27,22,0.05)';
    ctx.lineWidth = 1;
    for (let y = 8; y < H; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // 2. 陸地多邊形裁切＋羊皮紙底色＋（若有）真實高程暈渲疊加
    ctx.save();
    ctx.beginPath();
    for (const poly of data.geo.wide.land) {
      for (const ring of poly) {
        ring.forEach(([lon, lat], idx) => {
          const [px, py] = toPx(lon, lat);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
      }
    }
    ctx.fillStyle = dark ? '#4a4230' : '#e8dec9';
    ctx.fill();

    if (reliefImg) {
      ctx.clip();
      ctx.globalAlpha = dark ? 0.5 : 0.62;
      ctx.globalCompositeOperation = dark ? 'soft-light' : 'multiply';
      ctx.drawImage(reliefImg, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    // 3. 海岸墨線
    ctx.strokeStyle = dark ? 'rgba(240,230,205,0.7)' : 'rgba(30,27,22,0.62)';
    ctx.lineWidth = 2.2;
    for (const poly of data.geo.wide.land) {
      for (const ring of poly) {
        ctx.beginPath();
        ring.forEach(([lon, lat], idx) => {
          const [px, py] = toPx(lon, lat);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.stroke();
      }
    }

    // 4. 內陸湖泊（加利利海、死海等）
    ctx.fillStyle = dark ? '#27424f' : '#b8c3be';
    ctx.strokeStyle = dark ? 'rgba(235,227,210,0.45)' : 'rgba(30,27,22,0.55)';
    ctx.lineWidth = 1.6;
    for (const lk of data.geo.wide.lakes) {
      ctx.beginPath();
      for (const ring of lk.rings) {
        ring.forEach(([lon, lat], idx) => {
          const [px, py] = toPx(lon, lat);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }

    // 5. 河流（幼發拉底河、底格里斯河、尼羅河、約但河等）
    ctx.strokeStyle = dark ? 'rgba(138,168,184,0.68)' : 'rgba(62,86,98,0.72)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const rv of data.geo.wide.rivers) {
      if (rv.pts.length < 2) continue;
      ctx.beginPath();
      rv.pts.forEach(([lon, lat], idx) => {
        const [px, py] = toPx(lon, lat);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // 6. 經緯度細格線
    ctx.strokeStyle = dark ? 'rgba(235,227,210,0.07)' : 'rgba(30,27,22,0.08)';
    ctx.lineWidth = 1;
    for (let lon = 30; lon <= 46; lon += 2) {
      const [px] = toPx(lon, 32);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
    for (let lat = 28; lat <= 38; lat += 2) {
      const [, py] = toPx(35, lat);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
      ctx.stroke();
    }

    // 7. 區域與地形地名（站點名稱改由飛行時的目的地名牌顯示，避免重複）
    const labels: { text: string; lon: number; lat: number; big?: boolean; italic?: boolean }[] = [
      { text: '大河那邊（幼發拉底河）', lon: 41.2, lat: 35.4, big: true },
      { text: '吾珥', lon: 46.1, lat: 30.65 },
      { text: '迦南地', lon: 34.85, lat: 32.55, big: true },
      { text: '西珥山', lon: 35.65, lat: 30.22 },
      { text: '埃及', lon: 31.1, lat: 30.35, big: true },
      { text: '紅海', lon: 32.85, lat: 29.35 },
      { text: '曠野（許多年日）', lon: 33.85, lat: 29.55 },
      { text: '地中海', lon: 32.2, lat: 33.6, italic: true },
    ];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const lb of labels) {
      const [px, py] = toPx(lb.lon, lb.lat);
      ctx.font = `${lb.big ? '700 26px' : '600 20px'} "Noto Serif TC", serif`;
      ctx.fillStyle = dark ? 'rgba(235,227,210,0.86)' : 'rgba(30,27,22,0.84)';
      ctx.fillText(lb.text, px, py);
    }

    mapTexture.needsUpdate = true;
  }

  redrawMapCanvas(false);

  const boardMat = new THREE.MeshStandardMaterial({
    map: mapTexture,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    opacity: 1,
  });
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapD, 1, 1), boardMat);
  boardMesh.rotation.x = -Math.PI / 2;
  boardMesh.position.set(centerX, 0, centerZ);
  boardMesh.receiveShadow = true;
  group.add(boardMesh);

  // ---- 歷史路線折點（從吾珥→哈蘭→示劍→希伯崙→埃及→紅海→曠野→摩押→耶利哥→示劍） ----
  function pXZ(placeId: string): THREE.Vector3 {
    const pl = data.places[placeId];
    if (!pl) return new THREE.Vector3(0, 0.14, 0);
    const [x, z] = lonLatToMapXZ(pl.lon, pl.lat);
    return new THREE.Vector3(x, 0.14, z);
  }

  const flightPosition = new THREE.Vector3();
  // 曠野一段沿民數記33章的路線大略走過：拉美西斯→疏割→以倘→（過紅海）→瑪拉→以琳→利非訂→西奈→哈洗羅→以旬迦別→加低斯→何珥山→普嫩→阿伯→底本→亞並‧什亭（摩押平原）。
  // 資料順序與 build-geodata 的 keyPicks 相同，共 15 站。
  const wild = data.geo.wildernessRoute.map(([lon, lat]) => {
    const [x, z] = lonLatToMapXZ(lon, lat);
    return new THREE.Vector3(x, 0.14, z);
  });
  const waypointsBetween = (from: string, to: string): THREE.Vector3[] => {
    if (from === 'rameses' && to === 'redsea') return wild.slice(1, 3);
    if (from === 'redsea' && to === 'kadesh') return wild.slice(3, 9);
    if (from === 'kadesh' && to === 'heshbon') return wild.slice(10, 14);
    return [];
  };
  const routePoints: THREE.Vector3[] = [];
  const stationRouteIndex: number[] = [];
  const campPoints: { vec: THREE.Vector3; index: number }[] = [];
  stations.forEach((st, i) => {
    if (i > 0) {
      for (const wp of waypointsBetween(stations[i - 1].place, st.place)) {
        campPoints.push({ vec: wp, index: routePoints.length });
        routePoints.push(wp);
      }
    }
    stationRouteIndex.push(routePoints.length);
    routePoints.push(pXZ(st.place));
  });
  const stationT = stationRouteIndex.map(i => i / (routePoints.length - 1));
  const routeCurve = new THREE.CatmullRomCurve3(routePoints, false, 'centripetal');
  const TOTAL_SAMPLES = 240;
  const sampledPts = routeCurve.getPoints(TOTAL_SAMPLES);

  /** 沿路線鋪一條貼地的帶子，寬度看得清；draw range 以「段」為單位，與取樣點一一對應。 */
  function buildRibbon(width: number, color: string, opacity: number) {
    const positions: number[] = [];
    const indices: number[] = [];
    sampledPts.forEach((pt, i) => {
      const prev = sampledPts[Math.max(0, i - 1)];
      const next = sampledPts[Math.min(sampledPts.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      const nx = (-tz / len) * width / 2;
      const nz = (tx / len) * width / 2;
      positions.push(pt.x + nx, pt.y, pt.z + nz, pt.x - nx, pt.y, pt.z - nz);
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { geo, mat };
  }
  // 整條路線淡淡先畫好（知道要去哪），走過的部分用亮金色加粗。
  const routeAhead = buildRibbon(0.16, '#d8a44f', 0.3);
  const route = buildRibbon(0.3, '#f0b64e', 0.95);
  const routeGeo = route.geo;
  const routeMat = route.mat;
  const setRouteQuads = (quads: number) => routeGeo.setDrawRange(0, Math.max(1, Math.min(TOTAL_SAMPLES, quads)) * 6);
  setRouteQuads(1);

  // ---- 目前位置的亮點與環
  const travelDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 1, depthWrite: false }),
  );
  travelDot.position.y = 0.3;
  const travelRing = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.86, 28),
    new THREE.MeshBasicMaterial({ color: '#f0b64e', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  travelRing.rotation.x = -Math.PI / 2;
  travelRing.position.y = 0.2;
  travelDot.renderOrder = 4;
  travelRing.renderOrder = 3;
  group.add(travelDot, travelRing);

  // ---- 站點小圓點（走過的亮起）
  const stopIndexByPlace = new Map<string, number>();
  stations.forEach((st, i) => { if (!stopIndexByPlace.has(st.place)) stopIndexByPlace.set(st.place, i); });
  const stopMarks = [...stopIndexByPlace.entries()].map(([placeId, firstIndex]) => {
    const p = pXZ(placeId);
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 18),
      new THREE.MeshBasicMaterial({ color: '#f0b64e', transparent: true, opacity: 0.4, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, 0.19, p.z);
    mesh.renderOrder = 3;
    group.add(mesh);
    return { firstIndex, mesh };
  });

  // 曠野各處紮營的地方：小點，不加名字，走到才亮
  const campMarks = campPoints.map(({ vec, index }) => {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.17, 14),
      new THREE.MeshBasicMaterial({ color: '#f0b64e', transparent: true, opacity: 0.3, depthWrite: false, depthTest: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(vec.x, 0.18, vec.z);
    mesh.renderOrder = 3;
    group.add(mesh);
    return { t: index / (routePoints.length - 1), mesh };
  });

  // ---- 目的地名牌：飛向哪裡，就在那裡立一塊名字
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false, depthWrite: false }));
  labelSprite.scale.set(7, 1.75, 1);
  labelSprite.renderOrder = 10;
  group.add(labelSprite);
  let labelPlace = '';
  let labelDark = false;
  function drawLabel(text: string, dark: boolean): void {
    const lc = labelCanvas.getContext('2d')!;
    lc.clearRect(0, 0, 512, 128);
    lc.font = '700 60px "Noto Serif TC", serif';
    lc.textAlign = 'center';
    lc.textBaseline = 'middle';
    lc.lineJoin = 'round';
    lc.lineWidth = 14;
    lc.strokeStyle = dark ? 'rgba(20,17,12,0.92)' : 'rgba(250,244,229,0.94)';
    lc.strokeText(text, 256, 66);
    lc.fillStyle = dark ? '#ffe3a0' : '#4a2e0c';
    lc.fillText(text, 256, 66);
    labelTexture.needsUpdate = true;
  }

  // ---- 20 盞「神說『我』」的金色小燈 (--jos-lamp) ----
  const lampGroup = new THREE.Group();
  interface LampRecord {
    verse: number;
    root: THREE.Group;
    flame: THREE.Mesh;
    pillar: THREE.Mesh;
    halo: THREE.Mesh;
  }
  const lamps: LampRecord[] = [];
  const lampCountPerPlace = new Map<string, number>();

  for (const verb of data.step.oneCsVerbs) {
    const countHere = lampCountPerPlace.get(verb.placeId) ?? 0;
    lampCountPerPlace.set(verb.placeId, countHere + 1);

    const base = pXZ(verb.placeId);
    // 同一地點多個 1cs 動詞以黃金角微幅散開，20 盞燈顆顆可辨
    const goldenAngle = countHere * 2.39996;
    const spread = countHere === 0 ? 0 : 0.62 + countHere * 0.26;
    const lx = base.x + Math.cos(goldenAngle) * spread;
    const lz = base.z + Math.sin(goldenAngle) * spread;

    const lRoot = new THREE.Group();
    lRoot.position.set(lx, 0.16, lz);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#e0aa4c', transparent: true, opacity: 0 }),
    );
    flame.position.y = 0.25;
    lRoot.add(flame);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.18, 2.6, 10),
      new THREE.MeshBasicMaterial({
        color: '#e0aa4c',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    pillar.position.y = 1.3;
    lRoot.add(pillar);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.56, 20),
      new THREE.MeshBasicMaterial({
        color: '#b5832a',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    lRoot.add(halo);

    lampGroup.add(lRoot);
    lamps.push({ verse: verb.verse, root: lRoot, flame, pillar, halo });
  }
  group.add(lampGroup);

  // ---- 7 處「同一個『給』」(H5414) 橄欖金圓環 ----
  const givePlaces = ['canaan-walk', 'seir', 'egypt', 'heshbon', 'jericho', 'shechem', 'ephraim-hill'];
  const giveRings: THREE.Mesh[] = givePlaces.map((pid, idx) => {
    const p = pXZ(pid);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55 + (idx % 2) * 0.12, 0.78 + (idx % 2) * 0.12, 24),
      new THREE.MeshBasicMaterial({
        color: '#6e874c',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.2, p.z);
    group.add(ring);
    return ring;
  });

  // 約瑟的靈柩只在說書畫面（出埃及、抵達迦南）出現；地圖上不放，避免被當成多餘的方塊。
  const coffinMarker = new THREE.Group();
  coffinMarker.visible = false;
  const coffinWorldPos = new THREE.Vector3();
  const coffinVisible = false;

  const CUE_ROUTE_FRAC: Record<string, [number, number, number]> = {
    'beyond-river': [0.0, 0.08, 2],
    abraham: [0.08, 0.37, 4],
    egypt: [0.37, 0.63, 7],
    east: [0.63, 0.82, 10],
    jericho: [0.82, 0.95, 12],
    gifts: [0.95, 1.0, 13],
    'family-2': [1.0, 1.0, 13],
  };

  return {
    group,
    coffinMarker,
    coffinWorldPos,
    get coffinVisible() {
      return coffinVisible;
    },
    setVisibility(alpha: number) {
      const a = Math.max(0, Math.min(1, alpha));
      group.visible = a > 0.01;
      boardMat.opacity = a;
      routeMat.opacity = a * 0.95;
      routeAhead.mat.opacity = a * 0.3;
      (labelSprite.material as THREE.SpriteMaterial).opacity = a;
    },
    update(cue, beatProgress, onlyI, sameGive, dark, time, motionOff) {
      if (lastDarkState !== dark) {
        lastDarkState = dark;
        redrawMapCanvas(dark);
      }
      if (!group.visible) return;

      const [r0, r1, maxVerse] = CUE_ROUTE_FRAC[cue] ?? [1, 1, 13];
      const frac = r0 + (r1 - r0) * beatProgress;
      setRouteQuads(Math.round(frac * TOTAL_SAMPLES));
      travelDot.visible = false;
      travelRing.visible = false;
      labelSprite.visible = false;

      // 20 盞「神說『我』」的燈
      const pulse = motionOff ? 1 : 0.92 + Math.sin(time * 2.8) * 0.08;
      for (const lp of lamps) {
        const reached = lp.verse <= maxVerse;
        const fMat = lp.flame.material as THREE.MeshBasicMaterial;
        const pMat = lp.pillar.material as THREE.MeshBasicMaterial;
        const hMat = lp.halo.material as THREE.MeshBasicMaterial;

        if (onlyI) {
          fMat.opacity = 0.98;
          pMat.opacity = 0.52 * pulse;
          hMat.opacity = 0.78 * pulse;
          lp.flame.scale.setScalar(1.35 * pulse);
        } else if (reached) {
          fMat.opacity = 0.84;
          pMat.opacity = lp.verse === maxVerse ? 0.28 : 0.08;
          hMat.opacity = 0.45;
          lp.flame.scale.setScalar(1.0);
        } else {
          fMat.opacity = 0.12;
          pMat.opacity = 0;
          hMat.opacity = 0;
          lp.flame.scale.setScalar(0.75);
        }
      }

      // 7 處「同一個『給』」圓環
      for (const gr of giveRings) {
        const gMat = gr.material as THREE.MeshBasicMaterial;
        gMat.opacity = sameGive ? 0.85 * pulse : 0;
      }
    },
    stationFlight(index, progress, verse, onlyI, time = 0) {
      const fromT = stationT[Math.max(0, index - 1)];
      const stopT = index > 0 ? fromT + (stationT[index] - fromT) * progress : fromT;
      routeCurve.getPoint(stopT, flightPosition);
      setRouteQuads(Math.round(stopT * TOTAL_SAMPLES));
      travelDot.visible = true;
      travelRing.visible = true;
      travelDot.position.set(flightPosition.x, 0.3, flightPosition.z);
      travelRing.position.set(flightPosition.x, 0.2, flightPosition.z);
      travelRing.scale.setScalar(1 + 0.18 * Math.sin(time * 3));
      for (const mark of stopMarks) {
        const reached = mark.firstIndex < index || (mark.firstIndex === index && progress > 0.97);
        (mark.mesh.material as THREE.MeshBasicMaterial).opacity = reached ? 0.95 : 0.38;
      }
      const dark = lastDarkState ?? false;
      for (const camp of campMarks) {
        const cm = camp.mesh.material as THREE.MeshBasicMaterial;
        cm.opacity = camp.t <= stopT ? 0.9 : 0.28;
        cm.color.set(dark ? '#f0b64e' : '#a85f16');
      }
      route.mat.color.set(dark ? '#f0b64e' : '#a85f16');
      routeAhead.mat.color.set(dark ? '#d8a44f' : '#7a4a14');
      (travelDot.material as THREE.MeshBasicMaterial).color.set(dark ? '#ffe3a0' : '#fff4d0');
      (travelRing.material as THREE.MeshBasicMaterial).color.set(dark ? '#f0b64e' : '#a85f16');
      for (const mark of stopMarks) (mark.mesh.material as THREE.MeshBasicMaterial).color.set(dark ? '#f0b64e' : '#a85f16');
      const destination = stations[index].place;
      if (labelPlace !== destination || labelDark !== dark) {
        labelPlace = destination;
        labelDark = dark;
        drawLabel((data.places[destination]?.nameZh ?? '').split(/[（(]/)[0], dark);
      }
      const dest = pXZ(destination);
      labelSprite.position.set(dest.x, 1.9, dest.z);
      labelSprite.visible = true;
      // 20 盞「神說『我』」的燈只在「只看神說我」時亮起；平常飛行只看路線、站點與目的地。
      for (const lamp of lamps) {
        const reached = lamp.verse <= verse;
        (lamp.flame.material as THREE.MeshBasicMaterial).opacity = onlyI ? (reached ? .98 : .12) : 0;
        (lamp.pillar.material as THREE.MeshBasicMaterial).opacity = onlyI && reached ? .35 : 0;
        (lamp.halo.material as THREE.MeshBasicMaterial).opacity = onlyI && reached ? .7 : 0;
      }
      return flightPosition;
    },
    applyReliefImage(img: HTMLImageElement) {
      reliefImg = img;
      redrawMapCanvas(lastDarkState ?? false);
    },
  };
}
