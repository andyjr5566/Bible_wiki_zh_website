// 在 <head> 階段立即執行：先依閱讀紀錄決定首頁區塊的順序（寫在 <html> 的屬性上），
// 讓第一次繪製就是對的順序，不會先畫導覽卡在上、再跳成入口在上。
import { applyReadingOrder } from "../../lib/readingOrder"

applyReadingOrder()
