"""MACULA Hebrew TSV 的讀取、實詞判斷、中文解釋拆成候選詞。（純函式）"""
from __future__ import annotations

import csv
import re
from typing import Iterable, Iterator

BOOK_CODES = {"GEN": 1, "EXO": 2, "LEV": 3, "NUM": 4, "DEU": 5, "JOS": 6, "JDG": 7, "RUT": 8,
              "1SA": 9, "2SA": 10, "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14, "EZR": 15, "NEH": 16,
              "EST": 17, "JOB": 18, "PSA": 19, "PRO": 20, "ECC": 21, "SNG": 22, "ISA": 23, "JER": 24,
              "LAM": 25, "EZK": 26, "DAN": 27, "HOS": 28, "JOL": 29, "AMO": 30, "OBA": 31, "JON": 32,
              "MIC": 33, "NAM": 34, "HAB": 35, "ZEP": 36, "HAG": 37, "ZEC": 38, "MAL": 39}

# 實詞 = 名詞（普通名詞）、動詞、形容詞（非數字）、副詞。
CONTENT_POS = {"noun", "verb", "adjective", "adverb"}
# 這些 type 即使詞性是實詞也排除：專有名詞、民族名、數字（舊資料的詞表也不收）。
EXCLUDED_TYPES = {"proper", "gentilic", "cardinal number", "ordinal number"}

# 解釋裡常見的「文法補字」，單獨出現時不當候選詞。
GLOSS_FUNCTION_CHARS = set("的在上是为所和与对于被把将了着过之以们")
_SPLIT_RE = re.compile(r"[/~\s,，;；、@()（）]+")
_TRIM_CHARS = "所的了着过们"


def parse_ref(ref: str) -> tuple[int, int, int, int] | None:
    """'GEN 20:5!14' -> (book, chapter, verse, word_index)；非舊約或格式不符回傳 None。"""
    m = re.match(r"^([1-3]?[A-Z]{2,3}) (\d+):(\d+)!(\d+)$", ref)
    if not m or m.group(1) not in BOOK_CODES:
        return None
    return BOOK_CODES[m.group(1)], int(m.group(2)), int(m.group(3)), int(m.group(4))


def strong_key(strongnumberx: str) -> str | None:
    """'2416a' -> 'H2416'；'0871a' -> 'H871'（與舊資料鍵相同：去前導零、去字母尾碼）。"""
    m = re.match(r"^0*(\d+)[a-z]?$", strongnumberx.strip())
    if not m or int(m.group(1)) == 0:
        return None
    return "H" + str(int(m.group(1)))


def sense_key(strong: str, sensenumber: str) -> str:
    sense = sensenumber.strip()
    return f"{strong}.{sense}" if sense else strong


def is_content_word(row: dict[str, str]) -> bool:
    if row.get("pos") not in CONTENT_POS:
        return False
    if row.get("type") in EXCLUDED_TYPES:
        return False
    return strong_key(row.get("strongnumberx", "")) is not None


def gloss_candidates(mandarin: str) -> list[str]:
    """把中文解釋（簡體）拆成候選詞，依優先順序：每一段先給原樣，再給去掉頭尾補字的版本。"""
    out: list[str] = []
    for part in _SPLIT_RE.split(mandarin or ""):
        if not part or all(ch in GLOSS_FUNCTION_CHARS for ch in part):
            continue
        for cand in (part, part.strip(_TRIM_CHARS)):
            if cand and cand not in out and not all(ch in GLOSS_FUNCTION_CHARS for ch in cand):
                out.append(cand)
    return out


def read_macula_rows(path: str) -> Iterator[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fh:
        yield from csv.DictReader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)


def group_by_verse(rows: Iterable[dict[str, str]], books: set[int]) -> dict[tuple[int, int, int], list[dict[str, str]]]:
    """依希伯來文節號分組（保持原順序），只留指定書卷。"""
    out: dict[tuple[int, int, int], list[dict[str, str]]] = {}
    for row in rows:
        p = parse_ref(row["ref"])
        if not p or p[0] not in books:
            continue
        out.setdefault(p[:3], []).append(row)
    return out
