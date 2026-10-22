import { describe, expect, it } from "vitest";
import { buildSnippetHtml } from "../src/components/snippet";

const plain = (html: string) => html.replace(/<[^>]*>/g, "");

describe("buildSnippetHtml", () => {
  it("shows the place where the query really is, even in the middle of a long unspaced paragraph", () => {
    const filler = "這是一段很長的說明文字沒有空白。".repeat(40);
    const text = `以撒\n定義\n${filler}神是守約的神，祂信守對亞伯拉罕的應許。${filler}\nwww.ccbiblestudy.org/Old%20Testament/02Exo/02GT03.htm 出埃及記 3章`;
    const html = buildSnippetHtml(text, "守約", { title: "以撒" });
    expect(html).toContain('<span class="highlight">守約</span>');
    expect(plain(html)).not.toContain("ccbiblestudy");
  });

  it("starts at the beginning of the sentence when it is close to the match", () => {
    const text = "前一句話在這裡結束。第二句話裡提到守約的內容，後面還有很長一段說明文字。";
    const html = buildSnippetHtml(text, "守約");
    expect(plain(html).startsWith("第二句話")).toBe(true);
    expect(html.startsWith("...")).toBe(false);
  });

  it("adds an ellipsis when it has to cut inside a long sentence", () => {
    const text = `${"字".repeat(80)}守約${"字".repeat(200)}`;
    const html = buildSnippetHtml(text, "守約");
    expect(html.startsWith("...")).toBe(true);
    expect(html.endsWith("...")).toBe(true);
    expect(html).toContain('<span class="highlight">守約</span>');
  });

  it("starts at the paragraph that holds the match, without the title line or a leading ellipsis", () => {
    const text = "亞伯拉罕\n定義\n聖經中信心之父，原名亞伯蘭。他的故事從創世記十二章開始。";
    const html = buildSnippetHtml(text, "信心", { title: "亞伯拉罕" });
    expect(plain(html).startsWith("聖經中信心之父")).toBe(true);
    expect(html.startsWith("...")).toBe(false);
  });

  it("prefers ordinary text over a diagram that also contains the query", () => {
    const text = [
      "flowchart TD",
      "  A[申命記&lt;br/&gt;摩押：重申約] --&gt; E[先知&lt;br/&gt;呼籲回轉守約]",
      "主旨：因此他們不可重蹈覆轍，因為神仍信實守約。",
    ].join("\n");
    const html = buildSnippetHtml(text, "守約");
    expect(plain(html)).toContain("神仍信實守約");
    expect(html).not.toContain("--&gt;");
    expect(html).not.toContain("&lt;br");
  });

  it("restores escaped characters instead of showing them twice escaped", () => {
    const text = "E[先知&lt;br/&gt;呼籲回轉守約] B --&gt; F[新約]";
    const html = buildSnippetHtml(text, "守約");
    expect(html).not.toContain("&amp;lt;");
    expect(html).not.toContain("&amp;gt;");
    expect(html).not.toContain("&lt;br");
    expect(plain(html)).toContain("呼籲回轉守約");
  });

  it("still shows the diagram text when that is the only place the query appears", () => {
    const text = "一般說明文字。\nA --> B[只在流程圖裡的守約]";
    const html = buildSnippetHtml(text, "守約");
    expect(html).toContain('<span class="highlight">守約</span>');
  });

  it("skips lines that start with a web address", () => {
    const text = "www.example.org/page 守約\n正文裡也有守約這個詞。";
    const html = buildSnippetHtml(text, "守約");
    expect(plain(html)).toContain("正文裡也有");
    expect(plain(html)).not.toContain("www.example.org");
  });

  it("does not run on into the source-citation lines that hold a web address", () => {
    const text =
      "摩西 親近 聖膏油\n來源依據 逐節註解: 利十1 文意註解（www.ccbiblestudy.org/Old%20Testament/03Le）\n凡火指祭壇以外取來的火。";
    const html = buildSnippetHtml(text, "摩西");
    expect(plain(html)).not.toContain("www.");
    expect(plain(html)).not.toContain("來源依據");
  });

  it("escapes HTML coming from the text", () => {
    const html = buildSnippetHtml("<img src=x onerror=alert(1)>守約的神", "守約");
    expect(html).not.toContain("<img");
    expect(html).toContain('<span class="highlight">守約</span>');
  });

  it("matches ignoring case and highlights every occurrence in the snippet", () => {
    const html = buildSnippetHtml("Steadfast Love is steadfast love again.", "steadfast love");
    expect(html.match(/class="highlight"/g)).toHaveLength(2);
  });

  it("without a match (semantic results) shows the lead paragraph, not the end of the text", () => {
    const text = `開頭段落說明立約的意思，是整篇的重點。\n${"中間".repeat(100)}\n結尾的最後一句話。`;
    const html = buildSnippetHtml(text, "完全不相干的詞");
    expect(plain(html).startsWith("開頭段落")).toBe(true);
    expect(html).not.toContain("highlight");
    expect(plain(html)).not.toContain("結尾");
  });

  it("returns an empty string when there is no text", () => {
    expect(buildSnippetHtml("", "守約")).toBe("");
    expect(buildSnippetHtml("  \n  ", "守約")).toBe("");
  });
});
