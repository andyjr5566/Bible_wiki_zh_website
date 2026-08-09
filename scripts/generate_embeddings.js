import fs from "fs/promises"
import path from "path"
import { globby } from "globby"
import { OpenAI } from "openai"
import { Pinecone } from "@pinecone-database/pinecone"
import dotenv from "dotenv"
import { unified } from "unified"
import remarkParse from "remark-parse"
import { normalizeSearchSlug } from "../api/slug.js"

dotenv.config()

const CONTENT_DIR = process.env.CONTENT_DIR || "content"
const CHUNK_SIZE = Number(process.env.EMBED_CHUNK_SIZE || 1200)
const CHUNK_OVERLAP = Number(process.env.EMBED_CHUNK_OVERLAP || 150)
const EMBED_BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE || 32)
const FULL_REBUILD = process.env.FULL_REBUILD === "true"
const DRY_RUN = process.env.DRY_RUN === "true"

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join("/").replace(/^\.\//, "")
}

/** Only Bible chapters and curated topic pages belong in semantic search. */
function isEmbeddablePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath)
  const topLevel = normalized.split("/")[0] || ""

  return (
    /^\d{2}\s.+\/.+\.md$/i.test(normalized) ||
    /^link_folder\/.+\.md$/i.test(normalized)
  )
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^\uFEFF?---[\s\S]*?---\s*/, "")
}

function removeGeneratedSections(markdown) {
  return markdown
    .replace(
      /<!--\s*(?:chapter-navigation|appendix-links):start\s*-->[\s\S]*?<!--\s*(?:chapter-navigation|appendix-links):end\s*-->/gi,
      "",
    )
    .replace(/^\s*https?:\/\/\S+\s*$/gim, "")
}

function nodeToText(node) {
  if (node.type === "code") return ""
  if (typeof node.value === "string") return node.value
  if (Array.isArray(node.children)) {
    return node.children.map(nodeToText).join(" ")
  }
  return ""
}

/** Keep headings as context while excluding code and generated navigation. */
function extractSections(markdown) {
  const tree = unified().use(remarkParse).parse(removeGeneratedSections(stripFrontmatter(markdown)))
  const sections = []
  let currentHeading = ""

  for (const node of tree.children) {
    if (node.type === "heading") {
      currentHeading = nodeToText(node).replace(/\s+/g, " ").trim()
      continue
    }
    if (node.type === "code") continue

    const text = nodeToText(node).replace(/\s+/g, " ").trim()
    if (text) sections.push({ heading: currentHeading, text })
  }

  return sections
}

function chunkText(text) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return []
  if (normalized.length <= CHUNK_SIZE) return [normalized]

  const chunks = []
  let start = 0

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length)

    if (end < normalized.length) {
      const minimumBoundary = start + Math.floor(CHUNK_SIZE * 0.65)
      const boundary = Math.max(
        normalized.lastIndexOf("。", end),
        normalized.lastIndexOf("！", end),
        normalized.lastIndexOf("？", end),
        normalized.lastIndexOf("；", end),
      )
      if (boundary >= minimumBoundary) end = boundary + 1
    }

    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)

    if (end >= normalized.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }

  return chunks
}

function getSourceInfo(relativePath) {
  const normalized = normalizeRelativePath(relativePath)
  const parts = normalized.split("/")
  const fileName = parts.at(-1) || ""
  const baseName = fileName.replace(/\.md$/i, "")
  const topLevel = parts[0] || ""
  const slug = normalizeSearchSlug(normalized)

  if (!slug) return null

  if (/^\d{2}\s/.test(topLevel)) {
    const book = topLevel.replace(/^\d{2}\s*/, "").trim()
    return {
      slug,
      title: `${book} ${baseName}`,
      book,
      chapter: baseName,
      contentType: "chapter",
    }
  }

  return {
    slug,
    title: baseName,
    book: "",
    chapter: "",
    contentType: "topic",
  }
}

async function buildRecords(filePath) {
  const relativePath = normalizeRelativePath(path.relative(CONTENT_DIR, filePath))
  if (!isEmbeddablePath(relativePath)) return []

  const source = getSourceInfo(relativePath)
  if (!source) return []

  const markdown = await fs.readFile(filePath, "utf-8")
  const sections = extractSections(markdown)
  const records = []
  let chunkIndex = 0

  for (const section of sections) {
    const chunks = chunkText(section.text)
    for (const text of chunks) {
      const context = [source.title, section.heading && `段落：${section.heading}`]
        .filter(Boolean)
        .join("\n")

      records.push({
        id: Buffer.from(`${source.slug}#${chunkIndex}`).toString("base64url"),
        embeddingInput: `${context}\n${text}`,
        metadata: {
          slug: source.slug,
          title: source.title,
          text,
          book: source.book,
          chapter: source.chapter,
          section: section.heading || "",
          contentType: source.contentType,
          chunkIndex,
          sourcePath: relativePath,
        },
      })
      chunkIndex++
    }
  }

  return records
}

async function listAllMarkdownFiles() {
  const files = await globby([`${CONTENT_DIR}/**/*.md`])
  return files.filter((file) => {
    const relativePath = path.relative(CONTENT_DIR, file)
    return isEmbeddablePath(relativePath)
  })
}

async function readChangedPaths() {
  const fileName = process.env.CHANGED_FILES_FILE
  if (!fileName) return []

  const raw = await fs.readFile(fileName, "utf-8")
  const contentPrefix = `${normalizeRelativePath(CONTENT_DIR)}/`

  return raw
    .split(/\r?\n/)
    .map((line) => normalizeRelativePath(line.trim()))
    .filter(Boolean)
    .map((filePath) => (filePath.startsWith(contentPrefix) ? filePath.slice(contentPrefix.length) : filePath))
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function requireCredentials() {
  for (const name of ["NVIDIA_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX_NAME"]) {
    if (!process.env[name]) throw new Error(`${name} is missing`)
  }
}

async function embedAndUpsert(index, openai, records) {
  for (let offset = 0; offset < records.length; offset += EMBED_BATCH_SIZE) {
    const batch = records.slice(offset, offset + EMBED_BATCH_SIZE)
    const response = await openai.embeddings.create({
      model: "nvidia/nemotron-3-embed-1b",
      input: batch.map((record) => record.embeddingInput),
      input_type: "passage",
    })

    const embeddings = [...response.data].sort((a, b) => a.index - b.index)
    await index.upsert({
      records: batch.map((record, indexInBatch) => ({
        id: record.id,
        values: embeddings[indexInBatch].embedding,
        metadata: record.metadata,
      })),
    })

    console.log(`Upserted ${Math.min(offset + batch.length, records.length)}/${records.length} chunks`)
  }
}

function getIndexRecordCount(stats) {
  const directCount = Number(stats?.totalRecordCount ?? stats?.totalVectorCount)
  if (Number.isFinite(directCount)) return directCount

  return Object.values(stats?.namespaces ?? {}).reduce((total, namespaceStats) => {
    const count = Number(namespaceStats?.recordCount ?? namespaceStats?.vectorCount ?? 0)
    return total + (Number.isFinite(count) ? count : 0)
  }, 0)
}

async function clearDefaultNamespace(index) {
  const stats = await index.describeIndexStats()
  const recordCount = getIndexRecordCount(stats)

  if (recordCount <= 0) {
    console.log("Pinecone index is empty; skipping deleteAll().")
    return
  }

  console.log(`Deleting ${recordCount} existing vectors for the full rebuild...`)
  await index.deleteAll()
}

async function main() {
  const changedPaths = FULL_REBUILD ? [] : await readChangedPaths()
  const files = FULL_REBUILD
    ? await listAllMarkdownFiles()
    : changedPaths
        .filter((relativePath) => isEmbeddablePath(relativePath))
        .map((relativePath) => path.join(CONTENT_DIR, relativePath))

  if (!FULL_REBUILD && changedPaths.length === 0) {
    console.log("No changed content paths supplied; nothing to sync.")
    return
  }

  const uniqueFiles = [...new Set(files)]
  const sourcePaths = FULL_REBUILD
    ? []
    : [...new Set(changedPaths.filter((relativePath) => isEmbeddablePath(relativePath)))]

  if (DRY_RUN) {
    let total = 0
    for (const file of uniqueFiles) {
      if (await pathExists(file)) total += (await buildRecords(file)).length
    }
    console.log(`Dry run: ${uniqueFiles.length} files, ${total} chunks`)
    return
  }

  requireCredentials()
  const openai = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1",
  })
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME)

  if (FULL_REBUILD) {
    await clearDefaultNamespace(index)
  } else {
    for (const relativePath of sourcePaths) {
      const source = getSourceInfo(relativePath)
      if (source) {
        await index.deleteMany({ filter: { slug: { $eq: source.slug } } })
      }
    }
  }

  const records = []
  for (const file of uniqueFiles) {
    if (!(await pathExists(file))) continue
    records.push(...(await buildRecords(file)))
  }

  console.log(`Embedding ${records.length} chunks from ${uniqueFiles.length} files...`)
  await embedAndUpsert(index, openai, records)
  console.log("Embedding sync completed.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
