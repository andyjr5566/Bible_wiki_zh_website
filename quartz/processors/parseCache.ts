/**
 * Incremental parse cache for Quartz.
 *
 * On each build, we compute a SHA-256 hash of every markdown file's raw text.
 * If the hash matches the one stored from the previous build, we deserialise the
 * previously-parsed HAST tree and VFile data directly from disk instead of running
 * the full remark/rehype pipeline again.
 *
 * Cache location: .quartz-cache/parsed-content/<slug>.json
 *
 * This is intentionally kept as a standalone module so it can be unit-tested or
 * disabled without touching the core parse pipeline.
 */

import { createHash } from "crypto"
import { readFile, writeFile, mkdir, stat } from "fs/promises"
import path from "path"
import { VFile } from "vfile"
import { Root as HtmlRoot } from "hast"
import { ProcessedContent } from "../plugins/vfile"
import { FilePath } from "../util/path"

// ── types ─────────────────────────────────────────────────────────────────────

/** Everything we persist to disk for one markdown file. */
export interface CachedEntry {
  /** SHA-256 of the raw file text at the time of caching. */
  hash: string
  /** Serialised HAST (HtmlRoot) – plain JSON-safe object. */
  hast: HtmlRoot
  /** All scalar / plain-object fields from vfile.data. */
  data: Record<string, unknown>
  /** Original file path on disk. */
  filePath: string
  /** Original relative path. */
  relativePath: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

const CACHE_DIR = ".quartz-cache/parsed-content"

/** Derive a safe filename from a file path (replace path separators with '__'). */
function cacheKey(fp: string): string {
  // Normalise to forward slashes, strip leading ./ or ../
  const norm = fp.replace(/\\/g, "/").replace(/^\.\//, "")
  // Replace slashes and other unsafe chars with '__'
  return norm.replace(/[/\\:*?"<>|]/g, "__") + ".json"
}

/** Compute SHA-256 of raw text. */
export function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Load a cached entry for `fp`.
 * Returns `null` if no cache file exists or if the stored hash does not match
 * `currentHash`.
 */
export async function loadCached(fp: FilePath, currentHash: string): Promise<CachedEntry | null> {
  const cachePath = path.join(CACHE_DIR, cacheKey(fp))
  try {
    const raw = await readFile(cachePath, "utf-8")
    const entry: CachedEntry = JSON.parse(raw)
    if (entry.hash !== currentHash) return null
    return entry
  } catch {
    // File does not exist or is malformed – treat as cache miss.
    return null
  }
}

/**
 * Persist a parsed result to the cache.
 * We serialise `hast` (already a plain JSON object) and extract the plain-object
 * portion of `vfile.data` that emitters actually need.
 */
export async function saveToCache(fp: FilePath, hash: string, hast: HtmlRoot, vfile: VFile): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    const entry: CachedEntry = {
      hash,
      hast,
      // Capture all data fields; they are set by transformer plugins and are
      // all plain JSON-serialisable objects (strings, arrays, plain objects).
      data: { ...(vfile.data as Record<string, unknown>) },
      filePath: vfile.path ?? fp,
      relativePath: (vfile.data as Record<string, unknown>).relativePath as string ?? "",
    }
    await writeFile(path.join(CACHE_DIR, cacheKey(fp)), JSON.stringify(entry), "utf-8")
  } catch (err) {
    // Non-fatal – if we can't write the cache we just lose the speedup for this
    // entry on the next run.
    console.warn(`[parseCache] Failed to write cache for ${fp}: ${(err as Error).message}`)
  }
}

/**
 * Reconstruct a `ProcessedContent` tuple from a cached entry.
 * We create a new `VFile` instance and populate its `.data` from the cache.
 */
export function hydrateFromCache(entry: CachedEntry): ProcessedContent {
  const vfile = new VFile("")
  vfile.path = entry.filePath
  // Restore all data fields that plugins set during the parse phase.
  Object.assign(vfile.data as Record<string, unknown>, entry.data)
  return [entry.hast, vfile]
}

/**
 * Returns true if the cache directory is non-empty (i.e., a previous build ran
 * with caching enabled).  Used to decide whether to log a "warming cache" message.
 */
export async function cacheExists(): Promise<boolean> {
  try {
    await stat(CACHE_DIR)
    return true
  } catch {
    return false
  }
}
