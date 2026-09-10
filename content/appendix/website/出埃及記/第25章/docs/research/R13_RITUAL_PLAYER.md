# R13 洗濯與日常獻香播放器

R13 把 R02 的兩個核心程序接到同一個 `RitualPlaybackController`。步驟由 `src/data/rituals.json` 定義，控制器只依 `nextStepIds` 與資料重建狀態；UI 不再另存一份故事文字。

## 已接入程序

| 程序 | 步驟 | 角色／服裝 | 器物與位置 |
| --- | --- | --- | --- |
| 祭司洗濯 | 走近洗濯盆 → 洗手洗腳 → 洗濯後前往服事 | 供職祭司／普通祭司日常聖衣 | 洗濯盆；最後只提供壇前／會幕入口教學熱點 |
| 日常獻香 | 早晨獻香 → 黃昏獻香 → 日常香壇的界線 | 供職祭司／普通祭司日常聖衣 | 幔外香壇與燈臺；不開啟至聖所 |

洗濯只顯示文字與非寫實手腳標記，沒有水龍頭、固定水量或洗濯時間。日常獻香在前兩步啟用 `incense-smoke` cue，最後的界線步驟明確隱藏煙霧，並把利16的幔內香爐留給後續贖罪日程序。

## 控制契約

- `start` 從第一步開始並觸發 step snapshot。
- `next` 沿 `nextStepIds` 前進；`previous` 以資料順序退回；抵達末步顯示 `complete`。
- `pause`／`resume` 只改播放狀態；`replay` 重新從第一步建立，不累加特效。
- `seek(index)` 先離開目前步，再由目標步重新觸發 visual adapter；越界或 idle seek 直接報錯。
- `close` 由 `AppKernel` 重設 controller、角色／選取狀態與所有 narrative cues。

每一步都把 `actorRole`、`characterIds`、`garmentState`、`objectIds`、`locationId`、`scriptureReferences`、`displayCue` 與 `unresolved` 一起送到面板。角色卡因此會同步顯示供職祭司與日常祭司聖衣，避免程序只剩特效。
