import { defineConfig } from "tsup";
import type { Plugin } from "esbuild";
import path from "path";

// 與 plugins/wiki-tour 相同：.inline.ts 轉成字串注入頁面，.scss 轉成 CSS 字串。
const inlineScriptPlugin: Plugin = {
  name: "inline-script-loader",
  setup(parentBuild) {
    parentBuild.onLoad({ filter: /\.scss$/ }, async (args) => {
      const sass = await import("sass");
      const result = sass.compile(args.path);
      return { contents: result.css, loader: "text" };
    });

    parentBuild.onLoad({ filter: /\.inline\.ts$/ }, async (args) => {
      const esbuild = await import("esbuild");
      const fs = await import("fs");
      let text = await fs.promises.readFile(args.path, "utf8");
      text = text.replace(/^export default /gm, "");
      text = text.replace(/^export /gm, "");

      const sourcefile = path.relative(process.cwd(), args.path);
      const result = await esbuild.build({
        stdin: { contents: text, loader: "ts", resolveDir: path.dirname(args.path), sourcefile },
        write: false,
        bundle: true,
        minify: true,
        platform: "browser",
        format: "esm",
        target: "es2020",
        sourcemap: false,
        external: ["http://*", "https://*"],
      });

      const js = result.outputFiles?.[0]?.text;
      if (!js) throw new Error(`inline-script-loader: no JS output for ${args.path}`);
      return { contents: js, loader: "text" };
    });
  },
};

export default defineConfig([
  // 建置期（Node）：emitter、pageType、元件
  {
    entry: {
      index: "src/index.ts",
      "components/index": "src/components/index.ts",
    },
    format: ["esm"],
    // Quartz 執行時不需要型別宣告；型別檢查改用 `npm run typecheck`
    dts: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    target: "es2022",
    splitting: false,
    noExternal: [/.*/],
    outDir: "dist",
    platform: "node",
    esbuildOptions(options) {
      options.jsx = "automatic";
      options.jsxImportSource = "preact";
    },
    esbuildPlugins: [inlineScriptPlugin],
  },
  // 瀏覽器端：延遲載入的筆記 App（由 emitter 複製到 static/personal-notes/app.js）
  {
    entry: { "client/app": "src/client/app.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: false,
    clean: false,
    minify: true,
    target: "es2020",
    splitting: false,
    noExternal: [/.*/],
    outDir: "dist",
    platform: "browser",
    outExtension: () => ({ js: ".js" }),
  },
]);
