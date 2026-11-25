// manifest 欄位與意義見 dev-notes/semantic-search/README.md「檔案格式」。
export const MODEL_ID = "Xenova/bge-small-zh-v1.5"

export function buildManifest({ count, bits, rows, ids, assetBytes, model = MODEL_ID, dim = 512 }) {
  return {
    version: 1,
    model,
    dim,
    count,
    bits,
    rows,
    ids,
    assetBytes,
    modelPath: "model/",
    vendorPath: "vendor/",
  }
}
