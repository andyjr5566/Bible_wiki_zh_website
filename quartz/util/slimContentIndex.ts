import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

type SlimField = "slug" | "filePath" | "title" | "links" | "tags"

export type SlimEntry = Partial<Record<SlimField, unknown>>

const slimFields: SlimField[] = ["slug", "filePath", "title", "links", "tags"]

export function slimContentIndex(full: Record<string, unknown>): Record<string, SlimEntry> {
  const slim: Record<string, SlimEntry> = {}

  for (const [key, value] of Object.entries(full)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue

    const entry: SlimEntry = {}
    for (const field of slimFields) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        entry[field] = (value as Record<string, unknown>)[field]
      }
    }

    Object.defineProperty(slim, key, {
      value: entry,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }

  return slim
}

export async function writeSlimContentIndex(
  outputDir: string,
): Promise<{ fullBytes: number; slimBytes: number } | null> {
  const staticDir = join(outputDir, "static")
  const fullPath = join(staticDir, "contentIndex.json")
  const slimPath = join(staticDir, "contentIndex.slim.json")

  let fullText: string
  try {
    fullText = await readFile(fullPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[content-index] Could not read " + fullPath + ": " + (error as Error).message)
    }
    return null
  }

  let full: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(fullText)
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("[content-index] Could not parse " + fullPath + ": expected an object")
      return null
    }
    full = parsed as Record<string, unknown>
  } catch (error) {
    console.warn("[content-index] Could not parse " + fullPath + ": " + (error as Error).message)
    return null
  }

  const slimText = JSON.stringify(slimContentIndex(full))
  try {
    await writeFile(slimPath, slimText, "utf8")
  } catch (error) {
    console.warn("[content-index] Could not write " + slimPath + ": " + (error as Error).message)
    return null
  }

  return {
    fullBytes: Buffer.byteLength(fullText, "utf8"),
    slimBytes: Buffer.byteLength(slimText, "utf8"),
  }
}
