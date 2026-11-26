// 章節頁的測試用 DOM（結構照實際建置出來的章節頁：標題、前後章表格、經文清單、相關地圖、三個要藏的區塊、頁尾表格）
export function chapterDocument(slug = "02-出埃及記/第12章", extra = ""): Document {
  const doc = document.implementation.createHTMLDocument("測試")
  doc.body.dataset.slug = slug
  doc.body.innerHTML = `
    <article class="popover-hint"><div class="markdown-preview-view">
      <h1 id="t">出埃及記 第12章</h1>
      <div class="table-container"><table><tr><td><a href="x">前一章</a></td><td><a href="y">下一章</a></td></tr></table></div>
      <ol start="3"><li id="a"><a class="internal" href="/安息">甲</a></li><li id="b">乙</li><li id="c">丙</li></ol>
      <h2 id="map">相關地圖</h2><ul><li><a class="internal" href="/m">地圖</a></li></ul>
      <hr>
      <h2 id="nodes">本章知識節點</h2><h3 id="n1">神學</h3><ul><li><a class="internal" href="/n">節點</a></li></ul>
      <hr>
      <h2 id="study">本章整理</h2>
      <p id="p0"><a class="internal" href="/s0">開頭的連結</a></p>
      <h3 id="s1">一、安息</h3><p id="p1"><a class="internal" href="/s1">整理連結</a></p>
      <h3 id="s2">二、人</h3><p id="p2"><a class="internal" href="/s2">另一段</a></p>
      <hr>
      <h2 id="app">附錄</h2><p>附錄內容</p>
      <div class="table-container"><table><tr><td>前一章</td><td>下一章</td></tr></table></div>
      ${extra}
    </div></article>`
  return doc
}
