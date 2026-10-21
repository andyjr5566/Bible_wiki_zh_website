export function displayTitle(
  slug: string,
  frontmatterTitle: string | undefined,
  siteTitle: string,
): string {
  if (slug === "index") {
    return siteTitle
  }

  const chapterOrSection = slug.match(
    /^\d+-([^/]+)\/(第\d+章|全書目錄及綱要|書卷導論)$/,
  )
  if (chapterOrSection) {
    const bookName = chapterOrSection[1].replace(/-/g, " ")
    return bookName + " " + chapterOrSection[2]
  }

  const segments = slug.split("/")
  return frontmatterTitle ?? segments[segments.length - 1] ?? slug
}

export function documentTitle(
  slug: string,
  frontmatterTitle: string | undefined,
  siteTitle: string,
  suffix = "",
): string {
  if (slug === "index") {
    return siteTitle + suffix
  }

  const title = displayTitle(slug, frontmatterTitle, siteTitle)
  if (title === siteTitle) {
    return siteTitle + suffix
  }

  return title + "｜" + siteTitle + suffix
}

export function cleanDescription(desc: string, heading: string, siteTitle: string): string {
  let cleaned = desc.trimStart()
  const prefixes = [heading, siteTitle].filter(Boolean).sort((a, b) => b.length - a.length)
  const prefix = prefixes.find((candidate) => cleaned.startsWith(candidate))
  if (prefix) {
    cleaned = cleaned.slice(prefix.length)
  }

  cleaned = cleaned.trimStart().replace(/^(?:(?:前一章|回目錄|下一章)\s*)+/, "")
  cleaned = cleaned.replace(/[█░]/g, "").replace(/\s+/g, " ").trim()
  return cleaned || desc
}

export function htmlLang(locale: string | undefined, override?: string): string {
  if (override !== undefined) {
    return override
  }

  switch (locale) {
    case "zh-TW":
      return "zh-Hant-TW"
    case "zh-HK":
      return "zh-Hant-HK"
    case "zh-CN":
      return "zh-Hans-CN"
    default:
      return locale?.split("-")[0] ?? "en"
  }
}
