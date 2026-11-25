/** 問卷預填連結：網址、題目代碼與預選項目都來自 quartz.config.yaml，這裡只負責組網址。 */
export interface FeedbackFormConfig {
  readonly url: string;
  /** 「回饋類型」題（單選）的 entry 代碼，與預選的選項文字。 */
  readonly choiceEntry: string;
  readonly choiceValue: string;
  /** 帶入讀者搜尋詞的題目 entry 代碼。 */
  readonly queryEntry: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** 設定缺漏或格式不對就回傳 null（此時不顯示問卷提示）。 */
export function parseFeedbackFormConfig(raw: unknown): FeedbackFormConfig | null {
  if (typeof raw === "string") {
    try {
      return parseFeedbackFormConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || raw === null) return null;
  const { url, choiceEntry, choiceValue, queryEntry } = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(url) ||
    !isNonEmptyString(choiceEntry) ||
    !isNonEmptyString(choiceValue) ||
    !isNonEmptyString(queryEntry)
  ) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, choiceEntry, choiceValue, queryEntry };
}

/** 空白一律編成 %20，避免表單把「+」當成字面加號。 */
export function buildFeedbackFormUrl(config: FeedbackFormConfig, query: string): string {
  const pairs: Array<[string, string]> = [
    ["usp", "pp_url"],
    [config.choiceEntry, config.choiceValue],
    [config.queryEntry, query.trim()],
  ];
  const separator = config.url.includes("?") ? "&" : "?";
  return (
    config.url +
    separator +
    pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
  );
}
