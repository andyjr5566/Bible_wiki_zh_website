/// <reference path="../node_modules/@quartz-community/types/globals.d.ts" />

declare module "*.scss" {
  const content: string;
  export default content;
}

declare module "*.inline.ts" {
  const content: string;
  export default content;
}

// 完整內文索引（含 content），由 quartz/components/renderPage.tsx 的 inline script 定義；fetchData 只有小索引
declare function fetchFullContentIndex(): Promise<Record<string, unknown>>;
