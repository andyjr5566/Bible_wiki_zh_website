你是唯讀的內容審查者（Evidence Reviewer）。工作目錄是 C:\Obsidian\Hermes\scripture 。你**不得修改任何檔案**，只輸出審查結果。

這是第三批（七的節奏）的第 2 輪（最後一輪）。第 1 輪你列了 4 條 finding（結果在 `appendix/website/摩西五經/耶和華的節期/tools/codex-review-9.out.md`）。主筆已修改，這一輪只複核這 4 處和它們直接波及的範圍，不重審其他內容。

## 複核對象

`appendix/website/摩西五經/耶和華的節期/data/story.yaml` 的 `sevens:` 章這四拍：`jubilee-horn`、`land-mine`、`land-rest`、`neh-oath`（看 `verse`、`moreVerses`、`text`）。`jubilee-horn` 的新說法提到原文，請對 `raw_data/stepbible_leviticus_23.txt`（23:24）與 `raw_data/stepbible_leviticus_25.txt`（25:9）。

## 規則

- 網站敘述不得加入 `verse`＋`moreVerses` 範圍以外的經文細節；日期、地點、人物不得多於這些經文所說。
- 證據以 `raw_scripture/<書卷>/第N章.txt` 為準（第 N 行＝第 N 節）；原文說法以 STEP 表格為準。
- 只列 material findings，附行號與摘錄。

## 輸出格式

先一行 `VERDICT: PASS` 或 `VERDICT: CHANGES_REQUIRED`，然後列 finding；沒有就寫「無」。
