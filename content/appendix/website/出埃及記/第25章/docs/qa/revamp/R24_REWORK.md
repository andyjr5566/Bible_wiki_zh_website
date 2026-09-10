# R24 返工卡與證據邊界

日期：2026-09-10（Asia/Taipei）。執行者：GPT-6 Astra 總控驗收代理。基準 `685da044`。結論 **NEEDS_CHANGES**。以下是可交給已授權 gpt-5.6-luna 的工程任務；本輪沒有呼叫 Luna，沒有改應用程式或 Blender。

P0 表示會教錯來源內容，應先處理；P1 表示缺少承諾的核心功能或驗收保障。修正只限本網站資料／程式／必要的隔離衍生資產，不修改正式經文、raw_data、production 或六個既有 `.blend1`。涉及來源未明處維持 unresolved。

## P0-01：修正程序中的來源錯置

範圍：[rituals.json](../../../src/data/rituals.json)、[RITUAL_STEPS](../../research/RITUAL_STEPS.md)、相關 claim 與資料測試。R24 已直接讀正式《利未記》1、16、24章、《出埃及記》30章核對。錯誤來自網站轉述及區域契約，不是正式經文檔案。

| 精確目標 | 現況與證據 | 必要修正及驗收 |
| --- | --- | --- |
| `burnt-cattle-priest` | 把分塊、清洗一併寫成祭司職責；利1:6 明言「那人」剝皮、切塊，1:7–9 另列祭司工作。 | 回復 R02 分工，不把合併文字當完整步驟。逐步列 actor→動作→經節，核對牛、羊、鳥所有分支。 |
| `lamp-oil-present` | unresolved 寫「提供者…未在此節明定」，利24:2 已指定以色列人拿清橄欖油。 | 供應者與祭司管理燈火分列；採油畫面細節仍可 unresolved。 |
| 陳設餅四步 | 顯示十二餅、安息日替換與食用，遺漏利24:7 乳香動作。 | 按 R02 補步驟及經節，不能只測 4/4 完成。 |
| `atonement-incense` | 文字是帶香入幔；資料卻 `holy-place`、`incense-altar`。利16:12–13 是帶入幔內、煙雲遮掩施恩座。 | 拆清日常香壇與幔內香爐，位置、物件、效果同步，不沿用日常香壇煙。 |
| `atonement-bull-blood` | 「施恩座東面與前面…七次處理」模糊了次數範圍。利16:14 分東面彈血與施恩座前面七次。 | 精確表達前後動作和七次所屬範圍，禁止讓共用七次標記覆蓋兩處。 |
| `atonement-change-clothes` | `camp-assembly` 是營中會眾區；利16:23–24 是進會幕脫衣、在聖處洗身、穿衣出來。 | 分拆脫衣、洗身、穿衣、退出狀態和位置；回退後可重建。 |
| `atonement-altar-clean` | 以章級 claim 直接標「潔淨燔祭壇」；利16:18 本句只稱壇。 | **unresolved U-R24-01**：須附能支持壇之識別的核准解釋來源，並處理出30:10 對照；本輪不裁定是哪一座壇。暫勿把具名識別列為經文明載。 |

完成條件：每個被修動作能對回正式經節；新增具體負例，防止語意錯置仍通過純 ID 存在檢查。`npm run build` 通過後重走 QA08–QA11。未經查核的外部研究不補成已核准。

## P1-02：接通四角色、三衣裝與程序場景

範圍：[AppKernel](../../../src/app/AppKernel.ts)、[CharacterSystem](../../../src/characters/CharacterSystem.ts)、[RitualVisualSystem](../../../src/rituals/RitualVisualSystem.ts)、角色／衣裝／區域資料及 UI。

`AppKernel.characters` 建立時沒有傳任何 runtime hooks；`CharacterSystem` 三方法只呼叫可選 hooks。`RitualVisualSystem` 只有固定位置的洗濯圓環和香煙球，沒有按每步 `actorRole/locationId/garmentState` 掛載角色、切衣裝或管理區域。角色卡不是場景實作。`getExperienceState()` 從 `characterIds` 或舊選擇找角色，不解析 `actorRole`；牛第一步已寫獻祭者，卡片仍顯示供職祭司。見 [程序 DOM](r24-ritual-evidence.json)。

任務：建立 actorRole 到可見教學角色與來源入口的契約，補獻祭者入口，讓利未人職責可由站內找到；以已核准技術基底表達普通祭司、大祭司日常衣、贖罪日麻衣，逐步同步角色、衣裝、區域與鏡頭。處理所派之人時不預設祭司。利16:17 的人員排除要涵蓋指定期間，不能只是一張「會幕裡不可有人」卡片。先確認既有資產能否承擔；真需 Blender 才另開單一循序場景任務。

完成條件：QA08–QA12 提供每步可見角色／衣裝／位置快照、activeAssetIds、回退／重播與退出釋放證據；四職責有可讀的具體來源。文字標記可用於非寫實動作，但不能替代未完成的場景狀態。

## P1-03：完成五祭流程與供物分支

範圍：[R15_OFFERINGS](../../research/R15_OFFERINGS.md)、rituals／offerings 資料、入口及播放器。R15 文件自己註明其他四祭只做基本閱讀；Browser 比較表只有牛、羊、鳥三個燔祭播放入口。runtime 共 9 個 ritual 記錄，沒有素祭、平安祭、贖罪祭、贖愆祭完整流程。見 [入口 DOM](r24-learning-initial.txt) 與 [資料盤點](r24-static-audit.json)。

任務：依 R15 原規格與已核准利2–7來源，讓五祭每列進入各自流程；依供物與身份分支保留分工、血處理、焚燒／食用範圍和位置。牛／羊／鳥也須按 R02 完整覆蓋，不以 3/3 或 2/2 播放完成取代內容覆蓋。山羊現有資料與實際入口須一致。

完成條件：QA10 每 branch 全 step→actor→claim→scene 表；操作到最後再返回，分支不混用。不得為了通過測試縮減五祭範圍。

## P1-04：修復跨模式退出與 context 還原

範圍：AppKernel、UIStateManager、播放器／detail 生命週期。實測：燔祭牛第一步→器物按鈕約櫃，頁面切到器物與經文但仍保留 PLAYING 1/3 燔祭。從 detail→場景總覽，仍為 `desktop-structural`、selected ark、activeAssetCount=2，沒有還原原本 `desktop-high`。見 [程序 DOM](r24-ritual-evidence.json)、[overviewAfterDetail](r24-detail-evidence.json)。

任務：所有入口經統一 transition 清理播放 owner；保留並恢復進入前 profile、相機與剖面 context，退出卸載 detail。覆層返回與改模式分別處理。

完成條件：QA02／QA13 真 Browser 重現前述路徑與自動導覽混用；確認停止後無舊相機或粒子繼續推進；遲到載入不能重新掛載。補對此行為有意義的回歸測試。

## P1-05：對齊部件 ID、剖面與安全取景

範圍：object-details、asset-parts、CameraManager、shell 邏輯及 drawer 佈局。17 個使用者可點部件只有 2 個與 verified 映射對齊，11 個缺映射、4 個 unresolved；映射臺帳自身則是 5 verified／7 unresolved，不能拿後者當 UI 覆蓋數。燈臺 `seven-lamps` 對不上映射 `lamps`；桌面、金環等亦有缺口。詳見 [visiblePartMappings](r24-static-audit.json)。

任務：以實際 GLB node/hash 對齊可點部件，對缺少幾何映射提供可恢復說明；不能用歷史外形未詳掩蓋工程映射缺失。shell 使用登記部件，撤除依通用 Plane/Tube 等詞猜測隱藏範圍的做法。取景區分器物本體和槓，使用扣除 drawer 後可見 canvas 區域；目前 `frameDetailBounds` 固定42度、extent比例，沒有此安全區。

完成條件：QA04 十次剖面循環；QA05 六器物桌面／手機含槓安全邊與相機/FOV/bounds receipt。R24 已記 [手機矩形](r24-mobile-evidence.json)：drawer 變動後 canvas 仍為整個視口；[360 閱讀穩定圖](screenshots/r24-mobile-360-reading-stable.jpg) 只證明閱讀態，不能代替全部器物取景驗收。

## P1-06：補上可獨立查詢的來源與研究比較

範圍：evidence、各動作／衣裝 evidence UI。研究臺帳有 `S-ARCH-TIMNA`，runtime 來源只有經文與工程兩類，六器物均顯示沒有已核准考古比較。角色卡也未展示部件所屬 claim／經節入口。來源總抽屜列出章名不等於每一動作可點到具體證據。見 [來源覆層](r24-source-keyboard-evidence.json) 與靜態盤點。

任務：逐項對齊核准 ledger 和 runtime；至少落地規格要求、已有充分來源支援的比較案例，說清能支持什麼及不能證明什麼。若尚無可核准內容，保留 unresolved 並將相應任務列未完成，不能捏造研究。尺寸／部件／服飾／程序動作均有直接證據入口。

完成條件：QA06 claim 覆蓋表與來源缺失負例；初學者問題3、5、8 能在站內獨立完成。

## P1-07：完成故障處理與可及性矩陣

範圍：main、SceneBootstrap、AppShell 及 UI。真 HTTP500 已驗 hero→低模備援成功，detail 燔祭壇失敗→約櫃成功，正文仍保留；錯誤訊息在收合的模型選項內，初始不直接可見。`new WebGLRenderer` 發生在 shell 綁定前，沒有應用層不可用／context lost 復原流程。見 [故障 receipt](r24-fault-evidence.json)、[實際 HTTP](r24-http-responses.jsonl)。

任務：確保 WebGL 初始化失敗仍有可用文字導航、清楚錯誤與重試；處理 context lost/restored。以實際故障注入覆核，並補離線文字可讀、競態網路延遲、全鍵盤、200% 字體、reduced-motion、音效開關及停止後無動畫漂移。

完成條件：QA03、QA14–QA16 矩陣與 expected 故障獨立紀錄。R24 僅證明來源覆層 Escape 關閉且焦點返回「資料來源」；不能擴張為全鍵盤 PASS。

## P1-08：修正效能量測後完成長測與乾淨重建

範圍：PerformanceRecorder、AppKernel 計時點、效能／交付證據。`firstUsefulFrame` 在 asset ready 回呼同步記錄，未等待有效取景後真正渲染一幀；資產表取 manifest 宣告，不能證明實際下載。raw frame intervals 未保留，LongTask API 不支援時也可能記成0。DOM 隔離工具讀不到應用全域，不代表 API 不存在。

任務：修正計時點、實際資源／active IDs與camera診斷、原始樣本及 unavailable 狀態；再執行每情境三次60秒與全部器物／程序20次往返，保存幾何／貼圖趨勢。乾淨隔離目錄重跑 Blender recipe→GLB→manifest→build→中文巢狀 preview，全程不寫原 source 或現有 scene。Blender 僅單一代理循序執行。

完成條件：QA17／QA18 完整回執。現有 17 件 source／processed／public／dist 與回應 hash 全符合，只證明磁碟交付一致性，不證明可從空目錄重建。沒有真手機、GPU timer、精確網路限速時維持對應 UNVERIFIED，不填0或偽造通過。

## 證據使用限制

R24 Browser 使用既有瀏覽器控制工具，Windows 桌面、localhost 無限速。1440×900、390×844、360×800 本輪有走查；1920×1080、768×1024 沿用 R23 僅作歷史參考。完整瀏覽器版本、DPR、WebGL renderer 未從受支持工具取得，未推測填入。自訂 preview 回應設 `Cache-Control: no-store`；它只驗本機 dist 的巢狀路徑與故障，不能代表正式主機 rewrite 配置。

工具截圖可能落後已取得 DOM 一幀：例如 `r24-atonement-4.jpg` 實際可見步驟3，手機 half 圖曾仍顯示收合態。這些原始失敗／過渡畫面保留，但**檔名不是狀態證據，不可拿來宣稱對應步驟通過**。`r24-mobile-360-reading-stable.jpg` 為後續穩定補拍。六器物 ready DOM、HTTP 回應 hash 各自有效，但不能合併推定未記錄的完整 activeAssetIds、相機或每個部件都可見。

vexp 首次呼叫回報每日8/8額度耗盡；後續依規劃文件列出的具名檔案定向讀取，沒有把工具失敗當成功。沒有真人新讀者測試。以上未驗證條件須在下一輪由有效工具與實際操作補齊。
