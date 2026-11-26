import { QuartzComponent } from '@quartz-community/types';
import * as preact from 'preact';

declare const _default: () => QuartzComponent;

type Testament = "ot" | "nt";
interface BibleBook {
    num: number;
    name: string;
    short: string;
    chapters: number;
    group: string;
}

interface CatalogEntry {
    book: BibleBook;
    status: "ready" | "outline" | "empty";
    chapters: number[];
    hasToc: boolean;
    hasIntro: boolean;
}

interface BookGridProps {
    /** buildCatalog 的結果（伺服器端算一次）。 */
    catalog: readonly CatalogEntry[];
    /** 目前頁的 slug，用來產生相對連結。 */
    fromSlug: string;
    /** 同一頁有多個格子時要唯一（用在分頁的 id）。 */
    idPrefix: string;
    /** 目前這一卷（會標示 aria-current）；沒有就不傳。 */
    currentBookNum?: number;
    /** 預設開哪個約；用戶端沒有閱讀紀錄時維持這個值。 */
    defaultTestament?: Testament;
    /**
     * 沒有目前書卷時，是否讓用戶端依閱讀紀錄（localStorage bwz-reading）改選預設的約。
     * 預設 true；首頁與左欄的行為因此一致。
     */
    autoTab?: boolean;
    /** chips＝依文字寬度排的全名小標籤（左欄）；grid＝等寬格（首頁，較寬）。 */
    layout?: "chips" | "grid";
}
declare function BookGrid({ catalog, fromSlug, idPrefix, currentBookNum, defaultTestament, autoTab, layout, }: BookGridProps): preact.JSX.Element;

interface ChapterGridProps {
    entry: CatalogEntry;
    fromSlug: string;
    /** 目前這一章；全書目錄、書卷導論頁沒有。 */
    currentChapter?: number;
}
declare function ChapterGrid({ entry, fromSlug, currentChapter }: ChapterGridProps): preact.JSX.Element;

export { BookGrid, type BookGridProps, _default as BookPicker, ChapterGrid, type ChapterGridProps };
