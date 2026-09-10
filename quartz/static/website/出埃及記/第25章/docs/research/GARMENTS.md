# R02 服裝與情境規格

服裝資料只描述經文明載的部件與使用情境；模型來源、授權、材質與人物外觀另在資產臺帳處理。沒有證據的臉孔、身高、布料重量與配色，不由通用人物模型補上。

## 日常祭司聖衣

| garmentState | 角色 | 可顯示部件 | 來源 | 可支援的文字 | 未詳載／禁止推導 |
| --- | --- | --- | --- | --- | --- |
| daily-priest | priest／亞倫子孫 | 內袍、腰帶、裹頭巾、細麻布褲；祭司聖衣情境 | 出28:40–43；出39:27–29 | 供職、進會幕或就近壇時穿上，以免擔罪而死 | 版型、身高、鞋、臉孔、布料重量與現代色碼 |
| daily-high-priest | high-priest | 胸牌、以弗得、外袍、內袍、冠冕／牌、腰帶、細麻布褲等 | 出28:1–43；出39:1–31 | 為榮耀華美；部件與穿戴情境可展開閱讀 | 不由服裝部件推導完整肖像或固定行走姿勢 |

## 贖罪日服裝切換

| garmentState | 角色 | 來源 | runtime 要求 | 未詳載 |
| --- | --- | --- | --- | --- |
| atonement-linen | high-priest | 利16:3–4,32 | 進入贖罪日程序前洗身，穿細麻布聖內袍、褲、腰帶、冠冕；每個關鍵 step snapshot 必須可見 | 麻布版型、繫法與顏色之外觀未詳載 |
| post-atonement-garments | high-priest | 利16:23–24 | 完成幔內／壇上贖罪後脫下細麻布衣服、洗身、穿上衣服，再獻燔祭；退出與返回可回復 | 這裡的「衣服」不在利16逐項重列，沿用日常衣裝 claim，不自行畫新部件 |
| unspecified | offering-person／assigned-person／actor-unspecified | 指定程序沒有服裝描述 | UI 顯示「經文未詳載」，可用沒有身份暗示的抽象角色標記 | 不可套用祭司聖衣、贖罪日麻衣或中世紀服裝 |

## 角色與服裝對照

| roleId | daily-priest | daily-high-priest | atonement-linen | post-atonement-garments | 備註 |
| --- | --- | --- | --- | --- | --- |
| offering-person | 不適用 | 不適用 | 不適用 | 不適用 | 利1 的獻祭者動作用文字／抽象標記，不給祭司服裝 |
| priest | 可用 | 不適用 | 不適用，除非資料另有來源 | 不適用 | 日常燈、餅、香與部分祭壇工作 |
| high-priest | 可用於指定日常 context | 可用 | 贖罪日進入／血／香／活羊步驟 | 完成贖罪日後獻燔祭 | 不是所有「祭司」文字都自動升級為大祭司 |
| levite | 未由本輪來源指定 | 未由本輪來源指定 | 不適用 | 不適用 | 只顯示職責與搬運，不補服裝 |
| assigned-person | 不適用 | 不適用 | 不適用 | 不適用 | 利16:21–22、26–28 的所派之人，身份保留未詳載 |

## 資產使用界線

- 現有 `priest-arab-man-library`、`priest-basic-human-library`、`priest-medieval-outfit-library` 與 `priest-tunic-library` 是授權／技術基底，不自動等於歷史服裝。R11 若套用，必須在畫面標示 reconstructed、列出部件 claim 與未知外觀。
- 來源只支持文字部件時，空缺 assetId 可以保留 `null`，但核心程序不得因此永久省略角色職責；可用抽象角色標記完成教學。
- 任何新增布料顏色要回到出28、出39 的文字與 evidence；Timna 紫染研究只能作材料技術比較，不能決定祭司衣服的唯一 RGB。
- 贖罪日不能沿用日常大祭司外衣到所有 step；`atonement-linen` 與 `post-atonement-garments` 必須由播放器狀態控制，前後退與跳步結果一致。
