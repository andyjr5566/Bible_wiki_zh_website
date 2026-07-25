<video controls src="https://raw.githubusercontent.com/andyjr5566/Bible_wiki_zh/main/appendix/video/演示.mp4" style="max-width:100%;height:auto;"></video>
# 📖 聖經研讀知識庫

Bible Wiki ZH 是一套以 [Obsidian](https://obsidian.md/) 建立的中文聖經研讀知識庫。內容以書卷與章節整理，並透過 wiki-link 串連人物、地點、事件、原文、歷史背景與神學主題，形成可持續擴充的研讀網絡。

## 專案特色

- 整合經文、註解與研讀資料
- 以 `[[wiki-link]]` 建立跨章、跨卷連結
- 將人物、地點、事件與主題整理成獨立知識節點
- 可使用 Obsidian 搜尋、反向連結與圖譜檢視
- Markdown 檔案可離線閱讀，也能自行編輯

## 快速開始

請依使用裝置選擇安裝指南：

| 裝置    | 適合情境                    | 安裝指南                                            |
| ----- | ----------------------- | ----------------------------------------------- |
| 電腦    | 初次使用、完整瀏覽或參與編輯          | [電腦版 Obsidian 安裝與開啟 Vault](INSTALL_COMPUTER.md) |
| 手機／平板 | 行動閱讀，或透過 GitHub 與其他裝置同步 | [手機版 Obsidian 與 GitHub Sync](INSTALL_MOBILE.md) |

## 使用方式

### 閱讀章節

在左側檔案瀏覽器開啟書卷資料夾，例如：

```text
創世記 → 第1章.md
```

章節筆記包含經文與研讀內容；點選藍色的 wiki-link，即可前往相關人物、地點或主題條目。

### 搜尋內容

| 功能 | Windows / Linux | macOS |
| --- | --- | --- |
| 快速開啟檔案 | `Ctrl + O` | `Command + O` |
| 搜尋整個 Vault | `Ctrl + Shift + F` | `Command + Shift + F` |
| 開啟命令面板 | `Ctrl + P` | `Command + P` |

### 探索知識連結

- 使用「反向連結」查看哪些章節提到目前條目。
- 使用「本機圖譜」查看目前筆記附近的連結。
- 使用「圖譜檢視」瀏覽整個知識庫的關聯。

## 主要內容

```text
Bible_wiki_zh/
├── 創世記/             # 逐章研讀筆記
├── link_folder/        # 人物、地點、事件、主題等知識節點
├── appendix/           # 圖片、影片等附錄
├── raw_data/           # 原始研讀資料
├── raw_scripture/      # 原始經文資料
├── util/               # 維護與驗證工具
├── _config/            # 專案設定
├── scheme.md           # 內容結構與編寫規則
└── README.md
```

一般閱讀只需使用書卷資料夾與 `link_folder/`；其餘資料夾主要供內容維護使用。

## 主導覽

| 文件／連結                                                      | 說明                           |
| ---------------------------------------------------------- | ---------------------------- |
| [電腦版安裝指南](INSTALL_COMPUTER.md)                             | 安裝 Obsidian、取得專案並開啟 Vault    |
| [手機版安裝指南](INSTALL_MOBILE.md)                               | 安裝手機版 Obsidian 與設定 GitHub 同步 |
| [問題回報](https://github.com/andyjr5566/Bible_wiki_zh/issues) | 回報錯誤或提出建議                    |
| [授權條款](LICENSE)                                            | 專案授權資訊                       |

## 資料來源

本知識庫整理自 nbible、ccbiblestudy、KingComments 與 BibleHub 等資料來源。使用或引用內容時，請一併留意各來源的原始授權與使用條款。

批註
- **BibleHub** — 聖經研究工具

感謝所有貢獻者！

感謝 **GitHub Sync (Multi-Platform)** 外掛開發者！

---

## 📝 相關檔案

| 檔案 | 說明 |
|------|------|
| [`scheme.md`](./scheme.md) | 完整規則與工作流程文檔（必讀） |
| [`agent_prompt.md`](./agent_prompt.md) | AI 助手提示詞（開發用） |
| `_config/bible_books.json` | 聖經書卷章數配置 |

---

## 🌟 快速連結

- 🏠 [GitHub 專案](https://github.com/andyjr5566/Bible_wiki_zh)
- 📖 [核心規則文檔](./scheme.md)
- 🐛 [報告問題](https://github.com/andyjr5566/Bible_wiki_zh/issues)
- 🔧 [技術討論](https://github.com/andyjr5566/Bible_wiki_zh/discussions)
- 📱 [Obsidian 官網](https://obsidian.md/)
- 📚 [Obsidian 官方文檔](https://help.obsidian.md/)
- 🔑 [GitHub Token 生成](https://github.com/settings/tokens)

---

**祝你使用愉快！願聖經研讀之路越走越寬。** 📖✨
