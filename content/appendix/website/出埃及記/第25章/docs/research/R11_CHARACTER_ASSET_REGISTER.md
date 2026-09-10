# R11 角色、服飾與供物資產登記

R11 把人物模型當作技術基底，把經文部件當作可追溯的文字資料。模型的臉孔、身高、鞋履、布料重量與顏色沒有被當成古代以色列人的歷史證據。

## 角色技術基底

| 角色 | 技術基底 | 授權 | 可用範圍 | 不能宣稱 |
| --- | --- | --- | --- | --- |
| 大祭司亞倫／承接者 | `priest-basic-human-library`（DNC44） | CC BY 4.0 | 低細節站位、方向與服飾文字標籤 | 亞倫本人肖像、聖衣版型或歷史復原 |
| 供職祭司 | `priest-arab-man-library`（NABEEL619） | CC BY 4.0 | 低細節站位、持具提示與程序角色 | 古代祭司服飾、族群外貌或寫實動作 |
| 利未人／協助者 | 不載入人物服裝 mesh | — | 角色位置示意、搬運職責標籤 | 祭司聖衣或未核准的利未人服裝 |

兩個 CC BY 模型的來源、下載日期、SHA-256 與 attribution 以 `src/data/assets.json` 為準。`priest-medieval-outfit-library` 與 `priest-tunic-library` 只保留為技術研究候選，本輪沒有把中世紀鞋、帽、裝飾或服裝幾何標為古代聖衣。

## 服飾狀態

`src/data/garments.json` 提供五個狀態：`daily-priest`、`daily-high-priest`、`atonement-linen`、`post-atonement-garments` 與 `unspecified`。每個部件都有 claim、經文定位、材料文字、數量、功能、視覺政策與未知項目；`assetId: null` 是刻意保留，代表沒有核准的專用服裝 mesh。

`src/data/role-costumes.json` 以角色限制狀態切換：普通祭司只能用日常祭司聖衣，大祭司可由日常聖衣切到贖罪日細麻衣並換回，利未人維持未詳服裝的角色標記。解析器遇到不允許的組合會回退到角色位置示意，不靜默套用錯誤服裝。

## 供物分支

`src/data/offerings.json` 保留利1的牛、羊、山羊與鳥分支：

- 公牛分支使用 `bull-library`，標示模型示意與「公牛」性別要求。
- 公綿羊分支使用 `sheep-library`，標示性別要求來自經文，模型本身不作性別證明。
- `cow-npc-library` 留作未核准候選，沒有任何已核准分支引用，因來源模型性別未確認。
- 山羊與鳥沒有合適 mesh，改用清楚標字的符號，不以牛或羊冒充。

每一分支都指向 `C-LV01-BRANCHES`，並保留獻祭者／祭司的角色分工；R15 才會把這些分支接入完整五祭播放器。

## R11 展示界線

研讀面板會顯示目前角色、職責、服飾狀態、可追溯部件與技術基底 disclosure。這是可檢視的教學資料層，不把技術模型或推定動作包裝成歷史實況。贖罪日的 `atonement-linen` 只會由大祭司角色解析成功，並在程序 step 變更時由資料狀態決定。
