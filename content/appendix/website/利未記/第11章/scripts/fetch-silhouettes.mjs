// 從 PhyloPic（https://www.phylopic.org）下載動物剪影，寫成 src/data/silhouettes.json。
// 只收 CC0／公眾領域／CC BY 授權的圖，並記下作者與授權，網站的「關於」頁會列出來。
// 產物進版控；建置時不連網。要換圖或加圖再手動跑：npm run silhouettes
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const API = 'https://api.phylopic.org';

/** id → 學名候選（PhyloPic 的分類名稱，依序嘗試）。只畫經文點名、而且原文與和合本認得出來的動物 */
const WANT = {
  cattle: ['Bos taurus'],
  sheep: ['Ovis aries'],
  goat: ['Capra aegagrus hircus', 'Capra hircus', 'Capra aegagrus', 'Capra'],
  camel: ['Camelus dromedarius'],
  // Procavia capensis 唯一的圖是點陣描線，和其他剪影不搭；改用同科（蹄兔科）的樹蹄兔剪影
  hyrax: [{ uuid: 'bae84fd8-937a-4390-b123-0a22bfcd7df7', name: 'Dendrohyrax（蹄兔科）' }],
  hare: ['Lepus europaeus', 'Lepus capensis', 'Lepus'],
  pig: ['Sus scrofa domesticus', 'Sus scrofa'],
  fish: ['Cyprinus carpio'],
  raven: ['Corvus corax'],
  bat: ['Pipistrellus', 'Myotis', 'Chiroptera'],
  locust: ['Schistocerca gregaria', 'Locusta migratoria', 'Acrididae'],
  // 蜥蜴、蛇：挑側身、輪廓清楚的圖，縮小成圖示也認得出來
  lizard: [{ uuid: '18af6753-2f5b-49d2-a28d-4cc1b7deaf6f', name: 'Lacerta agilis' }],
  snake: [{ uuid: 'a9488378-72dc-4b6f-965a-6f6496ce9459', name: 'Lampropeltis californiae' }],
};

const OK = [/publicdomain\/zero/, /publicdomain\/mark/, /licenses\/by\/[34]\.0/];

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

/** 先找分類節點，再找掛在這個節點（或其下）的圖 */
async function findImage(build, name) {
  const nodes = await json(`${API}/nodes?build=${build}&filter_name=${encodeURIComponent(name.toLowerCase())}&page=0&embed_items=true`);
  const node = nodes?._embedded?.items?.[0];
  if (!node) return null;
  for (const f of ['filter_node', 'filter_clade']) {
    const page = await json(`${API}/images?build=${build}&${f}=${node.uuid}&page=0&embed_items=true`);
    const hit = page?._embedded?.items?.find((it) => OK.some((re) => re.test(it._links.license.href)));
    if (hit) return hit;
  }
  return null;
}

async function main() {
  const { build } = await (await fetch(`${API}/nodes`)).json();
  const out = {};
  for (const [id, names] of Object.entries(WANT)) {
    let pickd = null;
    let name = '';
    for (const n of names) {
      if (typeof n === 'object') {
        pickd = await json(`${API}/images/${n.uuid}?build=${build}`);
        if (pickd) pickd.uuid ??= n.uuid;
        if (pickd && !OK.some((re) => re.test(pickd._links.license.href))) pickd = null;
        if (pickd) { name = n.name; break; }
        continue;
      }
      pickd = await findImage(build, n);
      if (pickd) { name = n; break; }
    }
    if (!pickd) {
      console.warn(`找不到可用授權的圖：${id}（${names.join('／')}）`);
      continue;
    }
    const svgUrl = pickd._links.vectorFile.href;
    let svg = await (await fetch(svgUrl)).text();
    svg = svg.replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
    out[id] = {
      name,
      svg,
      attribution: pickd.attribution ?? '（未署名）',
      license: pickd._links.license.href,
      page: `https://www.phylopic.org/images/${pickd.uuid}`,
    };
    console.log(`${id.padEnd(7)} ${name.padEnd(22)} ${(svg.length / 1024).toFixed(1)} KB  ${pickd.attribution ?? ''}  ${pickd._links.license.href}`);
  }
  writeFileSync(resolve(here, '../src/data/silhouettes.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
