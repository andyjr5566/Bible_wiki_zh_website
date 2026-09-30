// 產生兩份地理資料，都寫進 src/data/：
//   candidates.json  每一站的候選現代地點（座標、可信度分數），取自 OpenBible.info 的
//                    Bible Geocoding Data（CC BY 4.0）：https://github.com/openbibleinfo/Bible-Geocoding-Data
//   basemap.json     底圖：海岸線、湖、河，取自 Natural Earth（公有領域）：https://www.naturalearthdata.com/
//
// 來源檔很大，不進版控。第一次先下載：  node scripts/build-geodata.mjs --download
// 之後可以指定放在別處的來源目錄：      GEO_SRC=/path/to/dir node scripts/build-geodata.mjs
// 產物（兩份 JSON）進版控，網站建置時不連網。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.GEO_SRC ?? resolve(tmpdir(), 'num33-geo');
const OUT = resolve(here, '../src/data');

const FILES = {
  'ancient.jsonl': 'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl',
  'ne_10m_land.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson',
  'ne_10m_lakes.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson',
  'ne_10m_rivers_lake_centerlines.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson',
};

/** 地圖範圍（度）：尼羅河三角洲到約旦河、西乃半島南端 */
export const BBOX = { w: 29.5, e: 36.5, s: 27.4, n: 32.4 };
/** 底圖裁切範圍比顯示範圍多一圈，這樣平移到邊緣時不會看到一條直線的切邊 */
const CLIP = { w: BBOX.w - 1.6, e: BBOX.e + 1.6, s: BBOX.s - 1.4, n: BBOX.n + 1.2 };

/** 我們的站 → OpenBible 的地名（friendly_id）。「站」以外的地標也放在這裡 */
export const OB = {
  rameses: 'Rameses', succoth: 'Succoth 2', etham: 'Etham', migdol: 'Migdol 1',
  pihahiroth: 'Pi-hahiroth', baalzephon: 'Baal-zephon', marah: 'Marah', elim: 'Elim',
  redsea: 'Red Sea 3', crossing: 'Red Sea 1', sin: 'Sin', dophkah: 'Dophkah', alush: 'Alush', rephidim: 'Rephidim',
  sinai: 'Mount Sinai', kibroth: 'Kibroth-hattaavah', hazeroth: 'Hazeroth', rithmah: 'Rithmah',
  rimmonperez: 'Rimmon-perez', libnah: 'Libnah 2', rissah: 'Rissah', kehelathah: 'Kehelathah',
  shepher: 'Mount Shepher', haradah: 'Haradah', makheloth: 'Makheloth', tahath: 'Tahath',
  terah: 'Terah', mithkah: 'Mithkah', hashmonah: 'Hashmonah', moseroth: 'Moseroth',
  benejaakan: 'Bene-jaakan', horhagidgad: 'Hor-haggidgad', jotbathah: 'Jotbathah',
  abronah: 'Abronah', eziongeber: 'Ezion-geber', kadesh: 'Kadesh-barnea', hor: 'Mount Hor 1',
  zalmonah: 'Zalmonah', punon: 'Punon', oboth: 'Oboth', iyeabarim: 'Iye-abarim',
  dibon: 'Dibon 1', almon: 'Almon-diblathaim', abarim: 'Abarim', bethjeshimoth: 'Beth-jeshimoth',
  abelshittim: 'Abel-shittim', jericho: 'Jericho 1',
};

const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '');
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

async function download() {
  mkdirSync(SRC, { recursive: true });
  for (const [name, url] of Object.entries(FILES)) {
    const file = resolve(SRC, name);
    if (existsSync(file)) continue;
    console.log('下載', name);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}

function buildCandidates() {
  const rows = readFileSync(resolve(SRC, 'ancient.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const out = {};
  for (const [key, friendly] of Object.entries(OB)) {
    const r = rows.find((x) => x.friendly_id === friendly);
    if (!r) throw new Error(`OpenBible 找不到 ${friendly}`);
    const cands = [];
    for (const id of r.identifications ?? []) {
      const res = id.resolutions?.[0];
      if (!res?.lonlat) continue;
      const [lon, lat] = res.lonlat.split(',').map(Number);
      cands.push({
        name: strip(id.description),
        lon: round(lon, 4), lat: round(lat, 4),
        kind: res.lonlat_type, // point／center／representative point
        score: id.score?.time_total ?? 0,
      });
    }
    cands.sort((a, b) => b.score - a.score);
    out[key] = { friendly, slug: r.url_slug, cands: cands.slice(0, 8) };
  }
  return out;
}

/* ---- 底圖：裁到範圍內並簡化 ---- */
const inside = (p, edge) => {
  switch (edge) {
    case 'w': return p[0] >= CLIP.w;
    case 'e': return p[0] <= CLIP.e;
    case 's': return p[1] >= CLIP.s;
    case 'n': return p[1] <= CLIP.n;
  }
};
function cut(a, b, edge) {
  const v = { w: CLIP.w, e: CLIP.e, s: CLIP.s, n: CLIP.n }[edge];
  if (edge === 'w' || edge === 'e') { const t = (v - a[0]) / (b[0] - a[0]); return [v, a[1] + t * (b[1] - a[1])]; }
  const t = (v - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), v];
}
/** Sutherland–Hodgman：一個環裁到範圍內 */
function clipRing(ring) {
  let pts = ring;
  for (const edge of ['w', 'e', 's', 'n']) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur, edge)) {
        if (!inside(prev, edge)) next.push(cut(prev, cur, edge));
        next.push(cur);
      } else if (inside(prev, edge)) next.push(cut(prev, cur, edge));
    }
    pts = next;
    if (!pts.length) return [];
  }
  return pts;
}
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** 封閉環首尾同點，Douglas–Peucker 的弦長為 0 會整個丟掉：先從中間切成兩段再簡化 */
function simplifyRing(pts, tol) {
  const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  if (!closed) return simplify(pts, tol);
  const open = pts.slice(0, -1);
  const mid = Math.floor(open.length / 2);
  const a = simplify(open.slice(0, mid + 1), tol);
  const b = simplify([...open.slice(mid), open[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
const enc = (pts) => pts.map(([x, y]) => [round(x, 3), round(y, 3)]);
const bboxHit = (pts) => pts.some(([x, y]) => x >= CLIP.w && x <= CLIP.e && y >= CLIP.s && y <= CLIP.n);

function polygonsOf(geo) {
  const polys = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') polys.push({ props: f.properties, rings: g.coordinates });
    else if (g.type === 'MultiPolygon') for (const p of g.coordinates) polys.push({ props: f.properties, rings: p });
  }
  return polys;
}
function linesOf(geo) {
  const lines = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') lines.push({ props: f.properties, pts: g.coordinates });
    else if (g.type === 'MultiLineString') for (const l of g.coordinates) lines.push({ props: f.properties, pts: l });
  }
  return lines;
}

/** 折線裁到範圍內：用逐段檢查，超出的部分切掉 */
function clipLine(pts) {
  const parts = [];
  let cur = [];
  const within = (p) => p[0] >= CLIP.w && p[0] <= CLIP.e && p[1] >= CLIP.s && p[1] <= CLIP.n;
  for (const p of pts) {
    if (within(p)) cur.push(p);
    else if (cur.length) { parts.push(cur); cur = []; }
  }
  if (cur.length) parts.push(cur);
  return parts.filter((l) => l.length > 1);
}

function buildBasemap() {
  const read = (f) => JSON.parse(readFileSync(resolve(SRC, f), 'utf8'));
  const land = [];
  for (const { rings } of polygonsOf(read('ne_10m_land.geojson'))) {
    if (!bboxHit(rings[0])) {
      // 環可能整個包住範圍（例如一大塊陸地）：檢查範圍角點是否在環內
      const inRing = (pt, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
      if (!inRing([CLIP.w + 0.01, CLIP.s + 0.01], rings[0])) continue;
    }
    const clipped = rings.map((r) => simplifyRing(clipRing(r), 0.004)).filter((r) => r.length >= 3).map(enc);
    if (clipped.length) land.push(clipped);
  }
  const lakes = [];
  for (const { props, rings } of polygonsOf(read('ne_10m_lakes.geojson'))) {
    if (!bboxHit(rings[0])) continue;
    const clipped = rings.map((r) => simplifyRing(clipRing(r), 0.003)).filter((r) => r.length >= 3).map(enc);
    if (clipped.length) lakes.push({ name: props.name ?? '', rings: clipped });
  }
  const rivers = [];
  for (const { props, pts } of linesOf(read('ne_10m_rivers_lake_centerlines.geojson'))) {
    for (const part of clipLine(pts)) rivers.push({ name: props.name ?? '', pts: enc(simplify(part, 0.003)) });
  }
  return { bbox: BBOX, land, lakes, rivers };
}

if (process.argv.includes('--download')) await download();
if (!existsSync(resolve(SRC, 'ancient.jsonl'))) {
  console.error(`找不到來源檔（${SRC}）。先執行：node scripts/build-geodata.mjs --download`);
  process.exit(1);
}
const candidates = buildCandidates();
writeFileSync(resolve(OUT, 'candidates.json'), JSON.stringify(candidates, null, 0) + '\n', 'utf8');
console.log(`candidates.json: ${Object.keys(candidates).length} 個地名`);
const basemap = buildBasemap();
const json = JSON.stringify(basemap) + '\n';
writeFileSync(resolve(OUT, 'basemap.json'), json, 'utf8');
console.log(`basemap.json: 陸地 ${basemap.land.length} 塊、湖 ${basemap.lakes.length}、河 ${basemap.rivers.length} 段、${(json.length / 1024).toFixed(0)} KB`);
