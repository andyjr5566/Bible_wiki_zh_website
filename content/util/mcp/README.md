# Hermes Scripture MCP

這個 server 是既有章節流程的安全介面，不是另一套 workflow。內容規格仍以
[`agent_start_prompt.md`](../../agent_start_prompt.md) 與
[`agent_maintenance_prompt.md`](../../agent_maintenance_prompt.md) 為準；MCP 不會代替 manifest 正式來源勘誤或最終驗證。

## 工具

| 工具 | 用途 | 是否寫入 |
| --- | --- | --- |
| `get_chapter_status` | 依 `check_chapter_files.build_checks` 回報管線缺口與續作指令。 | 否 |
| `search_wiki_entries` | 查 canonical link index 的 title、alias、主分類與 secondary types。 | 否 |
| `read_wiki_entry` | 只讀取索引中的 `link_folder/**/*.md` 條目。 | 否 |
| `read_chapter_artifact` | 只讀取白名單內的 `.tmp/第X章` payload／manual prompt。 | 否 |
| `read_chapter_source` | 讀本地經文或該章 manifest 宣告為 OK 的 raw_data 來源。 | 否 |
| `query_step_context` | 只查本章 manifest 宣告的本地 STEP；支援 verses/range、exact Extended Strong、word，回傳 compact projection＋machine receipt。 | 否 |
| `lint_chapter_content` | 對**傳入文字**做 M6／M3 格式檢查，不讀任何路徑。 | 否 |
| `scan_unsourced_tokens` | 以全庫 raw_data 補掃該章節點條目與渲染 md 的希伯來字母／拉丁音譯／簡體字。 | 否 |
| `run_gates` | 跑核心收尾閘門（可選 `rebuild_index`），逐項回報 PASS／FAIL；每個 gate 可用 `timeout_seconds=600..900`。 | 是，`verify_links` 會更新報告；rebuild 時另更新索引 |
| `prepare_manual_payload_prompts` | 執行 `run_chapter_manual.py prompts` 產出手寫 M3/M6 prompt。 | 是，可能在確認後作廢過期 payload |
| `check_manual_payloads` | 執行 `run_chapter_manual.py check --no-rewrite`；缺 M3/M6 payload 會明確判為 incomplete。 | 否 |
| `render_manual_chapter` | 驗證通過後執行 `run_chapter_manual.py run`。 | 是，render／產生 verse links |
| `preview_chapter_link_updates` | 驗證 B 類累積更新並產生一次性 preview token。 | 否 |
| `apply_chapter_link_updates` | 只套用 token 對應的預覽；預覽或目標檔改變後 token 立即失效。 | 是 |
| `crawl_bible_source` | 對單一明確 URL 呼叫 `crawl_bible_text.py`，輸出限制在 `raw_data/`。 | 是（不覆寫預設） |
| `extract_stepbible` | 由固定的 `.stepbible_data/` 擷取單章／節範圍到 canonical `raw_data/stepbible_*.txt`；可只下載所需官方檔。 | 是（不覆寫預設） |
| `build_source_manifest` | 產生或檢查四套註釋＋STEP 原文資料的 `source_manifest.md`。 | 是（check-only 否） |
| `build_candidate_similarity` | 呼叫 `semantic_lookup.py --candidates` 產生二階段檢索與重排裁判報告。 | 是 |
| `model_client` | 對應 `model_client.py list|test|use`；`use` 必須 `confirm=true`。 | `use` 會寫入 |
| `sync_link_index` | 對應 `build_link_index.py`，可選 `check_only`。 | 是（check-only 否） |
| `check_existing_links` | 對應 `check_existing_links.py ... --missing`。 | 否 |
| `sync_embedding_index` | 對應 `build_embedding_index.py` 的增量、重建、check、status 模式。 | 增量／重建會寫入 |
| `build_appendix_links` | 對應 `build_appendix_links.py`，同步或檢查附錄區塊。 | 同步會寫入 |
| `validate_knowledge_base` | 對應結構驗證，可選 Git base／JSON report。 | report 會寫入 |
| `check_link_quality` | 對應 `link_quality_check.py`，可指定書卷。 | 會更新報告 |
| `verify_links` | 對應 `verify_links.py` 的離線連結與經文引用檢查。 | 會更新報告 |
| `audit_knowledge_base` | 對應 `audit_knowledge_base.py --check-due/--book/--all`；產生報告需確認。 | 報告會寫入 |
| `check_chapter_files` | 對應 `check_chapter_files.py 書名 X`。 | 否 |
| `prepare_chapter_link_updates` | 對應 `link_updates.py prepare`，已存在 manifest 時拒絕覆寫。 | 是 |
| `run_chapter` | 相容名稱，但固定轉到 `run_chapter_manual.py run`；MCP 不暴露模型版 `run_chapter.py`。 | 是 |
| `rename_markdown` | 對應 `rename_markdown.py`；預設 dry-run，正式改名需 `confirm=true`。 | 正式改名會寫入 |
| `check_source_read` | 對應 A0 讀取回執閘門 `check_source_read.py`；開工前先過。 | 否 |
| `check_accumulation_orphans` | 對應反向孤兒累積檢查；`book` 或 `scan_all=true` 二選一。 | 否 |
| `find_duplicate_entries` | 對應 `embedding_dup_report.py --json`，回報全庫既有近似重複條目對，只出報告。 | 會更新 `util/output/duplicate_entries.json` |
| `merge_entries` | 對應 `merge_entries.py`；預設 dry-run，正式合併需 `confirm=true`。 | 正式合併會寫入（見下方三個手動收尾項） |

## M3／M6：固定走人工模式

M3 與 M6 不會呼叫 `run_chapter.py` 的模型端點。標準順序是：

1. `prepare_manual_payload_prompts`，取得 `manual/sources.md`、M3/M6 prompt 與 `prompt_metrics.json`
2. 全文讀 CT／GT／KingComments／BibleHub，完成 `read_log.md`；STEP 全 raw 由 machine receipt 驗證
3. 讀 M3 task-aware STEP projection；需要更多原文時用 `query_step_context`；手寫 `entry_content/*.yaml`
4. 再次 `prepare_manual_payload_prompts`，取得包含實建條目白名單的 M6 prompt
5. 讀 M6 chapter compact projection、必要時 query，手寫 `chapter_content.yaml`
6. `check_manual_payloads`
7. `render_manual_chapter`

`check_manual_payloads` 是唯讀的；它不會把 alias 連結回寫檔案。任何內容敘述仍須人工對回經文與正式來源。Prompt 不再複製已全文讀過的 commentary body；這不是摘要或降低閱讀要求。STEP 是原文證據層，不是第五套 commentary：完整 raw source 經 deterministic machine gate，prompt projection 的 lexicon 依 exact Extended Strong 去重、每個 occurrence 保留 morphology code；不得算入四套註釋的共識票。Lexicon 義域不等於本節語境義，morphology 也不自行推出神學結論。

## 內容勘誤：兩個工具能幫到哪、幫不到哪

`lint_chapter_content` 驗的是格式硬規，每一條在升為 error 前都對全庫 md 實測（機械可證→error、啟發式→warning）：

| 規則 | 判定 |
| --- | --- |
| Mermaid 圖內放 `[[ ]]` | error |
| `![[ ]]` 嵌入／HTML 標籤／`#標籤` | error |
| 參考資料（書目）清單 | error |
| 表格內帶別名連結（`\|` 斷開儲存格） | error |
| 正文出現流程註記（舊版／本次維護／先前版本／待確認事項／應並陳） | error |
| `knowledge_nodes` 自己包 `[[ ]]`（`content_kind="yaml"`） | error |
| Mermaid 節點標籤未加引號 | warning |

`scan_unsourced_tokens` 是**全庫快速補掃**，不是本章來源證明：它把該章
`knowledge_nodes` 解析成 `link_folder/**.md` 加上渲染後的章節 md，逐一對整個
`raw_data/` 語料比對。希伯來字串去 niqqud 後比對；拉丁音譯用**詞界**比對，避免
`perat` 被 `temperate` 誤配。整串查無出處但每個字詞單獨都有出處的（多為 raw 換行
造成，如 `Chalcolithic Age`），另放進 `latin_needing_review` 不計入 flag。
**maqqef 連寫（`אֶת־הָאָרֶץ`）只要連字號兩邊各自有出處就視為有出處，完全不報**——
STEP 的逐字表把兩邊分成兩列，連寫這個**印刷上正確**的形式因此永遠不會整串出現在
語料裡，報它等於在報 STEP 的標記方式（全庫實測 208 處，0 個真陽性）；有一邊查無
出處的連寫仍然照報。`run_chapter.py` 的 `_unsourced_hebrew_errors` 用同一條規則。
**有 flag**
表示全庫語料都找不到，是強力刪除線索；**沒有 flag** 只表示別處可能出現過，仍必須依
本章 manifest 與該條目實際累積的章節來源核對。

**這一支補的是護欄的已知盲區**：`run_chapter.py` 的 `_unsourced_hebrew_errors` 只掃
`.tmp` 的 payload，從不掃已渲染的 `link_folder/**.md`——舊版遷移的 A 類條目沒有
entry_content，護欄一次都沒驗過。

兩者都**不驗內容忠實性**：杜撰的交叉引註、掛錯家的引句、被壓平的爭議、異章污染，
仍然只能逐條開條目對 rawdata 讀。`agent_maintenance_prompt.md` 的三件工作沒有工具化。

## 重複條目：先找、再合併

`find_duplicate_entries` 用既有 embedding 索引兩兩比對**全庫已存在**的條目（與
`build_candidate_similarity` 不同——那支比對的是**新候選**對舊條目）。SAME 旗標
（同分類、去括號後同裸名）最值得先看；INTENTIONAL（不同分類同裸名，如「示巴」
地點 vs 「示巴（起誓、豐盛）」原文）預設不列出，是蓄意雙條目不是重複。

確認要合併後用 `merge_entries(loser, winner, dry_run=true)` 先看報告（累積筆數、
重導連結數、alias 變化、定義/主題發展衝突警告），再 `dry_run=false, confirm=true`
正式執行。它只做「安全重導＋刪檔」，以下三件事仍要人工收尾：

1. winner 條目「相關條目」若寫成裸行 `[[X]]`（沒有 `- ` 項目符號）會在合併時被
   解析器丟棄——合併前後比對一次，把消失的相關條目補回。
2. 該章 `.tmp/*.yaml`（`link_candidates`／`link_plan`／`link_updates`／
   `verse_links`）不會自動更新，仍指著被刪的舊名字與路徑；否則下次
   `render_manual_chapter` 會把它當成解不到的新候選。
3. 同一 (書卷,章) 若兩邊都有累積，渲染時只是用「；」硬接成一段，通常要人工重寫。

合併完成後依序 `sync_link_index` → `sync_embedding_index`。

## B 類累積：先預覽才套用

先依來源人工填完 `link_updates.yaml`，再依序呼叫：

1. `preview_chapter_link_updates`
2. 核對回傳的條目與 yaml 中的 `summary`／`relation`
3. 將回傳的 `preview_token` 傳給 `apply_chapter_link_updates`
4. 再次 preview，確認 `change_count` 為 0

底層會先驗證所有更新目標只在 `link_folder/**/*.md`，預先計算全部變更，暫存後才逐檔替換；作業系統寫入失敗時會嘗試還原已替換的檔案。

## MCP prompts

- `biblical_chapter_sop`：新章流程的 MCP 操作摘要。
- `biblical_maintenance_sop`：維護既有章節／條目的 MCP 操作摘要。

兩者都明定 M3/M6 使用 manual wrapper，並連回兩份 agent prompt 的完整規格；載入 prompt 不會自動改檔或呼叫模型。

## 路徑與輸出邊界

- 不接受絕對路徑或 `..`；不能藉工具讀取 workspace 外的內容。
- `read_wiki_entry` 不接受任意 repo 檔案；`.tmp` 只能經 `read_chapter_artifact` 的白名單讀取。
- stdio transport 的 stdout 保留給 MCP JSON-RPC。底層 CLI 的文字輸出會被捕捉並結構化回傳，不能直接污染 protocol。
- 大型 corpus 執行 `run_gates` 時，MCP client 的整體 tool-call timeout 也要設為 `600000–900000` ms；這和 server 內部每個 gate 的 `timeout_seconds=600..900` 是兩層不同設定。

## 設定

複製本目錄的 `mcp_config_template.json`，並把 `command` 改為**安裝了 `mcp` 套件的 Python**；
該 venv 還必須有 `numpy`、`yaml`，否則 `get_chapter_status` 的步驟6 會回
「無法載入 build_embedding_index：No module named 'numpy'」，而 `run_gates(rebuild_index=True)`
會在重建嵌入索引時失敗。範本以 module 方式啟動：

```json
{
  "command": "C:/path/to/venv/Scripts/python.exe",
  "args": ["-m", "util.mcp.server"],
  "cwd": "C:/Obsidian/Hermes/scripture"
}
```

不要使用 `python -m mcp run ...`：目前安裝的 `mcp` 套件沒有這個 module 入口。直接用上例的 `python -m util.mcp.server` 即可。
