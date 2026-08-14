# 經文註解與線上資料核對

更新日期：2026-08-11  
用途：非商業教育／研讀。

## 編輯原則

- 介面不大量重刊受版權保護的現代譯本文字；本版另以可追溯的和合本（UNV）段落，按使用者要求放在每則註解的收合區內，僅作非商業教育／研讀。
- 每一則註解標示為「製作指示、實作記錄、空間配置、事奉規範、後世回顧」之一，避免把不同文類混成單一說法。
- 《出埃及記》25–31 章主要用作指示層；35–40 章用作製作、設立與完成記錄的對照層。
- 尺寸換算、材質外觀、器物曲線、營帳數量與沙漠環境都不是逐字經文；網站持續標示為教學重建。
- 《希伯來書》9 章在介面中標為「後世回顧」，不拿來改寫《出埃及記》的製作描述。

## 線上文本

- [維基文庫 — 聖經（和合本）](https://zh.wikisource.org/zh-hant/%E8%81%96%E7%B6%93_%28%E5%92%8C%E5%90%88%E6%9C%AC%29)：核對傳統繁體和合本字句與版本說明。
- [信望愛站 Bible API — qsb.php](https://bible.fhl.net/ajax/)：以 `version=unv`、`gb=0` 查詢繁體和合本原文；原文資料只隨本網站非商業研讀介面使用，版本權利仍以提供方公告為準。
- [Sefaria — Exodus 25](https://www.sefaria.org/Exodus.25?lang=en)：核對奉獻材料、聖所目的、約櫃、桌與燈臺段落。
- [Sefaria — Exodus 25:1–27:19](https://www.sefaria.org/Exodus.25.1-27.19?lang=en)：核對幔子、內部器物位置、外院、祭壇與東側入口。
- [Bible Gateway — Exodus 30–40, NRSVUE](https://www.biblegateway.com/passage/?search=Exodus+30-40&version=NRSVUE)：核對香壇、洗濯盆及第 37–40 章完成記錄。
- [Mechon-Mamre — Exodus 25](https://mechon-mamre.org/e/et/et0225.htm)：交叉核對英譯文本與段落範圍。
- [Bible Gateway — Hebrews 9:1–12, NRSVUE](https://www.biblegateway.com/passage/?search=Hebrews%209%3A1-12&version=NRSVUE)：核對後世文本對會幕分區與大祭司進入的回顧。

## 研究背景

- [TheTorah.com — Why Does the Torah Devote So Much Text to the Tabernacle?](https://www.thetorah.com/article/why-does-the-torah-devote-so-much-text-to-the-tabernacle)：用於理解指示與完成段落的大量平行內容；網站不把文章中的學術立場寫成唯一結論。
- [TheTorah.com — The Tabernacle in Its Ancient Near Eastern Context](https://www.thetorah.com/article/the-tabernacle-in-its-ancient-near-eastern-context)：用於核對常見的東向入口、框架尺寸與幔子分區重建，同時保留其歷史性討論的爭議性。

每一筆可見註解的 typed source of truth 是 `src/data/scriptures.json`。其中 `sourceUrl` 僅保留給研究核對與 provenance，不在使用者介面顯示線上閱讀入口。
