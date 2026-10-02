# 潔淨與不潔淨：利未記 11–15 章互動導覽

我們用營中的一家人（虛構）為例子，一章看他們碰到一件事：死蜥蜴掉進瓦罐、生孩子、皮膚起斑、回到營裡、身體的漏症。規矩一律附經節；註釋家的分歧集中在最後一幕「各家怎麼讀」。

八幕全部完成：序幕、第 11–15 章（每章一段 3D 故事，加上故事下面的互動內容）、總覽、各家怎麼讀。

## 開發

建置一律在 **PowerShell** 跑（Git Bash 下 Windows 應用程式控制會擋 rollup 的原生模組）：

```powershell
npm run dev       # http://127.0.0.1:3012
npm run build     # 型別檢查 + 資料閘門 + vite build → dist/
```

網址是 hash 路由：`#/intro`、`#/c11` … `#/c15`、`#/overview`、`#/voices`、`#/about`。`#/voices/girl` 這樣可以直接打開「各家怎麼讀」的某一題。

## 資料

| 檔案 | 內容 |
| --- | --- |
| `src/data/story.ts` | 幕次、序幕（能走多近、不潔淨有多久、五章各講什麼） |
| `src/data/ch11.ts` … `ch15.ts` | 各章的內容：規矩、註釋家原話、新約、原文層，以及該章的 3D 分鏡（`REEL_xx`） |
| `src/data/reels.ts` | 第 11 章的 3D 分鏡 |
| `src/data/overview.ts` | 總覽：不潔淨有多久的時間軸、好了以後要獻什麼、利10:10 → 11–15 → 利16 |
| `src/data/topics.ts` | 各家怎麼讀：十四個題目，每題把來源的說法並排 |
| `src/data/registry.ts` | 全站所有帶出處的句子和註釋原話，交給資料閘門檢查 |
| `src/data/verses.json` | `npm run verses` 從 `raw_scripture` 抽出的和合本經文 |
| `src/data/silhouettes.json` | `npm run silhouettes` 從 PhyloPic 下載的剪影（只收 CC0／公眾領域／CC BY），含作者與授權 |

`src/data/data.test.ts` 是資料閘門：每段「」摘句要逐字出現在所引經節；註釋家原話要逐字出現在 `03 利未記/第{章}章.md` 的「」裡；英文來源（KC、BH）只轉述、不加引號。對不上，網站就不會建置。

原文與詞義取自本庫 `raw_data/stepbible_leviticus_11.txt` 到 `_15.txt`（STEP Bible／STEPBible-Data，CC BY 4.0）。

## 3D

`src/three/camp.ts`：營地（會幕院子沿用利未記 1–9 章網站的 `courtyard.glb`）、帳棚、這一家人、晝夜、不潔淨的標示圈。營地大小與帳棚數目是示意，不按比例。

每一步的動作寫在 `Beat.cues`：鏡頭（`cam`、`follow`）、走路（`walk`）、道具（`prop`）、動作（`act`：坐下、躺下、摸、撕衣、灑血…）、對話（`say`）、時間快轉（`count`：太陽月亮在天上繞圈，不用畫面明暗閃爍）。

使用者按下的播放只看本站的「減少動態」開關（`animOff`）；裝飾性的自動旋轉才跟著作業系統的偏好（`motionOff`）。
