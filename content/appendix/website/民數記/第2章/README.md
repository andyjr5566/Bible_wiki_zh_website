# 環繞會幕

民數記 2 章十二支派環繞會幕安營，加上民數記 10 章的兩枝銀號與第一次拔營的互動地圖。2D 地圖是主要操作介面，3D 是同一份資料的立體版，兩邊共用選取與行軍狀態。技術為 Vite、TypeScript、three.js，銀號聲音用 Web Audio 即時合成。非商業研經用途。

## 本機啟動

```powershell
npm ci
npm run dev        # http://127.0.0.1:3041/
npm run build      # 先跑 typecheck 與資料閘門，通過才產生 dist/
npm run preview    # http://127.0.0.1:4194/
```

可部署的是 `dist/`；`appendix/website/build.py` 只在 `dist/index.html` 存在時才把本站列入附錄，`04 民數記/第2章.md` 的「互動網站」連結由 `util/build_appendix_links.py` 產生。

本機若遇到 rollup 原生模組被 Windows 應用程式控制擋下，`package.json` 的 `overrides` 已把 rollup 固定在已放行的版本。

## 頁面

| 區塊 | 內容 |
| --- | --- |
| 01 營地地圖 | SVG 示意圖（東在右、北在上）。點支派、纛、利未族或會幕，右側列出人數、首領、方向、出發順序與經文。圖層：利未人、母系、傳統纛圖案（預設關閉）、民26 人數。手機預設清單檢視（含會幕與利未各族），點了會捲到資訊欄。資訊欄可複製直達連結。 |
| 02 拔營 | 雲彩收上去→依次出發。民10 實際上路（六批）與民2 安營次序（五步）可切換；銀號按鈕只有經文有記的四種聲音，西、北營標「經文沒記」。全部出發後列出民10:35-36 約櫃起行、停住時摩西的話。手機上地圖會跟著正在出發的營左右捲。 |
| 03 立體營地 | 捲近了才載入 three.js。鏡頭：俯視、繞著看、營地地面、營外高處（民23:28、24:2、24:5）；日夜；行軍動畫（下方說明列出目前是第幾批）；點區塊選取。 |
| 04 對照 | 民2／民7／民10 三處的首領先後；民1 與民26 兩次數點；利未三族的人數。 |
| 05 註釋家怎麼讀 | 各主題的註釋家讀法（CT、GT、KC、BH）。 |
| 06 經文沒說的事 | 每面三支派的排法、營地大小、纛上的圖案、會幕在哪一隊、西北營的號聲、六十萬人、約櫃位置、利未人的三百之差。 |
| 07 小測驗 | 十二支派放到東南西北；民10 六批的先後。 |

## 資料與出處

| 檔案 | 內容 |
| --- | --- |
| `src/data/tribes.ts` | 十二支派、四營：方位、首領、民1／民2／民26 人數、民7 獻禮日、母系 |
| `src/data/levites.ts` | 利未三族與祭司：位置、人數、職責、車與牛；民4 五件聖物 |
| `src/data/march.ts` | 民2、民10 兩種行軍次序；雲彩起行；約櫃起行、停住時的話（民10:35-36）；兩者的差別 |
| `src/data/trumpets.ts` | 民10 的號聲（兩枝齊吹、單吹一枝、吹出大聲、二次吹出大聲）；西北營沒記 |
| `src/data/voices.ts` | 註釋家的讀法，取自主檔「本章整理」 |
| `src/data/debates.ts` | 經文沒說或各家讀法不同的地方 |
| `src/data/center.ts` | 面板用的事實（總數、會幕、對照） |
| `src/data/verses.json` | 由 `npm run verses` 從庫根 `raw_scripture/` 產生，不手改 |

每一筆資料都帶證據等級（經文明說／綜合整理／註釋解讀／經文沒說）與經節。`src/data/data.test.ts` 是資料閘門，`npm run build` 前一定會跑：

- 「」摘句必須逐字出現在所引經節（和合本 `raw_scripture/`）；經節必須存在；「經文明說」一定要有經節和摘句。
- 人數：每個支派的中文寫法（七萬四千六百名）出現在所引經節，且換算後等於資料裡的數字。
- 算術：每營三支派相加＝營總數（民2:9、16、24、31）；四營相加＝603,550（民2:32、民1:45）；民26 十二支派相加＝601,730；利未三族相加 22,300，和民3:39 的 22,000 差 300。
- 首領在民2、民7、民10 三處都對得上；民7 十二日的次序和民2 安營次序一致（由資料推算）。
- 母系：每個支派對得上創35:23-26 的那一句。
- 註釋家原話必須逐字出現在 `04 民數記/第{2,3,10}章.md` 主檔的「」內；轉述必須帶 `keys`，關鍵詞要出現在主檔。
- `verses.json` 必須和 `raw_scripture/` 一致。

需要對照 vault 裡 `raw_scripture/` 與章節主檔的項目，在 vault 外（例如 CI）會自動略過；repo 只帶著已產生的 `verses.json`。

## 示意，不是經文

畫面上以下都是示意，各處都有標註：

- 每一面三個支派的先後（民2 只寫「挨著他」「又有」；GT 說最自然的次序是順時鐘，這裡照順時鐘排）。
- 營與會幕的距離、營地大小、地形、營外高處的位置、行進方向。
- 一頂帳棚約一千名被數點的男丁；603,550 是二十歲以外、能出去打仗的男丁，不是總人口。
- 纛上的圖案與顏色（猶太傳統，經文沒記載）。
- 銀號的音高與節奏。

## 畫面怎麼組成

| 模組 | 內容 |
| --- | --- |
| `src/layout.ts` | 營地座標（地圖像素），SVG 與 3D 共用；`toWorld` 換成 3D 場景單位 |
| `src/store.ts` | 選取、圖層、行軍階段、日夜、聲音、號聲 |
| `src/deeplink.ts` | 直達連結的網址格式 |
| `src/phases.ts` | 行軍階段：住營→雲彩收上去→各批出發→全部出發 |
| `src/ui/campmap.ts` | SVG 營地圖與號聲效果 |
| `src/ui/panel.ts` | 詳細資料面板、清單檢視 |
| `src/ui/march.ts` | 拔營播放器、階段清單、縱隊、號聲面板 |
| `src/three/scene.ts` | 渲染器、鏡頭與 OrbitControls、日夜光線 |
| `src/three/world.ts` | 帳棚（InstancedMesh）、會幕、雲彩與火、四面纛、路與營外高處 |
| `src/three/entities.ts` | 行軍角色：帳棚收起、一隊人／車與牛／抬聖物的人走上路 |
| `src/audio/trumpet.ts` | 銀號合成，預設靜音 |

## 3D 模型

- `public/models/wagon.glb`、`loads.glb`：`scripts/blender/build_camp.py` 產生，單位為肘。篷子車數與牛數照民7:7-9（革順 2 車 4 牛、米拉利 4 車 8 牛、哥轄沒有）；五件聖物最外層的顏色照民4:5-14（約櫃是純藍色毯子，其餘是海狗皮）。車的形狀、繩索、包裹的外形為重建。
- `public/models/courtyard.glb`：複製自 `利未記/第1章` 的院子模型，尺寸依出27。
- `public/models/bull.glb`：取自 poly.pizza，Quaternius 的《Bull》，CC0（<https://poly.pizza/m/a8PIIYwF7r>）。
- 帳棚、人形、旗子、雲彩、地形都是 three.js 程式生成。

Blender 開啟 MCP addon（port 9876）後執行：

```powershell
python scripts/blender/send.py scripts/blender/build_camp.py
```

腳本在自己的場景（`num2_camp`）裡建模，不會動到 Blender 裡其他開著的東西。

## 直達連結

網址後面加上：

| 網址結尾 | 開到 |
| --- | --- |
| `#judah`（任一支派的 id） | 選好那個支派 |
| `#camp-judah` | 選好整個營（`judah`、`reuben`、`ephraim`、`dan`） |
| `#clan-kohath` | 選好利未一族（`gershon`、`kohath`、`merari`、`priests`） |
| `#tabernacle` | 選好會幕 |
| `#march-10`、`#march-2` | 捲到拔營，選好次序版本 |

## 除錯

瀏覽器 console 裡：

- `__num2.select('judah')` 選一個支派；`__num2.go('num10', 4)` 跳到某個行軍階段（不自動播放）。
- 3D 載入後 `__num2.cam('ground')` 切鏡頭（`top`、`orbit`、`ground`、`balaam`）。
