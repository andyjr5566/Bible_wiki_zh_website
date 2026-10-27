"""從 OpenGameArt 抓候選配樂（只收頁面標明 CC0 的），放到 collect/audio/bgm-more/raw/（不進版控）。"""
from __future__ import annotations
import html, json, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "collect" / "audio" / "bgm-more" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}
MAX_MB = 45

SLUGS = """predynastic-dawn ancient-mysteries contemplation-0 rise-of-the-early-dawn sunrise-over-water ancient-temple-1 hidden-temple
into-the-ruined-temple first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track mirror-lake dreamlike-state near-and-far medieval-exploration relics-of-past
white-limestone egyptian-meditation-music desert-settlement desert-travel-loop strange-sanctuary original-hymn etirwer
caught-in-the-desert-plains lost-in-the-desert desert-theme desert-calmness-and-fighting-orchestral-141 walk-with-me northumberland springs-pastorales
beautiful-forest-orchestra the-road-we-use-to-travel-when-we-were-kids lost-in-the-meadows sunrise blue-sunrise unexplored-short-ver-orchestra-music shalibah
a-legend-will-rise-orchestral determined-pursuit-epic-orchestra-loop production-theme-intro-epic-orchestra epic-endgame-cinematic adventure-intro-title-cinematic-epic
savior-of-humanity the-call-for-unity gladiators-lament-epic-tragic-music epic-transformation-124 fall-of-nightmares-epic-orchestral heros-reprise
qazijamjam-orchestral-battle-theme epic-main-menu-theme-loop dawn-of-the-new-era destiny-formation final-stand ancient-power-of-serpents osiris-monolith
desertmystic-dynastic-egyptian-theme-cc0 unexplored-expansion fantasy-orchestral-theme
waiting-ii waiting-iii judge-jury sad-orchestral-theme inevitable unsolved-investigation
fantasy-choir-3-orchestral-pieces heavenly-loop cathedral-0 zodik-deep-choir interweave soul-rebellion tension doom-in-the-morning ancient-grudge mysterious
darkest-hour a-fallen-dawn not-powerful-enough tension-and-distress
shrine prelude-in-f-minor sacred-springs-music-loop piano-melody-solo-17 hail-the-arbiter
sad-scene-music-what-is-left emotional-piano-loop fantasy-lament-for-a-warriors-soul sadness the-sad-battle aftermath-0 ending-scene ending-song
long-winter snowfall small-things prologue-theme yoiyami-core-theme-%E2%80%93-deep-blue-ambient-piano frozen-in-time-0 lonely-ali dreaming-of-you
the-hope ruins-of-an-ancient-culture- sunset-plains laments-of-the-war""".split()


def get(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def one(slug: str) -> dict | None:
    out = {"slug": slug}
    try:
        page = get(f"https://opengameart.org/content/{slug}").decode("utf-8", "ignore")
    except Exception as e:
        return {"slug": slug, "error": str(e)}
    title = re.search(r"<title>([^<|]+)", page)
    out["title"] = html.unescape(title.group(1).strip()) if title else slug
    out["cc0"] = bool(re.search(r"CC0", page)) and not re.search(r"CC-BY|CC BY|GPL", re.sub(r"<[^>]+>", " ", page.split("field-name-field-art-licenses")[1][:600]) if "field-name-field-art-licenses" in page else "")
    lic = re.search(r'field-name-field-art-licenses.*?</div>\s*</div>', page, re.S)
    out["license"] = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", lic.group(0))).strip() if lic else ""
    au = re.search(r'Submitted by\s*<[^>]*>\s*<a[^>]*href="(/users/[^"]+)"[^>]*>([^<]+)', page)
    if not au:
        au = re.search(r'<a[^>]*href="(/users/[^"]+)"[^>]*class="username"[^>]*>([^<]+)', page)
    out["author"] = html.unescape(au.group(2)) if au else ""
    desc = re.search(r'field-name-body.*?<div class="field-item[^>]*>(.*?)</div>', page, re.S)
    out["desc"] = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", desc.group(1)))).strip()[:400] if desc else ""
    files = re.findall(r'href="(https://opengameart\.org/sites/default/files/[^"]+\.(?:ogg|mp3|wav|flac))"', page)
    out["files"] = list(dict.fromkeys(files))
    out["url"] = f"https://opengameart.org/content/{slug}"
    if not out["files"] or "CC0" not in out["license"]:
        out["skip"] = "no file" if not out["files"] else f"license={out['license'][:60]}"
        return out
    pref = sorted(out["files"], key=lambda f: (f.endswith(".wav") or f.endswith(".flac"), len(f)))
    fname = None
    d = RAW / slug
    d.mkdir(exist_ok=True)
    for f in pref[:3]:
        name = urllib.parse.unquote(f.rsplit("/", 1)[1])
        target = d / name
        if target.exists():
            fname = name; break
        try:
            req = urllib.request.Request(f, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                size = int(r.headers.get("Content-Length") or 0)
                if size > MAX_MB * 1e6:
                    continue
                target.write_bytes(r.read())
            fname = name; break
        except Exception as e:
            out["dl_error"] = str(e)
    out["file"] = fname
    (d / "info.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


if __name__ == "__main__":
    with ThreadPoolExecutor(6) as ex:
        res = [r for r in ex.map(one, SLUGS) if r]
    ok = [r for r in res if r.get("file")]
    print(f"下載 {len(ok)} / {len(SLUGS)}")
    for r in res:
        if not r.get("file"):
            print("略過", r["slug"], r.get("skip") or r.get("error") or r.get("dl_error"))
