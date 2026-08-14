# 部署說明

## 為什麼不能直接部署根目錄 `index.html`

根目錄的 `index.html` 載入 `/src/main.ts`，它是 Vite 的開發入口，不是瀏覽器可
直接從靜態主機執行的檔案。`npm run build` 會把 TypeScript、CSS 和 `public/`
底下的模型複製到 `dist/`，因此部署時必須發布 `dist/` 的內容。

因此，從 Obsidian 直接點開本機 `file:///.../dist/index.html` 會被瀏覽器安全策略
阻擋，頁面會顯示啟動提示，不會嘗試把 `file://` 當成正式部署方式。要在本機查看，
請執行 `npm run dev` 後開啟 `http://127.0.0.1:3001/`；正式環境則必須透過 HTTP
靜態主機提供網站。

## 建置與匯出

在 repository 根目錄執行：

```bash
python appendix/website/build.py --build --deploy-dir .tmp/website-deploy
```

流程會：

1. 找到 `appendix/website` 下具有 `package.json`、`src/` 和 Vite 設定的章節。
2. 在每個章節執行既有的 `npm run build`（包含 typecheck、測試、架構與資產驗證）。
3. 將 Vite 專案的 `dist/` 複製到 `<deploy-dir>/<書名>/<章節>/`，並原樣保留靜態
   HTML 入口（例如創世記第 6 章的挪亞方舟頁面）。
4. 產生部署根目錄 `index.html` 與 `interactive-websites.json`。

把 `.tmp/website-deploy` 設定為 Vercel、Netlify、GitHub Pages 或任何靜態主機的
publish directory 即可。也可以只執行 `--build`，然後直接發布該章節的
`dist/`。

## 使用既有 `sync_content.bat`

不修改同步腳本時，先在本專案建置 `dist/`，再執行既有同步流程：

```powershell
Set-Location C:\Obsidian\Hermes\scripture\appendix\website\出埃及記\第25章
npm run build
& C:\Obsidian\Bible_wiki_zh_website_quartz\sync_content.bat
```

同步腳本會把已存在的 `dist/` 一併複製到 Quartz 的靜態網站目錄；網路部署後，
連結才會以 `https://` 載入。直接從 Hermes 的 Markdown 點出的 `file:///` 連結只能
顯示本機啟動提示，不能當成正式網站入口。

## 附錄索引

不帶參數執行：

```bash
python appendix/website/build.py
```

會列出可用的網站入口。靜態 HTML 仍從章節根目錄掃描；Vite 專案則只列出已成功
建置的 `dist/index.html`，避免把不可部署的 `/src/main.ts` 開發入口放進附錄連結。

## 授權界線

這個專案與匯出的部署版本維持非商業教育／研讀用途。Sketchfab 模型的作者、原始
網址、授權與下載紀錄請以 `docs/ASSETS.md`、`docs/assets/LICENSE_AUDIT.md` 為準。
