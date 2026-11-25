import { describe, expect, it } from "vitest";
import {
  binarize,
  coalesceRanges,
  formatMegabytes,
  hamming,
  mergeSemanticResults,
  parseManifest,
  quantizeInt8,
  rescore,
  topKByHamming,
} from "../src/components/semanticIndex";

const manifest = {
  version: 1,
  model: "Xenova/bge-small-zh-v1.5",
  dim: 512,
  count: 3,
  bits: "bits.a.bin",
  rows: "rows.a.bin",
  ids: "ids.a.json",
  assetBytes: 30 * 1024 * 1024,
  modelPath: "model/",
  vendorPath: "vendor/",
};

describe("parseManifest", () => {
  it("accepts a valid manifest", () => {
    expect(parseManifest(manifest)?.count).toBe(3);
    expect(parseManifest({ ...manifest, vendorEntry: "t.js" })?.vendorEntry).toBe("t.js");
  });

  it("rejects wrong version, dimension or count", () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ ...manifest, version: 2 })).toBeNull();
    expect(parseManifest({ ...manifest, dim: 0 })).toBeNull();
    expect(parseManifest({ ...manifest, dim: 513 })).toBeNull();
    expect(parseManifest({ ...manifest, count: -1 })).toBeNull();
    expect(parseManifest({ ...manifest, count: 1.5 })).toBeNull();
    expect(parseManifest({ ...manifest, bits: "" })).toBeNull();
    expect(parseManifest({ ...manifest, assetBytes: "1" })).toBeNull();
  });
});

describe("bit layout and quantization", () => {
  it("puts dimension j in byte j>>3, bit j&7 (LSB first), 1 when v>0", () => {
    const v = new Float32Array(16);
    v[0] = 0.5; // byte 0 bit 0
    v[3] = 0.1; // byte 0 bit 3
    v[8] = 1; // byte 1 bit 0
    v[15] = 0.2; // byte 1 bit 7
    v[5] = 0; // 0 不算正
    v[6] = -0.4;
    const bits = binarize(v);
    expect(Array.from(bits)).toEqual([0b00001001, 0b10000001]);
  });

  it("quantizes int8 as round(v*127) clamped to +-127", () => {
    expect(Array.from(quantizeInt8([0, 0.25, -0.25, 1, -1, 2, -2, 0.0079]))).toEqual([
      0, 32, -32, 127, -127, 127, -127, 1,
    ]);
  });
});

describe("hamming and topKByHamming", () => {
  const rowBytes = 2;
  // 4 列：與查詢的距離 0, 16, 1, 8
  const bits = Uint8Array.from([
    0b10101010, 0b11110000, 0b01010101, 0b00001111, 0b10101011, 0b11110000, 0b10100101, 0b11110000,
  ]);
  const query = Uint8Array.from([0b10101010, 0b11110000]);

  it("counts differing bits per row", () => {
    expect(hamming(bits, 0, query, rowBytes)).toBe(0);
    expect(hamming(bits, 1, query, rowBytes)).toBe(16);
    expect(hamming(bits, 2, query, rowBytes)).toBe(1);
    expect(hamming(bits, 3, query, rowBytes)).toBe(4);
  });

  it("returns the k nearest rows sorted by distance then id", () => {
    expect(topKByHamming(bits, query, 2)).toEqual([
      { id: 0, distance: 0 },
      { id: 2, distance: 1 },
    ]);
    expect(topKByHamming(bits, query, 10).map((h) => h.id)).toEqual([0, 2, 3, 1]);
  });

  it("fills ties at the threshold by id order and matches a full sort", () => {
    const rows = 300;
    const big = new Uint8Array(rows * 4);
    let seed = 7;
    for (let i = 0; i < big.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      big[i] = seed >> 8;
    }
    const q = Uint8Array.from([1, 2, 3, 4]);
    const expected = Array.from({ length: rows }, (_, id) => ({
      id,
      distance: hamming(big, id, q, 4),
    }))
      .sort((a, b) => a.distance - b.distance || a.id - b.id)
      .slice(0, 100);
    expect(topKByHamming(big, q, 100)).toEqual(expected);
  });
});

describe("coalesceRanges", () => {
  it("merges rows whose gap is at most 8 and returns inclusive byte ranges", () => {
    const ranges = coalesceRanges([30, 3, 5, 14, 3, 100], 512, 8);
    expect(ranges.map((r) => [r.firstRow, r.lastRow])).toEqual([
      [3, 14],
      [30, 30],
      [100, 100],
    ]);
    expect(ranges[0]).toMatchObject({ start: 3 * 512, end: 15 * 512 - 1 });
  });

  it("keeps rows separate when the gap is larger than the limit", () => {
    expect(coalesceRanges([0, 10], 4, 8)).toHaveLength(2);
    expect(coalesceRanges([0, 9], 4, 8)).toHaveLength(1);
    expect(coalesceRanges([], 4)).toEqual([]);
  });
});

describe("rescore", () => {
  it("computes the dot product divided by 127", () => {
    const query = Float32Array.from([1, 0, 0, 0]);
    const rows = [Int8Array.from([127, 5, 5, 5]), Int8Array.from([-127, 0, 0, 0])];
    expect(rescore(rows, query)).toEqual([1, -1]);
  });
});

describe("mergeSemanticResults", () => {
  const category = (slug: string) =>
    slug.startsWith("人物/") ? "人物" : slug.startsWith("地點/") ? "地點" : null;
  const hits = [
    { slug: "地點/a", score: 0.5 },
    { slug: "人物/b", score: 0.9 },
    { slug: "人物/c", score: 0.7 },
    { slug: "章節/x", score: 0.95 },
    { slug: "人物/b", score: 0.9 },
  ];

  it("drops literal hits, duplicates and uncategorized pages, ordered by score", () => {
    const merged = mergeSemanticResults(hits, ["人物/c"], null, 20, category);
    expect(merged.map((r) => r.slug)).toEqual(["人物/b", "地點/a"]);
  });

  it("respects the selected categories and the limit", () => {
    expect(
      mergeSemanticResults(hits, [], new Set(["地點"]), 20, category).map((r) => r.slug),
    ).toEqual(["地點/a"]);
    expect(mergeSemanticResults(hits, [], null, 1, category)).toHaveLength(1);
    expect(mergeSemanticResults(hits, [], new Set(), 20, category)).toEqual([]);
  });
});

describe("formatMegabytes", () => {
  it("rounds to whole megabytes, at least 1", () => {
    expect(formatMegabytes(30.4 * 1024 * 1024)).toBe(30);
    expect(formatMegabytes(10)).toBe(1);
  });
});
