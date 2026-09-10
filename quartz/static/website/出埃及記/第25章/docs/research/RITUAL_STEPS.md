# R02 程序與分支規格

本文件把六個核心程序拆成可以停下閱讀的步驟，並補上利未記五祭比較。每列的 `actionClaimIds` 必須在 [CLAIMS.md](CLAIMS.md) 找到同名 claim；鏡頭只是教學示意，不能把未詳載的動作補成歷史事實。`locationId` 沿用現有資料 ID；`camp-outside`、`wilderness-route`、`camp-assembly` 是 R03 必須加入並驗證的資料 ID。

## 共用資料規則

- `branchId` 不可省略。牛、羊／山羊、鳥是燔祭的三條分支；利未記五祭也各自保留，不串成一條「獻祭」動畫。
- `actorRole` 用角色職責，不直接填模型名稱。經文沒有指派某人的地方使用 `actor-unspecified`，不可自動改成祭司。
- `displayCue` 只描述非寫實位置標記、文字或高亮；血、火、焚燒與宰殺按文字呈現，不以戲劇效果替代。
- `nextStepIds` 是資料依賴，不是強迫讀者只能自動播放的路徑；每步必須可退回、暫停與重讀。
- `garmentState` 只列來源確定的情境：`daily-priest`、`daily-high-priest`、`atonement-linen`、`post-atonement-garments`、`unspecified`。

## 核心程序一：祭司洗濯

觸發：點選 `laver` 或從外院教學入口進入。來源只說祭司在盆中洗手洗腳，以便進會幕或就近壇；沒有尺寸、龍頭或管路資料。

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| washing-approach | washing-daily | priest | laver-location | laver | C-EX30-LAVER | 出30:17–21；出40:30–32 | daily-priest | washing-hands-feet | 高亮盆與盆座，顯示「會幕與壇的中間」 | 水量、盆形未詳載 |
| washing-hands-feet | washing-daily | priest | laver-location | laver | C-EX30-LAVER | 出30:18–21；出40:31 | daily-priest | washing-proceed | 以兩個非寫實標記指出手與腳；不播放寫實身體動畫 | 未詳載洗濯順序與時間長度 |
| washing-proceed | washing-daily | priest | laver-location | laver,burnt-altar | C-EX30-LAVER | 出30:20–21；出40:32 | daily-priest | — | 將可前往的教學熱點限於壇前／會幕入口，不讓角色走入未授權區域 | 個別服事路線未詳載 |

## 核心程序二：燈臺服事

觸發：點選 `menorah`。出27與利24都把油、常點與亞倫／祭司料理燈列在聖所脈絡；不得以蠟燭模型或任意高度代替文字。

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lamp-oil-present | lamp-daily | actor-unspecified | holy-place | menorah | C-LV24-LAMP | 出27:20；利24:1–2 | unspecified | lamp-tend | 文字標示清橄欖油作為輸入，不自動創造採油場景 | 提供者未在此節明定 |
| lamp-tend | lamp-daily | priest | holy-place | menorah | C-LV24-LAMP | 出27:21；利24:3–4 | daily-priest | lamp-light | 高亮七個燈盞與清理工具；不讓場景所有火焰同時改變 | 詳細整理工具動作未詳載 |
| lamp-light | lamp-daily | priest | holy-place | menorah | C-LV24-LAMP | 出25:37；出27:20–21；利24:2–4 | daily-priest | — | 依目前步驟切換燈盞狀態，顯示「常常點著」文字 | 真實火焰形狀、亮度與燃燒速度未詳載 |

## 核心程序三：陳設餅

觸發：點選 `shewbread-table`。餅的數量與更換週期有文字依據；利24 同時保留「兩行／摞」的譯注，介面不可聲稱只有一種幾何擺法。

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bread-bake | bread-weekly | actor-unspecified | camp-assembly | shewbread-table | C-LV24-BREAD | 利24:5 | unspecified | bread-arrange | 顯示十二個餅的計數卡，不模擬烘焙過程 | 烘焙器具與製作人未詳載 |
| bread-arrange | bread-weekly | priest | holy-place | shewbread-table | C-EX25-TABLE,C-LV24-BREAD | 出25:23–30；利24:5–7 | daily-priest | bread-replace | 在桌面高亮「十二個」與「兩行／摞」兩種文字標記 | 唯一排列形狀未詳載 |
| bread-replace | bread-weekly | priest | holy-place | shewbread-table | C-LV24-BREAD | 利24:8 | daily-priest | bread-eat | 以週期標記替換舊餅；不捏造每日更換 | 具體安息日時間呈現由資料控制 |
| bread-eat | bread-weekly | priest | holy-place | shewbread-table | C-LV24-BREAD | 利24:9 | daily-priest | — | 顯示換下餅歸亞倫和子孫、在聖處吃；不顯示一般民眾取食 | 食用動作不寫實化 |

## 核心程序四：日常獻香

觸發：點選 `incense-altar`。日常香壇在法櫃前幔外；利16 的香爐攜入幔內是不同 branch，不能共用「常燒」特效。

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| incense-morning | incense-daily | priest | holy-place | incense-altar,menorah | C-EX30-INCENSE | 出30:1–10 | daily-priest | incense-evening | 以晨間標籤聚焦香壇與燈臺；不開啟至聖所 | 早晨整理燈的細部動作未詳載 |
| incense-evening | incense-daily | priest | holy-place | incense-altar,menorah | C-EX30-INCENSE | 出30:7–8 | daily-priest | incense-boundary | 以黃昏標籤顯示燒香與點燈的相鄰脈絡 | 香煙物理形狀未詳載 |
| incense-boundary | incense-daily | priest | holy-place | incense-altar | C-EX30-INCENSE | 出30:9–10 | daily-priest | — | 顯示不可獻異樣的香、燔祭、素祭或奠祭；將日常香壇與贖罪日香爐分開 | 年度贖罪禮另見 atonement branch |

## 核心程序五：燔祭（按供物分支）

觸發：點選 `burnt-altar` 後先選 `bull`、`sheep-goat` 或 `bird`。利1 的三段分支必須各自走完；所有動作以抽象標記、文字與位置高亮呈現。

### 牛分支

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| offering-bull-present | burnt-bull | offering-person | burnt-altar-location | bull,burnt-altar | C-LV01-BRANCHES | 利1:3 | unspecified | offering-bull-hand | 標記無殘疾公牛與會幕門口，不代演牧養來源 | 個人身份與服飾未詳載 |
| offering-bull-hand | burnt-bull | offering-person | burnt-altar-location | bull | C-LV01-BRANCHES | 利1:4 | unspecified | offering-bull-kill | 以手掌圖示標記按手；不加入祈禱台詞 | 按手的細節未詳載 |
| offering-bull-kill | burnt-bull | offering-person | burnt-altar-location | bull,burnt-altar | C-LV01-BRANCHES | 利1:5 | unspecified | offering-bull-blood | 以文字提示「獻祭者宰公牛」；畫面不顯示血腥細節 | 無需補刀具或動作速度 |
| offering-bull-blood | burnt-bull | priest | burnt-altar-location | bull,burnt-altar | C-LV01-BRANCHES | 利1:5 | daily-priest | offering-bull-prepare | 以紅色抽象線標示血灑在壇周圍；不要把血點數量自行加倍 | 灑血路徑之外的幾何未詳載 |
| offering-bull-prepare | burnt-bull | offering-person | burnt-altar-location | bull,burnt-altar | C-LV01-BRANCHES | 利1:6 | unspecified | offering-bull-fire | 以分塊標記顯示剝皮與切塊的文字，不做寫實剖切 | 具體工具未詳載 |
| offering-bull-fire | burnt-bull | priest | burnt-altar-location | bull,burnt-altar | C-LV01-BRANCHES | 利1:7–9 | daily-priest | — | 依序標示火、柴、肉塊與頭／脂油；內臟與腿以「用水洗」文字標籤，最後標全燒 | 火焰外觀與擺放細節未詳載 |

### 羊／山羊分支

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| offering-sheep-present | burnt-sheep-goat | offering-person | burnt-altar-location | sheep,burnt-altar | C-LV01-BRANCHES | 利1:10 | unspecified | offering-sheep-hand | 標記無殘疾公羊／山羊供物 | 品種外觀與個人身份未詳載 |
| offering-sheep-hand | burnt-sheep-goat | offering-person | burnt-altar-location | sheep | C-LV01-BRANCHES | 利1:10 | unspecified | offering-sheep-kill | 顯示按手提示並保留可回退狀態 | 按手細節未詳載 |
| offering-sheep-kill | burnt-sheep-goat | offering-person | burnt-altar-location | sheep,burnt-altar | C-LV01-BRANCHES | 利1:11 | unspecified | offering-sheep-blood | 明確標示壇的北邊；不能把此位置套給牛或鳥 | 「北邊」與模型軸線的對應需 R06 驗證 |
| offering-sheep-blood | burnt-sheep-goat | priest | burnt-altar-location | sheep,burnt-altar | C-LV01-BRANCHES | 利1:11 | daily-priest | offering-sheep-prepare | 高亮壇周圍的血處理 | 灑血的視覺方式非經文細節 |
| offering-sheep-prepare | burnt-sheep-goat | offering-person | burnt-altar-location | sheep,burnt-altar | C-LV01-BRANCHES | 利1:12–13 | unspecified | — | 顯示分塊、清洗內臟與腿、全然焚燒的文字順序 | 工具與火焰幾何未詳載 |

### 鳥分支

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| offering-bird-present | burnt-bird | offering-person | burnt-altar-location | bird,burnt-altar | C-LV01-BRANCHES | 利1:14 | unspecified | offering-bird-priest | 標記斑鳩或雛鴿供物；未提供的鳥模型使用命名符號 | 鳥種外觀可用抽象圖示 |
| offering-bird-priest | burnt-bird | priest | burnt-altar-location | bird,burnt-altar | C-LV01-BRANCHES | 利1:15 | daily-priest | offering-bird-blood | 文字指出祭司拿鳥到壇前並揪頭；畫面不寫實化 | 無需補充工具 |
| offering-bird-blood | burnt-bird | priest | burnt-altar-location | bird,burnt-altar | C-LV01-BRANCHES | 利1:15–16 | daily-priest | offering-bird-fire | 標示血流在壇旁、嗉子／髒物丟到壇東倒灰處 | 標記尺寸與血量未詳載 |
| offering-bird-fire | burnt-bird | priest | burnt-altar-location | bird,burnt-altar | C-LV01-BRANCHES | 利1:17 | daily-priest | — | 文字標示撕開但不可撕斷、在火上焚燒 | 動作速度與火焰形狀未詳載 |

## 核心程序六：贖罪日

觸發：從學習模式選 `atonement-entry`。讀者是研究觀察者；步驟不給一般人自由穿越幔子的遊戲權限。利16:17 明確記載大祭司進入聖所贖罪時，會幕裡不可有人，直到他出來。

| stepId | branchId | actorRole | locationId | objectIds | actionClaimIds | scriptureRefs | garmentState | nextStepIds | displayCue | unresolved |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| atonement-prepare | atonement-annual | high-priest | camp-assembly | bull,sheep,garments | C-LV16-DAY | 利16:1–6 | atonement-linen | atonement-goats | 顯示年度特殊程序、洗身與細麻布聖服 | 個別洗身空間未詳載 |
| atonement-goats | atonement-annual | high-priest | east-gate | sheep-goat,burnt-altar | C-LV16-DAY | 利16:5–10 | atonement-linen | atonement-bull | 兩隻公山羊在會幕門口拈鬮；分為歸耶和華與歸阿撒瀉勒 | 「阿撒瀉勒」的歷史解釋不在此決定 |
| atonement-bull | atonement-annual | high-priest | burnt-altar-location | bull | C-LV16-DAY | 利16:6,11 | atonement-linen | atonement-incense | 標示公牛為自己和本家贖罪；不播放宰殺細節 | 血液量與工具未詳載 |
| atonement-incense | atonement-annual | high-priest | holy-place | incense-altar | C-LV16-DAY | 利16:12–13 | atonement-linen | atonement-bull-blood | 以香爐、火炭與香的抽象符號顯示攜入幔內，煙雲遮掩施恩座 | 煙雲形狀、香爐外形未詳載 |
| atonement-bull-blood | atonement-annual | high-priest | most-holy-place | bull,ark | C-LV16-DAY | 利16:14 | atonement-linen | atonement-goat-blood | 在施恩座東面與前面顯示七次血點文字；相機是 study view | 血點的畫面大小與顏色未詳載 |
| atonement-goat-blood | atonement-annual | high-priest | most-holy-place | sheep-goat,ark | C-LV16-DAY | 利16:15–16 | atonement-linen | atonement-empty-room | 顯示百姓贖罪祭公山羊血進入幔內；不要與日常香壇合併 | 具體移動插值未詳載 |
| atonement-empty-room | atonement-annual | actor-unspecified | most-holy-place | — | C-LV16-DAY | 利16:17 | unspecified | atonement-altar-clean | 隱藏其他角色，只留下「會幕裡不可有人」的狀態文字 | 「不可有人」的範圍依經文，不推成所有外院無人 |
| atonement-altar-clean | atonement-annual | high-priest | burnt-altar-location | bull,sheep-goat,burnt-altar | C-LV16-DAY | 利16:18–19 | atonement-linen | atonement-live-goat | 標示牛血／公山羊血抹壇角與七次彈血，清除污穢 | 物理清潔效果未詳載 |
| atonement-live-goat | atonement-annual | high-priest | east-gate | sheep-goat | C-LV16-DAY | 利16:20–22 | atonement-linen | atonement-wilderness | 兩手按活羊、承認罪、交給所派的人送到曠野；保留分工 | 所派之人的身份未明定，標 assigned-person |
| atonement-wilderness | atonement-annual | assigned-person | wilderness-route | sheep-goat | C-LV16-DAY | 利16:21–22 | unspecified | atonement-change-clothes | 以路線和文字表示送到曠野、無人之地；不做追逐玩法 | 曠野路線與距離未詳載 |
| atonement-change-clothes | atonement-annual | high-priest | camp-assembly | garments | C-LV16-DAY | 利16:23–24,32 | post-atonement-garments | atonement-burnt-offering | 脫下細麻布衣服、洗身、穿回衣服後出來；服裝狀態必可回退 | 「衣服」未逐項在此段重列，沿用角色衣裝契約 |
| atonement-burnt-offering | atonement-annual | high-priest | burnt-altar-location | bull,sheep-goat,burnt-altar | C-LV16-DAY | 利16:24–25 | post-atonement-garments | atonement-outside-burn | 顯示自己的燔祭與百姓燔祭、脂油在壇上焚燒 | 個別祭牲對應仍需與五祭資料核對 |
| atonement-outside-burn | atonement-annual | assigned-person | camp-outside | bull,sheep-goat | C-LV16-DAY | 利16:27–28 | unspecified | atonement-wash-return | 牛與公山羊搬到營外、皮肉糞用火焚燒；執行者洗衣洗身後進營 | 營外倒灰地點與焚燒工具未詳載 |
| atonement-wash-return | atonement-annual | assigned-person | camp-outside | — | C-LV16-DAY | 利16:26,28 | unspecified | — | 文字顯示洗衣、洗身、進營；不把此人誤標祭司 | 返回時間未詳載 |

## 五祭比較資料

五祭比較不是第六個自動播放程序；每一列可以進入對應的 branch 閱讀。

| sacrificeId | 中文名稱 | 核心材料／入口 | 主要角色與位置 | 處理／可食界線 | scriptureRefs | actionClaimIds | 未詳載／不得補入 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| burnt-offering | 燔祭 | 牛、羊／山羊、鳥；會幕門口／壇 | 獻祭者與祭司依三分支分工 | 全燒的範圍依利1各分支；血依分支處理 | 利1:1–17；利6:8–13 | C-LV01-BRANCHES | 不把北邊規則套給牛／鳥，不加入對話 |
| grain-offering | 素祭 | 細麵、油、乳香；供物帶到祭司與壇 | 獻祭者帶來，祭司取紀念部分 | 紀念部分與乳香焚燒，剩餘歸祭司 | 利2:1–16 | C-LV02-07-FIVE | 不做動物、血或宰殺分支 |
| peace-offering | 平安祭 | 牛、羊／山羊及脂油；會幕前／壇 | 獻祭者按手宰，祭司灑血與焚脂油 | 感謝、還願／甘心的食用期限不同；血與脂油不可吃 | 利3:1–17；利7:11–21,29–36 | C-LV02-07-FIVE | 不把所有肉都全焚燒，不省略時間界線 |
| sin-offering | 贖罪祭 | 依身份／情況有公牛、山羊、母羊等 | 祭司按分支處理血；有帶血入會幕與營外焚燒差異 | 有些祭肉可由祭司在聖處吃，帶血入聖所的不可吃 | 利4:1–35；利6:24–30 | C-LV02-07-FIVE | 不將受膏祭司、會眾、官長與平民合併 |
| guilt-offering | 贖愆祭 | 無殘疾公綿羊或利5所列供物 | 獻祭者帶來，祭司在壇處理血與脂油 | 祭司中的男丁在聖處吃；賠償／加五分之一依利5 | 利5:1–19；利7:1–10 | C-LV02-07-FIVE | 不把所有贖愆祭做成平安祭食用規則 |

## 學習檢查

每個程序完成後至少問一個可觀察問題：洗濯盆「誰在何時洗什麼」；燈臺「七盞燈與油如何維持」；陳設餅「十二個餅何時更換、誰在聖處吃」；獻香「日常香壇位於哪裡、哪些供物不可放上」；燔祭「三種供物的角色與位置哪裡不同」；贖罪日「誰穿麻衣、誰進入、誰被送到曠野、何時換衣」。問題只檢查經文與空間，不加入來源沒有的神學標準答案。
