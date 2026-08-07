import { describe, expect, it } from "vitest";
import { byChapterNumeric } from "../src/components/PageList";
import type { FullSlug } from "../src/util/path";

const page = (chapter: number, title = `第${chapter}章`) => ({
  slug: `01-創世記/第${chapter}章` as FullSlug,
  frontmatter: { title },
});

describe("byChapterNumeric", () => {
  it("sorts chapter titles by their numeric chapter", () => {
    const pages = [page(10), page(11), page(1), page(20), page(2)];

    expect(pages.sort(byChapterNumeric).map((entry) => entry.frontmatter.title)).toEqual([
      "第1章",
      "第2章",
      "第10章",
      "第11章",
      "第20章",
    ]);
  });

  it("falls back to the slug when the title does not contain a chapter", () => {
    const pages = [page(10, "創世記十"), page(2, "創世記二"), page(1, "創世記一")];

    expect(pages.sort(byChapterNumeric).map((entry) => entry.slug)).toEqual([
      "01-創世記/第1章",
      "01-創世記/第2章",
      "01-創世記/第10章",
    ]);
  });
});
