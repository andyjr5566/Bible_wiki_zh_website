# 💻 電腦版 Obsidian 安裝與開啟 Vault

本指南適用於 Windows、macOS 與 Linux。完成後，即可在電腦上離線瀏覽與編輯本知識庫。

> [!TIP]
> 一般使用者可下載 ZIP；想持續取得更新或參與維護，建議使用 Git Clone。

## [影片教學](https://youtu.be/FGG2JbkHO78)

## 1. 安裝 Obsidian

1. 前往 [Obsidian 官網](https://obsidian.md/download)。
2. 下載適合你作業系統的版本。
3. 完成安裝並開啟 Obsidian。

## 2. 取得專案

以下方式擇一即可。

### 方法 A：使用 Git Clone

先安裝 [Git](https://git-scm.com/downloads)，再於終端機執行：

```bash
git clone https://github.com/andyjr5566/Bible_wiki_zh.git
cd Bible_wiki_zh
```

日後要取得最新內容，可在專案資料夾執行：

```bash
git pull
```

如果你準備提交自己的修改，請先在 GitHub Fork 本專案，再 Clone 你的 Fork。

### 方法 B：下載 ZIP

1. 開啟 [GitHub 專案頁面](https://github.com/andyjr5566/Bible_wiki_zh)。
2. 點選 **Code → Download ZIP**。
3. 解壓縮下載的檔案。
4. 確認解壓後的資料夾內直接包含 `README.md`、`創世記/` 與 `link_folder/`。

ZIP 不會自動更新；需要新版時，請重新下載並自行處理已修改的筆記。

## 3. 將專案資料夾開啟為 Vault

1. 開啟 Obsidian。
2. 在 Vault 管理畫面找到 **Open folder as vault**（開啟資料夾作為 Vault）。
3. 選擇剛取得的 `Bible_wiki_zh` 資料夾。
4. 點選 **Open**。

如果 Obsidian 已開啟其他 Vault，請點左下角的 Vault 名稱，選擇 **Manage vaults…**，再執行上述步驟。

> [!IMPORTANT]
> 請選擇包含 `README.md` 的專案根目錄，不要只選 `創世記/` 或外層的解壓縮資料夾。

## 4. 確認開啟成功

在左側檔案瀏覽器確認能看到：

- `創世記/`
- `link_folder/`
- `README.md`
- `scheme.md`

接著開啟 `創世記/第1章.md`，並點選其中的 wiki-link 測試跳轉。閱讀筆記、搜尋與 wiki-link 不需要額外安裝外掛。

## 5. 開始使用

- `Ctrl/Command + O`：快速開啟檔案
- `Ctrl/Command + P`：開啟命令面板
- `Ctrl/Command + Shift + F`：搜尋整個 Vault
- 從左側功能列開啟圖譜檢視

完整的閱讀方式與文件導覽請回到 [README](README.md)。

## 常見問題

### Obsidian 顯示信任或第三方外掛提示

基本閱讀不需要第三方外掛。只有在你了解並信任某個外掛時，才關閉 Restricted mode（安全模式）並啟用它。

### 開啟後看不到專案內容

回到 Vault 管理畫面，重新選擇包含 `README.md` 的 `Bible_wiki_zh` 根目錄。

### 想在手機上使用或同步

請繼續閱讀 [手機版 Obsidian 與 GitHub Sync](INSTALL_MOBILE.md)。
