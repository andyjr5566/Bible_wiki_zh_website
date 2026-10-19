// 把筆記匯出成 Obsidian 可以直接用的 Markdown 檔（12 C4）：每則一個 .md，依書卷／章分資料夾，打包成 ZIP。
// 每個檔案開頭是 YAML 屬性（Obsidian 的 Properties），內文保留原本的 Markdown 與 [[條目]]。

import type { Resolved } from "../../merge/merge"
import { bookByCode, chapterLabel } from "../../model/books"
import type { NoteRecord } from "../../model/record"
import { createZip, type ZipEntry } from "../../model/zip"

const ROOT = "聖經筆記"

/** 檔名不能用的字元換掉，並限制長度。 */
function safeName(s: string, max = 40): string {
  const cleaned = s.replace(/[\\/:*?"<>|#^[\]\n\r\t]/g, " ").replace(/\s+/g, " ").trim()
  return Array.from(cleaned).slice(0, max).join("").trim()
}

const yamlString = (s: string) => JSON.stringify(s) // JSON 字串也是合法的 YAML 字串

function verseRange(n: NoteRecord): string {
  const a = n.anchor
  if (!a.verseStart) return ""
  return a.verseEnd && a.verseEnd !== a.verseStart ? `${a.verseStart}-${a.verseEnd}` : String(a.verseStart)
}

const NODE_FOLDER = "知識庫條目"

/** 條目筆記的條目名稱（沒有標題時退回 slug 最後一段）。 */
function entryTitle(n: NoteRecord): string {
  const node = n.anchor.kind === "node" ? n.anchor.node : null
  return node ? node.title || node.slug.split("/").pop() || node.slug : ""
}

/** 一則筆記的 Markdown 內容。pageUrl：章節筆記是網站上該章的完整網址、條目筆記是條目頁網址（放在檔尾，方便回到原文）。 */
export function noteToMarkdown(n: NoteRecord, pageUrl: string | null): string {
  const a = n.anchor
  const node = a.kind === "node" && a.node ? a.node : null
  const book = a.book ? bookByCode(a.book) : undefined
  const verses = verseRange(n)
  const lines = ["---", `id: ${n.id}`]
  if (book && a.chapter) {
    lines.push(`book: ${yamlString(book.name)}`, `chapter: ${a.chapter}`)
    if (verses) lines.push(`verses: ${yamlString(verses)}`)
    lines.push(`ref: ${a.book}.${a.chapter}${verses ? "." + verses : ""}`)
  }
  if (node) lines.push("type: 條目筆記", `entry: ${yamlString(entryTitle(n))}`)
  if (n.type === "sticky") {
    const color = ["yellow", "pink", "green", "blue"].includes(String(n.color)) ? String(n.color) : "yellow"
    lines.push("type: 便條", `color: ${color}`)
  }
  if (n.tags.length) lines.push("tags:", ...n.tags.map((t) => `  - ${yamlString(t)}`))
  lines.push(`created: ${n.createdAt}`, `updated: ${n.updatedAt}`, "source: 聖經研讀知識庫", "---", "")
  const heading = n.type === "sticky" ? `便條 ${book && a.chapter ? chapterLabel(a.book!, a.chapter) : ""}${verses ? ` ${verses} 節` : ""}`.trim() : n.title || (node ? entryTitle(n) : book && a.chapter ? `${chapterLabel(a.book!, a.chapter)}${verses ? ` ${verses} 節` : ""}` : "筆記")
  lines.push(`# ${heading}`, "", n.body.trim(), "")
  if (pageUrl && node) lines.push("---", `條目：[${entryTitle(n)}](${pageUrl})`, "")
  else if (pageUrl && book && a.chapter) lines.push("---", `經文：[${chapterLabel(a.book!, a.chapter)}](${pageUrl})`, "")
  return lines.join("\n")
}

/** 檔案在壓縮檔裡的路徑：聖經筆記/01 創世記/第1章/3-5 標題 (id尾碼).md；條目筆記：聖經筆記/知識庫條目/條目名 標題 (id尾碼).md */
export function notePath(n: NoteRecord): string {
  const a = n.anchor
  const book = a.book ? bookByCode(a.book) : undefined
  if (a.kind === "node" && a.node) {
    const label = safeName(n.title || n.body.split("\n").find((l) => l.trim()) || "筆記")
    return `${ROOT}/${NODE_FOLDER}/${[safeName(entryTitle(n)), label].filter(Boolean).join(" ")} (${n.id.slice(-6)}).md`
  }
  const folder = book && a.chapter ? `${String(book.num).padStart(2, "0")} ${book.name}/第${a.chapter}章` : "其他"
  const verses = verseRange(n)
  const label = safeName(n.title || n.body.split("\n").find((l) => l.trim()) || "筆記")
  const name = [verses, n.type === "sticky" ? "便條" : "", label].filter(Boolean).join(" ")
  return `${ROOT}/${folder}/${name} (${n.id.slice(-6)}).md`
}

/** 所有筆記（含待選擇的衝突版本，各自一個檔）打包成 ZIP。chapterUrlOf：書卷代碼＋章 → 網站網址；entryUrlOf：條目 slug → 網站網址。 */
export function exportMarkdownZip(
  notes: Resolved[],
  chapterUrlOf: (book: string, chapter: number) => string | null,
  entryUrlOf: (slug: string) => string | null = () => null,
): { zip: Uint8Array; count: number } {
  const enc = new TextEncoder()
  const entries: ZipEntry[] = []
  const used = new Set<string>()
  for (const r of notes) {
    for (const v of [r.winner, ...r.conflicts]) {
      if (v.deleted) continue
      let path = notePath(v)
      for (let i = 2; used.has(path); i++) path = path.replace(/( \(\d+\))?\.md$/, ` (${i}).md`)
      used.add(path)
      const a = v.anchor
      const url = a.kind === "node" && a.node ? entryUrlOf(a.node.slug) : a.book && a.chapter ? chapterUrlOf(a.book, a.chapter) : null
      entries.push({ name: path, data: enc.encode(noteToMarkdown(v, url)), date: new Date(v.updatedAt) })
    }
  }
  return { zip: createZip(entries), count: entries.length }
}
