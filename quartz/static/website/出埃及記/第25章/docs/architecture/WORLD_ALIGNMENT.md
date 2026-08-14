# Canonical World Alignment

更新日期：2026-08-11  
用途：非商業會幕空間研讀。

## 固定座標契約

- Three.js world 是 Y-up，邏輯單位為 meter。
- 東門／入口是 `+Z`；向 `-Z` 依序為燔祭壇、洗濯盆、聖所、至聖所。
- `locations.json`、player spawn、collision、Tour、Learning targets、Map 與所有 GLB transform 共用同一 frame。
- 地圖投影為 `mapY = (maxZ - worldZ) / (maxZ - minZ)`；因此東門在圖上方，至聖所在下方。

## Hero 校正與 bounds

| Asset | Source-to-world transform | World bounds（min → max） | 用途 |
| --- | --- | --- | --- |
| `tabernacle-main` | Y `-90°`，scale `0.3` | `(-10.775,-0.041,-20.031)` → `(10.775,3.170,20.031)` | desktop hero |
| `tabernacle-framework` | rotation `0°`，scale `0.5` | `(-2.878,0,-8.506)` → `(2.879,5.020,7.681)` | structural only |
| `tabernacle-lowpoly` | rotation `0°`，scale `1` | `(-11.864,-1.660,-12.490)` → `(13.042,19.056,12.349)` | explicit fallback only |

主模型的原始 X 軸經 `-90°` Y rotation 轉到 canonical Z 軸。程式只在 `WorldAlignment.applySourceToWorld()` 套用 manifest transform，避免各模式各自補角度。

## Location anchors

| Location | World position | Map point | Facing |
| --- | --- | --- | --- |
| 東門 | `(0,0,+18)` | `(0.5,0.0909)` | yaw `0`，面向 `-Z` |
| 燔祭壇 | `(0,0,+9)` | `(0.5,0.2955)` | yaw `0` |
| 洗濯盆 | `(0,0,0)` | `(0.5,0.5)` | yaw `0` |
| 聖所 | `(0,0,-5)` | `(0.5,0.6136)` | yaw `0` |
| 至聖所 | `(0,0,-9)` | `(0.5,0.7045)` | yaw `0` |

世界邊界為 X `[-12,12]`、Z `[-22,22]`。Walking 的 W 在 yaw `0` 時沿 `-Z` 前進；地圖玩家標記由目前 world position 以同一公式即時計算。

## Detail 與參考圖界線

器具 detail 的 transform 也使用同一 frame，但只在 structural profile 掛載。`docs/addition_info` 的 overview、outer court、holy place、most holy 圖片只用於空間敘事、光線與視覺節奏；圖中的裝飾、角色、布幕樣式與動作不能升格為歷史事實。
