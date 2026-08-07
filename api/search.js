import { OpenAI } from "openai"
import { Pinecone } from "@pinecone-database/pinecone"
import { normalizeSearchSlug } from "./slug.js"

// Vercel Serverless Function
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const rawQuery = req.query?.q
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery
  if (typeof query !== "string" || query.trim() === "") {
    return res.status(400).json({ error: "Query parameter 'q' is required" })
  }

  try {
    // 1. Initialize OpenAI client pointing to NVIDIA
    const openai = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: "https://integrate.api.nvidia.com/v1",
    })

    // 2. Initialize Pinecone client
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index(process.env.PINECONE_INDEX_NAME)

    // 3. Generate embedding for the search query using nemotron
    const embeddingResponse = await openai.embeddings.create({
      model: "nvidia/nemotron-3-embed-1b",
      input: query.trim(),
      input_type: "query", // Specify this is a query, not a passage
    })

    const queryEmbedding = embeddingResponse.data[0].embedding

    // 4. Return the ten best semantic matches required by the search UI.
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 10,
      includeMetadata: true,
    })

    // 5. Format results
    const results = (searchResults.matches ?? [])
      .map((match) => {
        const metadata = match.metadata ?? {}
        const slug = normalizeSearchSlug(metadata.slug)
        if (!slug) return null

        return {
          score: match.score,
          slug,
          title: metadata.title ?? slug,
          text: metadata.text ?? "",
        }
      })
      .filter(Boolean)

    // Return the results
    return res.status(200).json({ results })
  } catch (error) {
    console.error("Search API Error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
