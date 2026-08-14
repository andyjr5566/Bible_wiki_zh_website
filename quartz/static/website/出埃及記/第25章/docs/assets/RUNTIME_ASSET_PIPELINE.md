# Runtime Asset Pipeline

更新日期：2026-08-11  
範圍：真實 GLTF runtime loading；不改寫 source GLB。

## 載入流程

```text
typed AssetManifest
  → AssetRuntimeManager profile／library plan
  → GLTFAssetLoader fetch stream + progress
  → GLTFLoader.parseAsync
  → mesh／material／texture／bounds validation
  → WorldAlignment source-to-world transform
  → profile、detail 或 library root
  → UI AssetRuntimeState port
```

## 行為契約

- `desktop-high` 只掛載 `tabernacle-main` hero。
- `desktop-structural` 只掛載 `tabernacle-framework`；切換前會先卸載 hero。
- 六個器具 detail 只在 structural profile 由使用者按需載入，避免和完整主模型的內建器具重疊。
- `fallback-low` 必須由使用者明確選擇；程式不依 user-agent 或載入錯誤偷偷降階。
- 全部 library 資產（包括 `priest-arab-man-library`）維持 deferred；本版不在初始計畫或可見場景中載入人物與動物。
- reference-only 資產永不進入 manifest 或 runtime loader。

## Loader guarantees

`GLTFAssetLoader` 透過 fetch stream 回報 bytes，再以 `GLTFLoader.parseAsync` 解析 embedded GLB。每個 asset ID 有 completed／in-flight cache；重複請求不會重複載入。profile 改變、unload 或 app dispose 會中止 pending fetch，並釋放 geometry、material、texture 與 parent reference。

解析後會驗證至少一個 mesh、position attribute、material／texture 計數與非空 bounds。錯誤會成為帶 asset ID 的可見 `AssetLoadError`，不會靜默替換成 lowpoly。開發伺服器可用 `?assetFailure=tabernacle-main` 驗證這條故障路徑；production 不啟用此 query 注入。

## Ownership

`AssetRuntimeManager` 擁有 profile／detail／library roots 與 mount policy；`SceneBootstrap` 只提供 scene、asset root、renderer 與 camera。UI components 僅經 `AppPort` 取得狀態或提出 profile／detail 請求，不能直接引用 Three.js。

| 模型 | Runtime bytes | Policy |
| --- | ---: | --- |
| `tabernacle-main` | 10,394,200 | default hero |
| `tabernacle-framework` | 5,078,284 | mode-only structural |
| `tabernacle-lowpoly` | 3,026,208 | manual fallback |

完整 provenance、授權、checksum 與處理路徑以 `docs/ASSETS.md`、`docs/assets/ASSET_INVENTORY.md`、`docs/assets/LICENSE_AUDIT.md` 及 `src/data/assets.json` 為準。
