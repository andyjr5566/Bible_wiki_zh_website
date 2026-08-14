# 資產與授權紀錄

更新日期：2026-08-11  
使用限制：本網站與所有部署版本只作非商業教育／研讀使用。

## 權威資料來源

- 17 筆可由程式驗證的完整資料：`src/data/assets.json`
- public runtime manifest：`public/models/manifest.json`
- source／processed／runtime 對照：`docs/assets/ASSET_INVENTORY.md`
- live license、下載權限與 reference-only 判定：`docs/assets/LICENSE_AUDIT.md`

`src/data/assets.json` 是 typed source of truth。每筆紀錄包含作者、原始網址、目前授權、下載日期、SHA-256、幾何統計、三層檔案路徑、runtime policy、historical status 與 source-to-world transform。`npm run verify:assets` 會比對 typed manifest、public manifest、檔案存在性與 checksum。

## 已下載並核准的 17 個 GLB

| Asset ID／原始頁面 | 作者 | live license | 下載日 | Runtime 用途 |
| --- | --- | --- | --- | --- |
| [`tabernacle-main`](https://sketchfab.com/3d-models/biblical-tabernacle-mishkan-41d3c771c13a4cbcbc10353536ffec91) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | 預設 hero 完整會幕 |
| [`tabernacle-framework`](https://sketchfab.com/3d-models/framework-of-the-tabernacle-tent-13cc215d3f404c4c85d2adb037626517) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | 框架／剖面 profile |
| [`tabernacle-lowpoly`](https://sketchfab.com/3d-models/tabernacle-2c9627a1b3334e0c8fb48078376b94c9) | jamethy | CC Attribution | 2026-08-11 | 使用者明確選擇的低模備援 |
| [`tabernacle-ark-alternative`](https://sketchfab.com/3d-models/ark-of-the-covenant-alternative-48d613a98e964200932c1395c1d34f68) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | structural profile 按需細節 |
| [`tabernacle-burnt-altar-detail`](https://sketchfab.com/3d-models/altar-of-burnt-offering-of-the-tabernacle-bf23feae192b4cd6a4e8d7ca74417099) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | structural profile 按需細節 |
| [`tabernacle-table-shewbread-detail`](https://sketchfab.com/3d-models/table-of-shewbread-of-the-tabernacle-8464709d407f49f49c55415e246b6fe5) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | structural profile 按需細節 |
| [`tabernacle-incense-altar-detail`](https://sketchfab.com/3d-models/altar-of-incense-of-the-tabernacle-18632101cc3744c7a6202be9ee1bf1e2) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | structural profile 按需細節 |
| [`tabernacle-menorah-detail`](https://sketchfab.com/3d-models/lampstand-menorah-of-the-tabernacle-5a3ae34b9f744163bb63222577f5e238) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | structural profile 按需細節 |
| [`tabernacle-laver-detail`](https://sketchfab.com/3d-models/copper-laver-of-the-tabernacle-8856b0d10cf24d93bad7f4800bdf9b03) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | structural profile 按需細節 |
| [`tabernacle-law-tablets-library`](https://sketchfab.com/3d-models/the-ten-commandments-of-the-tabernacle-69674e1002a94efc8452581836814849) | thedeserttabernacle | CC Attribution-NonCommercial | 2026-08-11 | deferred library |
| [`priest-arab-man-library`](https://sketchfab.com/3d-models/arab-man-rigged-0f87f4c0885346ad8f99ba5ccafd153e) | NABEEL619 | CC Attribution | 2026-08-11 | 已下載的技術骨架研究檔；本版不在場景顯示 |
| [`priest-basic-human-library`](https://sketchfab.com/3d-models/basic-human-male-598d1d1866df48f999fabadb017429d1) | DNC44 | CC Attribution | 2026-08-11 | deferred technical base |
| [`priest-medieval-outfit-library`](https://sketchfab.com/3d-models/medieval-peasant-outfit-free-e7aa183b848646558ceb3a3f449e344b) | Red_Ilya | CC Attribution | 2026-08-11 | deferred geometry／rig starting point |
| [`priest-tunic-library`](https://sketchfab.com/3d-models/tunic-medieval-for-animation-b3cf100c7fed4468a193e0133002cc03) | Andy Woodhead | CC Attribution | 2026-08-11 | deferred geometry／rig starting point |
| [`sheep-library`](https://sketchfab.com/3d-models/sheep-08b05ae799d947f1a68c49b2d661eb53) | kenchoo | CC Attribution | 2026-08-11 | deferred animal library |
| [`cow-npc-library`](https://sketchfab.com/3d-models/cow-npc-now-free-to-download-2ca1db4e890e4b24a68624597e7d2fc8) | Owlish Media | CC Attribution | 2026-08-11 | deferred animal library |
| [`bull-library`](https://sketchfab.com/3d-models/bull-d0f2ff31252a4c9cb084b1ac3a2e4d8b) | stealth86 | CC Attribution | 2026-08-11 | deferred animal library |

## Runtime 分層

| Tier | 數量 | Policy | 行為 |
| --- | ---: | --- | --- |
| hero | 1 | default | desktop 首次 3D 載入使用完整會幕 |
| structural | 1 | mode-only | 與 hero 互斥的框架／剖面模式 |
| detail | 6 | on-demand | 只在 structural profile 由使用者載入 |
| library | 8 | deferred | 全部保留為研究／技術資料，不進初始場景，也不在本版顯示 |
| fallback | 1 | manual-fallback | 絕不自動取代 hero，必須由使用者明確選擇 |

## 授權與重建界線

- Credits 必須保留作者、原始 URL、license 與 attribution；網站內的「授權與來源」面板會列出全部 17 筆。
- 主模型、framework、器具與法版是 `reconstructed`／`illustrative`，不是聖經文字所唯一指定的外觀。
- Arab Man、Basic Human Male 與兩套中古服飾只可標為 `technical-base`。檔案保留作骨架／比例研究，但本版刻意不載入人物，避免把通用外貌或未經歷史驗證的服飾誤當成以色列祭司造型。
- 祭司服飾的文本依據維持《出埃及記》28、29、39 章。一般人物或中古服飾不能代替經文、考據或歷史證據。
- CC BY 資產本身不含 NC 條款，但本專案整體仍維持非商業部署限制；不得把 CC BY 錯寫為 CC BY-NC。

## Reference-only／未下載

- [Israelite High Priest](https://sketchfab.com/3d-models/israelite-high-priest-ca5c48e66e0249308a02bba19f9e2666)：只作造型研究，未核准下載／散布。
- [High Priest / bibel-in-3d.de](https://sketchfab.com/3d-models/high-priest-173a94b82478415bb56124e137dfa30c)：只作造型研究，未核准下載／散布。
- [Animated Goat](https://sketchfab.com/3d-models/animated-goat-2-texture-variants-free-asset-9a5ce2b438304b46854d34d5cab25b70)：live audit 未取得可採用的下載權限，因此未進 manifest。

以上三筆不在 `src/data/assets.json`、不在 public manifest，也不會被 runtime loader 載入。
