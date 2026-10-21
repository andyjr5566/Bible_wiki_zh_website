import assert from "node:assert/strict"
import test from "node:test"
import type { Element, ElementContent, Root, RootContent } from "hast"
import { wrapStrongNumbers } from "./strongNumbers"

function text(value: string): ElementContent {
  return { type: "text", value }
}

function element(tagName: string, ...children: ElementContent[]): Element {
  return { type: "element", tagName, properties: {}, children }
}

function paragraph(...children: ElementContent[]): Element {
  return element("p", ...children)
}

function root(...children: RootContent[]): Root {
  return { type: "root", children }
}

function strongSpans(tree: Root): Element[] {
  const spans: Element[] = []

  function visit(node: Root | RootContent): void {
    if (node.type === "root") {
      node.children.forEach(visit)
      return
    }
    if (node.type !== "element") return

    const className = node.properties.className
    if (Array.isArray(className) && className.includes("strong-no")) {
      spans.push(node)
    }
    node.children.forEach(visit)
  }

  visit(tree)
  return spans
}

function spanText(span: Element): string {
  return span.children
    .filter((child): child is Extract<ElementContent, { type: "text" }> => child.type === "text")
    .map((child) => child.value)
    .join("")
}

test("wraps a single Strong number near Chinese text", () => {
  const input = root(paragraph(text("以本月為正月 H2320G。")))
  const output = wrapStrongNumbers(input)
  const [span] = strongSpans(output)

  assert.ok(span)
  assert.equal(spanText(span), "H2320G")
  assert.equal(span.properties.title, "Strong 編號 H2320G")
})

test("wraps multiple Strong numbers in one text node", () => {
  const input = root(paragraph(text("要無殘疾 H7716 搭配 H8549G, H2145")))
  const spans = strongSpans(wrapStrongNumbers(input))

  assert.deepEqual(spans.map(spanText), ["H7716", "H8549G", "H2145"])
  assert.deepEqual(
    spans.map((span) => span.properties.title),
    ["Strong 編號 H7716", "Strong 編號 H8549G", "Strong 編號 H2145"],
  )
})

test("wraps a G number near Greek text", () => {
  const input = root(paragraph(text("λόγος G3056")))
  const [span] = strongSpans(wrapStrongNumbers(input))

  assert.ok(span)
  assert.equal(spanText(span), "G3056")
  assert.equal(span.properties.title, "Strong 編號 G3056")
})

test("wraps a number with an alphabetic suffix", () => {
  const input = root(paragraph(text("兒子 H1121L")))
  const [span] = strongSpans(wrapStrongNumbers(input))

  assert.ok(span)
  assert.equal(spanText(span), "H1121L")
  assert.equal(span.properties.title, "Strong 編號 H1121L")
})

test("does not wrap numbers inside a, code, or heading elements", () => {
  const input = root(
    paragraph(
      text("連結："),
      element("a", text("中文 H1234")),
      text("，程式碼："),
      element("code", text("中文 H5678")),
    ),
    element("h2", text("中文 H9012")),
  )

  assert.equal(strongSpans(wrapStrongNumbers(input)).length, 0)
})

test("does not wrap a number in a pure English sentence", () => {
  const input = root(paragraph(text("Set H2 heading")))

  assert.equal(strongSpans(wrapStrongNumbers(input)).length, 0)
})

test("returns the original tree when it has no eligible Strong numbers", () => {
  const input = root(paragraph(text("這段文字沒有編號。")))

  assert.equal(wrapStrongNumbers(input), input)
})

test("preserves text before and after a wrapped number", () => {
  const input = root(paragraph(text("前文 H2320G 後文")))
  const output = wrapStrongNumbers(input)
  const outputParagraph = output.children[0]

  assert.equal(outputParagraph.type, "element")
  if (outputParagraph.type !== "element") return

  assert.deepEqual(
    outputParagraph.children.map((child) =>
      child.type === "text" ? child.value : spanText(child as Element),
    ),
    ["前文 ", "H2320G", " 後文"],
  )
})
