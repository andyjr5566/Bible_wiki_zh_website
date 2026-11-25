// 模擬 GitHub Pages 專案站：把建置輸出掛在 /Bible_wiki_zh_website/ 底下。
// /foo → foo.html、/dir/ → dir/index.html；不送 Service-Worker-Allowed（GitHub Pages 也不能送）。
// node subpath-server.mjs <publicDir> <port>
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

const [root, port = "8090"] = process.argv.slice(2)
const PREFIX = "/Bible_wiki_zh_website"
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".mjs": "text/javascript", ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".bin": "application/octet-stream" }

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
  const type = TYPES[path.extname(file)] ?? "application/octet-stream"
  const buf = await readFile(file)
  const headers = { "content-type": type, "cache-control": "no-cache", "accept-ranges": "bytes" }
  // 單一區間的 Range 請求（語意搜尋用它只抓需要的列）；GitHub Pages 同樣支援
  const range = req.headers.range
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    let start, end
    if (m && (m[1] !== "" || m[2] !== "")) {
      if (m[1] === "") { start = Math.max(0, buf.length - Number(m[2])); end = buf.length - 1 } // bytes=-n：最後 n 個位元組
      else { start = Number(m[1]); end = m[2] === "" ? buf.length - 1 : Math.min(Number(m[2]), buf.length - 1) }
    }
    if (start === undefined || start >= buf.length || start > end) {
      res.writeHead(416, { ...headers, "content-range": `bytes */${buf.length}` })
      return res.end()
    }
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": end - start + 1 })
    return res.end(buf.subarray(start, end + 1))
  }
  res.writeHead(200, { ...headers, "content-length": buf.length })
  res.end(buf)
}).listen(Number(port), () => console.log(`subpath server on http://localhost:${port}${PREFIX}/`))
