// 用法：node scripts/e2e/interactive-check.mjs <站台根網址> <profile 資料夾> [--full] [--shots <資料夾>]
// test_content 站可跑基本檢查；--full 需要完整內容站，否則完整內容檢查會顯示 SKIP。
// 這支腳本驗證 U-24 的使用者決策：從章節頁找到互動網站、依涵蓋經文探索網站，並能回到章節頁。
// 每個工作階段使用獨立的 Chrome 子程序，因為 helpers.mjs 的 finish() 會結束程序。
import { spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { clickSel, open, scrollY, sleep, waitFor } from "../../plugins/verse-return/e2e/helpers.mjs"

const scriptFile = fileURLToPath(import.meta.url)
const args = process.argv.slice(2)
const rootArg = args[0] ?? ""
const profileRoot = args[1] ?? ""
const full = args.includes("--full")
const shotsArgIndex = args.indexOf("--shots")
const shotsDir = shotsArgIndex >= 0 ? (args[shotsArgIndex + 1] ?? "") : ""
const stageArg = args.find((arg) => arg.startsWith("--stage="))
const stage = stageArg?.slice("--stage=".length)

const root = rootArg.replace(/\/+$/, "")

function chapterPath(folder, chapter) {
  return `/${[folder, chapter].map((part) => encodeURIComponent(part)).join("/")}`
}

const chapter6 = chapterPath("01-創世記", "第6章")
const chapter1 = chapterPath("01-創世記", "第1章")
const exodus12 = chapterPath("02-出埃及記", "第12章")
const exodus25 = chapterPath("02-出埃及記", "第25章")
const leviticus16 = chapterPath("03-利未記", "第16章")
const deuteronomy1 = chapterPath("05-申命記", "第1章")
const siteHub = "/appendix/website/"

function parseJson(value) {
  if (typeof value !== "string") return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function check(s, name, ok, detail = "") {
  s.check(name, Boolean(ok), detail)
}

async function saveAt(s, session, name, selector, offset) {
  if (!shotsDir) return false

  const target = JSON.stringify(selector)
  const found = await s.ev(`(() => {
    const el = document.querySelector(${target})
    if (!el) return false
    window.scrollTo({
      top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - ${offset}),
      behavior: "instant",
    })
    return true
  })()`)

  if (!found) {
    console.log(`SKIP  截圖 ${session}-${name}：找不到 ${selector}`)
    return false
  }

  await sleep(300)
  mkdirSync(resolve(shotsDir), { recursive: true })
  const file = join(resolve(shotsDir), `${session}-${name}.png`)
  await s.saveShot(file)
  console.log(`SHOT  ${file} scrollY=${await scrollY(s)}`)
  return true
}

async function saveTop(s, session, name) {
  if (!shotsDir) return false
  await s.ev(`window.scrollTo({ top: 0, behavior: "instant" })`)
  await sleep(300)
  mkdirSync(resolve(shotsDir), { recursive: true })
  const file = join(resolve(shotsDir), `${session}-${name}.png`)
  await s.saveShot(file)
  console.log(`SHOT  ${file} scrollY=${await scrollY(s)}`)
  return true
}

async function captureChapter6(s, session) {
  if (!shotsDir) return
  await s.go(chapter6, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)
  await saveAt(s, session, "創6上方一行", ".bwz-ia-line", 120)
  await saveAt(s, session, "創6小卡", 'h3[id="互動網站"]', 100)
}

async function captureFullPages(s, session) {
  if (!shotsDir) return

  await s.go(siteHub, 4500)
  await waitFor(s, `!!document.querySelector(".bwz-ia-hub")`, 6000)
  await saveTop(s, session, "總入口頂端")
  await saveAt(s, session, "總入口長軸", ".bwz-ia-axis", 100)

  await s.go(exodus12, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)
  await saveAt(s, session, "出12小卡", ".bwz-ia-chapter .bwz-ia-frame", 100)
}

async function inspectChapter6(s) {
  const raw = await s.ev(`(() => {
    const article = document.querySelector("article")
    const line = article?.querySelector(".bwz-ia-line")
    let next = line?.nextSibling
    while (next && next.nodeType === Node.TEXT_NODE && !next.textContent.trim()) next = next.nextSibling

    const oldLinks = [...(article?.querySelectorAll("a[href]") ?? [])].filter((link) => {
      if (link.closest('[class*="bwz-ia-"]')) return false
      let href = link.getAttribute("href") || ""
      try { href = decodeURIComponent(href) } catch {}
      return /static\\/website\\//i.test(href)
    })
    const externalLinks = [...document.querySelectorAll('.bwz-ia-frame a[target="_blank"]')]
    const headingCount = document.querySelectorAll('h3[id="互動網站"]').length
    const frames = document.querySelectorAll(".bwz-ia-chapter .bwz-ia-frame").length

    return JSON.stringify({
      lineExists: Boolean(line),
      lineText: line?.textContent.trim() ?? "",
      lineBeforeList: Boolean(next && next.nodeType === Node.ELEMENT_NODE && next.matches("ol")),
      headingCount,
      frames,
      oldLinkCount: oldLinks.length,
      externalRelOk: externalLinks.every((link) =>
        (link.getAttribute("rel") || "").toLowerCase().split(/\\s+/).includes("noopener"),
      ),
      externalLinkCount: externalLinks.length,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    })
  })()`)

  const state = parseJson(raw)
  check(s, "創世記第 6 章：上方一行存在", state.lineExists, state.lineText)
  check(s, "創世記第 6 章：上方一行緊接經文清單", state.lineBeforeList)
  check(
    s,
    "創世記第 6 章：上方一行文字包含本章網站與方舟",
    state.lineText.includes("本章有 1 個互動網站") && state.lineText.includes("方舟"),
    state.lineText,
  )
  check(s, "創世記第 6 章：互動網站標題只有一個", state.headingCount === 1, `數量=${state.headingCount}`)
  check(s, "創世記第 6 章：互動網站小卡只有一張", state.frames === 1, `數量=${state.frames}`)
  check(s, "創世記第 6 章：舊附錄清單沒有 static/website 連結", state.oldLinkCount === 0, `數量=${state.oldLinkCount}`)
  check(
    s,
    "互動網站新分頁連結含 noopener",
    state.externalRelOk,
    `連結數=${state.externalLinkCount}`,
  )
  check(s, "創世記第 6 章：頁面沒有水平溢出", state.noOverflow)

  let clicked = false
  if (state.lineExists) clicked = await clickSel(s, ".bwz-ia-line")
  check(s, "可以點擊創世記第 6 章上方一行", clicked)

  const position = parseJson(
    await s.ev(`(() => {
      const heading = document.querySelector('h3[id="互動網站"]')
      if (!heading) return null
      const rect = heading.getBoundingClientRect()
      return JSON.stringify({ top: rect.top, height: window.innerHeight })
    })()`),
  )
  check(
    s,
    "點擊上方一行後 300ms 內標題上緣在畫面內",
    typeof position.top === "number" && position.top >= -2 && position.top <= position.height,
    `top=${position.top ?? "—"}，innerHeight=${position.height ?? "—"}`,
  )

  const frameExists = await s.ev(`!!document.querySelector(".bwz-ia-chapter .bwz-ia-frame")`)
  if (frameExists) {
    await s.ev(`document.querySelector(".bwz-ia-chapter .bwz-ia-frame").scrollIntoView({ block: "center", behavior: "instant" })`)
    await sleep(300)
    await sleep(1500)
  }
  const cover = parseJson(
    await s.ev(`(() => {
      const frame = document.querySelector(".bwz-ia-chapter .bwz-ia-frame")
      const image = frame?.querySelector("img")
      const textCover = frame?.querySelector(".bwz-ia-tcover")
      return JSON.stringify({
        imageLoaded: Boolean(image && image.complete && image.naturalWidth > 0),
        textCover: Boolean(textCover),
      })
    })()`),
  )
  const coverKind = cover.imageLoaded ? "圖片封面" : cover.textCover ? "書法封面" : "沒有可用封面"
  check(
    s,
    "第一張互動網站卡片有可顯示的封面",
    cover.imageLoaded || cover.textCover,
    coverKind,
  )
}

async function inspectChapter1(s) {
  await s.go(chapter1, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)

  const state = parseJson(
    await s.ev(`(() => {
      const line = document.querySelector(".bwz-ia-line")
      const frames = [...document.querySelectorAll(".bwz-ia-chapter .bwz-ia-frame")]
      const frame = frames.find((item) =>
        item.querySelector(".bwz-ia-deep")?.textContent.includes("創世記 1 章"),
      )
      const deep = frame?.querySelector(".bwz-ia-deep")
      const links = [...(frame?.querySelectorAll("a[href]") ?? [])].map((link) => {
        let href = link.getAttribute("href") || ""
        try { href = decodeURIComponent(href) } catch {}
        return href
      })
      return JSON.stringify({
        lineText: line?.textContent.trim() ?? "",
        hasLine: Boolean(line),
        deepText: deep?.textContent.trim() ?? "",
        deepLinkOk: links.some((href) => href.endsWith("#/ref/創1")),
      })
    })()`),
  )

  check(
    s,
    "創世記第 1 章：上方一行列出律法地圖",
    state.hasLine &&
      (state.lineText.includes("律法地圖") || state.lineText.includes("摩西五經的律法")),
    state.lineText,
  )
  check(
    s,
    "創世記第 1 章：律法卡片直達創 1",
    state.deepLinkOk,
    state.deepText,
  )
  check(
    s,
    "創世記第 1 章：律法卡片說明包含創世記 1 章",
    state.deepText.includes("創世記 1 章"),
    state.deepText,
  )
}

async function inspectPureView(s) {
  await s.go(chapter6, 4500)
  await waitFor(s, `!!document.querySelector(".bwz-ia-line")`, 6000)

  await s.ev(`sessionStorage.setItem("bwz-ux-view", "pure")`)
  await s.ev("location.reload()")
  await sleep(4500)
  await waitFor(s, `!!document.querySelector(".bwz-ia-line")`, 6000)

  const hidden = await s.ev(`(() => {
    const line = document.querySelector(".bwz-ia-line")
    const card = document.querySelector(".bwz-ia-chapter")
    return Boolean(line && card && line.offsetParent === null && card.offsetParent === null)
  })()`)
  check(s, "純經文模式隱藏上方一行與互動網站小卡", hidden)

  await s.ev(`sessionStorage.removeItem("bwz-ux-view")`)
  await s.ev("location.reload()")
  await sleep(4500)
  await waitFor(s, `!!document.querySelector(".bwz-ia-chapter")`, 6000)

  const shown = await s.ev(`(() => {
    const line = document.querySelector(".bwz-ia-line")
    const card = document.querySelector(".bwz-ia-chapter")
    return Boolean(line && card && line.offsetParent !== null && card.offsetParent !== null)
  })()`)
  check(s, "移除純經文模式後重新顯示上方一行與小卡", shown)
}

async function inspectHome(s) {
  await s.go("/?skip=1", 4500)
  await waitFor(s, `!!document.querySelector(".bwz-hub-links")`, 6000)

  const state = parseJson(
    await s.ev(`(() => {
      const links = [...document.querySelectorAll(".bwz-hub-links a")]
      const labels = ["快速入門", "互動網站", "附錄"]
      const texts = links.map((link) => link.textContent.trim())
      const positions = labels.map((label) => texts.findIndex((text) => text.includes(label)))
      const interactive = links.find((link) => link.textContent.includes("互動網站"))
      let href = interactive?.getAttribute("href") || ""
      try { href = decodeURIComponent(href) } catch {}
      return JSON.stringify({
        texts,
        inOrder: positions.every((index) => index >= 0) &&
          positions[0] < positions[1] && positions[1] < positions[2],
        interactiveHref: href,
        interactiveHrefOk: href.includes("appendix/website"),
      })
    })()`),
  )

  check(
    s,
    "首頁快速入門、互動網站、附錄依序排列",
    state.inOrder,
    state.texts.join("、"),
  )
  check(
    s,
    "首頁互動網站入口連到總入口",
    state.interactiveHrefOk,
    state.interactiveHref,
  )
}

async function inspectExodus12(s) {
  await s.go(exodus12, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)

  const state = parseJson(
    await s.ev(`(() => {
      const article = document.querySelector("article")
      const cards = [...(article?.querySelectorAll(".bwz-ia-chapter .bwz-ia-frame") ?? [])]
      const titles = cards.map((card) =>
        card.querySelector(".bwz-ia-title")?.textContent.trim() ?? card.textContent.trim(),
      )
      const map = article?.querySelector("#相關地圖")
      const afterMap = !map || cards.every((card) =>
        Boolean(map.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING),
      )
      const law = cards.find((card) =>
        card.querySelector(".bwz-ia-deep")?.textContent.includes("出埃及記 12 章"),
      )
      const lawLinks = [...(law?.querySelectorAll("a[href]") ?? [])].map((link) => {
        let href = link.getAttribute("href") || ""
        try { href = decodeURIComponent(href) } catch {}
        return href
      })
      return JSON.stringify({
        titles,
        afterMap,
        lawLinkOk: lawLinks.some((href) => href.endsWith("#/ref/出12")),
      })
    })()`),
  )

  check(
    s,
    "出埃及記第 12 章：互動網站卡片有兩張且順序正確",
    state.titles.length === 2 &&
      state.titles[0].includes("耶和華的節期") &&
      state.titles[1].includes("摩西五經的律法"),
    state.titles.join("、"),
  )
  check(s, "出埃及記第 12 章：卡片在相關地圖之後", state.afterMap)
  check(s, "出埃及記第 12 章：律法卡片直達出 12", state.lawLinkOk)
}

async function inspectExodus25(s) {
  await s.go(exodus25, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)

  const state = parseJson(
    await s.ev(`(() => {
      const cards = [...document.querySelectorAll(".bwz-ia-chapter .bwz-ia-frame")]
      const titles = cards.map((card) =>
        card.querySelector(".bwz-ia-title")?.textContent.trim() ?? card.textContent.trim(),
      )
      return JSON.stringify({ titles })
    })()`),
  )

  check(
    s,
    "出埃及記第 25 章：有兩張卡且第一張是照山上的樣式",
    state.titles.length === 2 && state.titles[0].includes("照山上的樣式"),
    state.titles.join("、"),
  )
}

async function inspectLeviticus16(s) {
  await s.go(leviticus16, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)

  const state = parseJson(
    await s.ev(`(() => {
      const article = document.querySelector("article")
      const heading = article?.querySelector('h2[id="附錄"]')
      const card = article?.querySelector(".bwz-ia-chapter")
      const navTables = [...(article?.querySelectorAll(".table-container") ?? [])].filter((table) =>
        /前一章|下一章/.test(table.textContent),
      )
      const lastNav = navTables.at(-1)
      return JSON.stringify({
        headingExists: Boolean(heading),
        cardAfterHeading: Boolean(
          heading && card &&
          (heading.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING),
        ),
        cardBeforeLastNavigation: Boolean(
          card && lastNav &&
          (card.compareDocumentPosition(lastNav) & Node.DOCUMENT_POSITION_FOLLOWING),
        ),
        hasLastNavigation: Boolean(lastNav),
      })
    })()`),
  )

  check(s, "利未記第 16 章：建立附錄標題", state.headingExists)
  check(s, "利未記第 16 章：互動網站卡片位於附錄標題之後", state.cardAfterHeading)
  check(
    s,
    "利未記第 16 章：互動網站卡片位於最後一個前後章導覽表格之前",
    state.hasLastNavigation && state.cardBeforeLastNavigation,
  )
}

async function inspectDeuteronomy1(s) {
  await s.go(deuteronomy1, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)

  const state = await s.ev(`(() => ({
    hasLine: Boolean(document.querySelector(".bwz-ia-line")),
    hasCard: Boolean(document.querySelector(".bwz-ia-chapter")),
  }))()`)

  check(
    s,
    "申命記第 1 章：沒有不相關的互動網站入口",
    state && !state.hasLine && !state.hasCard,
    JSON.stringify(state),
  )
}

async function inspectHub(s) {
  await s.go(siteHub, 4500)
  await waitFor(s, `!!document.querySelector(".bwz-ia-hub")`, 6000)

  const state = parseJson(
    await s.ev(`(() => {
      const hub = document.querySelector(".bwz-ia-hub")
      const hall = hub?.querySelector('h2[id="貫穿好幾卷書"]')
      const wall = hall?.nextElementSibling?.matches(".bwz-ia-wall") ? hall.nextElementSibling : null
      const frames = [...(wall?.querySelectorAll(".bwz-ia-frame") ?? [])]
      const firstTitle = frames[0]?.querySelector(".bwz-ia-title")?.textContent.trim() ?? ""
      const law = frames.find((frame) => frame.textContent.includes("摩西五經的律法"))
      const cells = law?.querySelectorAll(".bwz-ia-cell").length ?? 0
      const books = [...document.querySelectorAll(".bwz-ia-axis .bwz-ia-book")].map((item) =>
        item.querySelector(".bwz-ia-book-name")?.textContent.trim() ?? item.textContent.trim(),
      )
      const stops = [...document.querySelectorAll(".bwz-ia-axis .bwz-ia-stop")].map((item) =>
        item.classList.contains("bwz-ia-l") ? "l" : item.classList.contains("bwz-ia-r") ? "r" : "?",
      )
      const source = document.querySelector("details.bwz-ia-source")
      return JSON.stringify({
        hubExists: Boolean(hub),
        wallCount: frames.length,
        firstTitle,
        lawHasFiveCells: cells === 5,
        books,
        stops,
        sourceExists: Boolean(source),
        sourceClosed: Boolean(source && source.open === false),
        sourceHasList: Boolean(source?.querySelector("ul") && source.querySelector("ul a[href]")),
        h1Count: document.querySelectorAll("h1").length,
      })
    })()`),
  )

  check(s, "總入口存在", state.hubExists)
  check(s, "貫穿好幾卷書的牆有三張卡", state.wallCount === 3, `數量=${state.wallCount}`)
  check(
    s,
    "總入口第一張卡是摩西五經的律法",
    state.firstTitle.includes("摩西五經的律法"),
    state.firstTitle,
  )
  check(s, "摩西五經律法卡有五格涵蓋資料", state.lawHasFiveCells)
  const expectedBooks = ["創世記", "出埃及記", "利未記", "民數記"]
  check(
    s,
    "長軸書卷依序包含創世記至民數記",
    expectedBooks.every((book, index) => state.books[index] === book),
    state.books.join("、"),
  )
  check(
    s,
    "長軸六個停靠點左右交錯",
    JSON.stringify(state.stops) === JSON.stringify(["l", "r", "l", "r", "l", "r"]),
    state.stops.join("、"),
  )
  check(
    s,
    "原依章節清單收在預設收起的 details 裡",
    state.sourceExists && state.sourceClosed && state.sourceHasList,
  )
  check(s, "總入口只有一個 h1", state.h1Count === 1, `數量=${state.h1Count}`)
}

async function inspectSpa(s) {
  await s.go("/?skip=1", 4500)
  await waitFor(s, `!!document.querySelector(".bwz-hub-links")`, 6000)

  const clickedHubLink = await s.ev(`!!document.querySelector('.bwz-hub-links a[href*="appendix/website"]')`)
  check(s, "首頁有可點擊的互動網站入口", clickedHubLink)
  const hubClicked = clickedHubLink
    ? await clickSel(s, '.bwz-hub-links a[href*="appendix/website"]')
    : false
  check(s, "點擊首頁互動網站入口", hubClicked)

  const hubReady = hubClicked
    ? await waitFor(s, `!!document.querySelector(".bwz-ia-hub")`, 6000)
    : false
  const pathOk = hubReady
    ? await s.ev(`decodeURIComponent(location.pathname).includes("appendix/website")`)
    : false
  check(s, "SPA 換頁後到達互動網站總入口", Boolean(hubReady && pathOk), `path=${await s.ev("location.pathname")}`)

  const firstAxisLink = hubReady
    ? await s.ev(`!!document.querySelector(".bwz-ia-axis a.bwz-ia-ch")`)
    : false
  check(s, "總入口長軸有可點擊的第一個章節", firstAxisLink)
  const axisClicked = firstAxisLink
    ? await clickSel(s, ".bwz-ia-axis a.bwz-ia-ch")
    : false
  check(s, "點擊長軸第一個章節", axisClicked)

  const lineReady = axisClicked
    ? await waitFor(s, `!!document.querySelector(".bwz-ia-line")`, 6000)
    : false
  check(s, "SPA 換到章節頁後出現上方一行", Boolean(lineReady))
}

async function runBasicChecks(s, session) {
  await s.go(chapter6, 4500)
  await waitFor(s, `!!document.querySelector("article")`, 6000)
  await captureChapter6(s, session)
  await inspectChapter6(s)
  await inspectChapter1(s)
  await inspectPureView(s)
  await inspectHome(s)
}

async function runFullChecks(s, session) {
  await inspectExodus12(s)
  await inspectExodus25(s)
  await inspectLeviticus16(s)
  await inspectDeuteronomy1(s)
  await inspectHub(s)
  await inspectSpa(s)
  await captureFullPages(s, session)
}

async function runStage(session) {
  const settings = {
    A: { theme: "light", width: 390, height: 844, mobile: true },
    B: { theme: "light", width: 1440, height: 900, mobile: false },
    C: { theme: "dark", width: 390, height: 844, mobile: true },
    D: { theme: "dark", width: 1440, height: 900, mobile: false },
  }[session]

  if (!settings) {
    console.error(`未知的工作階段：${session}`)
    process.exitCode = 1
    return
  }

  const s = await open({
    root,
    profileRoot,
    theme: settings.theme,
    width: settings.width,
    height: settings.height,
    mobile: settings.mobile,
  })

  try {
    if (session === "D") {
      await captureChapter6(s, session)
      if (full) {
        await captureFullPages(s, session)
      } else if (shotsDir) {
        console.log("SKIP  --full 未啟用，略過總入口與出12截圖")
      }
    } else {
      await runBasicChecks(s, session)
      if (full) {
        await runFullChecks(s, session)
      } else {
        console.log("SKIP  完整內容站檢查（請加 --full）")
      }
    }
  } catch (error) {
    check(s, `工作階段 ${session} 執行完成`, false, error instanceof Error ? error.message : String(error))
  }

  check(
    s,
    `工作階段 ${session} 沒有 JavaScript 例外`,
    s.errors.length === 0,
    s.errors.join("；"),
  )
  s.finish()
}

function runAllStages() {
  if (!root || !profileRoot) {
    console.error("用法：node scripts/e2e/interactive-check.mjs <站台根網址> <profile 資料夾> [--full] [--shots <資料夾>]")
    process.exitCode = 1
    return
  }

  if (shotsArgIndex >= 0 && !shotsDir) {
    console.error("--shots 後面需要資料夾路徑")
    process.exitCode = 1
    return
  }

  let passed = 0
  let total = 0
  let failed = false

  for (const session of ["A", "B", "C", "D"]) {
    const childArgs = [scriptFile, root, profileRoot, `--stage=${session}`]
    if (full) childArgs.push("--full")
    if (shotsDir) childArgs.push("--shots", shotsDir)

    const result = spawnSync(process.execPath, childArgs, { encoding: "utf8" })
    if (result.stdout) {
      const checks = [...result.stdout.matchAll(/^(PASS|FAIL)\s{2}/gm)]
      for (const match of checks) {
        total += 1
        if (match[1] === "PASS") passed += 1
        else failed = true
      }

      let output = result.stdout.replace(/(?:^|\n)\d+\/\d+ 通過\s*(?=\n|$)/g, "")
      if (output.trim()) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`)
    }

    if (result.stderr) process.stderr.write(result.stderr)
    if (result.error) {
      failed = true
      total += 1
      console.error(`工作階段 ${session} 無法啟動：${result.error.message}`)
    }
    if (result.status !== 0) {
      failed = true
      if (!result.error && !/^FAIL\s{2}/m.test(result.stdout ?? "")) total += 1
      console.error(`工作階段 ${session} 結束狀態：${result.status ?? result.signal ?? "未知"}`)
    }
  }

  console.log(`${passed}/${total} 通過`)
  if (failed) process.exitCode = 1
}

if (stage) {
  await runStage(stage)
} else {
  runAllStages()
}
