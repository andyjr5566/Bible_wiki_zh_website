# 06 待驗證事項、測試計畫與風險

---

## 1. PoC 待驗證清單（Phase 0）

每項完成後填「結果」與日期。

| # | 項目 | 為什麼重要 | 結果 |
|---|---|---|---|
| V-01 | GIS token client 在 iPhone Safari 一般分頁能否登入 | 主要行動使用情境 | ✅ 2026-10-18 iOS 18.7 Safari：登入成功（約 14 秒，含使用者操作），t01–t11 全通過 |
| V-02 | GIS token client 在 iPhone 主畫面 App（standalone）能否登入；彈窗是否卡住 | 決定 Token 服務是否提前（D-31） | ✅ 2026-10-18 iOS 18.7 主畫面 App（standalone=是）：GIS 彈窗登入成功並回到 App；t01–t11 全通過 → **不需提前 Token 服務** |
| V-03 | LINE 內建瀏覽器的行為（預期 `disallowed_useragent`）；`openExternalBrowser=1` 是否有效 | 台灣使用者大量從 LINE 點連結 | ✅ 2026-10-18 iPhone LINE：按登入後**自動跳到 Safari**（若已安裝本站主畫面 App 則跳到該 App），無法在 LINE 內完成登入 → 正式功能要在 LINE 內先引導「用 Safari 開啟」，不要直接嘗試登入 |
| V-04 | `prompt:''`＋`login_hint` 續期時，彈窗是否不需使用者操作就自動關閉 | 決定 MVP「點一下繼續同步」的摩擦程度 | ✅ 2026-10-18 Windows Chrome：續期彈窗**閃一下自動關閉**，不需選帳號或再按允許 → MVP 續期只需一次點擊、無其他操作；iPhone Safari：續期**需要選帳號或再按允許**（約 3.8 秒）→ iOS 續期多一步操作；iPhone 主畫面 App：續期閃一下自動關閉（0.5 秒） |
| V-05 | `files.get?alt=media`、`files.create`、`changes.list` 實際耗用的配額單位 | 成本估算準確度（02 §4） | 待 P0-7 到 Cloud Console 比對。Windows 測試共呼叫 79 次（含跨裝置監看 changes.list 51 次） |
| V-06 | `changes.list(spaces=appDataFolder)` 從一台裝置寫入到另一台看到的延遲 | 跨裝置同步體驗 | ✅ 2026-10-18 Windows Chrome 寫入 → iPhone Safari 輪詢（5 秒間隔）：伺服器寫入後約 3 秒被發現，端到端約 5 秒 → changes.list 延遲極低；Windows → iPhone 主畫面 App 也約 3–6 秒 |
| V-07 | 用 `generateIds` 的 id 重複建立同一檔案時的錯誤行為（確認不會產生重複檔） | 重試安全 | ✅ 2026-10-18 Windows Chrome：重複建立同一 ID 回 **HTTP 409 `fileIdInUse`**，未產生重複檔。設計可用 |
| V-08 | appDataFolder 檔案是否保留版本紀錄（revisions.list） | 資料救回手段 | ✅ 2026-10-18：appDataFolder 檔案**有保留版本紀錄**（寫 2 次 → 2 個 revision）。保留期限未測 |
| V-09 | 純網頁 App 是否出現在 Drive「管理應用程式」；「中斷連線」是否刪除隱藏資料 | 使用者說明與資料保護 | |
| V-10 | `storage.persist()` 在 Safari 一般分頁與主畫面 App 的結果；Windows Chrome／Edge 的結果 | 本機資料被清除的風險 | Windows Chrome（localhost、一般分頁）：`persist()` **未授予**（Chrome 依網站互動度判斷，屬預期）。Safari 待測；iPhone Safari 一般分頁：未授予（配額上限約 39 GB）；**iPhone 主畫面 App：`persist()` 已授予** → 建議引導 iPhone 使用者加入主畫面 |
| V-11 | 測試中狀態下，測試使用者是否看到「Google 尚未驗證這個應用程式」畫面 | 試用說明 | ✅ 2026-10-18 Windows Chrome：測試中狀態、測試使用者登入時**沒有**出現未驗證警告；同意畫面只有一項權限、**沒有勾選框**（符合 D-11）；iPhone Safari 同樣無警告、只有一項權限；主畫面 App 第二次登入未再出現同意畫面（已授權過） |
| V-12 | `andyjr5566.github.io` 能否在 Search Console 驗證（可能需另建使用者站台 repo），或需改用自訂網域 | 發佈正式版前必要（D-33） | |
| V-13 | 學校／公司 Workspace 帳號與受監護的未成年帳號的行為 | 青少年團契、學校帳號使用者 | |
| V-14 | Google 公布的 Drive API 超量計費單價（2026 稍晚） | 長期成本 | |

---

## 2. 實機測試矩陣

可用裝置（D-06）：iPhone／iPad、Windows 電腦。**Android 與 Mac 無實機**：Android 只能用 Chrome DevTools 裝置模擬做版面與流程檢查，無法驗證真實 OAuth 與儲存行為，列為已知缺口；正式公開前若能找到 Android 使用者協助，補測 Chrome 與主畫面 App。

| 環境 | 登入 | 讀寫同步 | 離線→恢復 | 先同步再編輯提示 | 續期 | 備註 |
|---|---|---|---|---|---|---|
| Windows Chrome | ✅ 2026-10-18 | ✅ t01–t11 全通過 | 待測 | 待測 | ✅ 自動關閉 | localhost；token 3599 秒；API 回應 0.2–1.9 秒 |
| Windows Edge | | | | | | |
| iPhone Safari | ✅ 2026-10-18 | ✅ t01–t11 全通過 | 待測 | 待測 | ⚠️ 需選帳號／按允許 | iOS 18.7；跨裝置延遲約 3–5 秒 |
| iPhone 主畫面 App | ✅ 2026-10-18 | ✅ t01–t11 全通過 | 待測 | 待測 | ✅ 自動關閉 | persist 已授予；與 Safari 儲存分開 |
| iPad Safari | | | | | | |
| iPhone LINE 內建瀏覽器 | ❌ 跳到 Safari | — | — | — | — | 需引導外部瀏覽器（V-03） |
| Android Chrome（模擬） | — | — | — | | — | 僅版面 |

跨裝置情境（Phase 1 試用期間）：
1. Windows 寫一則 → iPhone 打開同一章，先同步後看得到。
2. iPhone 飛航模式下修改 → 出現 D-04 提示 → 確認後編輯 → 關閉飛航 → 自動合併 → Windows 看得到。
3. 兩台都離線修改同一則 → 恢復連線 → 出現「兩個版本」→ 選擇後兩台一致。
4. 一台刪除、一台修改同一則 → 出現衝突提示。
5. Windows 開兩個分頁同時編輯 → 不重複上傳、內容一致。
6. 登出並選「清除本機」→ 重新登入 → 筆記從雲端回來。

---

## 3. 自動化測試要求

- 單元：model（ULID、HLC、ref 解析、驗證）、merge（所有規則＋性質測試）、store、adapter（以 mock fetch）。
- 整合：InMemoryAdapter＋3 台模擬裝置，涵蓋 05 P1-14 列出的情境。
- 建置：`npx quartz build -d test_content -o <scratch>` 成功。
- 任何可能導致筆記遺失或覆蓋的改動，必須先有會失敗的測試再修。

---

## 4. 風險與對策

| 風險 | 影響 | 對策 |
|---|---|---|
| LINE／FB 內建瀏覽器被 Google 拒絕登入 | 大量使用者無法同步 | 偵測並引導外部瀏覽器；未登入仍可本機使用 |
| Drive v3 無條件式寫入 | 多裝置互相覆蓋 | 單一寫入者分片（D-12） |
| 同裝置多分頁同時寫 | 同一分片互相覆蓋 | Web Locks 領導分頁 |
| 使用者在 Drive 刪除 App 資料 | 雲端筆記消失 | 雲端被清空偵測＋本機重新上傳；提醒定期匯出 |
| 使用者 Google 雲端硬碟已滿 | 寫入失敗 | 明確提示，資料保留本機 |
| Safari 清除本機資料／整網域清除 | 未上傳的修改遺失 | 盡快上傳、storage.persist()、SW 快取上限 |
| 裝置時鐘不準 | 新版被舊版取代 | HLC |
| 舊版程式覆蓋新格式 | 資料損壞 | schema 檢查、未知欄位保留 |
| 配額全專案共用，有 bug 的版本讓所有人 403 | 全面停擺 | 客戶端限流、熔斷、遠端開關、分批釋出 |
| content 改版（資料夾、格式、節點名稱） | 錨點失效 | USFM 座標、防禦式偵測、失聯筆記清單（D-14、D-15） |
| 學校／公司帳號被管理員封鎖、受監護帳號 | 無法登入 | 處理 `admin_policy_enforced`，退回本機模式 |
| OAuth 停在測試中 | 最多 100 位使用者 | 公開前發佈正式版（D-33） |
| 匯入他人檔案造成 XSS | token 外洩、資料被竄改 | DOMPurify、匯入驗證 |
| 公用電腦登出後資料殘留 | 隱私外洩 | 登出時提供清除本機 |
| Google 2026 配額與計費變動 | 成本或功能受限 | 監看 Cloud Console 用量、同步層可抽換、隨時可匯出 |
| 同源（andyjr5566.github.io 下所有專案站） | 其他專案站可讀筆記與授權 | 自訂網域（D-30） |
