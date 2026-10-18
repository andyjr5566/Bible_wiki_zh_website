import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/boot.inline.ts"
// @ts-expect-error - css imported as string by esbuild loader
import style from "./styles/notes.scss"
import { parseChapterSlug, chapterLabel } from "../client/model/books"
import { appVersion } from "../shared"

const version = () => appVersion(import.meta.url)

/**
 * 章節頁底部的「我的筆記」掛載點（afterBody）。只在章節頁輸出；
 * 判斷依據是 slug 開頭的書卷編號與「第N章」，認不出就不輸出（content 仍在建置中，D-14）。
 */
const PersonalNotes: QuartzComponentConstructor = () => {
  const Component: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const ref = parseChapterSlug(String(fileData.slug ?? ""))
    if (!ref) return null
    return (
      <section
        class="bwz-notes"
        data-bwz-notes="chapter"
        data-book={ref.book.code}
        data-chapter={String(ref.chapter)}
        data-bwz-version={version()}
        aria-label={`${chapterLabel(ref.book.code, ref.chapter)} 我的筆記`}
      >
        <p class="bwz-n-muted">我的筆記載入中…</p>
      </section>
    )
  }
  Component.afterDOMLoaded = script
  Component.css = style
  return Component
}

export default PersonalNotes

/** 「我的筆記」虛擬頁的內容（pageType body）。 */
export const MyNotesBody: QuartzComponentConstructor = () => {
  const Component: QuartzComponent = () => (
    <article class="popover-hint bwz-notes-page">
      <div data-bwz-notes="mynotes" data-bwz-version={version()}>
        <p class="bwz-n-muted">我的筆記載入中…</p>
      </div>
      <noscript>需要開啟 JavaScript 才能使用個人筆記功能。</noscript>
    </article>
  )
  Component.afterDOMLoaded = script
  Component.css = style
  return Component
}
