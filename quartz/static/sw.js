const CACHE_NAME = "bible-wiki-zh-v2"
// 快取筆數上限：快取無限增長時，瀏覽器在空間不足會「整個網域」一起清除，
// 連 IndexedDB 裡尚未同步的個人筆記也會被清掉（dev-notes/personal-notes 03 §4.7）。
const MAX_ENTRIES = 400

// Resolved relative to this script's own location so caching still works
// when the site is deployed under a subpath (e.g. GitHub Pages).
const ROOT_URL = new URL("../", self.location).href

const APP_SHELL = [
  ROOT_URL,
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
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

function putAndTrim(request, response) {
  return caches.open(CACHE_NAME).then((cache) => cache.put(request, response).then(() => trimCache(cache)))
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
          const clone = response.clone()
          putAndTrim(request, clone)
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(ROOT_URL))),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          putAndTrim(request, clone)
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})
