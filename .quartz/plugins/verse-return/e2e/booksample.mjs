// 第 7 批抽樣：用「完整內容」建的站，6 卷各抽首、中、末章，檢查純經文與「↩ 返回」在真實章節上都正常。
// 用法：node plugins/verse-return/e2e/booksample.mjs <root> <profileRoot> <shotDir>
import { mkdirSync } from "node:fs"
import { open, clickSel, centerOf, mouse, storedPoint, scrollY, urlPath } from "./helpers.mjs"

const [rootArg, profileRoot, shotDir] = process.argv.slice(2)

if (!rootArg || !profileRoot || !shotDir) {
  throw new Error(
    "用法：node plugins/verse-return/e2e/booksample.mjs <root> <profileRoot> <shotDir>",
  )
}

const root = rootArg.replace(/\/+$/, "")
const books = [
  { folder: "01-創世記", name: "創世記", chapters: 50 },
  { folder: "02-出埃及記", name: "出埃及記", chapters: 40 },
  { folder: "03-利未記", name: "利未記", chapters: 27 },
  { folder: "04-民數記", name: "民數記", chapters: 36 },
  { folder: "05-申命記", name: "申命記", chapters: 34 },
  { folder: "06-約書亞記", name: "約書亞記", chapters: 24 },
]

const DESKTOP = { width: 1440, height: 900, mobile: false }
const MOBILE = { width: 390, height: 844, mobile: true }
const LIST_SELECTOR = '[data-booksample-list="true"]'
const AA_SELECTOR = '[data-booksample-aa="true"]'
const PURE_SELECTOR = '#site-ux-panel [data-name="view"][data-value="pure"]'
const STUDY_SELECTOR = '#site-ux-panel [data-name="view"][data-value="study"]'
const GO_SELECTOR = ".bwz-vr-go"

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function chapterLabel(chapter) {
  return `[${chapter.book.name} ${chapter.number}]`
}

// 相對於 root 的路徑（s.go 會自己接上 root）
function chapterPath(chapter) {
  return "/" + encodeURI(`${chapter.book.folder}/第${chapter.number}章`)
}

// urlPath() 回傳的是解碼後的 pathname，比對前原章路徑也要解碼
function chapterPathname(chapter) {
  return decodeURIComponent(new URL(root + chapterPath(chapter)).pathname)
}

// lib.mjs 的 s.errors 只記例外的 description，丟出來的是一般物件時只剩 "Object"；這裡另記預覽文字才分得出來源
const exceptionTexts = []

async function launchBrowser() {
  mkdirSync(shotDir, { recursive: true })
  // open() 會先關掉首訪導覽與「加入主畫面」提示，並設成淺色
  const s = await open({ root, profileRoot, shotDir, width: DESKTOP.width, height: DESKTOP.height })
  s.on("Runtime.exceptionThrown", (m) => {
    const d = m.params.exceptionDetails
    const preview = (d.exception?.preview?.properties ?? []).map((p) => p.value).join(" ")
    exceptionTexts.push(`${d.exception?.description ?? d.text} ${preview}`.trim())
  })
  return s
}

async function setViewport(s, viewport) {
  await s.setViewport(viewport.width, viewport.height, {
    dpr: viewport.mobile ? 2 : 1,
    mobile: viewport.mobile,
    touch: viewport.mobile,
  })
}

async function check(s, name, pass, detail = "") {
  await s.check(name, Boolean(pass), detail)
}

// helpers 的 waitFor 只吃頁面裡的運算式；這裡要等 Node 端的條件（會呼叫多次 s.ev），所以自己輪詢
async function waitForCondition(s, predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return true
    } catch {
      // 換頁途中執行環境會被換掉，下一輪再試
    }
    await delay(150)
  }
  return false
}

async function clearSessionStorage(s) {
  // 每次整頁導覽前清掉暫存回跳點，避免上一章污染。
  try {
    await s.ev("(() => { try { sessionStorage.clear(); return true; } catch { return false; } })()")
  } catch {
    // about:blank 沒有可用的儲存空間時也繼續整頁導覽。
  }
}

async function setLightTheme(s) {
  try {
    await s.ev(`(() => {
      try { localStorage.setItem("theme", "light"); } catch {}
      document.documentElement.setAttribute("saved-theme", "light");
      document.documentElement.style.colorScheme = "light";
      return true;
    })()`)
  } catch {
    // 測試頁若尚未完成初始化，後續 DOM 等待仍會繼續。
  }
}

// 經文裡的連結常常折成兩行，外框中心會落在兩行之間的空白（點到 li 而不是連結），所以點第一行的中心
async function clickFirstLine(s, selector) {
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 })
  await delay(600)
  const point = await s.ev(`(() => {
    const a = document.querySelector(${JSON.stringify(selector)});
    if (!a) return null;
    a.scrollIntoView({ block: "center", behavior: "instant" });
    const r = a.getClientRects()[0];
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`)
  if (!point) return { ok: false, detail: "找不到連結" }
  await mouse(s, point.x, point.y)
  return { ok: true, point }
}

async function clickSelector(s, selector) {
  try {
    // 上一次點擊後滑鼠還停在原處；換頁後那裡常是別的連結，懸停預覽會跳出來蓋住要點的元素。先把滑鼠移到角落等預覽收起
    await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 })
    await delay(600)
    const point = await centerOf(s, selector)
    if (point == null) {
      return { ok: false, detail: "找不到可點擊元素中心" }
    }
    await clickSel(s, selector)
    return { ok: true, point }
  } catch (error) {
    return { ok: false, detail: String(error) }
  }
}

const FIND_LIST_EXPRESSION = `(() => {
  const article =
    document.querySelector("article.popover-hint") ||
    document.querySelector("main article") ||
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;
  const firstHr = article.querySelector("hr");
  const lists = [...article.querySelectorAll("ol")];
  const list = lists.find((ol) =>
    !firstHr ||
    (ol.compareDocumentPosition(firstHr) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  if (!list) return { found: false, liCount: 0, path: location.pathname };
  list.setAttribute("data-booksample-list", "true");
  const lis = [...list.children].filter((child) => child.tagName === "LI");
  return {
    found: true,
    liCount: lis.length,
    path: location.pathname,
    firstHrFound: Boolean(firstHr),
  };
})()`

const SECTION_SNAPSHOT_EXPRESSION = `(() => {
  const matches = [...document.querySelectorAll("h2, details")].filter((node) => {
    const title = node.tagName === "DETAILS"
      ? (node.querySelector(":scope > summary")?.textContent || "")
      : (node.textContent || "");
    return /本章知識節點|本章整理|附錄/.test(title);
  });
  const labels = matches.map((node) =>
    (node.tagName === "DETAILS"
      ? (node.querySelector(":scope > summary")?.textContent || "")
      : (node.textContent || "")
    ).replace(/\\s+/g, " ").trim().slice(0, 100)
  );
  const regions = matches.map((node) => node.closest(".bwz-ux-hide"));
  const classed = [...document.querySelectorAll(".bwz-ux-hide")];
  const hiddenClassed = classed.filter(
    (node) => getComputedStyle(node).display === "none"
  );
  const unmarked = matches
    .filter((node) => !node.closest(".bwz-ux-hide"))
    .map((node) =>
      (node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100)
    );
  const visibleTargets = [...new Set(regions.filter(Boolean))]
    .filter((node) => getComputedStyle(node).display !== "none")
    .map((node) =>
      (node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100)
    );
  return {
    view: document.documentElement.getAttribute("data-ux-view") || "study", // 研讀模式不在 <html> 留屬性
    targetCount: matches.length,
    labels,
    hideClassCount: classed.length,
    hiddenClassCount: hiddenClassed.length,
    unmarked,
    visibleTargets,
    allClassedHidden: classed.every(
      (node) => getComputedStyle(node).display === "none"
    ),
  };
})()`

const PURE_LAYOUT_EXPRESSION = `(() => {
  const visible = (node) => {
    if (!node) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0;
  };
  const list = document.querySelector(${JSON.stringify(LIST_SELECTOR)});
  const nav = [...document.querySelectorAll(".table-container")]
    .filter((node) => /前一章|下一章/.test(node.innerText || ""));
  const htmlWidth = document.documentElement.scrollWidth;
  const bodyWidth = document.body?.scrollWidth || 0;
  return {
    listFound: Boolean(list),
    listVisible: visible(list),
    navCount: nav.length,
    navVisibleCount: nav.filter(visible).length,
    htmlWidth,
    bodyWidth,
    innerWidth: window.innerWidth,
    noHorizontalScroll: Math.max(htmlWidth, bodyWidth) <= window.innerWidth,
  };
})()`

async function openAppearancePanel(s) {
  try {
    const alreadyOpen = await s.ev(`(() => {
      const panel = document.querySelector("#site-ux-panel");
      if (!panel) return false;
      const style = getComputedStyle(panel);
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        panel.getBoundingClientRect().width > 0 &&
        panel.getBoundingClientRect().height > 0;
    })()`)
    if (alreadyOpen) return true

    const tagged = await s.ev(`(() => {
      const visible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      // 桌機與手機各有一顆 Aa 按鈕（另一顆被版面藏起來），點看得到的那顆
      const trigger = [...document.querySelectorAll(".site-ux-btn")].find(visible);
      if (!trigger) return false;
      trigger.setAttribute("data-booksample-aa", "true");
      return true;
    })()`)

    if (!tagged) return false

    const clicked = await clickSelector(s, AA_SELECTOR)
    if (!clicked.ok) return false

    return waitForCondition(
      s,
      async () =>
        Boolean(
          await s.ev(`(() => {
            const panel = document.querySelector("#site-ux-panel");
            if (!panel) return false;
            const style = getComputedStyle(panel);
            return style.display !== "none" &&
              style.visibility !== "hidden" &&
              panel.getBoundingClientRect().width > 0 &&
              panel.getBoundingClientRect().height > 0;
          })()`),
        ),
      5000,
    )
  } catch {
    return false
  }
}

async function chooseView(s, value) {
  const opened = await openAppearancePanel(s)
  if (!opened) return false

  const selector = value === "pure" ? PURE_SELECTOR : STUDY_SELECTOR
  const clicked = await clickSelector(s, selector)
  if (!clicked.ok) return false

  return waitForCondition(
    s,
    async () =>
      (await s.ev(
        `(document.documentElement.getAttribute("data-ux-view") || "study") === ${JSON.stringify(value)}`,
      )) === true,
    5000,
  )
}

async function getListState(s) {
  try {
    return await s.ev(FIND_LIST_EXPRESSION)
  } catch {
    return { found: false, liCount: 0, path: "" }
  }
}

async function getSectionState(s) {
  try {
    return await s.ev(SECTION_SNAPSHOT_EXPRESSION)
  } catch {
    return null
  }
}

async function getPureLayout(s) {
  try {
    return await s.ev(PURE_LAYOUT_EXPRESSION)
  } catch {
    return null
  }
}

async function reportListCheck(s, chapter, listState) {
  const pass = Boolean(listState?.found) && listState.liCount >= 1 && listState.liCount <= 200
  await check(
    s,
    `${chapterLabel(chapter)} 經文清單：有 1～200 節`,
    pass,
    `found=${Boolean(listState?.found)} li=${listState?.liCount ?? 0} path=${listState?.path ?? ""}`,
  )
}

async function reportAppearanceChecks(s, chapter) {
  const label = chapterLabel(chapter)
  const panelOpen = await openAppearancePanel(s)
  const panelState = await s.ev(`(() => {
    const panel = document.querySelector("#site-ux-panel");
    if (!panel) return { found: false, visible: false, readingMode: false, pure: false, study: false };
    const text = panel.innerText || panel.textContent || "";
    const visible = getComputedStyle(panel).display !== "none" &&
      getComputedStyle(panel).visibility !== "hidden";
    return {
      found: true,
      visible,
      readingMode: text.includes("閱讀模式"),
      pure: Boolean(panel.querySelector('[data-name="view"][data-value="pure"]')),
      study: Boolean(panel.querySelector('[data-name="view"][data-value="study"]')),
      text: text.replace(/\\s+/g, " ").trim().slice(0, 240),
    };
  })()`)
  const groupOk =
    panelOpen &&
    Boolean(panelState?.found) &&
    Boolean(panelState?.visible) &&
    Boolean(panelState?.readingMode) &&
    Boolean(panelState?.pure) &&
    Boolean(panelState?.study)
  await check(
    s,
    `${label} Aa 面板：有「閱讀模式」與純經文／研讀選項`,
    groupOk,
    `panelOpen=${panelOpen} state=${JSON.stringify(panelState)}`,
  )

  const studyChosen = await chooseView(s, "study")
  const studyState = await getSectionState(s)
  const studyOk = studyChosen && studyState?.view === "study" && studyState.hiddenClassCount === 0
  await check(
    s,
    `${label} 研讀模式：${studyState?.targetCount ?? 0} 個區塊沒有被隱藏`,
    studyOk,
    `選取成功=${studyChosen} view=${studyState?.view ?? "null"} 要藏區塊=${studyState?.targetCount ?? 0} display:none=${studyState?.hiddenClassCount ?? 0} 標題=${JSON.stringify(studyState?.labels ?? [])}`,
  )

  const pureChosen = await chooseView(s, "pure")
  const pureState = await getSectionState(s)
  await check(
    s,
    `${label} 純經文：html data-ux-view 為 pure`,
    pureChosen && pureState?.view === "pure",
    `選取成功=${pureChosen} view=${pureState?.view ?? "null"}`,
  )

  const expectedCount = studyState?.targetCount ?? 0
  const hiddenOk =
    pureChosen &&
    pureState?.view === "pure" &&
    pureState?.targetCount === expectedCount &&
    (pureState?.unmarked?.length ?? 0) === 0 &&
    (pureState?.visibleTargets?.length ?? 0) === 0 &&
    pureState?.allClassedHidden === true
  await check(
    s,
    `${label} 純經文：要藏的 ${expectedCount} 個區塊都藏起來`,
    hiddenOk,
    `預期區塊=${expectedCount} 實際區塊=${pureState?.targetCount ?? 0} 未加 bwz-ux-hide=${JSON.stringify(pureState?.unmarked ?? [])} 仍可見=${JSON.stringify(pureState?.visibleTargets ?? [])} class 數=${pureState?.hideClassCount ?? 0} display:none 數=${pureState?.hiddenClassCount ?? 0} 標題=${JSON.stringify(pureState?.labels ?? [])}`,
  )

  const layout = await getPureLayout(s)
  await check(
    s,
    `${label} 純經文：經文清單看得到`,
    Boolean(layout?.listFound) && Boolean(layout?.listVisible),
    `listFound=${Boolean(layout?.listFound)} visible=${Boolean(layout?.listVisible)}`,
  )
  await check(
    s,
    `${label} 純經文：前後章導覽表格看得到`,
    Boolean(layout?.navCount) && layout.navVisibleCount === layout.navCount,
    `符合表格=${layout?.navCount ?? 0} 可見=${layout?.navVisibleCount ?? 0}`,
  )
  await check(
    s,
    `${label} 純經文：沒有橫向捲動`,
    layout?.noHorizontalScroll === true,
    `html.scrollWidth=${layout?.htmlWidth ?? "?"} body.scrollWidth=${layout?.bodyWidth ?? "?"} innerWidth=${layout?.innerWidth ?? "?"}`,
  )

  const studyRestored = await chooseView(s, "study")
  const restored = await getSectionState(s)
  const restoredOk =
    studyRestored &&
    restored?.view === "study" &&
    restored.hiddenClassCount === 0 &&
    restored.targetCount === expectedCount
  await check(
    s,
    `${label} 研讀模式：切回後區塊全部恢復`,
    restoredOk,
    `選取成功=${studyRestored} view=${restored?.view ?? "null"} 預期區塊=${expectedCount} 實際區塊=${restored?.targetCount ?? 0} display:none=${restored?.hiddenClassCount ?? 0}`,
  )

  // 關掉 Aa 面板，免得它蓋住接下來要點的經文連結
  for (const type of ["keyDown", "keyUp"]) {
    await s.send("Input.dispatchKeyEvent", {
      type,
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    })
  }
  await delay(300)

  return { listState: await getListState(s), targetCount: expectedCount }
}

async function findReturnLink(s) {
  try {
    return await s.ev(`(() => {
      const list = document.querySelector(${JSON.stringify(LIST_SELECTOR)});
      if (!list) return null;
      const lis = [...list.children].filter((child) => child.tagName === "LI");
      const candidates = [];
      lis.forEach((li, liIndex) => {
        for (const anchor of li.querySelectorAll("a.internal")) {
          const href = anchor.getAttribute("href") || "";
          if (!href || href.includes("#")) continue;
          let target;
          try { target = new URL(href, location.href); } catch { continue; }
          if (target.origin !== location.origin) continue;
          if (target.pathname === location.pathname) continue;
          candidates.push({ li, liIndex, anchor, href, target });
        }
      });
      // 第三節之後優先，讓回跳置中的位置更容易檢查。
      const chosen = candidates.find((item) => item.liIndex >= 2) || candidates[0];
      if (!chosen) return null;
      chosen.anchor.setAttribute("data-booksample-return-link", "true");
      chosen.anchor.scrollIntoView({ block: "center", inline: "center" });
      return {
        href: chosen.href,
        path: chosen.target.pathname,
        verseIndex: chosen.liIndex,
        verseId: chosen.li.id || "",
        text: (chosen.anchor.innerText || chosen.anchor.textContent || "").trim().slice(0, 100),
      };
    })()`)
  } catch {
    return null
  }
}

function visibleButtonExpression(selector, requireViewport) {
  return `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return { found: false, visible: false, inViewport: false };
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const visible = style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0;
    const inViewport = rect.bottom > 0 && rect.top < window.innerHeight &&
      rect.right > 0 && rect.left < window.innerWidth;
    return {
      found: true,
      visible: visible && ${requireViewport ? "inViewport" : "true"},
      inViewport,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      text: (node.innerText || node.textContent || "").trim().slice(0, 100),
    };
  })()`
}

async function waitForStableScroll(s, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs
  let previous
  let stableSamples = 0

  try {
    previous = await scrollY(s)
  } catch {
    previous = null
  }

  while (Date.now() < deadline) {
    await delay(120)
    let current
    try {
      current = await scrollY(s)
    } catch {
      current = null
    }

    if (
      typeof current === "number" &&
      typeof previous === "number" &&
      Math.abs(current - previous) <= 1
    ) {
      stableSamples += 1
      if (stableSamples >= 3) {
        return { stable: true, scrollY: current }
      }
    } else {
      stableSamples = 0
    }
    previous = current
  }

  return { stable: false, scrollY: previous }
}

async function returnedVerseState(s, verseId, verseIndex) {
  const expression = `(() => {
    const article =
      document.querySelector("article.popover-hint") ||
      document.querySelector("main article") ||
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.body;
    const firstHr = article.querySelector("hr");
    const lists = [...article.querySelectorAll("ol")];
    const list = lists.find((ol) =>
      !firstHr ||
      (ol.compareDocumentPosition(firstHr) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    if (!list) return { found: false, innerHeight: window.innerHeight };
    const lis = [...list.children].filter((child) => child.tagName === "LI");
    let target = ${JSON.stringify(verseId)}
      ? document.getElementById(${JSON.stringify(verseId)})
      : null;
    if (!target || !list.contains(target)) target = lis[${verseIndex}] || null;
    if (!target) return { found: false, liCount: lis.length, innerHeight: window.innerHeight };
    const rect = target.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    return {
      found: true,
      id: target.id || "",
      index: lis.indexOf(target),
      centerY,
      innerHeight: window.innerHeight,
      distance: Math.abs(centerY - window.innerHeight / 2),
      tolerance: window.innerHeight * 0.25,
      top: rect.top,
      height: rect.height,
      liCount: lis.length,
    };
  })()`
  try {
    return await s.ev(expression)
  } catch {
    return null
  }
}

async function runVerseReturn(s, chapter) {
  const label = chapterLabel(chapter)
  const originalPath = chapterPathname(chapter)
  const link = await findReturnLink(s)

  if (!link) {
    console.log(`${label} 回到經節：SKIP（經文清單沒有指向別頁且不含 # 的 a.internal）`)
    return
  }

  const linkSelector = '[data-booksample-return-link="true"]'
  const linkCenter = await centerOf(s, linkSelector)
  const clickedLink = await clickFirstLine(s, linkSelector)
  const changedPage = clickedLink.ok
    ? await waitForCondition(s, async () => (await urlPath(s)) !== originalPath, 10000)
    : false
  const itemPath = (await urlPath(s).catch?.(() => "")) ?? ""

  await check(
    s,
    `${label} 回到經節：點經文連結換到條目頁`,
    clickedLink.ok && Boolean(linkCenter) && changedPage,
    `href=${link.href} 目標=${link.path} 原章=${originalPath} 目前=${itemPath} 節次序號=${link.verseIndex + 1} verseId=${link.verseId || "(無)"}`,
  )

  let point = null
  let pointReady = false
  try {
    pointReady = await waitForCondition(
      s,
      async () => {
        point = await storedPoint(s)
        return point !== null && point !== undefined && point !== ""
      },
      6000,
    )
    if (pointReady && point == null) point = await storedPoint(s)
  } catch {
    pointReady = false
  }

  await check(
    s,
    `${label} 回到經節：sessionStorage 有回跳點`,
    pointReady,
    `bwz-return-point=${JSON.stringify(point)}`,
  )

  const goExists = await waitForCondition(
    s,
    async () =>
      Boolean(await s.ev(`Boolean(document.querySelector(${JSON.stringify(GO_SELECTOR)}))`)),
    7000,
  )
  if (goExists) {
    try {
      await s.ev(`(() => {
        const button = document.querySelector(${JSON.stringify(GO_SELECTOR)});
        button?.scrollIntoView({ block: "center", inline: "center" });
        return Boolean(button);
      })()`)
    } catch {
      // 按鈕存在與否仍由後續檢查記錄。
    }
  }
  const buttonState =
    (await s.ev(visibleButtonExpression(GO_SELECTOR, true)).catch?.(() => null)) ?? null
  const buttonVisible = Boolean(buttonState?.found && buttonState?.visible)

  await check(
    s,
    `${label} 回到經節：條目頁 .bwz-vr-go 出現且看得到`,
    goExists && buttonVisible,
    `存在=${goExists} 狀態=${JSON.stringify(buttonState)}`,
  )

  let backPath = ""
  let centered = null
  let scrollSettled = { stable: false, scrollY: null }
  let clickedBack = false

  if (buttonVisible) {
    // 既有問題（正式站也有，不是這批造成的）：換頁時滑鼠停著，新頁同位置的連結觸發的懸停預覽不會自己收起，
    // 可能蓋住按鈕。讀者移動滑鼠時預覽會換掉或收起；這裡直接收掉，只檢查按鈕本身
    const stuckPopover = await s.ev(
      `(() => { const p = [...document.querySelectorAll(".popover.active-popover")]; p.forEach((e) => e.classList.remove("active-popover")); return p.length })()`,
    )
    if (stuckPopover)
      console.log(`NOTE  ${label} 收掉 ${stuckPopover} 個卡住的懸停預覽（既有問題）`)
    const buttonCenter = await centerOf(s, GO_SELECTOR)
    const result = await clickSelector(s, GO_SELECTOR)
    clickedBack = result.ok && Boolean(buttonCenter)
    const returned = clickedBack
      ? await waitForCondition(s, async () => (await urlPath(s)) === originalPath, 10000)
      : false
    backPath = (await urlPath(s).catch?.(() => "")) ?? ""

    if (returned) {
      scrollSettled = await waitForStableScroll(s, 4000)
      centered = await returnedVerseState(s, link.verseId, link.verseIndex)
    }

    await check(
      s,
      `${label} 回到經節：按鈕回原章且第 ${link.verseIndex + 1} 節在畫面中間附近`,
      returned && centered?.found === true && centered.distance <= centered.tolerance,
      `按鈕點擊=${clickedBack} 回原章=${returned} pathname=${backPath} 捲動穩定=${scrollSettled.stable} scrollY=${scrollSettled.scrollY} 經節=${JSON.stringify(centered)}`,
    )
  } else {
    await check(
      s,
      `${label} 回到經節：按鈕回原章且第 ${link.verseIndex + 1} 節在畫面中間附近`,
      false,
      "沒有可見的 .bwz-vr-go 按鈕，無法檢查回跳位置",
    )
  }
}

function errorText(error) {
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

async function reportJavascriptErrors(s, chapter, errorStart) {
  const errors = exceptionTexts.slice(errorStart)
  // 內容裡的 Mermaid 圖語法錯誤（例如創世記 50、民數記 36 的時間軸）是內容問題，不是這批程式；印出來但不算失敗
  const content = errors.filter((text) => /Parse error on line/.test(text))
  for (const text of content)
    console.log(`NOTE  ${chapterLabel(chapter)} 內容的 Mermaid 圖解析失敗：${text.slice(0, 160)}`)
  const relevant = errors.filter((error) => {
    const text = errorText(error)
    if (/Parse error on line/.test(text)) return false
    return !(/SecurityError/i.test(text) && /(?:sessionStorage|localStorage)/i.test(text))
  })
  await check(
    s,
    `${chapterLabel(chapter)} JS 例外：沒有未忽略的例外`,
    relevant.length === 0,
    `例外數=${relevant.length} 明細=${JSON.stringify(relevant.map(errorText))}`,
  )
}

async function runChapter(s, chapter, viewport, mobileOnly = false) {
  const errorStart = exceptionTexts.length
  await clearSessionStorage(s)
  await setViewport(s, viewport)
  await s.go(chapterPath(chapter))
  await waitForCondition(
    s,
    async () =>
      Boolean(
        await s.ev('document.readyState === "complete" && document.querySelector("article, main")'),
      ),
    12000,
  )
  await setLightTheme(s)

  const initialList = await getListState(s)
  await reportListCheck(s, chapter, initialList)

  await reportAppearanceChecks(s, chapter)

  await runVerseReturn(s, chapter)
  await reportJavascriptErrors(s, chapter, errorStart)
}

async function main() {
  const s = await launchBrowser()

  try {
    for (const book of books) {
      const middle = Math.ceil(book.chapters / 2)
      for (const number of [1, middle, book.chapters]) {
        await runChapter(s, { book, number }, DESKTOP)
      }
    }

    // 手機另抽首尾章，檢查窄版純經文排版與回跳置中。
    await runChapter(s, { book: books[0], number: 1 }, MOBILE, true)
    await runChapter(s, { book: books[5], number: books[5].chapters }, MOBILE, true)
  } finally {
    await s.finish()
  }
}

await main()
