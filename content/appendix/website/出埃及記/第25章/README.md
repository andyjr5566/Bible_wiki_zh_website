# Interactive Biblical Tabernacle

以出埃及記 25–30 章為核心的互動式聖經會幕專案。本 repository 目前完成「全新架構骨架」里程碑：舊版大型 JavaScript runtime 已移除，改為 Vite + strict TypeScript + Three.js + Zod 的模組化基線。

用途限制：非商業教育與聖經研讀。主會幕與多個器具模型使用 CC BY-NC，署名及非商業限制不可移除。

## 啟動

```bash
npm install
npm run dev
```

預設網址：`http://127.0.0.1:3001/`

完整驗證與 production build：

```bash
npm run verify
npm run build
npm run preview
```

## 部署

這個章節是 Vite 專案，`index.html` 是開發來源，真正可部署的是 `dist/`。
`appendix/website/build.py` 會辨識這類章節；它不會在一般附錄索引時偷偷執行
`npm`，只有明確指定 `--build` 才會建置。

在 repository 根目錄執行：

```bash
python appendix/website/build.py --build --deploy-dir .tmp/website-deploy
```

完成後，把 `.tmp/website-deploy` 設為靜態主機的 publish directory。根目錄的
`index.html` 是網站入口清單，會幕網站位於
`出埃及記/第25章/index.html`；同一目錄也會產生
`interactive-websites.json`。部署產物只供非商業教育與聖經研讀使用，模型署名
與授權資訊仍保留在本專案文件中。

## 目前交付

- 單一 `UIStateManager` 管理 Walking、Overview、Tour、Learning、Map；相機聚焦不再暗中改模式。
- 統一 `InputState` 與 Desktop/Mobile adapters；WASD、E、Space、Shift、M、T 進入同一 input pipeline。
- SceneBootstrap、CameraManager、PlayerController、InteractionSystem 與各領域 managers/registries 的 typed skeleton。
- `tabernacle.json`、`characters.json`、`rituals.json`、`scriptures.json`、`locations.json` 通過 Zod schema 與 cross-reference tests。
- Bible ↔ object/ritual/location/character 雙向 mapping。
- High Priest、Priest、Levite/Helper、garment slots、六個具名儀式與 playback/UI hooks。
- Desktop-high 預設 hero 模型、structural framework、六個 detail models；lowpoly 只允許手動 fallback。
- 參考圖已用於 canonical spatial sequence，但不直接當 runtime asset。

目前頁面刻意只呈現 canonical world-frame skeleton，不沿用舊 UI 或舊場景。高品質主模型接入、world alignment、碰撞、完整人物與儀式動畫屬於下一階段。

## 文件

- [架構與舊版稽核](docs/ARCHITECTURE.md)
- [重建階段與完成定義](docs/REBUILD_PLAN.md)
- [高品質資產策略](docs/ASSET_STRATEGY.md)
- [最終完成稽核](docs/planning/COMPLETION_AUDIT.md)
- [資產與署名紀錄](docs/ASSETS.md)
- [參考資料使用紀錄](docs/REFERENCE_MATERIAL.md)
