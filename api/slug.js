/**
 * Convert an embedding metadata path into the same URL slug Quartz emits.
 *
 * Embedding records are generated from source Markdown paths, while the site
 * serves lower-case, hyphenated slugs. Keeping this conversion in one small,
 * dependency-free module prevents search results from linking to a different
 * route than the generated site.
 */
export function normalizeSearchSlug(rawSlug) {
  if (typeof rawSlug !== "string") return null

  let slug = rawSlug.replace(/\\/g, "/").trim()
  slug = slug.replace(/^\/+|\/+$/g, "")
  slug = slug.replace(/\.(?:md|html)$/i, "")
  if (!slug) return null

  const segments = slug
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, "")
        .toLowerCase(),
    )

  // Quartz treats a file named exactly like its parent folder as that
  // folder's index page (for example, foo/foo.md -> foo/index).
  if (segments.length >= 2 && segments.at(-1) === segments.at(-2)) {
    segments[segments.length - 1] = "index"
  }

  return segments.join("/")
}
