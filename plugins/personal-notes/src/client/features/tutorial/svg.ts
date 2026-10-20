// 教學用的固定 SVG 圖示（本檔常數，不是使用者內容）。
// h() 不支援 HTML 字串；用 DOMParser("text/html") 建立才會得到真正的 SVG 元素（見 11-code-structure §4）。

export function svg(markup: string): Element {
  return document.importNode(new DOMParser().parseFromString(markup, "text/html").body.firstElementChild!, true)
}

const stroke = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'

export const ICONS = {
  /** 虛擬游標（填色在 tutorial.scss，跟著深淺色模式變） */
  cursor:
    '<svg aria-hidden="true" viewBox="0 0 28 28" width="28" height="28"><path d="M5 3.2 21.5 14l-7.1 1.6 4 7.2-3.3 1.7-4-7.3L5.6 21z" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  /** 手指長按時的外圈（pathLength=100，用 stroke-dashoffset 從 100 畫到 0；顏色在 tutorial.scss） */
  ring: '<svg aria-hidden="true" class="bwz-tut-ring" viewBox="0 0 60 60" width="60" height="60"><circle cx="30" cy="30" r="26" pathLength="100"/></svg>',
  check: `<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" ${stroke} stroke-width="2"><path class="bwz-tut-tick" d="M3 8.5 6.6 12 13 4.5"/></svg>`,
  edit: `<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" ${stroke}><path d="m14 4 6 6M3 21l4.2-1 11.3-11.3a2.1 2.1 0 0 0-3-3L4.2 17z"/></svg>`,
  collapse: `<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" ${stroke}><path d="M7 10l5 5 5-5"/><path d="M5 19h14"/></svg>`,
  remove: `<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" ${stroke}><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  noteFilled:
    '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path class="bwz-paper-fill" d="M3 1.5h7l3 3V14.5H3z"/><path d="M10 1.5v3h3" fill="none"/></svg>',
} as const
