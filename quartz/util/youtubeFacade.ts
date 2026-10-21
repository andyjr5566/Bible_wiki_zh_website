import type { Element, ElementContent, Root } from "hast"
import { clone } from "./clone"

type YoutubeEmbed = {
  id: string
  params: string
}

function getYoutubeEmbed(node: ElementContent): YoutubeEmbed | undefined {
  if (node.type !== "element" || node.tagName !== "iframe") return undefined

  const properties = node.properties
  const classes = properties.className
  const isYoutubeClass = Array.isArray(classes) && classes.includes("youtube")
  const src = properties.src
  if (typeof src !== "string") return undefined

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return undefined
  }

  const hostname = url.hostname.toLowerCase()
  const isYoutubeHost =
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com")
  if (!isYoutubeClass && !isYoutubeHost) return undefined

  const match = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]+)\/?$/)
  if (!match) return undefined

  return { id: match[1], params: url.search.slice(1) }
}

function textContent(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  return node.children.map(textContent).join("")
}

function shortText(node: ElementContent | undefined): string | undefined {
  if (!node) return undefined
  if (node.type !== "text" && (node.type !== "element" || node.tagName !== "p")) {
    return undefined
  }

  const text = textContent(node).trim()
  if (!text || /[\r\n]/.test(text) || Array.from(text).length > 80) return undefined
  return text
}

function nextTitle(children: Array<{ type: string }>, afterIndex: number): string | undefined {
  for (let index = afterIndex + 1; index < children.length; index++) {
    const sibling = children[index] as unknown as unknown as ElementContent
    if (sibling.type === "text" && !sibling.value.trim()) continue
    // hard-line-breaks puts the caption line after a <br> in the same paragraph
    if (sibling.type === "element" && sibling.tagName === "br") continue
    return shortText(sibling)
  }
  return undefined
}

function iframeOnlyParagraph(node: ElementContent): Element | undefined {
  if (node.type !== "element" || node.tagName !== "p") return undefined
  const meaningfulChildren = node.children.filter(
    (child) => child.type !== "text" || child.value.trim() !== "",
  )
  if (meaningfulChildren.length !== 1) return undefined
  const child = meaningfulChildren[0]
  return child.type === "element" && getYoutubeEmbed(child) ? child : undefined
}

function makeFacade(embed: YoutubeEmbed, title?: string): Element {
  const accessibleTitle = title ?? "YouTube 影片"
  const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(embed.id)}`
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["yt-facade"],
      "data-yt-id": embed.id,
      "data-yt-params": embed.params,
    },
    children: [
      {
        type: "element",
        tagName: "button",
        properties: {
          type: "button",
          className: ["yt-facade-play"],
          "aria-label": `播放影片：${accessibleTitle}`,
        },
        children: [
          {
            type: "element",
            tagName: "img",
            properties: {
              src: `https://i.ytimg.com/vi/${encodeURIComponent(embed.id)}/hqdefault.jpg`,
              alt: "",
              loading: "lazy",
              decoding: "async",
              width: 480,
              height: 360,
            },
            children: [],
          },
          {
            type: "element",
            tagName: "span",
            properties: {
              className: ["yt-facade-icon"],
              "aria-hidden": "true",
            },
            children: [],
          },
        ],
      },
      {
        type: "element",
        tagName: "a",
        properties: {
          className: ["yt-facade-link"],
          href: videoUrl,
          target: "_blank",
          rel: ["noopener"],
        },
        children: [{ type: "text", value: "在 YouTube 開啟" }],
      },
    ],
  }
}

function containsYoutubeEmbed(node: Root | ElementContent): boolean {
  if (node.type === "element" && getYoutubeEmbed(node)) return true
  if (node.type !== "root" && node.type !== "element") return false
  return (node.children as ElementContent[]).some(containsYoutubeEmbed)
}

/** Return a transformed copy of a HAST tree, replacing YouTube embeds with facades. */
export function transformYoutubeEmbeds(tree: Root): Root {
  // Only a handful of pages embed videos; skip the deep clone for every other page.
  if (!containsYoutubeEmbed(tree)) return tree
  const copiedTree = clone(tree) as Root

  function transformChildren<T extends { type: string }>(children: T[]): T[] {
    const transformed: T[] = []
    for (let index = 0; index < children.length; index++) {
      const child = children[index] as unknown as ElementContent
      const paragraphIframe = iframeOnlyParagraph(child)
      if (paragraphIframe) {
        const embed = getYoutubeEmbed(paragraphIframe)
        if (embed) {
          transformed.push(makeFacade(embed, nextTitle(children, index)) as unknown as T)
          continue
        }
      }

      const embed = getYoutubeEmbed(child)
      if (embed) {
        transformed.push(makeFacade(embed, nextTitle(children, index)) as unknown as T)
      } else if (child.type === "element") {
        const element = child as Element
        transformed.push({ ...element, children: transformChildren(element.children) } as unknown as T)
      } else {
        transformed.push(children[index])
      }
    }
    return transformed
  }

  copiedTree.children = transformChildren(copiedTree.children)
  return copiedTree
}