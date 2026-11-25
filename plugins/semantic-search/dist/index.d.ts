import { QuartzComponent } from '@quartz-community/types';

/** 問卷預填連結：網址、題目代碼與預選項目都來自 quartz.config.yaml，這裡只負責組網址。 */
interface FeedbackFormConfig {
    readonly url: string;
    /** 「回饋類型」題（單選）的 entry 代碼，與預選的選項文字。 */
    readonly choiceEntry: string;
    readonly choiceValue: string;
    /** 帶入讀者搜尋詞的題目 entry 代碼。 */
    readonly queryEntry: string;
}

type SearchField = "title" | "content" | "tags";
interface SearchOptions {
    enablePreview: boolean;
    fieldPriority: SearchField[];
    /** 經文結果底部的「找不到經文？」問卷提示；不設定就不顯示。 */
    feedbackForm?: FeedbackFormConfig;
}
declare const _default: (userOpts?: Partial<SearchOptions>) => QuartzComponent;

export { _default as Search, type SearchField, type SearchOptions };
