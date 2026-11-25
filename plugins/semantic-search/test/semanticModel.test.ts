import { describe, expect, it } from "vitest";
import { coalesceRanges } from "../src/components/semanticIndex";
import {
  MAX_CONCURRENT_RANGES,
  createSemanticEngine,
  fetchByteRanges,
  runLimited,
} from "../src/components/semanticModel";

const makeFile = (size: number) => Uint8Array.from({ length: size }, (_, i) => i % 251);

function rangeFetch(file: Uint8Array, honorRange: boolean) {
  const calls: string[] = [];
  const fetchImpl = async (_url: string, init?: RequestInit) => {
    const header = (init?.headers as Record<string, string> | undefined)?.Range;
    calls.push(header ?? "full");
    if (header && honorRange) {
      const [a, b] = header.replace("bytes=", "").split("-").map(Number) as [number, number];
      return new Response(file.slice(a, b + 1), { status: 206 });
    }
    return new Response(file.slice(), { status: 200 });
  };
  return { fetchImpl, calls };
}

describe("fetchByteRanges", () => {
  const file = makeFile(40 * 4);
  const ranges = coalesceRanges([1, 2, 30], 4, 8);

  it("uses Range requests and expects 206", async () => {
    const { fetchImpl, calls } = rangeFetch(file, true);
    const parts = await fetchByteRanges("u", ranges, fetchImpl);
    expect(calls).toEqual(["bytes=4-11", "bytes=120-123"]);
    expect(Array.from(parts[0]!)).toEqual(Array.from(file.slice(4, 12)));
  });

  it("slices the body itself when the server answers 200 with the whole file", async () => {
    const { fetchImpl, calls } = rangeFetch(file, false);
    const parts = await fetchByteRanges("u", ranges, fetchImpl);
    expect(Array.from(parts[1]!)).toEqual(Array.from(file.slice(120, 124)));
    expect(calls.length).toBeLessThanOrEqual(2);
  });

  it("bypasses the HTTP cache with no-store", async () => {
    const inits: (RequestInit | undefined)[] = [];
    const { fetchImpl } = rangeFetch(file, true);
    await fetchByteRanges("u", ranges, async (u, init) => {
      inits.push(init);
      return fetchImpl(u, init);
    });
    expect(inits.length).toBe(2);
    expect(inits.every((init) => init?.cache === "no-store")).toBe(true);
  });

  it("retries a failed range once", async () => {
    const { fetchImpl } = rangeFetch(file, true);
    let failed = false;
    const flaky = async (u: string, init?: RequestInit) => {
      if (!failed) {
        failed = true;
        throw new TypeError("net::ERR_CACHE_OPERATION_NOT_SUPPORTED");
      }
      return fetchImpl(u, init);
    };
    const parts = await fetchByteRanges("u", ranges, flaky);
    expect(parts.every((part) => part !== null)).toBe(true);
    expect(Array.from(parts[0]!)).toEqual(Array.from(file.slice(4, 12)));
  });

  it("returns null for a permanently failing range but keeps the others", async () => {
    const { fetchImpl } = rangeFetch(file, true);
    const picky = async (u: string, init?: RequestInit) => {
      const header = (init?.headers as Record<string, string>).Range;
      if (header === "bytes=4-11") throw new TypeError("boom");
      return fetchImpl(u, init);
    };
    const parts = await fetchByteRanges("u", ranges, picky);
    expect(parts[0]).toBeNull();
    expect(Array.from(parts[1]!)).toEqual(Array.from(file.slice(120, 124)));
  });

  it("throws when every range fails", async () => {
    const dead = async () => new Response("no", { status: 500 });
    await expect(fetchByteRanges("u", ranges, dead)).rejects.toThrow();
  });

  it("caps concurrent range requests", async () => {
    let active = 0;
    let peak = 0;
    const many = coalesceRanges(
      Array.from({ length: 60 }, (_, i) => i * 100),
      4,
      8,
    );
    const slow = async (_u: string, init?: RequestInit) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      const [a, b] = (init?.headers as Record<string, string>).Range!.replace("bytes=", "")
        .split("-")
        .map(Number) as [number, number];
      return new Response(new Uint8Array(b - a + 1), { status: 206 });
    };
    await fetchByteRanges("u", many, slow);
    expect(MAX_CONCURRENT_RANGES).toBe(24);
    expect(peak).toBe(24);
  });

  it("limits concurrency", async () => {
    let active = 0;
    let peak = 0;
    await runLimited(
      Array.from({ length: 20 }, (_, i) => i),
      6,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 1));
        active--;
      },
    );
    expect(peak).toBe(6);
  });
});

describe("createSemanticEngine", () => {
  it("reports unavailable when the manifest is missing", async () => {
    const engine = createSemanticEngine({
      resolvePath: (p) => "/" + p,
      fetchImpl: async () => new Response("nope", { status: 404 }),
    });
    expect(await engine.loadManifest()).toBeNull();
    expect(await engine.prepare()).toBe(false);
    expect(engine.isReady()).toBe(false);
  });

  it("loads the index and model from the manifest paths and searches", async () => {
    const dim = 8;
    const vectors = [
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0.9, 0.1, 0, 0, 0, 0, 0, 0],
    ];
    const rows = new Int8Array(vectors.flat().map((v) => Math.round(v * 127)));
    const bits = Uint8Array.from(
      vectors.map((v) => v.reduce((b, x, j) => (x > 0 ? b | (1 << j) : b), 0)),
    );
    const manifest = {
      version: 1,
      model: "m/m",
      dim,
      count: 3,
      bits: "bits.bin",
      rows: "rows.bin",
      ids: "ids.json",
      assetBytes: 100,
      modelPath: "model/",
      vendorPath: "vendor/",
    };
    const imported: string[] = [];
    const env = {
      allowRemoteModels: true,
      allowLocalModels: false,
      localModelPath: "",
      backends: { onnx: { wasm: { wasmPaths: "", numThreads: 4 } } },
    };
    const progress: number[] = [];
    const engine = createSemanticEngine({
      resolvePath: (p) => "http://x.test/" + p,
      fetchImpl: async (url, init) => {
        if (url.endsWith("manifest.json")) return Response.json(manifest);
        if (url.endsWith("ids.json")) return Response.json(["人物/a", "人物/b", "人物/c"]);
        const file = url.endsWith("bits.bin") ? bits : new Uint8Array(rows.buffer);
        const header = (init?.headers as Record<string, string> | undefined)?.Range;
        if (header) {
          const [a, b] = header.replace("bytes=", "").split("-").map(Number) as [number, number];
          return new Response(file.slice(a, b + 1), { status: 206 });
        }
        return new Response(file.slice(), { status: 200 });
      },
      importModule: async (url) => {
        imported.push(url);
        return {
          env,
          pipeline: async (
            _task: string,
            _model: string,
            opts: { progress_callback?: (e: unknown) => void },
          ) => {
            opts.progress_callback?.({ status: "progress", file: "a", loaded: 50, total: 100 });
            return async () => ({ data: Float32Array.from([1, 0, 0, 0, 0, 0, 0, 0]) });
          },
        };
      },
    });
    expect(await engine.prepare((p) => progress.push(p))).toBe(true);
    expect(imported).toEqual(["http://x.test/static/semantic/vendor/transformers.min.js"]);
    expect(env.allowRemoteModels).toBe(false);
    expect(env.localModelPath).toBe("/static/semantic/model/");
    expect(env.backends.onnx.wasm.wasmPaths).toEqual({
      mjs: "http://x.test/static/semantic/vendor/ort-wasm-simd-threaded.mjs",
      wasm: "http://x.test/static/semantic/vendor/ort-wasm-simd-threaded.wasm",
    });
    expect(env.backends.onnx.wasm.numThreads).toBe(1);
    expect(progress).toContain(50);
    expect(progress.at(-1)).toBe(100);
    const hits = await engine.search("q");
    expect(hits?.map((h) => h.slug)).toEqual(["人物/a", "人物/c", "人物/b"]);
    expect(hits?.[0]?.score).toBeCloseTo(1, 1);
    expect(await engine.search("q", () => true)).toBeNull();
  });
});
