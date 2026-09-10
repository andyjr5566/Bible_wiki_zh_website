# Luna 逐項工程任務

先讀 [總規格](REVAMP_MASTER.md)、[證據契約](REVAMP_EVIDENCE.md)。本檔案所有任務目前待辦；執行狀態以 [進度檔案](REVAMP_PROGRESS.md) 為準。相依任務必須透過才能進入依賴它的修改。Luna 執行 R00–R23；R24 交 GPT-6。

## 每張卡共用的完成規則

- 所列「新建」是目標交付，目前不保證存在；先核對是否已有等價功能，優先擴充，禁止留下兩個同職責 service。若改路徑，更新本卡與進度，不能讓下一個任務猜名稱。
- 每張卡交付：實際變更檔案、動作與結果、命令／exit code、截圖或資料證據、未解問題與下一張卡 ID。檢查失敗不得標完成；內容與工程檢查各記一次。
- source GLB、raw_scripture、raw_data、研經正文、章節 payload 不可由這些工程卡覆寫。網站自有資料維護依核准的來源臺帳。
- 每次視覺驗收記錄 build／diff hash、profile、activeAssetIds、鏡頭／viewport、資產衍生 hash、光照、時間點。只有 DOM 中寫著約櫃不構成 GLB 載入證據。
- Blender 卡 R07–R12 共用單一寫入者規則。各資產前後圖與量測皆獨立記錄；前一個器物 PASS 不可複製給下一個。
- 網站路徑以下均為專案根相對路徑；命令在網站根執行。`npm run build` 已包含 verify，不需無變更時再連跑 verify/build。

## R00 — 固定工作樹、工具與可重現基準

相依：無。範圍：讀取與基準測量，不修改內容或場景。輸入：總規格、現況檔案、根及路徑上 AGENTS、package.json／lockfile、既存 Git 差異。

步驟：
1. 記 `git status --short`；對本站當前 tracked 差異及 untracked 新資產建立清單／hash。與約書亞記、根 AGENTS 分開；不 reset 或清理他人產物。
2. 記實際模型（若介面不提供就標未能確認）、Node/npm、Blender 與 addon／MCP、Browser 可用性。Luna 模型未成功呼叫不得宣稱已測。
3. Blender 只呼叫 get_scene_info；記目前檔名、dirty state、物件。無法得知已儲存狀態時，不清空原場景，改獨立 background process。先另存工作副本並記錄 path，再做後續卡。
4. 查 node_modules 與 lockfile；已可用不重灌。需要乾淨重灌才用 npm ci。跑一次 `npm run build`，保留 stdout、stderr、exit code。
5. 用 `npm run preview` 依輸出網址測試；指定埠需依本機 shell 正確傳參，可直接 `npx vite preview --host 127.0.0.1 --port 4173`。Browser 不能連 localhost 才用已查到的 LAN 位址／tunnel，記原因。
6. 拍首頁、完整會幕約櫃、框架中的獨立約櫃、六器物、儀式入口與手機基準。確認實際 profile／asset IDs；沒有工具就記缺口，不重用昨天圖片作本日量測。
7. 記每 GLB bytes／三角面／材質／貼圖／bounds；按驗收檔案記三次冷載入與 frame interval 基準，無法量測的部分標未驗證。

交付：新建 `docs/qa/revamp/BASELINE.md`、baseline 截圖與計量 JSON；更新進度 R00。驗收：baseline 連到確切 worktree 與證據；工具限制清楚；網站已能測或具體記錄既存失敗。沒有能驗證模型的 Browser 不可宣稱視覺 PASS。

## R01 — 建立來源／主張臺帳，隔離無依據內容

相依：R00。範圍：本站研究與資料稽核，暫不改模型。輸入：REVAMP_EVIDENCE、正式經文、既有研究／授權資料、ExperiencePanel／CINEMATIC_ACTS／DimensionVisualizer／JSON。

步驟：
1. 建 `docs/research/SOURCES.md`、`CLAIMS.md`，欄位逐項遵守證據契約。把可見尺寸、材料、原文、身份、程序、位置、營地、特效、重量逐項列入。
2. 核對出25／26／27／28／30／37–40、利1–7／16／24、民3／4／18等實際用到的段落。每來源記 path＋節範圍＋hash；先確認 raw 每行是否一節。
3. 對現行香壇原文字串、燈臺任意尺寸、肘／他連得換算、純金約櫃簡稱、光柱與營地聲稱分別判定。未有來源的值不得進 verified 臺帳。
4. 讀使用者 PDF／PPTX，記用途與頁碼；圖片若疑為生成圖只列視覺參考。對已存在的研究 URL 實際開啟，追原始文獻，至少建立一個有內容的考古比較條目。
5. 建「可以修正／暫停顯示／需總控」表；無依據但非核心的欄位可先不顯示，不能用漂亮替代說法掩蓋。

交付：來源臺帳、主張臺帳、逐項缺口與研究定位。驗收：每個預定可見事實有已讀來源；考古年代／比較界線明確；缺證據不會自動進入下一卡的正式資料。未知造型保留未知，不能以標 reconstructed 合法化任意造型。

## R02 — 編排角色、儀式及分支內容契約

相依：R01。範圍：資料草案與語義順序，不啟動動畫。輸入：已核對來源、現有 rituals／characters／scriptures、證據檔案的程序表格式。

步驟：
1. 建 `docs/research/RITUAL_STEPS.md`、`ROLE_ACCESS.md`、`GARMENTS.md`。覆蓋六核心程序與利1–7五祭；保留現有可用 ID。
2. 每個程序拆 action／角色／空間／引用；把牛、羊、鳥及其他規定分支分開。經文未指定角色，標 actor unspecified；不自動填 serving-priest。
3. 贖罪日完整讀利16，把準備麻衣、抽籤、牛／羊、香、血、潔淨、活羊、離開／換衣、營外分段；記經文間的先後，不能憑喜好重排。
4. 標普通獻祭者、祭司、大祭司、利未人及指定人員的責任與區域。教學鏡頭另有 unrestricted-study 標示，不給角色同等通行權。
5. 服飾記每部件來源／使用情境／未定形狀；明確贖罪日麻衣與其他大祭司衣裝的切換。人物面貌不是史料，不製作可識別的亞倫肖像。
6. 每段附「初學者應知道什麼」與可觀察的完成問題；把神學詮釋和動作／位置分開。

交付：完整程序／分支表、角色權限矩陣、服飾規格，所有行帶 claim IDs。驗收：無單步 placeholder 序列；無遺漏關鍵角色／血／食用或處理去向的內容；未能確定項目交總控，不能靠動畫補完。R13–R16 只實作此資料。

## R03 — 統一資料契約與正式經文抽取

相依：R01、R02。範圍：data/types/schema/資料驗證，不做 UI 美化。輸入：R01/R02臺帳、loadProjectData、現有型別及所有 consumers。

步驟：
1. 新增 `src/data/evidence.json`、`src/data/object-details.json`、`src/data/tours.json`，對應 schemas 與 types；若合併等價資料，記入進度真實位置。現有 asset IDs 不任意改名。
2. evidence 區分 source、claim、reviewStatus、evidenceKind、reference/locator、limits。object-details 持有器具短介、尺寸與單位／換算假設、材料、parts、claim IDs；tours 只引用資料 ID，禁止再存一份經文字文。
3. 擴充 ritual step：branch、actorRole、locationId、garmentState、actionClaimIds、可回復 displayCue、前後 step IDs；確保 schema／type／loader／controller 都遷移。
4. 新建 `scripts/build-scripture-excerpts.mjs`：由指定庫根 raw_scripture 抽取 verses；根路徑由參數或可推導 repo root 得到，不寫死使用者目錄。保留文字與版本，記 source hash；先寫暫存輸出再驗證／替換。節數不符、範圍越界或缺檔即失敗。
5. 搬走 ExperiencePanel 的 objectMeta／tourDescriptions、CINEMATIC_ACTS 的 scriptureText 及 DimensionVisualizer 中尺寸。UI 只接 typed view models；摘要不標完整和合本。
6. 修 ProjectData.test 的重複 ID 檢查：對原陣列檢查，不先 Set。新增有意重複／缺來源／缺step引用／未核准claim的負例；測引文抽取越界與未詳載尺寸不能被數值化。

交付：資料契約、遷移紀錄、抽取腳本、新測試。驗收：typecheck/test PASS；故意損壞 fixture 確實失敗；所有 renderer 用同一份正文／尺寸，未 verified 歷史值無法進可見渲染。新 UI 不要求即時呼叫外部 Bible API。

## R04 — 建立清楚的導覽入口與單一播放狀態

相依：R03。範圍：AppPort、types/experience/ui、UIStateManager、AppKernel、面板骨架。輸入：總規格體驗表、舊三模式與播放 controllers。

步驟：
1. 頂層模式明確使用 overview／tour／learning／ritual，對應探索／空間導覽／器物／獻祭與服事。來源、地圖、設定使用 overlay，不另造競爭模式。
2. 定義閱讀脈絡：mode、selectedObject、selectedRitual／branch／step、overlay、playbackOwner、previousContext。保留 UIStateManager 單一寫入入口。
3. 所有自動相機只由 playbackOwner 控制；啟動另一程序先停止或暫停前者；不讓 UI 自行改 Three.js。
4. 返回儲存原選取、相機、profile、剖面、單位、播放暫停狀態。瀏覽器 back 若支援深連結，需有受測解析，不直接存 DOM 狀態。
5. 改入口文案與 aria label，去掉「電影級」重複啟動；暫留未接好的部分僅在開發狀態，不交付無功能按鈕。

交付：單一狀態契約、可操作四入口骨架、模式轉換測試。驗收：任意模式到另一模式再返回不殘留舊播放器；手動拖曳暫停；取消播放仍能繼續操作。

## R05 — 修復真正的器具特寫與非同步載入生命週期

相依：R04。範圍：AssetRuntimeManager／AssetLoader／manifest profile 契約及 AppKernel，無模型修改。輸入：B09/B11、現有 loader tests。

步驟：
1. 點任意器物即要求對應 detail，AppKernel 不再只在使用者手動選 framework 才載入。保留主模型既存內建器物但特寫時隔離展示，防重複疊模；退出回原 overview/profile。
2. 把詳細模式表示為明確的 runtime 請求／狀態，沿用 loader；必要時擴充 presentation state，不靠「現在是假裝框架」的副作用。
3. 每次 detail selection 建獨立 generation/token。A→B 快切，A 遲到時不可掛回或改 B 的 ready/error；profile revision 與 detail token 各自驗證。
4. loader unload/dispose 對 pending 可取消，即使尚未 mounted 也能停止／丟棄結果；同資產共享請求的取消規則明定，不讓一個 consumer 取消另一個仍需要的資產。
5. 載入中保持可讀狀態，失敗給重試／回總覽／使用者明選備援。沒有 textures/geometry 不顯示 ready。
6. 提供只在開發／QA啟用的診斷：profile、selected asset、activeAssetIds、pending IDs、load status、rendered resource version。不得在產品面板顯示技術名詞。

交付：可靠 detail pipeline、受控 promise 延遲／失敗／dispose 測試、診斷契約。驗收：故意讓 A 晚回、A失敗、切profile、關閉期間完成的情境都不汙染當前場景；獨立GLB真載入並可核對，不以截圖外觀推定。

## R06 — 世界、部件、剖面與取景統一

相依：R05。範圍：WorldAlignment、CameraManager、DimensionVisualizer、ObjectRegistry、asset node mapping。輸入：目前六器物 transforms、R03尺寸、R00 GLB實測。

步驟：
1. 設完整body bounds、含槓bounds、camera bounds三者用途；尺線測器物本體，鏡頭包含可見槓。比較hero與獨立模型錨點，不照舊常數當正確。
2. 查各 GLB 階層，建立 version/hash 繫結的 explicit part-node map（可新建 `src/data/asset-parts.json`）。別用 plane/tube/root 模糊名字批次隱藏所有疑似結構。
3. 尺度按已批准肘換算處理；未知尺寸明標模型示意大小，不能自動派一個經文值。從一份資料驅動模型、文字、尺寸線與平面圖。
4. perspective framing 同時計算水平/垂直FOV與可用畫布區域；扣除桌面側欄／手機drawer，留不少於5%安全邊。旋轉後重設依同一bounds計算。
5. 進出剖面只改核准shell parts，儲存並恢復visible、opacity、depthWrite等，detail保持實體。剖面標籤始終可見。
6. 將點選高亮／鏡頭／文字錨點對齊；mesh ID失配硬報錯並保持完整外觀，不靜默藏錯物件。

交付：part map、校準圖、鏡位／剖面邏輯與tests。驗收：Y-up／東+Z／至聖所-Z，hero/detail/平面圖同位；390×844與1440×900預設完整特寫不裁主要部件；隱藏→恢復連續10次一致。

## R07 — 建立安全且完整的 Blender 重建流程

相依：R03、R06。範圍：`scripts/blender/`、獨立工作scene、資產處理入口。輸入：原source、來源臺帳、part map。

步驟：
1. 修舊 build_ark_detail 的絕對路徑與clear_scene。腳本接受輸入／staging輸出／config；`__file__`僅用來推導預設根，MCP exec 必提供等價腳本路徑。使用者scene另存後只作切換，不改原物件。
2. 每件工作在自有collection／獨立 .blend；記錄source hash、Blender版本、材質參數、units、軸向、原點。重複執行不會追加 .001 物件或材質。
3. 處理拆成 inspect→build→export-to-staging→optimize→reimport-check→promote。未驗證的GLB不得先覆蓋public；所有promote的檔案清單可預覽。
4. 保留製作 .blend 和可執行 Python／config；建立固定正、側、上、近景相機與標準光照，輸出前後圖。
5. 同一入口串接現有glTF Transform最佳化；不要先執行原始批次process又覆蓋手工材質。無需新 decoder 的量化可沿用；新增壓縮擴充套件必須同時實現decoder與比較。

交付：新 `scripts/blender/README.md`、安全腳本／config／staging流程、可重現命令。驗收：乾淨工作scene連跑兩次，物件數／bounds／材質一致；重開blend無遺失資源；來源hash不變，使用者原scene可恢復。

## R08 — 約櫃成品與教學剖面修正

相依：R07、R01核准的約櫃claims。範圍：約櫃這一個資產，序列化寫入。輸入：出25:10–22、出37:1–9、source GLB、舊材質／截圖、R06 parts。

步驟：
1. 建部件表：櫃體、施恩座、二基路伯、四環、二槓；核對source實際島與區域性坐標，不沿用 `abs(polygon.center.x)<0.5` 當語義正確。
2. 成品外觀恢復有金包覆的櫃體／槓；木芯只在有標示的分層示意顯示，不能一鍵剖面讓人以為古物原貌是裸木。
3. 檢查兩基路伯方向／翅膀遮掩、槓與環連線、尺寸。未有來源的臉／羽毛／裝飾削弱到剋制示意，不補幻想造型。
4. 以材質的粗糙度、細微色差、照明留住金表面輪廓；不用木色區分本應金包覆的面。固定光照對比，移除經文未明說的鏽蝕、泥土和磨損故事。
5. 依R07匯出，R05真正載入detail並截圖；核對visible resource hash與Blender產物。舊ark-improved圖列歷史，不再當完成基準。

交付：修正.blend／config／GLB、成品/剖面四檢視、瀏覽器對比、claim-to-part表。驗收：成品符合包金說明；剖面有示意標籤；無主要部件裁切；source hash及授權保留。未知細節不宣稱考古還原。

## R09 — 完整會幕、覆蓋層與照明翻新

相依：R07、R08。範圍：hero/framework可讀性、地形背景、ParticleEffects／DesertEnvironment。輸入：出26／27／40核對、原模型、part map。

步驟：
1. 逐層核對入口簾、內幔、架構、罩棚、外院；按核准部件分組，外觀/剖面只切該組；缺失構造要記原因再補，有正確的保留。
2. 校準hero與framework尺度、位置與內部器具。缺資料的精確間距僅作示意，不印真實尺寸。
3. 標準閱讀光照用穩定環境／主輔光；先中性材質標樣校準，再測金銅，不能把材質壓黑來抵銷光柱造成的白屏。
4. 移除預設Shekinah圓球／光柱與用粗錐體呈現的火；對應事件的煙／火僅由R13/R16確定的cue觸發。把神學意象當神聖特效的舊程式碼退役。
5. 遠景營地／地形降為低干擾背景；沒有證據就不標真實山形、帳篷數量、具體族群營位。營地來源不足時用中性背景，產品說明保持準確。
6. 重新檢查三氣氛的必要性；預設一種清楚光照，保留的其它氣氛全部迴歸，未校準選項移除，不留下按鈕。

交付：hero/framework衍生與材質配置（有改則交付）、剖面組、精簡燈光／effects、前後截圖。驗收：從總覽進入室內仍可辨材料與輪廓、無地板洗白／閃爍；預設無無據神聖光柱；剖面恢復正確，不重複器物。

## R10 — 其餘五件器物與小器具

相依：R07、R09。範圍：五件獨立器物，按下列順序一個接一個完成。輸入：R01/R03規格、各source、R06map。

步驟：
1. 燔祭壇：核銅包覆、角、網與配套器具；本體與抬槓bounds分開。配套器具僅在有對應claim及程序需要時加。
2. 洗濯盆：核盆／座／位置；未詳載尺寸保持未知，不能以source的現代水龍頭或裝飾當聖經要求。
3. 香壇：核一肘／一肘／二肘、金包覆、角與抬槓；和燔祭壇的用途／材質標籤區別。
4. 金燈臺：核七盞、接連錘成與杯球花；無經文高度；不要做成九枝、現代蠟燭或把後世聖殿形制當唯一樣式。
5. 陳設餅桌：核包金、尺寸、器皿、餅的數量與R02擺列選擇；「行／摞」的不確定以來源說明保留。
6. 每件：先inspect與claim-to-part→處理→標準四檢視→staging GLB→reimport→真detail網頁畫面→寫測量。一個失敗記錄受影響卡，不復制其他器物PASS。

交付：五套blend／config／GLB及必要道具、每件獨立 evidence。驗收：五件全部過素材/尺寸/方向/材質/無裁切；六器物互切已能看見不同對應模型，來源署名不丟。

## R11 — 角色、服飾與必要牲畜

相依：R02、R07、R10。範圍：角色可辨識、來源允許的服飾，必要動物/道具。輸入：GARMENTS/ROLE_ACCESS、既有可用technical-base。

步驟：
1. 先查rig／license／model內容。中古衣物、現代裝飾／鞋／帽不能原樣標為古以色列祭司；只保留允許複用的topology／rig。
2. 依證據建立普通祭司衣裝、大祭司衣裝、贖罪日麻衣三種狀態。每部件記錄claimed材料／數量／功能與未知剪裁；面孔用低細節教學重建，標籤不稱復原亞倫本人。
3. 用來源明確的部件建立可檢視的服飾說明；未獲證據的寶石品種/RGB、服裝動作或裝飾不憑想象補齊。
4. 人物動作以角色站位、方向、物件高亮、持具提示為主。沒有動作細節就不加寫實動作；可使用明確「角色位置示意」的標記，但必須保留完整誰做什麼的步驟，且不能把已批准服飾建模任務全部省略。
5. 檢查sheep/cow/bull是否符合所選branch性別／種類。山羊或鳥沒有合法合適mesh，使用清楚標字的示意符號或依據核准形態另建低細節模型，不冒充牛羊；記錄媒體限制，不吞掉分支內容。
6. bind skeleton、離地高度、手中道具掛點、隱藏/銷燬、衣裝切換。正常站立與路徑不穿壇／幔／器物；步態細節不是史實。

交付：角色/服飾衍生、role/costume配置、必要動物／道具與符號、來源與授權記錄、角色展示頁或測試場景。驗收：角色身份、職責、衣裝能區分；麻衣用於正確步驟；通用模型不被誤稱歷史復原；每個展示part可追溯。

## R12 — 資產匯出、promote、manifest 與重現驗收

相依：R08–R11。範圍：所有本批衍生資產與部署必需副本。輸入：staging、腳本、manifest、process腳本。

步驟：
1. 對每件記錄sourceHash、derivedHash、bytes、triangles、GPU upload估計、materials/textures/bounds、nodeMap版本、Blender/最佳化工具版本。
2. 重新匯入GLB，驗證必要part、正確軸向／單位、貼圖／動畫。未知擴充套件不直接放入production；decoder與license齊全才接入。
3. 同步typed/public manifest與ASSETS；舊sha256欄位仍指sourceFile。derivedHash另存明確欄位/sidecar，不能偷換source hash語義。
4. 確認 `process:assets` 不會重新從未經改造source覆蓋本批產物。未修改資產沿原流程；已改資產走已註冊的recipe，單一入口可重跑。
5. public僅放runtime需要的資產；blend/Python/未使用source不復制dist。去除本批空臨時/舊blend備份前驗證原檔已儲存、路徑限制在專案。
6. 對相同輸入重建，語義指標一致；若GLB二進位制含非確定metadata影響hash，記錄原因，不用hash不同證明幾何錯誤或相同證明內容正確。

交付：資產報告、promote清單、manifest、處理檔案。驗收：verify:assets exit0，所有source hash不變，公共與processed對應；全新工作目錄按README能重建；沒有兩條腳本互相覆蓋。

## R13 — 通用程序播放器與洗濯／獻香

相依：R04–R06、R12。範圍：RitualPlaybackController／RitualVisualSystem／角色runtime與儀式面板。輸入：R02/R03程序資料、R11資源。

步驟：
1. 播放器提供選擇branch、開始、上一/下一步、暫停/繼續、重播、退出；每步snapshot由資料計算，seek可確定重建狀態，不累加粒子。
2. 當前步同時驅動角色／區域高亮、鏡頭、器具、文字、來源與服飾；副作用從controller hooks進入visual adapter，不硬編碼story在UI。
3. 洗濯按R02顯示服務條件、執行者、盆、手腳與後續路徑。不要虛構龍頭操作或固定水量。
4. 日常獻香依R02區分時段、燈盞關聯與香壇；利16的幔內香爐留到贖罪日。已存在puff不能當完整流程。
5. 退出時清粒子/人物/選取高亮，恢復原context。讀經彈窗暫停自動鏡頭，關閉不自動搶走輸入焦點。

交付：通用播放系統、兩程序端到端交付、步驟遷移/暫停/seek/退出測試。驗收：每個step都可向前向後並顯示正確來源與物件；暫停無位置/時間漂移，重播不翻倍粒子；非支援ID不可靜默no-op。

## R14 — 燈臺與陳設餅服事

相依：R13。範圍：兩個程序的資料和cue適配。輸入：R02的出27／利24規則、R10器物、R11角色。

步驟：
1. 燈臺：依資料呈現油、燈盞、服事時段／角色；燈火與所選步相依，不能全場永久蠟燭。
2. 餅桌：顯示十二餅、經文兩行/摞、乳香、每安息日更換及食用者／地點；不編造日常烘焙表演。
3. 複用通用播放器，新增cue前登記並測試；不另造「燈臺播放器」全域性狀態。
4. 每程序設定完成問題，引導讀者從3D熱點回對應經文；不加經文以外的象徵意義標準答案。

交付：兩程序完整資料、step snapshots與網頁證據。驗收：兩個程序從入口可選、每步展示/返回/來源可用，已知計數與時段正確，不遺漏後半段處理。

## R15 — 燔祭及五祭分支教學

相依：R13、R14。範圍：獻祭流程、分支與比較介面。輸入：R02核准利1–7、角色／動物／器具。

步驟：
1. 燔祭先由使用者選牛／羊／鳥；每分支只跑自己的經文鏈，角色／位置／處置不同必須可見。
2. 展示獻祭者與祭司的分工；按手、宰殺、血的處理、分塊／清洗／焚燒用非寫實標記及準確文字，不全部改寫成祭司點火。
3. 建五祭比較：每行可點對應程序，顯示材料、目的說明出處、行動者、地點、處理/可食範圍。利4等分不同身份／情況，資料分支不能被總稱吃掉。
4. 3D區域高亮與程序步驟共用R13，沒有可用道具mesh時顯示命名符號並留完整說明；不給未證實的儀式補禱文。
5. 在比較和程序之間來回保留選擇。五祭基礎閱讀與有來源的步驟都交付，不把除燔祭以外全部寫成「未來再補」。

交付：五祭資料、燔祭三分支、比較/程序介面、role/location/branch fixtures。驗收：每分支可走到完成並回退；不會把羊支北側規則套給牛/鳥；不把所有祭牲全焚燒當五祭共同規則；血/食用/處理敘述可追溯。

## R16 — 贖罪日完整教學路徑

相依：R13、R15。範圍：贖罪日特殊程序、衣裝與出入限制。輸入：R02核准利16全章與ROLE_ACCESS。

步驟：
1. 開場先區分這項年度特殊禮儀與日常服事；學生以研讀視角觀看，不扮演能任意穿幔子的祭司。
2. 按核准steps展現準備／麻衣、牛與兩羊、抽籤分工、香菸、牛/羊血、潔淨、活羊、退出換衣與營外，引用不可只掛一整章掩蓋分段錯誤。
3. 角色被約束在允許區域；經文規定其他人不在場的階段，資料與畫面同步移除其他人，不留ambient NPC。
4. 香菸依步驟顯現，不能複用永久聖光；教學血點用剋制標記，細節數量／位置按claim而定。
5. 用branch/step snapshot重建麻衣/其他服裝、人物位置、visible物件；暫停、回退、跳步、結束一致，不能只在向前播放時正確。
6. 末尾解釋年度條件與程序完成，檢查沒有「只穿越幔子一次」或讓普通獻祭者在約櫃邊獻燔祭的暗示。

交付：完整贖罪日序列、訪問/衣裝/排他狀態tests、關鍵步驟截圖與經文連結。驗收：R02每行都有runtime呈現證據；所有進入與退出、香／血、兩羊功能、服裝情境正確；一項關鍵未明不能標整程序完成。

## R17 — 空間導覽、自動運鏡與經文同步

相依：R06、R12、R16。範圍：五站、八幕舊內容整合、鏡頭腳本、字幕。輸入：tours資料、R03經文、R04owner與R06取景。

步驟：
1. 五站保留東門→燔祭壇→洗濯盆→聖所→至聖所。聖所站提供三器物依序可選，導覽路徑是教學選擇，不宣稱普通人禮儀動線。
2. 自動導覽是同一tour資料的播放模式，不保留另一份八幕重複經文。可保留有效鏡頭作為每站子鏡頭，轉移到tours後刪除控制器內的故事文字。
3. 字幕與完整引文共用source引用；引用省略需標節錄，摘要另標摘要。出25逐節研讀提供真實段落結構，不虛稱八幕覆蓋全部經文。
4. 自動運鏡避開牆/道具、門檻及遮擋；拆開教學剖面與穿越角色的感覺。手動操作、開啟面板或reduced-motion時暫停或立即取景。
5. 上/下一站、重播、退出、從器物轉入相關儀式均保留context；音訊不自動開始。

交付：統一導覽資料／controller、可操作五站與自動播放、字幕/內容fixtures。驗收：完整五站往返；自動暫停/速度/恢復/退出不衝突；切模式無舊鏡頭繼續移動；螢幕字幕與當前熱點一致。

## R18 — 器物、部件與來源閱讀介面

相依：R03、R10、R17。範圍：可讀詳情、3D hot spots、證據drawer、來源／署名。輸入：object-details/evidence、part map。

步驟：
1. 六器物詳情統一為短介→用途/角色/位置→可點部件→尺寸/材質→相關程序→經文/考古比較。不要堆9段正文佔滿首屏。
2. 點部件高亮同一3D part，雙向同步列表，點空白取消；看不到的背面部件可透過列表取景，canvas點選與拖曳區分。
3. 每尺寸說明明載肘／換算選擇／未詳載，質量單位不放進長度欄。成品/剖面切換要有持續可見標籤。
4. evidence drawer顯示精確引文、來源型別／年代／範圍、重建未知，不把「經文明載」徽章貼整模。網頁可以顯示核准的外部來源連結；舊「不給連結」歷史策略已被本輪可追溯目標取代。
5. 模型署名與內容來源分區。完全離線網路環境仍能讀已附經文與source摘要；外鏈失敗不影響程序。
6. 原文欄位只在來源已確認時顯示，正確RTL/字型；移除缺證據字串。所有外部資料按純文字或安全富文字渲染，禁止未清理innerHTML。

交付：六器物閱讀卡、part熱點、來源drawer、經文檢索/按引用定位、署名頁。驗收：每可見事實至少一個核準claim，抽查點選能到精確來源；沒有假希伯來字母或大段無來源文案；source與license不混淆。

## R19 — 桌面／手機可用性與可及性

相依：R18。範圍：CSS、元件佈局、鍵盤/觸控/閱讀替代。輸入：四入口、所有面板/播放器、驗收視口。

步驟：
1. 桌面內容面板有固定最大寬與獨立滾動，主要按鈕一直可見。手機底部抽屜設收合/半展/閱讀狀態，每狀態都通知R06重算可用畫布。
2. 390×844、360×800、768×1024、1440×900測完整流程；放大字級200%後內容可滾動不遮下一步；橫向也要可返回。
3. 圖示按鈕有中文名稱／焦點輪廓，目標區域至少44 CSS px；鍵盤能走所有核心入口/步驟/關閉/返回，Escape只關閉頂層overlay並恢復焦點。
4. Canvas有同等功能的器物列表、程序文字與方點陣圖；不以顏色單獨區分角色、區域、來源狀態。
5. 移除未接入的WASD/E/靠近檢視提示；若保留快捷鍵則實現並說明，不用舊InputManager測試假證實。
6. reduced-motion禁自動飛行與非必要粒子；暫停/靜音可見；空狀態與載入狀態也可讀。

交付：響應式／鍵盤／觸控修正、視口截圖、手動可及性記錄。驗收：核心任務完全不用滑鼠也能閱讀操作；手機主要模型不被面板蓋住，無正文橫向溢位；抽屜展開/收合不丟選取。

## R20 — 效能、載入與診斷

相依：R19。範圍：效能量測與有證據的最佳化，不刪核心功能湊FPS。輸入：R00基準、R12資產、R05診斷。

步驟：
1. 依驗收檔案記錄裝置、GPU/WebGL資訊、viewport/DPR、browser、profile、快取、網路設定與build hash；不能把requestAnimationFrame間隔稱真實GPU耗時。
2. 對hero、六detail、複雜贖罪日片段分別三次測first-useful-frame/load、60秒frame intervals中位數/p95、long tasks、render calls、triangles、texture/geometry數量。
3. 單件視覺修正與R00同裝置同鏡位比較；新增功能另列絕對預算，不用新舊不同場景百分比湊PASS。
4. 查bundle、懶載入、陰影投射、畫素比、紋理、instancing與dispose。未顯示library不預載；重複共享資源以ownership策略釋放，離開場景無持續增長。
5. 阻斷/延遲某GLB測重試與備援；真實網路請求狀態與runtime狀態記錄，expected故障與正常執行失敗分開統計。
6. 隱藏除錯面板預設關；可匯出QA JSON，記錄loaded URL/hash及source-of-truth狀態。不把它作為面向初學者功能。

交付：`docs/qa/revamp/PERFORMANCE.md`與原始量測JSON、必要最佳化。驗收：達到驗收文預算；如工具不能量測，準確列未驗證交總控，不標效能PASS；正常資產失敗0，故障可恢復。

## R21 — 有效的自動回歸與失敗恢復

相依：R20。範圍：必要測試、validation scripts與無效狀態處理。輸入：所有新契約與缺陷fixtures。

步驟：
1. 資料：原陣列duplicate、dangling claim/source/part/step/role、未經審查內容、經文範圍/文字hash、未知尺寸、branch reachability。
2. runtime：detail亂序/失敗/取消/dispose、profile切換、剖面恢復、相機受可用畫布影響、owner搶佔與退出、所有程序seek/暫停。
3. 語義fixture：贖罪日衣裝/禁入、燔祭不同branch/actor、十二餅與七盞；fixture由已核准claim編寫，不用從同一實現算expected值。
4. 用瀏覽器驗證真實DOM和WebGL資源；自動工具支援時建立可執行browser smoke腳本，否則提交完整手動案例與證據，不偽造e2e命令。
5. WebGL不支援/上下文丟失、網路錯誤、內容缺失時保留可讀學習資料、重試/返回；不顯示永久loading或整個白屏。

交付：測試/驗證器與故障演練報告。驗收：負例確實能讓相應gate失敗；unit tests與browser各覆蓋其邊界；不靠刪除斷言、放寬schema、隱藏console來透過。

## R22 — 移除過時程序與檔案，整理交付面

相依：R21。範圍：已證實未用的舊runtime、重複內容、臨時產物與docs；保留來源資產。輸入：import graph、vexp impact（可用時）、package scripts、文件登記。

步驟：
1. 查 Walking/player/input/collision/map舊路徑是否真實被main→AppKernel依賴；只有「無產品需求且無活躍呼叫」才移除。MiniMap/無障礙鍵盤屬於真實需求時保留正確部分。
2. 刪除已遷移的硬寫objectMeta、舊CINEMATIC_ACTS經文、重複尺寸、舊placeholder火/角色；刪除對應只驗證退役功能的tests，不刪除新行為迴歸。
3. 核對README/ARCHITECTURE/RITUALS/ASSET_STRATEGY/3D_PIPELINE/DEPLOYMENT與實際命令/型別相符；把本輪橋接頁寫成現行實現說明。
4. 檢查所有活躍Markdown本地links，包括已刪除QA_FINAL/REBUILD_PLAN/TERRA_HANDOFF入口；archive為歷史不執行其舊命令。不要追源文獻目錄遞迴清空。
5. 按明確清單清本批空檔案、staging和多餘.blend1；保留可重現blend/config、必要源與證據。僅在已核對的本站絕對路徑刪除。

交付：刪除清單/用途判斷、更新docs/腳本、活躍檔案無死鏈報告。驗收：無第二套任務入口、無舊假功能提示、無重複事實源；原始模型／研究資料／授權完整；build依賴未破壞。

## R23 — Production 驗收、學習檢查與 Luna 交接

相依：R22。範圍：完整最終驗證與交付包，不拓展新功能。輸入：驗收檔案所有案例、現行diff與全部receipts。

步驟：
1. 執行 `npm run build`（含verify），儲存exit code。此前已透過但程式碼有新變化必須重跑；沒有變化不反覆全跑。
2. production preview逐項走QA01–QA18；桌面與手機均測，儲存指定場景截圖／runtime診斷／資產請求記錄。
3. 用驗證文字抽取腳本檢查最終引用，核對所有可見claim。核實所有原始source hashes、source/processed/public、署名和版本。
4. 驗證巢狀路徑靜態部署預覽（含中文路徑）、重新整理與asset URLs；不釋出。dist不包含source/blend/不必要研究資源。
5. 執行初學者學習檢查；自動走查僅記scripted，若沒有真實新讀者參與就明確未做，不能編造使用者反饋。
6. 彙總`docs/qa/revamp/FINAL_REPORT.md`：每任務/QA編號→證據，build hash、改動清單、已知限制、恢復方案。把R00–R23標待總控驗收，給出R24下一步。

交付：可執行production產物、完整來源／Blender／程式碼／QA包。驗收：所有強制QA有結果，所有核心功能完整；未驗證指標與內容爭議單列，不能以歷史PASS結案。Luna不代替GPT-6做最終批准。

## R24 — GPT-6 最終整合與來源審查

相依：R23。範圍：只由GPT-6總控執行最終審查及必要修正。輸入：全部來源與QA、實際worktree/diff、真網站與模型、原始使用者目標。

步驟：
1. 先將完成視為未證明，逐項核對總規格五個入口、六程序/五祭、六器物、角色與史實界線、Blender可重現、響應/效能/失敗恢復。
2. 查真實rendered資產hash/profile，不再將hero內部約櫃截圖當detail成果。用固定鏡位對比，材質與文字必須一致。
3. 對全部核心程序角色/順序/服裝/區域及事實性影象查claim源；抽樣只能輔助，不能替代每個關鍵步驟。處理所有material unresolved。
4. 發現工程問題可點狀修；需Luna返工則寫任務ID＋檔案＋重現條件＋預期＋相關QA，僅複測實際受影響範圍。
5. 最終狀態只用透過／需修改／未驗證三類，列具體內容。沒有新改動或未解疑慮不重複全部測試。

交付：FINAL_REPORT的總控結論、必要修正、剩餘限制。驗收：明確使用者目標的所有必需項已實現且有證據，才可宣告整站成熟化完成。純規劃交付和Luna自驗透過都不替代此關。
