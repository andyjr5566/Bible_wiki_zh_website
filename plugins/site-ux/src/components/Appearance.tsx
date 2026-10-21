import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
// @ts-expect-error - inline script imported as string by esbuild loader
import earlyScript from "./scripts/early.inline.ts";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/appearance.inline.ts";
// @ts-expect-error - css imported as string by esbuild loader
import style from "./styles/appearance.scss";

// 左上工具列的「Aa 外觀」按鈕（取代原本看不出用途的「素」按鈕）。
// 面板在按下按鈕時才由 appearance.inline.ts 建立；early.inline.ts 在 <head> 先把已存設定套到 <html>。
const Appearance: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <button
      type="button"
      class={displayClass ? `${displayClass} site-ux-btn` : "site-ux-btn"}
      aria-label="外觀"
      title="外觀：底色、字級、經文連結"
      aria-haspopup="dialog"
      aria-expanded="false"
    >
      <span class="site-ux-aa" aria-hidden="true">
        Aa
      </span>
    </button>
  );
};

Appearance.beforeDOMLoaded = earlyScript;
Appearance.afterDOMLoaded = script;
Appearance.css = style;

export default (() => Appearance) satisfies QuartzComponentConstructor;
