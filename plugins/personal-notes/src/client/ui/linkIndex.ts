// 下載建置時輸出的精簡連結索引（static/personal-notes/links.json，格式見 model/linkIndex.ts）。
// 筆記的 [[條目]] 連結與條目改名後找回（D-46）共用，整個頁面只下載一次；失敗時回傳 null。

import type { LinkIndex } from "../model/linkIndex"

let loading: Promise<LinkIndex | null> | null = null

export function loadLinkIndex(): Promise<LinkIndex | null> {
  if (!loading) {
    const base = document.body.dataset.basepath ?? ""
    loading = fetch(`${base}/static/personal-notes/links.json`)
      .then((r) => (r.ok ? (r.json() as Promise<LinkIndex>) : null))
      .then((index) => (index && index.v === 1 && Array.isArray(index.pages) ? index : null))
      .catch(() => null)
  }
  return loading
}
