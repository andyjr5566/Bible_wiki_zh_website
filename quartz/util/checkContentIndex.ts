import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { gzipSync } from "node:zlib"
import { isDeepStrictEqual } from "node:util"

const outputDir = process.argv[2]

if (!outputDir) {
  console.error("Usage: npx tsx quartz/util/checkContentIndex.ts <outputDir>")
  process.exitCode = 1
} else {
  const fullPath = join(outputDir, "static", "contentIndex.json")
  const slimPath = join(outputDir, "static", "contentIndex.slim.json")

  try {
    const [fullText, slimText] = await Promise.all([
      readFile(fullPath, "utf8"),
      readFile(slimPath, "utf8"),
    ])
    const full = JSON.parse(fullText) as Record<string, unknown>
    const slim = JSON.parse(slimText) as Record<string, unknown>
    const differences: string[] = []
    // 和 slimContentIndex 一樣略過不是物件的值（小索引本來就不收它們），避免規則不一致而誤擋部署
    const fullKeys = Object.keys(full).filter((key) => {
      const value = full[key]
      return value !== null && typeof value === "object" && !Array.isArray(value)
    })
    const slimKeys = Object.keys(slim)
    const slimKeySet = new Set(slimKeys)
    const fullKeySet = new Set(fullKeys)

    for (const key of fullKeys) {
      if (!slimKeySet.has(key)) differences.push(key + ": missing from slim index")
    }
    for (const key of slimKeys) {
      if (!fullKeySet.has(key)) differences.push(key + ": missing from full index")
    }

    const fields = ["slug", "filePath", "title", "links", "tags"] as const
    for (const key of fullKeys) {
      if (!slimKeySet.has(key)) continue
      const fullEntry = full[key]
      const slimEntry = slim[key]
      if (fullEntry === null || typeof fullEntry !== "object" || Array.isArray(fullEntry)) {
        differences.push(key + ": full entry is not an object")
        continue
      }
      if (slimEntry === null || typeof slimEntry !== "object" || Array.isArray(slimEntry)) {
        differences.push(key + ": slim entry is not an object")
        continue
      }

      for (const field of fields) {
        const fullHasField = Object.prototype.hasOwnProperty.call(fullEntry, field)
        const slimHasField = Object.prototype.hasOwnProperty.call(slimEntry, field)
        const fullValue = (fullEntry as Record<string, unknown>)[field]
        const slimValue = (slimEntry as Record<string, unknown>)[field]
        if (fullHasField !== slimHasField || !isDeepStrictEqual(fullValue, slimValue)) {
          differences.push(key + "." + field + ": values differ")
        }
      }
    }

    const fullBuffer = Buffer.from(fullText, "utf8")
    const slimBuffer = Buffer.from(slimText, "utf8")
    console.log("contentIndex.json: " + fullBuffer.length + " bytes, gzip " + gzipSync(fullBuffer).length + " bytes")
    console.log(
      "contentIndex.slim.json: " + slimBuffer.length + " bytes, gzip " + gzipSync(slimBuffer).length + " bytes",
    )

    if (differences.length > 0) {
      console.error("Found " + differences.length + " content index difference(s):")
      for (const difference of differences.slice(0, 10)) console.error("- " + difference)
      process.exitCode = 1
    } else {
      console.log("Content indexes match (" + fullKeys.length + " keys).")
    }
  } catch (error) {
    console.error("Could not check content indexes: " + (error as Error).message)
    process.exitCode = 1
  }
}
