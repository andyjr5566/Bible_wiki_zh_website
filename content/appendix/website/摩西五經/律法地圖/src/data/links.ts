/**
 * 連回知識庫：連到公開 GitHub 專案裡渲染好的網頁（不需要 Obsidian、任何裝置都打得開），
 * 作法與民數記 33 章網站（appendix/website/民數記/第33章/src/data/sites.ts）相同。
 * 網站會放上公開網域，所以不用只在本機有效的 obsidian:// 網址。
 * 知識庫的內容不搬進本站：本站只給條目名稱與一句簡介，完整內容一律連過去讀。
 */
// 換網域時建置前設 VITE_WIKI_BASE（例如 VITE_WIKI_BASE=https://example.org/wiki npm run build）。
export const WIKI_BASE = ((import.meta.env?.VITE_WIKI_BASE as string | undefined) || 'https://andyjr5566.github.io/Bible_wiki_zh_website').replace(/\/+$/, '');

/** 條目頁：…/link_folder/<類型>/<條目> */
export const entryUrl = (type: string, title: string): string =>
  `${WIKI_BASE}/link_folder/${encodeURIComponent(type)}/${encodeURIComponent(title)}`;

/** 章節頁：…/02-出埃及記/第21章（公開網站把資料夾的空白換成連字號） */
export const chapterUrl = (bookNum: number, bookName: string, chapter: number): string =>
  `${WIKI_BASE}/${encodeURIComponent(`${String(bookNum).padStart(2, '0')}-${bookName}`)}/${encodeURIComponent(`第${chapter}章`)}`;
