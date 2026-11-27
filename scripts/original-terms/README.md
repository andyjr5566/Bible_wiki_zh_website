# 經文原文詞對照（MACULA 版，試做）

用 MACULA Hebrew 當「這節有哪個原文字、哪個意思」的主幹，替代信望愛（CrossWire ChiUn）掛在一段中文後面的 Strong 編號。決策見 `dev-notes/original-terms/README.md`（O-1～O-6），試做結果見 `dev-notes/original-terms/pilot-report.md`。

**試做階段：不寫進 `quartz/data/`，不接網站。** 輸出放在 `--out-dir`。

## 資料來源與授權

| 資料 | 用途 | 授權 | 取得 |
|---|---|---|---|
| MACULA Hebrew（Clear Bible） | 每個原文字、詞性、Strong 編號、SDBH 字義編號、中文解釋（簡體） | CC BY 4.0 | https://github.com/Clear-Bible/macula-hebrew/ 的 TSV（`macula-hebrew.tsv`） |
| Cherith 中文解釋（吳安迪） | MACULA TSV 的 `mandarin` 欄 | CC BY 4.0 | 同上 |
| STEP Bible（Tyndale House） | 希伯來文節號 → 和合本節號對照；詞表的 lemma／音譯／中文解釋 | CC BY 4.0 | 已在 `scripture/.stepbible_data`（由 `scripts/build-verse-compat.py` 載入） |
| CrossWire ChiUn（信望愛） | 只當「大概在哪一段」的位置線索（規則的挑選依據），不當譯法 | 公有領域 | `scripts/build-verse-compat.py` 的快取資料夾 |
| Unicode Unihan（`Unihan_Variants.txt`） | 簡繁折疊（純 Python，不需轉換套件） | Unicode License | `Unihan.zip`，同上快取資料夾 |

網站上使用時必須加註：「MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/」（CC BY 4.0）。`pipeline.ATTRIBUTION` 已寫入輸出檔的 `attribution` 欄。

## 執行

資料位置一律用參數或環境變數給（不要寫進 repo）：

```
python -I -X utf8 scripts/original-terms/build_original_terms.py \
  --macula-tsv <macula-hebrew.tsv> \
  --scripture-root <scripture 根目錄，唯讀> \
  --compat-cache <含 ChiUn.zip、Unihan.zip 的資料夾> \
  --out-dir <輸出資料夾> [--books 1-6]
```

環境變數備案：`MACULA_HEBREW_TSV`、`VERSE_COMPAT_SCRIPTURE_ROOT`、`VERSE_COMPAT_CACHE_DIR`。程式會用 importlib 載入 `scripts/build-verse-compat.py` 的載入函式（不修改它）。

輸出：

- `verse-original-terms.new.json`：`chapters[章][節] = [[Strong, 譯法, 字義鍵], …]`；譯法可為空字串（和合本未直接譯出）；字義鍵如 `H5375.6`，沒有字義編號時是 `H5375`。`version: 2`。
- `verse-original-terms.oldschema.json`：舊格式 `[[Strong, 譯法], …]`，丟掉空譯法與字義鍵，現有前端可直接讀。
- `occurrences.jsonl`：每個原文字一行，含對應規則（`rule`）、希伯來文、英文解釋、MACULA 中文解釋、整節和合本，供抽樣與除錯。
- `stats.json`：各規則筆數。

## 規則

1. 實詞（`macula.is_content_word`）：詞性為名詞、動詞、形容詞、副詞；排除專有名詞、民族名、數字；介系詞、連接詞、冠詞、受詞記號、代名詞字尾、助詞全部排除。
2. 希伯來文節號 → 和合本節號：用 STEP TAHOT 的對照。
3. 規則①（`unique`／`fhl`／`order`）：MACULA 中文解釋拆成候選詞（`/`、`~` 分隔；`的、在、上…` 這類補字單獨不算），折疊簡繁後在和合本經文裡找；輸出一定是經文裡的原字子字串，且不跨標點。多處出現時：先避開已被別的原文字用掉的位置，再選與信望愛位置重疊的，最後依原文語序挑最近的。
4. 規則②（`confirmed_sense`／`confirmed_strong`）：規則①找不到時，用別處已確定的同字義（再同原文字）譯法，只在信望愛標的那一段裡找；譯法至少被確定 2 次，單字譯法須佔該字義已確定譯法的一半以上。
5. 找不到就是空字串（`none`），**不會**退回信望愛的整段中文。
6. `order`（只靠語序挑的）與 `confirmed_strong` 不直接接受；同一原文字在一節出現多次且共用同一個候選詞時，整組分配（依序、總距離最小，信望愛位置重疊者優先），避免第一個詞把唯一的譯法搶走。
7. AI 判讀（`ai_stage.py`、`run_ai_stage.py`）：所有 `none` 項目分批（每批 ≤50 項）請 Codex 與 Gemini 各自指出連續原字或 NONE；**兩位回同一字串且驗證為未被用掉的連續原字才收**（`ai_agree`）。評審對：有 Gemini（`agy`）結果的批次用 codex＋agy，否則用 codex＋`codex_xhigh`（同模型 xhigh 強度，`--judges codex_xhigh --only-without agy`）；每筆結果的 `pair` 欄記錄由哪一對決定。流程：先跑 `build_original_terms.py`（寫出 `<out-dir>/ai/batches/`），再 `python scripts/original-terms/run_ai_stage.py --ai-dir <out-dir>/ai`（可中斷續跑、已完成批次會跳過、格式不對重試 3 次；`--judges`、`--reverse`、`--workers` 可分工），最後再跑一次 `build_original_terms.py` 套用結果（`stats.json` 有決定筆數，`ai_disagreements.jsonl` 是分歧清單）。

## 測試

```
python -m unittest discover scripts/original-terms
```

邏輯都在純函式（`charfold.py`、`macula.py`、`align.py`、`pipeline.py`），I/O 只在 `build_original_terms.py`。

## 上線第一版（資料 v2）

- `--emit-site-data` 會把 `verse-original-terms.json`（`version: 2`）寫到 `quartz/data/`：`lexicon` 是 `{Strong: [lemma, 音譯]}`、`chapters` 是 `{章 slug: {節: [[Strong, 譯法, 字義鍵], …]}}`，譯法可為 `""`（和合本未直接譯出）。
- AI 判讀的採用結果存在 `data/ai-decisions.jsonl`（鍵是 MACULA 的 `xml:id`，值是和合本原字；每筆仍會在重建時驗證是經文中未被用掉的連續原字）。有模型輸出（`--ai-dir`）時由模型結果重寫這個檔；沒有時直接用它重建，**不需呼叫模型**：重跑同一指令（不給 `--ai-dir` 的批次結果）會得到相同的資料。
- 網站輸出由 `quartz/util/verseIndex.ts` 與 `quartz/plugins/emitters/verseIndex.ts` 產生：`static/verseOriginal/index.json` 與分片 `static/verseOriginal/s-<n>.json`（FNV-1a 32 位元雜湊，見該檔的 `fnv1a32`／`shardOf`）。
- `scripts/build-verse-compat.py` 的 emit 模式已停用舊格式原文資料的輸出（2026-11-28），只寫 `compatData.ts`；`quartz/data/verse-original-terms.json` 只由這裡產生。
