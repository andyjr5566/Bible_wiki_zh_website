// 逐一執行 plugins/ 底下各外掛自己的 `npm test`（只跑有 test 指令的外掛）。
// 根目錄的 `npm test` 只負責根目錄自己的測試；外掛測試用各自的測試工具（vitest），要另外跑這支。
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join } from "node:path"

const root = join(import.meta.dirname, "..", "plugins")
const failed = []
for (const name of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const pkgPath = join(root, name, "package.json")
  if (!existsSync(pkgPath)) continue
  if (!JSON.parse(readFileSync(pkgPath, "utf8")).scripts?.test) continue
  console.log(`\n=== plugins/${name} ===`)
  const r = spawnSync("npm", ["--prefix", join(root, name), "test"], { stdio: "inherit", shell: true })
  if (r.status !== 0) failed.push(name)
}
if (failed.length) {
  console.error(`\n失敗的外掛：${failed.join(", ")}`)
  process.exit(1)
}
