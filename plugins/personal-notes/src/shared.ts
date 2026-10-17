// 建置期共用：找到 dist/client/app.js 並計算版本（內容雜湊），供瀏覽器快取更新使用。
import { createHash } from "crypto"
import { existsSync, readFileSync } from "fs"
import { fileURLToPath } from "url"

let cachedVersion: string | null = null

/**
 * dist/client/app.js 的實際路徑。元件程式同時被打包進 dist/index.js 與 dist/components/index.js，
 * 相對位置不同，所以兩個候選都試。
 */
export function clientAppPath(fromModuleUrl: string): string {
  for (const rel of ["./client/app.js", "../client/app.js"]) {
    const p = fileURLToPath(new URL(rel, fromModuleUrl))
    if (existsSync(p)) return p
  }
  throw new Error("[personal-notes] 找不到 dist/client/app.js，請先在 plugins/personal-notes 執行 npm run build")
}

export function appVersion(fromModuleUrl: string): string {
  if (cachedVersion) return cachedVersion
  cachedVersion = createHash("sha256").update(readFileSync(clientAppPath(fromModuleUrl))).digest("hex").slice(0, 10)
  return cachedVersion
}
