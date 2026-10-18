import { describe, expect, it } from "vitest"
import { crc32, createZip } from "../src/client/model/zip"
import { chapterAnchor, type NoteRecord } from "../src/client/model/record"
import { exportMarkdownZip, notePath, noteToMarkdown } from "../src/client/features/notes/markdownExport"
import type { Resolved } from "../src/client/merge/merge"

/** 讀出 ZIP 的 central directory：每個檔案的名稱、資料與 CRC 是否正確。 */
function readZip(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const end = buf.length - 22
  expect(dv.getUint32(end, true)).toBe(0x06054b50)
  const count = dv.getUint16(end + 10, true)
  let p = dv.getUint32(end + 16, true)
  const dec = new TextDecoder()
  const files: { name: string; text: string; crcOk: boolean; utf8: boolean }[] = []
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50)
    const crc = dv.getUint32(p + 16, true)
    const size = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen))
    expect(dv.getUint32(local, true)).toBe(0x04034b50)
    const dataStart = local + 30 + dv.getUint16(local + 26, true)
    const data = buf.subarray(dataStart, dataStart + size)
    files.push({ name, text: dec.decode(data), crcOk: crc32(data) === crc, utf8: (dv.getUint16(p + 8, true) & 0x0800) !== 0 })
    p += 46 + nameLen
  }
  return files
}

const rec = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  id: "n_01JABCDEFGHJKMNPQRSTVWXYZ0",
  type: "note",
  anchor: chapterAnchor("GEN", 1, 3, 5),
  title: "光與暗",
  body: "**神說要有光**\n- 見 [[創造]]",
  tags: ["創造", "光"],
  links: ["創造"],
  createdAt: "2026-10-18T01:00:00.000Z",
  updatedAt: "2026-10-18T02:00:00.000Z",
  hlc: "0000001760749200000:0000:d_aaaaaaaa",
  vv: { d_aaaaaaaa: 1 },
  author: "d_aaaaaaaa",
  deleted: false,
  ...over,
})

describe("ZIP（C4）", () => {
  it("CRC32 與標準值一致", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
  })
  it("可以讀回每個檔案；中文檔名標示為 UTF-8", () => {
    const enc = new TextEncoder()
    const zip = createZip([
      { name: "聖經筆記/01 創世記/第1章/a.md", data: enc.encode("甲") },
      { name: "b.md", data: enc.encode("") },
    ])
    expect(readZip(zip)).toEqual([
      { name: "聖經筆記/01 創世記/第1章/a.md", text: "甲", crcOk: true, utf8: true },
      { name: "b.md", text: "", crcOk: true, utf8: true },
    ])
  })
})

describe("Markdown 匯出（C4）", () => {
  it("YAML 屬性、標題、內文、回到經文的連結", () => {
    const md = noteToMarkdown(rec(), "https://example.com/01-創世記/第1章")
    expect(md).toBe(
      [
        "---",
        "id: n_01JABCDEFGHJKMNPQRSTVWXYZ0",
        'book: "創世記"',
        "chapter: 1",
        'verses: "3-5"',
        "ref: GEN.1.3-5",
        "tags:",
        '  - "創造"',
        '  - "光"',
        "created: 2026-10-18T01:00:00.000Z",
        "updated: 2026-10-18T02:00:00.000Z",
        "source: 聖經研讀知識庫",
        "---",
        "",
        "# 光與暗",
        "",
        "**神說要有光**\n- 見 [[創造]]",
        "",
        "---",
        "經文：[創世記 第1章](https://example.com/01-創世記/第1章)",
        "",
      ].join("\n"),
    )
  })

  it("檔案路徑依書卷／章分資料夾，檔名去掉不合法字元", () => {
    expect(notePath(rec())).toBe("聖經筆記/01 創世記/第1章/3-5 光與暗 (XYZ0).md".replace("XYZ0", "VWXYZ0"))
    expect(notePath(rec({ title: "", body: "a/b:c?d\n第二行", anchor: chapterAnchor("EXO", 12) }))).toBe("聖經筆記/02 出埃及記/第12章/a b c d (VWXYZ0).md")
  })

  it("衝突的兩個版本各自一個檔；已刪除的不匯出", () => {
    const a = rec()
    const b = rec({ body: "另一台裝置改的", hlc: "0000001760749300000:0000:d_bbbbbbbb" })
    const gone = rec({ id: "n_01JABCDEFGHJKMNPQRSTVWXYZ9", deleted: true })
    const notes = [{ id: a.id, winner: a, conflicts: [b], frontierVv: {} }, { id: gone.id, winner: gone, conflicts: [], frontierVv: {} }] as unknown as Resolved[]
    const { zip, count } = exportMarkdownZip(notes, () => null)
    const files = readZip(zip)
    expect(count).toBe(2)
    expect(files.map((f) => f.name)).toEqual(["聖經筆記/01 創世記/第1章/3-5 光與暗 (VWXYZ0).md", "聖經筆記/01 創世記/第1章/3-5 光與暗 (VWXYZ0) (2).md"])
    expect(files.every((f) => f.crcOk)).toBe(true)
  })
})

it("便條與筆記在同章資料夾，帶種類、顏色與經節標題", () => {
  const n = rec({ type: "sticky", title: "", body: "記住這段\n第二行", color: "pink", anchor: chapterAnchor("GEN", 1, 3, null) })
  expect(notePath(n)).toBe("聖經筆記/01 創世記/第1章/3 便條 記住這段 (VWXYZ0).md")
  const md = noteToMarkdown(n, null)
  expect(md).toContain("type: 便條\ncolor: pink")
  expect(md).toContain("# 便條 創世記 第1章 3 節")
  expect(md).toContain("記住這段\n第二行")
  const r: Resolved = { id: n.id, winner: n, conflicts: [], frontierVv: n.vv }
  expect(exportMarkdownZip([r], () => null).count).toBe(1)
})
