"""把候選配樂依各幕整理成一頁可以直接聽的清單：collect/audio/bgm-more/聽歌清單.html（本機用，不進版控）。"""
from __future__ import annotations
import html, json, re, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "collect" / "audio" / "bgm-more"
CLIPS = BASE / "clips"
INDEX = {r["slug"]: r for r in json.loads((BASE / "index.json").read_text(encoding="utf-8"))}

# 現用的五首（成品檔在 src/assets/music），剪 80 秒當試聽
CURRENT = {
    "ruins": ("Ruins of an Ancient Culture", "https://opengameart.org/content/ruins-of-an-ancient-culture", "低沉、很輕的氛圍，不搶說書"),
    "plains": ("Sunset Plains", "https://opengameart.org/content/sunset-plains", "溫暖、慢，像走在路上"),
    "laments": ("Laments of the War", "https://opengameart.org/content/laments-of-the-war", "合唱加鼓，高亢史詩"),
    "choir": ("Fantasy Choir 2", "https://opengameart.org/content/fantasy-choir-3-orchestral-pieces", "緩慢的合唱，張力往上"),
    "hope": ("The Hope", "https://opengameart.org/content/the-hope", "悲而不絕望"),
}

# (編號, 標題, 這一段要什麼, [(slug 或 'cur:xxx', 一句話)])
GROUPS = [
    ("g1", "序幕＋第一幕　聚集在示劍", "清晨的山谷，人群陸續走進來。說書的聲音是主角，音樂要退後、古老、安靜。", [
        ("cur:ruins", ""),
        ("predynastic-dawn", "古文明的氛圍，起伏很小，穩。"),
        ("ancient-mysteries", "神祕的旋律，作者說可無縫循環。"),
        ("contemplation-0", "純氛圍、沒有旋律，最不會搶說書；可能太空。"),
        ("first-light-particles", "安靜的鋼琴加氛圍，作者標明是給劇情探索場景用。"),
        ("strange-sanctuary", "憂鬱的小調，起伏小。"),
        ("sunrise-over-water", "日出水面的氣氛，偏明亮。"),
        ("rise-of-the-early-dawn", "日出、鼓舞人的氣氛，起伏大；可能太亮、太有進行感。"),
        ("ancient-temple-1", "廢墟神殿的聲音，起伏大。"),
    ]),
    ("g2a", "第二幕（平靜段）　大河那邊、亞伯拉罕", "第 2–4 節：渡過大河、走進迦南，慢慢走路的感覺。", [
        ("cur:plains", ""),
        ("caught-in-the-desert-plains", "沙漠平原，加了風聲，很輕很空曠。"),
        ("desert-settlement", "吉他為主，沙漠聚落；曲子長。"),
        ("desert-theme", "極簡的沙漠背景，幾乎不動。"),
        ("the-road-we-use-to-travel-when-we-were-kids", "旅行的主題，作者標明是童年與旅途；偏溫暖。"),
        ("beautiful-forest-orchestra", "管弦樂，安靜優美，偏森林感。"),
        ("northumberland", "蘇格蘭古民謠翻奏，旋律好聽但歐洲味重。"),
        ("medieval-exploration", "中世紀探索曲，歐洲味重。"),
        ("etirwer", "氛圍循環曲，起伏很小。"),
    ]),
    ("g2b", "第二幕（史詩段）　埃及、紅海、河東、耶利哥", "第 5–12 節：十災、過紅海、曠野、爭戰。全站最高亢的一段。", [
        ("cur:laments", ""),
        ("ancient-power-of-serpents", "Kevin MacLeod 作，慢而沉的電影感，適合埃及與十災。"),
        ("epic-endgame-cinematic", "女聲、號角與低音，戲劇性強。"),
        ("a-legend-will-rise-orchestral", "小型管弦樂，只有約一分鐘。"),
        ("determined-pursuit-epic-orchestra-loop", "急促的弦樂與鼓，作者標明是追逐／戰鬥，適合追兵那一拍。"),
        ("qazijamjam-orchestral-battle-theme", "四分鐘管弦戰鬥曲，會循環變化。"),
        ("unexplored-expansion", "管弦探索曲，偏壯闊。"),
        ("fall-of-nightmares-epic-orchestral", "管弦加人聲，起伏大。"),
        ("osiris-monolith", "古文明巨石的感覺，合成器三和弦，偏電子。"),
        ("the-call-for-unity", "電子樂，偏現代。"),
    ]),
    ("g3", "第三幕　現在", "第 14–15 節：約書亞說「現在你們要敬畏耶和華」，等人做選擇。要有等待與重量，不能太悲或太亮。", [
        ("cur:plains", "與第二幕平靜段同一首。"),
        ("waiting-ii", "名字就是『等待』，起伏中等。"),
        ("original-hymn", "一首簡單的聖詠風格旋律。"),
        ("judge-jury", "電影底樂，作者標明是 underscore（給對話墊底）。"),
        ("destiny-formation", "很慢的琶音加弦樂，甜中帶憂。"),
        ("relics-of-past", "給神殿或聖地用的古典風小品。"),
        ("unsolved-investigation", "暗而神祕，作者說是設計成不蓋過對白。"),
    ]),
    ("g4", "第四幕　四個來回", "第 16–24 節：人群回答，聲浪推高。第 19 節「你們不能事奉耶和華」整個靜音，所以要的是能往上堆的張力。", [
        ("cur:choir", ""),
        ("zodik-deep-choir", "低沉的合唱。"),
        ("cathedral-0", "教堂般的情感曲，較輕。"),
        ("interweave", "Snabisch 的管弦，起伏大。"),
        ("a-fallen-dawn", "作者形容『悲傷又帶凱旋』。"),
        ("tension-and-distress", "作者標明給緊張與不安的場面，幾乎沒有起伏，適合墊底。"),
        ("doom-in-the-morning", "電影開場感，低音提琴加合唱取樣，偏突襲。"),
        ("soul-rebellion", "合唱放進動作曲，偏激烈。"),
        ("tension", "專輯 It's time for adventure 2 裡的一首；起伏大。"),
        ("heavenly-loop", "天上感的循環，只有 34 秒，很淡。"),
    ]),
    ("g5", "第五幕　寫下，立起", "第 25–28 節：寫在律法書上、立石、人群散去。莊重、安靜。", [
        ("cur:ruins", "與序幕同一首。"),
        ("shrine", "神祕的短曲，作者說是 mysterious 風。"),
        ("original-hymn", "簡單的聖詠風格。"),
        ("prelude-in-f-minor", "安靜的前奏曲，旋律清楚。"),
        ("cathedral-0", "教堂般的情感曲。"),
        ("into-the-ruined-temple", "受 Disasterpeace 啟發的小曲，廢墟感。"),
        ("first-light-particles", "安靜的鋼琴加氛圍。"),
        ("sacred-springs-music-loop", "電鋼琴的『輕鬆又重要』，只有 25 秒的循環。"),
        ("piano-melody-solo-17", "單純的鋼琴獨奏，很輕。"),
    ]),
    ("g6", "第六幕＋終幕　這些事以後", "第 29–33 節與士師記：約書亞離世、爺爺不再出現、棺木下葬。日月繞圈，悲而不絕望。", [
        ("cur:hope", ""),
        ("sad-scene-music-what-is-left", "作者標明給悲傷場景用，曲名『剩下的』。"),
        ("fantasy-lament-for-a-warriors-soul", "悲傷的奇幻曲，起伏大。"),
        ("long-winter", "冬天般的氛圍，悲傷而平靜。"),
        ("dreamlike-state", "夢般的氛圍，起伏大。"),
        ("snowfall", "雪的氛圍。"),
        ("small-things", "作者標明給憂鬱時刻的背景曲。"),
        ("the-sad-battle", "作者說是疲憊失敗的戰士在最後。"),
        ("dreaming-of-you", "專輯 It's time for adventure 2 裡的一首。"),
        ("lonely-ali", "孤獨與勉勵；作者自稱是初學者。"),
        ("emotional-piano-loop", "鋼琴循環，只有 28 秒。"),
    ]),
]


def author_of(slug: str) -> str:
    try:
        s = urllib.request.urlopen(urllib.request.Request(f"https://opengameart.org/content/{slug}", headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "ignore")
        m = re.search(r'field-name-author-submitter.*?href="/users/[^"]+"[^>]*>([^<]+)', s, re.S)
        return html.unescape(m.group(1)).strip() if m else ""
    except Exception:
        return ""


def make_current_clips() -> None:
    for key in CURRENT:
        out = CLIPS / f"_current_{key}.mp3"
        if not out.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-t", "80", "-i", str(ROOT / "src" / "assets" / "music" / f"{key}.mp3"),
                            "-c:a", "libmp3lame", "-b:a", "96k", str(out)], check=True)


def mmss(sec: float) -> str:
    return f"{int(sec // 60)}:{int(sec % 60):02d}"


def dyn(lra: float) -> str:
    return "起伏很小" if lra < 3 else "起伏中等" if lra < 7 else "起伏大"


CSS = """
:root{--bg:#17150f;--fg:#ebe3d2;--mut:#a89f8c;--card:#221f17;--line:#3a3527;--gold:#e0aa4c}
@media (prefers-color-scheme:light){:root{--bg:#f3ecdc;--fg:#1e1b16;--mut:#6b6455;--card:#fffaf0;--line:#d6cbb0;--gold:#9a6a12}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.7 "Noto Sans TC",system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:20px 16px 120px}
h1{font-size:1.5rem;margin:.3em 0} h2{margin:2em 0 .2em;font-size:1.2rem;border-left:4px solid var(--gold);padding-left:10px}
.lead,.need{color:var(--mut);margin:.2em 0 1em} nav{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
nav a{color:var(--gold);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:2px 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}
.card{display:flex;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;cursor:pointer}
.card.cur{border-color:var(--gold)} .card:has(input:checked){outline:2px solid var(--gold)}
.card input{margin-top:6px} .body{flex:1;min-width:0} .t{font-weight:700}
.by{font-weight:400;color:var(--mut);margin-left:8px;font-size:.85rem}
.m{color:var(--mut);font-size:.82rem} .n{margin:.3em 0} audio{width:100%;margin:.3em 0} a{font-size:.82rem;color:var(--gold)}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
button{background:var(--gold);color:#17150f;border:0;border-radius:8px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer}
#out{flex:1;min-width:200px;color:var(--mut);font-size:.85rem;white-space:pre-line}
"""

JS = """
const KEY='jos24-bgm-picks', GROUPS=__GROUPS__;
let saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
document.querySelectorAll('input[type=radio]').forEach(r=>{ if(saved[r.name]===r.value) r.checked=true; r.addEventListener('change',update); });
document.addEventListener('play',e=>{ document.querySelectorAll('audio').forEach(a=>{ if(a!==e.target) a.pause(); }); },true);
function picks(){ const o={}; document.querySelectorAll('input[type=radio]:checked').forEach(r=>o[r.name]=r.value); return o; }
function text(){ const p=picks(); return GROUPS.map(([id,t])=>t+'：'+(p[id]?p[id].split('｜')[0]:'（沒選）')).join('\\n'); }
function update(){ try{localStorage.setItem(KEY,JSON.stringify(picks()))}catch(e){} document.getElementById('out').textContent='已選 '+Object.keys(picks()).length+' / '+GROUPS.length+'（按左邊的按鈕複製成文字，貼給我）'; }
document.getElementById('copy').onclick=async()=>{ update(); const b=document.getElementById('copy'); try{ await navigator.clipboard.writeText(text()); b.textContent='已複製'; }catch(e){ b.textContent='請自己複製下面的文字'; } };
update();
"""


def main() -> None:
    make_current_clips()
    slugs = sorted({s for _, _, _, items in GROUPS for s, _ in items if not s.startswith("cur:")})
    with ThreadPoolExecutor(6) as ex:
        authors = dict(zip(slugs, ex.map(author_of, slugs)))
    sections, n = [], 0
    for gid, title, need, items in GROUPS:
        cards = []
        for slug, note in items:
            n += 1
            if slug.startswith("cur:"):
                key = slug[4:]
                name, url, tone = CURRENT[key]
                meta, clip, author, cur = f"現用　{tone}", f"_current_{key}.mp3", "", True
            else:
                r = next(v for k, v in INDEX.items() if k == slug or k.startswith(slug))
                name = re.sub(r"\s*\|.*$", "", r["title"]).strip()
                url, clip, author, cur = r["url"], r["clip"], authors.get(slug, ""), False
                meta = f"原曲 {mmss(r['duration'])}　{dyn(r['lra'])}　試聽段取自第 {mmss(r['clipStart'])} 起的 {int(r['clipLen'])} 秒"
            cards.append(
                f'<label class="card{" cur" if cur else ""}"><input type="radio" name="{gid}" value="{html.escape(name)}｜{slug}">'
                f'<div class="body"><div class="t">{"★ " if cur else ""}{html.escape(name)}<span class="by">{html.escape(author)}</span></div>'
                f'<div class="m">{html.escape(meta)}</div>' + (f'<div class="n">{html.escape(note)}</div>' if note else '') +
                f'<audio controls preload="none" src="clips/{html.escape(clip)}"></audio>'
                f'<a href="{html.escape(url)}" target="_blank" rel="noopener">OpenGameArt 頁面</a></div></label>')
        sections.append(f'<section id="{gid}"><h2>{html.escape(title)}</h2><p class="need">{html.escape(need)}</p><div class="grid">{"".join(cards)}</div></section>')
    nav = "".join(f'<a href="#{g[0]}">{html.escape(g[1].replace("（", " ").replace("）", "").split("　")[0])}</a>' for g in GROUPS)
    groups_js = json.dumps([[g[0], g[1].replace("　", " ")] for g in GROUPS], ensure_ascii=False)
    page = (
        '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>配樂候選試聽</title><style>{CSS}</style></head><body><main><h1>配樂候選試聽</h1>"
        '<p class="lead">每一幕列出現用的曲子（★）和其他候選，都是 CC0。每首只剪約 80 秒，按播放就能聽；覺得合適的點左邊的圓點，'
        "最下面的按鈕會把你的選擇整理成一段文字，貼給我就好。<br>說明是根據作者的描述和我量到的起伏整理的，我沒有逐首聽過，聽感以你的耳朵為準。"
        "第 19 節整段靜音，不需要選曲。</p>"
        f"<nav>{nav}</nav>{''.join(sections)}</main>"
        '<div class="bar"><button id="copy">複製我的選擇</button><span id="out">還沒選。</span></div>'
        f"<script>{JS.replace('__GROUPS__', groups_js)}</script></body></html>"
    )
    out = BASE / "聽歌清單.html"
    out.write_text(page, encoding="utf-8")
    print(out, n, "張卡片")


if __name__ == "__main__":
    main()
