// Vercel 不再提供網站（D-43），所有頁面都轉到 GitHub Pages。
// 以前在 Vercel 網址註冊過的 Service Worker 會來這裡檢查更新：這個版本會清掉快取、移除自己，
// 再把開著的分頁重新載入一次，讓訪客被轉到 GitHub Pages 上的網站。
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => Promise.all(clients.map((c) => c.navigate(c.url).catch(() => undefined)))),
  )
})
