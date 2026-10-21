import assert from "node:assert/strict"
import test from "node:test"
import type { Element, Root } from "hast"
import { transformYoutubeEmbeds } from "./youtubeFacade"

const videoId = "abcDEF_1234"

function iframe(src: string, className: string[] = ["external-embed", "youtube"]): Element {
  return {
    type: "element",
    tagName: "iframe",
    properties: { className, src },
    children: [],
  }
}

function paragraph(...children: Element["children"]): Element {
  return { type: "element", tagName: "p", properties: {}, children }
}

function facades(tree: Root): Element[] {
  return tree.children.filter(
    (node): node is Element =>
      node.type === "element" &&
      node.tagName === "div" &&
      Array.isArray(node.properties.className) &&
      node.properties.className.includes("yt-facade"),
  )
}

function playButton(facade: Element): Element {
  const button = facade.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "button",
  )
  assert.ok(button)
  return button
}

test("replaces a YouTube iframe with a facade and thumbnail", () => {
  const input: Root = {
    type: "root",
    children: [iframe(`https://www.youtube.com/embed/${videoId}`)],
  }
  const output = transformYoutubeEmbeds(input)
  const [facade] = facades(output)

  assert.ok(facade)
  assert.equal(facade.properties["data-yt-id"], videoId)
  const button = playButton(facade)
  const thumbnail = button.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "img",
  )
  assert.equal(thumbnail?.properties.src, `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)
  assert.equal(input.children[0].type, "element")
  assert.equal((input.children[0] as Element).tagName, "iframe")
})

test("retains the embed query string for playback", () => {
  const input: Root = {
    type: "root",
    children: [iframe(`https://www.youtube.com/embed/${videoId}?start=30&list=PL123`)],
  }
  const [facade] = facades(transformYoutubeEmbeds(input))

  assert.equal(facade.properties["data-yt-params"], "start=30&list=PL123")
})

test("recognizes youtube-nocookie embed URLs", () => {
  const input: Root = {
    type: "root",
    children: [iframe(`https://www.youtube-nocookie.com/embed/${videoId}`, [])],
  }

  assert.equal(facades(transformYoutubeEmbeds(input)).length, 1)
})

test("leaves non-YouTube iframes unchanged", () => {
  const input: Root = {
    type: "root",
    children: [iframe("https://player.vimeo.com/video/123", ["external-embed"])],
  }

  assert.deepEqual(transformYoutubeEmbeds(input), input)
})

test("uses the following short paragraph as the accessible title", () => {
  const title = "大衛鮑森舊約縱覽 - 創世記(一) 聖經的基礎（40:03）"
  const input: Root = {
    type: "root",
    children: [
      paragraph(iframe(`https://www.youtube.com/embed/${videoId}`)),
      paragraph({ type: "text", value: title }),
    ],
  }
  const output = transformYoutubeEmbeds(input)
  const [facade] = facades(output)

  assert.equal(playButton(facade).properties["aria-label"], `播放影片：${title}`)
  assert.equal(output.children.length, 2)
  assert.equal((output.children[1] as Element).children[0].type, "text")
})

test("uses a default accessible title when no short caption follows", () => {
  const input: Root = {
    type: "root",
    children: [iframe(`https://www.youtube.com/embed/${videoId}`)],
  }
  const [facade] = facades(transformYoutubeEmbeds(input))

  assert.equal(playButton(facade).properties["aria-label"], "播放影片：YouTube 影片")
})

test("transforms multiple videos on the same page", () => {
  const secondId = "second_VIDEO_2"
  const input: Root = {
    type: "root",
    children: [
      iframe(`https://www.youtube.com/embed/${videoId}`),
      iframe(`https://www.youtube.com/embed/${secondId}`),
    ],
  }
  const output = transformYoutubeEmbeds(input)

  assert.deepEqual(facades(output).map((facade) => facade.properties["data-yt-id"]), [
    videoId,
    secondId,
  ])
})
test("uses the caption after a <br> in the same paragraph (hard line breaks)", () => {
  const br: Element = { type: "element", tagName: "br", properties: {}, children: [] }
  const input: Root = {
    type: "root",
    children: [
      paragraph(iframe(`https://www.youtube.com/embed/${videoId}`), br, {
        type: "text",
        value: "大衛鮑森舊約縱覽 - 創世記(一) 聖經的基礎（40:03）",
      }),
    ],
  }

  const output = transformYoutubeEmbeds(input)
  const p = output.children[0] as Element
  const facade = p.children.find(
    (child): child is Element =>
      child.type === "element" &&
      Array.isArray(child.properties.className) &&
      child.properties.className.includes("yt-facade"),
  )
  assert.ok(facade)
  assert.equal(
    playButton(facade).properties["aria-label"],
    "播放影片：大衛鮑森舊約縱覽 - 創世記(一) 聖經的基礎（40:03）",
  )
})
