// backNav.ts
// 聖經研讀知識庫 - 「上一頁」按鈕的純規則（沒有 DOM、沒有 sessionStorage，方便單元測試）。
// 薄薄的 DOM 部分在 backButton.inline.ts。
//
// 為什麼不直接用 history.back()：Quartz 是 SPA，每次換頁都 pushState，而且同頁的錨點連結
// （目錄、經節跳轉）也會 pushState。讀者按「上一頁」要的是「換頁之前的那一頁」，
// history.back() 可能只是退回同一頁的上一個錨點。所以這裡自己記一份「瀏覽歷史」：
// 每個歷史項目一個位置，按下時算出要 history.go(-n) 退幾步才會到上一個「不同」頁面。

/** 站內瀏覽歷史：entries[i] 是歷史第 i 項的頁面路徑（不含錨點），pos 是目前所在位置 */
export interface NavHistory {
  entries: string[]
  pos: number
}

/** 去掉錨點與查詢字串；同一頁不同錨點視為同一頁 */
export function pagePath(url: string): string {
  return url.replace(/[#?].*$/, "")
}

/** 一個全新的歷史（外部進入、書籤、搜尋引擎、歷史斷掉時） */
export function freshHistory(path: string): NavHistory {
  return { entries: [pagePath(path)], pos: 0 }
}

/**
 * 載入或換頁後，把記下的歷史對回瀏覽器現況。
 * statePos 是瀏覽器這個歷史項目上我們自己寫的位置（history.state.bwzPos）。
 * - 有記錄、位置合理、而且那一格記的頁面就是現在這頁：沿用（重新整理、返回／前進都走這條）
 * - 其他（外部進入、新分頁、sessionStorage 被清、記錄對不上）：重開一份，退回 B 模式比亂猜好
 */
export function syncHistory(
  saved: NavHistory | null,
  statePos: number | undefined,
  path: string,
): NavHistory {
  const here = pagePath(path)
  if (
    saved &&
    typeof statePos === "number" &&
    Number.isInteger(statePos) &&
    statePos >= 0 &&
    statePos < saved.entries.length &&
    saved.entries[statePos] === here
  ) {
    return { entries: saved.entries, pos: statePos }
  }
  return freshHistory(here)
}

/** pushState 之後：捨棄「前進」那一半的項目（瀏覽器也是這樣做），接上新的一項 */
export function pushEntry(h: NavHistory, path: string): NavHistory {
  return { entries: [...h.entries.slice(0, h.pos + 1), pagePath(path)], pos: h.pos + 1 }
}

/**
 * 要 history.go(-n) 退幾步才到上一個「不同」頁面；沒有就回傳 null。
 * 往回找到第一個頁面不同的項目，落在那一頁「最後」的項目：那正是讀者離開時看到的位置（含錨點與捲動）。
 */
export function stepsToPreviousPage(h: NavHistory): number | null {
  const here = h.entries[h.pos]
  if (here === undefined) return null
  for (let i = h.pos - 1; i >= 0; i--) {
    if (h.entries[i] !== here) return h.pos - i
  }
  return null
}

/** 標題去掉資料夾的排序前綴：「01 創世記」「01-創世記」→「創世記」；去完是空的就維持原樣 */
export function stripOrderPrefix(title: string): string {
  const t = title.trim().replace(/^\d+[\s-]+/, "")
  return t === "" ? title.trim() : t
}

/** slug 的上一層候選，由近到遠：.../index（資料夾頁）… → index（首頁）；首頁沒有 */
function ancestorCandidates(slug: string): string[] {
  if (slug === "index") return []
  const parts = slug.split("/")
  // 資料夾頁本身（.../index）的上一層是上上層資料夾
  if (parts[parts.length - 1] === "index") parts.pop()
  parts.pop()
  const out: string[] = []
  while (parts.length > 0) {
    out.push(`${parts.join("/")}/index`)
    parts.pop()
  }
  out.push("index")
  return out
}

export interface ParentTarget {
  slug: string
  title: string
}

/**
 * 階層上一層：往上找「真的有頁面」的最近一層（index 是 slug → 標題的對照，來自 contentIndex）。
 * 只看 index 裡有的 slug，所以不會連到不存在的頁；找不到回傳 null。
 */
export function parentOf(slug: string, index: Record<string, string>): ParentTarget | null {
  for (const cand of ancestorCandidates(slug)) {
    if (!Object.prototype.hasOwnProperty.call(index, cand)) continue
    if (cand === "index") return { slug: cand, title: "首頁" }
    const raw = index[cand]
    // 標題缺漏時退回路徑段落（資料夾名）
    const seg = cand.split("/").slice(-2, -1)[0] ?? ""
    return { slug: cand, title: stripOrderPrefix(raw && raw !== "index" ? raw : seg) }
  }
  return null
}

export type BackDecision =
  | { kind: "history"; steps: number }
  | { kind: "parent"; slug: string; title: string }
  | null

/** 決定按鈕：有站內上一頁（A）→ 階層上一層（B）→ 不顯示 */
export function decideBack(
  slug: string,
  history: NavHistory,
  index: Record<string, string>,
): BackDecision {
  if (slug === "index") return null
  const steps = stepsToPreviousPage(history)
  if (steps !== null) return { kind: "history", steps }
  const parent = parentOf(slug, index)
  return parent ? { kind: "parent", ...parent } : null
}
