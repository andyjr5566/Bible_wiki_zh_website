// pureMode.inline.ts
// 聖經研讀知識庫 - 素色黑白 / 古典紙質底色：在 <head> 階段立即套用本機偏好，杜絕畫面閃爍。
// 切換按鈕已移到「Aa 外觀」面板（plugins/site-ux）；這裡保留儲存的 key（localStorage "theme-bg"）
// 與屬性（<html data-bg="pure">），已選過素色的讀者不用重新設定。
;(function () {
  try {
    const saved = localStorage.getItem("theme-bg")
    if (saved === "pure") {
      document.documentElement.setAttribute("data-bg", "pure")
    }
  } catch {}
})()
