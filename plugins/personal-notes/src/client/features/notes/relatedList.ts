// 條目頁「我的相關筆記」清單（F5b，D-47、13 §4.2）：比對結果來自 related.ts，這裡只負責畫出兩組卡片。

import { chapterLabel, chapterSlug } from "../../model/books"
import { h, verseLabel } from "../../ui/dom"
import type { Resolved } from "../../merge/merge"
import type { RelatedNotes } from "./related"

const PAGE_SIZE = 20

function previewText(body: string): string {
  return body
    .replace(/^\s*(?:#{1,6}\s*|>\s*|[-*]\s+|\d+\.\s+)/gm, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140)
}

function noteHref(record: Resolved, basepath: string): string {
  const winner = record.winner
  const anchor = winner.anchor
  const prefix = basepath.replace(/\/$/, "")

  if (anchor.kind === "node" && anchor.node) {
    return `${prefix}/${encodeURI(anchor.node.slug)}#bwz-note-${encodeURIComponent(winner.id)}`
  }

  if (anchor.kind !== "node" && anchor.book && anchor.chapter) {
    const slug = chapterSlug(anchor.book, anchor.chapter)
    if (slug) {
      return `${prefix}/${encodeURI(slug)}#bwz-note-${encodeURIComponent(winner.id)}`
    }
  }

  return "#"
}

function noteCard(record: Resolved, basepath: string): HTMLElement {
  const winner = record.winner
  const anchor = winner.anchor
  const place =
    anchor.kind === "node" && anchor.node
      ? `📚 ${anchor.node.title}`
      : anchor.kind !== "node" && anchor.book && anchor.chapter
        ? `${chapterLabel(anchor.book, anchor.chapter)} ${verseLabel(anchor.verseStart, anchor.verseEnd)}`
        : ""

  const card = h(
    "a",
    {
      class: "bwz-related-card",
      attrs: { href: noteHref(record, basepath) },
    },
    h(
      "span",
      { class: "bwz-related-place" },
      place,
      record.conflicts.length > 0
        ? h("span", { class: "bwz-related-conflict", text: "有兩個版本" })
        : null,
    ),
    winner.title ? h("span", { class: "bwz-related-title", text: winner.title }) : null,
    h("span", { class: "bwz-related-preview", text: previewText(winner.body) }),
  )

  return card
}

export class RelatedList {
  readonly el: HTMLElement
  private readonly entryTitle: string
  private result: RelatedNotes = { linked: [], mentioned: [] }
  private basepath = ""
  private hasOwnNotes = false
  private linkedLimit = PAGE_SIZE
  private mentionedLimit = PAGE_SIZE

  constructor(entryTitle: string) {
    this.entryTitle = entryTitle
    this.el = h("section", {
      class: "bwz-related",
      attrs: { "aria-label": "我的相關筆記" },
    })
    this.render()
  }

  update(result: RelatedNotes, basepath: string, hasOwnNotes: boolean): void {
    this.result = result
    this.basepath = basepath
    this.hasOwnNotes = hasOwnNotes
    this.linkedLimit = PAGE_SIZE
    this.mentionedLimit = PAGE_SIZE
    this.render()
  }

  private render(): void {
    const { linked, mentioned } = this.result
    const total = linked.length + mentioned.length
    this.el.replaceChildren()
    this.el.hidden = false

    if (total === 0) {
      if (this.hasOwnNotes) {
        this.el.hidden = true
        return
      }

      this.el.append(
        h("p", {
          class: "bwz-related-empty",
          text: `在筆記裡寫 [[${this.entryTitle}]]，就會列在這裡`,
        }),
      )
      return
    }

    this.el.append(
      h(
        "h3",
        { class: "bwz-related-heading" },
        "我的相關筆記",
        h("span", { class: "bwz-related-count", text: `（${total}）` }),
      ),
    )

    const addGroup = (
      title: string,
      description: string,
      records: Resolved[],
      limit: number,
      group: "linked" | "mentioned",
    ) => {
      if (records.length === 0) return

      const list = h(
        "div",
        { class: "bwz-related-cards" },
        ...records.slice(0, limit).map((record) => noteCard(record, this.basepath)),
      )
      const children: HTMLElement[] = [
        h(
          "h4",
          { class: "bwz-related-group-heading" },
          title,
          h("span", { class: "bwz-related-count", text: `（${records.length}）` }),
        ),
        h("p", { class: "bwz-related-description", text: description }),
        list,
      ]

      if (records.length > limit) {
        children.push(
          h("button", {
            class: "bwz-related-more",
            text: "再顯示 20 則",
            attrs: { type: "button" },
            on: {
              click: () => {
                if (group === "linked") this.linkedLimit += PAGE_SIZE
                else this.mentionedLimit += PAGE_SIZE
                this.render()
              },
            },
          }),
        )
      }

      this.el.append(h("div", { class: `bwz-related-group ${group}` }, ...children))
    }

    addGroup(
      "連到這個條目",
      `筆記裡寫了 [[${this.entryTitle}]] 或它的別名`,
      linked,
      this.linkedLimit,
      "linked",
    )
    addGroup(
      `提到〈${this.entryTitle}〉`,
      "內文出現這個名稱",
      mentioned,
      this.mentionedLimit,
      "mentioned",
    )
  }
}
