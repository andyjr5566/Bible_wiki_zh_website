#!/usr/bin/env python3
"""建置並索引 ``appendix/website`` 底下的互動網站。

附錄 plugin 原本只掃描章節目錄裡的 ``*.html``。Vite 專案的根目錄
``index.html`` 是來源檔，真正可部署的是 ``dist/``。本程式保留靜態頁面的掃描
行為，也能辨識 Vite 章節，並在明確指定參數時建置／匯出靜態網站。

用法::

    # 列出入口（附錄索引器使用的模式）
    python appendix/website/build.py

    # 建置所有找到的 Vite 章節
    python appendix/website/build.py --build

    # 安裝乾淨依賴並建置所有找到的 Vite 章節 (適合 CI/CD)
    python appendix/website/build.py --ci-build

    # 建置並複製可部署檔案到靜態主機目錄
    python appendix/website/build.py --build --deploy-dir .tmp/website-deploy
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

CATEGORY_NAME = "互動網站"
CATEGORY_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = CATEGORY_DIR.parent.parent
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
VITE_CONFIG_NAMES = ("vite.config.ts", "vite.config.js", "vite.config.mjs")
BACKUP_MARKER = "_backup_"


def configure_stdio() -> None:
    """Keep direct execution usable on Windows' legacy console code pages."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8", errors="replace")


def extract_title(html_file: Path) -> str:
    """Extract ``<title>``; fall back to the file name when unavailable."""
    try:
        content = html_file.read_text(encoding="utf-8", errors="ignore")
        match = TITLE_RE.search(content)
        if match:
            title = re.sub(r"\s+", " ", match.group(1)).strip()
            if "|" in title:
                title = title.split("|", 1)[0].strip()
            if title:
                return title
    except OSError:
        pass
    return html_file.stem


def iter_chapters() -> Iterable[tuple[str, str, Path]]:
    """Yield ``(book, chapter, path)`` in deterministic order.

    Backup folders are intentionally excluded.  They can contain old ``dist``
    output and must never become a live website entry by accident.
    """
    for book_dir in sorted(CATEGORY_DIR.iterdir(), key=lambda path: path.name):
        if not book_dir.is_dir() or book_dir.name.startswith("."):
            continue
        for chapter_dir in sorted(book_dir.iterdir(), key=lambda path: path.name):
            if not chapter_dir.is_dir() or chapter_dir.name.startswith("."):
                continue
            if BACKUP_MARKER in chapter_dir.name:
                continue
            yield book_dir.name, chapter_dir.name, chapter_dir


def is_vite_app(chapter_dir: Path) -> bool:
    """Return whether a chapter directory is a Vite application project."""
    return (
        (chapter_dir / "package.json").is_file()
        and (chapter_dir / "src").is_dir()
        and any((chapter_dir / name).is_file() for name in VITE_CONFIG_NAMES)
    )


def discover_vite_apps() -> list[Path]:
    """Find Vite chapter projects without inspecting ``node_modules``."""
    return [chapter_dir for _, _, chapter_dir in iter_chapters() if is_vite_app(chapter_dir)]


def _relative_path(path: Path) -> str:
    return path.relative_to(REPOSITORY_ROOT).as_posix()


def _append_entry(
    entries: defaultdict[str, list[dict[str, str]]],
    key: str,
    html_file: Path,
) -> None:
    entries[key].append({
        "title": extract_title(html_file),
        "path": _relative_path(html_file),
    })


def _chapter_html_entries(
    entries: defaultdict[str, list[dict[str, str]]],
    book: str,
    chapter: str,
    chapter_dir: Path,
) -> None:
    """Add static pages or the built entry point for a Vite application."""
    key = f"{book}/{chapter}"
    if is_vite_app(chapter_dir):
        built_index = chapter_dir / "dist" / "index.html"
        if built_index.is_file():
            # The source index.html points to /src/main.ts and is not a
            # deployable page.  Only expose the production entry point.
            _append_entry(entries, key, built_index)

        # A Vite chapter may also contain hand-authored static pages.  Keep
        # those links, but never expose the Vite source index as a live page.

    html_files = _root_static_pages(chapter_dir)

    for html_file in sorted(html_files, key=lambda path: path.name.lower()):
        _append_entry(entries, key, html_file)


def _root_static_pages(chapter_dir: Path) -> list[Path]:
    """Return hand-authored root pages, excluding a Vite source index."""
    pages = [*chapter_dir.glob("*.html"), *chapter_dir.glob("*.htm")]
    if is_vite_app(chapter_dir):
        pages = [path for path in pages if path.name.lower() != "index.html"]
    return sorted(pages, key=lambda path: path.name.lower())


def scan_all_entries() -> dict[str, list[dict[str, str]]]:
    """Scan all books and chapters for deployable website entry points.

    Static chapters expose their root ``.html``/``.htm`` files.  Vite chapters
    expose ``dist/index.html`` only after a production build has succeeded.
    """
    entries: defaultdict[str, list[dict[str, str]]] = defaultdict(list)
    for book, chapter, chapter_dir in iter_chapters():
        _chapter_html_entries(entries, book, chapter, chapter_dir)
    return dict(entries)


def render_category_markdown(book: str, chapter_name: str) -> str | None:
    """Render the Markdown section for one chapter, or ``None`` if empty."""
    key = f"{book}/{chapter_name}"
    items = scan_all_entries().get(key, [])
    if not items:
        return None

    lines = [f"### {CATEGORY_NAME}"]
    for item in items:
        lines.append(f"- [{item['title']}]({item['path']})")
    return "\n".join(lines)


def _display_rel_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPOSITORY_ROOT).as_posix())
    except ValueError:
        return path.as_posix()


def build_vite_apps(
    apps: Iterable[Path],
    *,
    install_dependencies: bool = False,
) -> None:
    """Run each app's verified production build."""
    npm_command = "npm.cmd" if os.name == "nt" else "npm"
    for app in apps:
        rel_path = _display_rel_path(app)
        if install_dependencies:
            print(f"[依賴] {rel_path}")
            if (app / "package-lock.json").is_file():
                subprocess.run([npm_command, "ci"], cwd=app, check=True)
            elif (app / "package.json").is_file():
                subprocess.run([npm_command, "install"], cwd=app, check=True)
        print(f"[建置] {rel_path}")
        subprocess.run([npm_command, "run", "build"], cwd=app, check=True)


def _deployment_record(app: Path) -> dict[str, str]:
    book = app.parent.name
    chapter = app.name
    return {
        "book": book,
        "chapter": chapter,
        "path": f"{book}/{chapter}/index.html",
        "source": _relative_path(app / "dist"),
        "directory": f"{book}/{chapter}",
    }


def _static_deployment_record(page: Path) -> dict[str, str]:
    book = page.parent.parent.name
    chapter = page.parent.name
    return {
        "book": book,
        "chapter": chapter,
        "kind": "static",
        "path": f"{book}/{chapter}/{page.name}",
        "source": _relative_path(page),
        "directory": f"{book}/{chapter}",
    }


def export_vite_apps(apps: Iterable[Path], deploy_dir: Path) -> list[dict[str, str]]:
    """Copy Vite and static website entries into a static-host directory.

    The destination is explicit and never deletes existing files.  This makes
    repeated exports safe while still replacing files with the same names.  The
    historical function name is kept for callers that already use it; static
    HTML pages are included so a whole ``appendix/website`` export is complete.
    """
    deploy_dir = deploy_dir.resolve()
    deploy_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, str]] = []

    vite_apps = {app.resolve() for app in apps}
    for book, chapter, chapter_dir in iter_chapters():
        if chapter_dir.resolve() not in vite_apps:
            for page in _root_static_pages(chapter_dir):
                destination = deploy_dir / book / chapter / page.name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(page, destination)
                records.append(_static_deployment_record(page))
            continue

        app = chapter_dir
        source = (app / "dist").resolve()
        source_index = source / "index.html"
        if not source_index.is_file():
            raise RuntimeError(
                f"{app.relative_to(REPOSITORY_ROOT)} 找不到 dist/index.html；"
                "請先使用 --build 建置"
            )
        destination = (deploy_dir / app.parent.name / app.name).resolve()
        if destination == source:
            raise RuntimeError("--deploy-dir 不可指定為該專案的 dist 目錄")
        shutil.copytree(source, destination, dirs_exist_ok=True)
        app_record = _deployment_record(app)
        app_record["kind"] = "vite"
        records.append(app_record)
        for page in _root_static_pages(app):
            static_destination = destination / page.name
            shutil.copy2(page, static_destination)
            records.append(_static_deployment_record(page))

    records.sort(key=lambda record: record["path"])
    manifest = {
        "nonCommercial": True,
        "generatedBy": "appendix/website/build.py",
        "entries": records,
    }
    (deploy_dir / "interactive-websites.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    links = [
        "<!doctype html>",
        '<html lang="zh-Hant"><head><meta charset="utf-8">',
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
        "<title>互動網站</title></head><body>",
        "<h1>互動網站</h1>",
        "<p>本部署版本僅供非商業教育與聖經研讀使用。</p>",
        "<ul>",
    ]
    for record in records:
        label = html.escape(f"{record['book']} · {record['chapter']}")
        href = html.escape(record["path"], quote=True)
        links.append(f'<li><a href="{href}">{label}</a></li>')
    links.extend(["</ul>", "</body></html>"])
    (deploy_dir / "index.html").write_text("\n".join(links) + "\n", encoding="utf-8", newline="\n")
    return records


def _print_entries(entries: dict[str, list[dict[str, str]]]) -> None:
    print(f"[appendix/website] 找到 {len(entries)} 個章節資源群組")
    for chapter, items in entries.items():
        print(f"  * {chapter}: {len(items)} 筆入口")
        for item in items:
            print(f"      - {item['title']} → {item['path']}")


def main(argv: list[str] | None = None) -> int:
    configure_stdio()
    parser = argparse.ArgumentParser(description=__doc__)
    build_group = parser.add_mutually_exclusive_group()
    build_group.add_argument(
        "--build",
        action="store_true",
        help="對所有找到的 Vite 章節執行 npm run build",
    )
    build_group.add_argument(
        "--ci-build",
        action="store_true",
        help="先安裝乾淨依賴（npm ci/install），再對所有找到的 Vite 章節執行 npm run build",
    )
    parser.add_argument(
        "--deploy-dir",
        type=Path,
        metavar="DIR",
        help="將 Vite 網站與靜態 HTML 匯出到 DIR",
    )
    args = parser.parse_args(argv)

    apps = discover_vite_apps()
    if args.ci_build:
        build_vite_apps(apps, install_dependencies=True)
    elif args.build:
        build_vite_apps(apps)
    if args.deploy_dir:
        records = export_vite_apps(apps, args.deploy_dir)
        print(f"[部署] 已匯出 {len(records)} 筆網站入口到 {args.deploy_dir.resolve()}")

    _print_entries(scan_all_entries())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
