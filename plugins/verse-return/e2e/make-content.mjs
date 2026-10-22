// 替 verse-return 的 e2e 備一份內容：test_content 加上幾個「知識節點」條目。
// 為什麼：test_content 的經文連結（[[安息]]、[[耶和華神的名字]]…）目前都指向不存在的條目（會開到 404 頁），
// 但檢查需要條目頁（條目之間連續跳、懸停預覽、條目連回章節）。這裡生成最小的條目，不動 test_content。
// 用法：node e2e/make-content.mjs <test_content 路徑> <輸出資料夾>
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [src, out] = process.argv.slice(2)
if (!src || !out) {
  console.error("用法：node e2e/make-content.mjs <test_content 路徑> <輸出資料夾>")
  process.exit(2)
}
rmSync(out, { recursive: true, force: true })
cpSync(src, out, { recursive: true })
const dir = join(out, "知識節點")
mkdirSync(dir, { recursive: true })

// 條目名稱 → 這一頁裡的連結（用來在條目之間連續跳）
const entries = {
  安息: ["安息日", "創造（從無到有）", "[[01 創世記/第2章|創世記第2章]]", "[[01 創世記/第6章|創世記第6章]]"],
  安息日: ["耶和華神的名字", "安息"],
  "創造（從無到有）": ["安息", "耶和華神的名字"],
  耶和華神的名字: ["安息日", "安息"],
  伊甸園四河: ["創造（從無到有）"],
  人: ["安息"],
  亞當: ["人"],
}
for (const [name, links] of Object.entries(entries)) {
  const body = links.map((l) => (l.startsWith("[[") ? l : `[[${l}]]`)).join("、")
  writeFileSync(join(dir, `${name}.md`), `---\ntitle: ${name}\n---\n\n# ${name}\n\n## 定義\n\n${name}的說明。相關：${body}。\n`)
}
console.log(`wrote ${Object.keys(entries).length} entries to ${dir}`)
