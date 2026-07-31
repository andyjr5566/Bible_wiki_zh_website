#!/usr/bin/env python3
"""appendix/website 分類資料處理器 (Plugin)

動態掃描 appendix/website/{書名}/{章}/ 底下的 HTML 檔案，
並產生「### 互動網站」底下的連結列表。
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

CATEGORY_NAME = "互動網站"
CATEGORY_DIR = Path(__file__).resolve().parent

TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def extract_title(html_file: Path) -> str:
    """從 HTML 檔案中提取 <title>，提取失敗則以檔名替代。"""
    try:
        content = html_file.read_text(encoding="utf-8", errors="ignore")
        match = TITLE_RE.search(content)
        if match:
            title = match.group(1).strip()
            # 若標題包含 '|'，優先取前半段純中文標題
            if "|" in title:
                title = title.split("|")[0].strip()
            return title
    except Exception:
        pass
    return html_file.stem


def scan_all_entries() -> dict[str, list[dict[str, str]]]:
    """掃描所有書卷與章節，回傳結構：

    {
        "創世記/第6章": [
            {
                "title": "挪亞方舟 3D 聖經探秘",
                "path": "appendix/website/創世記/第6章/noahs-ark-3d-explorer.html"
            }
        ]
    }
    """
    entries = defaultdict(list)
    root = CATEGORY_DIR.parent.parent

    for book_dir in CATEGORY_DIR.iterdir():
        if not book_dir.is_dir() or book_dir.name.startswith("."):
            continue
        book_name = book_dir.name
        for chapter_dir in book_dir.iterdir():
            if not chapter_dir.is_dir() or chapter_dir.name.startswith("."):
                continue
            chapter_name = chapter_dir.name  # 例如 "第6章"
            key = f"{book_name}/{chapter_name}"

            for html_file in sorted(chapter_dir.glob("*.html")):
                rel_path = html_file.relative_to(root).as_posix()
                title = extract_title(html_file)
                entries[key].append({
                    "title": title,
                    "path": rel_path,
                })
            for htm_file in sorted(chapter_dir.glob("*.htm")):
                rel_path = htm_file.relative_to(root).as_posix()
                title = extract_title(htm_file)
                entries[key].append({
                    "title": title,
                    "path": rel_path,
                })

    return entries


def render_category_markdown(book: str, chapter_name: str) -> str | None:
    """為特定章節產出 Markdown 片段，找不到資源時回傳 None。"""
    key = f"{book}/{chapter_name}"
    all_entries = scan_all_entries()
    items = all_entries.get(key, [])
    if not items:
        return None

    lines = [f"### {CATEGORY_NAME}"]
    for item in items:
        lines.append(f"- [{item['title']}]({item['path']})")
    return "\n".join(lines)


if __name__ == "__main__":
    entries = scan_all_entries()
    print(f"✅ [appendix/website] 找到 {len(entries)} 個章節資源：")
    for ch_key, items in entries.items():
        print(f"  * {ch_key}: {len(items)} 筆")
