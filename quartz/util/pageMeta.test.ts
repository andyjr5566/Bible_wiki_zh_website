import test from "node:test"
import assert from "node:assert"
import { cleanDescription, displayTitle, documentTitle, htmlLang } from "./pageMeta"

const siteTitle = "聖經研讀知識庫"

test("displayTitle chooses a readable page title", () => {
  assert.strictEqual(displayTitle("index", "首頁", siteTitle), siteTitle)
  assert.strictEqual(displayTitle("02-出埃及記/第12章", "第12章", siteTitle), "出埃及記 第12章")
  assert.strictEqual(
    displayTitle("01-創世記/全書目錄及綱要", "全書目錄及綱要", siteTitle),
    "創世記 全書目錄及綱要",
  )
  assert.strictEqual(
    displayTitle("19-詩篇-補篇/第12章", "第12章", siteTitle),
    "詩篇 補篇 第12章",
  )
  assert.strictEqual(
    displayTitle("01-創世記/書卷導論", "書卷導論", siteTitle),
    "創世記 書卷導論",
  )
  assert.strictEqual(displayTitle("link_folder/歷史/逾越節羔羊", "逾越節羔羊", siteTitle), "逾越節羔羊")
  assert.strictEqual(displayTitle("link_folder/歷史/逾越節羔羊", undefined, siteTitle), "逾越節羔羊")
})

test("documentTitle includes the site title without repeating it", () => {
  assert.strictEqual(documentTitle("index", undefined, siteTitle), siteTitle)
  assert.strictEqual(documentTitle("index", undefined, siteTitle, " - Notes"), siteTitle + " - Notes")
  assert.strictEqual(
    documentTitle("02-出埃及記/第12章", "第12章", siteTitle),
    "出埃及記 第12章｜聖經研讀知識庫",
  )
  assert.strictEqual(documentTitle("notes/start", siteTitle, siteTitle), siteTitle)
  assert.strictEqual(documentTitle("notes/start", undefined, siteTitle), "start｜聖經研讀知識庫")
})

test("cleanDescription removes headings, navigation, progress glyphs, and extra whitespace", () => {
  assert.strictEqual(
    cleanDescription(
      "出埃及記 第12章 前一章回目錄 下一章 耶和華在夜間擊殺埃及人。 ███░ 100%",
      "出埃及記 第12章",
      siteTitle,
    ),
    "耶和華在夜間擊殺埃及人。 100%",
  )
  assert.strictEqual(cleanDescription(siteTitle + "  █░  內容\n  延伸", "首頁", siteTitle), "內容 延伸")
  assert.strictEqual(cleanDescription("前一章   回目錄下一章  正文", "其他標題", siteTitle), "正文")
  const original = "第12章 前一章回目錄下一章 █░"
  assert.strictEqual(cleanDescription(original, "第12章", siteTitle), original)
})

test("htmlLang maps Chinese locales, preserves other locale behavior, and honors overrides", () => {
  assert.strictEqual(htmlLang("zh-TW"), "zh-Hant-TW")
  assert.strictEqual(htmlLang("zh-HK"), "zh-Hant-HK")
  assert.strictEqual(htmlLang("zh-CN"), "zh-Hans-CN")
  assert.strictEqual(htmlLang("en"), "en")
  assert.strictEqual(htmlLang("en-GB"), "en")
  assert.strictEqual(htmlLang(undefined), "en")
  assert.strictEqual(htmlLang("zh-TW", "zh"), "zh")
})
