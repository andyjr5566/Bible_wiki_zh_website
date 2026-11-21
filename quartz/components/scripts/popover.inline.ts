import { computePosition, flip, inline, shift, size } from "@floating-ui/dom"
import { normalizeRelativeURLs } from "../../util/path"
import { fetchCanonical } from "./util"

const p = new DOMParser()
let activeAnchor: HTMLAnchorElement | null = null
let repositionPopover: (() => void) | undefined

function movePopover(popover: HTMLElement, x: number, y: number) {
  popover.style.transform = `translate(${x.toFixed()}px, ${y.toFixed()}px)`
}

function addResizeHandle(popover: HTMLElement, inner: HTMLElement) {
  const handle = document.createElement("button")
  handle.type = "button"
  handle.className = "popover-resize"
  handle.title = "拖曳或使用方向鍵調整預覽大小"
  handle.setAttribute("aria-label", handle.title)
  popover.appendChild(handle)

  function startResize() {
    const bounds = popover.getBoundingClientRect()
    const { width, height } = inner.getBoundingClientRect()
    const viewport = document.documentElement
    const left = popover.dataset.resizeX === "left"
    const top = popover.dataset.resizeY === "top"
    const maxWidth = width + (left ? bounds.left : viewport.clientWidth - bounds.right)
    const maxHeight = height + (top ? bounds.top : viewport.clientHeight - bounds.bottom)

    return (dx: number, dy: number) => {
      const nextWidth = Math.min(maxWidth, Math.max(160, width + (left ? -dx : dx)))
      const nextHeight = Math.min(maxHeight, Math.max(96, height + (top ? -dy : dy)))
      popover.style.removeProperty("--popover-available-width")
      popover.style.removeProperty("--popover-available-height")
      inner.style.setProperty("--popover-resized-width", `${nextWidth}px`)
      inner.style.setProperty("--popover-height", `${nextHeight}px`)
      // Keep the opposite corner fixed, including when the handle faces left or up.
      movePopover(
        popover,
        bounds.left + (left ? width - nextWidth : 0),
        bounds.top + (top ? height - nextHeight : 0),
      )
    }
  }

  let drag: { x: number; y: number; resize: ReturnType<typeof startResize> } | undefined
  handle.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    drag = { x: event.clientX, y: event.clientY, resize: startResize() }
    handle.setPointerCapture(event.pointerId)
    popover.classList.add("is-resizing")
  })
  handle.addEventListener("pointermove", (event) => {
    if (!drag || !handle.hasPointerCapture(event.pointerId)) return
    drag.resize(event.clientX - drag.x, event.clientY - drag.y)
  })
  handle.addEventListener("lostpointercapture", () => {
    drag = undefined
    popover.classList.remove("is-resizing")
  })
  handle.addEventListener("keydown", (event) => {
    const step = 24
    const dx = Number(event.key === "ArrowRight") - Number(event.key === "ArrowLeft")
    const dy = Number(event.key === "ArrowDown") - Number(event.key === "ArrowUp")
    if (dx === 0 && dy === 0) return
    event.preventDefault()
    startResize()(step * dx, step * dy)
  })
}

async function readHtmlPreview(response: Response, url: URL, idPrefix: string): Promise<Element[]> {
  const html = p.parseFromString(await response.text(), "text/html")
  normalizeRelativeURLs(html, url)
  for (const element of html.querySelectorAll("[id]")) element.id = idPrefix + element.id
  return Array.from(html.getElementsByClassName("popover-hint"))
}

async function mouseEnterHandler(
  this: HTMLAnchorElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = (activeAnchor = this)
  if (link.dataset.noPopover === "true") {
    return
  }

  async function setPosition(popoverElement: HTMLElement) {
    const resizable = popoverElement.classList.contains("popover-resizable")
    const inlineAnchor = inline({ x: clientX, y: clientY })
    let matchContentWidth = false
    if (resizable) {
      const center = document.querySelector("#quartz-body > .center")
      const content = center?.querySelector(":scope > article") ?? center
      const width = content?.getBoundingClientRect().width ?? 0
      const inner = popoverElement.querySelector<HTMLElement>(".popover-inner")
      if (width > 0) {
        popoverElement.style.setProperty("--popover-default-width", `${width}px`)
        matchContentWidth = !inner?.style.getPropertyValue("--popover-resized-width")
      } else {
        popoverElement.style.removeProperty("--popover-default-width")
      }
    }
    popoverElement.style.removeProperty("--popover-available-width")
    popoverElement.style.removeProperty("--popover-available-height")
    const { x, y } = await computePosition(link, popoverElement, {
      strategy: "fixed",
      middleware: resizable
        ? [
            inlineAnchor,
            // Keep the default width when only a shorter preview fits above or below the link.
            flip({ fallbackAxisSideDirection: matchContentWidth ? "none" : "end" }),
            shift(),
            size({
              apply({ availableWidth, availableHeight }) {
                popoverElement.style.setProperty("--popover-available-width", `${availableWidth}px`)
                popoverElement.style.setProperty(
                  "--popover-available-height",
                  `${availableHeight}px`,
                )
              },
            }),
          ]
        : [inlineAnchor, shift(), flip()],
    })
    movePopover(popoverElement, x, y)

    if (resizable) {
      const viewport = document.documentElement
      popoverElement.dataset.resizeX =
        x + popoverElement.offsetWidth / 2 > viewport.clientWidth / 2 ? "left" : "right"
      popoverElement.dataset.resizeY =
        y + popoverElement.offsetHeight / 2 > viewport.clientHeight / 2 ? "top" : "bottom"
    }
  }

  function showPopover(popoverElement: HTMLElement) {
    clearActivePopover()
    popoverElement.classList.add("active-popover")
    setPosition(popoverElement)
    repositionPopover = () => {
      if (
        popoverElement.isConnected &&
        popoverElement.matches(".active-popover, :hover, :focus-within") &&
        !popoverElement.classList.contains("is-resizing") &&
        link.isConnected
      ) {
        setPosition(popoverElement)
      }
    }

    if (hash !== "") {
      const inner = popoverElement.querySelector(".popover-inner") as HTMLElement | null
      if (inner) {
        const targetAnchor = "#" + CSS.escape("popover-internal-" + hash.slice(1))
        const heading = inner.querySelector(targetAnchor) as HTMLElement | null
        if (heading) {
          // leave ~12px of buffer when scrolling to a heading
          inner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
        }
      }
    }
  }

  const targetUrl = new URL(link.href)
  const hash = decodeURIComponent(targetUrl.hash)
  targetUrl.hash = ""
  targetUrl.search = ""
  const popoverId = `popover-${link.pathname}`
  const prevPopoverElement = document.getElementById(popoverId)

  // dont refetch if there's already a popover
  if (!!document.getElementById(popoverId)) {
    showPopover(prevPopoverElement as HTMLElement)
    return
  }

  const response = await fetchCanonical(targetUrl).catch((err) => {
    console.error(err)
  })

  if (!response) return
  const rawContentType = response.headers.get("Content-Type")
  if (!rawContentType) return
  const [contentType] = rawContentType.split(";")
  const [contentTypeCategory, typeInfo] = contentType.split("/")

  const popoverElement = document.createElement("div")
  popoverElement.id = popoverId
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverInner.dataset.contentType = contentType ?? undefined
  popoverElement.appendChild(popoverInner)

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname

      popoverInner.appendChild(img)
      break
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe")
          pdf.src = targetUrl.toString()
          popoverInner.appendChild(pdf)
          break
        default:
          break
      }
      break
    default:
      const elts = await readHtmlPreview(response, targetUrl, "popover-internal-")
      if (elts.length === 0) return

      elts.forEach((elt) => popoverInner.appendChild(elt))
      popoverElement.classList.add("popover-resizable")
      addResizeHandle(popoverElement, popoverInner)
  }

  if (!!document.getElementById(popoverId)) {
    return
  }

  document.body.appendChild(popoverElement)
  if (activeAnchor !== this) {
    return
  }

  showPopover(popoverElement)
}

function clearActivePopover() {
  activeAnchor = null
  const allPopoverElements = document.querySelectorAll(".popover")
  allPopoverElements.forEach((popoverElement) => popoverElement.classList.remove("active-popover"))
}

function setupPopovers() {
  clearActivePopover()
  const links = [...document.querySelectorAll("a.internal")] as HTMLAnchorElement[]
  for (const link of links) {
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") void mouseEnterHandler.call(link, event)
    }
    const leave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") clearActivePopover()
    }
    link.addEventListener("pointerenter", enter)
    link.addEventListener("pointerleave", leave)
    window.addCleanup(() => {
      link.removeEventListener("pointerenter", enter)
      link.removeEventListener("pointerleave", leave)
    })
  }
}

function readingEntryLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  const link = target.closest<HTMLAnchorElement>(
    '#quartz-body > .center article a.internal[data-slug^="link_folder/"]:not(.broken)',
  )
  if (!link || link.dataset.noPopover === "true" || link.hasAttribute("download")) return null
  if (link.target && link.target !== "_self") return null
  const url = new URL(link.href)
  return url.origin === location.origin && url.pathname !== location.pathname ? link : null
}

function setupTouchPreview() {
  if (typeof HTMLDialogElement === "undefined" || !HTMLDialogElement.prototype.showModal) return

  const dialog = document.createElement("dialog")
  dialog.className = "bwz-touch-preview"
  dialog.setAttribute("aria-labelledby", "bwz-touch-preview-title")
  dialog.innerHTML = `
    <header>
      <h2 id="bwz-touch-preview-title"></h2>
      <form method="dialog"><button type="submit" aria-label="關閉預覽" autofocus>×</button></form>
    </header>
    <div class="bwz-touch-preview-body">
      <p role="status"></p>
      <div class="bwz-touch-preview-content"></div>
    </div>
    <footer><a>前往條目</a></footer>
  `
  const title = dialog.querySelector("h2")!
  const body = dialog.querySelector<HTMLElement>(".bwz-touch-preview-body")!
  const status = body.querySelector<HTMLElement>("[role=status]")!
  const content = body.querySelector<HTMLElement>(".bwz-touch-preview-content")!
  const openLink = dialog.querySelector<HTMLAnchorElement>("footer a")!
  let source: HTMLAnchorElement | null = null
  let touchTarget: HTMLAnchorElement | null = null
  let requestId = 0

  async function preview(link: HTMLAnchorElement) {
    if (!dialog.isConnected) document.body.append(dialog)
    const id = ++requestId
    source = link
    openLink.href = link.href
    title.textContent = link.textContent?.trim() || "條目預覽"
    content.replaceChildren()
    body.scrollTop = 0
    status.textContent = "載入預覽中…"
    dialog.showModal()
    clearActivePopover()
    const url = new URL(link.href)
    let sections: Element[] = []
    try {
      const response = await fetchCanonical(url)
      if (response.ok && response.headers.get("Content-Type")?.startsWith("text/html")) {
        sections = await readHtmlPreview(response, url, "touch-preview-internal-")
      }
    } catch {
      // The original link remains available when a preview cannot load.
    }
    if (id !== requestId || !dialog.open) return
    if (sections.length === 0) {
      status.textContent = "無法載入預覽，可以直接前往條目。"
      return
    }
    status.textContent = ""
    content.append(...sections)
    const heading = content.querySelector<HTMLElement>(".markdown-preview-view > h1")
    const headingText = heading?.textContent?.trim()
    if (heading && headingText) {
      title.textContent = headingText
      heading.hidden = true
    }
    if (url.hash) {
      try {
        const target = content.querySelector(
          "#" + CSS.escape("touch-preview-internal-" + decodeURIComponent(url.hash.slice(1))),
        )
        if (target) {
          body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top
        }
      } catch {
        // A malformed fragment can still show the preview from its start.
      }
    }
  }

  function plainClick(event: MouseEvent) {
    return (
      event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
    )
  }

  function touchPointer(type: string) {
    return type === "touch" || type === "pen"
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      touchTarget = touchPointer(event.pointerType) ? readingEntryLink(event.target) : null
    },
    true,
  )
  document.addEventListener(
    "pointercancel",
    () => {
      touchTarget = null
    },
    true,
  )
  document.addEventListener(
    "click",
    (event) => {
      const link = readingEntryLink(event.target)
      const tapped =
        touchPointer((event as PointerEvent).pointerType) ||
        (event.detail > 0 && touchTarget === link)
      touchTarget = null
      if (!link || !tapped || !plainClick(event) || event.defaultPrevented || dialog.open) return
      event.preventDefault()
      // Prevent Quartz navigation and defer recording the source verse until the user opens it.
      event.stopImmediatePropagation()
      void preview(link)
    },
    true,
  )

  openLink.addEventListener("click", (event) => {
    const link = source
    if (!plainClick(event) || !link?.isConnected) return
    event.preventDefault()
    event.stopPropagation()
    dialog.close()
    // Use the original link so the existing return-to-verse handler sees the source.
    link.click()
  })
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (
      event.clientY < rect.top ||
      event.clientY > rect.bottom ||
      event.clientX < rect.left ||
      event.clientX > rect.right
    )
      dialog.close()
  })
  dialog.addEventListener("close", () => {
    if (dialog.open) return
    requestId++
    content.replaceChildren()
    source = null
  })
  document.addEventListener("nav", () => {
    touchTarget = null
    if (dialog.open) dialog.close()
    if (!dialog.isConnected) return
    dialog.remove()
  })
}

setupTouchPreview()
document.addEventListener("nav", setupPopovers)
document.addEventListener("render", setupPopovers)
window.addEventListener("resize", () => repositionPopover?.())
