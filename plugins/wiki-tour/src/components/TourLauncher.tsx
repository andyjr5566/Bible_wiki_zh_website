import type { QuartzComponent, QuartzComponentProps } from "@quartz-community/types";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/tour.inline.ts";
// @ts-expect-error - css imported as string by esbuild loader
import style from "./styles/tour.scss";

// The component itself only renders the launcher card on the home page.
// The tour engine (welcome card, help button, `?` help center, contextual hints)
// is mounted by the inline script on every page.
const TourLauncher = ((() => {
  const Component: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const isIndex = fileData.slug === "index" || fileData.slug === "";

    if (!isIndex) {
      return null;
    }

    return (
      <div class="wiki-tour-launcher" data-tour-launcher="true">
        <span class="bwz-seal" aria-hidden="true">
          導
        </span>
        <div class="wiki-tour-launcher-body">
          <strong>第一次來嗎？</strong>
          <span>跟著讀一段〈出埃及記 12 章〉，約 2 分鐘學會搜尋、連結預覽、追主題和查來源。</span>
        </div>
        <div class="wiki-tour-launcher-actions">
          <button class="bwz-btn primary" type="button" data-tour-open="true">
            開始互動導覽
          </button>
          <button class="bwz-btn" type="button" data-tour-help="true" aria-label="打開說明中心（快捷鍵 ?）">
            說明中心 <kbd>?</kbd>
          </button>
        </div>
      </div>
    );
  };

  Component.afterDOMLoaded = script;
  Component.css = style;
  return Component;
}) satisfies QuartzComponent) as unknown as QuartzComponent;

export default TourLauncher;
