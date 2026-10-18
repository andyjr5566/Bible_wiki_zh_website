// personal-notes plugin：emitter（輸出筆記 App 與設定檔）、pageType（我的筆記頁）、元件（章節面板）。
// 見 dev-notes/personal-notes/04-repo-integration.md §2。

import { promises as fs } from "fs"
import path from "path"
import type { QuartzEmitterPlugin, QuartzPageTypePlugin, FullSlug, FilePath } from "@quartz-community/types"
import { MyNotesBody } from "./components/PersonalNotes"
import { buildLinkIndex } from "./client/model/linkIndex"
import { appVersion, clientAppPath } from "./shared"

export { default as PersonalNotes, MyNotesBody } from "./components/PersonalNotes"

export interface PersonalNotesOptions {
  /** Google OAuth 用戶端 ID（公開資訊）。空白＝只開放本機模式。 */
  clientId?: string
  /** 遠端緊急開關：false 時所有使用者改為本機模式（03 §4.7）。 */
  syncEnabled?: boolean
  minPollSeconds?: number
  maxWritesPerMinute?: number
  /** 顯示在「我的筆記」頁的公告。 */
  notice?: string
}

const MY_NOTES_SLUG = "my-notes"

/** 輸出 static/personal-notes/app.js、config.json 與 links.json（筆記 [[條目]] 用的精簡連結索引）。 */
export const PersonalNotesEmitter: QuartzEmitterPlugin<PersonalNotesOptions> = (opts) => ({
  name: "PersonalNotesEmitter",
  async emit(ctx, content) {
    const src = clientAppPath(import.meta.url)
    const outDir = path.join(ctx.argv.output, "static", "personal-notes")
    await fs.mkdir(outDir, { recursive: true })
    const appOut = path.join(outDir, "app.js")
    await fs.copyFile(src, appOut)
    const config = {
      clientId: opts?.clientId ?? "",
      syncEnabled: opts?.syncEnabled ?? true,
      minPollSeconds: opts?.minPollSeconds ?? 180,
      maxWritesPerMinute: opts?.maxWritesPerMinute ?? 6,
      notice: opts?.notice ?? "",
      appVersion: appVersion(import.meta.url),
    }
    const configOut = path.join(outDir, "config.json")
    await fs.writeFile(configOut, JSON.stringify(config, null, 2))
    const index = buildLinkIndex(
      content.map(([, file]) => {
        const data = file.data as { slug?: string; frontmatter?: { title?: unknown; aliases?: unknown } }
        return { slug: String(data.slug ?? ""), title: data.frontmatter?.title, aliases: data.frontmatter?.aliases }
      }),
    )
    const linksOut = path.join(outDir, "links.json")
    await fs.writeFile(linksOut, JSON.stringify(index))
    return [appOut, configOut, linksOut] as FilePath[]
  },
  partialEmit() {
    return null
  },
})

/** 「我的筆記」虛擬頁（slug：my-notes）。 */
export const PersonalNotesPage: QuartzPageTypePlugin<PersonalNotesOptions> = () => ({
  name: "PersonalNotesPage",
  priority: 5,
  match: ({ slug }) => slug === MY_NOTES_SLUG,
  generate: () => [{ slug: MY_NOTES_SLUG as FullSlug, title: "我的筆記", data: {} }],
  layout: "my-notes",
  body: MyNotesBody,
})

export const manifest = {
  name: "personal-notes",
  displayName: "Personal Notes",
  category: ["emitter", "pageType", "component"],
  version: "0.1.0",
  quartzVersion: ">=5.0.0",
  components: {
    PersonalNotes: { displayName: "Personal Notes", defaultPosition: "afterBody", defaultPriority: 20 },
  },
}
