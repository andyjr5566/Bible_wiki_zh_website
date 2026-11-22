// 樣稿注入：在正式站的出8 頁面上示範「經文｜研讀」分頁、右欄、來源說明卡、原文標籤、分層卡片。
// 只在無頭 Chrome 裡跑，不改任何專案檔案。
window.__mk = async (opts) => {
  const { tab = "study", step = 1, phone = false, panel = true, popover = null, origOpen = false } = opts
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const mv = $("article .markdown-preview-view")

  const css = `
  .mk-rp,.mk-pop,.mk-bub{box-sizing:border-box}
  .mk-tabs{display:flex;align-items:center;gap:12px;margin:4px 0 20px;position:sticky;top:0;z-index:45;background:rgba(248,241,229,.97);padding:10px 16px 12px;margin-left:-16px;margin-right:-16px;box-shadow:0 6px 10px -8px rgba(60,40,10,.25)}
  .mk-seg{display:inline-flex;border:1.5px solid #7048e8;border-radius:999px;overflow:hidden;background:#fff8}
  .mk-seg button{font:700 17px "Noto Sans TC",sans-serif;padding:7px 24px;background:transparent;color:#7048e8;border:0;display:flex;gap:6px;align-items:center}
  .mk-seg button.on{background:#7048e8;color:#fff}
  .mk-tabs .hint{font-size:14px;color:#6b6257}
  .mk-rp{position:fixed;top:0;right:0;width:292px;height:100vh;background:#fbf8f1;border-left:1px solid #e4dccb;box-shadow:-8px 0 22px rgba(60,40,10,.07);padding:16px 16px 30px;overflow:auto;z-index:60;font-family:"LXGW WenKai TC",serif;color:#2b2622}
  .mk-rp .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  .mk-rp .top b{font:700 17px "Noto Sans TC",sans-serif;color:#3d3456}
  .mk-rp .top button{font:600 13px "Noto Sans TC",sans-serif;border:1px solid #d8cfbd;background:#fff;border-radius:999px;padding:4px 10px;color:#5d5348}
  .mk-rp h4{font:700 14.5px "Noto Sans TC",sans-serif;color:#7048e8;margin:16px 0 6px;letter-spacing:.04em}
  .mk-rp ul{list-style:none;margin:0;padding:0}
  .mk-rp li{font-size:15.5px;line-height:1.45;padding:5px 8px;border-left:3px solid transparent;border-radius:0 6px 6px 0}
  .mk-rp li.sub{padding-left:22px;font-size:14.5px;color:#4d463e}
  .mk-rp li.cur{background:rgba(112,72,232,.09);border-left-color:#7048e8;font-weight:600}
  .mk-rp li small{display:block;color:#6f665b;font-size:13px}
  .mk-rp .src li{padding:6px 8px;border-bottom:1px dotted #e0d6c2}
  .mk-rp .src b{font-weight:600}
  .mk-rp .legend{background:#fff;border:1px solid #e4dccb;border-radius:10px;padding:8px 10px;font-size:14px;line-height:1.55}
  .mk-rp .legend div{display:flex;gap:8px;align-items:baseline}
  .mk-key{display:inline-block;min-width:42px;text-align:center;font:700 12px "Noto Sans TC",sans-serif;border-radius:999px;padding:1px 6px;color:#fff}
  .mk-src{color:#5b4a8a;border-bottom:1.5px dotted #8a7bb8;cursor:pointer}
  .mk-orig{display:inline-block;font:700 12px "Noto Sans TC",sans-serif;color:#1f5e78;background:#e3f0f5;border:1px solid #9cc5d6;border-radius:999px;padding:0 8px;margin:0 3px;vertical-align:.18em;line-height:20px;cursor:pointer}
  .mk-orig.open{background:#1f5e78;color:#fff}
  .mk-bub{position:absolute;z-index:70;background:#fff;border:1px solid #9cc5d6;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:10px 14px;font-size:15px;line-height:1.6;width:330px;color:#222}
  .mk-bub .heb{font-family:"SBL Hebrew","Ezra SIL","Times New Roman",serif;font-size:20px;direction:rtl;display:block;text-align:right;color:#1f5e78}
  .mk-bub small{color:#6f665b}
  .mk-pop{position:absolute;z-index:70;width:330px;background:#fff;border:1px solid #cbbfe6;border-radius:12px;box-shadow:0 10px 28px rgba(40,20,80,.16);padding:12px 14px;font-size:15px;line-height:1.6;color:#2b2622}
  .mk-pop .h{font:700 16px "Noto Sans TC",sans-serif;color:#3d3456;margin-bottom:4px}
  .mk-pop .f{margin-top:8px;padding-top:6px;border-top:1px dotted #ddd;font-size:13.5px;color:#7048e8;display:flex;justify-content:space-between}
  .mk-scr{color:#7a3e12}
  .mk-v{font:600 12px "Noto Sans TC",sans-serif;color:#7a3e12;background:#f6e7d6;border-radius:999px;padding:0 6px;margin-left:2px;vertical-align:.15em}
  .mk-card{border:1px solid var(--c);border-left:5px solid var(--c);border-radius:10px;margin:14px 0;background:var(--bg)}
  .mk-card .h{display:flex;align-items:center;gap:10px;padding:9px 14px;font:700 16.5px "Noto Sans TC",sans-serif;color:#2b2622}
  .mk-card .h .k{font-size:12.5px;color:#fff;background:var(--c);border-radius:999px;padding:1px 9px}
  .mk-card .h .s{font:400 14.5px "LXGW WenKai TC",serif;color:#5d5348}
  .mk-card .h .ch{margin-left:auto;color:var(--c);font-size:15px}
  .mk-card .b{padding:0 18px 8px}
  .mk-card .b p{margin:.3em 0 .7em}
  .mk-card.orig{--c:#1f5e78;--bg:#f2f8fa}
  .mk-card.bg{--c:#946414;--bg:#fbf5e8}
  .mk-card.app{--c:#3f7a52;--bg:#f2f8f1}
  .mk-q{font:700 19px "Noto Sans TC",sans-serif !important;color:#3d3456 !important;margin:26px 0 6px !important}
  .mk-q::before{content:"？";display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:#efe9fb;color:#7048e8;font-size:14px;margin-right:8px;vertical-align:2px}
  .mk-seg-sm button{font-size:14px;padding:4px 12px}
  .mk-phone-toc{margin-left:auto;font:700 14px "Noto Sans TC",sans-serif;border:1px solid #d8cfbd;background:#fff;border-radius:999px;padding:6px 12px;color:#4d463e}
  `
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st)

  // 去掉首訪提示、浮動按鈕等干擾
  $$(".bwz-tour, .wiki-tour, [class*='tour-card'], .bwz-pwa, [class*='pwa']").forEach((e) => (e.style.display = "none"))

  // 收合左欄（iPad 打開右欄時讓出空間）
  if (!phone && panel) {
    const t = $(".bwz-sidebar-toggle")
    if (t && t.getAttribute("aria-expanded") === "true") t.click()
    await new Promise((r) => setTimeout(r, 900))
    document.body.style.width = (innerWidth - 292) + "px"
    document.body.style.overflowX = "clip"
    window.__mkdbg = JSON.stringify(["#quartz-body", ".center", "article", ".sidebar.left", ".page-header"].map((s) => { const e = $(s); if (!e) return s + " none"; const r = e.getBoundingClientRect(); return s + " " + Math.round(r.left) + "-" + Math.round(r.right) + " gtc=" + getComputedStyle(e).gridTemplateColumns }))
  }

  // ── 分頁 ──
  const tabs = document.createElement("div")
  tabs.className = "mk-tabs"
  tabs.innerHTML = `<div class="mk-seg"><button class="${tab === "text" ? "on" : ""}">📖 經文</button><button class="${tab === "study" ? "on" : ""}">🔍 研讀</button></div>` +
    (phone ? `<button class="mk-phone-toc">☰ 目錄</button>` : `<span class="hint">${tab === "text" ? "只看經文；按「研讀」直接看本章整理，不用往下滑" : "本章整理與知識節點；按「經文」回到經文"}</span>`)
  const h1 = $("h1", mv)
  const navTable = h1.nextElementSibling
  if (!phone) navTable.after(tabs)

  const verses = $(".bwz-verses", mv), ra = $(".bwz-ra", mv)
  const study = $$(".bwz-ux-hide", mv)
  if (tab === "study") {
    verses && (verses.style.display = "none"); ra && (ra.style.display = "none")
    $$("hr.bwz-ux-hide", mv).forEach((e) => (e.style.display = "none"))
  } else {
    study.forEach((e) => (e.style.display = "none"))
  }

  // ── 第一步：網站自動處理（來源名可點、原文括號收成標籤） ──
  const SRC = /(CT|GT|KC|BH|丁良才|李道生|艾基斯|《(?:啟導本|精讀本|丁道爾|中文聖經註釋|舊約背景註釋|舊約聖經背景註釋|串珠|每日研經叢書|雷氏研讀本)》)/g
  const ORIG = /（[^（）]*?(?:[֐-׿]|\b[HG]\d{3,4})[^（）]*?）/g
  function walk(root, fn) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement.closest("a,.mk-card .h,h1,h2,h3,h4,pre,.mermaid,table")) nodes.push(n)
    nodes.forEach(fn)
  }
  // Strong 編號在頁面上是 span.strong-no，所以原文括號要在段落的 HTML 上比對
  const ORIGH = /（[^（）]*?(?:[֐-׿]|strong-no)[^（）]*?）/g
  const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/"/g, "")
  function enhance(root) {
    $$("p, li", root).forEach((el) => {
      if (el.closest(".bwz-verses")) return
      if (ORIGH.test(el.innerHTML)) {
        ORIGH.lastIndex = 0
        el.innerHTML = el.innerHTML.replace(ORIGH, (m) => `<span class="mk-orig" data-o="${strip(m.slice(1, -1))}">原文</span>`)
      }
      ORIGH.lastIndex = 0
    })
    walk(root, (n) => {
      const t = n.data
      SRC.lastIndex = 0
      if (!SRC.test(t)) return
      SRC.lastIndex = 0
      const html = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(SRC, (m) => `<span class="mk-src">${m}</span>`)
      const span = document.createElement("span"); span.innerHTML = html; n.replaceWith(...span.childNodes)
    })
  }

  // ── 第二步：內容改寫後的蛙災段（示範） ──
  if (step === 2) {
    const h3 = document.getElementById("一蛙災1-15節")
    const stop = document.getElementById("法老第一次求代禱8-14節")
    for (let e = h3.nextElementSibling; e && e !== stop; ) { const nx = e.nextElementSibling; e.remove(); e = nx }
    const scr = (t, v) => `<span class="mk-scr">「${t}」</span><span class="mk-v">${v}</span>`
    const S = (t) => `<span class="mk-src">${t}</span>`
    const card = (cls, k, title, sum, body, open) =>
      `<div class="mk-card ${cls}"><div class="h"><span class="k">${k}</span>${title}<span class="s">${open ? "" : sum}</span><span class="ch">${open ? "收起 ▴" : "展開 ▾"}</span></div>${open ? `<div class="b">${body}</div>` : ""}</div>`
    const html = `
<p>耶和華再差摩西去見法老：${scr("容我的百姓去，好事奉我", "1節")}法老若不肯，${scr("我必使青蛙糟蹋你的四境", "2節")}——青蛙要從河裡上來，進宮殿、臥房、床榻，連${scr("你的爐灶和你的摶麵盆", "3節")}也不放過。亞倫伸杖，${scr("青蛙就上來，遮滿了埃及地", "6節")}</p>
<h4 class="mk-q">青蛙不咬人，為什麼算是災？</h4>
<p>在全部十災中，蛙災可能是最不恐怖的：青蛙不會咬人，也不使人懼怕，卻是使人最討厭的——滿眼是跳來跳去的青蛙，滿耳是蛙叫，滿鼻是腥臭（${S("《中文聖經註釋》")}）。宮殿、臥房、摶麵盆是埃及人看作最清潔的地方，如今被他們自己視為聖物的青蛙弄髒了（${S("《精讀本》")}）。</p>
${card("orig", "原文", "「糟蹋」這個字", "na.gaph：舊約裡施行這個動作的惟獨是神", `<p>「糟蹋」的原文是 <span style="font-family:'Times New Roman',serif;font-size:1.15em">נָגַף</span>（na.gaph），在賽19:22 譯作「擊打」，在出12:13,23 譯作「擊殺」；舊約用這個字時，施行動作的惟獨是神（${S("《中文聖經註釋》")}）。</p><p style="font-size:14px;color:#6f665b">出處：STEP Bible（CC BY 4.0）</p>`, origOpen)}
<h4 class="mk-q">為什麼偏偏是青蛙？</h4>
<p>古代埃及人視青蛙為神聖，把牠和生育女神連在一起（${S("黃迦勒")}、${S("《啟導本》")}）。${S("丁良才")}說青蛙是掌管生育的女神的標號，<span>「因此埃及人不敢殺害青蛙。」</span>${S("KingComments")} 說，這些受尊敬的偶像，如今在神審判的手下成了一場災。</p>
<p>${S("《舊約背景註釋》")}認為很難把這一災說成是女神被擊敗；比較直接的原因是第一災之後，水中和河邊滿是腐魚，把青蛙趕上了岸。</p>
${card("bg", "背景", "埃及的蛙神與埃及人的潔淨", "", `<p>女神赫克特（Heqet）是青蛙的形狀，司助產（${S("《舊約背景註釋》")}）；《啟導本》稱賜子女神赫克蒂是青蛙的化身，《精讀本》提到蛙頭女神。</p><p>古時候好潔淨的人中當推埃及人為首：祭司穿細麻布衣服，按古時的史家所記，白日兩次、黑夜兩次用涼水沐浴全身（${S("丁良才")}）。</p>`, true)}
${card("app", "應用", "屬靈的讀法", "KingComments：青蛙進了摶麵盆，污穢混進了食物", "", false)}
<h4 class="mk-q">行法術的為什麼也叫青蛙上來？</h4>
<p>經文說${scr("行法術的也用他們的邪術照樣而行，叫青蛙上了埃及地", "7節")}他們${`<span>「不但沒有除滅災禍，反而使境況更惡化。」</span>`}（${S("《串珠》")}）到處都是青蛙的時候，法老該叫行法術的把青蛙消滅或驅除，卻叫他們照樣而行，使災害更嚴重（${S("《中文聖經註釋》")}）。</p>
<p>${S("艾基斯")}認為這不是說行法術的也能生出青蛙：他們的方法可能和今天的魔術師一樣，引出的青蛙在數量上遠比摩西所造成的少，可能是預先預備的。</p>`
    h3.insertAdjacentHTML("afterend", html)
  } else {
    enhance(mv)
  }

  // ── 右欄 ──
  if (panel) {
    const rp = document.createElement("aside")
    rp.className = "mk-rp"
    const tocStudy = `
      <li class="${step === 2 ? "" : "cur"}">一、蛙災（1–15節）</li>
      ${step === 2 ? `<li class="sub cur">青蛙不咬人，為什麼算是災？</li><li class="sub">為什麼偏偏是青蛙？</li><li class="sub">行法術的為什麼也叫青蛙上來？</li>` : ""}
      <li class="sub">法老第一次求代禱（8–14節）</li>
      <li>二、蝨災（16–19節）</li>
      <li>三、蠅災（20–32節）</li>
      <li class="sub">法老的第一、二次妥協（25–28節）</li>
      <li>頭四災的屬靈對照</li>`
    const tocText = `
      <li class="cur">1–15節　第二災：蛙災<small>研讀這段 →</small></li>
      <li>16–19節　第三災：蝨災<small>研讀這段 →</small></li>
      <li>20–32節　第四災：蠅災<small>研讀這段 →</small></li>`
    rp.innerHTML = `
      <div class="top"><b>本章導覽</b><button>收起 ›</button></div>
      ${step === 2 && tab === "study" ? `<div class="legend">
        <div><span class="mk-key" style="background:#7a3e12">經文</span>褐色字＝聖經原句，後面是節數</div>
        <div><span class="mk-key" style="background:#5b4a8a">出處</span>點虛線名字，看是哪本註釋</div>
        <div><span class="mk-key" style="background:#1f5e78">原文</span><span class="mk-key" style="background:#946414">背景</span><span class="mk-key" style="background:#3f7a52">應用</span></div>
        <div style="padding-left:2px">想深入再點開</div></div>` : ""}
      <h4>本章目錄</h4><ul>${tab === "study" ? tocStudy : tocText}</ul>
      <h4>本章引用的資料</h4><ul class="src">
        <li><b>黃迦勒</b>《出埃及記註解》<small>逐節註解，附〔話中之光〕</small></li>
        <li><b>拾穗</b><small>丁良才、《啟導本》、《精讀本》、《丁道爾》、《中文聖經註釋》、《串珠》、《舊約背景註釋》等</small></li>
        <li><b>KingComments</b><small>英文研經註解</small></li>
        <li><b>BibleHub</b><small>英文研讀本</small></li>
        <li><b>STEP Bible</b><small>希伯來原文資料（CC BY 4.0）</small></li></ul>
      <h4>相關資源</h4><ul>
        <li>本章知識節點　18 個</li>
        <li>地圖〈出圖一〉摩西的早年</li>
        <li>全部資料來源說明 →</li></ul>`
    document.body.appendChild(rp)
  }

  // ── 狀態：捲動位置、展開的說明卡 ──
  if (tab === "study") {
    const h3 = document.getElementById("一蛙災1-15節")
    window.scrollTo(0, h3.getBoundingClientRect().top + scrollY - (phone ? 140 : 90))
  } else {
    window.scrollTo(0, verses.getBoundingClientRect().top + scrollY - 260)
  }
  if (phone) {
    // 手機：分頁放進章節快捷列，取代原本的「本章整理」連結（快捷列捲動後才出現）
    await new Promise((r) => setTimeout(r, 800))
    const bar = $$("a, button, span").filter((e) => e.textContent.trim() === "本章整理" && e.getBoundingClientRect().top < 300 && e.getBoundingClientRect().height > 0).pop()
    const seg = document.createElement("div"); seg.className = "mk-seg mk-seg-sm"
    seg.innerHTML = `<button class="${tab === "text" ? "on" : ""}">經文</button><button class="${tab === "study" ? "on" : ""}">研讀</button>`
    if (bar) bar.replaceWith(seg)
    window.__mkdbg = "bar=" + !!bar
  }
  const place = (el, anchor, dx = 0, dy = 8) => {
    const r = anchor.getBoundingClientRect()
    el.style.left = Math.max(8, Math.min(r.left + scrollX + dx, document.documentElement.clientWidth - 340 - (panel && !phone ? 292 : 0))) + "px"
    el.style.top = r.bottom + scrollY + dy + "px"
    document.body.appendChild(el)
  }
  if (popover) {
    const a = $$(".mk-src", mv).find((e) => e.textContent === popover.name)
    if (a) {
      const p = document.createElement("div"); p.className = "mk-pop"
      p.innerHTML = popover.html
      place(p, a, -20)
    }
  }
  if (opts.bubble) {
    const chips = $$(".mk-orig", mv)
    const c = chips[opts.bubble.index || 0]
    if (c) {
      c.classList.add("open")
      const b = document.createElement("div"); b.className = "mk-bub"
      const o = c.dataset.o
      const heb = (o.match(/[֐-׿][֐-׿\s־]*/g) || []).join(" ")
      const rest = o.replace(/[֐-׿][֐-׿\s־]*/g, "").replace(/^，|，$/g, "")
      b.innerHTML = `<span class="heb">${heb}</span><div>${rest}</div><small>出處：STEP Bible（CC BY 4.0）· 點字號看詞典</small>`
      place(b, c, -150)
    }
  }
  return JSON.stringify({ dbg: window.__mkdbg, ok: true, chips: $$(".mk-orig", mv).length, srcs: $$(".mk-src", mv).length })
}
