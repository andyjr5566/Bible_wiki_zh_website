import type { Element, ElementContent, Root, RootContent } from "hast"
import { clone } from "./clone"

const skippedTags = new Set([
  "a",
  "code",
  "pre",
  "script",
  "style",
  "svg",
  "math",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "title",
  "textarea",
])

const strongNumberPattern = /(?<![A-Za-z0-9])[HG][0-9]{1,4}[A-Z]?(?![A-Za-z0-9])/
const culturalCharacterPattern = /[㐀-鿿֐-׿Ͱ-Ͽἀ-῿]/u

function hasNearbyCulturalCharacter(value: string, start: number, end: number): boolean {
  const before = Array.from(value.slice(0, start)).slice(-30)
  const after = Array.from(value.slice(end)).slice(0, 30)
  return [...before, ...after].some((character) => culturalCharacterPattern.test(character))
}

function hasEligibleStrongNumber(value: string): boolean {
  const pattern = new RegExp(strongNumberPattern.source, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (hasNearbyCulturalCharacter(value, match.index, match.index + match[0].length)) {
      return true
    }
  }

  return false
}

function containsStrongNumber(node: Root | RootContent): boolean {
  if (node.type === "text") return hasEligibleStrongNumber(node.value)
  if (node.type === "root") return node.children.some(containsStrongNumber)
  if (node.type !== "element" || skippedTags.has(node.tagName)) return false
  return node.children.some(containsStrongNumber)
}

function makeStrongNumber(number: string): Element {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: ["strong-no"],
      title: `Strong 編號 ${number}`,
    },
    children: [{ type: "text", value: number }],
  }
}

function transformText(value: string): ElementContent[] | undefined {
  const pattern = new RegExp(strongNumberPattern.source, "g")
  const transformed: ElementContent[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    const end = match.index + match[0].length
    if (!hasNearbyCulturalCharacter(value, match.index, end)) continue

    if (match.index > cursor) {
      transformed.push({ type: "text", value: value.slice(cursor, match.index) })
    }
    transformed.push(makeStrongNumber(match[0]))
    cursor = end
  }

  if (cursor === 0) return undefined
  if (cursor < value.length) {
    transformed.push({ type: "text", value: value.slice(cursor) })
  }
  return transformed
}

function transformChildren<T extends { type: string }>(children: T[]): T[] {
  const transformed: T[] = []

  for (const child of children) {
    const node = child as unknown as RootContent

    if (node.type === "text") {
      const replacements = transformText(node.value)
      if (replacements) {
        transformed.push(...(replacements as unknown as T[]))
      } else {
        transformed.push(child)
      }
    } else if (node.type === "element") {
      const element = node as Element
      if (skippedTags.has(element.tagName)) {
        transformed.push(child)
      } else {
        transformed.push({
          ...element,
          children: transformChildren<ElementContent>(element.children),
        } as unknown as T)
      }
    } else {
      transformed.push(child)
    }
  }

  return transformed
}

/** Wrap Strong numbers near Chinese, Hebrew, or Greek text in a HAST tree. */
export function wrapStrongNumbers(tree: Root): Root {
  // Most pages have no eligible numbers, so avoid cloning those trees.
  if (!containsStrongNumber(tree)) return tree

  const copiedTree = clone(tree) as Root
  copiedTree.children = transformChildren(copiedTree.children)
  return copiedTree
}
