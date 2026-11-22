import assert from "node:assert/strict"
import test from "node:test"
import * as fs from "node:fs"
import * as path from "node:path"
import {
  matchReferenceUrls,
  matchSourceNames,
  parseSourceNamesYaml,
} from "./sourceNames"
import { clearSourceNamesCache, loadSourceNames } from "./sourceNamesLoader"

const realYamlPath = path.resolve(process.cwd(), "config", "source-names.yaml")

test("loads and validates the real config/source-names.yaml", () => {
  clearSourceNamesCache()
  const registry = loadSourceNames()
  assert.equal(registry.version, 1)
  assert.ok(registry.collections.length >= 5)
  assert.ok(registry.works.length >= 15)
  assert.ok(registry.entries.has("黃迦勒"))
  assert.ok(registry.entries.has("《丁道爾》"))
})

test("matches longer names before shorter names and distinguishes legacy codes", () => {
  const registry = parseSourceNamesYaml(fs.readFileSync(realYamlPath, "utf8"))

  const text =
    "《丁道爾聖經註釋》與《丁道爾》都提到；CT與《啟導本》同意，STEP Bible 和 STEP 也有列，但 FACT 或 STEPS 不算。"
  const matches = matchSourceNames(text, registry)

  assert.deepEqual(
    matches.map((m) => ({
      matched: m.matched,
      id: m.entry.id,
      isCode: m.isCode,
    })),
    [
      { matched: "《丁道爾聖經註釋》", id: "《丁道爾》", isCode: false },
      { matched: "《丁道爾》", id: "《丁道爾》", isCode: false },
      { matched: "CT", id: "黃迦勒", isCode: true },
      { matched: "《啟導本》", id: "《啟導本》", isCode: false },
      { matched: "STEP Bible", id: "STEP Bible", isCode: false },
      { matched: "STEP", id: "STEP Bible", isCode: true },
    ],
  )
})

test("matches complex work patterns from Genesis 1 and Exodus 8", () => {
  const registry = parseSourceNamesYaml(fs.readFileSync(realYamlPath, "utf8"))

  const text =
    "《聖經精讀本──創世記註解》、《創世記雷氏研讀本》、《舊約聖經背景註釋》、賈斯樂與郝威、丁良才、KC 指出、GT 推測、BH。"
  const matches = matchSourceNames(text, registry)

  assert.deepEqual(
    matches.map((m) => [m.matched, m.entry.id, m.isCode]),
    [
      ["《聖經精讀本──創世記註解》", "《精讀本》", false],
      ["《創世記雷氏研讀本》", "《雷氏研讀本》", false],
      ["《舊約聖經背景註釋》", "《舊約背景註釋》", false],
      ["賈斯樂與郝威", "賈斯樂郝威", false],
      ["丁良才", "丁良才", false],
      ["KC", "KingComments", true],
      ["GT", "拾穗", true],
      ["BH", "BibleHub", true],
    ],
  )
})

test("matches chapter reference URLs via url_hint and shares GT URL with works", () => {
  const registry = parseSourceNamesYaml(fs.readFileSync(realYamlPath, "utf8"))
  const urls = [
    "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01CT01.htm",
    "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01GT01.htm",
    "https://www.kingcomments.com/en/bible-studies/Gen/1",
    "https://biblehub.com/study/genesis/1.htm",
    "https://github.com/STEPBible/STEPBible-Data",
  ]
  const map = matchReferenceUrls(urls, registry)

  assert.equal(map["黃迦勒"], urls[0])
  assert.equal(map["拾穗"], urls[1])
  assert.equal(map["KingComments"], urls[2])
  assert.equal(map["BibleHub"], urls[3])
  assert.equal(map["STEP Bible"], urls[4])

  const tyndale = registry.entries.get("《丁道爾》")
  assert.ok(tyndale)
  assert.equal(tyndale.urlOwnerId, "拾穗")
  assert.equal(map[tyndale.urlOwnerId], urls[1])
})

test("rejects malformed YAML or invalid regex with descriptive errors", () => {
  assert.throws(() => parseSourceNamesYaml("not: [valid"), /解析失敗/)
  assert.throws(() => parseSourceNamesYaml("version: 1\ncollections: []\n"), /collections/)
  assert.throws(
    () =>
      parseSourceNamesYaml(`
version: 1
collections:
  - code: CT
    name: 黃迦勒
    title: 標題
    note: 說明
    patterns: ["[unclosed"]
`),
    /正規式/,
  )
  assert.throws(
    () =>
      parseSourceNamesYaml(`
version: 1
collections:
  - code: CT
    name: 黃迦勒
    title: 標題
    note: 說明
    url_hint: "[bad"
    patterns: ["黃迦勒"]
`),
    /url_hint/,
  )
})

test("loadSourceNames fails loudly when config/source-names.yaml is missing", () => {
  clearSourceNamesCache()
  assert.throws(() => loadSourceNames(path.resolve(process.cwd(), "non-existent-dir")), /無法讀取來源名稱設定檔/)
})
