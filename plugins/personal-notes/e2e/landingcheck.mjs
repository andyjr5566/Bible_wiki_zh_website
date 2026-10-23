import {
  chapterPath,
  clickSel,
  mouse,
  open,
  scrollY,
  sleep,
  urlPath,
  waitFor,
} from "../../verse-return/e2e/helpers.mjs"

const [rootArg, profileRoot, shotDir] = process.argv.slice(2)
if (!rootArg || !profileRoot || !shotDir) {
  console.log("用法：node plugins/personal-notes/e2e/landingcheck.mjs <root> <profileRoot> <shotDir>")
  process.exit(2)
}

const root = rootArg.replace(/\/+$/, "")
const chapter = chapterPath(1)

async function loadChapter(s) {
  await s.go(chapter, 4500)
  return await waitFor(s, "!!document.querySelector('article')", 8000)
}

async function scrollNearBottom(s) {
  await s.ev(
    "window.scrollTo({ top: Math.max(0, document.documentElement.scrollHeight - window.innerHeight - 80), behavior: 'instant' })",
  )
  await sleep(150)
}

async function visibleArticleLink(s, appendix = false) {
  const selector = appendix
    ? 'article a.internal[href*="appendix"]'
    : "article a.internal"
  const result = await s.ev(`(() => {
    const links = [...document.querySelectorAll(${JSON.stringify(selector)})]
    const a = links.find((link) => {
      const u = new URL(link.href, location.href)
      const r = link.getClientRects()[0]
      return u.origin === location.origin &&
        u.pathname !== location.pathname &&
        !u.hash &&
        r && r.width > 0 && r.height > 0 &&
        r.bottom > 0 && r.top < innerHeight &&
        r.right > 0 && r.left < innerWidth
    })
    if (!a) return null
    const id = "__landingcheck_target"
    a.id = id
    const rects = a.getClientRects()
    const r = rects[0]
    return JSON.stringify({
      id,
      rectCount: rects.length,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    })
  })()`)
  return result ? JSON.parse(result) : null
}

async function detail(s) {
  const [y, pageHeight, href, route] = await Promise.all([
    scrollY(s),
    s.ev("document.documentElement.scrollHeight"),
    s.ev("location.href"),
    urlPath(s),
  ])
  return `scrollY=${y}, 頁高=${pageHeight}, 路徑=${route}, 網址=${href}`
}

async function clickLink(s, link, { arrow = false, sample = false } = {}) {
  await mouse(s, 2, 2, "move")
  await sleep(600)

  if (sample) {
    await s.ev(`(() => {
      const w = { from: location.pathname + location.hash, started: 0, samples: [], done: false }
      window.__landingWatch = w
      window.__landingWatchTimer = setInterval(() => {
        const current = location.pathname + location.hash
        if (!w.started && current !== w.from) w.started = Date.now()
        if (w.started) {
          w.samples.push({ t: Date.now() - w.started, y: Math.round(window.scrollY) })
          if (Date.now() - w.started >= 2000) {
            w.done = true
            clearInterval(window.__landingWatchTimer)
          }
        }
      }, 100)
    })()`)
  }

  if (arrow) {
    // 先送出點擊，再等 150ms 注入方向鍵，重現可能中斷平滑捲動的輸入。
    const clickTask = mouse(s, link.x, link.y)
    await sleep(150)
    await s.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40,
    })
    await s.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40,
    })
    await clickTask
    await sleep(3000)
    return
  }

  if (link.rectCount === 1) {
    await clickSel(s, `#${link.id}`, { scroll: false })
  } else {
    await mouse(s, link.x, link.y)
  }
}

async function runLandingCase(s, { name, appendix = false, arrow = false, sample = false }) {
  if (!(await loadChapter(s))) {
    console.log(`SKIP  ${name}：找不到章節頁`)
    return
  }

  await scrollNearBottom(s)
  const link = await visibleArticleLink(s, appendix)
  if (!link) {
    console.log(`SKIP  ${name}：底部畫面內找不到合適的站內連結`)
    return
  }

  const before = await urlPath(s)
  await clickLink(s, link, { arrow, sample })

  if (sample) {
    await waitFor(s, "window.__landingWatch?.done === true", 8500)
    const watched = await s.ev(
      "JSON.stringify(window.__landingWatch || { from: '', started: 0, samples: [], done: false })",
    ).then(JSON.parse)
    const after = await urlPath(s)
    const values = watched.samples.map((v) => v.y)
    const maxY = values.length ? Math.max(...values) : null
    const ok =
      after !== before &&
      watched.done &&
      values.length >= 18 &&
      values.every((y) => y < 120)
    const state = await detail(s)
    s.check(
      name,
      ok,
      `${state}, 取樣=${values.length}, 最高scrollY=${maxY}`,
    )
    return
  }

  const after = await urlPath(s)
  const y = await scrollY(s)
  const state = await detail(s)
  s.check(name, after !== before && y < 120, state)
}

async function runHashCase(s) {
  if (!(await loadChapter(s))) {
    console.log("SKIP  有錨點的 SPA 換頁：找不到章節頁")
    return
  }

  const heading = await s.ev(`(() => {
    const h = document.querySelector("article h1[id], article h2[id], article h3[id], article h4[id], article h5[id], article h6[id]")
    return h && h.id ? JSON.stringify({ id: h.id, text: h.textContent.trim() }) : null
  })()`).then((value) => (value ? JSON.parse(value) : null))

  if (!heading) {
    console.log("SKIP  有錨點的 SPA 換頁：章節頁沒有帶 id 的標題")
    return
  }

  const chapterPage = new URL(root + chapter).pathname
  await s.go("/index.html?skip=1", 4500)
  let currentPath = await s.ev("location.pathname")

  if (currentPath === chapterPage) {
    await s.go(chapterPath(2), 4500)
    currentPath = await s.ev("location.pathname")
  }
  if (currentPath === chapterPage) {
    await s.go("/", 4500)
    currentPath = await s.ev("location.pathname")
  }

  const hasRouter = await waitFor(s, 'typeof window.spaNavigate === "function"', 6000)
  const hasArticle = await s.ev("!!document.querySelector('article')")
  if (!hasRouter || !hasArticle || currentPath === chapterPage) {
    console.log("SKIP  有錨點的 SPA 換頁：找不到可用的另一個頁面")
    return
  }

  const targetUrl = new URL(root + chapter + "#" + encodeURIComponent(heading.id))
  await s.ev(`window.spaNavigate(new URL(${JSON.stringify(targetUrl.href)}))`)
  await waitFor(s, `!!document.getElementById(${JSON.stringify(heading.id)})`, 6000)

  const result = await s.ev(`(() => {
    const el = document.getElementById(${JSON.stringify(heading.id)})
    return JSON.stringify({
      top: el ? el.getBoundingClientRect().top : null,
      height: innerHeight,
    })
  })()`).then(JSON.parse)

  const ok = result.top !== null && result.top >= 0 && result.top <= result.height
  const state = await detail(s)
  s.check(
    "有錨點的 SPA 換頁定位",
    ok,
    `${state}, 標題top=${result.top}, 畫面高=${result.height}`,
  )
}

const s = await open({
  root,
  profileRoot,
  shotDir,
  width: 1440,
  height: 900,
  mobile: true,
})

// 先用同一個 CDP 工作階段跑桌機尺寸，再切到手機尺寸。
await s.setViewport(1440, 900, { dpr: 1, mobile: false, touch: false })
await s.send("Emulation.setTouchEmulationEnabled", { enabled: false })

await runLandingCase(s, { name: "桌機：換頁後方向鍵不落底", arrow: true })
await runLandingCase(s, { name: "桌機：換頁後兩秒內不閃到底", sample: true })
await runLandingCase(s, { name: "桌機：附錄地圖換頁後方向鍵不落底", appendix: true, arrow: true })
await runHashCase(s)

await s.setViewport(390, 844, { dpr: 2, mobile: true, touch: true })
await runLandingCase(s, { name: "手機：換頁後方向鍵不落底", arrow: true })
await runLandingCase(s, { name: "手機：附錄地圖換頁後方向鍵不落底", appendix: true, arrow: true })

s.finish()
