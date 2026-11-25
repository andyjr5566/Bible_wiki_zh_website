import { describe, expect, it } from "vitest";
import { buildFeedbackFormUrl, parseFeedbackFormConfig } from "../src/components/feedbackForm";

const config = {
  url: "https://docs.google.com/forms/d/e/FORM_ID/viewform",
  choiceEntry: "entry.111",
  choiceValue: "我想在搜尋框提議，不同版本查的字",
  queryEntry: "entry.222",
};

describe("Feedback form link", () => {
  it("prefills the routing choice and the reader's query", () => {
    const link = new URL(buildFeedbackFormUrl(config, "意念"));
    expect(link.origin + link.pathname).toBe(config.url);
    expect(link.searchParams.get("usp")).toBe("pp_url");
    expect(link.searchParams.get("entry.111")).toBe(config.choiceValue);
    expect(link.searchParams.get("entry.222")).toBe("意念");
  });

  it("encodes spaces, ampersands and other reserved characters in the query", () => {
    const href = buildFeedbackFormUrl(config, "  a b&c=d#e+f 意念 ");
    expect(href).toContain("entry.222=a%20b%26c%3Dd%23e%2Bf%20%E6%84%8F%E5%BF%B5");
    expect(new URL(href).searchParams.get("entry.222")).toBe("a b&c=d#e+f 意念");
  });

  it("appends to a url that already has a query string", () => {
    const href = buildFeedbackFormUrl({ ...config, url: config.url + "?hl=zh-TW" }, "x");
    expect(new URL(href).searchParams.get("hl")).toBe("zh-TW");
    expect(new URL(href).searchParams.get("entry.222")).toBe("x");
  });

  it("accepts the config as an object or as the JSON string from the data attribute", () => {
    expect(parseFeedbackFormConfig(config)).toEqual(config);
    expect(parseFeedbackFormConfig(JSON.stringify(config))).toEqual(config);
  });

  it("returns null for missing, partial or unsafe config", () => {
    expect(parseFeedbackFormConfig(undefined)).toBeNull();
    expect(parseFeedbackFormConfig("not json")).toBeNull();
    expect(parseFeedbackFormConfig({ ...config, queryEntry: "" })).toBeNull();
    expect(parseFeedbackFormConfig({ ...config, url: "javascript:alert(1)" })).toBeNull();
    expect(parseFeedbackFormConfig({ ...config, url: "http://example.com/form" })).toBeNull();
  });
});
