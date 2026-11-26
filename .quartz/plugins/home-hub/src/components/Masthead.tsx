import type { Root } from "hast";
// 和內容區（ContentBody）用同一個 hast → JSX 函式，標題與引言的標記跟原本一模一樣，主題的樣式才套得上
import { htmlToJsx } from "@quartz-community/utils/jsx";
import { MASTHEAD_ATTR, mastheadPattern, type Masthead as MastheadData } from "../lib/masthead";

// 首頁刊頭：筆記庫 index.md 的標題與引言（取出規則見 lib/masthead.ts）。
// data 屬性記錄「取出了哪幾個元素」，masthead.scss 靠它隱藏文章裡對應的原件；沒有這個元件就不會隱藏任何東西。
export function Masthead({ masthead }: { masthead: MastheadData }) {
  const root: Root = { type: "root", children: masthead.nodes };
  const attrs = { [MASTHEAD_ATTR]: mastheadPattern(masthead) };
  return (
    <div class="bwz-masthead" {...attrs}>
      {htmlToJsx(root)}
    </div>
  );
}
