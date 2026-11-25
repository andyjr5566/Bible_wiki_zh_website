import { pageText } from "./text.mjs"
import { cacheKey } from "./cache.mjs"

// 語意搜尋只收知識庫本身：link_folder（人物、地點…以及日後新增的資料夾）與 appendix。
// 標籤索引頁、「我的筆記」、教學與網站說明頁不收（它們不是知識內容；字面搜尋照舊找得到）。
const KNOWLEDGE_PREFIXES = ["link_folder/", "appendix/"]

export function isKnowledgeContentSlug(slug) {
  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    // 編碼壞掉就用原字串
  }
  return KNOWLEDGE_PREFIXES.some((prefix) => decoded.startsWith(prefix))
}

// 保險：知識庫還在寫，若有條目只建了標題、內文是空的，向量只代表標題，
// 短查詢會把它排到前面、點進去卻什麼都沒有，所以內文（去掉空白）少於這個字數就先不收。
export const MIN_CONTENT_CHARS = 10

/**
 * 從 contentIndex 取出要收錄的頁面。
 * @param index contentIndex.json 解析後的物件（slug → { title, content }）
 * @param isIncluded (slug) => boolean，呼叫端傳入 getKnowledgeSearchCategory(slug) !== null，規則只在 searchLogic.ts 一份
 * @param model 模型 id（算快取鍵）
 * 只收 isKnowledgeContentSlug 的頁面；內文（去掉空白）少於 MIN_CONTENT_CHARS 字的也略過。
 * 依 slug 排序，讓輸出與 contentIndex 的鍵順序無關。
 */
export function selectPages(index, isIncluded, model) {
  return Object.keys(index)
    .filter((slug) => isIncluded(slug) && isKnowledgeContentSlug(slug))
    .filter((slug) => Array.from(String(index[slug]?.content ?? "").replace(/\s+/g, "")).length >= MIN_CONTENT_CHARS)
    .sort()
    .map((slug) => {
      const text = pageText(index[slug]?.title, index[slug]?.content)
      return { slug, text, key: cacheKey(model, text) }
    })
}
