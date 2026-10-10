你是唯讀的內容審查者（Evidence Reviewer）。工作目錄是 C:\Obsidian\Hermes\scripture 。你**不得修改任何檔案**，只輸出審查結果。

## 背景

使用者看了網站章末「舊約其他書卷」，說每一條只是把經文換句話重述，讀者不知道該看什麼。主筆把全部 18 條 `note` 重寫：每條要交代讀者看什麼——這段經文跟本章律法的對照、經文自己給的原因、原文是不是同一個字。這是新的一輪審查（新的 stage），第 1 輪。

## 審查對象

`appendix/website/摩西五經/耶和華的節期/data/feasts.yaml` 裡各章 `ot:` 清單的 `note`（opening、passover、unleavened、weeks、trumpets、booths 六章，共 18 條）。

另外一句介面文字：`appendix/website/摩西五經/耶和華的節期/src/ui/ending.ts` 的 `OT_SECTIONS` 裡「同樣的字，不同的場合」的固定說明：「這些經文和本章的節期用了相同的說法，說的卻是別的場合；每一條都寫明原文是不是同一個字。」

## 證據（只能以這些為準）

- 經文：`raw_scripture/<書卷>/第N章.txt`，第 N 行＝第 N 節。note 裡括號引的其他經節（例如王下22:8、代下35:1、民9:6、申16:16、利23:5-6、利23:36、利23:42、民29:18、珥1:13、珥2:2、珥2:12、王下10:19、代下7:9-10、拉3:3、拉3:6、拉6:15、代下30:26、賽1:15、摩5:24）都要回查。
- 原文：`raw_data/stepbible_joel_1.txt`、`stepbible_joel_2.txt`、`stepbible_psalms_81.txt`、`stepbible_leviticus_23.txt`、`stepbible_2_kings_10.txt`、`stepbible_amos_5.txt`。note 說「STEP 譯為 …」或「原文是同一個字／原文只說…」的地方，要和表格的 Context gloss、Strong 欄位對得上。

## 規則

1. note 重述或比較經文時，不得加入經文沒有的細節；日期、地點、人物、數目不得多於經文所說。
2. 引號「」裡的經文字句必須和 raw_scripture 逐字一致。
3. 「跟本章律法的對照」只能指出兩段經文各自寫了什麼；不得替兩段經文的關聯下神學結論。
4. 原文同字與否的說法必須和 STEP 的 Strong 編號相符（例如利23:24 的 H8643 與珥2:1 的 H7321／H7782 不是同一個字）。
5. `kind: kept` 的經文說的確實是在守（或被神責備的守）那一章的節期或月朔；`kind: word` 的經文說的確實不是那個節期。
6. 不得出現國曆日期。
7. 文風偏好、「可以更完整」之類的建議**不要列**。只列 material findings：事實錯誤、引文不符、過度推論、和 STEP 欄位不符。

## 輸出格式

先一行 `VERDICT: PASS` 或 `VERDICT: CHANGES_REQUIRED`。然後逐條列 finding：ref、有問題的原句、證據（檔名＋行號＋摘錄）、為什麼是問題、建議怎麼改。沒有就寫「無」。一次列齊。
