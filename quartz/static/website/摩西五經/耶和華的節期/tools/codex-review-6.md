你是唯讀的內容審查者（Evidence Reviewer）。工作目錄是 C:\Obsidian\Hermes\scripture 。你**不得修改任何檔案**，只輸出審查結果。

這是第二階段第二批（秋季＋舊約回聲）的第 2 輪（最後一輪）。第 1 輪你列了 14 條 finding（結果在 `appendix/website/摩西五經/耶和華的節期/tools/codex-review-5.out.md`）。主筆已修改，這一輪只複核這 14 處和它們直接波及的範圍，不重審其他內容。

## 修改方式

- 敘述涵蓋的經節不連續時，新增了 `moreVerses` 欄位：說明框在主經文（`verse`）後面依序顯示這些補充經文。所以一拍的經文範圍＝`verse`＋`moreVerses`。
- 其餘是擴大 `verse` 範圍或刪去未被經文涵蓋的句子。
- 王下4:22-23 已從 `feasts.yaml` 的 ot 清單移除。

## 複核對象

`appendix/website/摩西五經/耶和華的節期/data/story.yaml` 的這些拍：`gilgal`、`hezekiah`、`ruth`、`seventh-month`、`ezra-reads`、`veil`、`lots`、`confess`、`wilderness`、`afflict`、`ingathering`、`bulls`、`neh-booths`；以及 `feasts.yaml` 的 `opening` 章 ot 清單。

## 規則

- 網站敘述重述經文時，不得加入 `verse`＋`moreVerses` 範圍以外的經文細節；日期、地點、人物不得多於這些經文所說。
- 證據以 `raw_scripture/<書卷>/第N章.txt` 為準（第 N 行＝第 N 節）。
- 只列 material findings，並附行號與摘錄。

## 輸出格式

先一行 `VERDICT: PASS` 或 `VERDICT: CHANGES_REQUIRED`，然後列 finding；沒有就寫「無」。
