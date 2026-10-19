import { describe, expect, it } from "vitest"
import { relocateAll, relocateNode, type NodeRef } from "../src/client/model/nodeLocate"
import type { LinkPage } from "../src/client/model/linkIndex"

const page = (s: string, t: string, a?: string[]): LinkPage => (a ? { s, t, a } : { s, t })

describe("條目重新定位", () => {
  it("slug 還在時回報 same", () => {
    expect(relocateNode({ slug: "link_folder/人物/寧錄", title: "寧錄" }, [
      page("link_folder/人物/寧錄", "寧錄"),
    ])).toEqual({ kind: "same", slug: "link_folder/人物/寧錄" })
  })

  it("搬資料夾後以相同標題找到條目", () => {
    expect(relocateNode({ slug: "link_folder/舊資料夾/寧錄", title: "寧錄" }, [
      page("link_folder/新資料夾/寧錄", "寧錄"),
    ])).toEqual({ kind: "moved", slug: "link_folder/新資料夾/寧錄", title: "寧錄" })
  })

  it("改檔名但別名保留舊名時找到條目", () => {
    expect(relocateNode({ slug: "link_folder/人物/舊名字", title: "舊名字" }, [
      page("link_folder/人物/新名字", "新名字", ["舊名字"]),
    ])).toEqual({ kind: "moved", slug: "link_folder/人物/新名字", title: "新名字" })
  })

  it("只以相同檔名找到改過標題的條目", () => {
    expect(relocateNode({ slug: "link_folder/舊資料夾/寧錄", title: "舊標題" }, [
      page("link_folder/人物/寧錄", "新標題"),
    ])).toEqual({ kind: "moved", slug: "link_folder/人物/寧錄", title: "新標題" })
  })

  it("多個同名候選回報 missing", () => {
    expect(relocateNode({ slug: "link_folder/舊/寧錄", title: "寧錄" }, [
      page("link_folder/甲/寧錄", "寧錄"),
      page("link_folder/乙/寧錄", "寧錄"),
    ])).toEqual({ kind: "missing" })
  })

  it("link_folder 以外的候選不列入比對", () => {
    expect(relocateNode({ slug: "link_folder/舊/寧錄", title: "寧錄" }, [
      page("人物/寧錄", "寧錄"),
    ])).toEqual({ kind: "missing" })
  })

  it("完全找不到時回報 missing", () => {
    expect(relocateNode({ slug: "link_folder/舊/失落", title: "失落" }, [
      page("link_folder/人物/寧錄", "寧錄"),
    ])).toEqual({ kind: "missing" })
  })

  it("舊標題為空時只用舊 slug 檔名比對", () => {
    expect(relocateNode({ slug: "link_folder/舊/寧錄", title: " " }, [
      page("link_folder/新/寧錄", "新標題"),
    ])).toEqual({ kind: "moved", slug: "link_folder/新/寧錄", title: "新標題" })
  })

  it("大小寫與連字號差異視為相同", () => {
    expect(relocateNode({ slug: "link_folder/Old-Name", title: "OLD_NAME" }, [
      page("link_folder/New-Name", "old name", ["other"]),
    ])).toEqual({ kind: "moved", slug: "link_folder/New-Name", title: "old name" })
  })

  it("relocateAll 與逐筆呼叫結果一致", () => {
    const refs: NodeRef[] = [
      { slug: "link_folder/舊/寧錄", title: "寧錄" },
      { slug: "link_folder/舊/失落", title: "失落" },
      { slug: "link_folder/甲/同名", title: "同名" },
    ]
    const pages = [
      page("link_folder/新/寧錄", "寧錄"),
      page("link_folder/人物/同名", "同名"),
      page("link_folder/地點/同名", "同名"),
    ]

    const all = relocateAll(refs, pages)
    expect(refs.map((ref) => all.get(ref))).toEqual(refs.map((ref) => relocateNode(ref, pages)))
  })
})
