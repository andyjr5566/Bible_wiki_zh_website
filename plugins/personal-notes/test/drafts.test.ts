import { beforeEach, describe, expect, it } from "vitest"
import { DRAFT_STALE_MS, clearDraft, newDraftKey, recoverableDrafts, releaseDraftKey, tabId, withDraftLock, writeDraft, type Draft } from "../src/client/features/notes/drafts"

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
