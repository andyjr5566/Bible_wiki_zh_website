import { pageText } from "./text.mjs"
import { cacheKey } from "./cache.mjs"

/**
 * 從 contentIndex 取出要收錄的頁面。
 * @param index contentIndex.json 解析後的物件（slug → { title, content }）
 * @param isIncluded (slug) => boolean，呼叫端傳入 getKnowledgeSearchCategory(slug) !== null，規則只在 searchLogic.ts 一份
 * @param model 模型 id（算快取鍵）
 * 依 slug 排序，讓輸出與 contentIndex 的鍵順序無關。
 */
export function selectPages(index, isIncluded, model) {
  return Object.keys(index)
    .filter((slug) => isIncluded(slug))
    .sort()
    .map((slug) => {
      const text = pageText(index[slug]?.title, index[slug]?.content)
      return { slug, text, key: cacheKey(model, text) }
    })
}
