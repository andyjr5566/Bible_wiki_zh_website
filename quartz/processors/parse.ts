import esbuild from "esbuild"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { Processor, unified } from "unified"
import { Root as MDRoot } from "remark-parse/lib"
import { Root as HTMLRoot } from "hast"
import { MarkdownContent, ProcessedContent } from "../plugins/vfile"
import { PerfTimer } from "../util/perf"
import { read } from "to-vfile"
import { readFile } from "fs/promises"
import { FilePath, QUARTZ, slugifyFilePath } from "../util/path"
import path from "path"
import workerpool, { Promise as WorkerPromise } from "workerpool"
import { QuartzLogger } from "../util/log"
import { trace } from "../util/trace"
import { BuildCtx, WorkerSerializableBuildCtx } from "../util/ctx"
import { styleText } from "util"
import { hashContent, loadCached, saveToCache, hydrateFromCache } from "./parseCache"

export type QuartzMdProcessor = Processor<MDRoot, MDRoot, MDRoot>
export type QuartzHtmlProcessor = Processor<undefined, MDRoot, HTMLRoot>

export function createMdProcessor(ctx: BuildCtx): QuartzMdProcessor {
  const transformers = ctx.cfg.plugins.transformers

  return (
    unified()
      // base Markdown -> MD AST
      .use(remarkParse)
      // MD AST -> MD AST transforms
      .use(
        transformers.flatMap((plugin) => plugin.markdownPlugins?.(ctx) ?? []),
      ) as unknown as QuartzMdProcessor
    //  ^ sadly the typing of `use` is not smart enough to infer the correct type from our plugin list
  )
}

export function createHtmlProcessor(ctx: BuildCtx): QuartzHtmlProcessor {
  const transformers = ctx.cfg.plugins.transformers
  return (
    unified()
      // MD AST -> HTML AST
      .use(remarkRehype, { allowDangerousHtml: true })
      // HTML AST -> HTML AST transforms
      .use(transformers.flatMap((plugin) => plugin.htmlPlugins?.(ctx) ?? []))
  )
}

function* chunks<T>(arr: T[], n: number) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

async function transpileWorkerScript() {
  // transpile worker script
  const cacheFile = "./.quartz-cache/transpiled-worker.mjs"
  const fp = "./quartz/worker.ts"
  return esbuild.build({
    entryPoints: [fp],
    outfile: path.join(QUARTZ, cacheFile),
    bundle: true,
    keepNames: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      {
        name: "css-and-scripts-as-text",
        setup(build) {
          build.onLoad({ filter: /\.scss$/ }, (_) => ({
            contents: "",
            loader: "text",
          }))
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, (_) => ({
            contents: "",
            loader: "text",
          }))
        },
      },
    ],
  })
}

export function createFileParser(ctx: BuildCtx, fps: FilePath[]) {
  const { argv, cfg } = ctx
  return async (processor: QuartzMdProcessor) => {
    const res: MarkdownContent[] = []
    for (const fp of fps) {
      try {
        const perf = new PerfTimer()
        const file = await read(fp)

        // strip leading and trailing whitespace
        file.value = file.value.toString().trim()

        // Text -> Text transforms
        for (const plugin of cfg.plugins.transformers.filter((p) => p.textTransform)) {
          file.value = plugin.textTransform!(ctx, file.value.toString())
        }

        // base data properties that plugins may use
        file.data.filePath = file.path as FilePath
        file.data.relativePath = path.posix.relative(argv.directory, file.path) as FilePath
        file.data.slug = slugifyFilePath(file.data.relativePath)

        const ast = processor.parse(file)
        const newAst = await processor.run(ast, file)
        res.push([newAst, file])

        if (argv.verbose) {
          console.log(`[markdown] ${fp} -> ${file.data.slug} (${perf.timeSince()})`)
        }
      } catch (err) {
        trace(`\nFailed to process markdown \`${fp}\``, err as Error)
      }
    }

    return res
  }
}

export function createMarkdownParser(ctx: BuildCtx, mdContent: MarkdownContent[]) {
  return async (processor: QuartzHtmlProcessor) => {
    const res: ProcessedContent[] = []
    for (const [ast, file] of mdContent) {
      try {
        const perf = new PerfTimer()

        const newAst = await processor.run(ast as MDRoot, file)
        res.push([newAst, file])

        if (ctx.argv.verbose) {
          console.log(`[html] ${file.data.slug} (${perf.timeSince()})`)
        }
      } catch (err) {
        trace(`\nFailed to process html \`${file.data.filePath}\``, err as Error)
      }
    }

    return res
  }
}

const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(num), min), max)

// ── helpers for incremental parse ─────────────────────────────────────────────

/**
 * Read every file in `fps`, compute its content hash, and split into:
 * - `hits`: files whose hash matches the cache → restored directly
 * - `misses`: files that changed or are new → must go through parse pipeline
 */
async function partitionByCache(fps: FilePath[]): Promise<{
  hits: ProcessedContent[]
  missFps: FilePath[]
}> {
  const hits: ProcessedContent[] = []
  const missFps: FilePath[] = []

  await Promise.all(
    fps.map(async (fp) => {
      try {
        const raw = (await readFile(fp, "utf-8")).trim()
        const hash = hashContent(raw)
        const cached = await loadCached(fp, hash)
        if (cached) {
          hits.push(hydrateFromCache(cached))
        } else {
          missFps.push(fp)
        }
      } catch {
        // If we can't read the file at all, treat as miss so the normal
        // parser can produce a proper error message.
        missFps.push(fp)
      }
    }),
  )

  return { hits, missFps }
}

/**
 * After the full parse pipeline has run for all miss files, save their results
 * to the cache so future runs can skip them.
 */
async function saveParsedToCache(fps: FilePath[], results: ProcessedContent[]): Promise<void> {
  // fps and results are parallel arrays (same length, same order)
  await Promise.all(
    results.map(async ([hast, vfile], i) => {
      const fp = fps[i]
      if (!fp) return
      try {
        const raw = (await readFile(fp, "utf-8")).trim()
        const hash = hashContent(raw)
        await saveToCache(fp, hash, hast, vfile)
      } catch {
        // Non-fatal
      }
    }),
  )
}

// ── main entry point ───────────────────────────────────────────────────────────

export async function parseMarkdown(ctx: BuildCtx, fps: FilePath[]): Promise<ProcessedContent[]> {
  const { argv } = ctx
  const perf = new PerfTimer()
  const log = new QuartzLogger(argv.verbose)

  // ── Step 1: cache-first partitioning ──────────────────────────────────────
  // Only run this when not in worker-incremental (watch) mode and when the
  // QUARTZ_INCREMENTAL env var is set (CI incremental build) OR always
  // (incremental cache always helps even on first build for subsequent runs).
  log.start(`Checking parse cache for ${fps.length} files`)
  const { hits, missFps } = await partitionByCache(fps)
  log.end(
    `Parse cache: ${styleText("green", `${hits.length} hits`)}, ` +
    `${styleText("yellow", `${missFps.length} misses`)}`
  )

  // rough heuristics: 128 gives enough time for v8 to JIT and optimize parsing code paths
  const CHUNK_SIZE = 128
  const concurrency = ctx.argv.concurrency ?? clamp(missFps.length / CHUNK_SIZE, 1, 4)

  let parsedMisses: ProcessedContent[] = []

  if (missFps.length > 0) {
    log.start(`Parsing ${missFps.length} changed/new files using ${concurrency} threads`)

    if (concurrency === 1) {
      try {
        const mdRes = await createFileParser(ctx, missFps)(createMdProcessor(ctx))
        parsedMisses = await createMarkdownParser(ctx, mdRes)(createHtmlProcessor(ctx))
      } catch (error) {
        log.end()
        throw error
      }
    } else {
      await transpileWorkerScript()
      const pool = workerpool.pool("./quartz/bootstrap-worker.mjs", {
        minWorkers: "max",
        maxWorkers: concurrency,
        workerType: "thread",
      })
      const serializableCtx: WorkerSerializableBuildCtx = {
        buildId: ctx.buildId,
        argv: ctx.argv,
        allSlugs: ctx.allSlugs,
        allFiles: ctx.allFiles,
        incremental: ctx.incremental,
        virtualPages: [],
      }

      try {
        const textToMarkdownPromises: WorkerPromise<MarkdownContent[]>[] = []
        let processedFiles = 0
        for (const chunk of chunks(missFps, CHUNK_SIZE)) {
          textToMarkdownPromises.push(pool.exec("parseMarkdown", [serializableCtx, chunk]))
        }

        const mdResults: Array<MarkdownContent[]> = await Promise.all(
          textToMarkdownPromises.map(async (promise) => {
            const result = await promise
            processedFiles += result.length
            log.updateText(`text->markdown ${styleText("gray", `${processedFiles}/${missFps.length}`)}`)
            return result
          }),
        )

        const markdownToHtmlPromises: WorkerPromise<ProcessedContent[]>[] = []
        processedFiles = 0
        for (const mdChunk of mdResults) {
          markdownToHtmlPromises.push(pool.exec("processHtml", [serializableCtx, mdChunk]))
        }
        const results: ProcessedContent[][] = await Promise.all(
          markdownToHtmlPromises.map(async (promise) => {
            const result = await promise
            processedFiles += result.length
            log.updateText(`markdown->html ${styleText("gray", `${processedFiles}/${missFps.length}`)}`)
            return result
          }),
        )

        parsedMisses = results.flat()
      } finally {
        await pool.terminate()
      }
    }

    log.end(`Parsed ${parsedMisses.length} files in ${perf.timeSince()}`)

    // ── Step 3: save newly-parsed results to cache ─────────────────────────
    // Do this asynchronously so it doesn't block the emit step.
    // We intentionally do NOT await this — failures are non-fatal.
    saveParsedToCache(missFps, parsedMisses).catch((err) => {
      console.warn(`[parseCache] Background save failed: ${(err as Error).message}`)
    })
  }

  const res = [...hits, ...parsedMisses]
  console.log(
    styleText("green", `Total: ${res.length} files ready in ${perf.timeSince()} `) +
    styleText("gray", `(${hits.length} cached, ${parsedMisses.length} parsed)`)
  )
  return res
}
