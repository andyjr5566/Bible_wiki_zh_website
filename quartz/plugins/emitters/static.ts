import { FilePath, QUARTZ, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import fs from "fs"
import { glob } from "../../util/glob"
import { dirname } from "path"

export const Static: QuartzEmitterPlugin = () => ({
  name: "Static",
  async *emit({ argv, cfg }) {
    const staticPath = joinSegments(QUARTZ, "static")
    const fps = await glob("**", staticPath, cfg.configuration.ignorePatterns)
    const outputStaticPath = joinSegments(argv.output, "static")
    await fs.promises.mkdir(outputStaticPath, { recursive: true })
    for (const fp of fps) {
      const src = joinSegments(staticPath, fp) as FilePath
      const dest = joinSegments(outputStaticPath, fp) as FilePath
      await fs.promises.mkdir(dirname(dest), { recursive: true })
      await fs.promises.copyFile(src, dest)
      yield dest
    }
    // Service Worker 只能管「自己所在資料夾以下」的網址。放在 static/ 底下就管不到整個網站，
    // 而 GitHub Pages 無法送 Service-Worker-Allowed 標頭放寬，所以另外輸出一份到網站根目錄。
    const sw = joinSegments(staticPath, "sw.js") as FilePath
    if (fs.existsSync(sw)) {
      const dest = joinSegments(argv.output, "sw.js") as FilePath
      await fs.promises.copyFile(sw, dest)
      yield dest
    }
  },
  async *partialEmit() {},
})
