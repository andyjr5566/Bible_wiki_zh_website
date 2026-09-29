# 會幕前的一天

利未記 1–9 章的互動導覽：五祭（燔祭、素祭、平安祭、贖罪祭、贖愆祭）與承接聖職、第八天首次獻祭。技術為 Vite、TypeScript、three.js。非商業研經用途。

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
| `src/data/offerings.ts` | 五祭每個分支的逐步流程與結果 |
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

## 3D 模型

`public/models/courtyard.glb` 由 `scripts/blender/build_courtyard.py` 產生，單位為肘。尺寸依出27（院子、燔祭壇）、出30（香壇），會幕外觀與洗濯盆形狀為示意重建。重建方式：Blender 開啟 MCP addon（port 9876）後執行

```powershell
python scripts/blender/send.py scripts/blender/build_courtyard.py
```
