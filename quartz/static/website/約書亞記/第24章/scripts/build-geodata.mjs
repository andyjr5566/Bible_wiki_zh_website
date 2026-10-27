// 整合公開地理資料產生 src/data/geo.json：
//   1. OpenBible.info《Bible Geocoding Data》（CC BY 4.0）候選座標與分數
//   2. Natural Earth 10m 水陸與河流向量底圖（公有領域）：廣域圖（兩河至埃及）與迦南放大圖
//   3. 與《民數記 33 章》網站對齊之出埃及至摩押平原曠野路線座標
//
// 首次下載外部原始檔至全新暫存資料夾：node scripts/build-geodata.mjs --download
// 一般執行（讀取暫存資料夾與本站 data/places.yaml）：node scripts/build-geodata.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../../..');
const SRC = process.env.GEO_SRC ?? resolve(tmpdir(), 'jos24-geo-src');
const PLACES_YAML = resolve(here, '../data/places.yaml');
const NUM33_CANDIDATES = resolve(ROOT, 'appendix/website/民數記/第33章/src/data/candidates.json');
const OUT_FILE = resolve(here, '../src/data/geo.json');

const FILES = {
  'ancient.jsonl': 'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl',
  'ne_10m_land.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson',
  'ne_10m_lakes.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson',
  'ne_10m_rivers_lake_centerlines.geojson':
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson',
};

const WIDE_BBOX = { w: 28.5, e: 48.0, s: 26.5, n: 38.5 };
const CANAAN_BBOX = { w: 34.0, e: 36.6, s: 31.0, n: 33.0 };

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '');

async function download() {
  mkdirSync(SRC, { recursive: true });
  for (const [name, url] of Object.entries(FILES)) {
    const file = resolve(SRC, name);
    if (existsSync(file)) continue;
    console.log('下載公開地理資料：', name);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}

function inside(p, edge, clip) {
  switch (edge) {
    case 'w':
      return p[0] >= clip.w;
    case 'e':
      return p[0] <= clip.e;
    case 's':
      return p[1] >= clip.s;
    case 'n':
      return p[1] <= clip.n;
  }
}

function cut(a, b, edge, clip) {
  const v = clip[edge];
  if (edge === 'w' || edge === 'e') {
    const t = (v - a[0]) / (b[0] - a[0]);
    return [v, a[1] + t * (b[1] - a[1])];
  }
  const t = (v - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), v];
}

function clipRing(ring, clip) {
  let pts = ring;
  for (const edge of ['w', 'e', 's', 'n']) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur, edge, clip)) {
        if (!inside(prev, edge, clip)) next.push(cut(prev, cur, edge, clip));
        next.push(cur);
      } else if (inside(prev, edge, clip)) {
        next.push(cut(prev, cur, edge, clip));
      }
    }
    pts = next;
    if (!pts.length) return [];
  }
  return pts;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function simplifyRing(pts, tol) {
  const closed =
    pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  if (!closed) return simplify(pts, tol);
  const open = pts.slice(0, -1);
  const mid = Math.floor(open.length / 2);
  const a = simplify(open.slice(0, mid + 1), tol);
  const b = simplify([...open.slice(mid), open[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function polygonsOf(geo) {
  const polys = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') polys.push({ props: f.properties, rings: g.coordinates });
    else if (g.type === 'MultiPolygon') {
      for (const p of g.coordinates) polys.push({ props: f.properties, rings: p });
    }
  }
  return polys;
}

function linesOf(geo) {
  const lines = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') lines.push({ props: f.properties, pts: g.coordinates });
    else if (g.type === 'MultiLineString') {
      for (const l of g.coordinates) lines.push({ props: f.properties, pts: l });
    }
  }
  return lines;
}

function buildBasemap(bbox, pad, tolLand, tolWater, majorRiversOnly = false) {
  const clip = { w: bbox.w - pad, e: bbox.e + pad, s: bbox.s - pad, n: bbox.n + pad };
  const enc = (pts) => pts.map(([x, y]) => [round(x, 3), round(y, 3)]);
  const bboxHit = (pts) => pts.some(([x, y]) => x >= clip.w && x <= clip.e && y >= clip.s && y <= clip.n);
  const read = (f) => JSON.parse(readFileSync(resolve(SRC, f), 'utf8'));

  const land = [];
  for (const { rings } of polygonsOf(read('ne_10m_land.geojson'))) {
    if (!bboxHit(rings[0])) {
      const inRing = (pt, r) => {
        let c = false;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          if (
            r[i][1] > pt[1] !== r[j][1] > pt[1] &&
            pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
          ) {
            c = !c;
          }
        }
        return c;
      };
      if (!inRing([clip.w + 0.01, clip.s + 0.01], rings[0])) continue;
    }
    const clipped = rings
      .map((r) => simplifyRing(clipRing(r, clip), tolLand))
      .filter((r) => r.length >= 3)
      .map(enc);
    if (clipped.length) land.push(clipped);
  }

  const lakes = [];
  for (const { props, rings } of polygonsOf(read('ne_10m_lakes.geojson'))) {
    if (!bboxHit(rings[0])) continue;
    const clipped = rings
      .map((r) => simplifyRing(clipRing(r, clip), tolWater))
      .filter((r) => r.length >= 3)
      .map(enc);
    if (clipped.length) lakes.push({ name: props.name ?? '', rings: clipped });
  }

  const rivers = [];
  for (const { props, pts } of linesOf(read('ne_10m_rivers_lake_centerlines.geojson'))) {
    const rName = String(props.name ?? '');
    const scalerank = Number(props.scalerank ?? 99);
    if (majorRiversOnly && scalerank > 6 && !/Euphrates|Tigris|Nile|Jordan|Yarmouk|Jabbok|Arnon/i.test(rName)) {
      continue;
    }
    const parts = [];
    let cur = [];
    const within = (p) => p[0] >= clip.w && p[0] <= clip.e && p[1] >= clip.s && p[1] <= clip.n;
    for (const p of pts) {
      if (within(p)) cur.push(p);
      else if (cur.length) {
        parts.push(cur);
        cur = [];
      }
    }
    if (cur.length) parts.push(cur);
    for (const part of parts) {
      if (part.length > 1) {
        const s = enc(simplify(part, tolWater));
        if (s.length > 1) rivers.push({ name: rName, pts: s });
      }
    }
  }

  return { bbox, land, lakes, rivers };
}

function levelFromCandidate(cand) {
  if (!cand) return 'none';
  const score = cand.score ?? 0;
  let b = score >= 700 ? 'high' : score >= 400 ? 'mid' : score >= 100 ? 'low' : 'none';
  const rank = { none: 0, low: 1, mid: 2, high: 3 };
  const cap = (l, max) => (rank[l] > rank[max] ? max : l);
  if (cand.kind === 'center') b = cap(b, 'low');
  if (cand.kind === 'representative point') b = cap(b, 'mid');
  return b;
}

function buildPlaces() {
  const obRows = readFileSync(resolve(SRC, 'ancient.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const rawYaml = YAML.parse(readFileSync(PLACES_YAML, 'utf8'));
  const places = {};

  for (const item of rawYaml.places) {
    const row = obRows.find((r) => r.friendly_id === item.openBibleFriendly);
    if (!row) {
      throw new Error(`OpenBible 找不到地名：${item.openBibleFriendly}`);
    }
    const cands = [];
    for (const id of row.identifications ?? []) {
      const res = id.resolutions?.[0];
      if (!res?.lonlat) continue;
      const [lon, lat] = res.lonlat.split(',').map(Number);
      cands.push({
        name: strip(id.description),
        lon: round(lon, 4),
        lat: round(lat, 4),
        kind: res.lonlat_type,
        score: id.score?.time_total ?? 0,
      });
    }
    cands.sort((a, b) => b.score - a.score);
    const top = cands[0];
    const lon = item.overrideLon ?? top?.lon ?? 35.2819;
    const lat = item.overrideLat ?? top?.lat ?? 32.2136;

    places[item.id] = {
      id: item.id,
      nameZh: item.nameZh,
      lon: round(lon, 4),
      lat: round(lat, 4),
      level: item.unlocated
        ? 'none'
        : item.uncertain && item.id === 'gaash'
          ? 'low'
          : levelFromCandidate(top),
      uncertain: Boolean(item.uncertain),
      ...(item.unlocated ? { unlocated: true } : {}),
      ...(item.rKm ? { rKm: item.rKm } : {}),
      modernLabel: item.modernLabel,
      summary: item.summary,
      ...(item.controversy ? { controversy: item.controversy } : {}),
      verses: item.verses,
      ...(item.entryKey ? { entryKey: item.entryKey } : {}),
      openBibleFriendly: item.openBibleFriendly,
      openBibleSlug: row.url_slug,
      candidates: cands.slice(0, 5),
    };
  }
  return places;
}

function buildWildernessRoute() {
  if (!existsSync(NUM33_CANDIDATES)) {
    throw new Error(`找不到民數記33章座標檔：${NUM33_CANDIDATES}`);
  }
  const num33 = JSON.parse(readFileSync(NUM33_CANDIDATES, 'utf8'));
  // 對齊民數記 33 章網站 PICK 例外（etham 採 index 3 Tell Hebua, eziongeber 採 index 1 Tell el-Kheleifeh）
  const keyPicks = [
    ['rameses', 0],
    ['succoth', 0],
    ['etham', 3],
    ['marah', 0],
    ['elim', 0],
    ['rephidim', 0],
    ['sinai', 0],
    ['hazeroth', 0],
    ['eziongeber', 1],
    ['kadesh', 0],
    ['hor', 0],
    ['punon', 0],
    ['oboth', 0],
    ['dibon', 0],
    ['abelshittim', 0],
  ];
  return keyPicks.map(([key, idx]) => {
    const c = num33[key]?.cands?.[idx] ?? num33[key]?.cands?.[0];
    if (!c) throw new Error(`民33 缺少站點座標：${key}`);
    return [round(c.lon, 4), round(c.lat, 4)];
  });
}

if (process.argv.includes('--download')) {
  await download();
}
if (!existsSync(resolve(SRC, 'ancient.jsonl'))) {
  console.error(`找不到公開地理原始檔（${SRC}）。請先執行：node scripts/build-geodata.mjs --download`);
  process.exit(1);
}

const wide = buildBasemap(WIDE_BBOX, 0.8, 0.025, 0.02, true);
const canaan = buildBasemap(CANAAN_BBOX, 0.35, 0.004, 0.003, false);
const places = buildPlaces();
const wildernessRoute = buildWildernessRoute();

const geo = { wide, canaan, wildernessRoute, places };
const json = JSON.stringify(geo) + '\n';
writeFileSync(OUT_FILE, json, 'utf8');
console.log(
  `geo.json: ${(json.length / 1024).toFixed(1)} KB, 地點=${Object.keys(places).length}, 曠野折點=${wildernessRoute.length}`,
);
