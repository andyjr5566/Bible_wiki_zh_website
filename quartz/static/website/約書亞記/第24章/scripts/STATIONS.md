# 第二幕站播放器

`src/data/stations.json` 是構圖契約，`scripts/station-layout.py` 可重建目前這份人工設定。修改站位後執行 `python -I scripts/station-layout.py`；換圖或修改去背時再執行 `npm run stations`。建置使用已產生的 WebP，不需要 Blender、Python 或實驗素材。

每站包含 `id`、所屬 `beat`、`verses`、捲動篇幅 `weight`、記憶地圖地點 `place`、關閉動態時的固定進度 `still`、依繪製順序排列的 `layers`。紅海的篇幅最大。各站入口的 16% 用於站間過場；其餘進度控制構圖，同一拍依篇幅分配多個站。

每層指定 `asset`、原始 `source`、`role`、`x/y`、`scale`、`parallax`，另有選用的 `key`、`clip` 與 `actions`。位移單位是完整畫布的百分比；縮放以畫布中心為基準。人物的手機站位另有樣式偏移。動作由 `property/start/end/from/to` 組成，支援位置、縮放、透明度與亮度，全部依捲動進度計算，可倒捲。人物層以 `step: true` 在指定進度換格，避免交叉淡化造成半透明剪影。

背景只讀取既有 Blender 圖層。Codex 圖先白色或洋紅色去背，再壓暗剪影內部；人物深色主體補成實心 alpha，渡河圖保留較淡的水面倒影。耶利哥圖層依山丘輪廓裁除底部暗地；東岸戰場只柔化塵霧邊緣，士兵剪影維持不透明。原圖不覆寫。輸出採 WebP 品質 80、最長 1440×810；`src/assets/stations/sources.json` 留有來源、去背方式、尺寸、可見範圍與位元組數。

圖片 URL 隨程式內嵌成單檔，維持 `file://` 開啟；這表示初次讀取 HTML 已包含壓縮圖資。延遲載入實作在圖片解碼與節點建立：只建立本站，預解碼下一站，過場時至多保留前站與本站。它不是 HTTP 分站下載。若未來改成分檔下載，需同時調整單檔設定與發布方式。

`npm run build` 檢查十一站順序、紅海篇幅、圖層檔與 WebP 格式、15 MB 預算、人物、棺材、經節和 `story.yaml` 一致，以及倒捲、過場與紅海動作。Vitest 閘門禁止人物圖層做半透明交叉淡化；`alpha:check` 另檢查每張人物 cutout 內縮 6px 後的深色主體區，不透明比例至少 0.9。檢查輸出會列出水、雲、霧等效果層豁免；渡河倒影與戰場塵霧只從人物主體遮罩排除。棺材人物也計為人物層；迦南站的人物是隨隊抵達的抬棺者。

截圖：`powershell -NoProfile -File tools/shoot-act2.ps1 -Device desktop`，手機使用 `mobile`。輸出在 `.tmp-shots/act2/`，包含每站、紅海三個時間點、十個過場、十一站靜止構圖比對、經文與人物範圍量測、四張卡與「我」開關操作、scrollY 取樣與瀏覽器錯誤。
