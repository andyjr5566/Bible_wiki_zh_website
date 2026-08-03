#!/usr/bin/env python3
"""appendix/fhl_maps 分類資料處理器 (Plugin)

建立 Obsidian 地圖筆記與索引，並提供全章節「### 相關地圖」資源對照清單。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CATEGORY_NAME = "相關地圖"
CATEGORY_DIR = Path(__file__).resolve().parent
ROOT = CATEGORY_DIR.parent.parent

UTIL_DIR = ROOT / "util"
if str(UTIL_DIR) not in sys.path:
    sys.path.insert(0, str(UTIL_DIR))

try:
    from book_paths import book_directory, ordered_book_dir_name
except ImportError:
    from util.book_paths import book_directory, ordered_book_dir_name

METADATA_PATH = CATEGORY_DIR / "metadata.json"
MAPS_DIR = CATEGORY_DIR / "maps"
INDEX_PATH = CATEGORY_DIR / "地圖索引.md"
SCRIPTURE_INDEX_PATH = CATEGORY_DIR / "scripture_map_index.json"
IMAGE_OPTIMIZATION_PATH = CATEGORY_DIR / "image_optimization.json"

MANUAL_MARKER = "<!-- fhl-map-manual: edits below this line are preserved -->"

SCRIPTURE_RE = re.compile(r"#([^|]+)\|")
MAP_RE = re.compile(r"\$(\d{3})")
DETAIL_RE = re.compile(r"\^([^|]+)\|")

BOOK_ABBREVIATIONS = {
    "創": "創世記",
    "出": "出埃及記",
    "民": "民數記",
    "申": "申命記",
    "書": "約書亞記",
    "士": "士師記",
    "撒上": "撒母耳記上",
    "撒下": "撒母耳記下",
    "王上": "列王紀上",
    "王下": "列王紀下",
    "代上": "歷代志上",
    "代下": "歷代志下",
    "拉": "以斯拉記",
    "尼": "尼希米記",
    "斯": "以斯帖記",
    "伯": "約伯記",
    "賽": "以賽亞書",
    "耶": "耶利米書",
    "結": "以西結書",
    "但": "但以理書",
    "何": "何西阿書",
    "摩": "阿摩司書",
    "該": "哈該書",
    "亞": "撒迦利亞書",
    "太": "馬太福音",
    "可": "馬可福音",
    "路": "路加福音",
    "約": "約翰福音",
    "徒": "使徒行傳",
    "羅": "羅馬書",
    "林前": "哥林多前書",
    "加": "加拉太書",
    "腓": "腓立比書",
    "西": "歌羅西書",
    "多": "提多書",
    "門": "腓利門書",
    "來": "希伯來書",
    "彼前": "彼得前書",
    "彼後": "彼得後書",
    "猶": "猶大書",
}


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def unique(items):
    return list(dict.fromkeys(items))


def scripture_tokens(description: str) -> list[str]:
    return unique(match.group(1).strip() for match in SCRIPTURE_RE.finditer(description))


def parse_scripture_reference(raw: str) -> tuple[str | None, list[int]]:
    compact = re.sub(r"\s+", "", raw)
    match = re.match(r"^([^0-9]+)(.+)$", compact)
    if not match:
        return None, []
    abbreviation, body = match.groups()
    book = BOOK_ABBREVIATIONS.get(abbreviation)
    if not book:
        return None, []

    chapters: list[int] = []
    for part in body.split(";"):
        start = re.match(r"^(\d+):", part)
        if not start:
            continue
        start_chapter = int(start.group(1))
        end_matches = re.findall(r"-(\d+):", part)
        end_chapter = int(end_matches[-1]) if end_matches else start_chapter
        if end_chapter < start_chapter:
            end_chapter = start_chapter
        chapters.extend(range(start_chapter, end_chapter + 1))
    return book, unique(chapters)


def chapter_path(book: str, chapter: int) -> Path:
    return book_directory(ROOT, book) / f"第{chapter}章.md"


def render_scripture_reference(raw: str) -> str:
    """只連到已存在的章；未完成的章保留為普通文字。"""
    book, chapters = parse_scripture_reference(raw)
    if not book or not chapters:
        return raw
    first_existing = next(
        (chapter for chapter in chapters if chapter_path(book, chapter).exists()),
        None,
    )
    if first_existing is None:
        return raw
    return f"[[{ordered_book_dir_name(book)}/第{first_existing}章|{raw}]]"


def map_title(record: dict) -> str:
    return re.sub(r"^\s*\d{3}\s+", "", record["heading"]).strip()


def map_alias(record: dict) -> str | None:
    match = re.match(r"〈([^〉]+)〉", map_title(record))
    return match.group(1) if match else None


def map_group(record: dict) -> str:
    alias = map_alias(record)
    if not alias:
        return "附表"
    group = re.sub(r"[一二三四五六七八九十百0-9ab]+$", "", alias)
    return group or "附表"


def render_description(description: str, records_by_gid: dict[str, dict]) -> str:
    lines = description.replace("\r\n", "\n").splitlines()
    if lines:
        lines = lines[1:]
    text = "\n".join(lines).strip()

    text = SCRIPTURE_RE.sub(
        lambda match: render_scripture_reference(match.group(1).strip()),
        text,
    )

    def replace_map(match):
        gid = match.group(1)
        record = records_by_gid.get(gid)
        label = map_alias(record) or map_title(record) if record else f"地圖 {gid}"
        return f"[[appendix/fhl_maps/maps/{gid}|{label}]]"

    text = MAP_RE.sub(replace_map, text)
    text = DETAIL_RE.sub(
        lambda match: f"〔FHL 地名詳解 {match.group(1)}〕",
        text,
    )
    return "\n\n".join(line.rstrip() for line in text.splitlines()).rstrip()


def preserved_manual_text(path: Path) -> str:
    if not path.exists():
        return ""
    current = path.read_text(encoding="utf-8")
    if MANUAL_MARKER not in current:
        return ""
    return current.split(MANUAL_MARKER, 1)[1].lstrip("\n").rstrip()


def optimized_image_names() -> dict[str, str]:
    if not IMAGE_OPTIMIZATION_PATH.exists():
        return {}
    payload = json.loads(IMAGE_OPTIMIZATION_PATH.read_text(encoding="utf-8"))
    return {
        item["gid"]: item["chosen_image"]
        for item in payload.get("images", [])
    }


def render_map(
    record: dict,
    records_by_gid: dict[str, dict],
    manual: str,
    image_names: dict[str, str] | None = None,
) -> str:
    gid = record["gid"]
    title = map_title(record)
    alias = map_alias(record)
    refs = scripture_tokens(record["description"])
    source_image_name = Path(record["local_image"].replace("\\", "/")).name
    image_name = (image_names or {}).get(gid, source_image_name)
    if not (CATEGORY_DIR / "images" / image_name).exists():
        raise FileNotFoundError(f"地圖 {gid} 找不到圖片：{image_name}")

    frontmatter = [
        "---",
        f"gid: {yaml_string(gid)}",
        f"title: {yaml_string(title)}",
        f"map_group: {yaml_string(map_group(record))}",
        f"source_url: {yaml_string(record['page_url'])}",
        f"image_source_url: {yaml_string(record['image_url'])}",
    ]
    if alias:
        frontmatter.extend(["aliases:", f"  - {yaml_string(alias)}"])
    if refs:
        frontmatter.append("scripture_refs:")
        frontmatter.extend(f"  - {yaml_string(ref)}" for ref in refs)
    frontmatter.append("---")

    related_scripture = "\n".join(
        f"- {render_scripture_reference(ref)}" for ref in refs
    )
    related_gids = unique(match.group(1) for match in MAP_RE.finditer(record["description"]))
    related_maps = []
    for related_gid in related_gids:
        related = records_by_gid.get(related_gid)
        label = map_alias(related) or map_title(related) if related else f"地圖 {related_gid}"
        related_maps.append(
            f"- [[appendix/fhl_maps/maps/{related_gid}|{label}]]"
        )

    sections = [
        "\n".join(frontmatter),
        f"# {title}",
        f"![[appendix/fhl_maps/images/{image_name}]]",
        "## 地圖解說\n\n" + render_description(record["description"], records_by_gid),
    ]
    if related_scripture:
        sections.append("## 相關經文\n\n" + related_scripture)
    if related_maps:
        sections.append("## 相關地圖\n\n" + "\n".join(related_maps))
    sections.extend(
        [
            f"## 來源\n\n- [信望愛聖經地圖]({record['page_url']})",
            "## 補充筆記\n\n" + MANUAL_MARKER + (
                f"\n{manual}" if manual else ""
            ),
        ]
    )
    return "\n\n".join(sections).rstrip() + "\n"


def build_scripture_index(records: list[dict]) -> tuple[dict, list[dict]]:
    chapters: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    unparsed = []
    for record in records:
        for raw in scripture_tokens(record["description"]):
            book, chapter_numbers = parse_scripture_reference(raw)
            if not book or not chapter_numbers:
                unparsed.append({"gid": record["gid"], "reference": raw})
                continue
            for chapter in chapter_numbers:
                key = f"{book}/第{chapter}章"
                chapters[key][record["gid"]].append(raw)

    serializable = {}
    for key in sorted(chapters):
        serializable[key] = [
            {"gid": gid, "refs": unique(chapters[key][gid])}
            for gid in sorted(chapters[key])
        ]
    return serializable, unparsed


def render_index(records: list[dict]) -> str:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        grouped[map_group(record)].append(record)

    sections = [
        "# 信望愛聖經地圖索引",
        (
            "本索引由 `metadata.json` 自動產生。每張地圖筆記整合圖片、"
            "原始解說、經文引用與地圖互引。"
        ),
    ]
    for group, items in grouped.items():
        lines = [f"## {group}"]
        for record in items:
            gid = record["gid"]
            lines.append(
                f"- [[appendix/fhl_maps/maps/{gid}|{gid}　{map_title(record)}]]"
            )
        sections.append("\n".join(lines))
    return "\n\n".join(sections).rstrip() + "\n"


def scan_all_entries() -> dict[str, list[dict[str, str]]]:
    """Plugin 標準介面：掃描所有地圖對應的章節。"""
    if not METADATA_PATH.exists():
        return {}
    records = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    records_by_gid = {record["gid"]: record for record in records}
    scripture_index, _ = build_scripture_index(records)

    entries = defaultdict(list)
    for key, item_list in scripture_index.items():
        for item in item_list:
            gid = item["gid"]
            record = records_by_gid.get(gid)
            if not record:
                continue
            title = map_title(record)
            entries[key].append({
                "title": title,
                "path": f"appendix/fhl_maps/maps/{gid}",
                "is_wikilink": True,
            })
    return entries


def write_or_check(path: Path, content: str, check: bool, changed: list[Path]):
    current = path.read_text(encoding="utf-8") if path.exists() else None
    if current == content:
        return
    changed.append(path)
    if not check:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def build_maps_and_indexes(check: bool = False) -> list[Path]:
    records = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    records_by_gid = {record["gid"]: record for record in records}
    image_names = optimized_image_names()
    scripture_index, unparsed = build_scripture_index(records)
    changed: list[Path] = []

    for record in records:
        path = MAPS_DIR / f"{record['gid']}.md"
        content = render_map(
            record,
            records_by_gid,
            preserved_manual_text(path),
            image_names,
        )
        write_or_check(path, content, check, changed)

    write_or_check(INDEX_PATH, render_index(records), check, changed)
    index_content = json.dumps(
        {
            "chapters": scripture_index,
            "unparsed_references": unparsed,
        },
        ensure_ascii=False,
        indent=2,
    ) + "\n"
    write_or_check(SCRIPTURE_INDEX_PATH, index_content, check, changed)
    return changed


if __name__ == "__main__":
    try:
        from console import utf8_stdio
    except ImportError:
        from util.console import utf8_stdio
    utf8_stdio()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    changed = build_maps_and_indexes(args.check)
    entries = scan_all_entries()
    print(f"✅ [appendix/fhl_maps] 已處理，涵蓋 {len(entries)} 個章節資源，變更 {len(changed)} 筆。")
