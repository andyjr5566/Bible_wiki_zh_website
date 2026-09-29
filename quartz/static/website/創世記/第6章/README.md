# 方舟

創世記 6–9 章的沉浸式導覽：神吩咐挪亞造方舟、動物成對進入、耶和華關門、洪水漲到高山之上、方舟停在亞拉臘山、烏鴉與鴿子、出方舟築壇，到雲中的虹。往下捲動是一段連續的 3D 鏡頭，最後可以自己繞著方舟看、走進三層船艙。技術為 Vite、TypeScript、three.js，聲音用 Web Audio 即時合成。非商業研經用途。

## 本機啟動

```powershell
npm ci
npm run dev        # http://127.0.0.1:3031/
npm run build      # 先跑 typecheck 與資料閘門，通過才產生 dist/
npm run preview    # http://127.0.0.1:4193/
```

可部署的是 `dist/`；`appendix/website/build.py` 只在 `dist/index.html` 存在時才把本站列入附錄。

本機若遇到 rollup 原生模組被 Windows 應用程式控制擋下，`package.json` 的 `overrides` 已把 rollup 固定在已放行的版本。

## 資料與出處

| 檔案 | 內容 |
| --- | --- |
| `src/data/scenes.ts` | 19 幕的經文、白話說明、事實條目、註釋家讀法、畫面說明 |
| `src/data/debates.ts` | 經文沒說的事；知識庫以外的現代重建研究 |
| `src/data/timeline.ts` | 洪水期間的日期 |
| `src/data/inside.ts` | 「走進方舟」裡的標示與說明 |
| `src/data/credits.ts` | 動物模型的來源與授權 |
| `src/data/verses.json` | 由 `npm run verses` 從庫根 `raw_scripture/` 產生，不手改 |

每一筆資料都帶證據等級（經文明說／綜合整理／註釋解讀／經文沒說）與經節。`src/data/data.test.ts` 是資料閘門，`npm run build` 前一定會跑：

- 「」摘句必須逐字出現在所引經節（和合本 `raw_scripture/`）。
- 經節必須存在；「經文明說」一定要有經節和摘句。
- 註釋家原話必須逐字出現在 `01 創世記/第{章}章.md`，而且落在主檔的「」引號內；主檔作者的轉述不能當原話引用。
- `verses.json` 必須和 `raw_scripture/` 一致。

KRISO、Tim Lovett、Ark Encounter、Kircher 這幾項現代研究不在本庫四套註釋裡，網站把它們放在「知識庫以外」的區塊並註明沒有逐字查核，不進閘門。

## 畫面怎麼組成

| 模組 | 內容 |
| --- | --- |
| `src/three/director.ts` | 每一幕的鏡頭、天氣、水位、建造進度、光線；兩幕之間插值 |
| `src/three/engine.ts` | 渲染迴圈、方舟浮沉、捲動進度與探索模式 |
| `src/three/ark.ts` | 方舟材質、建造時的裁切、松香、門、窗、頂蓋、工地鷹架 |
| `src/three/terrain.ts` | 山谷、亞拉臘山區、樹林、村落、洪水後的泥與新綠 |
| `src/three/ocean.ts` | 洪水水面（Gerstner 浪），方舟的起伏用同一套公式 |
| `src/three/sky.ts` | 天空、雲、彩虹（以反日點為中心約 42°） |
| `src/three/weather.ts` | 雨、閃電 |
| `src/three/life.ts` | 動物隊伍、挪亞一家、烏鴉與鴿子；探索時動物進隔欄、鳥上棲木 |
| `src/three/interior.ts` | 船艙擺設：飼槽、墊草、水桶、乾草、吊籃、鳥籠、爐灶、補光 |
| `src/audio/sound.ts` | 雨、風、浪、雷、木頭嘎吱、火、鴿子，預設靜音 |

山的高度、距離、動物種類、船艙擺設都是示意，各幕卡片最下方的「畫面說明」會註明。

## 3D 模型

- `public/models/ark.glb`：`scripts/blender/build_ark.py` 產生，單位公尺，一肘以 0.45 公尺計。外廓（含屋脊）維持在 300 × 50 × 30 肘之內；三層甲板、側門、高一肘的透光處、窗戶（創8:6）、可撤去的頂蓋（創8:13）依經文，船形、肋材、隔間、梯子為重建。
- `public/models/{birds,figures,altar}.glb`：`scripts/blender/build_extras.py` 產生。
- `public/models/animals/*.glb`：取自 poly.pizza，Quaternius 的動物為 CC0，Poly by Google 的大象、長頸鹿、獅子、駱駝為 CC-BY 3.0。`scripts/blender/slim_animals.py` 只保留走路、站立、吃草三段動畫並縮小貼圖。

Blender 開啟 MCP addon（port 9876）後，在 `scripts/blender/` 執行：

```powershell
python send.py build_ark.py
python send.py build_extras.py
python send.py slim_animals.py   # 需要先下載原始動物模型，路徑見檔頭 ANIMALS_IN
```

腳本都在自己的場景裡建模，不會動到 Blender 裡其他開著的東西。

## 操作

- 右上角播放鍵或空白鍵：自動往下捲，再按一次暫停；自己捲動也會暫停。
- 走進方舟：H 收起／顯示控制面板（收起時頂列也退開），L 開關標示，點標示看說明。

## 除錯

瀏覽器 console 裡 `__gen6.go('deep', 0.5)` 可以直接跳到某一幕（0–1 是該幕的進度），並隱藏文字卡片，方便截圖檢查畫面。
