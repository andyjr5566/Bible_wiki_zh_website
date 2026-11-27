/** 「換個譯法，也找得到相關經文」區塊的所有門檻、清單與上限，集中在這裡。 */

/** 查詢字數（清理後）：少於下限不展開（單字太籠統），多於上限不展開（整句話）。 */
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 8;

/** 讀者的詞至少要有這麼多處，被和合本拿來翻同一原文字、同一意思，才顯示那張卡。 */
export const MIN_RENDERING_COUNT = 2;

/** 超常見的原文字（kol、hayah、amar、ben、bo、asah、natan）：靠譯法比對時不展開。 */
export const EXCLUDED_STRONG_IDS: ReadonlySet<string> = new Set([
  "H3605",
  "H1961",
  "H559",
  "H1121",
  "H935",
  "H6213",
  "H5414",
]);

export const MAX_CARDS = 3;
/** 比例條與譯法標籤最多幾種，其餘併成「其他 N」。 */
export const MAX_CHIPS = 5;
/** 「列出」展開後一次顯示幾節。 */
export const LIST_PAGE_SIZE = 30;
/** 「這個字的其他用法」最多列幾個。 */
export const MAX_OTHER_SENSES = 4;

export const ORIGINAL_STUDY_ATTRIBUTION = "原文資料：MACULA、STEP Bible";
/** 區塊標題旁「這是什麼？」連到的教學頁（content/教學/換個譯法找經文.md）。 */
export const ORIGINAL_STUDY_HELP_SLUG = "教學/換個譯法找經文";
export const ORIGINAL_STUDY_HELP_LABEL = "這是什麼？";
export const ORIGINAL_STUDY_DISCLAIMER =
  "同一個原文詞在不同經文中可能有不同用法；文字對應由資料整理，仍可能有誤，請配合上下文閱讀。";
