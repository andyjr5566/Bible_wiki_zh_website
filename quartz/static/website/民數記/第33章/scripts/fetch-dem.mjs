// 下載地形高程瓦片，供 Blender 地形暈渲圖使用。
// 資料來源：AWS Terrain Tiles（Terrarium PNG），採用 Mapzen／Tilezen terrain 開放資料，
// 整合 SRTM、ETOPO1、GMTED 等資料；須依規定標示來源，詳見：
// https://github.com/tilezen/joerd/blob/master/docs/attribution.md
// 瓦片體積大且可重新下載，不進版控；只有渲染完成的圖片放在 public/relief/。
// 使用方式：node scripts/fetch-dem.mjs [--out <dir>]
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ZOOM = 8;
const TILE_COUNT = 2 ** ZOOM;
const BASE_URL = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}`;
const OUTPUT_DIR = path.resolve(readOutputDir());

function readOutputDir() {
  const args = process.argv.slice(2);
  let outputDir;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) {
        throw new Error('參數 --out 後面需要指定輸出目錄。');
      }
      outputDir = args[++i];
    } else {
      throw new Error(`不認得的參數：${args[i]}`);
    }
  }
  return outputDir ?? process.env.NUM33_DEM ?? path.join(os.tmpdir(), 'num33-dem', 'z8');
}

function tileX(lon) {
  return Math.floor(((lon + 180) / 360) * TILE_COUNT);
}

function tileY(lat) {
  const radians = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * TILE_COUNT,
  );
}

async function downloadTile(x, y) {
  const name = `${x}_${y}.png`;
  const file = path.join(OUTPUT_DIR, name);
  if (existsSync(file) && statSync(file).size > 0) return 'skipped';

  const url = `${BASE_URL}/${x}/${y}.png`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length === 0) throw new Error('伺服器回傳空檔案');
      writeFileSync(file, data);
      console.log('已下載', name);
      return 'downloaded';
    } catch (error) {
      lastError = error;
      if (attempt < 3) console.warn(`${name} 下載失敗（${attempt}/3），重試：${error.message}`);
    }
  }
  throw new Error(`瓦片 ${name} 重試 3 次仍無法下載：${lastError?.message ?? '未知錯誤'}`);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const x0 = tileX(28.5);
  const x1 = tileX(37.5);
  const y0 = tileY(33.4);
  const y1 = tileY(26.4);
  let downloaded = 0;
  let skipped = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const result = await downloadTile(x, y);
      if (result === 'downloaded') downloaded++;
      else skipped++;
    }
  }

  console.log(`完成：下載 ${downloaded} 個、略過 ${skipped} 個；輸出目錄：${OUTPUT_DIR}`);
  console.log(`接著執行：$env:NUM33_DEM = "${OUTPUT_DIR}"`);
  console.log('          python scripts/blender/send.py scripts/blender/build_relief.py');
  // send.py 無法把環境變數傳進 Blender；也可以直接修改 build_relief.py 頂端的 DEM 預設路徑。
}

main().catch((error) => {
  console.error(`下載地形瓦片失敗：${error.message}`);
  process.exitCode = 1;
});
