# 示劍人物素材

集中對應在 `figure-sources.json`。目前 `temporary: true`，使用紅海一家人的老人、女孩、父親與母親，以及 `test_crowd_1792981907743.jpg` 的四個人物。裁框之外的零碎部分由最大連通區清除；正式群組角色表不套此步。

`joshua` 與長老目前借用持杖行走者；`write` 借用彎身老人；拉袖子、回頭看、青少年／成年女兒、推石及遞交仍是暫代圖。程式已在對應拍選取姿勢，圖像本身尚不能當成專用動作驗收。正式圖到齊前保留這項限制。

## 正式角色表替換

1. 把白底角色表放在本站的素材資料夾，在 `sheets` 加入路徑與 `key: white`。
2. 將角色的 `roles` 姿勢從暫代 cut 名稱改為 `{"sheet":"表名","index":0}`；index 按白色空隙分列、由左到右、由上到下排列。每個姿勢可覆寫 `head`、`foot`，座標採裁切後 PNG 的像素座標。
3. 保留程式使用的姿勢名稱：`stand`、`speak`、`point`、`write`、`walk-1`、`walk-2`、`pull-sleeve`、`look-back`、`push-stone`、`hand-over`、`receive-bury`、`carry-pole`。某角色沒提供專用姿勢會回到自己的 `stand`。
4. 群眾正式圖若是一張多人小組，`worldHeight` 仍指圖中人的身高。`elders`、`crowd-back`、`crowd-walk` 的世界高度集中設定，四類領袖站位與十二支派站位保留。群組變寬後須重新看站位密度及遮擋。
5. PowerShell 執行 `npm run figures`，再執行 `npm run build`。

也可先單獨檢查一張表：`python -I scripts/slice_sheet.py --sheet <路徑> --role joshua --poses stand,speak,write,walk-1,walk-2`。數量不符會直接報錯，不會猜哪個圖是哪個姿勢。正式建置以集中對應檔為準，單獨輸出後仍應更新集中對應。

`figures.json` 記錄 PNG 尺寸與頭頂／腳底；`atlas.json` 加入 UV，執行期只載入 `atlas.webp`。切片亦計入 4,000,000 bytes 上限。所有圖集邊緣保留透明距離；同一圖片只放一次。腳底以內容最下緣對齊，站姿以頭頂至腳底量身高；坐姿寫字時以較矮高度呈現。

正式角色表增加後，若超過 2048 圖集容量或 4 MB，打包器會自動以 85% 逐步縮小切片並同步換算頭頂、腳底與 UV，無須修改場景程式。應另看縮小後的輪廓是否仍足夠清楚。

天空只讀 `lab/renders/layers/ford/sky.png`，輸出本站 `src/assets/shechem-sky.webp`，沒有修改共享渲染資料夾。待示劍天幕交付時，修改 `pack_figures.py` 的輸入路徑後重建。

## 驗收

`npm run build` 包含四項人物素材閘門：PNG 尺寸／錨點、集中對應完整性、全部人物貼圖大小、圖集覆蓋／UV 邊界。原有十五項資料閘門保留。

`powershell -NoProfile -File tools/shoot-cards.ps1 -Device desktop` 與 `-Device mobile` 使用本站獨立的 `jos-shoot-cards-*` Chrome profile，透過 `tools/cdp.mjs` 開啟單檔成品。截圖與機械量測存 `.tmp-shots/cards/`；包括立石前後、對話兩句、長大前後、全部人物分鏡各三個進度、五秒 requestAnimationFrame 取樣。這是 Chrome 裝置模擬，不代表手機實機效能。
