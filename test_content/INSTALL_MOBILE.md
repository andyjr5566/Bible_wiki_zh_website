# 📱 手機版 Obsidian 與 GitHub Sync

本指南適用於 iOS、iPadOS 與 Android，使用第三方 Obsidian 外掛 **GitHub Gitless Sync** 將 GitHub 儲存庫同步到手機，不需要在手機安裝 Git。

> [!IMPORTANT]
> GitHub Gitless Sync 並非 Obsidian 官方同步服務。不要讓同一個 Vault 同時使用 Obsidian Sync、iCloud、Google Drive 或其他同步外掛，以免造成衝突或遺失內容。

## [影片教學](https://youtu.be/-e6oMacK4_I)
## 開始前準備

你需要：

- 一個 [GitHub 帳號](https://github.com/signup)
- 已安裝手機版 Obsidian
- 一個**空的**手機 Vault
## 1. 安裝 Obsidian

- iPhone／iPad：從 [App Store](https://apps.apple.com/app/obsidian-connected-notes/id1557175442) 安裝 Obsidian。
- Android：從 [Google Play](https://play.google.com/store/apps/details?id=md.obsidian) 安裝 Obsidian。

## 2. 建立空的 Vault

1. 開啟 Obsidian。
2. 選擇 **Create new vault**。
3. 輸入名稱，例如 `Bible Wiki`。
4. 建立後先不要新增筆記或複製檔案。

第一次同步時，本機 Vault 與遠端儲存庫不能同時已有檔案；使用空 Vault 才能從 GitHub 正確下載專案。

## 3. 安裝 GitHub Gitless Sync

1. 開啟 **Settings → Community plugins**。
2. 關閉 **Restricted mode**，並確認你願意使用第三方外掛。
3. 點選 **Browse**。
4. 搜尋 `GitHub Gitless Sync`。
5. 點選 **Install**，安裝完成後再點 **Enable**。

外掛原始碼與最新說明可參考 [GitHub Gitless Sync 專案](https://github.com/silvanocerza/github-gitless-sync)。

## 4. 建立 GitHub Fine-grained Token

建議使用瀏覽器完成這一步：

1. 開啟 GitHub 的 [Fine-grained tokens 設定](https://github.com/settings/personal-access-tokens/new)。
2. 輸入 Token 名稱與有效期限。
3. **Resource owner** 選擇你的 GitHub 帳號。
4. **Repository access** 選擇 **Only select repositories**，並只選你的 `Bible_wiki_zh` Fork。
5. 在 **Repository permissions** 將 **Contents** 設為 **Read and write**。
6. 產生並立即複製 Token；離開頁面後不會再次顯示完整內容。

> [!CAUTION]
> Token 等同密碼，請勿貼在筆記、截圖、Issue 或公開訊息中。如果懷疑外洩，請立即到 GitHub 撤銷它。

## 5. 設定外掛

進入 **Settings → GitHub Gitless Sync**，填入：

| 欄位 | 內容 |
| --- | --- |
| GitHub Token | 上一步建立的 Token |
| Repository owner | 你的 GitHub 使用者名稱 |
| Repository name | `Bible_wiki_zh` |
| Repository branch | `main` |

若你使用不同的 Fork 名稱或預設分支，請填入實際名稱。

> [!WARNING]
> 對公開儲存庫不要啟用設定資料夾同步（Config sync）。`.obsidian` 內可能包含外掛設定與 Token，推送後會造成憑證外洩。

## 6. 執行第一次同步

1. 確認手機 Vault 仍是空的。
2. 點選側邊功能列的同步按鈕，或開啟命令面板執行 **Sync with GitHub**。
3. 等待同步完成。
4. 在檔案瀏覽器確認能看到 `README.md`、`創世記/` 與 `link_folder/`。
5. 開啟 `創世記/第1章.md` 測試內容與 wiki-link。

## 日常同步習慣

1. 開始編輯前先執行一次 **Sync with GitHub**。
2. 完成編輯後再同步一次。
3. 等待同步完成，再關閉 Obsidian 或切換裝置。
4. 避免在兩台裝置同時修改同一個檔案。

外掛也支援定時自動同步，但初次設定建議先使用手動同步，確認流程穩定後再啟用。

## 常見問題

### 第一次同步失敗

- 確認手機 Vault 完全是空的。
- 確認 Owner、儲存庫名稱與分支完全正確。
- 確認 Token 尚未過期，且該儲存庫的 **Contents** 權限為 **Read and write**。
- 若設定錯誤後要重來，可使用外掛的 Reset 功能清除同步中繼資料，再重新設定。

### 出現同步衝突

先比較本機與遠端版本，再保留正確內容。不要在不確定時直接覆蓋；若電腦上也有 Git，可先在電腦備份或提交目前修改。

### 只想在手機閱讀，不需要 GitHub 同步

可改用檔案管理工具將整個專案資料夾複製到手機，再用 Obsidian 開啟；但之後不會自動取得更新。

回到 [README](README.md) 查看專案介紹與主導覽，或參考 [電腦版安裝指南](INSTALL_COMPUTER.md)。
