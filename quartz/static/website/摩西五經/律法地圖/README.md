# 摩西五經的律法

摩西五經律法的互動網站：從生活問題、主題、書卷或經文找到一條律法，再一層一層往下讀經文、別卷的記載與出處。
資料管線、分類與閘門沿用最初的規劃（`C:\Users\andyj_adknr2z\.claude\plans\appendix-website-pasted-content-moonlit-turing.md`），
但**那份規劃裡的「入門／查經／研究」三層切換已經拿掉**（使用者 2026-10-04：太誇張，要一體成型）。以本 README 為準。

> **接手前先讀 [HANDOFF.md](HANDOFF.md)**：專案是什麼、現在做到哪、還有什麼要做、不能違反的規則。這份 README 講的是東西怎麼運作。

**目前狀態：全五經收錄完成（2026-10-04）。** 創世記、出埃及記、利未記、民數記、申命記每一章的每一節，不是在某一條條文裡，就是在 `excluded` 寫了理由（敘事、家譜、祝福咒詛、歌與預言等不收）；覆蓋率報告沒有「未處理」的節。條文、關聯、段落的數字以 `npm run data` 的輸出為準。長的書卷分成 `data/laws/書名-xx-yy.yaml` 幾個檔案（同一個 book，建置一起讀；同一章不要拆在兩個檔案）。第一次來的人會自動看到「新手教學」（`src/ui/coach.ts`）：12 步分四段，可自己選要學哪一段，在真正的網站上請讀者自己點，點完才說明看到的是什麼、對讀經有什麼用；頂列「新手教學」可以再開。

## 設計初衷

一位牧者講詩篇一篇（「惟喜愛耶和華的律法，晝夜思想」）時說：律法的原文 תּוֹרָה（妥拉）是指引，引導人不偏離；喜愛律法，是喜愛藉著話語啟示自己的那位神；讀律法要看出規條背後希望人活出來的精神，不能只停在規條。這個網站照這個方向設計：

- 首頁標語是詩1:2 的和合本原句（`build-data.mjs` 的 `MOTTO`，逐字讀 `raw_scripture`），下面一句「律法是神給人的指引」。
- 網站不替經文解釋精神，改讓**經文自己交代理由**：條文的 `why` 欄位只標節號（例如利25:42「因為他們是我的僕人，是我從埃及地領出來的」），畫面上顯示和合本原句。律法頁在一句話下面放「經文給的理由」；主題頁、書卷頁、搜尋結果、路線頁、對照頁的條文也一併顯示（共用 `whyBlock`，在 `src/ui/cards.ts`）；首頁有「經文自己交代的理由」一區，先各卷輪流放幾條，可就地展開看全部、依書卷分開。標的標準與逐條結果見 `review/why-review.md`。
- 「律法」的字義寫在首頁一行與「關於」：תּוֹרָה（H8451）詞典義域是律法、指引、教導；字根 יָרָה（H3384）有射箭、也有指出教導。`build-data.mjs` 會核對 STEP 詞典這幾個義域。**「引導讓人射中靶心」是講道的比喻，詞典沒有這句，也沒有收錄 תּוֹרָה 由 יָרָה 衍生的說明（那是一般詞典如 BDB 的說法），畫面不寫靶心。**
- 講道內容與講者不出現在網站上；「關於」只用自己的話寫「這個網站怎麼看律法」。

## 四條原則

1. **不搬知識庫內容。** 條目、互文說明、本章整理只給「名稱＋類型＋最多一句」，然後「查看完整條目（另開網頁）」連到公開網頁（`src/data/links.ts`，作法同民數記 33 章網站）。網站自己的價值是知識庫沒有的東西：分類、反查、跨卷對照、分布。
2. **一體成型，由淺到深。** 沒有閱讀模式、沒有給不同讀者的切換。每條律法固定四層：一句話（永遠開著）→ 經文 → 別卷 → 出處；收合列先預告裡面有什麼（經文開頭幾個字、別卷的出處、條目數）。首頁的順序也是由淺到深：問題卡 → 律法帶 → 別卷又記了一次 → 全部主題；分布表、收錄進度、下載放在「關於」。
3. **不寫 AI 公式文。** 介面文字、問句、路線名稱都平實交代內容：禁「不是…而是」「是…，不是…」、「讓我們／探索／帶你」、「X：Y」口號式標題、空泛昇華句尾。`scripts/build-data.mjs` 的 `BANNED`／`lintCopy` 擋資料，`data.test.ts` 的「介面文字不用公式句」掃 `src/**/*.ts` 的中文字串。閘門擋不到的句型（湊三律排比、模板式導言）要自己讀。
4. **不編造。** 經文只取自 `raw_scripture`；白話說明只重述經文；律法之間的關聯每一條都要有知識庫裡的出處，閘門逐字核對。找不到出處就不連線。

## 指令（一律用 PowerShell 跑，Bash 會被應用程式控制擋 rollup）

```powershell
npm install
npm run data        # data/*.yaml ＋ vault → src/data/explorer.json、appendix-chapters.json、review/summaries.md
npm run seed -- 利未記 1 27   # 從本章整理抽段落草稿到 data/seed/（網站不讀，整理後再搬進 data/laws/）
npm run build       # data:check → tsc → vitest → vite build（單一 dist/index.html，file:// 可直接開）
npm run dev         # http://127.0.0.1:3051
```

改了 `data/*.yaml`、或 vault 裡的經文／verse_links／條目之後，一定要 `npm run data`，否則 build 會因為資料過期而失敗。

## 資料格式（手寫的只有 data/）

| 檔案 | 內容 |
| --- | --- |
| `data/topics.yaml` | 6 大類 × 子題。大類顯示 `name`；子題顯示 `plain`（主題頁標題旁附 `name`）；`entry` 選填，必須是存在的條目 |
| `data/laws/<書名>.yaml` | 章 → 律法段落 → 條文。每章的 `excluded` 寫刻意不收的節與理由 |
| `data/relations.yaml` | 律法之間的關聯，`type`：parallel／supplement／case／cites；`evidence` 必填 |
| `data/questions.yaml` | 首頁的生活問題卡：`q`（≤30 字、問號結尾、只問經文回答得了的事）＋ `laws`（1–3 條）。答案用條文自己的一句話，不另寫 |
| `data/tours.yaml` | 照順序讀的路線（條文 id 的順序）；段與段之間不另寫說明；名稱不用「X：Y」 |
| `data/glossary.yaml` | 術語 → 條目，白話說明裡加虛線底，點了開條目小卡 |

條文欄位：

```yaml
- id: ex21-02                 # 書卷英文簡寫＋章＋起始節，全站唯一
  title: 希伯來男僕第七年自由  # ≤30 字
  refs: ["2-6"]               # 同一章內的節範圍，可多段；跨章的重述另立一條再用關聯連
  topics: [slavery]           # topics.yaml 的子題 id，至少一個
  summary: 買來的希伯來男僕服事六年，第七年可以白白地出去；……   # 只重述經文，≤90 字
  basis: [2, 5, 6]            # 說明依據哪幾節，必須在 refs 內
  why: [42]                   # 選填：經文自己交代這條律法理由的節（在 refs 內）。只標節號，不寫文字
  entries: [希伯來奴僕的律例]  # 選填：庫裡已有的這條律法的條目
```

關聯證據二選一，引句必須**逐字**出現在出處裡，而且「條目標題＋引句」解析出的經文參照要同時蓋到兩條律法：

```yaml
evidence: { entry: 申15：12-18, quote: 申命記15章補充了出21:2-6的希伯來奴僕釋放條例 }
evidence: { chapter: 申命記/第15章, quote: ……本章整理裡的一句…… }   # 該章本身算一端
```

參照解析支援 `出21:2-6`、`出21：2`、`出二十一2～6`、`《出埃及記》二十一2`、`申命記15章`（`scripts/lib.mjs` 的 `extractRefs`）。

## 閘門（`npm run data` 與 vitest）

- 經文範圍在章內、`basis` ⊆ `refs`、`why` ⊆ `refs`（畫面上的理由逐字取自 `raw_scripture`，測試核對）、每條有子題與說明、id 不重複。
- 白話說明 lint：長度；禁「不是…而是」、象徵／預表／體現／意味著等解釋性字眼；禁「她」；禁 CT／GT／KC／BH／STEP 與 Strong 編號。
- 說明與依據經文的字詞重疊率 < 40% 會警告（可能說了經文沒說的事）。**寫完一定要讀 `review/summaries.md` 逐條對照經文**，閘門只擋得住明顯的錯。
- 條目、主題、術語、證據都要解得到；verse_links 的片語要在經文裡找得到。
- 條目簡介 ≤ 40 字、不含原文字母與 Strong 編號；連結不得是 `obsidian://`。
- 覆蓋率：每章還沒處理（既不在條文也不在 `excluded`）的節，`npm run data` 會列出來。一卷完成的標準是只剩 `excluded`。

## 掛到章節附錄

`appendix-chapters.json` 由 `npm run data` 自動產生（有條文的章）。`appendix/website/build.py` 已支援跨卷的「書名/第N章」寫法，且不會為 `摩西五經` 這個非書卷資料夾產生自己的 key。

順序固定：**先 `npm run build`（要有 dist/index.html），再** `python util/build_appendix_links.py`——dist 不在時同步會把連結刪掉。之後跑 `check_chapter_files`、`validate_knowledge_base`（base 傳 git revision）、`verify_links`。

> 目前**還沒有掛上去**：只有 6 條示範條文，等 Phase 1 內容補齊再掛。`--check` 已確認會更新出20、出21、利25、申5、申15 與三卷全書目錄，共 8 個檔。

## 程式結構

```
scripts/lib.mjs            讀 vault：經文、verse_links、條目（掃 link_folder）、本章整理、全書目錄；經文參照解析
scripts/build-data.mjs     接資料、跑閘門、寫輸出；export buildAll() 給測試用
scripts/seed-sections.mjs  段落草稿
src/data/                  types.ts（explorer.json 形狀）、db.ts（索引與查詢）、links.ts（公開網址）
src/lib/                   refs（搜尋框參照）、search、diff（字面差異）、csv
src/ui/                    dom、peek（原地小卡）、cards（條文卡、經文、條目小卡）、chrome（頂列）、searchbox、
                           ribbon（五經律法帶：首頁大的、各頁頂端細的；任何 data-laws="id id" 的元素滑過或聚焦就亮出那幾條）、graph（關係圖）
src/views/                 home、law（四層梯子）、topic（各卷一欄＋連線）、compare、book（含 #/ref/出21）、entry、tour、about
```

路由：`#/`、`#/topic/<子題或大類 id>`、`#/law/<id>`、`#/compare/<id,id>`、`#/book/<簡稱>`、`#/ref/出21`、`#/entry/<條目>`、`#/tour/<id>/<段>`、`#/about`。

條文頁記住讀者打開過「經文」「別卷」（localStorage `lawmap:layers`），換到下一條時沿用；「出處」不沿用。

樣式：所有 class 用 `lm-` 前綴；顏色是 `:root` 的變數（深淺色各一組）；大類色 `--g1…--g6`、條目類型色 `--t-*`。互動守則：點擊不捲動頁面（用 peek 小卡）、不用 `scrollIntoView`、手機單欄寫 `minmax(0, 1fr)`。

## 驗證

用 headless Chrome 以 `file://` 開 `dist/index.html` 截圖（PowerShell `Start-Process` 開 chrome 的 remote debugging，再用 CDP 腳本）。每次要看：首頁（問題卡打開、滑過圖例時律法帶亮起）、條文頁四層全收與全開、主題頁連線、桌機 1280 與手機 390（手機 `scrollWidth` 必須是 390）、深色模式、console 無錯誤、打開一層與點經文片語前後 `scrollY` 不變。
**收尾只關自己開的 Chrome**（用獨立 `--user-data-dir`，再依命令列找出那幾個行程關掉）；不要 `Get-Process chrome | Stop-Process`，那會連使用者正在用的瀏覽器一起關掉。

## 接下來要做的

待辦清單、每一項的做法與完成標準、哪些不用寫內容、哪些要先問使用者，全部寫在 [HANDOFF.md](HANDOFF.md)，這裡不重複，免得兩邊對不起來。接手的人先讀 HANDOFF.md。

## 授權

經文為和合本。本站僅供非商業的教育與聖經研讀使用。
