import express from "express"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import handler from "./api/search.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000

// Redirect root to base path
app.get("/", (req, res) => {
  res.redirect("/Bible_wiki_zh_website/")
})

// Serve the static build of Quartz under its base path
app.use("/Bible_wiki_zh_website", express.static(path.join(__dirname, "public"), { extensions: ["html"] }))

// Proxy API request to our Vercel function handler
app.get("/api/search", async (req, res) => {
  console.log(`[API] Received search request: ${req.url}`)
  try {
    await handler(req, res)
    console.log(`[API] Successfully handled search request`)
  } catch (error) {
    console.error(`[API] Error handling request:`, error)
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" })
    }
  }
})



app.listen(PORT, () => {
  console.log(`Test server is running at http://localhost:${PORT}`)
  console.log("Press Ctrl+C to stop.")
})
