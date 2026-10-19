import { beforeEach, describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import { NotesStore } from "../src/client/store/db"
import { Repository } from "../src/client/repo/repository"
import { NotesService } from "../src/client/features/notes/notes"
import { DRAFT_STALE_MS, applyDraft, clearDraft, newDraftKey, recoverableDrafts, releaseDraftKey, tabId, withDraftLock, writeDraft, type Draft } from "../src/client/features/notes/drafts"

// Node 沒有 localStorage：用 Map 模擬
class MemoryStorage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

const draft = (over: Partial<Draft> = {}): Draft => ({
  book: "GEN",
  chapter: 1,
  noteId: null,
  baseHlc: null,
  input: { book: "GEN", chapter: 1, verseStart: null, verseEnd: null, title: "", body: "草稿", tags: [] },
  at: Date.now(),
  tab: tabId,
  ...over,
})

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage()
})

describe("草稿備份（Codex 第二輪審查）", () => {
  it("還開著的編輯框不會被拿去補存；關閉後才可以", () => {
    const key = newDraftKey("anon")
    writeDraft(key, draft())
    expect(recoverableDrafts("anon")).toHaveLength(0)
    releaseDraftKey(key)
    expect(recoverableDrafts("anon").map((d) => d.key)).toEqual([key])
  })

  it("每個編輯框一份草稿，互不覆蓋", () => {
    const a = newDraftKey("anon")
    const b = newDraftKey("anon")
    expect(a).not.toBe(b)
    writeDraft(a, draft({ input: { ...draft().input, body: "A" } }))
    writeDraft(b, draft({ input: { ...draft().input, body: "B" } }))
    releaseDraftKey(a)
    releaseDraftKey(b)
    expect(recoverableDrafts("anon").map((d) => d.draft.input.body).sort()).toEqual(["A", "B"])
    clearDraft(a)
    expect(recoverableDrafts("anon").map((d) => d.draft.input.body)).toEqual(["B"])
  })

  it("別的分頁剛寫的草稿（可能還在編輯）不補存，超過 30 秒才補存", () => {
    const key = `bwz-notes-draft:anon:othertab:x1`
    localStorage.setItem(key, JSON.stringify(draft({ tab: "othertab", at: Date.now() })))
    expect(recoverableDrafts("anon")).toHaveLength(0)
    expect(recoverableDrafts("anon", Date.now() + DRAFT_STALE_MS + 1)).toHaveLength(1)
  })

  it("只補存目前帳號的草稿", () => {
    const key = newDraftKey("perm-A")
    writeDraft(key, draft())
    releaseDraftKey(key)
    expect(recoverableDrafts("anon")).toHaveLength(0)
    expect(recoverableDrafts("perm-A")).toHaveLength(1)
  })

  it("補存中的草稿不會被同時處理第二次", async () => {
    const key = newDraftKey("anon")
    writeDraft(key, draft())
    releaseDraftKey(key)
    let runs = 0
    await withDraftLock(key, async () => {
      runs++
      expect(recoverableDrafts("anon")).toHaveLength(0)
      await withDraftLock(key, async () => {
        runs++
      })
    })
    expect(runs).toBe(1)
  })

  it("localStorage 不能用時，寫入回報失敗（切換帳號時據此決定能不能切）", () => {
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      setItem() {
        throw new Error("QuotaExceededError")
      },
    }
    expect(writeDraft(newDraftKey("anon"), draft())).toBe(false)
  })
})

// ---------- 條目筆記的草稿（F5） ----------

const slug = "link_folder/人物/亞伯拉罕"
const node = { slug, title: "亞伯拉罕" }
let seq = 0
async function notesService() {
  const store = await NotesStore.open(`dr${++seq}`, new IDBFactory())
  const repo = await Repository.create({ store })
  return new NotesService(() => repo)
}
const entryDraft = (over: Partial<Draft> = {}): Draft =>
  draft({ book: "", chapter: 0, node, input: { node, book: "", chapter: 0, verseStart: null, verseEnd: null, title: "", body: "條目草稿", tags: [] }, ...over })

describe("條目筆記草稿（F5）", () => {
  it("草稿帶條目 slug，序列化後還在；章節草稿沒有 node 欄位", () => {
    const key = newDraftKey("anon")
    writeDraft(key, entryDraft())
    releaseDraftKey(key)
    const [got] = recoverableDrafts("anon")
    expect(got.draft.node).toEqual(node)
    expect(got.draft.input.node).toEqual(node)
    expect(draft().node).toBeUndefined()
  })

  it("新的條目筆記草稿補存成條目筆記（錨點是 node），不會變成章節筆記", async () => {
    const notes = await notesService()
    expect(await applyDraft(notes, entryDraft())).toBe(true)
    const [r] = notes.forEntry(slug)
    expect(r.winner.body).toBe("條目草稿")
    expect(r.winner.anchor.kind).toBe("node")
    expect(r.winner.anchor.node).toEqual(node)
    expect(notes.all()).toHaveLength(1)
    expect(notes.forChapter("", 0)).toHaveLength(0)
  })

  it("新筆記其實已經建立成功了：不重複建立", async () => {
    const notes = await notesService()
    await notes.create({ ...entryDraft().input })
    expect(await applyDraft(notes, entryDraft())).toBe(false)
    expect(notes.forEntry(slug)).toHaveLength(1)
  })

  it("舊筆記沒被別處改過：直接補上，錨點保持條目", async () => {
    const notes = await notesService()
    const n = await notes.create({ ...entryDraft().input, body: "舊內文" })
    const d = entryDraft({ noteId: n.id, baseHlc: n.hlc, input: { ...entryDraft().input, body: "補上的新內文" } })
    expect(await applyDraft(notes, d)).toBe(true)
    const got = notes.get(n.id)!.winner
    expect(got.body).toBe("補上的新內文")
    expect(got.anchor.kind).toBe("node")
    expect(got.anchor.node).toEqual(node)
    expect(notes.forEntry(slug)).toHaveLength(1)
  })

  it("舊筆記已被別處改過：另存成「恢復的草稿」，仍掛在同一個條目、不覆蓋較新的內容", async () => {
    const notes = await notesService()
    const n = await notes.create({ ...entryDraft().input, body: "舊內文" })
    await notes.update(n.id, { body: "別處改過" })
    const d = entryDraft({ noteId: n.id, baseHlc: n.hlc, input: { ...entryDraft().input, body: "我的草稿" } })
    expect(await applyDraft(notes, d)).toBe(true)
    const all = notes.forEntry(slug)
    expect(all).toHaveLength(2)
    expect(notes.get(n.id)!.winner.body).toBe("別處改過")
    const copy = all.find((r) => r.id !== n.id)!.winner
    expect(copy.title).toBe("筆記（恢復的草稿）")
    expect(copy.anchor.kind).toBe("node")
  })

  it("空草稿不補存；章節草稿補存的行為不變", async () => {
    const notes = await notesService()
    expect(await applyDraft(notes, entryDraft({ input: { ...entryDraft().input, body: "  " } }))).toBe(false)
    expect(await applyDraft(notes, draft())).toBe(true)
    expect(notes.forChapter("GEN", 1)).toHaveLength(1)
    expect(await applyDraft(notes, draft())).toBe(false) // 已經存在，不重複
    expect(notes.all()).toHaveLength(1)
  })
})

describe("草稿補存：Codex Sol 審查 F5a", () => {
  it("#1 只改標籤的草稿不會被當成已存好", async () => {
    const notes = await notesService()
    const n = await notes.create({ ...draft().input, body: "內文", tags: ["舊"] })
    const d = draft({ noteId: n.id, baseHlc: n.hlc, input: { ...draft().input, body: "內文", tags: ["舊", "新標籤"] } })
    expect(await applyDraft(notes, d)).toBe(true)
    expect(notes.get(n.id)!.winner.tags.sort()).toEqual(["新標籤", "舊"].sort())
  })

  it("#1 只改節數的章節草稿不會被當成已存好", async () => {
    const notes = await notesService()
    const n = await notes.create({ ...draft().input, body: "內文" })
    const d = draft({ noteId: n.id, baseHlc: n.hlc, input: { ...draft().input, body: "內文", verseStart: 3, verseEnd: null } })
    expect(await applyDraft(notes, d)).toBe(true)
    expect(notes.get(n.id)!.winner.anchor.verseStart).toBe(3)
  })

  it("#2 紀錄已不在草稿記的位置（條目草稿、紀錄是章節筆記）：另存，不改動原紀錄", async () => {
    const notes = await notesService()
    const n = await notes.create({ ...draft().input, body: "章節的內容" })
    const d = entryDraft({ noteId: n.id, baseHlc: n.hlc, input: { ...entryDraft().input, body: "條目草稿內容" } })
    expect(await applyDraft(notes, d)).toBe(true)
    const orig = notes.get(n.id)!.winner
    expect(orig.body).toBe("章節的內容")
    expect(orig.anchor).toMatchObject({ kind: "chapter", book: "GEN", chapter: 1 })
    const [copy] = notes.forEntry(slug)
    expect(copy.winner.anchor.node).toEqual(node)
    expect(copy.winner.body).toBe("條目草稿內容")
  })
})
