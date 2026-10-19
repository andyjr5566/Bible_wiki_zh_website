// 產生條目相關的備份檔，給 entrycheck.mjs 用（F4b 條目找回、F5 條目筆記與我的相關筆記）。
// 用法（在 plugins/personal-notes 底下）：npx tsx e2e/gen-entry-backup.ts <輸出.json>
// 內容配合 test_content（只有創世記 1、2、6 章；條目〈亞伯拉罕〉〈大衛〉）。
import { writeFileSync } from "node:fs"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { exportBackup } from "../src/client/repo/backup"
import { NotesService } from "../src/client/features/notes/notes"
import { HighlightsService } from "../src/client/features/highlights/highlights"

const out = process.argv[2]
if (!out) throw new Error("用法：npx tsx e2e/gen-entry-backup.ts <輸出.json>")
let t = Date.parse("2025-06-01T00:00:00Z")
const store = await NotesStore.open("gen-entry", new IDBFactory())
const repo = await Repository.create({ store, now: () => (t += 3_600_000) })
const notes = new NotesService(() => repo)
const hl = new HighlightsService(() => repo)
const ch = (book: string, chapter: number, verseStart: number | null, title: string, body: string) =>
  notes.create({ book, chapter, verseStart, verseEnd: null, title, body, tags: [] })

// 「連到這個條目」：創世記 2 章用 [[亞伯拉罕]]
await ch("GEN", 2, 3, "安息與應許", "安息日的應許，後來在 [[亞伯拉罕]] 身上延續。")
// 「提到亞伯拉罕」：創世記 6 章內文提到，另一則掛在〈大衛〉條目上也提到
await ch("GEN", 6, 9, "挪亞與亞伯拉罕", "挪亞是義人，和後來的亞伯拉罕一樣因信稱義。")
await notes.create({ node: { slug: "link_folder/人物/大衛", title: "大衛" }, book: "", chapter: 0, verseStart: null, verseEnd: null, title: "大衛之約", body: "大衛之約延續了亞伯拉罕之約。", tags: [] })
// 無關的筆記
await ch("GEN", 1, 1, "起初", "神創造天地。")
// 條目書籤：舊網址（資料夾改過）、以及完全找不到的條目
await hl.toggleNodeBookmark("link_folder/舊資料夾/亞伯拉罕", "亞伯拉罕")
await hl.toggleNodeBookmark("link_folder/舊/不存在的條目", "不存在的條目")

const data = exportBackup(repo)
writeFileSync(out, JSON.stringify(data))
console.log("records", data.records.length)
