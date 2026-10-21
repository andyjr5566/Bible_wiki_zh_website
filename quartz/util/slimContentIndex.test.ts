import assert from "node:assert"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { describe } from "node:test"
import { slimContentIndex, writeSlimContentIndex } from "./slimContentIndex"

describe("slimContentIndex", () => {
  test("keeps only the five index fields", () => {
    const slim = slimContentIndex({
      page: {
        slug: "page",
        filePath: "page.md",
        title: "Page",
        links: ["other"],
        tags: ["tag"],
        content: "full text",
        extra: true,
      },
    })

    assert.deepStrictEqual(slim, {
      page: {
        slug: "page",
        filePath: "page.md",
        title: "Page",
        links: ["other"],
        tags: ["tag"],
      },
    })
  })

  test("omits fields that are missing", () => {
    const slim = slimContentIndex({ page: { slug: "page", content: "full text" } })
    assert.deepStrictEqual(slim, { page: { slug: "page" } })
  })

  test("skips non-object entries", () => {
    const slim = slimContentIndex({
      nullEntry: null,
      stringEntry: "page",
      numberEntry: 1,
      booleanEntry: false,
      page: { title: "Page" },
    })

    assert.deepStrictEqual(slim, { page: { title: "Page" } })
  })

  test("preserves key order", () => {
    const slim = slimContentIndex({ second: {}, first: {}, third: {} })
    assert.deepStrictEqual(Object.keys(slim), ["second", "first", "third"])
  })
})

describe("writeSlimContentIndex", () => {
  async function withTempOutput(run: (outputDir: string) => Promise<void>) {
    const outputDir = await mkdtemp(join(tmpdir(), "slim-content-index-"))
    try {
      await mkdir(join(outputDir, "static"))
      await run(outputDir)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  }

  test("writes compact JSON and reports both file sizes", async () => {
    await withTempOutput(async (outputDir) => {
      const fullText = JSON.stringify({
        page: { slug: "page", filePath: "page.md", title: "Page", content: "full text" },
      })
      await writeFile(join(outputDir, "static", "contentIndex.json"), fullText, "utf8")

      const sizes = await writeSlimContentIndex(outputDir)
      const slimText = await readFile(join(outputDir, "static", "contentIndex.slim.json"), "utf8")

      assert.deepStrictEqual(JSON.parse(slimText), {
        page: { slug: "page", filePath: "page.md", title: "Page" },
      })
      assert.strictEqual(slimText.includes("\n"), false)
      assert.deepStrictEqual(sizes, {
        fullBytes: Buffer.byteLength(fullText, "utf8"),
        slimBytes: Buffer.byteLength(slimText, "utf8"),
      })
    })
  })

  test("returns null when the full index is missing", async () => {
    await withTempOutput(async (outputDir) => {
      assert.strictEqual(await writeSlimContentIndex(outputDir), null)
    })
  })

  test("warns and returns null when the full index contains invalid JSON", async () => {
    await withTempOutput(async (outputDir) => {
      await writeFile(join(outputDir, "static", "contentIndex.json"), "{invalid", "utf8")
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (...args: unknown[]) => warnings.push(args.join(" "))
      try {
        assert.strictEqual(await writeSlimContentIndex(outputDir), null)
      } finally {
        console.warn = originalWarn
      }
      assert.strictEqual(warnings.length, 1)
      assert.match(warnings[0], /Could not parse/)
    })
  })
})
