# R09 會幕場景與照明政策

## 目的

R09 先把場景整理成可閱讀的基線。會幕、器物與材質是前景；沙丘、山脊與營地只提供方向感，不替經文補上沒有記載的地貌或營位數量。

## 場景分組

- `canonical-world-root`：會幕與互動資產的共同座標根。
- `desert-art-direction`：天空、地形、遠景山脊與中性營地背景。
- `cue-menorah-flames`：燈臺火焰，預設隱藏，等待 R14 的程序 cue。
- `cue-incense-smoke`：香壇煙霧，預設隱藏，等待 R13 的程序 cue。
- `cue-burnt-offering-fire`：燔祭壇餘燼與局部光，預設隱藏，等待 R15 的程序 cue。
- `ambient-dust-motes`：室內低強度塵埃粒子，作為閱讀環境，不代表儀式事件。

Shekinah 光球、光柱、夜間火柱以及以粗錐體表示的預設祭壇火已從基線場景移除。需要敘事特效時，播放器只能透過 `ParticleEffects.setCue()` 啟用已核准的事件。

## 照明基線

`midday` 是預設閱讀光照。主光、柔和補光、聖所環境光與約櫃聚焦光各自負責輪廓、材質與局部辨識，不用過曝抵銷材質問題。`dawn` 和 `night` 仍保留為可切換且已校準的時間氣氛；夜間按鈕只代表夜間照明，不宣稱火柱顯現。

R09 將渲染曝光調為 `0.98`，並把聖所環境光／約櫃聚焦光的預設強度降至 `4.5`／`6.5`。切換氣氛時的局部光強度也維持在可辨識範圍，避免地板洗白與金材質閃爍。

## 背景約束

營地每種材質由 24 個 instance 減為 12 個，三圈合計 36 頂示意帳篷；遠景顏色改為低飽和中性灰棕，營火改為六個低亮度標記。這些數字是渲染效能與畫面干擾的工程參數，不是歷史配置主張。

## 驗收畫面

- [R09 前版約櫃細節](../qa/revamp/screenshots/r09-before-ark-detail-desktop.png)
- [R09 後版約櫃細節](../qa/revamp/screenshots/r09-ark-detail-desktop.png)
- [R09 後版場景總覽](../qa/revamp/screenshots/r09-overview-desktop.png)

