"""把各階段接起來。對應邏輯在 align.py；這裡只做組裝與輸出格式。"""
from __future__ import annotations

from collections import Counter

from align import Result, VerseText, Word, align_verse_pass1, align_verse_pass2, tally_confirmed
from charfold import fold_text
from macula import gloss_candidates, is_content_word, sense_key, strong_key

ATTRIBUTION = (
    "MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/ (CC BY 4.0); "
    "Cherith glosses by Andi Wu (CC BY 4.0); STEP Bible (CC BY 4.0) & CrossWire ChiUn (Public Domain)"
)

Ref = tuple[int, int, int]


def build_words(rows: list[dict[str, str]], fold_map: dict[str, str], offset: int = 0, total: int | None = None) -> list[Word]:
    words: list[Word] = []
    total = total if total is not None else len(rows)
    for i, row in enumerate(rows):
        if not is_content_word(row):
            continue
        sid = strong_key(row["strongnumberx"])
        assert sid
        cands = [fold_text(c, fold_map) for c in gloss_candidates(row.get("mandarin", ""))]
        words.append(Word(sid, sense_key(sid, row.get("sensenumber", "")), cands, offset + i, total, {
            "heb": row.get("text", ""), "translit": row.get("transliteration", ""), "english": row.get("english", ""),
            "xmlid": row.get("xml:id", ""), "gloss": row.get("mandarin", ""), "lemma": row.get("lemma", ""), "ref": row.get("ref", "")}))
    return words


def run_alignment(
    macula_by_verse: dict[Ref, list[dict[str, str]]],
    heb_to_cuv: dict[Ref, Ref],
    cuv_text: dict[Ref, str],
    fhl_by_verse: dict[Ref, dict[str, list[tuple[int, int]]]],
    fold_map: dict[str, str],
    is_cjk,
) -> tuple[dict[Ref, list[Result]], Counter, dict[str, Counter], dict[Ref, VerseText]]:
    """回傳 {中文節號: [Result…]}（希伯來文順序）、略過原因統計、各字義已確定的譯法、各節經文。"""
    skipped: Counter = Counter()
    # 先把併入同一節的希伯來文節合在一起，詞素順序才連續
    merged: dict[Ref, list[dict[str, str]]] = {}
    for heb_ref, rows in sorted(macula_by_verse.items()):
        merged.setdefault(heb_to_cuv.get(heb_ref, heb_ref), []).extend(rows)
    verses: dict[Ref, VerseText] = {}
    pass1: dict[Ref, list[Result]] = {}
    for ref, rows in merged.items():
        text = cuv_text.get(ref)
        words = build_words(rows, fold_map)
        if text is None:
            skipped["和合本沒有這一節"] += len(words)
            continue
        if text.strip() == "併於上節。":
            skipped["和合本該節為「併於上節」"] += len(words)
            continue
        verses[ref] = VerseText.build(text, fold_map, is_cjk)
        pass1[ref] = align_verse_pass1(verses[ref], words, fhl_by_verse.get(ref, {}))
    by_sense, by_strong = tally_confirmed([r for rs in pass1.values() for r in rs])
    final = {
        ref: align_verse_pass2(verses[ref], rs, fhl_by_verse.get(ref, {}), by_sense, by_strong, fold_map)
        for ref, rs in pass1.items()
    }
    return final, skipped, by_sense, verses


def top_renderings(counter: Counter, n: int = 5) -> list[str]:
    return [r for r, _ in counter.most_common(n)]


def to_json_chapters(results: dict[Ref, list[Result]], slug_of, with_sense: bool) -> dict:
    """with_sense=True：[sid, 譯法, 字義鍵]，保留空譯法；False：舊格式 [sid, 譯法]，丟掉空譯法。"""
    chapters: dict[str, dict[str, list]] = {}
    for (b, c, v), rs in sorted(results.items()):
        row = []
        for r in rs:
            if with_sense:
                row.append([r.word.sid, r.rendering, r.word.sense])
            elif r.rendering:
                row.append([r.word.sid, r.rendering])
        if row:
            chapters.setdefault(slug_of(b, c), {})[str(v)] = row
    return chapters
