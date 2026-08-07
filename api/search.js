import { OpenAI } from "openai"
import { Pinecone } from "@pinecone-database/pinecone"

// Vercel Serverless Function
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const query = req.query.q
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required" })
  }

  try {
    // 1. Initialize OpenAI client pointing to NVIDIA
    const openai = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: "https://integrate.api.nvidia.com/v1"
    })

    // 2. Initialize Pinecone client
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    })
    const index = pc.index(process.env.PINECONE_INDEX_NAME)

    // 3. Generate embedding for the search query using nemotron
    const embeddingResponse = await openai.embeddings.create({
      model: "nvidia/nemotron-3-embed-1b",
      input: query,
      input_type: "query" // Specify this is a query, not a passage
    })
    
    const queryEmbedding = embeddingResponse.data[0].embedding

    // 4. Query Pinecone for top 30 matches
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 30,
      includeMetadata: true
    })

    // 5. Format results
    const results = searchResults.matches.map(match => {
      const rawSlug = match.metadata.slug;
      const slugified = rawSlug ? rawSlug.split("/").map(seg => seg.replace(/\s/g, "-").replace(/&/g, "-and-").replace(/%/g, "-percent").replace(/\?/g, "").replace(/#/g, "").toLowerCase()).join("/") : rawSlug;

      return {
        score: match.score,
        slug: slugified,
        title: match.metadata.title,
        text: match.metadata.text
      };
    })

    // Return the results
    return res.status(200).json({ results })
  } catch (error) {
    console.error("Search API Error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
