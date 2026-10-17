# 04 現有專案研究與整合方式

研究日期：2026-10-18（commit `96c6d752`）。路徑皆相對於 repo 根目錄。

---

## 1. 現況（已確認的事實）

### 1.1 Quartz 與 plugin 系統
- Quartz v5，採 quartz-community plugin manager。plugin 在 `quartz.config.yaml` 宣告（`github:…` 或本地 `./plugins/…`），由 `npx quartz plugin install` 安裝到 `.quartz/plugins/`。
- `.quartz/` 不進版控；CI 每次重抓。**改 `.quartz/` 只影響本機建置，正式環境會被洗掉。**
- 本地 plugin 範本：`plugins/wiki-tour/`（tsup 打包、`.inline.ts` 轉成字串注入、scss 轉 CSS、`dist/` 進版控；改 `src/` 後要在 plugin 內 `npm run build`）。
- plugin 可同時屬於多個類別：`package.json` 的 `quartz.category` 可為陣列，例如 `["transformer","emitter","pageType","component"]`（`quartz/plugins/loader/config-loader.ts` 約 318–336 行）。
- 元件型別：`QuartzComponent` 可帶 `css`、`beforeDOMLoaded`、`afterDOMLoaded`（`node_modules/@quartz-community/types/dist/index.d.ts`）。
- Emitter 可輸出任意檔案；PageType 可用 `generate()` 產生虛擬頁（例如「我的筆記」頁）。

### 1.2 部署
- **GitHub Pages**（主要公開站）：`.github/workflows/deploy.yml`。觸發路徑：`content/**`、`quartz/**`、`plugins/**`、`quartz.ts`、`quartz.config.yaml`、`quartz.lock.json`、workflow 本身。
  - 「Configure GitHub Pages base URL」把 baseUrl 改成 `andyjr5566.github.io/Bible_wiki_zh_website`。
  - 「Setup local plugins」把 `plugins/wiki-tour`、`plugins/semantic-search` 複製進 `.quartz/plugins/`。
  - 互動網站由 `quartz/static/website/build.py --ci-build` 建置，只發佈各 app 的 `dist/`。
- **Vercel**：`vercel.json`（`cleanUrls`、`/static/sw.js` 加 `Service-Worker-Allowed`）。`quartz.config.yaml` 預設 baseUrl 是 `bible-wiki-zh-website.vercel.app`。
- **已有 serverless 後端**：`api/search.js`（Vercel Function，語意搜尋，CORS 只允許 `https://andyjr5566.github.io`）。Phase 2 Token 服務可沿用此平台。
- 建置驗證規則（`AGENT.md`）：用 `test_content`，`npx quartz build -d test_content -o <scratch>`；`content` 有一萬多個檔案，建置很久。

### 1.3 SPA 與頁面
- `enableSPA: true`。`quartz/components/scripts/spa.inline.ts`：用 micromorph 替換整個 `document.body`；換頁前發 `prenav`、換頁後發 `nav`（`detail.url`）；`window.addCleanup(fn)` 在下次換頁前執行。
- 影響：插入 body 的 UI 每次換頁都會被替換 → 必須在 `nav` 時重新掛載；長駐狀態（筆記引擎）要放在 `window` 上。
- wiki-tour 的做法可參考：`document.addEventListener("nav", onNav)`，localStorage／sessionStorage 包在 try/catch。
- 連結預覽（popover）會顯示其他頁內容 → 筆記 UI 不要掛進 popover。
- 版面群組：工具列 `toolbar`（深色模式、閱讀模式、搜尋在 left）；`right` 有 graph、TOC、backlinks；`afterBody` 目前無啟用元件（comments 已停用）。

### 1.4 PWA
- `quartz/static/manifest.json`：`display: standalone`、`start_url: ../`、`scope: ../`。
- `quartz/static/sw.js`：快取名 `bible-wiki-zh-v1`；navigation 與其他同源 GET 都是**網路優先並把成功回應寫入快取，沒有上限**；跨網域請求直接放行（Google API 不受影響）。
- 註冊在 `quartz/components/Head.tsx`（約 118–131 行），`scope` 為 baseDir。Head 也有 iOS 安裝引導腳本（`isStandaloneApp()`）。
- 風險：快取無上限 → 同網域儲存壓力大時，瀏覽器以網域為單位整包清除，會連 IndexedDB 筆記一起清掉。

### 1.5 內容
- 章節檔：`content/01 創世記/第10章.md` → slug `01-創世記/第10章`。
- 經文是 Markdown 有序列表（`1. …`，含大量 `[[wiki-link|顯示文字]]`），之後接 `---` 與 `## 本章知識節點` 等段落。
- 線上渲染為**沒有 ID 的 `<li>`**（已抓 GitHub Pages 線上頁確認）。
- **content 仍在建置中**：目前 6 卷有章節檔（創世記 50、出埃及記 40、利未記 27、民數記 36、申命記 34、約書亞記 24，共 211 章）；01–43 有書卷資料夾，其餘多為目錄與導論。格式、節點名稱、資料夾結構都可能再變。
- `content/` 多數由 `sync_content.ps1` 從 `C:\Obsidian\Hermes\scripture` 鏡像（書卷資料夾、appendix、link_folder、index.md 等）→ 在 repo 改這些會被下次同步覆蓋；**不可修改 vault**。`content/教學/` 是 repo 自有，可直接編輯。首頁「功能教學與新手指南」清單由 sync 腳本注入。
- `static/contentIndex.json` 線上約 19.7 MB → 筆記功能不可依賴它。
- 互動網站在 `quartz/static/website/<書卷>/<app>/dist`，同網域獨立 app（Phase 3 才考慮整合）。
- 分析：Plausible（不設 cookie）。

---

## 2. 整合方案

### 2.1 新增 `plugins/personal-notes/`

```
plugins/personal-notes/
├── package.json        quartz.category: ["transformer","emitter","pageType","component"]
├── tsup.config.ts      沿用 wiki-tour（inline script、scss）；另打包 client bundle
├── tsconfig.json
├── vitest.config.ts    （與 graph／semantic-search 一致）
├── src/
│   ├── index.ts                 匯出各類別工廠與 manifest
│   ├── transformer.ts           Phase 1：在章節頁 article 標記 data-bwz-ref（如 GEN.10）
│   │                            Phase 2：經節 <li> 加 id/data-v（防禦式）
│   ├── emitter.ts               輸出 static/personal-notes/：app-<hash>.js、config.json、
│   │                            （Phase 2）link-index.json
│   ├── pageType.ts              虛擬頁「我的筆記」（slug 例：my-notes）
│   ├── components/
│   │   ├── NotesToolbarButton.tsx  工具列：登入／同步狀態（延遲載入 app）
│   │   ├── ChapterNotesMount.tsx   afterBody：章節頁的筆記面板掛載點
│   │   └── scripts/*.inline.ts     小型啟動腳本：偵測頁面、按需載入 app
│   └── client/                  延遲載入的筆記引擎（store/model/merge/sync/adapter/auth/ui）
├── test/                       合併、HLC、schema、假 Drive 多裝置模擬
└── dist/                       建置產物（進版控）
```

- 章節頁判斷：slug 符合 `^(\d{2})-[^/]+/第(\d+)章$` → 編號查附錄 A 得書卷代碼。不符就不掛載（不報錯）。
- 程式體積目標：注入每頁的啟動腳本 < 3 KB；延遲載入的 app < 60 KB gzip（可用 Preact，網站 SSR 已使用 Preact）。

### 2.2 需要修改的既有檔案

| 檔案 | 修改 | 階段 |
|---|---|---|
| `quartz.config.yaml` | 新增 `./plugins/personal-notes` 項目（options：clientId、syncEnabled 等；layout：toolbar 按鈕＋afterBody 掛載點） | Phase 1 |
| `.github/workflows/deploy.yml` | 「Setup local plugins」加 `rm -rf` 與 `cp -r plugins/personal-notes .quartz/plugins/personal-notes` | Phase 1 |
| `quartz/static/sw.js` | 快取上限（例如 navigation 300 筆 LRU）、更新快取名；不攔截 `static/personal-notes/config.json`（或改網路優先不快取） | Phase 1 |
| `content/教學/個人筆記使用說明.md`、隱私權政策頁 | 新增（repo 自有資料夾） | Phase 1 |
| `sync_content.ps1` | 在首頁注入「個人筆記」說明連結 | Phase 1 |
| `quartz/static/personal-notes-poc/` | PoC 測試頁（暫定 D-19），Phase 1 完成後刪除 | Phase 0 |
| `plugins/wiki-tour` | 加筆記功能導覽站點 | Phase 2 |
| `api/auth/*.js` 或 Cloudflare Worker | Token 服務 | Phase 2 |

**不動**：content 經文與 vault 同步檔、`C:\Obsidian\Hermes`、`.quartz/`、其他 community plugin、`quartz/components/Head.tsx`（GIS 由 app 動態載入）。

### 2.3 OAuth 授權來源
- Google 的「已授權 JavaScript 來源」只認 origin（不含路徑）：`https://andyjr5566.github.io` 會涵蓋此帳號所有 GitHub Pages 專案站。
- 本機測試：`http://localhost:8080`（`npx quartz build --serve` 預設埠）。
- 若 Vercel 版也要能登入：加 `https://bible-wiki-zh-website.vercel.app`。
