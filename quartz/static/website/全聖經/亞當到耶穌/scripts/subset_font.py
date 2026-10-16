"""讀經模式的楷書字型：只留實際用到的字，放進網站資料夾（建置時不連網）。

字型：霞鶩文楷 TC（LXGW WenKai TC），SIL Open Font License 1.1。
用法：python scripts/subset_font.py <LXGWWenKaiTC-Regular.ttf> <LXGWWenKaiTC-Medium.ttf> <OFL.txt>
用到的字＝讀經資料（經文、章名、讀經提醒）＋讀經模式介面程式裡的中文。
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

from fontTools import subset

SITE = Path(__file__).resolve().parents[1]
OUT = SITE / "src" / "assets" / "fonts"
UI_SOURCES = ["src/ui/reader.ts", "src/ui/ink.ts", "src/ui/tree-stage.ts", "src/ui/roles.ts", "src/ui/canvas.ts",
              "src/ui/roster.ts", "src/ui/roster-model.ts", "src/ui/wall.ts", "src/ui/wall-model.ts", "src/ui/reader-route.ts"]
# 數字、標點、章號用的國字（介面上的章名卡、節號）
ALWAYS = "0123456789０１２３４５６７８９一二三四五六七八九十百千萬零第章節卷代上下，。、；：！？「」『』（）【】—…·・ "


def used_characters() -> str:
    reading = json.loads((SITE / "src" / "data" / "reading.json").read_text(encoding="utf-8"))
    chars = set(ALWAYS)
    # 讀經路線：段落標題、分組、經文範圍、章名、經文、小段標題
    for segment in reading["segments"]:
        for field in ("title", "group", "range"):
            chars.update(segment.get(field, ""))
        for chapter in segment["chapters"]:
            chars.update(chapter.get("title", ""))
            chars.update(chapter.get("bookName", ""))
            chars.update(chapter.get("book", ""))
            for verse in chapter["verses"]:
                chars.update(verse["text"])
                chars.update(verse.get("sec", ""))
    for note in reading.get("notes", []):
        chars.update(note["text"])
    # 平行經文差異小卡、歸回連結小卡
    for diff in reading.get("diffs", []):
        chars.update(diff["title"])
        for side in diff["sides"]:
            chars.update(side["text"] + side["ref"])
    for link in reading.get("links", []):
        chars.update(link.get("card", ""))
        chars.update(link.get("pip", "") or "")
        for ref in link.get("refs", []):
            chars.update(ref)
    # 歸回的名冊：標題、分區、行的字、名字、引句、捐獻者、量詞
    roster_path = SITE / "src" / "data" / "roster.json"
    if roster_path.is_file():
        for roster in json.loads(roster_path.read_text(encoding="utf-8")).get("rosters", []):
            chars.update(roster.get("title", ""))
            chars.update((roster.get("quote") or {}).get("text", "") + (roster.get("quote") or {}).get("ref", ""))
            for section in roster.get("sections", []):
                chars.update(section.get("title", ""))
                for row in section.get("rows", []):
                    for field in ("label", "unit", "who", "at"):
                        chars.update(row.get(field, "") or "")
                    chars.update((row.get("quote") or {}).get("t", ""))
                    for name in row.get("names", []) or []:
                        chars.update(name.get("t", ""))
    # 家族軌跡（名冊、城牆共用）與尼 3 城牆：門、樓、地方、修造的人
    if roster_path.is_file():
        for family in json.loads(roster_path.read_text(encoding="utf-8")).get("families", []):
            chars.update(family.get("name", ""))
            for place in family.get("places", []):
                chars.update(place.get("at", "") + (place.get("unit", "") or ""))
    wall_path = SITE / "src" / "data" / "wall.json"
    if wall_path.is_file():
        for item in json.loads(wall_path.read_text(encoding="utf-8")).get("ring", []):
            chars.update(item.get("t", "") + item.get("at", ""))
            for name in item.get("names", []) or []:
                chars.update(name.get("t", ""))
    # 大衛立的職位：方塊標題、人名、細節、人數、印
    roles_path = SITE / "src" / "data" / "roles.json"
    if roles_path.is_file():
        roles = json.loads(roles_path.read_text(encoding="utf-8"))
        for category in roles.get("categories", []):
            chars.update(category.get("title", ""))
            for box in category.get("boxes", []):
                for field in ("title", "ref", "note", "seal"):
                    chars.update(box.get(field, "") or "")
                for member in box.get("members", []):
                    for field in ("name", "detail", "ref"):
                        chars.update(member.get(field, "") or "")
                    chars.update((member.get("spouse") or {}).get("name", ""))
                # 從大衛到所羅門：職位、大衛時的人；十二個官吏的引句
                for row in box.get("rows", []) or []:
                    chars.update(row.get("office", "") + (row.get("moved") or {}).get("from", ""))
                    for entry in row.get("david", []):
                        for field in ("name", "detail", "ref"):
                            chars.update(entry.get(field, "") or "")
                chars.update((box.get("quote") or {}).get("text", "") + (box.get("quote") or {}).get("ref", ""))
                for item in box.get("groups", []) + box.get("figures", []):
                    for value in item.values():
                        if isinstance(value, str):
                            chars.update(value)
        for person in roles.get("people", []):
            chars.update(person.get("name", "") + (person.get("qualifier", "") or "") + "".join(person.get("aliases", []) or []))
    # 讀經時大圖上的名字也換成這個字型：所有人名、別名、牌子標題、經節標籤
    genealogy = json.loads((SITE / "src" / "data" / "genealogy.json").read_text(encoding="utf-8"))
    for person in genealogy["persons"]:
        chars.update(person.get("name", ""))
        chars.update(person.get("qualifier", "") or "")
        for name in person.get("names", []) or []:
            chars.update(name.get("as", ""))
            chars.update(name.get("ref", "") or "")
    for node in (genealogy.get("placements") or {}).get("nodes", []):
        chars.update(node.get("title", ""))
        chars.update(node.get("ref", ""))
    for name in UI_SOURCES:
        path = SITE / name
        if path.is_file():
            chars.update(re.findall(r"[　-鿿＀-￯]", path.read_text(encoding="utf-8")))
    return "".join(sorted(chars))


def build(source: Path, target: Path, text: str) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, str(target), options)


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    regular, medium, license_file = (Path(arg) for arg in sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    text = used_characters()
    build(regular, OUT / "wenkai-tc-regular.woff2", text)
    build(medium, OUT / "wenkai-tc-medium.woff2", text)
    if license_file.resolve() != (OUT / "OFL.txt").resolve():
        shutil.copyfile(license_file, OUT / "OFL.txt")
    for path in sorted(OUT.iterdir()):
        print(f"{path.name}  {path.stat().st_size:,} bytes")
    print(f"{len(text)} 個字")
    return 0


if __name__ == "__main__":
    sys.exit(main())
