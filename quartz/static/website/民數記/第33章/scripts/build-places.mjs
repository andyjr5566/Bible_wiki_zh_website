// 從知識庫 link_folder/地點 抽出各站條目的「定義」第一段，寫成 src/data/places.json。
// 網站上只放這一小段，完整條目請在 Obsidian 開啟。條目有改，重跑 npm run places。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../../..');

/** 有條目的站（與 src/data/stations.ts 的 entry 一致，閘門會比對） */
export const ENTRIES = [
  '蘭塞', '疏割', '以倘', '密奪', '瑪拉', '以琳', '海（紅海）', '汛的曠野', '利非訂', '西乃的曠野',
  '基博羅哈他瓦', '哈洗錄', '摩西錄', '比尼亞干', '谷歌大與約巴他', '以旬迦別', '加低斯', '何珥山',
  '普嫩', '底本', '亞巴琳山', '摩押平原',
];

const plain = (s) => s
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/==/g, '')
  .replace(/\*\*/g, '');

/** `## 定義` 到下一個 `## ` 之間的前段：第一段，太短就補第二段 */
export function definitionOf(md) {
  const m = /^## 定義\s*\n([\s\S]*?)(?=^## )/m.exec(md);
  if (!m) return '';
  const paras = plain(m[1]).split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let out = paras[0] ?? '';
  if (out.length < 90 && paras[1]) out += `\n${paras[1]}`;
  return out;
}

export function buildPlaces() {
  const out = {};
  for (const name of ENTRIES) {
    const file = resolve(ROOT, 'link_folder', '地點', `${name}.md`);
    if (!existsSync(file)) throw new Error(`找不到地點條目：${file}`);
    out[name] = definitionOf(readFileSync(file, 'utf8'));
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const places = buildPlaces();
  writeFileSync(resolve(here, '../src/data/places.json'), JSON.stringify(places, null, 1) + '\n', 'utf8');
  console.log(`places.json: ${Object.keys(places).length} 個條目`);
}
