// 在 <head> 階段立即執行：依據本機偏好把底色、字級、字體和經文連結樣式寫到 <html> 的屬性，
// 讓畫面第一次繪製時就是讀者選的樣子（不會先閃一下預設外觀）。
// 閱讀分頁（經文｜研讀）也在這裡套用：全站共用一個 localStorage 值，首次造訪預設為「研讀」。
import { applyStoredSettings } from "../../lib/settings"
import { syncReadingFont } from "../../lib/readingFont"
import { applyStoredView } from "../../lib/readingView"

syncReadingFont(applyStoredSettings().fontFamily)
applyStoredView()
