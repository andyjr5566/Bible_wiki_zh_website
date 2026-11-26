import type { QuartzComponent } from "@quartz-community/types";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/verseReturn.inline.ts";
// @ts-expect-error - css imported as string by esbuild loader
import style from "./styles/verseReturn.scss";

// 元件本身什麼都不畫：「↩ 返回」按鈕由每頁都會載入的腳本在換頁時（nav）掛上去，
// 這個元件只負責把腳本和樣式接進網站（寫法同 read-aloud）。
const VerseReturn = ((() => {
  const Component: QuartzComponent = () => null;

  Component.afterDOMLoaded = script;
  Component.css = style;
  return Component;
}) satisfies QuartzComponent) as unknown as QuartzComponent;

export default VerseReturn;
