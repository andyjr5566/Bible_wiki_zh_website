import fs from "fs/promises"
import path from "path"
import { globby } from "globby"
import { OpenAI } from "openai"
import { Pinecone } from "@pinecone-database/pinecone"
import dotenv from "dotenv"
import { unified } from "unified"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"

dotenv.config()

// Ensure environment variables are set
if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is missing")
if (!process.env.PINECONE_API_KEY) throw new Error("PINECONE_API_KEY is missing")
if (!process.env.PINECONE_INDEX_NAME) throw new Error("PINECONE_INDEX_NAME is missing")

// Use OpenAI SDK but point to NVIDIA's API
const openai = new OpenAI({ 
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1"
})
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })

// Use test_content for testing
const CONTENT_DIR = "test_content"
const CHUNK_SIZE = 500 // roughly words/tokens to chunk by

// Extract plain text from Markdown using Remark
function extractTextFromMarkdown(markdown) {
  const file = unified().use(remarkParse).parse(markdown)
  let text = ""
  
  // visit all text nodes
  visit(file, "text", (node) => {
    text += node.value + " "
  })
  
  // also extract code blocks, if relevant
  visit(file, "code", (node) => {
    text += node.value + " "
  })

  return text.trim()
}

// Split text into smaller chunks
function chunkText(text, size) {
  const words = text.split(/\s+/)
  const chunks = []
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "))
  }
  return chunks
}

async function main() {
  console.log("Starting embedding generation...")
  
  // Get all markdown files
  const files = await globby([`${CONTENT_DIR}/**/*.md`])
  console.log(`Found ${files.length} markdown files.`)
  
  const index = pc.index(process.env.PINECONE_INDEX_NAME)
  
  let totalChunks = 0
  
  for (const file of files) {
    console.log(`Processing: ${file}`)
    const content = await fs.readFile(file, "utf-8")
    
    // Clean up frontmatter (simple regex)
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---/, "")
    
    const plainText = extractTextFromMarkdown(contentWithoutFrontmatter)
    if (!plainText) continue
    
    const chunks = chunkText(plainText, CHUNK_SIZE)
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      // Calculate a URL slug from the filename
      // e.g. content/Genesis/Genesis-1.md -> Genesis/Genesis-1
      const relativePath = path.relative(CONTENT_DIR, file)
      const slug = relativePath.replace(/\.md$/, "").replace(/\\/g, "/")
      
      // Generate embedding using NVIDIA Nemotron
      const response = await openai.embeddings.create({
        model: "nvidia/nemotron-3-embed-1b", // Use the exact model name from nvidia build
        input: chunk,
        input_type: "passage" // nemotron often requires specifying passage vs query
      })
      
      const embedding = response.data[0].embedding
      
      // Upsert to Pinecone
      await index.upsert({
        records: [{
          id: Buffer.from(`${slug}-${i}`).toString('base64'),
          values: embedding,
          metadata: {
            slug: slug,
            text: chunk,
            title: path.basename(file, ".md")
          }
        }]
      })
      totalChunks++
    }
  }
  
  console.log(`Successfully embedded ${totalChunks} chunks into Pinecone.`)
}

main().catch(console.error)
