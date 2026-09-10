# R10 五件器物資產登記

五件 detail 資產依序在乾淨的 Blender 5.2.1 背景程序中處理。每件都先讀取來源，再建立四個取景（Front、Side、Top、Close），匯出 staging GLB，經 glTF Transform 4.4.2 優化後重新匯入；build 與 reimport 的物件、網格、三角面和 bounds 均通過比對。

| 器物 | source SHA-256 | processed/public SHA-256 | objects / meshes / triangles | 材質摘要 |
| --- | --- | --- | --- | --- |
| 燔祭壇 | `cfce6b18f5467ddecf325e0883f8aa6400bcd7cd99ab1a5640a84a8918bdd14b` | `5b2c307d1272eb14c535d4a516ed14003e965333c55442b21755997fd412aa33` | 15 / 7 / 53,166 | Copper-Brass；含本體與來源配套器具 |
| 洗濯盆 | `e50a5b0d54d39bab61abbbdad24dd00a731089eea218197ae45d376b0c7c15f3` | `22c827c69062080a510f6268f8f2413ab8569eed4deccd29c21f98e446403c21` | 5 / 2 / 7,672 | Copper-Brass、Meta-water |
| 香壇 | `03b8863c97c51c007ea02268fcd1b3de5f31df927e1f25acd2bed64e6b2028fb` | `dd433e4ccedd1c29212ebcb17003db0b206cb4580fad7c173c8744c0f37a20af` | 6 / 4 / 72,040 | Gold、Copper-Brass、Frankincense |
| 金燈臺 | `eebae6562001cf9470e15d09da96061050da4f435d07401d1e8d4a81ff2252a8` | `7f9f8d43e486f653b7f25572aa1cb5d50466beb00540956376299ebf02cad197` | 25 / 12 / 55,632 | Gold；七盞燈與來源工具節點 |
| 陳設餅桌 | `3568f0a6208701a1fe34d7a43e691474037e5025496d35de65969ae9fbbb0160` | `51cbaa81c1670fd8ad7f78f4e05c335f3298b4dc3268cc9bd74216a3de9e5d1f` | 4 / 2 / 80,151 | Gold、來源 Material；餅堆未獨立成 mesh |

洗濯盆的第二個節點是來源水面示意，沒有把它解讀成經文指定的水龍頭或裝飾。香壇的四個 Crown 節點只記為來源節點；陳設餅的數量與擺列由 R14 資料層說明，不從沒有獨立 mesh 的部分倒推出幾何。

每件的完整 config、blend、staging GLB、r10 manifest 與八張前後預覽位於 `assets/staging/blender/r10/<asset-id>/`；對應的來源、授權和 runtime 路徑仍由 `src/data/assets.json` 與 `public/models/manifest.json` 管理。
