// 在 <head> 階段立即執行：依據本機偏好把底色、字級、經文連結樣式寫到 <html> 的屬性，
// 讓畫面第一次繪製時就是讀者選的樣子（不會先閃一下預設外觀）。
import { applyStoredSettings } from "../../lib/settings"

applyStoredSettings()
