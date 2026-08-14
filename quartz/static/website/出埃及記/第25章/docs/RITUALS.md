# 儀式資料規範

儀式由 `src/data/rituals.json` 定義，不能把儀式步驟、角色動作或神學意義直接寫死在 UI 元件中。

```json
{
  "id": "priest-washing",
  "location": "laver",
  "scripture": ["Exodus 30:17-21"],
  "confidence": "textual",
  "steps": []
}
```

## 可相信度標籤

- `textual`：經文直接描述的器具、規定或順序。
- `reconstructed`：為了空間與動畫呈現所做的合理重建。
- `interpretive`：存在學術或傳統解釋差異。

## 目前實作

`rituals.json` 現有六個資料驅動的教學序列：祭司洗濯、燈臺服事、陳設餅、獻香、燔祭（非血腥閱讀）與贖罪日。每個儀式和每個步驟均具有：

- `scripture`：可在 `scriptures.json` 找到的經文索引。
- `focus`：對應的 3D 物件，供鏡頭安全移動。
- `confidence`：文本或重建層級。
- `notice`：說明哪些內容只是鏡頭、角色與場景的教育性可視化。
- `visualization`：明確指定 `actor`、安全 `target`、簡化 `pose` 與 `reconstructed` 信心標記。它讓角色呈現教學位置與姿勢，不能被視為經文逐格記錄的動作。

`RitualDirector` 只管理選擇與步驟移動；`CharacterManager` 讀取當前步驟的 `visualization`，以程序化 placeholder 呈現走近與簡化服務姿勢。兩者都不創作禱詞、對白或未有資料支持的儀式行為。現階段尚無第三方 rig、骨架動畫或宣稱為歷史動作的動作捕捉。

贖罪日固定顯示「這不是日常進出，而是贖罪日的特殊儀式」。自由探索仍被幔子阻擋；只有 `day-of-atonement` 可宣告 `specialAccess`，並僅供受控閱讀視角與研究用角色示意，不會放寬玩家碰撞規則。對至聖所的閱讀由受控鏡頭和剖面模式完成。
