# 會幕前的一天

利未記 1–9 章的互動導覽：五祭（燔祭、素祭、平安祭、贖罪祭、贖愆祭）與承接聖職、第八天首次獻祭。技術為 Vite、TypeScript、three.js。非商業研經用途。

網站照利未記自己的順序分成十一幕（開場、五種祭、給祭司的條例、承接聖職、第八天、複習、各家怎麼讀），網址 `#/burnt` 這樣切換。每一幕上層是「重點」，下層是可展開的「細節」；註釋家的分歧集中在最後一幕。各祭與第 8–9 章都有 3D 演練：在院子裡把步驟演出來（宰殺只用象徵式演出，不畫傷口）。

## 本機啟動

```powershell
npm ci
npm run dev        # http://127.0.0.1:3011/
npm run build      # 先跑 typecheck 與資料閘門，通過才產生 dist/
npm run preview    # http://127.0.0.1:4181/
```

可部署的是 `dist/`；`appendix/website/build.py` 只在 `dist/index.html` 存在時才把本站列入附錄。

本機若遇到 rollup 原生模組被 Windows 應用程式控制擋下，`package.json` 的 `overrides` 已把 rollup 固定在已放行的版本。

## 資料與出處

| 檔案 | 內容 |
| --- | --- |
| `src/data/story.ts` | 十一幕的清單、開場、五種祭各幕的重點卡與「誰做什麼」兩線圖 |
| `src/data/later.ts` | 給祭司的條例、承接聖職、第八天各幕的重點卡，第八天的 3D 步驟，複習的問題 |
| `src/data/offerings.ts` | 五祭每個分支的逐步流程與結果（步驟上的 `act`、`part` 只給 3D 演練用，不是經文內容） |
| `src/data/priesthood.ts` | 利8–9：聖衣、抹血、三隻祭牲、第八天 |
| `src/data/compare.ts` | 五祭對照表與分份 |
| `src/data/objects.ts` | 器具與地點 |
| `src/data/debates.ts` | 經文沒說的事、翻牌小卡 |
| `src/data/entry.ts` | 首頁填空句的判斷規則 |
| `src/data/verses.json` | 由 `npm run verses` 從庫根 `raw_scripture/` 產生，不手改 |

每一筆資料都帶證據等級（經文明說／綜合整理／註釋解讀／經文沒說）與經節。`src/data/data.test.ts` 是資料閘門，`npm run build` 前一定會跑：

- 「」摘句必須逐字出現在所引經節（和合本 `raw_scripture/`）。
- 經節必須存在；「經文明說」一定要有經節。
- 註釋家原話必須逐字出現在 `03 利未記/第{章}章.md`，而且落在主檔的「」引號內；主檔作者的轉述不能當原話引用。
- `verses.json` 必須和 `raw_scripture/` 一致。

## 建置與動畫

- 在本機要從 PowerShell 執行 `npm run dev`／`npm run build`；Git Bash 底下 rollup 的原生模組會被 Windows 應用程式控制擋住。
- 3D 演練和平面圖播放是使用者自己按的，只聽本站右上角「減少動態」開關，不跟著作業系統的減少動態設定（`src/ui/dom.ts` 的 `animOff()`）；裝飾性動畫才看作業系統設定（`motionOff()`）。
- 3D 演練：`src/three/rehearsal.ts`（人物、祭牲、各種動作）、`src/ui/theater.ts`（字幕欄與播放控制）。不支援 WebGL 時自動改用平面圖。

## 3D 模型

`public/models/courtyard.glb` 由 `scripts/blender/build_courtyard.py` 產生，單位為肘。尺寸依出27（院子、燔祭壇）、出30（香壇），會幕外觀與洗濯盆形狀為示意重建。重建方式：Blender 開啟 MCP addon（port 9876）後執行

```powershell
python scripts/blender/send.py scripts/blender/build_courtyard.py
```
