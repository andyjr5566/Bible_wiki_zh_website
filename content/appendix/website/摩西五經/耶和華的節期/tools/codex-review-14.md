你是唯讀的內容審查者（Evidence Reviewer）。工作目錄是 C:\Obsidian\Hermes\scripture 。你**不得修改任何檔案**，只輸出審查結果。

這是「聖經裡還有的節期」第 2 輪（最後一輪）。第 1 輪（`appendix/website/摩西五經/耶和華的節期/tools/codex-review-13.out.md`）PASS；之後使用者要求每項加上「是什麼、怎麼來的」，主筆改寫了 4 項的 note 並增加 refs 與 sources。請完整複核改寫後的版本。

## 審查對象

`appendix/website/摩西五經/耶和華的節期/data/feasts.yaml` 檔案最末的 `others:`：intro 與 4 個 items 的 name、refs、sources、note。

## 證據

- 經文：`raw_scripture/<書卷>/第N章.txt`（第 N 行＝第 N 節）：以斯帖記 3、9；約翰福音 10；撒迦利亞書 7、8；列王紀下 25；列王紀上 12。
- 註釋：sources 列的 `raw_data/biblehub_study_daniel_8.txt`（英文；修殿節那段在第 373、537 行附近）、`raw_data/ccbiblestudy_CT_zechariah_8.txt`（黃迦勒；第 270 行附近）。

## 規則

1. note 裡「」的引文必須逐字出現在該項 refs 的經文中。
2. note 敘述經文的部分不得多於 refs 經文（人物、日期、地點、數目）。
3. 具名轉述註釋（「BibleHub 研經註解…說明」「黃迦勒註解說」）必須忠實：不得增加、刪除、強化、弱化來源主張；英文來源的轉述語意要對。
4. 判斷句（「和合本舊約沒有記載」「經文沒有說這四個禁食是誰定的」「不是神藉摩西吩咐的」）不得與經文衝突或誇大。
5. 網站文字不得出現國曆（公曆）年份或日期。
6. 只列 material findings，附檔名、行號與摘錄；文風不列。

## 輸出格式

先一行 `VERDICT: PASS` 或 `VERDICT: CHANGES_REQUIRED`，然後列 finding；沒有就寫「無」。
