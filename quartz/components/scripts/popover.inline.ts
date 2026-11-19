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
        const targetAnchor = `#popover-internal-${hash.slice(1)}`
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
      const contents = await response.text()
      const html = p.parseFromString(contents, "text/html")
      normalizeRelativeURLs(html, targetUrl)
      // prepend all IDs inside popovers to prevent duplicates
      html.querySelectorAll("[id]").forEach((el) => {
        const targetID = `popover-internal-${el.id}`
        el.id = targetID
      })
      const elts = [...html.getElementsByClassName("popover-hint")]
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
  const links = [...document.querySelectorAll("a.internal")] as HTMLAnchorElement[]
  for (const link of links) {
    link.addEventListener("mouseenter", mouseEnterHandler)
    link.addEventListener("mouseleave", clearActivePopover)
    window.addCleanup(() => {
      link.removeEventListener("mouseenter", mouseEnterHandler)
      link.removeEventListener("mouseleave", clearActivePopover)
    })
  }
}

document.addEventListener("nav", setupPopovers)
document.addEventListener("render", setupPopovers)
window.addEventListener("resize", () => repositionPopover?.())
