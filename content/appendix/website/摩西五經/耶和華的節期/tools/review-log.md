# 內容審查紀錄（第一階段：開場＋逾越節）

審查者：Codex CLI 0.161.0，`codex exec --sandbox read-only`（唯讀）。每輪審完都跑 `git status util/`，兩輪都沒有變動。
預算：最多 2 輪；第 2 輪之後由主筆做最後修正，不再叫第 3 次審查（AGENTS.md）。

## 第 1 輪（2026-10-09）

- 指令：`tools/codex-review-1.md`。
- 範圍：story.yaml、commentary.yaml、step.yaml 全部。
- 結果：`VERDICT: PASS`，無 finding。

## 第 2 輪（2026-10-09，最後一輪）

- 指令：`tools/codex-review-2.md`。
- 範圍：第 1 輪之後的改動，包括：
  - `entry_gists` 11 句；
  - hyssop 拍加掛 `gt-tyndale-basin`；
  - 介面上涉及經文內容的字句。
- 結果：`VERDICT: CHANGES_REQUIRED`，1 條 finding。
  - `gt-tyndale-basin` 的轉述在 GT raw 第 404 行，但這一段本身沒有出處標記；第 406 行的「──《丁道爾聖經註釋》」屬於下一段，不能證明第 404 行也是丁道爾。

### 主筆查證

- 第 404 行之後是空行，第 406 行才是另一段，屬實。
- 專案正式護欄 `util/run_chapter.py` 的 `_nearest_gt_marker` 是「往後找最近的標記」，不看段落；照它判，第 404 行會算丁道爾。
- 第 404 行的音譯寫法（sap{）在全庫 GT raw 約九成出現在丁道爾段落，但也出現在其他子來源。
- 結論：證據傾向丁道爾，但沒有明確標記。網站公開掛名採較嚴的判準：**引文或轉述所在的那一段，結尾必須有該子來源的標記**。

### 依同一判準全面複查後的最後修正

同一型（本段無標記，靠下一段的標記掛名）共找到 4 處，第 1 輪都沒抓到：

| 位置 | GT raw | 處理 |
|---|---|---|
| `gt-tyndale-basin`（盆／門檻） | 第 404 行 | 刪除這則註釋；step.yaml 的 `saph` 說明改用 STEP 欄位＋黃迦勒（CT 第 112 行）＋KingComments（KC 第 89 行） |
| step.yaml `ezov`（墨角蘭、不合約19:29） | 第 404 行 | 改用《舊約聖經背景註釋》（第 412 行，有標記） |
| `gt-tyndale-fullmoon`（當是月圓） | 第 83 行 | 刪除；full-moon 拍只留《舊約聖經背景註釋》（第 140 行，有標記），highlight 改在「滿月」 |
| `gt-tyndale-pesach`（本節是對節期名稱唯一的解釋；越過／跳過） | 第 263 行（之後是 14～20 節的段落標題） | 刪除；midnight 拍改掛 `kc-passover-word`（KC 第 69 行）；step.yaml `pasach` 改用黃迦勒的原文字義（CT 第 222 行「越過」略過，跳過） |

### 機械防線

- `scripts/checks.mjs` 的 `attributionAfter` 改成只在引文所在段落裡找標記，遇空行就停。
- `scripts/checks.test.mjs` 加了反例測試。
- 現在網站的 GT 註釋 9 則都有逐字引文，全部通過這道段落級檢查。
- STEP 說明裡提到 GT 子來源的 6 處由主筆逐一回查，標記都在同一段：
  - 串珠第 132 行；
  - 丁道爾第 138、225、267 行；
  - 背景註釋第 176、227、412 行；
  - 丁良才第 390–391 行。

---

# 第二階段第一批（春季：月朔、無酵節、初熟的禾捆、二月逾越節、七七節）

## 第 1 輪（2026-10-09）

- 指令：`tools/codex-review-3.md`。
- 範圍：本批新增的內容，包括 story.yaml 18 拍、commentary.yaml 68 則、step.yaml 8 字、條目簡介 16 句。
- 結果：`VERDICT: CHANGES_REQUIRED`，2 條 finding，見 `tools/codex-review-3.out.md`。兩條同一個問題：BibleHub 利23:17「Unlike other offerings that required unleavened bread」被譯成「別的祭都要用無酵餅」，擴大了來源的說法。
- 主筆回查 `raw_data/biblehub_study_leviticus_23.txt` 第 251 行，屬實。已修 `bh-leaven-unlike` 的中譯和 `chamets` 的說明。
- Codex 另外說明：
  - 67 則逐字引文都在指定 raw 找到；
  - GT 引文都有本段標記；
  - STEP、敘述、條目簡介都核過。
- 審查前後 `git status util/` 無變動。

## 第 2 輪（2026-10-09，最後一輪）

- 指令：`tools/codex-review-4.md`，只複核上述兩處。
- 結果：`VERDICT: PASS`，無 finding，見 `tools/codex-review-4.out.md`。
- 審查前後 `git status util/` 無變動。

## 第二階段第二批（秋季＋舊約回聲）

- **第 1 輪**（`codex-review-5.md` → `.out.md`）：CHANGES_REQUIRED，14 條。
  - 13 條是同一類：敘述講到的背景不在該拍列出的經文範圍裡（例如 `veil` 提到亞倫兩個兒子死了，在利16:1；`hezekiah` 的召集與改期在代下30:1-3）。
  - 修法：連續的擴大 `verse`；不連續的在契約新增 `Beat.moreVerses`，說明框接著顯示；少數刪去未涵蓋的句子。
  - 1 條：王下4:22-23 只是提到月朔，不是在守，從「後來的人怎麼守」移除。
  - 85 則註釋的逐字引文、GT 子來源標記、9 個原文字的 STEP 描述、23 句條目簡介：審查者確認無誤。
  - 審後 `git status util/`：無變動。
- **第 2 輪**（`codex-review-6.md` → `.out.md`）：
  - 第一次執行時 Codex 的 Windows 唯讀沙箱報 `setup refresh had errors`，沒有讀到任何檔，不算一輪；重跑後完成。
  - CHANGES_REQUIRED，2 條：`hezekiah` 的召集在代下30:1；`bulls` 概括七日，但只列了第一、二、七日。
  - 主筆最後修正：`hezekiah` 改列代下30:1-3；`bulls` 補列民29:20、23、26、29。依規則不叫第 3 輪。
  - 審後 `git status util/`：無變動。

## 章末「舊約其他書卷」note 重寫（使用者回報：只是重述經文）

- 18 條 note 改成交代讀者看什麼：跟本章律法的對照、經文自己給的原因、原文是不是同一個字。上限由 60 字放寬到 120 字。
- 主筆查證時發現：利23:24 的「吹角」原文是 H8643（響亮的聲音），珥2:1、珥2:15 的「吹角」是 H8628＋H7782（吹公羊角），和合本同譯、原文不同字；note 照實寫明。「同樣的字」一節的固定說明改成「用了相同的說法……每一條都寫明原文是不是同一個字」。
- **第 1 輪**（`codex-review-7.md` → `.out.md`）：CHANGES_REQUIRED，3 條，主筆逐條回查 raw 確認成立：
  - 拉6:19-20 把民9:6「有幾個人因死屍而不潔淨」概括成所有不潔淨的人；
  - 珥2:1 只憑沒提七月就斷定不是吹角節；
  - 珥2 兩條沒有明說原文同字與否，和固定說明不符。
  - 審後 `git status util/`：無變動。
- **第 2 輪**（`codex-review-8.md` → `.out.md`）：PASS，無 finding。審後 `git status util/`：無變動。

## 第二階段第三批（七的節奏）

- **第 1 輪**（`codex-review-9.md` → `.out.md`）：CHANGES_REQUIRED，4 條，主筆逐條回查 raw_scripture 確認成立並修正：
  - `jubilee-horn` 和七月初一比較，但沒列利23:24；補列，並改寫成「和合本兩處都譯作角，原文不一樣」；
  - `land-mine` 的「人要放回」在利25:41-42；補列；
  - `land-rest` 的「耶路撒冷陷落」在代下36:19；經文改為代下36:19-21，敘述照第19節寫「城牆被拆毀」；
  - `neh-oath` 的「被擄歸回」不在尼10:28-29；改照經文列出起誓的人。
  - 46 則註釋、5 個原文字、10 句條目簡介、3 筆章末 note：審查者未列 finding。
  - 審後 `git status util/`：無變動。
- **第 2 輪**（`codex-review-10.md` → `.out.md`）：PASS，無 finding。審後 `git status util/`：無變動。資料檢查（引文逐字、GT 段落歸屬）0 錯。

## 第三批：使用者看過後改寫五拍說明（差異複核）

- 使用者反映 `seven-weeks`、`month-seven` 看不懂；同病的 `sabbath`、`sabbath-year`、`forty-nine` 一併改寫。
- **第 1 輪**（`codex-review-11.md` → `.out.md`）：CHANGES_REQUIRED，2 條，主筆回查 raw_scripture 確認成立並修正：
  - `seven-weeks`：利23:15-16 沒有「七七節」這個名稱；改照經文寫「共計五十天，又要將新素祭獻給耶和華」；
  - `forty-nine`：利25:8 沒提七七節；刪去比較，只留「七七年，共是四十九年」。
  - 審後 `git status util/`：無變動。
- **第 2 輪**（`codex-review-12.md` → `.out.md`）：第一次呼叫因審查者讀不到檔案而受阻（不算一輪），重跑後 PASS，無 finding。審後 `git status util/`：無變動。

## 頁尾「聖經裡還有的節期」（使用者 2026-10-11 要求）

- **第 1 輪**（`codex-review-13.md` → `.out.md`）：PASS，無 finding。審後 `git status util/`：無變動。
- 使用者接著要求每項說明「是什麼、怎麼來的」，主筆改寫 4 項、增加 refs 與 sources（修殿節：BibleHub 但8；禁食：黃迦勒 亞8）。
- **第 2 輪**（`codex-review-14.md` → `.out.md`）：CHANGES_REQUIRED，2 條，回查 raw_scripture 成立：
  - 普珥日「哈曼設謀要殺盡」在斯9:24，補列；
  - 「省長基大利」在王下25:22，補列。
  - 審後 `git status util/`：無變動。
- 第 2 輪是最後一輪；主筆最後修正後依規則 forced pass，不做第三次審查。
