import type { QuartzComponent } from "@quartz-community/types";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/readaloud.inline.ts";
// @ts-expect-error - css imported as string by esbuild loader
import style from "./styles/readaloud.scss";

// The component renders nothing. The read-aloud bar is mounted by the inline
// script on every page, so this component only wires up the script and styles.
const ReadAloud = ((() => {
  const Component: QuartzComponent = () => null;

  Component.afterDOMLoaded = script;
  Component.css = style;
  return Component;
}) satisfies QuartzComponent) as unknown as QuartzComponent;

export default ReadAloud;
