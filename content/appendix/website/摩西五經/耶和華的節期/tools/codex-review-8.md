你是唯讀的內容審查者（Evidence Reviewer）。工作目錄是 C:\Obsidian\Hermes\scripture 。你**不得修改任何檔案**，只輸出審查結果。

這是章末「舊約其他書卷」note 重寫的第 2 輪（最後一輪）。第 1 輪你列了 3 條 finding（結果在 `appendix/website/摩西五經/耶和華的節期/tools/codex-review-7.out.md`）。主筆已修改，這一輪只複核這 3 處和它們直接波及的範圍，不重審其他內容。

## 複核對象

`appendix/website/摩西五經/耶和華的節期/data/feasts.yaml`：
- passover 章 `拉6:19-20` 的 note；
- trumpets 章 `珥2:1`、`珥2:15-17` 的 note；
- 以及 `src/ui/ending.ts` 的固定說明「每一條都寫明原文是不是同一個字」是否已被這兩章與 booths 章 `kind: word` 的各條 note 兌現（booths 章的 `珥1:14`、`王下10:20-21`）。

## 證據

- 經文：`raw_scripture/<書卷>/第N章.txt`（第 N 行＝第 N 節）。
- 原文：`raw_data/stepbible_joel_1.txt`、`stepbible_joel_2.txt`、`stepbible_leviticus_23.txt`、`stepbible_2_kings_10.txt` 的 Strong 欄位。

## 規則

同第 1 輪：不得加入經文沒有的細節；引號內逐字；原文同字與否須和 Strong 相符；不列文風建議，只列 material findings，附行號與摘錄。

## 輸出格式

先一行 `VERDICT: PASS` 或 `VERDICT: CHANGES_REQUIRED`，然後列 finding；沒有就寫「無」。
