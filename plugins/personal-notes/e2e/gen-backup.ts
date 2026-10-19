// 產生「重度使用者」的備份檔，給〈我的筆記〉大量資料的瀏覽器檢查（mynotescheck.mjs）用。
// 用法（在外掛資料夾 plugins/personal-notes 下執行）：npx tsx e2e/gen-backup.ts <out.json>
import { writeFileSync } from "node:fs"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { exportBackup } from "../src/client/repo/backup"
import { NotesService } from "../src/client/features/notes/notes"
import { HighlightsService } from "../src/client/features/highlights/highlights"
import { StickiesService } from "../src/client/features/stickies/stickies"

const out = process.argv[2]
if (!out) throw new Error("用法：npx tsx e2e/gen-backup.ts <out.json>")
let t = Date.parse("2025-01-01T00:00:00Z")
const store = await NotesStore.open("gen", new IDBFactory())
const repo = await Repository.create({ store, now: () => (t += 3_600_000) })
const notes = new NotesService(() => repo)
const hl = new HighlightsService(() => repo)
const st = new StickiesService(() => repo)
const books = ["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "PSA", "ISA", "MAT", "JHN"]
const tags = ["應許", "禱告", "盟約", "聖潔", "信心", "預表"]
const long = "這一段讓我想到神的信實。\n- 第一點：祂守約\n- 第二點：祂施恩\n- 第三點：祂審判也憐憫\n\n> 引用：耶和華是有憐憫有恩典的神。\n\n更多的思考寫在這裡，讓內容超過兩行，好測試展開全文。"
for (let i = 0; i < 400; i++) {
  const book = books[i % books.length]
  const chapter = (i % 23) + 1
  const verse = (i % 17) + 1
  await notes.create({ book, chapter, verseStart: i % 3 ? verse : null, verseEnd: i % 5 === 0 && i % 3 ? verse + 2 : null, title: i % 4 === 0 ? `第 ${i + 1} 則的標題` : "", body: i % 6 === 0 ? `${long}（${i + 1}）` : `短筆記 ${i + 1}：關於${book} ${chapter}:${verse} 的觀察`, tags: i % 3 === 0 ? [tags[i % tags.length]] : [] })
}
const colors = ["yellow", "pink", "green", "blue"] as const
for (let i = 0; i < 80; i++) await st.add(books[i % books.length], (i % 19) + 1, (i % 11) + 1, `便條 ${i + 1}：記得對照第 ${(i % 9) + 1} 章`, colors[i % 4])
for (let i = 0; i < 120; i++) await hl.addHighlight({ book: books[i % books.length], chapter: (i % 21) + 1, verseStart: (i % 13) + 1, verseEnd: null, quote: { exact: `重點文字${i + 1}`, prefix: "", suffix: "" }, hash: null })
for (let i = 0; i < 22; i++) await hl.toggleBookmark(books[i % books.length], (i % 15) + 1, i % 2 ? (i % 9) + 1 : null, null)
for (const [slug, title] of [["link_folder/人物/亞伯拉罕", "亞伯拉罕"], ["link_folder/人物/大衛", "大衛"], ["link_folder/主題/人的尊嚴", "人的尊嚴"]]) await hl.toggleNodeBookmark(slug, title)
const data = exportBackup(repo)
writeFileSync(out, JSON.stringify(data))
console.log("records", data.records.length)
