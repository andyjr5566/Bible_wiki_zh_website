import type { QuartzComponent, QuartzComponentProps } from "@quartz-community/types";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/tour.inline.ts";
// @ts-expect-error - css imported as string by esbuild loader
import style from "./styles/tour.scss";

const TourLauncher = ((() => {
  const Component: QuartzComponent = ({ cfg, fileData }: QuartzComponentProps) => {
    const locale = cfg.locale ?? "zh-TW";
    const isIndex = fileData.slug === "index" || fileData.slug === "";

    if (!isIndex) {
      return null;
    }

    return (
      <div class="wiki-tour-launcher" data-tour-launcher="true" aria-label="快速入門導覽">
        <button
          class="wiki-tour-button"
          type="button"
          data-tour-open="true"
          aria-label={locale === "zh-TW" ? "啟動快速入門導覽" : "Start quick tour"}
        >
          🚀 快速入門導覽
        </button>
      </div>
    );
  };

  Component.afterDOMLoaded = script;
  Component.css = style;
  return Component;
}) satisfies QuartzComponent) as unknown as QuartzComponent;

export default TourLauncher;
