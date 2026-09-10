# R21 回歸與失敗恢復報告

本輪把跨檔資料契約與 runtime 生命週期納入可重跑的 Vitest 回歸。資料載入完成各自的 Zod schema 後，會再通過 `assertProjectDataIntegrity`；重複 ID、懸空 claim/source/part/step/role、錯誤的分支動物類型、不可達步驟與反向經文範圍會 fail closed。validator 是純函式，測試 fixture 會複製已核准資料後注入單一缺陷，因此不會修改 production JSON。

## 已自動驗證

執行位置：`appendix/website/出埃及記/第25章`

```text
npm run typecheck  -> exit 0
npm test           -> exit 0
```

結果：21 個 test files、65 個 tests 全部通過。

| 範圍 | 測試證據 |
| --- | --- |
| duplicate IDs、dangling source/claim/part/step/role | `src/data/ProjectData.test.ts` 的 integrity fixtures |
| location/object/asset/ritual/scripture/tour/excerpt 交叉引用 | `src/data/validateProjectData.ts`；production fixture issues 為空 |
| step order、next-step reachability、branch actor/animal 一致性 | validator 與 `ProjectData.test.ts` |
| 贖罪日禁入、細麻衣與換衣、燔祭四分支 actor、十二個餅、七盞燈 | `ProjectData.test.ts` 語義 fixtures |
| detail 亂序與舊請求取消 | `AssetRuntimeManager.test.ts` |
| 網路失敗後 retry、profile 切換、pending dispose | `AssetRuntimeManager.test.ts` |
| ritual seek／pause／previous／replay／complete | `RitualPlaybackController.test.ts` |

## 可重現的手動案例（本輪未宣稱 PASS）

以下案例需要真實瀏覽器、WebGL 裝置或網路攔截工具；目前沒有可在本輪穩定執行這些注入的 browser e2e runner，因此只列為待總控執行的案例，不以 unit test 代替。

1. 以 `npm run dev` 開啟頁面，分別進入總覽、六個器物 detail 與贖罪日導覽；確認右側資料面板仍可讀，detail 亂序選取不會以舊請求覆蓋新選取。
2. 在 DevTools 將 `tabernacle-main` 請求設為 offline 或回傳 500；確認 asset status 顯示失敗與可用備援，重新選取 profile 後可恢復，沒有永久 loading。
3. 在 DevTools 執行 `document.querySelector('canvas')?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))`，再以瀏覽器的 WebGL context restore 工具測試恢復。此事件流程與 WebGL 不支援的初始建構目前尚未取得真實瀏覽器證據，維持 `UNVERIFIED`。
4. 使用禁用 WebGL 的瀏覽器設定重新載入；確認仍能看到章節與來源的可讀內容。此項目前 `UNVERIFIED`，不可標記 PASS。

## 邊界與交接

- `sourceSha256` 的格式、摘錄範圍順序與文字非空由 schema／validator 檢查；本輪沒有把瀏覽器 bundle 內的摘要宣稱成原始檔案 hash 的重新計算結果。
- `requestAnimationFrame`、WebGL renderer 資源與 runtime diagnostics 的長時間實機數據仍由 R20 的效能報告管理；本輪沒有把 rAF 間隔當作 GPU 計時。
- 本輪沒有修改 `raw_scripture`、`raw_data`、研經 production、source GLB 或 Blender 場景。總控應在 R23/R24 重新執行上述手動案例，並把未驗證項保持列明。
