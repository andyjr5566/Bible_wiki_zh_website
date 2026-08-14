# Live License Audit — 2026-08-11

複核方式：Sketchfab public metadata API（GET `/v3/models/<uid>`）逐筆讀取 `user.displayName`、`isDownloadable`、`license.label`、`license.url`；頁面可用時再由登入中的 in-app Browser 檢查 Download 3D Model 與頁面文字。API 是本次 live license 的主要證據；未把 403、client throttling 或模型太重誤判為無授權。

## 已下載並可用於資料／runtime 分層

| ID | Sketchfab model | author | live license | downloadable | 決策 |
| --- | --- | --- | --- | --- | --- |
| `tabernacle-main` | `41d3c771c13a4cbcbc10353536ffec91` | thedeserttabernacle | CC BY-NC | true | hero desktop default |
| `tabernacle-framework` | `13cc215d3f404c4c85d2adb037626517` | thedeserttabernacle | CC BY-NC | true | structural mode-only |
| `tabernacle-ark-alternative` | `48d613a98e964200932c1395c1d34f68` | thedeserttabernacle | CC BY-NC | true | detail on-demand |
| `tabernacle-law-tablets-library` | `69674e1002a94efc8452581836814849` | thedeserttabernacle | CC BY-NC | true | library deferred |
| `tabernacle-burnt-altar-detail` | `bf23feae192b4cd6a4e8d7ca74417099` | thedeserttabernacle | CC BY-NC | true | detail on-demand |
| `tabernacle-table-shewbread-detail` | `8464709d407f49f49c55415e246b6fe5` | thedeserttabernacle | CC BY-NC | true | detail on-demand |
| `tabernacle-incense-altar-detail` | `18632101cc3744c7a6202be9ee1bf1e2` | thedeserttabernacle | CC BY-NC | true | detail on-demand |
| `tabernacle-menorah-detail` | `5a3ae34b9f744163bb63222577f5e238` | thedeserttabernacle | CC BY-NC | true | detail on-demand |
| `tabernacle-laver-detail` | `8856b0d10cf24d93bad7f4800bdf9b03` | thedeserttabernacle | CC BY-NC | true | detail on-demand |
| `tabernacle-lowpoly` | `2c9627a1b3334e0c8fb48078376b94c9` | jamethy | CC BY | true | manual fallback only |
| `priest-arab-man-library` | `0f87f4c0885346ad8f99ba5ccafd153e` | NABEEL619 | CC BY | true | technical rig base only |
| `priest-basic-human-library` | `598d1d1866df48f999fabadb017429d1` | DNC44 | CC BY | true | technical base only |
| `priest-medieval-outfit-library` | `e7aa183b848646558ceb3a3f449e344b` | Red_Ilya | CC BY | true | geometry/rig base only |
| `priest-tunic-library` | `b3cf100c7fed4468a193e0133002cc03` | Andy Woodhead | CC BY | true | geometry/animation base only |
| `sheep-library` | `08b05ae799d947f1a68c49b2d661eb53` | kenchoo | CC BY | true | deferred animal library |
| `cow-npc-library` | `2ca1db4e890e4b24a68624597e7d2fc8` | Owlish Media | CC BY | true | deferred animal library |
| `bull-library` | `d0f2ff31252a4c9cb084b1ac3a2e4d8b` | stealth86 | CC BY | true | deferred animal library |

## Reference-only／未下載

| Candidate | model | author | live license | downloadable | 決策 |
| --- | --- | --- | --- | --- | --- |
| Israelite High Priest | `ca5c48e66e0249308a02bba19f9e2666` | isasaurio | none returned | false | visual reference only |
| High priest | `173a94b82478415bb56124e137dfa30c` | bibel-in-3d.de | none returned | false | visual reference only |
| Animated Goat: 2 Texture Variants | `9a5ce2b438304b46854d34d5cab25b70` | 3D_Tech | none returned | false | do not download/import |

這三筆沒有進入 `src/data/assets.json`、`public/models/manifest.json` 或任何 runtime load plan。它們只保留原始 URL 作為研究／待審計紀錄。

## Collection

The Desert Tabernacle Mishkan collection：

https://sketchfab.com/thedeserttabernacle/collections/the-desert-tabernacle-mishkan-a96af8e601aa4d0083ac669908acde66

Collection 只是導覽清單，不能取代單一 model page 的 author、license 與 download permission 複核。

## 非商業政策

即使部分 CC BY 資產允許商業再利用，本專案一律設定 `commercialUse: false`，並以非商業教育／研讀為部署界線。CC BY-NC 資產的作者、來源 URL、license URL、attribution 與下載日期不可移除。
