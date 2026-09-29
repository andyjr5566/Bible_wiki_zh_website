# 照山上的樣式

出埃及記 25–27 章的互動導覽：照經文的尺寸和材料，從東門一路走到約櫃。技術為 Vite、TypeScript、three.js。非商業研經用途。與 `appendix/website/利未記/第1章`（會幕前的一天）同一系列。

舊版（R00–R24 的 3D 研讀站）已封存在 git tag `exodus25-legacy-2026-09-29`。

## 本機啟動

```powershell
npm ci
npm run dev        # http://127.0.0.1:3021/
npm run build      # 先跑 typecheck 與資料閘門，通過才產生 dist/
npm run preview    # http://127.0.0.1:4191/
```

可部署的是 `dist/`。`package.json` 的 `overrides` 把 rollup 固定在本機應用程式控制已放行的版本。

## 資料與出處

| 檔案 | 內容 |
| --- | --- |
| `src/data/stops.ts` | 導覽九站：兩種次序、鏡頭、經文事實、註釋家讀法 |
| `src/data/materials.ts` | 出25:3-7 的材料各自用在哪裡；金屬由外而內的階梯 |
| `src/data/debates.ts` | 經文沒說的事 |
| `src/data/credits.ts` | 3D 模型署名 |
| `src/data/verses.json` | 由 `npm run verses` 從庫根 `raw_scripture/` 產生，不手改 |

`src/data/data.test.ts` 是資料閘門：摘句必須逐字出現在所引經節；註釋家原話必須逐字落在 `02 出埃及記/第{章}章.md` 的「」內（比對前去掉 `==`、`**` 與 WikiLink 標記）；`verses.json` 必須和 `raw_scripture/` 一致。

## 3D 模型

五個 GLB 都是 thedeserttabernacle 在 Sketchfab 發布的作品（CC BY-NC 4.0），署名見網站「關於」與 `src/data/credits.ts`。主模型沿用舊版擺放（縮放 0.3、旋轉 -90°；+Z 東、+X 北）。本站在執行時做的調整：

- 四層頂蓋對照（截圖逐一上色確認）：`First_Curtain_Mat` 細麻幔子、`ThirdCovering` 染紅的公羊皮、`FourthCovering` 海狗皮；模型沒有山羊毛罩棚。
- `Outer_Curtain`（院門、帳幕門簾）與 `Inner_Curtain`（內幔）的漩渦貼圖換成三色線加細麻的織紋。
- 約櫃、桌子、燈臺統一成金色（出25:11、24、31）。
