import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import { classNames } from "../util/lang";
import { i18n } from "../i18n";
import style from "./styles/graph.scss";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/graph.inline.ts";

export interface D3Config {
  drag: boolean;
  zoom: boolean;
  depth: number;
  scale: number;
  repelForce: number;
  centerForce: number;
  linkDistance: number;
  fontSize: number;
  opacityScale: number;
  removeTags: string[];
  showTags: boolean;
  focusOnHover?: boolean;
  enableRadial?: boolean;
}

export interface GraphOptions {
  localGraph?: Partial<D3Config>;
  globalGraph?: Partial<D3Config>;
  enableGlobal?: boolean;
}

const defaultOptions: GraphOptions = {
  enableGlobal: true,
  localGraph: {
    drag: true,
    zoom: true,
    depth: 1,
    scale: 1.1,
    repelForce: 0.5,
    centerForce: 0.3,
    linkDistance: 30,
    fontSize: 0.6,
    opacityScale: 1,
    showTags: true,
    removeTags: [],
    focusOnHover: false,
    enableRadial: false,
  },
  globalGraph: {
    drag: true,
    zoom: true,
    depth: 1,
    scale: 1.1,
    repelForce: 0.5,
    centerForce: 0.3,
    linkDistance: 40,
    fontSize: 0.65,
    opacityScale: 1,
    showTags: true,
    removeTags: [],
    focusOnHover: true,
    enableRadial: false,
  },
};

export default ((userOpts?: Partial<GraphOptions>) => {
  const Graph: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const enableGlobal = userOpts?.enableGlobal ?? defaultOptions.enableGlobal ?? true;
    const localGraph = { ...defaultOptions.localGraph, ...userOpts?.localGraph };
    const globalGraph = { ...defaultOptions.globalGraph, ...userOpts?.globalGraph, depth: 1 };

    return (
      <div class={classNames(displayClass, "graph")}>
        <h3>{i18n(cfg.locale ?? "en-US").components.graph.title}</h3>
        <div class="graph-outer">
          <div class="graph-container" data-cfg={JSON.stringify(localGraph)}></div>
          {enableGlobal && (
            <button class="global-graph-icon" aria-label="放大檢視關係圖譜" title="全螢幕放大檢視 (局部圖譜)">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          )}
        </div>
        {enableGlobal && (
          <div class="global-graph-outer">
            <div class="global-graph-container" data-cfg={JSON.stringify(globalGraph)}></div>
            <button class="global-graph-close-btn" aria-label="關閉圖譜" title="關閉 (Esc)">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  Graph.css = style;
  Graph.afterDOMLoaded = script;

  return Graph;
}) satisfies QuartzComponentConstructor;
