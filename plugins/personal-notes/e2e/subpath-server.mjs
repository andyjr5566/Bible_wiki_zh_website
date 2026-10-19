// 模擬 GitHub Pages 專案站：把建置輸出掛在 /Bible_wiki_zh_website/ 底下。
// /foo → foo.html、/dir/ → dir/index.html；不送 Service-Worker-Allowed（GitHub Pages 也不能送）。
// node subpath-server.mjs <publicDir> <port>
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

const [root, port = "8090"] = process.argv.slice(2)
const PREFIX = "/Bible_wiki_zh_website"
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" }

async function tryFile(p) {
  try {
    const s = await stat(p)
    return s.isFile() ? p : null
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x")
  let p = decodeURIComponent(url.pathname)
  if (p === "/" || !p.startsWith(PREFIX)) {
    res.writeHead(p === "/" ? 302 : 404, p === "/" ? { location: PREFIX + "/" } : {})
    return res.end()
  }
  p = p.slice(PREFIX.length) || "/"
  const base = path.join(root, p)
  const file = (await tryFile(base)) ?? (await tryFile(base + ".html")) ?? (await tryFile(path.join(base, "index.html")))
  if (!file) {
    const nf = await tryFile(path.join(root, "404.html"))
    res.writeHead(404, { "content-type": TYPES[".html"] })
    return res.end(nf ? await readFile(nf) : "not found")
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" })
  res.end(await readFile(file))
}).listen(Number(port), () => console.log(`subpath server on http://localhost:${port}${PREFIX}/`))
