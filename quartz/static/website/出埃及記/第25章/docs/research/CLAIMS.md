# R01 主張臺帳

建立日期：2026-09-10。這裡列出現行介面已顯示、翻新後必須顯示或明確必須隱藏的可驗證主張。`verified` 只表示來源支持該句的範圍；不等於模型外觀已通過視覺驗收。`unresolved` 可用來向讀者說明未知；`rejected` 不可進入 runtime verified 資料。

欄位：claim ID、網站短句／模型部件、entity ID、來源與精確定位、資料型別、適用時段／分支、核對結論、未知項、對應測試／畫面、狀態。

## 已核准的文字主張

| claim ID | 網站短句／部件 | entity ID | 來源／定位 | 資料型別 | 適用時段／分支 | 核對結論 | 未知項 | 對應測試／畫面 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-EX25-ARK-SPEC | 約櫃以皂莢木製作，長二肘半、寬一肘半、高一肘半；內外包精金，四周有金牙邊 | tabernacle-ark | S-EX25／出25:10–16；S-EX37／出37:1–5 | textual | 出25製作指示 | 可作 verified 尺寸／材料文字；模型木芯只能在明示剖面示意中出現 | 木芯可見比例、金厚度、基路伯具體造型未詳載 | QA03、R08 detail 截圖 | verified |
| C-EX25-ARK-CHERUB | 施恩座兩端有基路伯，翅膀向上、遮掩施恩座，彼此相對 | tabernacle-ark | S-EX25／出25:17–22；S-EX37／出37:6–9 | textual | 出25製作指示 | 支持部件與相對朝向；不把任意臉孔細節標經文明載 | 基路伯比例、材質細節、臉部樣式未詳載 | QA03、QA11 | verified |
| C-EX25-TABLE | 桌以皂莢木製作並包精金，長二肘、寬一肘、高一肘半；有器皿與陳設餅 | shewbread-table | S-EX25／出25:23–30；S-EX37／出37:10–16 | textual | 聖所陳設餅 | 支持尺寸／材料／用途；器皿清單需逐項引用 | 餅的唯一幾何排列、器皿外形未詳載 | QA04、QA14 | verified |
| C-LV24-BREAD | 每安息日擺上十二個餅；祭司在聖處吃換下的餅 | shewbread-table | S-LV24／利24:5–9 | textual | 每週更換分支 | 支持十二個、週期與食用角色／地點；不補烘焙表演 | 摞／行的唯一擺法未詳載 | QA08、QA14 | verified |
| C-EX25-MENORAH | 燈臺用一他連得精金，以一塊錘出；有七盞燈與枝、杯、球、花部件 | lampstand-menorah | S-EX25／出25:31–40；S-EX37／出37:17–24 | textual | 聖所燈臺 | 支持七盞、部件與材料；不要畫成蠟燭 | 高度、枝條弧度、盞的幾何未詳載 | QA05、QA14 | verified |
| C-LV24-LAMP | 燈要用清橄欖油，使燈常常點著；亞倫在會幕中料理燈 | lampstand-menorah | S-EX27／出27:20–21；S-LV24／利24:1–4 | textual | 日常燈臺服事 | 支持油、持續點燈與祭司職責；燈火應與程序／狀態相依 | 「常常」的畫面亮度與實際燃燒動作未詳載 | QA08、R14 | verified |
| C-EX27-BURNT-ALTAR | 燔祭壇為皂莢木，四方長五肘、寬五肘、高三肘，包銅並有四角、網與杠 | burnt-altar | S-EX27／出27:1–8；S-EX38／出38:1–7 | textual | 外院燔祭 | 支持材料、尺寸、部件；壇體 bounds 與附屬物要分開量測 | 網眼、角的幾何與內部細節未詳載 | QA06、QA09、R15 | verified |
| C-EX30-LAVER | 洗濯盆與盆座用於祭司洗手洗腳後進入會幕或就近壇 | copper-laver | S-EX30／出30:17–21；S-EX38／出38:8；S-EX40／出40:30–32 | textual | 日常祭司洗濯 | 支持用途、角色、時機與位置關係；不可加龍頭管路 | 洗濯盆尺寸、形狀與水量未詳載 | QA07、QA13 | verified |
| C-EX30-INCENSE | 香壇為皂莢木包精金，位於法櫃前幔外；早晚燒香 | incense-altar | S-EX30／出30:1–10、34–38；S-EX37／出37:25–29 | textual | 日常獻香 | 支持材料、位置、時間；日常香壇與贖罪日香爐保持兩個 context | 香煙密度、香爐外形與祈禱象徵未詳載 | QA08、QA13、R16 | verified |
| C-EX26-ZONES | 會幕由聖所與至聖所分區，中間有幔子；幔子材料與織製被逐項描述 | tabernacle-main | S-EX26／出26:1–37；S-EX40／出40:20–28 | textual | 空間總覽／教學剖面 | 支持分區與幔子文字；教學相機可觀看不等於角色自由通行 | 未詳載視角、實際採光與遮擋程度 | QA01、QA02、R17 | verified |
| C-EX27-COURT | 院子東面有門，院子長一百肘、寬五十肘、高五肘；帷子與柱座材料分列 | outer-court | S-EX27／出27:9–19 | textual | 外院空間 | 支持比例、東門與材料文字；示意模型需標 reconstructed | 院外營地帳數與人物分布未詳載 | QA01、R06 | verified |
| C-EX28-ROLE-GARMENT | 亞倫及其兒子承擔祭司職分；聖衣包括胸牌、以弗得、外袍、內袍、冠冕與腰帶等部件 | priest／high-priest | S-EX28／出28:1–43；S-EX39／出39:1–31 | textual | 日常祭司／大祭司 context | 支持身份、部件與穿戴情境；人物外貌不能由模型補出 | 身高、臉孔、布料切版與色值未詳載 | QA10、QA15、R11 | verified |
| C-NM-ROLES | 祭司、利未人與指定家族的職分與搬運責任不同 | priest／levite | S-NM03／民3:5–10、25–37；S-NM04／民4全章；S-NM18／民18:1–7 | textual | 搬運／日常職分 | 支持角色分工與區域界線；不能讓所有人物都做同一件事 | 未指派的畫面動作標 actor unspecified | QA10、QA15、R11 | verified |
| C-LV01-BRANCHES | 燔祭按牛、羊／山羊、鳥分成不同供物段落；獻祭者與祭司的動作並不相同 | burnt-offering | S-LV01／利1:1–17 | textual | 牛／羊／鳥分支 | 三條資料分支必須分開；非寫實 cue 仍要說明按手、宰殺、血與焚燒位置 | 未載寫實表演、聲音或鏡頭速度 | QA09、QA15、R15 | verified |
| C-LV02-07-FIVE | 素祭、平安祭、贖罪祭、贖愆祭與燔祭的材料、目的與處理不同 | five-sacrifices | S-LV02–S-LV07／利2–7全章 | textual | 五祭比較 | 可作比較表與各自分支；不得以一條通用流程代替 | 神學延伸與象徵意義需分開標示 | QA15、R15 | verified |
| C-LV16-DAY | 贖罪日包含麻衣準備、牛與兩隻公山羊、拈鬮、香、牛血／羊血、潔淨、活羊、換衣與營外處理 | day-of-atonement | S-LV16／利16:1–34 | textual | 每年一次的特殊程序 | 支持完整步驟與角色／服裝切換；學生是 unrestricted-study 觀察者，不扮演可自由穿幔的角色 | 個別動作的幾何細節、香煙與血點數量未詳載 | QA16、R16 | verified |
| C-EX40-CLOUD-FIRE | 雲彩在帳幕以上，夜間雲中有火，屬設立後的事件描述 | divine-presence-event | S-EX40／出40:34–38 | textual | 對應事件／教學說明 | 只能在事件 context 並標示示意；不能變成整站永久光柱 | 顏色、形狀、亮度與物理行為未詳載 | QA02、R09 | verified |

## 工程／換算主張

| claim ID | 網站短句／部件 | entity ID | 來源／定位 | 資料型別 | 適用時段／分支 | 核對結論 | 未知項 | 對應測試／畫面 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-ENG-CUBIT-45 | 「一肘約45 cm」 | dimension-system | 現行 `DimensionVisualizer.ts`；無指定聖經來源 | engineering-assumption | 所有尺寸換算 | 可作明示的教學換算選項，不能標經文明載 | 肘的歷史長度與不同研究換算未裁定 | QA03、R03 | unresolved |
| C-ENG-LOCAL-BOUNDS | GLB bounds／三角面是工程量測 | asset records | `docs/qa/revamp/BASELINE_ASSETS.json` | engineering-measurement | 資產診斷 | 支持效能與載入比較，不支持歷史比例 | 引擎 transform 後的世界 bounds 需 R12 再量 | QA17、R20 | verified |
| C-ENG-MODEL-RECON | 模型是教學重建，材質／曲線只作視覺示意 | all reconstructed assets | S-ASSET-LICENSE、S-ARCH-THETORAH、各經文來源 | reconstruction-label | 所有模式 | 可顯示 reconstructed 標籤；不把授權或漂亮程度當史實 | 每個未被經文限制的外觀細節保留未知 | QA02、QA11、R18 | verified |

## 必須暫停或拒絕的現行主張

| claim ID | 現行文字／部件 | entity ID | 可查來源 | 核對結論 | 影響任務／QA | 狀態 |
| --- | --- | --- | --- | --- | --- | --- |
| C-REJECT-ARK-WOOD-EXTERIOR | 將約櫃成品主要呈現為裸木外觀 | tabernacle-ark | S-EX25／出25:11–13；S-EX37／出37:2–5 | 與內外包金的文字衝突；木芯只可在明示剖面示意保留 | R08、QA03 | rejected |
| C-REJECT-MENORAH-SIZE | 把燈臺任意高度／寬度寫成經文尺寸 | lampstand-menorah | S-EX25只載一他連得與部件，未載高度 | 沒有核准來源，不得進 verified renderer | R01、R03、QA05 | rejected |
| C-UNRESOLVED-CAMP | 「十二支派帳幕位置」或特定營地數量／格局 | camp-layout | S-NM03等只提供家族／職分片段；參考 PDF 屬 reference-only | 只能標 reconstructed 或移出核心學習；不可稱經文明載 | R01、R09、QA02 | unresolved |
| C-UNRESOLVED-HEBREW | 未回查來源的希伯來字母／音譯 | object labels | 需逐字回查本章有效來源；目前部分硬寫字串未具 receipt | 先移出可見介面，待 R03 evidence | R01、R03、R18 | unresolved |
| C-REJECT-CINEMATIC-FULL | 將八幕中帶省略號的字幕標成完整經文 | tour captions | S-EX27等只能支持指定節範圍；現行 `CinematicTourController.ts` 使用摘要 | 摘要需標摘要，完整引文改由抽取資料提供 | R03、R17、QA17 | rejected |
| C-UNRESOLVED-CHARACTER-MESH | 用通用人物／中世紀服裝直接代表祭司或大祭司 | priest／high-priest | S-EX28、S-EX39支持服飾部件文字，未支持通用模型外觀 | 可作技術基底但需重建標籤與衣裝 claim，不能默認歷史肖像 | R11、QA10、QA16 | unresolved |
| C-REJECT-PERMANENT-SHEKINAH | 永久固定光柱、球形光暈或三角火焰代表神同在 | atmosphere | S-EX40只支持特定雲／火事件 | 移除或限縮到事件 cue，不能用特效代替程序 | R09、R13、QA02 | rejected |

## 內容進入 runtime 的閘門

1. R03 只把 `verified` 且有精確 source locator 的 claim 寫入 evidence JSON。
2. `unresolved` 可進來源抽屜與「經文未詳載」說明，但不能驅動具體歷史外觀或角色權限。
3. `rejected` 不得出現在可見 verified 文案；若保留舊檔，必須在 R22 清理或標成歷史紀錄。
4. 每個 claim 仍需在 R18／R23 以畫面與資料測試抽查；本臺帳本身不替代 GPT-6 R24 的逐項內容審查。
