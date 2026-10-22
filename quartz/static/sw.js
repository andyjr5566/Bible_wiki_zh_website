// 部署位置：網站根目錄的 sw.js（建置時由 quartz/plugins/emitters/static.ts 從 quartz/static/sw.js 複製）。
// 策略：一律先抓網路（有網路時永遠是最新內容），失敗才用快取；看過的頁面可以離線開啟，沒看過的頁面顯示離線說明。
// 只處理本站網址；Google 登入、雲端硬碟同步、搜尋 API 等其他網域的連線完全不經過這裡。
//
// 緊急撤回：把這個檔案的內容換成下面幾行再部署，所有訪客下次開網站時就會移除 Service Worker 與本站快取
// （只刪 bible-wiki-zh- 開頭的，同一個 github.io 網域下的其他網站不受影響）：
//   self.addEventListener("install", () => self.skipWaiting())
//   self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("bible-wiki-zh-")).map((k) => caches.delete(k)))).then(() => self.registration.unregister())))
const CACHE_NAME = "bible-wiki-zh-v4"
// 快取筆數上限：快取無限增長時，瀏覽器在空間不足會「整個網域」一起清除，
// 連 IndexedDB 裡尚未同步的個人筆記也會被清掉（dev-notes/personal-notes 03 §4.7）。
const MAX_ENTRIES = 400
// 筆數之外再看整個網域實際用了多少空間（含 IndexedDB）：超過就先刪一批最舊的再存
const STORAGE_BUDGET_BYTES = 200 * 1024 * 1024
const OVER_BUDGET_TRIM = 50

// 不快取的大檔（羊皮紙背景約 7–9 MB、互動網站的 3D 模型約 10 MB）：省下訪客的儲存空間
const MAX_CACHE_BYTES = 3 * 1024 * 1024
const NO_CACHE_EXT = /\.(glb|gltf|mp4|webm|mov|zip)$/i

// 以這個檔案所在位置（網站根目錄）為準，網站放在子路徑（GitHub Pages）也正確
const ROOT_URL = new URL("./", self.location).href

const APP_SHELL = [
  ROOT_URL,
  "./static/manifest.json",
  "./static/offline.html",
  "./static/icons/icon-192.png",
  "./static/icons/icon-512.png",
  "./static/icons/apple-touch-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  // 舊版快取刪完才接管已開著的分頁，避免新舊版本的頁面與資源混用。
  // 升級的代價：舊版存的頁面一起清掉，讀者要重新讀過才能離線開啟（B5-1 規格：舊快取要清掉）。
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith("bible-wiki-zh-") && n !== CACHE_NAME)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// 安裝時預先存的項目（首頁、離線頁…）：最早寫入，修剪時不能刪，否則離線頁會在讀滿 400 頁後消失
const APP_SHELL_URLS = new Set(APP_SHELL.map((p) => new URL(p, self.location).href))

// 超過上限時刪除最早寫入的項目（Cache API 的 keys() 依插入順序）
function trimCache(cache) {
  return cache.keys().then((keys) => {
    if (keys.length <= MAX_ENTRIES) return
    const removable = keys.filter((k) => !APP_SHELL_URLS.has(k.url))
    return Promise.all(removable.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)))
  })
}

function cacheable(url, response) {
  if (!response.ok || response.type === "opaque") return false
  if (NO_CACHE_EXT.test(url.pathname)) return false
  const size = Number(response.headers.get("content-length"))
  return !(size > MAX_CACHE_BYTES)
}

// 整個網域用量超過預算時，先刪最舊的一批（不刪預先存的項目）；瀏覽器不支援 storage.estimate 就略過
function trimIfOverBudget(cache) {
  if (!self.navigator.storage || !self.navigator.storage.estimate) return Promise.resolve()
  return self.navigator.storage.estimate().then((est) => {
    if (!(est.usage > STORAGE_BUDGET_BYTES)) return
    return cache.keys().then((keys) => {
      const removable = keys.filter((k) => !APP_SHELL_URLS.has(k.url))
      return Promise.all(removable.slice(0, OVER_BUDGET_TRIM).map((k) => cache.delete(k)))
    })
  })
}

function putAndTrim(request, response) {
  return caches.open(CACHE_NAME).then((cache) =>
    trimIfOverBudget(cache)
      .then(() => cache.put(request, response))
      .then(() => trimCache(cache)),
  )
}

// 有 Content-Length 就直接存；沒有（分段傳輸）時先讀出實際大小，太大就不存
function maybeCache(request, response) {
  if (response.headers.get("content-length")) return putAndTrim(request, response)
  return response.blob().then((blob) => {
    if (blob.size > MAX_CACHE_BYTES) return
    return putAndTrim(
      request,
      new Response(blob, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    )
  })
}

// 只從本版快取讀，不會讀到舊版（或同網域其他程式）留下的副本
function matchCache(request, options) {
  return caches.open(CACHE_NAME).then((cache) => cache.match(request, options))
}

// 有網路：回傳網路的回應，同時存一份。存檔交給 event.waitUntil，回應送出後 SW 也會等它存完；
// 存檔失敗（空間不足等）只是這一頁沒存到，不影響畫面。
function networkFirst(event, url) {
  return fetch(event.request).then((response) => {
    if (cacheable(url, response)) {
      const saving = maybeCache(event.request, response.clone()).catch(() => {})
      // respondWith 還沒結束，所以這裡還能延長事件；萬一瀏覽器不允許，存檔照樣在背景進行
      try {
        event.waitUntil(saving)
      } catch (e) {}
    }
    return response
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
      networkFirst(event, url).catch(() =>
        matchCache(request)
          // 靜態站的查詢字串（?skip=1 等）不會改變頁面內容，所以同一頁不同查詢字串可以共用
          .then((cached) => cached || matchCache(request, { ignoreSearch: true }))
          .then(
            (cached) => cached || matchCache(new URL("./static/offline.html", self.location).href),
          )
          .then((cached) => {
            if (cached) return cached
            return new Response("目前離線，這一頁還沒有存到這台裝置。", {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          }),
      ),
    )
    return
  }

  event.respondWith(networkFirst(event, url).catch(() => matchCache(request)))
})
