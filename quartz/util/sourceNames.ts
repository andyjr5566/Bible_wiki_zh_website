// 來源名稱清單的純邏輯：解析 config/source-names.yaml、比對正文裡的註釋名稱與舊代號、
// 並用 url_hint 從章節的「參考資料」找出對應網址。
// 名單唯一真相在 config/source-names.yaml（由筆記庫同步過來），程式裡絕不另外寫死任何來源名稱。
import { parse as parseYaml } from "yaml"

export interface SourceCollection {
  readonly code: string
  readonly name: string
  readonly title: string
  readonly note: string
  readonly urlHint?: string
  readonly patterns: readonly string[]
}

export interface SourceWork {
  readonly name: string
  readonly title: string
  readonly note?: string
  readonly patterns: readonly string[]
}

export interface SourceEntry {
  readonly id: string
  readonly name: string
  readonly title: string
  readonly note: string
  readonly kind: "collection" | "work"
  readonly code?: string
  readonly urlHint?: string
  /** 拾穗收錄的各家共用哪個大集的網址（指向 code === "GT" 的集合；若 yaml 沒有則為 undefined） */
  readonly urlOwnerId: string
}

export interface SourceMatch {
  readonly start: number
  readonly end: number
  readonly matched: string
  readonly entry: SourceEntry
  /** 命中舊代號（例如 CT、GT、KC、BH）時為 true，讓說明卡顯示「CT＝黃迦勒」。 */
  readonly isCode: boolean
}

interface CompiledRule {
  readonly entry: SourceEntry
  readonly regex: RegExp
  readonly isCode: boolean
  /** 較長／較具體的規則優先（《丁道爾聖經註釋》優先於《丁道爾》）。 */
  readonly priority: number
}

export interface SourceNamesRegistry {
  readonly version: number
  readonly collections: readonly SourceCollection[]
  readonly works: readonly SourceWork[]
  readonly entries: ReadonlyMap<string, SourceEntry>
  readonly rules: readonly CompiledRule[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function requireString(obj: Record<string, unknown>, key: string, ctx: string): string {
  const value = obj[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`source-names.yaml：${ctx} 缺少非空字串欄位「${key}」`)
  }
  return value.trim()
}

function optionalString(obj: Record<string, unknown>, key: string, ctx: string): string | undefined {
  const value = obj[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") {
    throw new Error(`source-names.yaml：${ctx} 的「${key}」必須是字串`)
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function requirePatterns(obj: Record<string, unknown>, ctx: string): string[] {
  const raw = obj.patterns
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`source-names.yaml：${ctx} 的「patterns」必須是非空陣列`)
  }
  return raw.map((item, idx) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`source-names.yaml：${ctx}.patterns[${idx}] 必須是非空字串`)
    }
    return item
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

/**
 * 英文或代號前後加上 ASCII 字界，避免 CT 誤中 ACT、STEP 誤中 STEPS；
 * 中文與標點不受影響（例如「CT與《啟導本》」「（KC）」都能正確命中）。
 */
function compilePattern(pattern: string, ctx: string): RegExp {
  // 先驗證原始正規式本身合法，避免未閉合的 [ 被後面補上的字界 (?![A-Za-z0-9]) 意外吃掉而誤判有效
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern, "gu")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`source-names.yaml：${ctx} 的正規式「${pattern}」無效：${message}`)
  }
  const startsAscii = /^[A-Za-z0-9]/.test(pattern)
  const endsAscii = /[A-Za-z0-9]$/.test(pattern)
  const wrapped = `${startsAscii ? "(?<![A-Za-z0-9])" : ""}(?:${pattern})${endsAscii ? "(?![A-Za-z0-9])" : ""}`
  try {
    return new RegExp(wrapped, "gu")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`source-names.yaml：${ctx} 的正規式「${pattern}」無效：${message}`)
  }
}

/** 驗證 url_hint 正規式在建置時就報錯，不留到執行期才壞掉。 */
function validateUrlHint(hint: string | undefined, ctx: string): string | undefined {
  if (!hint) return undefined
  try {
    // eslint-disable-next-line no-new
    new RegExp(hint, "i")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`source-names.yaml：${ctx} 的 url_hint「${hint}」無效：${message}`)
  }
  return hint
}

/** 解析並驗證 config/source-names.yaml 的原始字串。格式有錯直接丟出清楚錯誤。 */
export function parseSourceNamesYaml(rawYaml: string): SourceNamesRegistry {
  let parsed: unknown
  try {
    parsed = parseYaml(rawYaml.replace(/^\uFEFF/, ""))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`source-names.yaml 解析失敗：${message}`)
  }

  if (!isRecord(parsed)) {
    throw new Error("source-names.yaml 根層必須是 YAML 物件")
  }

  const version = parsed.version
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("source-names.yaml 缺少有效的整數 version 欄位")
  }

  if (!Array.isArray(parsed.collections) || parsed.collections.length === 0) {
    throw new Error("source-names.yaml 缺少非空的 collections 清單")
  }

  const rawWorks = parsed.works ?? []
  if (!Array.isArray(rawWorks)) {
    throw new Error("source-names.yaml 的 works 欄位必須是陣列")
  }

  const collections: SourceCollection[] = parsed.collections.map((item, idx) => {
    const ctx = `collections[${idx}]`
    if (!isRecord(item)) throw new Error(`source-names.yaml：${ctx} 必須是物件`)
    return {
      code: requireString(item, "code", ctx),
      name: requireString(item, "name", ctx),
      title: requireString(item, "title", ctx),
      note: requireString(item, "note", ctx),
      urlHint: validateUrlHint(optionalString(item, "url_hint", ctx), ctx),
      patterns: requirePatterns(item, ctx),
    }
  })

  const works: SourceWork[] = rawWorks.map((item, idx) => {
    const ctx = `works[${idx}]`
    if (!isRecord(item)) throw new Error(`source-names.yaml：${ctx} 必須是物件`)
    return {
      name: requireString(item, "name", ctx),
      title: requireString(item, "title", ctx),
      note: optionalString(item, "note", ctx),
      patterns: requirePatterns(item, ctx),
    }
  })

  // 拾穗收錄的各家共用「拾穗」（code === "GT"）的網址與出處說明
  const gtCollection = collections.find((c) => c.code === "GT")
  const defaultWorkNote = gtCollection
    ? `摘自${gtCollection.title}（彙集多本中文註釋的逐節摘錄）。`
    : "中文註釋摘錄。"

  const entries = new Map<string, SourceEntry>()
  const rules: CompiledRule[] = []

  for (const col of collections) {
    if (entries.has(col.name)) {
      throw new Error(`source-names.yaml：來源名稱「${col.name}」重複定義`)
    }
    const entry: SourceEntry = {
      id: col.name,
      name: col.name,
      title: col.title,
      note: col.note,
      kind: "collection",
      code: col.code,
      urlHint: col.urlHint,
      urlOwnerId: col.name,
    }
    entries.set(entry.id, entry)

    for (const pattern of col.patterns) {
      // 如果 pattern 本身就是代號且不同於正式名稱（例如 STEP vs STEP Bible），標記為代號讓說明卡補上對應
      const isCodePattern = pattern === col.code && pattern !== col.name
      rules.push({
        entry,
        regex: compilePattern(pattern, `collections(${col.name})`),
        isCode: isCodePattern,
        priority: pattern.length,
      })
    }

    // 舊章節正文仍會出現代號（CT／GT／KC／BH），由同一份 yaml 的 code 欄位自動支援
    if (!col.patterns.includes(col.code)) {
      rules.push({
        entry,
        regex: compilePattern(escapeRegExp(col.code), `collections(${col.name}).code`),
        isCode: col.code !== col.name,
        priority: col.code.length,
      })
    }
  }

  for (const work of works) {
    if (entries.has(work.name)) {
      throw new Error(`source-names.yaml：來源名稱「${work.name}」重複定義`)
    }
    const entry: SourceEntry = {
      id: work.name,
      name: work.name,
      title: work.title,
      note: work.note ?? defaultWorkNote,
      kind: "work",
      urlHint: gtCollection?.urlHint,
      urlOwnerId: gtCollection?.name ?? work.name,
    }
    entries.set(entry.id, entry)

    for (const pattern of work.patterns) {
      rules.push({
        entry,
        regex: compilePattern(pattern, `works(${work.name})`),
        isCode: false,
        priority: pattern.length,
      })
    }
  }

  return { version, collections, works, entries, rules }
}

/**
 * 找出一段純文字裡所有不重疊的來源名稱命中位置。
 * 同起點時長的優先（例如《丁道爾聖經註釋》優先於《丁道爾》、「STEP Bible」優先於「STEP」）；
 * 較早出現的優先，避免後段覆蓋前段。
 */
export function matchSourceNames(text: string, registry: SourceNamesRegistry): SourceMatch[] {
  if (!text || registry.rules.length === 0) return []

  const candidates: Array<SourceMatch & { priority: number }> = []

  for (const rule of registry.rules) {
    rule.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        rule.regex.lastIndex += 1
        continue
      }
      candidates.push({
        start: match.index,
        end: match.index + match[0].length,
        matched: match[0],
        entry: rule.entry,
        isCode: rule.isCode,
        priority: rule.priority,
      })
    }
  }

  if (candidates.length === 0) return []

  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    const lenDiff = b.end - b.start - (a.end - a.start)
    if (lenDiff !== 0) return lenDiff
    // 同起點同長度時，非代號規則優先，其次看規則權重
    if (a.isCode !== b.isCode) return a.isCode ? 1 : -1
    return b.priority - a.priority
  })

  const selected: SourceMatch[] = []
  let cursor = 0
  for (const candidate of candidates) {
    if (candidate.start < cursor) continue
    selected.push({
      start: candidate.start,
      end: candidate.end,
      matched: candidate.matched,
      entry: candidate.entry,
      isCode: candidate.isCode,
    })
    cursor = candidate.end
  }
  return selected
}

/**
 * 用 yaml 裡的 url_hint 從本頁參考資料網址清單中配對出各集合的本章原文網址。
 * 回傳以 collection.name 為鍵的對應表；拾穗收錄的各家查詢 entry.urlOwnerId 即可共用拾穗網址。
 */
export function matchReferenceUrls(
  urls: readonly string[],
  registry: SourceNamesRegistry,
): Record<string, string> {
  const matched: Record<string, string> = {}
  for (const col of registry.collections) {
    if (!col.urlHint) continue
    const re = new RegExp(col.urlHint, "i")
    const found = urls.find((url) => re.test(url))
    if (found) matched[col.name] = found
  }
  return matched
}
