# R01 來源臺帳

建立日期：2026-09-10。這份臺帳是 R03 typed evidence 的輸入；它不是把所有來源都批准成網站正文。經文來源的權威路徑是庫根 `raw_scripture/`，網站根目錄下的同名資料不可取代它。檔案 hash 是本次核對時的 SHA-256；來源若改動，必須重新核對。

## 判讀規則

- `approved-text`：可支持經文明載的文字、尺寸、材料、位置或程序；runtime 只可讀取已核准 claim。
- `approved-comparison`：可支持有明確年代／方法／出土地的考古比較；不能把相似物說成摩西會幕實物。
- `interpretive`：可用來呈現學術觀點或研究背景，不能投票成經文明載。
- `reference-only`：只作構圖或資訊架構參考，不進入網站主張。
- `unverified`：工具無法穩定讀取或尚未完成必要段落核對，不得進入 verified runtime。

## 庫根正式經文

所有下列檔案均為本機 UTF-8 文字；本輪確認每檔行數與章節的逐節格式，沒有改寫原文。定位使用書卷、章、節；若 R03 抽取腳本需要行號，須以當時檔案再次驗證。

| source ID | 標題／機構 | 類別 | 正式路徑 | 檢視日期／定位 | SHA-256 | 能支援的範圍 | 不能推及的範圍 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S-EX25 | 《出埃及記》第25章／和合本檔案 | 正式經文 | `C:/Obsidian/Hermes/scripture/raw_scripture/出埃及記/第25章.txt` | 2026-09-10／出25:1–40（40行） | `91FEB090E31DE955C29BC8EB6529469FCE572502BBBB2A7D12A3CEA427D96BD7` | 奉獻材料、聖所目的、約櫃、桌、燈臺、樣式約束 | 未描述的曲線、RGB、木紋、現代尺寸換算 | approved-text |
| S-EX26 | 《出埃及記》第26章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第26章.txt` | 2026-09-10／出26:1–37（37行） | `427B99C3D9BDF83827D57697A0D4F6E3DFA2FD9EF6D8D29AAF678C748DB3503E` | 幔子、幔子材料、基路伯圖樣、兩區與幔子、框架與柱 | 翻譯爭議材質的確切動物、唯一歷史織法與顏色值 | approved-text |
| S-EX27 | 《出埃及記》第27章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第27章.txt` | 2026-09-10／出27:1–21（21行） | `29E3CC3BF9961F17326BE23D9D35293166B186A8695B5FB1E82B2F011274BBC4` | 燔祭壇尺寸與材料、院子帷子、東門、燈與服事區域 | 未載洗濯盆尺寸、營地帳數、光影效果 | approved-text |
| S-EX28 | 《出埃及記》第28章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第28章.txt` | 2026-09-10／出28:1–43（43行） | `91E887DA17C4D2546887B3B982D3EF0859E4E07FECBA57C20F2221E573F0AC9E` | 祭司／大祭司身份與聖衣部件、材料、佩戴情境 | 未載人物面貌、身高、動作表演與布料 RGB | approved-text |
| S-EX30 | 《出埃及記》第30章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第30章.txt` | 2026-09-10／出30:1–38（38行） | `B32ED946334B2EEA2895A01124763546D94DFF636A7B54CE03AA54BA48F7BF08` | 香壇、洗濯盆洗手洗腳、香與膏油的製作界線 | 不支持日常香壇等於贖罪日香爐、未載管路與現代容器 | approved-text |
| S-EX35 | 《出埃及記》第35章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第35章.txt` | 2026-09-10／出35:1–35（35行） | `337BF7388FA1C33210805196B47906AE8A175BAAD70AC3F256168FCDAB9ED0B2` | 奉獻與工匠、織物與工藝、會眾參與 | 不支持某個模型作者或現代製程完全等同古代工作 | approved-text |
| S-EX36 | 《出埃及記》第36章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第36章.txt` | 2026-09-10／出36:1–38（38行） | `A0FBAB9AC9A5C846576D48D729E7D60B5426DE6995F7B901F3217C9C8C5277B2` | 幔子、罩棚、框架與柱的製作記錄 | 不支持未記錄的施工工具、工期與動作 | approved-text |
| S-EX37 | 《出埃及記》第37章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第37章.txt` | 2026-09-10／出37:1–29（29行） | `91433C76ABEBAFF94586D40199D6E245D59ADC031F411993BC117A51E260F9EF` | 約櫃、桌、燈臺、香壇的實作材料與部件 | 不支持把後世文本物件自動放入出25剖面 | approved-text |
| S-EX38 | 《出埃及記》第38章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第38章.txt` | 2026-09-10／出38:1–31（31行） | `E32FF5FE81C897BFADAE8F5326284856FBF25E19284FDF7582E2BE98F85688F6` | 燔祭壇、洗濯盆、院子與金屬用量記錄 | 不支持把統計重量換成模型幾何或現代公斤而不標假設 | approved-text |
| S-EX39 | 《出埃及記》第39章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第39章.txt` | 2026-09-10／出39:1–43（43行） | `6B23E83A87050F5C3E2A1223F0038272522F3C6C7441D5687BB08DE4FF785971` | 聖衣與會幕物件的完成檢查 | 不支持現代人物服裝版型與動作 | approved-text |
| S-EX40 | 《出埃及記》第40章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第40章.txt` | 2026-09-10／出40:1–38（38行） | `B4AD62571E31EAC33DDAF8117BF083B1A3164EEE811818501CDFA023BC9C2029` | 立幕、分區、器物安置、雲彩與火的事件描述 | 不支持把火柱／雲彩變成每個畫面的永久裝飾 | approved-text |
| S-EX16 | 《出埃及記》第16章／和合本檔案 | 正式經文 | `raw_scripture/出埃及記/第16章.txt` | 2026-09-10／出16:1–36（36行） | `9BF2332E7FA74F0ED6EDB9470E310F93643BA03D54D75F1396BCB109E013D9A9` | 後世嗎哪記憶的獨立脈絡 | 不單獨證明出25約櫃當時已放入嗎哪罐 | approved-text |
| S-LV01 | 《利未記》第1章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第1章.txt` | 2026-09-10／利1:1–17（17行） | `00D4BF83FFA9787D28C419B61928410098E85CE0554E60E0115B8BC1F2108A6F` | 牛、羊／山羊、鳥燔祭的角色與動作分支 | 不支持把所有祭牲共用一條程序或寫實血腥動畫 | approved-text |
| S-LV02 | 《利未記》第2章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第2章.txt` | 2026-09-10／利2:1–16（16行） | `FCA20C05A6F09128C1DDDF06A66AA4F1F337212DF6FA1A90D2620C857B9401F7` | 素祭材料、乳香、紀念部分與焚燒 | 不支持把素祭做成動物流程 | approved-text |
| S-LV03 | 《利未記》第3章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第3章.txt` | 2026-09-10／利3:1–17（17行） | `A5728FE37952592E18964AEDC3B40A01380D7F1F3B38FC05EEEE6F708D8C2579` | 平安祭材料、脂油／血界線與可食脈絡 | 不支持把所有祭牲全焚燒或抹平公母差異 | approved-text |
| S-LV04 | 《利未記》第4章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第4章.txt` | 2026-09-10／利4:1–35（35行） | `262A98981C17B5C8F86744617E08AB86AAEAAFBDB29ACECD20ED6D1DF9844777` | 贖罪祭按身份與情況的分支、血與處置 | 不支持把不同身份合成一位通用祭司 | approved-text |
| S-LV05 | 《利未記》第5章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第5章.txt` | 2026-09-10／利5:1–19（19行） | `D82C6057FEE8549D2054731ADCBF1447AE18ED7C85BFC70EBEAFB456F1658852` | 贖罪／贖愆相關情況與供物差異 | 不支持未列出的心理狀態或祈禱台詞 | approved-text |
| S-LV06 | 《利未記》第6章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第6章.txt` | 2026-09-10／利6:1–30（30行） | `57010290B5FC08C70053984D05D72155B580D830D949992CAB4EDFD313CCA37A` | 祭司在壇上火與各祭處理的規定 | 不支持把壇火效果延伸為所有場景特效 | approved-text |
| S-LV07 | 《利未記》第7章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第7章.txt` | 2026-09-10／利7:1–38（38行） | `C2B2FAF66AB676A5EE8D5A0D40032C5FEF2E130842EC85F7B26A8CDA69499E59` | 五祭比較的處理與可食／不可食界線 | 不支持把各祭目的改成單一神學標語 | approved-text |
| S-LV08 | 《利未記》第8章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第8章.txt` | 2026-09-10／利8:1–36（36行） | `F533FF9B2B3B0AB3F2107B133D6511DE89ACC879089EB5FDEDC84BD06A624A5B` | 承接聖職脈絡與祭司事奉背景 | 不支持把承接禮儀簡化成每日程序 | approved-text |
| S-LV16 | 《利未記》第16章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第16章.txt` | 2026-09-10／利16:1–34（34行） | `4B45AA656A4562C2A242BB982B2D8CF094506939BF3B35571F5334DA4A299BAF` | 贖罪日完整程序、衣裝、香、牛／兩羊、血、活羊、退出與潔淨 | 不支持自由漫遊、普通人進入幔內或「只進一次」的簡化結論 | approved-text |
| S-LV24 | 《利未記》第24章／和合本檔案 | 正式經文 | `raw_scripture/利未記/第24章.txt` | 2026-09-10／利24:1–23（23行） | `5DE748F582F1BD28A370174CAB4ECF4E73103012F00D6B4606EC3A075095AC51` | 燈油與燈火、陳設餅十二個與更換／食用脈絡 | 不支持把餅的排列說成唯一圖樣 | approved-text |
| S-NM03 | 《民數記》第3章／和合本檔案 | 正式經文 | `raw_scripture/民數記/第3章.txt` | 2026-09-10／民3:1–51（51行） | `CF167D4265C5BF381BCC7559774A8F040E6651B0C7A4E7CC0C76E128B103FFC7` | 祭司家族與利未人職責的脈絡 | 不支持把所有搬運細節指派給同一角色 | approved-text |
| S-NM04 | 《民數記》第4章／和合本檔案 | 正式經文 | `raw_scripture/民數記/第4章.txt` | 2026-09-10／民4:1–49（49行） | `B8291F117906FB5AB7F5B961E1104FC6724F46F84C7C9348B59F9EBF4F801AE2` | 會幕物件遮蓋、搬運與家族分工 | 不支持角色在未遮蓋器物前任意觀看或觸摸 | approved-text |
| S-NM18 | 《民數記》第18章／和合本檔案 | 正式經文 | `raw_scripture/民數記/第18章.txt` | 2026-09-10／民18:1–32（32行） | `D2B2A64F4A435D153FB28A98122ADA4CCAD513CD2252071398F5670526EA1DE6` | 祭司與利未人職分、聖物責任 | 不支持把利未人與祭司視為可互換角色 | approved-text |
| S-NM17 | 《民數記》第17章／和合本檔案 | 後世／相關脈絡 | `raw_scripture/民數記/第17章.txt` | 2026-09-10／民17:1–13（13行） | `2E97DE6B0407925B002B46201F9FB88CF23E18EFE6030BE6A4BA3731F512DD0A` | 亞倫杖發芽的後世敘事定位 | 不自動放入出25當時約櫃剖面 | approved-text |
| S-HB09 | 《希伯來書》第9章／和合本檔案 | 後世回顧 | `raw_scripture/希伯來書/第9章.txt` | 2026-09-10／來9:1–28（28行） | `085B20CFD196947DC2267D91DD58C27972791CD8A60BE7C58FF3F73AC64D5CBE` | 後世文本如何談會幕分區與大祭司 | 不回寫出25建造細節，也不證明剖面內容物 | approved-text |

## 考古與學術比較

| source ID | 標題／作者／機構 | 類別 | URL／定位 | 檢視日期 | 權利／能支持的範圍 | 不能推及的範圍 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-ARCH-TIMNA | *Early evidence of royal purple dyed textile from Timna Valley (Israel)*，Naama Sukenik 等，PLOS ONE 16(1), e0245897 | 同行評審原始研究 | `https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0245897`／摘要、引言、考古脈絡、方法（網頁行 180–206、240–301） | 2026-09-10 | CC BY；可支持 Timna Site 34 的紫染織物、HPLC 判定與西元前11世紀末至10世紀初的考古年代比較 | 不支持出埃及時會幕布料的確定 RGB、原料、祭司服裝或會幕實物連結 | approved-comparison |
| S-ARCH-CTV | Central Timna Valley Project，Tel Aviv University | 發掘研究入口 | `https://www.tau.ac.il/~ebenyose/CTV/current/index.html` | 2026-09-10／入口曾開啟，後續一次請求回傳 internal error | 可作正式發掘報告的索引入口 | 目錄頁本身不支持某個會幕構件；未能穩定讀取的頁面不作 claim 證據 | unverified |
| S-ARCH-THETORAH | *The Tabernacle in Its Ancient Near Eastern Context*，TheTorah.com | 學術／神學比較文章 | `https://www.thetorah.com/article/the-tabernacle-in-its-ancient-near-eastern-context` | 2026-09-10／全文頁可開啟，需依採用段落再核對引註 | 可呈現古代近東比較與研究分歧，必須標 interpretive | 不是出土會幕報告，不能證明模型的唯一比例或歷史外觀 | interpretive |

## 使用者提供參考檔

| source ID | 檔案／內容 | 類別 | 檢視日期／頁碼 | 權利／能支持的範圍 | 不能推及的範圍 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- |
| S-REF-FBI-BS-PDF | `docs/addition_info/FB_BS_Tabernacle_Walkthrough_StoryPlanner_EN.pdf`，FreeBibleimages | 使用者 PDF／故事規劃 | 2026-09-10／4頁逐頁抽取；頁1入口與方向，頁2祭壇／洗濯盆，頁3燈臺／餅桌／香壇，頁4贖罪日與搬運 | CC BY-NC 4.0 資訊可作導覽資訊架構與閱讀順序參考 | PDF 的象徵色彩、簡化敘事與英譯尺寸不直接成為經文 claim；原檔不隨網站發布 | reference-only |
| S-REF-FBI-YL-PDF | `docs/addition_info/FB_YL_Tabernacle_StoryPlanner_EN.pdf`，FreeBibleimages | 使用者 PDF／故事規劃 | 2026-09-10／8頁逐頁抽取；頁1–4結構／罩棚／分區，頁5–6器物／約櫃，頁7–8營地／搬運 | CC BY-NC 4.0；可參考資訊分層與鏡頭安排 | 其中的精確英尺換算、營位、人員安排與後世物件不能當成出25經文事實 | reference-only |
| S-REF-FBI-BS-PPTX | `docs/addition_info/FB_BS_Tabernacle_Walkthrough_PPW.pptx`，FreeBibleimages | 使用者投影片 | 2026-09-10／18張投影片；主要是圖片，無可抽取的可靠文字段落 | CC BY-NC 4.0；只作視覺構圖與可讀性參考 | 不複製圖片、投影片文字或把示意圖當史料 | reference-only |

## 模型與授權

| source ID | 文件 | 類別 | 檢視日期／定位 | 權利／能支持的範圍 | 不能推及的範圍 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- |
| S-ASSET-LICENSE | `docs/assets/LICENSE_AUDIT.md`、`src/data/assets.json` | 資產 provenance／授權 | 2026-09-10／17 個 runtime assets、Sketchfab author／UID／license／hash 欄位 | 支持下載權、署名、source／processed／runtime 對應與非商業界線 | 授權不證明模型符合出25，也不證明外觀是歷史事實 | approved-comparison |
| S-ASSET-BASELINE | `docs/qa/revamp/BASELINE_ASSETS.json` | 本次衍生計量 | 2026-09-10／17 個 processed GLB | 支持 bytes、三角面估算、材質／貼圖數與 asset-local bounds 的工程量測 | 不把 local bounds 當聖經尺寸，不代表瀏覽器已載入 | approved-comparison |

## R01 未解決與處理界線

- Tel Aviv University 入口的後一次 internal error 已記錄；在穩定讀取前不引用其內容。
- 「海狗皮／獾皮」等翻譯與古代材料辨識、肘的公制換算、燈臺未載高度與彎曲形狀、營地帳數與人物面貌，均不能由本臺帳自動轉為 verified。
- 任何來源只有 license 而沒有文字／考古定位時，只能做署名與資產追溯，不能支持歷史主張。
