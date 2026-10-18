// 部署位置：網站根目錄的 sw.js（建置時由 quartz/plugins/emitters/static.ts 從 quartz/static/sw.js 複製）。
// 策略：一律先抓網路（有網路時永遠是最新內容），失敗才用快取 → 看過的頁面可以離線開啟。
// 只處理本站網址；Google 登入、雲端硬碟同步、搜尋 API 等其他網域的連線完全不經過這裡。
//
// 緊急撤回：把這個檔案的內容換成下面幾行再部署，所有訪客下次開網站時就會移除 Service Worker 與快取：
//   self.addEventListener("install", () => self.skipWaiting())
//   self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).then(() => self.registration.unregister())))
const CACHE_NAME = "bible-wiki-zh-v3"
// 快取筆數上限：快取無限增長時，瀏覽器在空間不足會「整個網域」一起清除，
// 連 IndexedDB 裡尚未同步的個人筆記也會被清掉（dev-notes/personal-notes 03 §4.7）。
const MAX_ENTRIES = 400

// 不快取的大檔（羊皮紙背景約 7–9 MB、互動網站的 3D 模型約 10 MB）：省下訪客的儲存空間
const MAX_CACHE_BYTES = 3 * 1024 * 1024
const NO_CACHE_EXT = /\.(glb|gltf|mp4|webm|mov|zip)$/i

// 以這個檔案所在位置（網站根目錄）為準，網站放在子路徑（GitHub Pages）也正確
const ROOT_URL = new URL("./", self.location).href

const APP_SHELL = [
  ROOT_URL,
  "./static/manifest.json",
  "./static/icons/icon-192.png",
  "./static/icons/icon-512.png",
  "./static/icons/apple-touch-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))),
  )
  self.clients.claim()
})

// 超過上限時刪除最早寫入的項目（Cache API 的 keys() 依插入順序）
function trimCache(cache) {
  return cache.keys().then((keys) => {
    if (keys.length <= MAX_ENTRIES) return
    return Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)))
  })
}

function cacheable(url, response) {
  if (!response.ok || response.type === "opaque") return false
  if (NO_CACHE_EXT.test(url.pathname)) return false
  const size = Number(response.headers.get("content-length"))
  return !(size > MAX_CACHE_BYTES)
}

function putAndTrim(request, response) {
  return caches.open(CACHE_NAME).then((cache) => cache.put(request, response).then(() => trimCache(cache)))
}

// 有 Content-Length 就直接存；沒有（分段傳輸）時先讀出實際大小，太大就不存
function maybeCache(request, response) {
  if (response.headers.get("content-length")) return putAndTrim(request, response)
  return response.blob().then((blob) => {
    if (blob.size > MAX_CACHE_BYTES) return
    return putAndTrim(request, new Response(blob, { status: response.status, statusText: response.statusText, headers: response.headers }))
  })
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // 個人筆記的設定檔（含緊急開關）一律走網路、不快取
  if (url.pathname.endsWith("/static/personal-notes/config.json")) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable(url, response)) maybeCache(request, response.clone())
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(ROOT_URL))),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (cacheable(url, response)) maybeCache(request, response.clone())
        return response
      })
      .catch(() => caches.match(request)),
  )
})
