# 最終 QA 驗收清單

> 本文件保存早期 Walking／Map 驗收規劃；2026-08-11 起 production 已取消這兩項體驗。現行驗收結果請見 `docs/QA_FINAL.md`。

此清單區分已由本機腳本驗證的行為，與必須在真實瀏覽器／實機驗收的項目。未完成的人工項目不可因 production build 成功而視為通過。

## 已自動驗證（2026-08-11）

執行：

```bash
npm run test
npm run build
```

- `verify-controller.mjs`：W 前進、D 橫移、祭壇碰撞、搖桿 dead zone。
- `verify-mobile-input.mjs`：觸控搖桿的 pointerdown／release、同一份 `InputState`、滑鼠排除與 listener teardown。
- `verify-content.mjs`：10 個物件、6 個儀式、4 個角色、9 項服飾研究、三個空間 entity、導覽及經文關聯。
- `verify-navigation.mjs`：角色 waypoint 與儀式可視化不穿越牆體、器具或未授權的區域。
- `verify-assets.mjs`：已核准模型的 manifest 格式、署名欄位與本機檔案存在性。
- `verify-performance.mjs`：動態解析度的降級、回復與停用邏輯。
- `verify-experience.mjs`：空間 Learning、Tour 暫停／經文入口、四級品質、三個獨立聲音通道。

## 桌面瀏覽器人工驗收

### 2026-08-11 in-app Browser 已實測

- 已在 `http://localhost:3001/` 完成載入、進入會幕與 WebGL canvas 呈現；console error 為零。
- 已驗證 Map 選取燔祭壇會關閉地圖並開啟相應物件面板。
- 已驗證 Tour 打開時會關閉其他內容面板、九秒自動前進、暫停／經文入口可操作。
- 已驗證 Learning 的人物與服飾分頁可選取「以弗得」並顯示出埃及記 28:6–14、39:2–7 的資料索引。
- 已驗證 Learning 的「胸牌」會顯示 4×3、共 12 個寶石位置的文字研究 overlay，並保留不主張特定礦物、顏色或支派排列的註記。
- 已驗證設定中的夜間與低品質模式可切換，canvas 保持存在。
- in-app Browser 的自動化輸入只能送出瞬間 keypress，不能模擬實體鍵盤長按；故 WASD 的持續移動與碰撞仍需在桌面實體鍵盤完成最終人工驗收。`verify-controller.mjs` 已自動驗證 W／D 持續輸入、碰撞與鍵盤 `event.key` 相容性。

| 項目 | 操作與通過條件 | 狀態 |
| --- | --- | --- |
| 啟動與載入 | `npm run dev` 後開啟網站；開始按鈕只在場景建立後可用，沒有空白場景或 console error。 | 已以 in-app Browser 實測 |
| First person | 點「開始探索」後，W/S/A/D、Shift 與滑鼠拖曳都有效；焦點不在文字輸入控制項時 E 可開啟附近器具。 | 持續鍵盤輸入待實體裝置驗收；控制器已自動驗證 |
| 碰撞 | 嘗試穿過圍欄、祭壇、洗濯盆、聖所牆面、香壇與幔子；角色均應被阻擋。 | 實體裝置待驗收；碰撞邏輯已自動驗證 |
| 空間順序 | 從門進入時依序看到燔祭壇、洗濯盆、聖所、金燈臺／陳設餅桌／香壇、幔子；以 Tour 或剖面閱讀至聖所／約櫃。 | 部分 Browser 實測；完整自由探索待驗收 |
| 物件與經文 | 點選所有 10 個物件；資訊面板有材料、尺寸、信心標記及「查看經文」，並能進入正確的外部 RCUV 章節連結。 | 已抽測燔祭壇；全數待驗收 |
| Tour | 開始、暫停、繼續、上一站、下一站、關閉；有 ritual 的站點應顯示角色視覺化，並可開啟經文或完整儀式。 | 部分 Browser 實測 |
| Learning | 走入聖所時 Learning 的空間卡應顯示金燈臺、陳設餅桌、香壇及關聯儀式；所有服飾項目可選且只突顯研究角色的對應標記。 | 人物／服飾分頁已實測；空間移動待驗收 |
| 設定 | 測試 Auto／高／中／低品質、Reduced Motion、音效／環境音／音樂。音樂應預設關閉，降低品質不應導致 UI 無法操作。 | 夜間與低品質已實測；其餘待驗收 |

## 行動裝置人工驗收

| 項目 | 操作與通過條件 | 狀態 |
| --- | --- | --- |
| Touch 探索 | 左側搖桿中心小幅觸碰不移動；超過 dead zone 才移動。右側單指拖曳只改變視角，不誤觸 UI。 | 待實測 |
| 附近互動 | 靠近物件後右側「查看」按鈕可用；不顯示 WASD 提示。 | 待實測 |
| Bottom sheet | 點選物件後為底部資訊卡；上滑展開、下滑關閉。 | 待實測 |
| Portrait／Landscape | Portrait 可閱讀、Map、Tour；Landscape 可探索。兩種方向都不鎖定，主要控制項不被瀏海或系統手勢區遮住。 | 待實測 |
| 品質與 fallback | Auto／低品質可操作；停用 WebGL 時仍可開啟平面圖、物件、儀式、人物與經文索引。 | 待實測 |

## 授權模型接入後的附加驗收

1. 原始 archive 留在 `assets/source/sketchfab/<asset-id>/`，未被改寫；`ASSETS.md` 補上下載日期、checksum、作者、URL、授權與處理紀錄。
2. `public/models/manifest.json` 的每筆資產皆有 `approved`、author、sourceUrl、license、attribution、transform，且 `npm run test:assets` 通過。
3. 逐一確認替換後模型比例、朝向、pick interaction、碰撞範圍、剖面模式與 Credits 顯示。
4. 用實機重新量測載入時間、FPS、記憶體與行動裝置熱節流；必要時再做 Draco／Meshopt／KTX2／LOD 處理。

## 目前外部阻礙

- `public/models/manifest.json` 目前包含 17 個通過 source checksum、授權與 GLB 驗證的 approved entries；未提供下載權限的 High Priest 與 Animated Goat 仍未匯入。
- in-app Browser 已恢復可用並完成可自動化的桌面路徑驗收；持續 WASD 長按、碰撞手感與實體觸控手勢仍需以實際輸入裝置完成最終人工驗收。
