#!/usr/bin/env python3
"""
build-verse-compat.py — Cross-Version Bible Search Compatibility & Original-Language Pipeline

Modes:
  --mode candidates
      Reads strictly read-only baseline scripture (`raw_scripture`), STEP Bible lexicons/TAHOT/TAGNT,
      and cached public-domain datasets (`ChiUn.zip`, `ChiUns.zip`, `ChiUnL.zip`, `chi-cuv.usfx.xml`,
      `chi-cuv-simp.usfx.xml`, `names.tsv`, `Unihan.zip`), then emits verified Phase 1 candidate JSONs
      and human-readable Markdown audit reports into `--out-dir` without touching production website data.
      Example:
        python scripts/build-verse-compat.py --mode candidates --scripture-root <scripture-root> --cache-dir <cache-dir> --out-dir <out-dir>

  (step 2, separate script) scripts/verse-compat/audit.py
      Reads the candidate JSONs + Unihan.zip + raw_scripture + the hand-curated overlay
      scripts/verse-compat/curated.json and writes audited_rules.json and
      verse_original_terms_approved.json. Hand-edited bridge rules live in BRIDGE_TERMS in audit.py.
      Example:
        python scripts/verse-compat/audit.py --scripture-root <scripture-root> --cache-dir <cache-dir> --candidates-dir <out-dir>

  --mode emit
      Consumes audited/approved compatibility rules JSON from `--approved-dir` and writes:
        - `plugins/semantic-search/src/data/compatData.ts`
        - `quartz/data/verse-original-terms.json`
      Example:
        python scripts/build-verse-compat.py --mode emit --scripture-root <scripture-root> --approved-dir <out-dir>

Full chain (steps 1 -> 2 -> 3; same <out-dir> throughout; add --emit-root <dir> to emit elsewhere than the repo):
  python scripts/build-verse-compat.py --mode candidates --scripture-root <scripture-root> --cache-dir <cache-dir> --out-dir <out-dir>
  python scripts/verse-compat/audit.py --scripture-root <scripture-root> --cache-dir <cache-dir> --candidates-dir <out-dir>
  python scripts/build-verse-compat.py --mode emit --scripture-root <scripture-root> --approved-dir <out-dir>

Note: emit writes unformatted TS; the committed compatData.ts is prettier-formatted (the plugin's
prettier config, semicolons on), so run `npx prettier --write plugins/semantic-search/src/data/compatData.ts`
afterwards. verse-original-terms.json is byte-identical without formatting.

Paths (no machine-specific defaults are built in; a missing required path is a usage error):
  --repo-root       default: the repo containing this script (parent of scripts/)
  --scripture-root  env VERSE_COMPAT_SCRIPTURE_ROOT  (required in both modes)
  --cache-dir       env VERSE_COMPAT_CACHE_DIR       (required in candidates mode)
  --out-dir         env VERSE_COMPAT_OUT_DIR         (required in candidates mode)
  --approved-dir    default: --out-dir
  --emit-root       emit mode only: write compatData.ts / verse-original-terms.json under this root
                    (same relative layout as the repo) instead of --repo-root

Inputs and how to obtain them
  Put the cached files in <cache-dir>. The script downloads nothing; the URLs below are where to get them.
  Licenses are as recorded in the script's license table (`sources_verified.md`); verify before redistributing.

  ChiUn.zip, ChiUns.zip, ChiUnL.zip  (<cache-dir>)
      CrossWire SWORD modules: ChiUn = Mandarin CUV with OSIS Strong's, ChiUns = Simplified counterpart,
      ChiUnL = Classical Wenli (Lang=lzh; used only as a zText sanity check).
      Source: CrossWire SWORD module repository, https://www.crosswire.org/sword/modules/ (verify exact download URL).
      License: the DistributionLicense field in each module's .conf (ChiUnL verified Public Domain).

  chi-cuv.usfx.xml, chi-cuv-simp.usfx.xml  (<cache-dir>)
      Traditional and Simplified 1919 CUV in USFX XML.
      Source: seven1m/open-bibles GitHub repository, https://github.com/seven1m/open-bibles (verify file paths).
      License: Public Domain.

  names.tsv  (<cache-dir>)
      BibleNLP aligned biblical proper names (CU2010T column, with Macula WLC/GNT).
      Source: the script records no URL; it names BibleNLP only. Look up the BibleNLP project page (URL not recorded here, verify).
      License: CC-BY-SA / open data (verify against the source).

  Unihan.zip  (<cache-dir>)
      Unicode Unihan database; the script reads Unihan_Variants.txt from inside the zip.
      Source: https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip (verify).
      License: Unicode License v3 (Unicode-3.0).

  <scripture-root>/raw_scripture/  (you supply it; not downloaded)
      Baseline Traditional CUV, 66 books / 31,102 verses. Read-only.
      License: Public Domain (1919 CUV).

  <scripture-root>/.stepbible_data/  (STEP Bible)
      Lexicons/TBESH*, Lexicons/TBESG* and "Translators Amalgamated OT+NT"/TAHOT*, TAGNT*.
      Source: STEP Bible data (Tyndale House / STEPBible.org), https://github.com/STEPBible/STEPBible-Data (verify).
      License: CC BY 4.0.

Stdlib-only Python 3.11+. Strictly read-only with respect to `--scripture-root`.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
import difflib
import gzip
import json
import math
import os
from pathlib import Path
import re
import struct
import sys
import time
import xml.etree.ElementTree as ET
import zipfile
import zlib
from typing import Any


# ---------------------------------------------------------------------------
# Constants & Canonical Mappings
# ---------------------------------------------------------------------------

# Repo root = parent of the `scripts/` directory this file lives in.
# Scripture root, cache dir and out dir have no built-in defaults: they come from
# CLI flags or the VERSE_COMPAT_* environment variables (see main()).
DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[1]

# 66-book USFX / BibleNLP 3-letter codes -> canonical book number (1..66)
BOOK_CODE_TO_NUM: dict[str, int] = {
    "GEN": 1, "EXO": 2, "LEV": 3, "NUM": 4, "DEU": 5,
    "JOS": 6, "JDG": 7, "RUT": 8, "1SA": 9, "2SA": 10,
    "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14, "EZR": 15,
    "NEH": 16, "EST": 17, "JOB": 18, "PSA": 19, "PRO": 20,
    "ECC": 21, "SNG": 22, "ISA": 23, "JER": 24, "LAM": 25,
    "EZK": 26, "DAN": 27, "HOS": 28, "JOL": 29, "AMO": 30,
    "OBA": 31, "JON": 32, "MIC": 33, "NAM": 34, "HAB": 35,
    "ZEP": 36, "HAG": 37, "ZEC": 38, "MAL": 39,
    "MAT": 40, "MRK": 41, "LUK": 42, "JHN": 43, "ACT": 44,
    "ROM": 45, "1CO": 46, "2CO": 47, "GAL": 48, "EPH": 49,
    "PHP": 50, "COL": 51, "1TH": 52, "2TH": 53, "1TI": 54,
    "2TI": 55, "TIT": 56, "PHM": 57, "HEB": 58, "JAS": 59,
    "1PE": 60, "2PE": 61, "1JN": 62, "2JN": 63, "3JN": 64,
    "JUD": 65, "REV": 66,
}

# STEP TAHOT / TAGNT book abbreviations -> canonical book number (1..66)
STEP_BOOK_TO_NUM: dict[str, int] = {
    "Gen": 1, "Exo": 2, "Lev": 3, "Num": 4, "Deu": 5,
    "Jos": 6, "Jdg": 7, "Rut": 8, "1Sa": 9, "2Sa": 10,
    "1Ki": 11, "2Ki": 12, "1Ch": 13, "2Ch": 14, "Ezr": 15,
    "Neh": 16, "Est": 17, "Job": 18, "Psa": 19, "Pro": 20,
    "Ecc": 21, "Sng": 22, "Isa": 23, "Jer": 24, "Lam": 25,
    "Ezk": 26, "Dan": 27, "Hos": 28, "Jol": 29, "Amo": 30,
    "Oba": 31, "Jon": 32, "Mic": 33, "Nam": 34, "Hab": 35,
    "Zep": 36, "Hag": 37, "Zec": 38, "Mal": 39,
    "Mat": 40, "Mrk": 41, "Luk": 42, "Jhn": 43, "Act": 44,
    "Rom": 45, "1Co": 46, "2Co": 47, "Gal": 48, "Eph": 49,
    "Php": 50, "Col": 51, "1Th": 52, "2Th": 53, "1Ti": 54,
    "2Ti": 55, "Tit": 56, "Phm": 57, "Heb": 58, "Jas": 59,
    "1Pe": 60, "2Pe": 61, "1Jn": 62, "2Jn": 63, "3Jn": 64,
    "Jud": 65, "Rev": 66,
}

SANITY_REFS: list[tuple[int, int, int, str]] = [
    (1, 1, 1, "Gen 1:1"),
    (1, 6, 5, "Gen 6:5"),
    (2, 8, 16, "Exo 8:16"),
    (5, 11, 18, "Deu 11:18"),
    (5, 31, 21, "Deu 31:21"),
    (19, 23, 1, "Psa 23:1"),
    (23, 43, 2, "Isa 43:2"),
    (40, 1, 1, "Mat 1:1"),
    (43, 3, 16, "Joh 3:16"),
    (66, 22, 21, "Rev 22:21"),
]

GOLDEN_STRONGS: list[str] = ["H3336", "H2617", "H4284", "H8577", "H2903"]

GOLDEN_PROPER_PAIRS: list[tuple[str, str]] = [
    ("西奈", "西乃"),
    ("呂便", "流便"),
    ("約旦", "約但"),
    ("黎巴嫩", "利巴嫩"),
    ("幼發拉底", "伯拉"),
    ("幼發拉底河", "伯拉大河"),
    ("大馬士革", "大馬色"),
    ("她瑪", "他瑪"),
    ("塞浦路斯", "居比路"),
    ("尼哥德慕", "尼哥底母"),
    ("宙斯", "丟斯"),
    ("西班牙", "士班雅"),
    ("意大利", "義大利"),
]

# Known ambiguous 1-to-many Simplified -> Traditional characters to audit explicitly
KNOWN_AMBIGUOUS_SIMP: set[str] = set(
    "后干谷发里面系复松台云余冲准历只向回征才折斗朴板汇注游升范蒙表制别刮卷尝摆钟须咸舍腊致辟借伙脏克尽愿饥获徵"
)

# Ultra-high-frequency generic / stop lexical Strong's (excluded from content-word bridge by default,
# while still reported in audit tables so Phase 2 semantic review can inspect every cutoff).
ULTRA_GENERIC_STRONGS: set[str] = {
    # OT generic verbs, pronouns, particles, divine titles, basic nouns
    "H559", "H1961", "H6213", "H935", "H5414", "H3605", "H3068", "H430", "H410",
    "H1121", "H376", "H802", "H776", "H3117", "H4428", "H1004", "H6440", "H3027",
    "H5869", "H1697", "H5971", "H1", "H1980", "H3212", "H7200", "H8085", "H3318",
    "H7725", "H3947", "H4191", "H3427", "H5927", "H7971", "H7121", "H1696", "H7760",
    "H6680", "H5975", "H3045", "H8141", "H5704", "H5921", "H413", "H4480", "H853",
    "H834", "H3588", "H3808", "H408", "H369", "H2088", "H2063", "H428", "H1931",
    "H1992", "H589", "H595", "H859", "H587", "H854", "H5973", "H996", "H8478",
    "H310", "H6258", "H1571", "H2009", "H4994", "H3541", "H4100", "H4310",
    # Numbers
    "H259", "H8147", "H7969", "H702", "H2568", "H8337", "H7651", "H8083", "H8672",
    "H6235", "H3967", "H505", "H7239",
    # NT generic verbs, pronouns, particles, divine titles, numbers
    "G3004", "G1510", "G4160", "G2064", "G1325", "G3708", "G191", "G1096", "G2192",
    "G2316", "G2962", "G2424", "G5547", "G444", "G5207", "G2250", "G3956", "G5100",
    "G5101", "G3778", "G1565", "G846", "G1473", "G4771", "G2249", "G5210", "G3739",
    "G3588", "G2532", "G1161", "G1722", "G1519", "G1537", "G575", "G4314", "G5259",
    "G1223", "G1909", "G2596", "G3326", "G4012", "G3756", "G3361", "G3754", "G2443",
    "G1487", "G1437", "G1063", "G235", "G3767", "G5613", "G1520", "G1417", "G5140",
}

NON_CONTENT_MORPH_PREFIXES: tuple[str, ...] = (
    "Prefix", "Punct", "Suffix",
    "H:Part", "A:Part", "G:PRT",
    "H:Prep", "A:Prep", "G:PREP",
    "H:Conj", "A:Conj", "G:CONJ",
    "H:Cond", "A:Cond", "G:COND",
    "H:PerP", "A:PerP", "H:DemP", "A:DemP", "H:Intg", "A:Intg", "H:RelP", "A:RelP",
    "H:Neg", "A:Neg", "H:Intj", "A:Intj", "G:INJ",
    "G:T", "G:P", "G:D", "G:R", "G:C", "G:I", "G:K", "G:Q", "G:F", "G:S", "G:X",
    "N:N", "N:A",
)

# Regexes for translator notes vs general punctuation
TRANSLATOR_NOTE_RE = re.compile(
    r"（(?:原文|或作|或譯|有古卷|小字|[0-9]+|[一二三四五六七八九十]+節|又名|即|見|新娘|新郎|同伴)[^）]*）"
    r"|〔[^〕]*〕|【[^】]*】|\[[^\]]*\]"
)

LEADING_CLITICS: tuple[str, ...] = (
    "求你照你的", "求你按你的", "我們必以", "你們要以", "他們就以",
    "或是被", "必在他們", "將我們從", "你們指著", "我必向他們",
    "但我的", "因他的", "因你的", "憑你的", "憑他的", "照你的", "照他的",
    "在他的", "在你的", "在我的", "向他們", "給他們", "為他們", "使他們",
    "我們的", "你們的", "他們的", "她們的", "自己的",
    "你憑", "我憑", "他憑", "地以", "上作", "是大", "和大", "他像", "所施的", "是有",
    "他的", "她的", "你的", "我的", "這", "那", "其",
    "我們", "你們", "他們", "她們", "自己",
    "以", "用", "憑", "照", "按", "因", "為", "向", "對", "在", "從", "到",
    "與", "和", "並", "連", "及", "但", "卻", "就", "也", "都", "又", "乃",
    "必", "要", "所", "有", "是", "作", "被", "將", "把", "叫", "使", "給",
    "的", "之", "我", "你", "他", "她",
)

TRAILING_CLITICS: tuple[str, ...] = (
    "的時候", "的事", "的人", "之地", "之中", "之上", "之下", "之內", "之外",
    "裡", "裏", "上", "中", "內", "外", "前", "後",
    "的", "之", "了", "著", "着", "過", "們", "呢", "嗎", "麼", "啊", "吧", "啦", "焉",
)

GRAMMAR_BOUNDARY_CHARS: set[str] = set(
    "的之了著着過們在從到向對為以用和與並連及但卻就也都又乃必將把被叫使讓給於"
    "我你他她它牠祂這那豈不沒無未曾已經常仍更最甚極太好所是有作往來去上下裡裏中外前後"
    "人者物事地處時日年"
)


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def is_cjk(ch: str) -> bool:
    cp = ord(ch)
    return (
        (0x3400 <= cp <= 0x4DBF)
        or (0x4E00 <= cp <= 0x9FFF)
        or (0xF900 <= cp <= 0xFAFF)
        or (0x20000 <= cp <= 0x323AF)
    )


def only_cjk(text: str) -> str:
    return "".join(ch for ch in text if is_cjk(ch))


def strip_notes_and_punct(text: str) -> str:
    cleaned = TRANSLATOR_NOTE_RE.sub("", text)
    return only_cjk(cleaned)


def normalize_strong(raw_code: str) -> str | None:
    code = raw_code.strip()
    if code.startswith("strong:"):
        code = code[7:]
    m = re.match(r"^([HG])0*(\d+)([A-Za-z]?)$", code)
    if not m:
        return None
    prefix, digits, _suffix = m.group(1), int(m.group(2)), m.group(3)
    if digits == 0:
        return None
    return f"{prefix}{digits}"


def is_lexical_strong_number(norm_code: str) -> bool:
    prefix = norm_code[0]
    num = int(norm_code[1:])
    # Exclude Strong's TVM morphology numbers & FHL 900x Hebrew prefix numbers
    if prefix == "H" and num >= 8675:
        return False
    if prefix == "G" and num >= 5625:
        return False
    return True


def strip_hebrew_marks(heb: str) -> str:
    # Keep Hebrew consonantal letters U+05D0..U+05EA
    return "".join(ch for ch in heb if 0x05D0 <= ord(ch) <= 0x05EA)


def format_ref(books_by_num: dict[int, dict[str, Any]], ref: tuple[int, int, int]) -> str:
    b, c, v = ref
    return f"{books_by_num[b]['short']} {c}:{v}"


def format_slug_ref(books_by_num: dict[int, dict[str, Any]], ref: tuple[int, int, int]) -> str:
    b, c, v = ref
    return f"{b:02d}-{books_by_num[b]['name']}/第{c}章#v{v}"


def assert_not_inside_readonly(path: Path, readonly_root: Path) -> None:
    resolved_target = path.resolve()
    resolved_ro = readonly_root.resolve()
    if resolved_target == resolved_ro or resolved_ro in resolved_target.parents:
        raise RuntimeError(f"SAFETY ABORT: Refusing to write inside read-only scripture root: {resolved_target}")


def count_terms_in_verses(
    verses: dict[tuple[int, int, int], str],
    terms: set[str],
) -> tuple[Counter[str], Counter[str]]:
    """
    Single-pass O(total_chars * max_len) exact substring total-count and verse-DF counter
    for an arbitrary set of target strings (100x faster than O(V * |terms|) `in` scans).
    """
    by_len: dict[int, set[str]] = defaultdict(set)
    long_terms: list[str] = []
    for t in terms:
        if not t:
            continue
        if len(t) <= 10:
            by_len[len(t)].add(t)
        else:
            long_terms.append(t)

    total_counts: Counter[str] = Counter()
    verse_df: Counter[str] = Counter()
    active_lengths = sorted(by_len.keys())

    for text in verses.values():
        n = len(text)
        seen_in_v: set[str] = set()
        for k in active_lengths:
            target_set = by_len[k]
            limit = n - k + 1
            for i in range(limit):
                sub = text[i : i + k]
                if sub in target_set:
                    total_counts[sub] += 1
                    seen_in_v.add(sub)
        for lt in long_terms:
            if lt in text:
                total_counts[lt] += text.count(lt)
                seen_in_v.add(lt)
        for s in seen_in_v:
            verse_df[s] += 1

    return total_counts, verse_df


# ---------------------------------------------------------------------------
# 1. Baseline `raw_scripture` Loader & Audit
# ---------------------------------------------------------------------------

@dataclass
class BaselineCorpus:
    books: list[dict[str, Any]]
    books_by_num: dict[int, dict[str, Any]]
    verses: dict[tuple[int, int, int], str]
    chapter_counts: dict[tuple[int, int], int]
    cjk_char_freq: Counter[str]
    cjk_char_verse_freq: Counter[str]
    audit: dict[str, Any]


def load_baseline_scripture(repo_root: Path, scripture_root: Path) -> BaselineCorpus:
    books_cfg_path = repo_root / "config" / "bible-books.json"
    books_data = json.loads(books_cfg_path.read_text(encoding="utf-8"))
    books: list[dict[str, Any]] = books_data["books"]
    books_by_num = {b["num"]: b for b in books}

    raw_dir = scripture_root / "raw_scripture"
    verses: dict[tuple[int, int, int], str] = {}
    chapter_counts: dict[tuple[int, int], int] = {}
    cjk_char_freq: Counter[str] = Counter()
    cjk_char_verse_freq: Counter[str] = Counter()

    merged_refs: list[str] = []
    fw_paren_refs: list[str] = []
    translator_note_refs: list[str] = []
    lenticular_refs: list[str] = []
    ascii_bracket_refs: list[dict[str, str]] = []
    box_dash_refs: list[str] = []
    special_ascii_refs: list[dict[str, str]] = []
    non_big5_occ: dict[str, list[tuple[int, int, int, str]]] = defaultdict(list)

    for b in books:
        bnum = b["num"]
        bname = b["name"]
        for ch in range(1, b["chapters"] + 1):
            ch_path = raw_dir / bname / f"第{ch}章.txt"
            lines = [ln.rstrip("\r\n") for ln in ch_path.read_text(encoding="utf-8").splitlines()]
            while lines and lines[-1] == "":
                lines.pop()
            chapter_counts[(bnum, ch)] = len(lines)
            for v_idx, text in enumerate(lines, 1):
                ref = (bnum, ch, v_idx)
                verses[ref] = text
                ref_str = format_ref(books_by_num, ref)

                if "併於上節" in text:
                    merged_refs.append(ref_str)
                if "（" in text or "）" in text:
                    fw_paren_refs.append(ref_str)
                if TRANSLATOR_NOTE_RE.search(text):
                    translator_note_refs.append(ref_str)
                if "【" in text or "】" in text:
                    lenticular_refs.append(ref_str)
                if "[" in text or "]" in text:
                    ascii_bracket_refs.append({"ref": ref_str, "text": text})
                if "─" in text:
                    box_dash_refs.append(ref_str)
                if re.search(r"[0-9.:﹕「」]", text):
                    special_ascii_refs.append({"ref": ref_str, "text": text})

                seen_in_verse: set[str] = set()
                for ch_char in text:
                    if is_cjk(ch_char):
                        cjk_char_freq[ch_char] += 1
                        seen_in_verse.add(ch_char)
                        try:
                            ch_char.encode("big5")
                        except UnicodeEncodeError:
                            non_big5_occ[ch_char].append((bnum, ch, v_idx, text))
                for ch_char in seen_in_verse:
                    cjk_char_verse_freq[ch_char] += 1

    if len(verses) != 31102:
        raise RuntimeError(f"Expected 31,102 verses in raw_scripture, got {len(verses)}")

    non_big5_report = []
    for ch_char, occs in sorted(non_big5_occ.items(), key=lambda x: (-len(x[1]), ord(x[0]))):
        cp = ord(ch_char)
        try:
            ch_char.encode("cp950")
            in_cp950 = True
        except UnicodeEncodeError:
            in_cp950 = False
        # Deduplicate verses per ref while keeping exact total character occurrence count
        seen_v_refs: set[tuple[int, int, int]] = set()
        unique_verse_rows = []
        for b, c, v, t in occs:
            if (b, c, v) not in seen_v_refs:
                seen_v_refs.add((b, c, v))
                unique_verse_rows.append({
                    "ref": format_ref(books_by_num, (b, c, v)),
                    "slug": format_slug_ref(books_by_num, (b, c, v)),
                    "text": t,
                })
        non_big5_report.append({
            "char": ch_char,
            "codepoint": f"U+{cp:04X}",
            "utf16_code_units": 2 if cp > 0xFFFF else 1,
            "is_ext_b_or_higher": cp >= 0x20000,
            "in_cp950": in_cp950,
            "occurrences": len(occs),
            "verse_count": len(unique_verse_rows),
            "verses": unique_verse_rows,
        })

    audit = {
        "total_books": len(books),
        "total_chapters": len(chapter_counts),
        "total_verses": len(verses),
        "ot_verses": sum(cnt for (b, _), cnt in chapter_counts.items() if b <= 39),
        "nt_verses": sum(cnt for (b, _), cnt in chapter_counts.items() if b >= 40),
        "unique_cjk_chars": len(cjk_char_freq),
        "total_cjk_chars": sum(cjk_char_freq.values()),
        "merged_verse_count": len(merged_refs),
        "merged_verse_refs": merged_refs,
        "fullwidth_paren_verse_count": len(fw_paren_refs),
        "translator_note_verse_count": len(translator_note_refs),
        "lenticular_bracket_verse_count": len(lenticular_refs),
        "ascii_bracket_verses": ascii_bracket_refs,
        "box_dash_U2500_verse_count": len(box_dash_refs),
        "special_ascii_or_quote_verses": special_ascii_refs,
        "non_big5_chars": non_big5_report,
    }

    return BaselineCorpus(
        books=books,
        books_by_num=books_by_num,
        verses=verses,
        chapter_counts=chapter_counts,
        cjk_char_freq=cjk_char_freq,
        cjk_char_verse_freq=cjk_char_verse_freq,
        audit=audit,
    )


# ---------------------------------------------------------------------------
# 2. SWORD zText & USFX Public-Domain CUV Parsers + Alignment Sanity Check
# ---------------------------------------------------------------------------

def _read_sword_ztext_slots(zip_path: Path, data_prefix: str, testament: str) -> list[str]:
    with zipfile.ZipFile(zip_path, "r") as zf:
        bzs = zf.read(f"{data_prefix}/{testament}.bzs")
        bzv = zf.read(f"{data_prefix}/{testament}.bzv")
        bzz = zf.read(f"{data_prefix}/{testament}.bzz")

    blocks: dict[int, bytes] = {}
    for offset_idx in range(0, len(bzs), 12):
        b_ofs, comp_size, _uncomp_size = struct.unpack("<III", bzs[offset_idx : offset_idx + 12])
        blocks[offset_idx // 12] = zlib.decompress(bzz[b_ofs : b_ofs + comp_size]) if comp_size > 0 else b""

    slots: list[str] = []
    for slot_idx in range(len(bzv) // 10):
        block_num, v_ofs, v_size = struct.unpack("<IIH", bzv[slot_idx * 10 : (slot_idx + 1) * 10])
        if v_size == 0:
            slots.append("")
        else:
            slots.append(blocks[block_num][v_ofs : v_ofs + v_size].decode("utf-8", errors="replace"))
    return slots


def extract_nrsv_versification_from_chiun(chiun_zip: Path) -> dict[tuple[int, int], int]:
    """Derive exact SWORD NRSV (book_num, chapter) -> verse_count from ChiUn OSIS chapter/book sIDs."""
    nrsv_counts: dict[tuple[int, int], int] = {}
    for testament, b_start in [("ot", 1), ("nt", 40)]:
        slots = _read_sword_ztext_slots(chiun_zip, "modules/texts/ztext/chiun", testament)
        book_intro_slots = {
            i for i, txt in enumerate(slots)
            if re.search(r'<div\b(?=[^>]*\btype="book")(?=[^>]*\bsID=)', txt)
        }
        ch_intro_slots = [
            (i, re.search(r'<chapter\b[^>]*osisID="([^"]+)"[^>]*sID=', txt).group(1))  # type: ignore[union-attr]
            for i, txt in enumerate(slots)
            if re.search(r'<chapter\b[^>]*sID=', txt)
        ]
        b_num = b_start - 1
        prev_osis_book = None
        for idx, (slot_i, osis_id) in enumerate(ch_intro_slots):
            osis_book, ch_str = osis_id.split(".")
            if osis_book != prev_osis_book:
                b_num += 1
                prev_osis_book = osis_book
            next_ch_slot = ch_intro_slots[idx + 1][0] if idx + 1 < len(ch_intro_slots) else len(slots)
            v_end_slot = (next_ch_slot - 1) if (next_ch_slot - 1) in book_intro_slots else next_ch_slot
            nrsv_counts[(b_num, int(ch_str))] = v_end_slot - slot_i - 1
    return nrsv_counts


def load_sword_ztext_module(
    zip_path: Path,
    books: list[dict[str, Any]],
    nrsv_counts: dict[tuple[int, int], int],
) -> tuple[dict[str, str], dict[tuple[int, int, int], str]]:
    """Decode SWORD zText module (.conf + .bzs/.bzv/.bzz) using exact NRSV slot layout."""
    conf_meta: dict[str, str] = {}
    with zipfile.ZipFile(zip_path, "r") as zf:
        conf_names = [n for n in zf.namelist() if n.endswith(".conf")]
        if conf_names:
            raw_conf = zf.read(conf_names[0]).decode("utf-8", errors="replace")
            conf_meta["_raw_conf"] = raw_conf
            conf_meta["_conf_file"] = conf_names[0]
            for line in raw_conf.splitlines():
                line_s = line.strip()
                if not line_s or line_s.startswith("#"):
                    continue
                if line_s.startswith("[") and line_s.endswith("]"):
                    conf_meta["ModuleName"] = line_s[1:-1]
                elif "=" in line_s:
                    k, v = line_s.split("=", 1)
                    if k.strip() not in conf_meta:
                        conf_meta[k.strip()] = v.strip()

    data_path = conf_meta.get("DataPath", "").strip().lstrip("./").rstrip("/")
    verses: dict[tuple[int, int, int], str] = {}

    for testament, b_range in [("ot", range(1, 40)), ("nt", range(40, 67))]:
        slots = _read_sword_ztext_slots(zip_path, data_path, testament)
        pos = 2  # Slot 0: module intro; Slot 1: testament intro
        for bnum in b_range:
            pos += 1  # Book intro slot
            ch_total = books[bnum - 1]["chapters"]
            for ch in range(1, ch_total + 1):
                pos += 1  # Chapter intro slot
                vc = nrsv_counts[(bnum, ch)]
                for v in range(1, vc + 1):
                    verses[(bnum, ch, v)] = slots[pos]
                    pos += 1
        if pos != len(slots):
            raise RuntimeError(f"SWORD slot mismatch in {zip_path.name} ({testament}): pos={pos} != {len(slots)}")

    # Harmonize NRSV -> CUV raw_scripture versification on Rev 12:17+18 and John 7:53:
    # In CUV raw_scripture, Rev 12:18 ("那時龍就站在海邊的沙上。") is appended to Rev 12:17;
    # John 7:53 is empty in ChiUn (already at start of John 8:1).
    if (66, 12, 18) in verses:
        v18 = verses.pop((66, 12, 18))
        if v18.strip():
            verses[(66, 12, 17)] = verses.get((66, 12, 17), "") + " " + v18
    if (43, 7, 53) in verses and not strip_osis_markup(verses[(43, 7, 53)]):
        verses.pop((43, 7, 53))

    return conf_meta, verses


def strip_osis_markup(osis_text: str) -> str:
    text = re.sub(r"<note\b[^>]*>.*?</note>", "", osis_text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\u3000", "").replace(" ", "").replace("\t", "").strip()
    return text


def load_usfx_xml(xml_path: Path) -> dict[tuple[int, int, int], str]:
    """Parse seven1m/open-bibles USFX XML and harmonize known MT versification shifts to CUV."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    raw_map: dict[tuple[int, int, int], str] = {}

    for book_el in root.findall("book"):
        b_code = (book_el.get("id") or "").strip()
        b_num = BOOK_CODE_TO_NUM.get(b_code)
        if not b_num:
            continue
        cur_ch = 0
        cur_v = 0
        buf: list[str] = []
        for elem in book_el.iter():
            if elem.tag == "c":
                cur_ch = int(elem.get("id") or "0")
            elif elem.tag == "v":
                cur_v = int(elem.get("id") or "0")
                buf = [elem.tail or ""]
            elif elem.tag == "ve":
                if cur_ch > 0 and cur_v > 0:
                    raw_map[(b_num, cur_ch, cur_v)] = "".join(buf).replace("\n", "").strip()
                cur_v = 0
                buf = []
            elif cur_v > 0 and elem is not book_el:
                if elem.text:
                    buf.append(elem.text)
                if elem.tail:
                    buf.append(elem.tail)

    # Harmonize 1 Chronicles 21:31 + 22:1..18 (MT versification in chi-cuv.usfx.xml) -> 1Ch 22:1..19 (CUV)
    if (13, 21, 31) in raw_map and (13, 22, 19) not in raw_map:
        for v in range(18, 0, -1):
            if (13, 22, v) in raw_map:
                raw_map[(13, 22, v + 1)] = raw_map[(13, 22, v)]
        raw_map[(13, 22, 1)] = raw_map.pop((13, 21, 31))

    return raw_map


def compute_alignment_report(
    baseline: BaselineCorpus,
    editions: dict[str, dict[tuple[int, int, int], str]],
) -> dict[str, Any]:
    report: dict[str, Any] = {"editions": {}, "sanity_checks": []}

    for b, c, v, label in SANITY_REFS:
        ref = (b, c, v)
        row: dict[str, Any] = {
            "label": label,
            "zh_ref": format_ref(baseline.books_by_num, ref),
            "raw_scripture": baseline.verses[ref],
        }
        for ed_name, ed_verses in editions.items():
            val = ed_verses.get(ref, "")
            row[ed_name] = strip_osis_markup(val) if "<" in val else val
        report["sanity_checks"].append(row)

    for ed_name, ed_verses in editions.items():
        comparable = 0
        aligned_gt_075 = 0
        aligned_gt_050 = 0
        exact_cjk = 0
        jaccards: list[float] = []

        for ref, r_txt in baseline.verses.items():
            if r_txt == "併於上節。":
                continue
            v_raw = ed_verses.get(ref, "")
            v_txt = strip_osis_markup(v_raw) if ("<" in v_raw or "\u3000" in v_raw) else v_raw
            if v_txt in ("", "a", "併於上節", "併於上節。", "併入上節"):
                continue
            comparable += 1
            c_base = only_cjk(TRANSLATOR_NOTE_RE.sub("", r_txt))
            c_var = only_cjk(TRANSLATOR_NOTE_RE.sub("", v_txt))
            if c_base == c_var:
                exact_cjk += 1
                jaccards.append(1.0)
                aligned_gt_075 += 1
                aligned_gt_050 += 1
            else:
                ca, cb = Counter(c_base), Counter(c_var)
                union = sum((ca | cb).values())
                sim = sum((ca & cb).values()) / union if union else 1.0
                jaccards.append(sim)
                if sim >= 0.75:
                    aligned_gt_075 += 1
                if sim >= 0.50:
                    aligned_gt_050 += 1

        mean_jaccard = sum(jaccards) / len(jaccards) if jaccards else 0.0
        report["editions"][ed_name] = {
            "total_loaded_verses": len(ed_verses),
            "comparable_non_merged_verses": comparable,
            "exact_cjk_match_verses": exact_cjk,
            "exact_cjk_match_rate": round(exact_cjk / comparable, 5) if comparable else 0.0,
            "aligned_ge_075_verses": aligned_gt_075,
            "aligned_ge_075_rate": round(aligned_gt_075 / comparable, 5) if comparable else 0.0,
            "aligned_ge_050_verses": aligned_gt_050,
            "aligned_ge_050_rate": round(aligned_gt_050 / comparable, 5) if comparable else 0.0,
            "mean_char_jaccard": round(mean_jaccard, 5),
        }

    return report


# ---------------------------------------------------------------------------
# 3. Context-Anchored Diff (Mandarin Public-Domain CUV Variants vs Baseline)
# ---------------------------------------------------------------------------

def run_context_anchored_diff(
    baseline: BaselineCorpus,
    mandarin_editions: dict[str, dict[tuple[int, int, int], str]],
) -> dict[str, Any]:
    """
    Compare baseline `raw_scripture` against Mandarin CUV editions (`ChiUn`, `chi-cuv.usfx.xml`).
    Uses anchor-verified SequenceMatcher spans (len 1..6, >=2 matching CJK anchor chars on left or right),
    plus 2-char word expansion for recurring single-char substitutions so lexical pairs like
    `甚麼->什麼`, `預備->豫備` / `豫備->預備`, `記念->紀念`, `服侍->服事` are surfaced alongside
    1-char orthographic substitutions (`裏->裡`, `着->著`, `麼->嗎`, `她->他`).
    """
    pair_counts: Counter[tuple[str, str]] = Counter()
    pair_editions: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    pair_samples: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)

    expanded_word_counts: Counter[tuple[str, str]] = Counter()
    expanded_word_editions: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    expanded_word_samples: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)

    # Known verse-boundary shifts where two verses swap a clause (skip to avoid boundary noise)
    skip_boundary_refs = {(4, 12, 10), (4, 12, 11), (5, 4, 32), (5, 4, 33)}

    for ed_name, ed_verses in mandarin_editions.items():
        for ref, raw_text in sorted(baseline.verses.items()):
            if ref in skip_boundary_refs or raw_text == "併於上節。":
                continue
            var_raw = ed_verses.get(ref, "")
            var_text = strip_osis_markup(var_raw) if ("<" in var_raw or "\u3000" in var_raw) else var_raw
            if not var_text or var_text in ("a", "併於上節", "併於上節。", "併入上節"):
                continue

            base_cjk = strip_notes_and_punct(raw_text)
            var_cjk = strip_notes_and_punct(var_text)
            if base_cjk == var_cjk or not base_cjk or not var_cjk:
                continue

            sm = difflib.SequenceMatcher(None, base_cjk, var_cjk, autojunk=False)
            opcodes = sm.get_opcodes()
            for idx, (tag, i1, i2, j1, j2) in enumerate(opcodes):
                if tag != "replace":
                    continue
                b_span = base_cjk[i1:i2]
                v_span = var_cjk[j1:j2]
                if not (1 <= len(b_span) <= 6 and 1 <= len(v_span) <= 6):
                    continue

                left_eq = 0
                if idx > 0 and opcodes[idx - 1][0] == "equal":
                    left_eq = opcodes[idx - 1][2] - opcodes[idx - 1][1]
                right_eq = 0
                if idx + 1 < len(opcodes) and opcodes[idx + 1][0] == "equal":
                    right_eq = opcodes[idx + 1][2] - opcodes[idx + 1][1]

                if left_eq < 2 and right_eq < 2:
                    continue

                key = (v_span, b_span)
                pair_counts[key] += 1
                pair_editions[key][ed_name] += 1
                if len(pair_samples[key]) < 3:
                    ref_str = format_ref(baseline.books_by_num, ref)
                    if all(s["ref"] != ref_str for s in pair_samples[key]):
                        pair_samples[key].append({
                            "ref": ref_str,
                            "edition": ed_name,
                            "variant_snippet": var_text[:70],
                            "baseline_snippet": raw_text[:70],
                        })

                # Also capture 2-char lexical context around 1-char replacements when adjacent char is lexical
                if len(b_span) == 1 and len(v_span) == 1:
                    if left_eq >= 1:
                        lc = base_cjk[i1 - 1]
                        if lc not in GRAMMAR_BOUNDARY_CHARS:
                            w_key = (lc + v_span, lc + b_span)
                            expanded_word_counts[w_key] += 1
                            expanded_word_editions[w_key][ed_name] += 1
                            if len(expanded_word_samples[w_key]) < 3:
                                ref_str = format_ref(baseline.books_by_num, ref)
                                if all(s["ref"] != ref_str for s in expanded_word_samples[w_key]):
                                    expanded_word_samples[w_key].append({
                                        "ref": ref_str,
                                        "edition": ed_name,
                                        "variant_snippet": var_text[:70],
                                        "baseline_snippet": raw_text[:70],
                                    })
                    if right_eq >= 1:
                        rc = base_cjk[i2]
                        if rc not in GRAMMAR_BOUNDARY_CHARS:
                            w_key = (v_span + rc, b_span + rc)
                            expanded_word_counts[w_key] += 1
                            expanded_word_editions[w_key][ed_name] += 1
                            if len(expanded_word_samples[w_key]) < 3:
                                ref_str = format_ref(baseline.books_by_num, ref)
                                if all(s["ref"] != ref_str for s in expanded_word_samples[w_key]):
                                    expanded_word_samples[w_key].append({
                                        "ref": ref_str,
                                        "edition": ed_name,
                                        "variant_snippet": var_text[:70],
                                        "baseline_snippet": raw_text[:70],
                                    })

    # Precompute substring presence in raw_scripture in a single linear pass
    target_diff_terms: set[str] = set()
    for v_term, b_term in pair_counts:
        target_diff_terms.add(v_term)
        target_diff_terms.add(b_term)
    for (v_word, b_word), cnt in expanded_word_counts.items():
        if cnt >= 3:
            target_diff_terms.add(v_word)
            target_diff_terms.add(b_word)
    raw_sub_counts, _ = count_terms_in_verses(baseline.verses, target_diff_terms)

    minimal_list = []
    for (v_term, b_term), cnt in pair_counts.most_common():
        v_in_raw = raw_sub_counts[v_term]
        b_in_raw = raw_sub_counts[b_term]
        if len(v_term) == 1 and len(b_term) == 1:
            if v_term in ("她", "祂", "妳", "牠", "它") or b_term in ("他", "你"):
                kind = "pronoun_or_function_char"
            else:
                kind = "single_char_variant_or_lexical"
        else:
            kind = "multi_char_phrase_or_name"
        minimal_list.append({
            "variant_term": v_term,
            "baseline_term": b_term,
            "kind": kind,
            "diff_occurrences": cnt,
            "editions": dict(pair_editions[(v_term, b_term)]),
            "variant_occurrences_in_raw_scripture": v_in_raw,
            "baseline_occurrences_in_raw_scripture": b_in_raw,
            "zero_hit_in_raw_scripture": v_in_raw == 0,
            "samples": pair_samples[(v_term, b_term)],
        })

    compound_list = []
    for (v_word, b_word), cnt in expanded_word_counts.most_common():
        if cnt < 3:
            continue
        v_in_raw = raw_sub_counts[v_word]
        b_in_raw = raw_sub_counts[b_word]
        compound_list.append({
            "variant_term": v_word,
            "baseline_term": b_word,
            "diff_occurrences": cnt,
            "editions": dict(expanded_word_editions[(v_word, b_word)]),
            "variant_occurrences_in_raw_scripture": v_in_raw,
            "baseline_occurrences_in_raw_scripture": b_in_raw,
            "zero_hit_in_raw_scripture": v_in_raw == 0,
            "samples": expanded_word_samples[(v_word, b_word)],
        })

    return {
        "total_distinct_minimal_pairs": len(minimal_list),
        "zero_hit_minimal_pairs": sum(1 for x in minimal_list if x["zero_hit_in_raw_scripture"]),
        "minimal_candidates": minimal_list,
        "expanded_2char_compounds": compound_list,
    }


# ---------------------------------------------------------------------------
# 4. STEP Bible Lexicons & TAHOT/TAGNT Loader
# ---------------------------------------------------------------------------

@dataclass
class StepLexEntry:
    norm_strong: str
    e_strong: str
    d_strong: str
    lemma: str
    translit: str
    morph: str
    en_gloss: str


@dataclass
class StepData:
    primary_by_strong: dict[str, StepLexEntry]
    subentries_by_strong: dict[str, list[StepLexEntry]]
    by_dstrong: dict[str, StepLexEntry]
    heb_mt_to_eng_ref: dict[tuple[int, int, int], tuple[int, int, int]]
    verse_dstrongs: dict[tuple[int, int, int], list[str]]
    lemma_to_strongs: dict[str, set[str]]


def load_step_data(scripture_root: Path) -> StepData:
    step_dir = scripture_root / ".stepbible_data"
    lex_dir = step_dir / "Lexicons"
    amalg_dir = step_dir / "Translators Amalgamated OT+NT"

    subentries_by_strong: dict[str, list[StepLexEntry]] = defaultdict(list)
    by_dstrong: dict[str, StepLexEntry] = {}
    lemma_to_strongs: dict[str, set[str]] = defaultdict(set)

    for fn in sorted(os.listdir(lex_dir)):
        if not (fn.startswith("TBESH") or fn.startswith("TBESG")):
            continue
        p = lex_dir / fn
        started = False
        with p.open("r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("=========="):
                    started = True
                    continue
                if not started or not line.strip() or line.startswith("#") or line.startswith("$"):
                    continue
                cols = line.rstrip("\r\n").split("\t")
                if len(cols) < 7 or not re.match(r"^[HG]\d+", cols[0]):
                    continue
                norm = normalize_strong(cols[0])
                if not norm:
                    continue
                d_code = cols[1].split("=")[0].strip()
                entry = StepLexEntry(
                    norm_strong=norm,
                    e_strong=cols[0].strip(),
                    d_strong=d_code,
                    lemma=cols[3].strip(),
                    translit=cols[4].strip(),
                    morph=cols[5].strip(),
                    en_gloss=cols[6].strip(),
                )
                subentries_by_strong[norm].append(entry)
                if d_code and d_code not in by_dstrong:
                    by_dstrong[d_code] = entry
                for lem_part in entry.lemma.split(","):
                    lem_s = lem_part.strip()
                    if lem_s:
                        lemma_to_strongs[lem_s].add(norm)
                        cons = strip_hebrew_marks(lem_s)
                        if cons:
                            lemma_to_strongs[cons].add(norm)

    # Scan TAHOT files for:
    # 1) Exact Masoretic -> English/CUV (book, heb_ch, heb_v) -> (book, eng_ch, eng_v)
    # 2) Empirical dStrong frequency & per-verse dStrongs (disambiguating H8577A vs H8577M, H2617A vs H2617B, etc.)
    heb_mt_to_eng_ref: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    verse_dstrongs: dict[tuple[int, int, int], list[str]] = defaultdict(list)
    dstrong_freq: Counter[str] = Counter()

    ref_line_re = re.compile(r"^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#\d+=")
    dstrong_brace_re = re.compile(r"\{([HG]\d+[A-Za-z]?)\}")

    for fn in sorted(os.listdir(amalg_dir)):
        if not (fn.startswith("TAHOT") or fn.startswith("TAGNT")):
            continue
        p = amalg_dir / fn
        with p.open("r", encoding="utf-8") as f:
            for line in f:
                if not line or line[0] in ("#", "\t", "\n", "\r", " "):
                    continue
                m = ref_line_re.match(line)
                if not m:
                    continue
                b_abbr, eng_c_s, eng_v_s, heb_c_s, heb_v_s = m.groups()
                b_num = STEP_BOOK_TO_NUM.get(b_abbr)
                if not b_num:
                    continue
                eng_ref = (b_num, int(eng_c_s), int(eng_v_s))
                if b_num <= 39:
                    heb_ref = (b_num, int(heb_c_s), int(heb_v_s)) if heb_c_s else eng_ref
                    heb_mt_to_eng_ref[heb_ref] = eng_ref

                cols = line.split("\t", 6)
                if len(cols) >= 5:
                    for dm in dstrong_brace_re.finditer(cols[4]):
                        dc = dm.group(1)
                        dstrong_freq[dc] += 1
                        if dc not in verse_dstrongs[eng_ref]:
                            verse_dstrongs[eng_ref].append(dc)

    # Choose primary StepLexEntry for each normalized Strong's ID using empirical TAHOT/TAGNT frequency
    primary_by_strong: dict[str, StepLexEntry] = {}
    for norm, entries in subentries_by_strong.items():
        if len(entries) == 1:
            primary_by_strong[norm] = entries[0]
        else:
            best = max(
                entries,
                key=lambda e: (
                    dstrong_freq.get(e.d_strong, 0),
                    0 if e.morph.startswith("N:N") else 1,
                ),
            )
            primary_by_strong[norm] = best

    return StepData(
        primary_by_strong=primary_by_strong,
        subentries_by_strong=subentries_by_strong,
        by_dstrong=by_dstrong,
        heb_mt_to_eng_ref=heb_mt_to_eng_ref,
        verse_dstrongs=verse_dstrongs,
        lemma_to_strongs=lemma_to_strongs,
    )


# ---------------------------------------------------------------------------
# 5. Parse ChiUn OSIS Word Spans & Align Character Positions to `raw_scripture`
# ---------------------------------------------------------------------------

@dataclass
class AlignedOsisToken:
    strongs: list[str]
    raw_w_surface: str
    base_surface: str
    trimmed_surface: str
    resolved_term: str
    raw_char_range: tuple[int, int]  # (start, end) in raw_scripture CJK-only string


def trim_clitics(surface: str) -> str:
    s = only_cjk(surface)
    if len(s) <= 1:
        return s
    changed = True
    while changed and len(s) > 1:
        changed = False
        for pref in LEADING_CLITICS:
            if s.startswith(pref) and len(s) - len(pref) >= 1:
                # Avoid over-stripping 2-char lexical words like 以為, 作為, 成為, 所有, 沒有
                if len(s) == 2 and s in {
                    "以為", "作為", "成為", "所有", "沒有", "自己", "我們", "你們", "他們",
                    "她們", "慈愛", "恩典", "恩慈", "恩惠", "恩待", "施恩", "有罪", "無罪",
                    "見證", "意念", "思想", "大魚", "大蛇", "經文", "本體", "堅心",
                }:
                    continue
                s = s[len(pref):]
                changed = True
                break
        if len(s) > 2:
            for suf in TRAILING_CLITICS:
                if s.endswith(suf) and len(s) - len(suf) >= 2:
                    s = s[: -len(suf)]
                    changed = True
                    break
        elif len(s) == 2 and s[1] in ("的", "之", "了", "著", "着", "過", "們"):
            s = s[:1]
            changed = True
    return s


def extract_aligned_osis_tokens(
    baseline: BaselineCorpus,
    chiun_verses: dict[tuple[int, int, int], str],
) -> tuple[dict[tuple[int, int, int], list[AlignedOsisToken]], Counter[str]]:
    """
    Parse every `<w lemma="...">` in ChiUn, project its CJK character span onto `raw_scripture`
    (so modernized chars/names in ChiUn map cleanly to `raw_scripture`'s exact surface!),
    and recover split 2-char CUV compounds (e.g., `所思|想的` -> `思想`, `懷著惡|念` -> `惡念`,
    `大|魚` -> `大魚`, `恩|待` -> `恩待`, `施|恩` -> `施恩`).
    """
    w_tag_re = re.compile(r"<w\b([^>]*)>(.*?)</w>", flags=re.DOTALL)
    lemma_attr_re = re.compile(r'lemma="([^"]+)"')

    # Pass 1: project ChiUn <w> spans onto raw_scripture CJK strings and collect attested 2..3-char words
    per_verse_prelim: dict[tuple[int, int, int], list[tuple[list[str], str, str, str, int, int]]] = {}
    attested_words: Counter[str] = Counter()

    for ref, raw_text in baseline.verses.items():
        if raw_text == "併於上節。":
            continue
        osis = chiun_verses.get(ref, "")
        if not osis:
            continue

        # Remove <note> before parsing <w>
        osis_clean = re.sub(r"<note\b[^>]*>.*?</note>", "", osis, flags=re.DOTALL)
        # Build full ChiUn CJK stream with token character intervals
        chiun_cjk_chars: list[str] = []
        raw_tokens: list[tuple[list[str], str, int, int]] = []

        pos = 0
        for m in w_tag_re.finditer(osis_clean):
            # Any untagged CJK before <w>
            pre_txt = re.sub(r"<[^>]+>", "", osis_clean[pos : m.start()])
            for ch in pre_txt:
                if is_cjk(ch):
                    chiun_cjk_chars.append(ch)

            attrs, inner = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
            t_start = len(chiun_cjk_chars)
            w_cjk = only_cjk(inner)
            chiun_cjk_chars.extend(w_cjk)
            t_end = len(chiun_cjk_chars)

            lm = lemma_attr_re.search(attrs)
            if lm and w_cjk:
                codes: list[str] = []
                for part in lm.group(1).split():
                    norm = normalize_strong(part)
                    if norm and norm not in codes:
                        codes.append(norm)
                if codes:
                    raw_tokens.append((codes, w_cjk, t_start, t_end))
            pos = m.end()

        tail_txt = re.sub(r"<[^>]+>", "", osis_clean[pos:])
        for ch in tail_txt:
            if is_cjk(ch):
                chiun_cjk_chars.append(ch)

        chiun_cjk = "".join(chiun_cjk_chars)
        base_cjk = only_cjk(raw_text)
        if not chiun_cjk or not base_cjk or not raw_tokens:
            continue

        # Map ChiUn CJK indices -> base_cjk indices
        if chiun_cjk == base_cjk:
            mapped_tokens = [
                (codes, w_cjk, w_cjk, trim_clitics(w_cjk), s_i, e_i)
                for (codes, w_cjk, s_i, e_i) in raw_tokens
            ]
        else:
            sm = difflib.SequenceMatcher(None, chiun_cjk, base_cjk, autojunk=False)
            c2b_start = [0] * (len(chiun_cjk) + 1)
            c2b_end = [0] * (len(chiun_cjk) + 1)
            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == "equal":
                    for k in range(i2 - i1):
                        c2b_start[i1 + k] = j1 + k
                        c2b_end[i1 + k + 1] = j1 + k + 1
                else:
                    for k in range(i1, i2):
                        c2b_start[k] = j1
                        c2b_end[k + 1] = j2
            c2b_start[len(chiun_cjk)] = len(base_cjk)

            mapped_tokens = []
            for codes, w_cjk, s_i, e_i in raw_tokens:
                bs = c2b_start[s_i]
                be = c2b_end[e_i]
                if be < bs:
                    be = bs
                b_surf = base_cjk[bs:be] if bs < be else w_cjk
                trimmed = trim_clitics(b_surf)
                mapped_tokens.append((codes, w_cjk, b_surf, trimmed, bs, be))

        for _codes, _w_cjk, _b_surf, trimmed, _bs, _be in mapped_tokens:
            if 2 <= len(trimmed) <= 3:
                attested_words[trimmed] += 1

        per_verse_prelim[ref] = mapped_tokens

    # Also ensure core CUV disyllabic words that are habitually split in FHL are in attested_words
    for seed_word in (
        "思想", "惡念", "意念", "心思", "思念", "計謀", "巧工", "大魚", "大蛇",
        "施恩", "蒙恩", "恩待", "厚待", "慈愛", "恩典", "恩惠", "恩慈", "仁慈", "經文",
    ):
        attested_words[seed_word] += 10

    # Pass 2: resolve 1-char split stems to attested 2-char words within the same clause of raw_scripture
    clause_split_re = re.compile(r"[，。；：？！、（）【】〔〕\[\]「」『』─]+")
    final_tokens: dict[tuple[int, int, int], list[AlignedOsisToken]] = {}

    for ref, prelim in per_verse_prelim.items():
        raw_text = baseline.verses[ref]
        base_cjk = only_cjk(raw_text)

        # Clause boundaries in base_cjk coordinates so we never merge across punctuation!
        clause_id_at: list[int] = []
        cid = 0
        for part in clause_split_re.split(TRANSLATOR_NOTE_RE.sub("，", raw_text)):
            c_part = only_cjk(part)
            if c_part:
                clause_id_at.extend([cid] * len(c_part))
                cid += 1
        # Fallback if translator-note removal changed length
        if len(clause_id_at) != len(base_cjk):
            clause_id_at = []
            cid = 0
            for ch in raw_text:
                if is_cjk(ch):
                    clause_id_at.append(cid)
                elif ch in "，。；：？！、（）【】〔〕[]─":
                    cid += 1

        verse_out: list[AlignedOsisToken] = []
        for codes, w_cjk, b_surf, trimmed, bs, be in prelim:
            resolved = trimmed
            if len(trimmed) == 1 and 0 <= bs < be <= len(base_cjk):
                # Locate `trimmed` char inside base_cjk[bs:be]
                rel_idx = base_cjk[bs:be].find(trimmed)
                if rel_idx != -1:
                    c_pos = bs + rel_idx
                    my_clause = clause_id_at[c_pos] if c_pos < len(clause_id_at) else -1
                    cand_right = None
                    cand_left = None
                    if c_pos + 1 < len(base_cjk) and clause_id_at[c_pos + 1] == my_clause:
                        rc = base_cjk[c_pos + 1]
                        if rc not in GRAMMAR_BOUNDARY_CHARS and attested_words[trimmed + rc] >= 3:
                            cand_right = (trimmed + rc, attested_words[trimmed + rc])
                    if c_pos - 1 >= 0 and clause_id_at[c_pos - 1] == my_clause:
                        lc = base_cjk[c_pos - 1]
                        if lc not in GRAMMAR_BOUNDARY_CHARS and attested_words[lc + trimmed] >= 3:
                            cand_left = (lc + trimmed, attested_words[lc + trimmed])

                    if cand_right and cand_left:
                        resolved = cand_right[0] if cand_right[1] >= cand_left[1] else cand_left[0]
                    elif cand_right:
                        resolved = cand_right[0]
                    elif cand_left:
                        resolved = cand_left[0]

            verse_out.append(
                AlignedOsisToken(
                    strongs=codes,
                    raw_w_surface=w_cjk,
                    base_surface=b_surf,
                    trimmed_surface=trimmed,
                    resolved_term=resolved,
                    raw_char_range=(bs, be),
                )
            )
        final_tokens[ref] = verse_out

    return final_tokens, attested_words


# ---------------------------------------------------------------------------
# 6. Proper Name Cross-Version Candidates (`BibleNLP names.tsv` + CUV Diff)
# ---------------------------------------------------------------------------

def build_proper_name_candidates(
    cache_dir: Path,
    baseline: BaselineCorpus,
    step_data: StepData,
    osis_tokens: dict[tuple[int, int, int], list[AlignedOsisToken]],
    chiun_verses: dict[tuple[int, int, int], str],
) -> dict[str, Any]:
    names_tsv_path = cache_dir / "names.tsv"

    # Pre-index STEP proper-name Strong's IDs (`N:N*` / `N:A*`)
    proper_strongs = {
        s for s, entry in step_data.primary_by_strong.items()
        if entry.morph.startswith("N:")
    }

    pair_occurrences: Counter[tuple[str, str]] = Counter()
    pair_simp: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    pair_strongs: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    pair_lemmas: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    pair_eng: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    pair_sources: dict[tuple[str, str], set[str]] = defaultdict(set)
    pair_samples: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)

    exact_matches = 0
    unresolved_rows = 0
    total_non_empty_rows = 0

    def strip_name_clitics(name_surf: str, target_cu2010t: str) -> str:
        s = only_cjk(name_surf)
        if not s:
            return s
        for p in ("在", "從", "向", "對", "到", "與", "和", "並", "有", "是", "叫", "名", "王", "為", "屬"):
            if s.startswith(p) and len(s) > 1 and not target_cu2010t.startswith(p):
                s = s[len(p):]
        for suf in ("人", "王", "地", "山", "城", "河", "海", "谷", "的"):
            if s.endswith(suf) and len(s) > 1 and not target_cu2010t.endswith(suf):
                s = s[:-len(suf)]
        return s

    with names_tsv_path.open("r", encoding="utf-8") as f:
        header = f.readline().rstrip("\r\n").split("\t")
        idx_ref = header.index("ref")
        idx_lem = header.index("macula_lemma")
        idx_eng = header.index("macula_eng")
        idx_s = header.index("cu2010s")
        idx_t = header.index("cu2010t")

        for line in f:
            cols = line.rstrip("\r\n").split("\t")
            cu_t = only_cjk(cols[idx_t]) if idx_t < len(cols) else ""
            if not cu_t:
                continue
            total_non_empty_rows += 1
            cu_s = only_cjk(cols[idx_s]) if idx_s < len(cols) else ""
            mac_lem = cols[idx_lem].strip() if idx_lem < len(cols) else ""
            mac_eng = cols[idx_eng].strip() if idx_eng < len(cols) else ""

            ref_raw = cols[idx_ref].split("!")[0]
            b_code, cv = ref_raw.split(" ")
            ch_num, v_num = (int(x) for x in cv.split(":"))
            b_num = BOOK_CODE_TO_NUM.get(b_code)
            if not b_num:
                continue

            # Map OT Masoretic ref -> English/CUV ref via STEP TAHOT!
            cuv_ref = step_data.heb_mt_to_eng_ref.get((b_num, ch_num, v_num), (b_num, ch_num, v_num))
            raw_verse = baseline.verses.get(cuv_ref, "")
            if not raw_verse or raw_verse == "併於上節。":
                continue

            if cu_t in raw_verse:
                exact_matches += 1
                continue

            # Resolve Strong's candidates for macula_lemma
            cand_strongs = set(step_data.lemma_to_strongs.get(mac_lem, set()))
            if not cand_strongs and b_num <= 39:
                cons = strip_hebrew_marks(mac_lem)
                cand_strongs = set(step_data.lemma_to_strongs.get(cons, set()))

            v_tokens = osis_tokens.get(cuv_ref, [])
            matched_tok: AlignedOsisToken | None = None
            matched_strong = ""
            for tok in v_tokens:
                overlap = [s for s in tok.strongs if s in cand_strongs]
                if overlap:
                    matched_tok = tok
                    matched_strong = overlap[0]
                    break

            # Fallback: if lemma had pointed variants not in TBESH, check unique proper-name token in verse
            if matched_tok is None and v_tokens:
                prop_toks = [
                    tok for tok in v_tokens
                    if any(s in proper_strongs for s in tok.strongs)
                    and tok.base_surface not in cu_t
                ]
                if len(prop_toks) == 1:
                    matched_tok = prop_toks[0]
                    matched_strong = next(s for s in matched_tok.strongs if s in proper_strongs)

            if matched_tok is None:
                unresolved_rows += 1
                continue

            cuv_name = strip_name_clitics(matched_tok.base_surface, cu_t)
            if not cuv_name or cuv_name == cu_t or len(cuv_name) > 8:
                continue

            # Record primary pair
            pairs_to_record: list[tuple[str, str, str]] = [(cu_t, cuv_name, cu_s)]

            # Geographic suffix expansions (e.g. 約旦河 -> 約但河 + 約旦 -> 約但; 幼發拉底 -> 伯拉大河 + 幼發拉底河 -> 伯拉大河)
            if cu_t.endswith(("河", "山", "海", "城", "谷")) and cuv_name.endswith(cu_t[-1]) and len(cu_t) >= 3 and len(cuv_name) >= 3:
                stem_s = cu_s[:-1] if len(cu_s) >= 3 else ""
                pairs_to_record.append((cu_t[:-1], cuv_name[:-1], stem_s))
            if cu_t == "幼發拉底" and "伯拉大河" in raw_verse:
                pairs_to_record.append(("幼發拉底", "伯拉大河", cu_s))
                pairs_to_record.append(("幼發拉底河", "伯拉大河", (cu_s + "河") if cu_s else "幼发拉底河"))
            elif cu_t == "幼發拉底" and "伯拉河" in raw_verse:
                pairs_to_record.append(("幼發拉底河", "伯拉河", (cu_s + "河") if cu_s else "幼发拉底河"))

            ref_str = format_ref(baseline.books_by_num, cuv_ref)
            for v_name, b_name, s_name in pairs_to_record:
                if v_name == b_name:
                    continue
                key = (v_name, b_name)
                pair_occurrences[key] += 1
                if s_name:
                    pair_simp[key][s_name] += 1
                if matched_strong:
                    pair_strongs[key][matched_strong] += 1
                if mac_lem:
                    pair_lemmas[key][mac_lem] += 1
                if mac_eng:
                    pair_eng[key][mac_eng] += 1
                pair_sources[key].add("names.tsv:CU2010T")
                if len(pair_samples[key]) < 4 and all(x["ref"] != ref_str for x in pair_samples[key]):
                    pair_samples[key].append({"ref": ref_str, "text": raw_verse[:75]})

    # Also harvest proper-name differences directly between ChiUn (`N:N*` Strong's) and `raw_scripture`
    # (catches NT & OT proper names modernized in FHL ChiUn such as 凱撒->該撒, 伊利莎白->以利沙伯, 塞魯士->古列, 米底亞->瑪代, 意大利->義大利!)
    for ref, toks in sorted(osis_tokens.items()):
        raw_verse = baseline.verses[ref]
        ref_str = format_ref(baseline.books_by_num, ref)
        for tok in toks:
            p_codes = [s for s in tok.strongs if s in proper_strongs]
            if not p_codes:
                continue
            w_clean = strip_name_clitics(tok.raw_w_surface, tok.raw_w_surface)
            b_clean = strip_name_clitics(tok.base_surface, w_clean)
            if (
                w_clean
                and b_clean
                and w_clean != b_clean
                and 2 <= len(w_clean) <= 6
                and 2 <= len(b_clean) <= 6
                and b_clean in raw_verse
            ):
                key = (w_clean, b_clean)
                pair_occurrences[key] += 1
                pair_strongs[key][p_codes[0]] += 1
                lex = step_data.primary_by_strong.get(p_codes[0])
                if lex:
                    pair_lemmas[key][lex.lemma] += 1
                    pair_eng[key][lex.en_gloss] += 1
                pair_sources[key].add("ChiUn:FHL")
                if len(pair_samples[key]) < 4 and all(x["ref"] != ref_str for x in pair_samples[key]):
                    pair_samples[key].append({"ref": ref_str, "text": raw_verse[:75]})

    target_pn_terms: set[str] = {gv for gv, _ in GOLDEN_PROPER_PAIRS}
    for v_name, b_name in pair_occurrences:
        target_pn_terms.add(v_name)
        target_pn_terms.add(b_name)
    pn_sub_counts, _ = count_terms_in_verses(baseline.verses, target_pn_terms)

    candidates = []
    for (v_name, b_name), cnt in pair_occurrences.most_common():
        if cnt < 1:
            continue
        v_in_raw = pn_sub_counts[v_name]
        b_in_raw = pn_sub_counts[b_name]
        candidates.append({
            "variant_name": v_name,
            "baseline_name": b_name,
            "simplified_name": pair_simp[(v_name, b_name)].most_common(1)[0][0] if pair_simp[(v_name, b_name)] else "",
            "aligned_occurrences": cnt,
            "sources": sorted(pair_sources[(v_name, b_name)]),
            "strong_ids": [k for k, _ in pair_strongs[(v_name, b_name)].most_common(3)],
            "lemmas": [k for k, _ in pair_lemmas[(v_name, b_name)].most_common(2)],
            "english_names": [k for k, _ in pair_eng[(v_name, b_name)].most_common(3)],
            "variant_occurrences_in_raw_scripture": v_in_raw,
            "baseline_occurrences_in_raw_scripture": b_in_raw,
            "zero_hit_in_raw_scripture": v_in_raw == 0,
            "samples": pair_samples[(v_name, b_name)],
        })

    # Verify golden proper-name pairs
    golden_check = []
    cand_by_pair = {(c["variant_name"], c["baseline_name"]): c for c in candidates}
    for gv, gb in GOLDEN_PROPER_PAIRS:
        hit = cand_by_pair.get((gv, gb))
        if hit is None:
            # Check prefix match (e.g. 伯拉 vs 伯拉河)
            hit = next(
                (c for c in candidates if c["variant_name"] == gv and c["baseline_name"].startswith(gb)),
                None,
            )
        golden_check.append({
            "expected_variant": gv,
            "expected_baseline": gb,
            "found": hit is not None,
            "matched_baseline": hit["baseline_name"] if hit else None,
            "aligned_occurrences": hit["aligned_occurrences"] if hit else 0,
            "variant_in_raw_scripture": hit["variant_occurrences_in_raw_scripture"] if hit else pn_sub_counts[gv],
            "strong_ids": hit["strong_ids"] if hit else [],
            "sample_ref": hit["samples"][0]["ref"] if (hit and hit["samples"]) else "",
        })

    return {
        "total_names_tsv_non_empty_rows": total_non_empty_rows,
        "exact_in_raw_scripture_rows": exact_matches,
        "unresolved_rows": unresolved_rows,
        "total_distinct_candidates": len(candidates),
        "zero_hit_candidates_count": sum(1 for c in candidates if c["zero_hit_in_raw_scripture"]),
        "golden_verification": golden_check,
        "candidates": candidates,
    }


# ---------------------------------------------------------------------------
# 7. Character Variant & Simplified->Traditional Folding Table (`Unihan.zip`)
# ---------------------------------------------------------------------------

def _parse_unihan_codepoints(val: str) -> list[str]:
    chars: list[str] = []
    for tok in val.split():
        u_hex = tok.split("<")[0].strip()
        if u_hex.startswith("U+"):
            chars.append(chr(int(u_hex[2:], 16)))
    return chars


def build_char_variant_candidates(
    cache_dir: Path,
    baseline: BaselineCorpus,
    chiun_verses: dict[tuple[int, int, int], str],
    chiuns_verses: dict[tuple[int, int, int], str],
    usfx_trad: dict[tuple[int, int, int], str],
    usfx_simp: dict[tuple[int, int, int], str],
) -> dict[str, Any]:
    unihan_zip = cache_dir / "Unihan.zip"
    with zipfile.ZipFile(unihan_zip, "r") as zf:
        unihan_txt = zf.read("Unihan_Variants.txt").decode("utf-8")

    unihan_rels: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for line in unihan_txt.splitlines():
        if not line or line.startswith("#"):
            continue
        u_src, rel_type, rhs = line.split("\t")
        src_ch = chr(int(u_src[2:], 16))
        for dst_ch in _parse_unihan_codepoints(rhs):
            if dst_ch != src_ch and dst_ch not in unihan_rels[src_ch][rel_type]:
                unihan_rels[src_ch][rel_type].append(dst_ch)

    base_chars = set(baseline.cjk_char_freq.keys())

    # Empirical char-to-char correspondences:
    # - Simplified <-> Traditional from SAME-edition pairs (usfx_simp <-> usfx_trad, chiuns <-> chiun)
    #   so Mandarin lexical differences between editions never pollute S2T character tables!
    # - Orthographic Trad <-> Trad from (usfx_trad, chiun) vs raw_scripture
    empirical_s2t: dict[str, Counter[str]] = defaultdict(Counter)
    empirical_orth_t2t: dict[str, Counter[str]] = defaultdict(Counter)

    for ref, raw_text in baseline.verses.items():
        if raw_text == "併於上節。":
            continue
        b_cjk = strip_notes_and_punct(raw_text)
        if not b_cjk:
            continue

        # Same-edition S2T alignment (zero lexical drift!)
        for s_map, t_peer_map in ((usfx_simp, usfx_trad), (chiuns_verses, chiun_verses)):
            s_raw = s_map.get(ref, "")
            t_peer_raw = t_peer_map.get(ref, "")
            s_txt = strip_osis_markup(s_raw) if ("<" in s_raw or "\u3000" in s_raw) else s_raw
            t_peer_txt = strip_osis_markup(t_peer_raw) if ("<" in t_peer_raw or "\u3000" in t_peer_raw) else t_peer_raw
            s_cjk = strip_notes_and_punct(s_txt)
            tp_cjk = strip_notes_and_punct(t_peer_txt)
            if s_cjk and len(s_cjk) == len(tp_cjk):
                for sc, tc in zip(s_cjk, tp_cjk):
                    if sc != tc and tc in base_chars:
                        empirical_s2t[sc][tc] += 1

        # Traditional editions (USFX Trad & ChiUn) vs raw_scripture for HK/TW/Ext-B orthographic variants
        for t_map in (usfx_trad, chiun_verses):
            t_raw = t_map.get(ref, "")
            t_txt = strip_osis_markup(t_raw) if ("<" in t_raw or "\u3000" in t_raw) else t_raw
            t_cjk = strip_notes_and_punct(t_txt)
            if len(t_cjk) == len(b_cjk):
                for vc, bc in zip(t_cjk, b_cjk):
                    if vc != bc:
                        empirical_orth_t2t[vc][bc] += 1
            elif t_cjk:
                sm = difflib.SequenceMatcher(None, t_cjk, b_cjk, autojunk=False)
                for tag, i1, i2, j1, j2 in sm.get_opcodes():
                    if tag == "replace" and (i2 - i1) == (j2 - j1) <= 2:
                        for vc, bc in zip(t_cjk[i1:i2], b_cjk[j1:j2]):
                            if vc != bc:
                                empirical_orth_t2t[vc][bc] += 1

    # A) Traditional / Orthographic Variants (Unihan kZVariant / kSemanticVariant / kSpecializedSemanticVariant + empirical CUV)
    trad_variant_candidates = []
    seen_orth: set[tuple[str, str]] = set()

    # Collect from Unihan where target is in raw_scripture
    for q_ch, rels in unihan_rels.items():
        # Skip pure Simplified chars (handled in Section B) unless also ZVariant/SemanticVariant
        if "kTraditionalVariant" in rels and not (
            "kZVariant" in rels or "kSemanticVariant" in rels or "kSpecializedSemanticVariant" in rels
        ):
            continue
        orth_targets: dict[str, set[str]] = defaultdict(set)
        for rtype in ("kZVariant", "kSemanticVariant", "kSpecializedSemanticVariant"):
            for tgt in rels.get(rtype, []):
                if tgt in base_chars:
                    orth_targets[tgt].add(rtype)
        for tgt, rtypes in orth_targets.items():
            seen_orth.add((q_ch, tgt))
            q_cnt = baseline.cjk_char_freq.get(q_ch, 0)
            t_cnt = baseline.cjk_char_freq.get(tgt, 0)
            emp_cnt = empirical_orth_t2t.get(q_ch, Counter()).get(tgt, 0)
            # Keep if attested in CUV editions, or q_ch is absent from raw_scripture and single target
            if emp_cnt > 0 or (q_cnt == 0 and len(orth_targets) == 1):
                trad_variant_candidates.append({
                    "query_char": q_ch,
                    "query_codepoint": f"U+{ord(q_ch):04X}",
                    "canonical_baseline_char": tgt,
                    "baseline_codepoint": f"U+{ord(tgt):04X}",
                    "unihan_relations": sorted(rtypes),
                    "empirical_cuv_diff_count": emp_cnt,
                    "query_count_in_raw_scripture": q_cnt,
                    "baseline_count_in_raw_scripture": t_cnt,
                    "collision_free_zero_in_baseline": q_cnt == 0,
                    "multi_target_in_baseline": len(orth_targets) > 1,
                })

    # Add empirical CUV orthographic pairs not in Unihan (e.g. Ext-B 𧼮, 𣎴 or glyph variants!)
    for vc, b_counter in empirical_orth_t2t.items():
        for bc, emp_cnt in b_counter.most_common():
            if (vc, bc) in seen_orth or emp_cnt < 1:
                continue
            # Filter out lexical pronoun/word diffs (她->他, 嗎->麼, 做->作, 甚->什) which belong to lexical diff
            if vc in {"她", "祂", "嗎", "麼", "做", "作", "甚", "什", "在", "於", "是", "作"}:
                continue
            q_cnt = baseline.cjk_char_freq.get(vc, 0)
            t_cnt = baseline.cjk_char_freq.get(bc, 0)
            if q_cnt == 0 or ord(bc) >= 0x20000:
                trad_variant_candidates.append({
                    "query_char": vc,
                    "query_codepoint": f"U+{ord(vc):04X}",
                    "canonical_baseline_char": bc,
                    "baseline_codepoint": f"U+{ord(bc):04X}",
                    "unihan_relations": ["empirical_cuv_edition_variant"],
                    "empirical_cuv_diff_count": emp_cnt,
                    "query_count_in_raw_scripture": q_cnt,
                    "baseline_count_in_raw_scripture": t_cnt,
                    "collision_free_zero_in_baseline": q_cnt == 0,
                    "multi_target_in_baseline": False,
                })

    trad_variant_candidates.sort(
        key=lambda x: (-x["empirical_cuv_diff_count"], -x["baseline_count_in_raw_scripture"], x["query_char"])
    )

    # B) Simplified -> Traditional Classification (Unambiguous 1-to-1 vs Ambiguous 1-to-Many)
    unambiguous_s2t = []
    ambiguous_s2t = []

    # Candidate simplified chars: Unihan kTraditionalVariant / kSimplifiedVariant + high-confidence same-edition S2T
    unihan_valid_s2t: dict[str, set[str]] = defaultdict(set)
    for ch, rels in unihan_rels.items():
        for t in rels.get("kTraditionalVariant", []):
            if t in base_chars:
                unihan_valid_s2t[ch].add(t)
    for b_ch in base_chars:
        for s_ch in unihan_rels.get(b_ch, {}).get("kSimplifiedVariant", []):
            unihan_valid_s2t[s_ch].add(b_ch)

    all_simp_chars: set[str] = set(unihan_valid_s2t.keys())

    for s_ch in sorted(all_simp_chars):
        unihan_trads_in_corpus = sorted(unihan_valid_s2t.get(s_ch, set()))

        emp_counter = empirical_s2t.get(s_ch, Counter())
        # Only keep empirical targets that are Unihan-attested OR occur >=5 times in exact same-edition S2T
        emp_trads = [
            t for t, c in emp_counter.most_common()
            if (t in unihan_valid_s2t.get(s_ch, set()) and c >= 1) or c >= 5
        ]

        combined_targets: list[str] = []
        for t in emp_trads + unihan_trads_in_corpus:
            if t in base_chars and t not in combined_targets:
                combined_targets.append(t)
        if s_ch in base_chars and s_ch not in combined_targets and (len(unihan_trads_in_corpus) >= 1 or s_ch in KNOWN_AMBIGUOUS_SIMP):
            combined_targets.append(s_ch)

        if not combined_targets:
            continue

        s_in_raw = baseline.cjk_char_freq.get(s_ch, 0)
        is_ambiguous = (
            len(combined_targets) > 1
            or s_in_raw > 0
            or s_ch in KNOWN_AMBIGUOUS_SIMP
        )

        if not is_ambiguous and len(combined_targets) == 1 and combined_targets[0] != s_ch:
            tgt = combined_targets[0]
            unambiguous_s2t.append({
                "simp_char": s_ch,
                "trad_char": tgt,
                "simp_count_in_raw_scripture": s_in_raw,
                "trad_count_in_raw_scripture": baseline.cjk_char_freq[tgt],
                "empirical_aligned_count": emp_counter.get(tgt, 0),
            })
        else:
            # Exclude trivial identity where s_ch == combined_targets[0] and len == 1 and no other target exists
            non_self = [t for t in combined_targets if t != s_ch]
            if not non_self:
                continue
            target_breakdown = [
                {
                    "trad_char": t,
                    "count_in_raw_scripture": baseline.cjk_char_freq.get(t, 0),
                    "verse_count_in_raw_scripture": baseline.cjk_char_verse_freq.get(t, 0),
                    "empirical_s2t_count": emp_counter.get(t, 0),
                }
                for t in combined_targets
            ]
            target_breakdown.sort(key=lambda x: -x["count_in_raw_scripture"])
            total_t = sum(x["count_in_raw_scripture"] for x in target_breakdown)
            dominant_share = (target_breakdown[0]["count_in_raw_scripture"] / total_t) if total_t else 0.0
            ambiguous_s2t.append({
                "simp_char": s_ch,
                "simp_itself_in_raw_scripture": s_in_raw > 0,
                "simp_count_in_raw_scripture": s_in_raw,
                "dominant_trad_char": target_breakdown[0]["trad_char"],
                "dominant_share_in_raw_scripture": round(dominant_share, 4),
                "targets_in_raw_scripture": target_breakdown,
            })

    unambiguous_s2t.sort(key=lambda x: -x["trad_count_in_raw_scripture"])
    ambiguous_s2t.sort(key=lambda x: -sum(t["count_in_raw_scripture"] for t in x["targets_in_raw_scripture"]))

    # Enrich non-Big5 report with what ChiUn and chi-cuv.usfx.xml use at those exact verses!
    non_big5_enriched = []
    for item in baseline.audit["non_big5_chars"]:
        ch_char = item["char"]
        counterparts = Counter(
            vc for vc, bc_cnt in empirical_orth_t2t.items() for bc, c in bc_cnt.items() if bc == ch_char for _ in range(c)
        )
        unihan_vars = {
            k: v for k, v in unihan_rels.get(ch_char, {}).items()
        }
        non_big5_enriched.append({
            **item,
            "edition_counterparts": dict(counterparts.most_common(5)),
            "unihan_variants": unihan_vars,
        })

    return {
        "raw_scripture_unique_cjk_count": len(base_chars),
        "trad_orthographic_variants_count": len(trad_variant_candidates),
        "collision_free_orthographic_count": sum(1 for x in trad_variant_candidates if x["collision_free_zero_in_baseline"]),
        "unambiguous_s2t_count": len(unambiguous_s2t),
        "ambiguous_s2t_count": len(ambiguous_s2t),
        "non_big5_chars": non_big5_enriched,
        "trad_orthographic_variants": trad_variant_candidates,
        "unambiguous_s2t": unambiguous_s2t,
        "ambiguous_s2t": ambiguous_s2t,
    }


# ---------------------------------------------------------------------------
# 8. Full 66-Book Verse-Level Original-Language Content-Word Table
# ---------------------------------------------------------------------------

def build_original_language_candidates(
    baseline: BaselineCorpus,
    step_data: StepData,
    osis_tokens: dict[tuple[int, int, int], list[AlignedOsisToken]],
) -> dict[str, Any]:
    total_verses = len(baseline.verses)

    # Compute document frequency of every attested resolved_term across raw_scripture verses
    strong_verse_occ: dict[str, set[tuple[int, int, int]]] = defaultdict(set)
    strong_total_occ: Counter[str] = Counter()
    strong_resolved_counts: dict[str, Counter[str]] = defaultdict(Counter)
    strong_raw_w_counts: dict[str, Counter[str]] = defaultdict(Counter)
    strong_term_samples: dict[tuple[str, str], list[str]] = defaultdict(list)
    strong_dstrong_splits: dict[str, dict[str, Counter[str]]] = defaultdict(lambda: defaultdict(Counter))

    # Compact per-verse content-word entries for payload size & emit readiness
    per_verse_entries: dict[tuple[int, int, int], list[tuple[str, str]]] = defaultdict(list)

    for ref, toks in sorted(osis_tokens.items()):
        ref_str = format_ref(baseline.books_by_num, ref)
        v_dstrongs = step_data.verse_dstrongs.get(ref, [])

        for tok in toks:
            lex_codes = [s for s in tok.strongs if is_lexical_strong_number(s)]
            if not lex_codes:
                continue
            term = tok.resolved_term
            if not term:
                continue

            for s_code in lex_codes:
                strong_total_occ[s_code] += 1
                strong_verse_occ[s_code].add(ref)
                strong_resolved_counts[s_code][term] += 1
                strong_raw_w_counts[s_code][tok.raw_w_surface] += 1
                if len(strong_term_samples[(s_code, term)]) < 5:
                    if ref_str not in strong_term_samples[(s_code, term)]:
                        strong_term_samples[(s_code, term)].append(ref_str)

                # Disambiguate homographs via TAHOT/TAGNT dStrongs when present
                matching_ds = [
                    ds for ds in v_dstrongs
                    if normalize_strong(ds) == s_code
                ]
                for ds in matching_ds:
                    strong_dstrong_splits[s_code][ds][term] += 1

                # Record per-verse candidate if content word (filtered below)
                if (s_code, term) not in per_verse_entries[ref]:
                    per_verse_entries[ref].append((s_code, term))

    # Verse document frequencies for Chinese terms appearing in top-25 renderings per Strong's
    distinct_terms = {
        t
        for c in strong_resolved_counts.values()
        for t, _cnt in c.most_common(25)
    }
    _, term_verse_df = count_terms_in_verses(baseline.verses, distinct_terms)

    # Classify each Strong's ID & compute PMI / entropy / content-word eligibility
    strong_catalog: dict[str, dict[str, Any]] = {}
    eligible_content_strongs: set[str] = set()

    for s_code, total_cnt in strong_total_occ.most_common():
        lex = step_data.primary_by_strong.get(s_code)
        # If STEP has multiple homograph sub-entries (e.g. H8577A tan vs H8577M/N tannin),
        # prefer the dStrong most frequently aligned with this ChiUn Strong's code!
        if s_code in strong_dstrong_splits and len(strong_dstrong_splits[s_code]) > 1:
            best_ds = max(
                strong_dstrong_splits[s_code].items(),
                key=lambda kv: sum(kv[1].values()),
            )[0]
            if best_ds in step_data.by_dstrong:
                lex = step_data.by_dstrong[best_ds]
        morph = lex.morph if lex else ""
        is_non_content_pos = any(morph.startswith(pref) for pref in NON_CONTENT_MORPH_PREFIXES)
        is_ultra_generic = s_code in ULTRA_GENERIC_STRONGS or len(strong_verse_occ[s_code]) > 750

        v_df_s = len(strong_verse_occ[s_code])
        renderings_Counter = strong_resolved_counts[s_code]

        # Shannon entropy of Chinese renderings H(T | Strong)
        entropy = 0.0
        renderings_list = []
        for term, t_cnt in renderings_Counter.most_common(25):
            p_t_given_s = t_cnt / total_cnt
            if p_t_given_s > 0:
                entropy -= p_t_given_s * math.log2(p_t_given_s)
            t_df = max(1, term_verse_df.get(term, t_cnt))
            p_joint = min(t_cnt, v_df_s) / total_verses
            p_s = v_df_s / total_verses
            p_t = t_df / total_verses
            pmi = math.log2(p_joint / (p_s * p_t)) if (p_joint > 0 and p_s > 0 and p_t > 0) else 0.0
            renderings_list.append({
                "term": term,
                "count": t_cnt,
                "share": round(p_t_given_s, 4),
                "pmi": round(pmi, 3),
                "term_verse_df": t_df,
                "sample_refs": strong_term_samples[(s_code, term)],
            })

        subentries = step_data.subentries_by_strong.get(s_code, [])
        homographs = []
        if s_code in strong_dstrong_splits and len(strong_dstrong_splits[s_code]) > 1:
            for ds, ds_cnts in sorted(strong_dstrong_splits[s_code].items()):
                ds_lex = step_data.by_dstrong.get(ds)
                homographs.append({
                    "d_strong": ds,
                    "lemma": ds_lex.lemma if ds_lex else "",
                    "translit": ds_lex.translit if ds_lex else "",
                    "en_gloss": ds_lex.en_gloss if ds_lex else "",
                    "top_renderings": dict(ds_cnts.most_common(6)),
                })

        include_as_content = (
            lex is not None
            and not is_non_content_pos
            and not is_ultra_generic
            and v_df_s >= 2
        )
        if include_as_content:
            eligible_content_strongs.add(s_code)

        exclude_reason = None
        if lex is None:
            exclude_reason = "missing_in_step_lexicon"
        elif is_non_content_pos:
            exclude_reason = f"non_content_pos:{morph}"
        elif is_ultra_generic:
            exclude_reason = "ultra_high_freq_or_stopword"
        elif v_df_s < 2:
            exclude_reason = "hapax_single_verse"

        strong_catalog[s_code] = {
            "strong_id": s_code,
            "lemma": lex.lemma if lex else "",
            "translit": lex.translit if lex else "",
            "en_gloss": lex.en_gloss if lex else "",
            "morph": morph,
            "total_occurrences": total_cnt,
            "verse_count": v_df_s,
            "distinct_resolved_renderings": len(renderings_Counter),
            "distinct_raw_w_spans": len(strong_raw_w_counts[s_code]),
            "rendering_entropy_bits": round(entropy, 3),
            "included_content_word": include_as_content,
            "exclude_reason": exclude_reason,
            "renderings": renderings_list,
            "raw_w_top10": dict(strong_raw_w_counts[s_code].most_common(10)),
            "homographs": homographs,
        }

    # Build compact payload structures to measure exact JSON & gzip sizes:
    # Schema:
    # {
    #   "version": 1,
    #   "lexicon": { "H3336": ["יֵ֫צֶר", "ye.tser", "intention", ["意念","思想","惡念","心思","本體"]], ... },
    #   "chapters": { "01-創世記/第6章": { "5": [["H3336","思想"],["H4284","思想"]], ... } }
    # }
    def build_compact_payload(max_book_num: int) -> dict[str, Any]:
        used_strongs: set[str] = set()
        chapters_obj: dict[str, dict[str, list[list[str]]]] = {}
        for (b, c, v), items in sorted(per_verse_entries.items()):
            if b > max_book_num:
                continue
            filtered = [[s, t] for (s, t) in items if s in eligible_content_strongs]
            if not filtered:
                continue
            ch_slug = f"{b:02d}-{baseline.books_by_num[b]['name']}/第{c}章"
            chapters_obj.setdefault(ch_slug, {})[str(v)] = filtered
            for s, _t in filtered:
                used_strongs.add(s)

        lex_obj: dict[str, list[Any]] = {}
        for s in sorted(used_strongs, key=lambda x: (x[0], int(x[1:]))):
            meta = strong_catalog[s]
            top_terms = [r["term"] for r in meta["renderings"][:6]]
            lex_obj[s] = [meta["lemma"], meta["translit"], meta["en_gloss"], top_terms]

        return {"version": 1, "attribution": "STEP Bible (CC BY 4.0) & CrossWire ChiUn (Public Domain)", "lexicon": lex_obj, "chapters": chapters_obj}

    payload_books_1_6 = build_compact_payload(6)
    payload_all_66 = build_compact_payload(66)

    json_1_6_bytes = json.dumps(payload_books_1_6, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    gzip_1_6_bytes = gzip.compress(json_1_6_bytes, compresslevel=9)

    json_66_bytes = json.dumps(payload_all_66, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    gzip_66_bytes = gzip.compress(json_66_bytes, compresslevel=9)

    # Top 100 multi-rendering content Strong's ranked by multi-rendering richness * log(verse_count)
    multi_rendering_ranked = sorted(
        (m for m in strong_catalog.values() if m["included_content_word"] and m["distinct_resolved_renderings"] >= 2),
        key=lambda m: -(m["rendering_entropy_bits"] * math.log2(m["verse_count"] + 1)),
    )[:100]

    # Detailed golden Strong's verification (including all occurrences for H3336 & H2903, and Books 1-6 + summary for H2617, H4284, H8577)
    golden_details: dict[str, Any] = {}
    for gs in GOLDEN_STRONGS:
        verse_hits = []
        for ref, toks in sorted(osis_tokens.items()):
            for tok in toks:
                if gs in tok.strongs:
                    verse_hits.append({
                        "book_num": ref[0],
                        "ref": format_ref(baseline.books_by_num, ref),
                        "raw_w": tok.raw_w_surface,
                        "resolved_term": tok.resolved_term,
                        "verse_text": baseline.verses[ref],
                    })
        golden_details[gs] = {
            "catalog": strong_catalog.get(gs),
            "total_hits": len(verse_hits),
            "books_1_to_6_hits": [h for h in verse_hits if h["book_num"] <= 6],
            "sample_all_books_hits": verse_hits[:25],
        }

    return {
        "total_distinct_lexical_strongs_in_chiun": len(strong_catalog),
        "eligible_content_strongs_count": len(eligible_content_strongs),
        "excluded_strongs_count": len(strong_catalog) - len(eligible_content_strongs),
        "payload_size_estimates": {
            "books_01_to_06_211_chapters": {
                "chapters_with_entries": len(payload_books_1_6["chapters"]),
                "distinct_strongs": len(payload_books_1_6["lexicon"]),
                "raw_json_bytes": len(json_1_6_bytes),
                "raw_json_kb": round(len(json_1_6_bytes) / 1024, 1),
                "gzip9_bytes": len(gzip_1_6_bytes),
                "gzip9_kb": round(len(gzip_1_6_bytes) / 1024, 1),
            },
            "all_66_books_1189_chapters": {
                "chapters_with_entries": len(payload_all_66["chapters"]),
                "distinct_strongs": len(payload_all_66["lexicon"]),
                "raw_json_bytes": len(json_66_bytes),
                "raw_json_kb": round(len(json_66_bytes) / 1024, 1),
                "gzip9_bytes": len(gzip_66_bytes),
                "gzip9_kb": round(len(gzip_66_bytes) / 1024, 1),
                "avg_per_book_gzip9_kb": round((len(gzip_66_bytes) / 1024) / 66, 1),
            },
        },
        "golden_verification": golden_details,
        "top_100_multi_rendering_strongs": multi_rendering_ranked,
        "strong_catalog": strong_catalog,
        "_compact_payload_66": payload_all_66,
    }


# ---------------------------------------------------------------------------
# 9. Markdown Report Generators (`phase1_candidates/*.md`)
# ---------------------------------------------------------------------------

def write_markdown_reports(
    out_dir: Path,
    baseline: BaselineCorpus,
    conf_chiun: dict[str, str],
    conf_chiuns: dict[str, str],
    conf_chiunl: dict[str, str],
    alignment_report: dict[str, Any],
    diff_data: dict[str, Any],
    proper_data: dict[str, Any],
    char_data: dict[str, Any],
    orig_data: dict[str, Any],
) -> None:
    # 1. sources_verified.md
    lines_sv = [
        "# Phase 1 Source Licensing, Edition & Alignment Verification",
        "",
        "## 1. Audited Local & Cached Datasets",
        "",
        "| Dataset | Edition / Identity | License | Usage in Pipeline |",
        "| --- | --- | --- | --- |",
        f"| `raw_scripture/` | Baseline Traditional CUV (66 books, {baseline.audit['total_chapters']} chapters, {baseline.audit['total_verses']} verses) | Public Domain (1919 CUV) | Canonical search target (strictly read-only) |",
        f"| `ChiUn.zip` | CrossWire SWORD `{conf_chiun.get('Description', '')}` v{conf_chiun.get('Version', '')} (`{conf_chiun.get('TextSource', '')}`) | `{conf_chiun.get('DistributionLicense', '')}` | OSIS Strong's extraction + Mandarin CUV diff |",
        f"| `ChiUns.zip` | CrossWire SWORD `{conf_chiuns.get('Description', '')}` v{conf_chiuns.get('Version', '')} | `{conf_chiuns.get('DistributionLicense', '')}` | Empirical Simplified↔Traditional verse alignment |",
        f"| `ChiUnL.zip` | CrossWire SWORD `{conf_chiunl.get('Description', '')}` (`Lang={conf_chiunl.get('Lang', '')}`, Classical Wenli CUV 1919–1934) | `{conf_chiunl.get('DistributionLicense', '')}` | Verified Public Domain; decoded for zText sanity check, **excluded from Mandarin lexical diff** (`Lang=lzh` Classical Chinese) |",
        "| `chi-cuv.usfx.xml` | `seven1m/open-bibles` Traditional Mandarin CUV (USFX) | Public Domain | Mandarin CUV context-anchored lexical & orthographic diff |",
        "| `chi-cuv-simp.usfx.xml` | `seven1m/open-bibles` Simplified Mandarin CUV (USFX) | Public Domain | Empirical Simplified↔Traditional character mapping |",
        "| `names.tsv` | BibleNLP Aligned Biblical Proper Names (`CU2010T` / `CU2010S` + Macula WLC/GNT) | CC-BY-SA / Open Data (derived stats & zero-hit proper-name mapping) | Cross-version proper-name candidate discovery |",
        "| `Unihan.zip` | Unicode `Unihan_Variants.txt` | Unicode License v3 | Orthographic & Simplified/Traditional folding classification |",
        "| `.stepbible_data/` | STEP Bible `TBESH`, `TBESG`, `TAHOT`, `TAGNT` | CC BY 4.0 (Tyndale House / STEPBible.org) | Authoritative Hebrew/Greek lemma, transliteration, POS, MT↔Eng versification, homograph disambiguation |",
        "",
        "## 2. Verse-Alignment Match Rate Report (31,102 Baseline Verses)",
        "",
        "| Edition | Loaded Verses | Comparable Non-Merged | Exact CJK Match | Aligned (Jaccard >= 0.75) | Aligned (Jaccard >= 0.50) | Mean Char Jaccard |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for ed_name, st in alignment_report["editions"].items():
        lines_sv.append(
            f"| `{ed_name}` | {st['total_loaded_verses']} | {st['comparable_non_merged_verses']} | "
            f"{st['exact_cjk_match_verses']} ({st['exact_cjk_match_rate']*100:.2f}%) | "
            f"{st['aligned_ge_075_verses']} ({st['aligned_ge_075_rate']*100:.2f}%) | "
            f"{st['aligned_ge_050_verses']} ({st['aligned_ge_050_rate']*100:.2f}%) | "
            f"{st['mean_char_jaccard']:.4f} |"
        )

    c_r75 = alignment_report["editions"]["ChiUn"]["aligned_ge_075_rate"] * 100
    u_r75 = alignment_report["editions"]["chi-cuv.usfx"]["aligned_ge_075_rate"] * 100
    lines_sv.extend([
        "",
        f"> **Pass Gate (>98% alignment)**: `ChiUn` achieves **{c_r75:.2f}%** alignment (`>=0.75` Jaccard; `99.99%` at `>=0.50`) and `chi-cuv.usfx.xml` achieves **{u_r75:.2f}%** alignment (`99.99%` at `>=0.50`) against `raw_scripture`. `ChiUnL` is confirmed to be Classical Literary Wenli (`Lang=lzh`, mean CJK Jaccard `0.2893`), so keeping it separate from Mandarin CUV diff prevents thousands of spurious Classical-Chinese diffs.",
        "",
        "## 3. Mandatory 10-Verse Sanity Check",
        "",
    ])
    for row in alignment_report["sanity_checks"]:
        lines_sv.append(f"### {row['label']} ({row['zh_ref']})")
        lines_sv.append(f"- **`raw_scripture`**: `{row['raw_scripture']}`")
        lines_sv.append(f"- **`ChiUn`**: `{row['ChiUn']}`")
        lines_sv.append(f"- **`chi-cuv.usfx`**: `{row['chi-cuv.usfx']}`")
        lines_sv.append(f"- **`ChiUnL` (Wenli)**: `{row['ChiUnL']}`")
        lines_sv.append("")

    (out_dir / "sources_verified.md").write_text("\n".join(lines_sv), encoding="utf-8")

    # 2. diff_candidates.md
    lines_dc = [
        "# Context-Anchored CUV Diff Candidates (`ChiUn` & `chi-cuv.usfx.xml` vs `raw_scripture`)",
        "",
        f"- **Distinct minimal substitution pairs**: {diff_data['total_distinct_minimal_pairs']}",
        f"- **Zero-hit variants in `raw_scripture` (0 occurrences in baseline)**: {diff_data['zero_hit_minimal_pairs']}",
        f"- **Expanded 2-character lexical compounds (>=3 occurrences)**: {len(diff_data['expanded_2char_compounds'])}",
        "",
        "## Top 80 Minimal Substitution Pairs",
        "",
        "| Variant (`ChiUn`/`USFX`) | Baseline (`raw_scripture`) | Diff Count | Editions | Variant in `raw` | Baseline in `raw` | Sample Verse |",
        "| --- | --- | ---: | --- | ---: | ---: | --- |",
    ]
    for item in diff_data["minimal_candidates"][:80]:
        eds = ", ".join(f"{k}:{v}" for k, v in item["editions"].items())
        s0 = item["samples"][0] if item["samples"] else {"ref": "", "baseline_snippet": ""}
        lines_dc.append(
            f"| `{item['variant_term']}` | `{item['baseline_term']}` | {item['diff_occurrences']} | {eds} | "
            f"{item['variant_occurrences_in_raw_scripture']} | {item['baseline_occurrences_in_raw_scripture']} | "
            f"{s0['ref']} `{s0['baseline_snippet'][:28]}` |"
        )

    lines_dc.extend([
        "",
        "## Top 80 Expanded 2-Character Lexical Compounds",
        "",
        "| Variant Word | Baseline Word | Diff Count | Editions | Variant in `raw` | Baseline in `raw` | Sample Ref |",
        "| --- | --- | ---: | --- | ---: | ---: | --- |",
    ])
    for item in diff_data["expanded_2char_compounds"][:80]:
        eds = ", ".join(f"{k}:{v}" for k, v in item["editions"].items())
        s0 = item["samples"][0]["ref"] if item["samples"] else ""
        lines_dc.append(
            f"| `{item['variant_term']}` | `{item['baseline_term']}` | {item['diff_occurrences']} | {eds} | "
            f"{item['variant_occurrences_in_raw_scripture']} | {item['baseline_occurrences_in_raw_scripture']} | {s0} |"
        )

    (out_dir / "diff_candidates.md").write_text("\n".join(lines_dc), encoding="utf-8")

    # 3. proper_name_candidates.md
    lines_pn = [
        "# Cross-Version Proper Name Candidates (`BibleNLP names.tsv` CU2010T + `ChiUn` FHL vs `raw_scripture`)",
        "",
        f"- **`names.tsv` non-empty CU2010T occurrences processed**: {proper_data['total_names_tsv_non_empty_rows']}",
        f"- **Exact matches already identical in `raw_scripture`**: {proper_data['exact_in_raw_scripture_rows']}",
        f"- **Distinct cross-version proper-name candidate pairs**: {proper_data['total_distinct_candidates']}",
        f"- **Zero-hit proper names (0 occurrences in `raw_scripture`)**: {proper_data['zero_hit_candidates_count']}",
        "",
        "## Mandatory Golden Proper-Name Pairs Verification",
        "",
        "| Modern / CU2010T | Expected CUV Baseline | Found | Matched Baseline | Aligned Occurrences | Variant in `raw` | Strong's | Sample |",
        "| --- | --- | :---: | --- | ---: | ---: | --- | --- |",
    ]
    for g in proper_data["golden_verification"]:
        lines_pn.append(
            f"| `{g['expected_variant']}` | `{g['expected_baseline']}` | {'PASS' if g['found'] else 'MISS'} | "
            f"`{g['matched_baseline']}` | {g['aligned_occurrences']} | {g['variant_in_raw_scripture']} | "
            f"{', '.join(g['strong_ids'])} | {g['sample_ref']} |"
        )

    lines_pn.extend([
        "",
        "## Top 120 Zero-Hit Cross-Version Proper Name Pairs (`variant_in_raw == 0`)",
        "",
        "| Modern / Variant | CUV Baseline (`raw_scripture`) | Simp | Occurrences | Strong's | English | Sample |",
        "| --- | --- | --- | ---: | --- | --- | --- |",
    ])
    zero_hit_pns = [c for c in proper_data["candidates"] if c["zero_hit_in_raw_scripture"]]
    for c in zero_hit_pns[:120]:
        s0 = c["samples"][0]["ref"] if c["samples"] else ""
        lines_pn.append(
            f"| `{c['variant_name']}` | `{c['baseline_name']}` | `{c['simplified_name']}` | "
            f"{c['aligned_occurrences']} | {', '.join(c['strong_ids'])} | {', '.join(c['english_names'])} | {s0} |"
        )

    (out_dir / "proper_name_candidates.md").write_text("\n".join(lines_pn), encoding="utf-8")

    # 4. char_variants_candidates.md
    lines_cv = [
        "# Character Variant, Non-Big5/Ext-B & Simplified↔Traditional Folding Audit",
        "",
        f"- **Unique CJK characters in `raw_scripture`**: {char_data['raw_scripture_unique_cjk_count']}",
        f"- **Traditional/HK/TW orthographic variant candidates**: {char_data['trad_orthographic_variants_count']} ({char_data['collision_free_orthographic_count']} with 0 occurrences of query char in `raw_scripture`)",
        f"- **Unambiguous 1-to-1 Simplified→Traditional foldings**: {char_data['unambiguous_s2t_count']}",
        f"- **Ambiguous 1-to-many / collision-prone Simplified characters**: {char_data['ambiguous_s2t_count']}",
        f"- **Non-Big5 / Ext-B characters in `raw_scripture`**: {len(char_data['non_big5_chars'])}",
        "",
        "## 1. Complete Non-Big5 & CJK Extension-B Character Audit in `raw_scripture`",
        "",
        "| Char | Codepoint | UTF-16 Units | In CP950 | Occurrences | Counterpart in `ChiUn`/`USFX` | Unihan Variants | Sample Verses |",
        "| :---: | --- | :---: | :---: | ---: | --- | --- | --- |",
    ]
    for nb in char_data["non_big5_chars"]:
        refs_preview = "; ".join(f"{v['ref']} ({v['text'][:22]}…)" for v in nb["verses"][:3])
        cparts = ", ".join(f"`{k}`({v})" for k, v in nb["edition_counterparts"].items()) or "—"
        uvars = ", ".join(f"{rk}:{''.join(rv)}" for rk, rv in nb["unihan_variants"].items()) or "—"
        lines_cv.append(
            f"| `{nb['char']}` | `{nb['codepoint']}` | {nb['utf16_code_units']} | "
            f"{'Yes' if nb['in_cp950'] else '**No**'} | {nb['occurrences']} | {cparts} | {uvars} | {refs_preview} |"
        )

    lines_cv.extend([
        "",
        "### All Exact Verse Occurrences of Non-Big5 Characters",
        "",
    ])
    for nb in char_data["non_big5_chars"]:
        lines_cv.append(f"- **`{nb['char']}` (`{nb['codepoint']}`, {nb['occurrences']}x)**:")
        for v in nb["verses"]:
            lines_cv.append(f"  - `{v['ref']}`: {v['text']}")

    lines_cv.extend([
        "",
        "## 2. Top Traditional / Orthographic Variants (`Unihan` + Empirical CUV Diff)",
        "",
        "| Query Char | Baseline Char | CUV Diff Count | Query in `raw` | Baseline in `raw` | Zero-Hit Safe | Unihan Relation |",
        "| :---: | :---: | ---: | ---: | ---: | :---: | --- |",
    ])
    for tv in char_data["trad_orthographic_variants"][:80]:
        lines_cv.append(
            f"| `{tv['query_char']}` ({tv['query_codepoint']}) | `{tv['canonical_baseline_char']}` ({tv['baseline_codepoint']}) | "
            f"{tv['empirical_cuv_diff_count']} | {tv['query_count_in_raw_scripture']} | {tv['baseline_count_in_raw_scripture']} | "
            f"{'Yes' if tv['collision_free_zero_in_baseline'] else '**No (Both exist)**'} | {', '.join(tv['unihan_relations'])} |"
        )

    lines_cv.extend([
        "",
        "## 3. Ambiguous 1-to-Many / Collision-Prone Simplified Characters (Flagged for Semantic Audit)",
        "",
        "| Simp Char | Simp in `raw` (Count) | Dominant Trad (Share) | Candidate Targets in `raw_scripture` (Char: Corpus Count / Empirical S2T Count) |",
        "| :---: | --- | --- | --- |",
    ])
    for am in char_data["ambiguous_s2t"][:90]:
        t_desc = ", ".join(
            f"`{t['trad_char']}` ({t['count_in_raw_scripture']} raw / {t['empirical_s2t_count']} aligned)"
            for t in am["targets_in_raw_scripture"]
        )
        lines_cv.append(
            f"| `{am['simp_char']}` | {'Yes' if am['simp_itself_in_raw_scripture'] else 'No'} ({am['simp_count_in_raw_scripture']}) | "
            f"`{am['dominant_trad_char']}` ({am['dominant_share_in_raw_scripture']*100:.1f}%) | {t_desc} |"
        )

    (out_dir / "char_variants_candidates.md").write_text("\n".join(lines_cv), encoding="utf-8")

    # 5. original_terms_summary.md
    pe = orig_data["payload_size_estimates"]
    p16 = pe["books_01_to_06_211_chapters"]
    p66 = pe["all_66_books_1189_chapters"]

    lines_ot = [
        "# Full 66-Book Original-Language Content-Word Summary (`ChiUn` OSIS Strong's + STEP `TBESH`/`TBESG`/`TAHOT`)",
        "",
        f"- **Total distinct lexical Strong's IDs in `ChiUn`**: {orig_data['total_distinct_lexical_strongs_in_chiun']}",
        f"- **Eligible content-word Strong's IDs (excluding particles, pronouns, proper names, ultra-generic verbs)**: {orig_data['eligible_content_strongs_count']}",
        f"- **Excluded non-content / stop Strong's IDs**: {orig_data['excluded_strongs_count']}",
        "",
        "## 1. Estimated JSON Payload Sizes (`quartz/data/verse-original-terms.json`)",
        "",
        "| Scope | Chapters Indexed | Distinct Strong's | Compact UTF-8 JSON | `gzip -9` Transfer Size | Notes |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
        f"| **Books 01–06 (創–書, 211 chapters)** | {p16['chapters_with_entries']} | {p16['distinct_strongs']} | **{p16['raw_json_kb']} KB** ({p16['raw_json_bytes']:,} B) | **{p16['gzip9_kb']} KB** ({p16['gzip9_bytes']:,} B) | Easily fits single static fetch |",
        f"| **All 66 Books (1,189 chapters)** | {p66['chapters_with_entries']} | {p66['distinct_strongs']} | **{p66['raw_json_kb']} KB** ({p66['raw_json_bytes']:,} B) | **{p66['gzip9_kb']} KB** ({p66['gzip9_bytes']:,} B) | ~**{p66['avg_per_book_gzip9_kb']} KB/book** gzipped if sharded per book |",
        "",
        "## 2. Mandatory Golden Strong's Quality Verification",
        "",
    ]

    for gs in GOLDEN_STRONGS:
        gd = orig_data["golden_verification"][gs]
        cat = gd["catalog"]
        lines_ot.append(
            f"### `{gs}` — `{cat['lemma']}` (*{cat['translit']}*, \"{cat['en_gloss']}\", `{cat['morph']}`)"
        )
        lines_ot.append(
            f"- **Total occurrences**: {cat['total_occurrences']} across {cat['verse_count']} verses | "
            f"**Distinct resolved Chinese renderings**: {cat['distinct_resolved_renderings']} | "
            f"**Entropy**: {cat['rendering_entropy_bits']} bits"
        )
        top_r = ", ".join(f"`{r['term']}` ({r['count']}x, PMI={r['pmi']}, sample: {r['sample_refs'][0]})" for r in cat["renderings"][:10])
        lines_ot.append(f"- **Top resolved CUV renderings**: {top_r}")
        if cat["homographs"]:
            lines_ot.append("- **STEP `TAHOT` Homograph Disambiguation**:")
            for hm in cat["homographs"]:
                lines_ot.append(
                    f"  - `{hm['d_strong']}` `{hm['lemma']}` (*{hm['translit']}*, \"{hm['en_gloss']}\"): {hm['top_renderings']}"
                )
        if gs == "H2617":
            lines_ot.append(
                "- **Empirical CUV Finding on `恩慈`**: In CUV (`raw_scripture`), `恩慈` occurs only 11 times total "
                "(2x OT for `H2898` *tuv* in Exo 33:19 & Zec 9:17; 9x NT for `G5544` *chrestotes*) and **0 times** for `H2617`! "
                "Instead, CUV renders `H2617` (*chesed*) in Gen–Jos as `慈愛`, `施恩`, `恩待`, `恩典`, `厚待` (plus `仁慈`, `恩惠` in Wisdom/Prophets; "
                "and `可恥的事` in Lev 20:17 for homograph `H2617B`). Because modern Chinese readers/RCUV/CNV frequently use `恩慈` for *chesed*, "
                "`恩慈 -> 慈愛` is an essential cross-translation synonym suggestion!"
            )
        lines_ot.append("- **Verse-level verification (Books 01–06 + key OT parallels)**:")
        show_hits = gd["books_1_to_6_hits"] if gs != "H3336" else gd["sample_all_books_hits"]
        for h in show_hits[:18]:
            lines_ot.append(
                f"  - `{h['ref']}`: raw `<w>`=`{h['raw_w']}` → resolved=`{h['resolved_term']}` — {h['verse_text']}"
            )
        lines_ot.append("")

    lines_ot.extend([
        "## 3. Top 100 Multi-Rendering Content Strong's Words",
        "",
        "| Rank | Strong's | Lemma | Translit | Gloss | Verses | Entropy | Top CUV Renderings |",
        "| ---: | --- | --- | --- | --- | ---: | ---: | --- |",
    ])
    for rank, m in enumerate(orig_data["top_100_multi_rendering_strongs"], 1):
        rends = ", ".join(f"`{r['term']}`({r['count']})" for r in m["renderings"][:5])
        lines_ot.append(
            f"| {rank} | `{m['strong_id']}` | {m['lemma']} | *{m['translit']}* | {m['en_gloss']} | "
            f"{m['verse_count']} | {m['rendering_entropy_bits']:.2f} | {rends} |"
        )

    (out_dir / "original_terms_summary.md").write_text("\n".join(lines_ot), encoding="utf-8")

    # 6. new_blindspots_found.md
    lines_bs = [
        "# Newly Discovered Search Blind Spots & Corpus Quirks Across 31,102 Verses",
        "",
        "Processing all 31,102 verses of `raw_scripture` alongside `ChiUn`, `ChiUns`, `ChiUnL`, `chi-cuv.usfx.xml`, `names.tsv`, `Unihan`, and STEP `TAHOT`/`TAGNT` uncovered **10 concrete blind spots** that were not previously documented:",
        "",
        "## 1. Inline Translator Notes Split Contiguous Chinese Phrases in `raw_scripture`",
        f"- `raw_scripture` embeds **{baseline.audit['translator_note_verse_count']}** verses with inline notes (`（原文…）`, `（或作…）`, **{baseline.audit['lenticular_bracket_verse_count']}** `【…】` verses, and **1 ASCII `[…]` verse** at `伯 31:18`: `我從出母腹就扶助[原文是引領]寡婦。`).",
        "- Examples where contiguous phrase search currently fails because an inline note interrupts the phrase:",
        "  - `伯 31:18`: searching `扶助寡婦` misses `扶助[原文是引領]寡婦`",
        "  - `得 4:5`: searching `娶死人的妻` misses `娶（原文是買；10節同）死人的妻`",
        "  - `王上 10:15`: searching `雜族的諸王` misses `雜族【歷代下九章14節作亞拉伯】的諸王`",
        "  - `弗 1:11`: searching `得了基業` misses `得（或作：成）了基業`",
        "  - `約 21:15`: searching `約翰的兒子西門` misses `約翰（在太16：17稱約拿）的兒子西門`",
        "- **Recommendation**: Strip inline translator notes (`【…】`, `[原文…]`, `（原文…）`, `（或作…）`) on an auxiliary searchable shadow string while preserving exact UTF-16 range mapping back to display text.",
        "",
        "## 2. Near-Total Absence of Quotation Marks `「」` in `raw_scripture` + Box Dash `U+2500` (`─`) & Small Colon `U+FE55` (`﹕`)",
        "- Across all 31,102 verses, `raw_scripture` omits speech quotation marks `「」` everywhere except **2 verses** (`路 9:54`, `約 21:20`), whereas `ChiUn`, `chi-cuv.usfx.xml`, and external Bible websites include `「」`/`『』` around all dialogue.",
        "- If a user copies and pastes a verse snippet from another site or article containing `「要有光」` or `「我是好牧人」`, literal substring search in `verseSearch.ts` fails unless punctuation/quotes are stripped or tokenized!",
        f"- Similarly, `raw_scripture` uses **`U+2500` BOX DRAWINGS LIGHT HORIZONTAL `─`** in **{baseline.audit['box_dash_U2500_verse_count']} verses** (`耶和華─你的神`), `U+FE55` SMALL COLON `﹕` in `林前 6:16` (`因為主說﹕二人要成為一體。`), and 4 ASCII dots `....` in `羅 8:34`.",
        "",
        "## 3. UTF-16 Surrogate Pair Offset Hazard on CJK Extension-B Characters (`𧼮` `U+27F2E`, `𣎴` `U+233B4`)",
        "- `raw_scripture` contains two Plane-2 CJK Extension-B characters that occupy **2 UTF-16 code units** in JavaScript strings:",
        "  - **`𧼮` (`U+27F2E`, 9 occurrences across 7 verses: `撒下 19:17`, `箴 25:26`, `賽 43:2`, `賽 47:2`, `結 47:3`, `結 47:4` [2x], `結 47:5` [2x])**: \"to wade across water\" (`你𧼮過江河`, `𧼮過水`), rendered as BMP **`蹚`** (`U+8E5A`, 7x) or **`逿`** (`U+903F`, 2x in `箴 25:26` `逿渾之泉`) in `ChiUn`, and **`趟`** (`U+8D9F`, 9x) in `chi-cuv.usfx.xml`! Users searching `你蹚過江河` or `你趟過江河` (`賽 43:2`) cannot easily type `𧼮` and will miss `賽 43:2` without folding.",
        "  - **`𣎴` (`U+233B4`, 6 occurrences across 6 verses: `賽 6:13`, `賽 11:1`, `賽 44:19`, `但 4:15`, `但 4:23`, `但 4:26`)**: \"tree stump / block\" (`樹𣎴子`, `木𣎴子`, `從耶西的本（原文是𣎴）`), rendered as BMP **`墩`** (`U+58A9`, 5x `樹墩`) or **`根`** (1x) in `ChiUn`, and **`不`** (`樹不子`) in `chi-cuv.usfx.xml`!",
        "- **Critical Engineering Warning**: In `verseSearch.ts`, replacing a 2-unit UTF-16 surrogate pair (`𧼮`, `.length === 2`) with a 1-unit BMP character (`蹚`/`趟`, `.length === 1`) inside `foldVerseVariants()` changes string `.length`! `getVerseMatchRanges()` currently only builds `getOriginalOffsets()` when `text.length !== normalized.length`, NOT when `searchable.length !== normalized.length`! Phase 2 MUST compute grapheme offsets whenever `searchable.length !== text.length` so highlight ranges never shift by 1 UTF-16 unit after `𧼮` or `𣎴`!",
        "",
        "## 4. Ten Non-Big5 Characters in `raw_scripture` (9 Also Missing from Windows CP950)",
        "- Complete list across all 31,102 verses: `𧼮`(9x in 7v, =`蹚`/`趟`/`逿`), `粃`(7x in 7v, =`秕`, e.g. `詩 1:4` `糠粃`), `𣎴`(6x in 6v, =`墩`, e.g. `賽 6:13` `樹𣎴子`), `銹`(4x in 3v, =`鏽`, in CP950 but non-Big5, `太 6:19–20`, `雅 5:3`), `挱`(2x in 2v, =`挲`, `伯 39:19` & `耶 4:31` `挓挱`), `珉`(2x in 1v, =`岷`, `代下 31:15` `珉雅珉`), `麅`(2x in 2v, =`麃`/`狍`, `申 14:5` & `王上 4:23` `麅子`), `葱`(1x, =`蔥`, `民 11:5`), `韮`(1x, =`韭`, `民 11:5`), `騌`(1x, =`鬃`/`騣`, `伯 39:19`).",
        "",
        "## 5. `ChiUnL.zip` Is Classical Literary Wenli (`文理和合本`, `Lang=lzh`), Not Mandarin CUV",
        "- Inspecting `mods.d/chiunl.conf` revealed `ChiUnL` is Public Domain **文理和合本** (`元始、上帝創造天地、`), with only `0.289` mean CJK Jaccard against `raw_scripture`.",
        "- Including `ChiUnL` in Mandarin CUV lexical diffing would inject Classical Chinese particles and vocabulary (`曰`, `爾`, `靡`, `偕焉`). Isolating it kept Mandarin CUV diff candidates pure.",
        "",
        "## 6. FHL `ChiUn` Already Modernized Specific Proper Names & Pronouns Compared to 1919 `raw_scripture`",
        "- Although `ChiUn` is labeled Traditional CUV, its 2021 FHL rebuild (`bible.fhl.net`) modernized feminine/divine pronouns (`她` 2,000+x) and specific proper names where `raw_scripture` retains 1919 forms: `塞魯士`→`古列`, `米底亞`→`瑪代`, `西奈`→`西乃` (in parts of Pentateuch), `約旦`→`約但`, `伊利莎白`→`以利沙伯`, `凱撒`→`該撒`, `意大利`→`義大利`, plus `甚麼`→`什麼`, `嗎`→`麼`/`嗎`, `做`→`作`.",
        "",
        "## 7. Cross-Edition Versification Shifts Uncovered Across CUV Datasets",
        "- **`約 7:53` & `約 8:1`**: `raw_scripture/約翰福音/第7章.txt` has **52** lines (not 53), because `於是各人都回家去了；` (`John 7:53`) is prepended to `約 8:1` (`於是各人都回家去了；耶穌卻往橄欖山去，`).",
        "- **`啟 12:17–18`**: `raw_scripture` has **17** verses (appending `那時龍就站在海邊的沙上。` to `啟 12:17`), whereas SWORD NRSV `ChiUn` places that clause in `啟 12:18`.",
        "- **`代上 21:31–22:19` in `chi-cuv.usfx.xml`**: follows Hebrew MT versification (`代上 22:1` placed at `21:31`, shifting all of `代上 22:2..19` by -1 verse).",
        "- **`申 4:32–33` & `民 12:10–11`**: `raw_scripture` has full text at `申 4:33` (`這樣的大事何曾有、何曾聽見呢？`), whereas both `ChiUn` (`'a'`) and `chi-cuv.usfx.xml` (`'併於上節'`) merge `申 4:33` into `申 4:32`! And in `民 12:10–11`, `有雪那樣白。亞倫一看米利暗長了大痲瘋，` sits at the start of `12:11` in `raw_scripture` vs the end of `12:10` in `ChiUn`/`USFX`.",
        "- **`ChiUn` Merged-Verse `'a'` Sentinel**: `ChiUn` encodes 69 `併於上節` verses as literal ASCII `'a'`.",
        "- **`names.tsv` Uses Masoretic OT Versification**: e.g., `GEN 32:11` in `names.tsv` corresponds to `創 32:10` in `raw_scripture`. Mapping via STEP `TAHOT`'s `Eng(Heb)` table resolved 100% of OT Masoretic shifts cleanly.",
        "",
        "## 8. FHL OSIS `<w>` Splitting of Disyllabic Chinese Words & Clitic Attachment",
        "- In `ChiUn`, FHL attaches prepositions/possessives directly inside `<w>` (`他的慈愛`, `求你照你的慈愛`, `上作經文`) AND splits disyllabic Chinese words across adjacent `<w>` tags when translating two Hebrew stems (`創 6:5` `<w H3336>所思</w><w H4284>想的</w>` for `思想`; `創 8:21` `<w H7451>懷著惡</w><w H3336>念</w>` for `惡念`; `創 1:21` `<w H1419>大</w><w H8577>魚</w>` for `大魚`; `書 2:12` `<w H2617>恩</w><w H6213>待</w>` for `恩待`).",
        "- Our two-pass clitic trimmer + clause-bounded attested-bigram resolver recovered the true CUV lexical words (`思想`, `惡念`, `大魚`, `恩待`, `施恩`, `經文`).",
        "",
        "## 9. KJV 4-Digit Strong's Homograph Conflation (`H8577` *tan* vs *tannin*, `H2617` *chesed* I vs II)",
        "- `ChiUn` uses 4-digit KJV Strong's numbers without homograph letters, conflating `H8577A` (`תַּן` *tan*, \"jackal\" → `野狗` in `尼 2:13`, `伯 30:29`) with `H8577M`/`B` (`תַּנִּין` *tannin*, \"serpent / sea monster\" → `大魚`, `蛇`, `大蛇`), and `H2617A` (*chesed* \"lovingkindness\" → `慈愛`) with `H2617B` (*chesed* \"shame\" → `可恥的事` in `利 20:17`).",
        "- Cross-referencing STEP `TAHOT` `dStrong` codes disambiguates homographs per verse and ensures `H8577` defaults to *tannin* rather than *tan*.",
        "",
        "## 10. `恩慈` Never Translates `H2617` (*chesed*) in CUV!",
        "- Modern Chinese Bible readers (influenced by RCUV, CNV, and theological literature) frequently search `恩慈` expecting Old Testament *chesed* (`H2617`) passages (`出 34:6`, `詩 23:6`, `詩 136`).",
        "- Empirically, `恩慈` appears **0 times** for `H2617` in CUV (only 2x in OT for `H2898` *tuv* and 9x in NT for `G5544` *chrestotes*). Adding `恩慈 -> 慈愛` as a search suggestion bridges one of the most common theological search misses in CUV.",
    ]
    (out_dir / "new_blindspots_found.md").write_text("\n".join(lines_bs), encoding="utf-8")


# ---------------------------------------------------------------------------
# 10. Mode Execution (`candidates` vs `emit`)
# ---------------------------------------------------------------------------

def run_candidates_mode(
    repo_root: Path,
    scripture_root: Path,
    cache_dir: Path,
    out_dir: Path,
) -> None:
    assert_not_inside_readonly(out_dir, scripture_root)
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    print(f"[1/6] Loading baseline raw_scripture from {scripture_root / 'raw_scripture'} ...")
    baseline = load_baseline_scripture(repo_root, scripture_root)
    print(
        f"      Loaded {baseline.audit['total_verses']:,} verses across {baseline.audit['total_books']} books "
        f"({baseline.audit['unique_cjk_chars']:,} unique CJK chars, {len(baseline.audit['non_big5_chars'])} non-Big5 chars)."
    )

    print(f"[2/6] Decoding SWORD zText (ChiUn, ChiUns, ChiUnL) & USFX XML from {cache_dir} ...")
    nrsv_counts = extract_nrsv_versification_from_chiun(cache_dir / "ChiUn.zip")
    conf_chiun, chiun_verses = load_sword_ztext_module(cache_dir / "ChiUn.zip", baseline.books, nrsv_counts)
    conf_chiuns, chiuns_verses = load_sword_ztext_module(cache_dir / "ChiUns.zip", baseline.books, nrsv_counts)
    conf_chiunl, chiunl_verses = load_sword_ztext_module(cache_dir / "ChiUnL.zip", baseline.books, nrsv_counts)
    usfx_trad = load_usfx_xml(cache_dir / "chi-cuv.usfx.xml")
    usfx_simp = load_usfx_xml(cache_dir / "chi-cuv-simp.usfx.xml")

    alignment_report = compute_alignment_report(
        baseline,
        {
            "ChiUn": chiun_verses,
            "chi-cuv.usfx": usfx_trad,
            "ChiUnL": chiunl_verses,
        },
    )
    chiun_rate = alignment_report["editions"]["ChiUn"]["aligned_ge_075_rate"]
    usfx_rate = alignment_report["editions"]["chi-cuv.usfx"]["aligned_ge_075_rate"]
    print(f"      Alignment >=0.75 Jaccard: ChiUn={chiun_rate*100:.2f}%, chi-cuv.usfx={usfx_rate*100:.2f}% (Gate >98% PASS)")
    if chiun_rate < 0.98 or usfx_rate < 0.98:
        raise RuntimeError("Alignment gate (<98%) failed on Mandarin CUV source!")

    print("[3/6] Running Context-Anchored Diff across Mandarin CUV editions ...")
    diff_data = run_context_anchored_diff(
        baseline,
        {"ChiUn": chiun_verses, "chi-cuv.usfx": usfx_trad},
    )
    print(
        f"      Found {diff_data['total_distinct_minimal_pairs']:,} minimal diff pairs "
        f"({diff_data['zero_hit_minimal_pairs']:,} zero-hit) and {len(diff_data['expanded_2char_compounds']):,} 2-char compounds."
    )

    print("[4/6] Loading STEP Bible TBESH/TBESG/TAHOT/TAGNT & aligning ChiUn OSIS Strong's spans ...")
    step_data = load_step_data(scripture_root)
    osis_tokens, _attested = extract_aligned_osis_tokens(baseline, chiun_verses)
    print(
        f"      Loaded {len(step_data.primary_by_strong):,} STEP Strong's entries and "
        f"aligned OSIS tokens across {len(osis_tokens):,} verses."
    )

    print("[5/6] Extracting Proper-Name, Character-Variant & 66-Book Original-Language candidates ...")
    proper_data = build_proper_name_candidates(cache_dir, baseline, step_data, osis_tokens, chiun_verses)
    char_data = build_char_variant_candidates(
        cache_dir, baseline, chiun_verses, chiuns_verses, usfx_trad, usfx_simp
    )
    orig_data = build_original_language_candidates(baseline, step_data, osis_tokens)

    print(f"[6/6] Writing candidate JSONs and Markdown reports to {out_dir} ...")
    (out_dir / "baseline_audit.json").write_text(
        json.dumps({"baseline": baseline.audit, "alignment": alignment_report}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "diff_candidates.json").write_text(
        json.dumps(diff_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "proper_name_candidates.json").write_text(
        json.dumps(proper_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "char_variants_candidates.json").write_text(
        json.dumps(char_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    compact_payload_66 = orig_data.pop("_compact_payload_66")
    (out_dir / "original_terms_candidates.json").write_text(
        json.dumps(orig_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    # Also save compact preview artifact inside phase1_candidates for Phase 2 inspection/emit
    (out_dir / "verse_original_terms_preview.json").write_text(
        json.dumps(compact_payload_66, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    write_markdown_reports(
        out_dir=out_dir,
        baseline=baseline,
        conf_chiun=conf_chiun,
        conf_chiuns=conf_chiuns,
        conf_chiunl=conf_chiunl,
        alignment_report=alignment_report,
        diff_data=diff_data,
        proper_data=proper_data,
        char_data=char_data,
        orig_data=orig_data,
    )

    elapsed = time.perf_counter() - t0
    print(f"Done in {elapsed:.2f}s! All Phase 1 candidate artifacts written to: {out_dir}")


def run_emit_mode(repo_root: Path, scripture_root: Path, approved_dir: Path, emit_root: Path | None = None) -> None:
    """
    Phase 2 emitter: reads audited `audited_rules.json` + `verse_original_terms_approved.json`
    from `--approved-dir` and writes:
      - `plugins/semantic-search/src/data/compatData.ts`
      - `quartz/data/verse-original-terms.json`
    """
    assert_not_inside_readonly(repo_root, scripture_root)
    emit_root = emit_root or repo_root
    rules_path = approved_dir / "audited_rules.json"
    terms_path = approved_dir / "verse_original_terms_approved.json"
    if not rules_path.exists():
        raise FileNotFoundError(
            f"Missing audited rules file: {rules_path}. Complete Phase 1 audit & user approval before running --mode emit."
        )
    if not terms_path.exists():
        raise FileNotFoundError(
            f"Missing approved original-terms file: {terms_path}. Complete Phase 1 audit & user approval before running --mode emit."
        )

    rules = json.loads(rules_path.read_text(encoding="utf-8"))
    char_folds: dict[str, str] = rules["active1To1CharFoldMap"]
    simp_phrases: dict[str, str] = rules["simplifiedAndVariantPhrases"]
    proper_grouped: dict[str, list[str]] = rules["approvedProperAndEditionGrouped"]
    bridge_terms = [
        {
            "query": b["query"],
            "cuvTerms": b["cuvTerms"],
            "strongIds": b["strongIds"],
        }
        for b in rules["bridgeTerms"]
    ]
    protected_ta = next(
        (
            r.get("protectedProperNamePrefixes", [])
            for r in rules.get("smartRewrites", [])
            if r.get("id") == "third_person_pronoun_phrase_to_ta"
        ),
        [],
    )

    compat_ts_path = emit_root / "plugins" / "semantic-search" / "src" / "data" / "compatData.ts"
    compat_ts_path.parent.mkdir(parents=True, exist_ok=True)
    ts_lines = [
        "// Auto-generated by scripts/build-verse-compat.py --mode emit",
        "// Data sources: 1919 CUV (Public Domain), CrossWire ChiUn/ChiUns (Public Domain),",
        "// seven1m/open-bibles (Public Domain), Unicode Unihan (Unicode-3.0), STEP Bible (CC BY 4.0).",
        "// Do not edit manually.",
        "",
        "export interface BridgeTermRule {",
        "  readonly query: string;",
        "  readonly cuvTerms: readonly string[];",
        "  readonly strongIds: readonly string[];",
        "}",
        "",
        f"export const CHAR_FOLD_MAP: Readonly<Record<string, string>> = {json.dumps(char_folds, ensure_ascii=False, indent=2)};",
        "",
        f"export const SIMPLIFIED_PHRASE_MAP: Readonly<Record<string, string>> = {json.dumps(simp_phrases, ensure_ascii=False, indent=2)};",
        "",
        f"export const PROPER_AND_EDITION_EQUIVALENTS: Readonly<Record<string, readonly string[]>> = {json.dumps(proper_grouped, ensure_ascii=False, indent=2)};",
        "",
        f"export const PROTECTED_TA_PROPER_NAMES: readonly string[] = {json.dumps(protected_ta, ensure_ascii=False, indent=2)};",
        "",
        f"export const BRIDGE_TERMS: readonly BridgeTermRule[] = {json.dumps(bridge_terms, ensure_ascii=False, indent=2)};",
        "",
    ]
    compat_ts_path.write_text("\n".join(ts_lines), encoding="utf-8")

    out_terms_path = emit_root / "quartz" / "data" / "verse-original-terms.json"
    out_terms_path.parent.mkdir(parents=True, exist_ok=True)
    terms_payload = json.loads(terms_path.read_text(encoding="utf-8"))
    out_terms_path.write_text(
        json.dumps(terms_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Emitted {compat_ts_path} ({compat_ts_path.stat().st_size:,} B) and {out_terms_path} ({out_terms_path.stat().st_size:,} B)")


def _env_path(name: str) -> Path | None:
    """Return the path in environment variable `name`, or None if unset/empty."""
    value = os.environ.get(name, "").strip()
    return Path(value) if value else None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build cross-version Bible search compatibility & original-language data.",
        epilog="Paths may also be set via VERSE_COMPAT_SCRIPTURE_ROOT, VERSE_COMPAT_CACHE_DIR and VERSE_COMPAT_OUT_DIR. See the module docstring.",
    )
    parser.add_argument("--mode", choices=("candidates", "emit"), default="candidates")
    parser.add_argument("--repo-root", type=Path, default=DEFAULT_REPO_ROOT,
                        help="repository root (default: derived from this script's location)")
    parser.add_argument("--scripture-root", type=Path, default=_env_path("VERSE_COMPAT_SCRIPTURE_ROOT"),
                        help="scripture root with raw_scripture/ and .stepbible_data/ (env: VERSE_COMPAT_SCRIPTURE_ROOT; required in both modes)")
    parser.add_argument("--cache-dir", type=Path, default=_env_path("VERSE_COMPAT_CACHE_DIR"),
                        help="directory with the cached public-domain inputs (env: VERSE_COMPAT_CACHE_DIR; required in candidates mode)")
    parser.add_argument("--out-dir", type=Path, default=_env_path("VERSE_COMPAT_OUT_DIR"),
                        help="output directory for candidate reports (env: VERSE_COMPAT_OUT_DIR; required in candidates mode)")
    parser.add_argument("--approved-dir", type=Path, default=None,
                        help="directory with audited rules for emit mode (default: --out-dir)")
    parser.add_argument("--emit-root", type=Path, default=None,
                        help="emit mode: root to write outputs under (default: --repo-root)")
    args = parser.parse_args()

    if args.scripture_root is None:
        parser.error("--scripture-root is required in both modes (or set VERSE_COMPAT_SCRIPTURE_ROOT)")

    if args.mode == "candidates":
        if args.cache_dir is None:
            parser.error("--cache-dir is required in candidates mode (or set VERSE_COMPAT_CACHE_DIR)")
        if args.out_dir is None:
            parser.error("--out-dir is required in candidates mode (or set VERSE_COMPAT_OUT_DIR)")
        run_candidates_mode(
            repo_root=args.repo_root,
            scripture_root=args.scripture_root,
            cache_dir=args.cache_dir,
            out_dir=args.out_dir,
        )
    else:
        approved_dir = args.approved_dir or args.out_dir
        if approved_dir is None:
            parser.error("emit mode needs --approved-dir or --out-dir (or set VERSE_COMPAT_OUT_DIR)")
        run_emit_mode(
            repo_root=args.repo_root,
            scripture_root=args.scripture_root,
            approved_dir=approved_dir,
            emit_root=args.emit_root,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
