"""AI 判讀階段：規則找不到（或只靠語序挑的）原文字，請兩個模型各自指出和合本的對應字。

純函式：建提示、解析回覆、驗證字串、合併兩位的答案。呼叫模型的程式在 run_ai_stage.py。
只有「兩位回同一個字串、而且是經文裡未被別的原文字用掉的連續原字」才收（rule = ai_agree）。
"""
from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass

from align import ACCEPTED_RULES, Result, Span, VerseText, _distance, _overlap, expected_position

MAX_BATCH_ITEMS = 50
MAX_BATCH_CHARS = 24000  # 提示全文要放進命令列參數（Gemini），留餘裕


def item_id(ref: tuple[int, int, int], result: Result) -> str:
    return f"{ref[0]}.{ref[1]}.{ref[2]}.{result.word.index}"


def build_queue(
    results: dict[tuple[int, int, int], list[Result]],
    verses: dict[tuple[int, int, int], VerseText],
    by_sense: dict[str, Counter],
    verse_label,
) -> list[dict]:
    """要送 AI 的項目：所有仍是 none 的原文字（含 order 降級而來的）。"""
    queue: list[dict] = []
    for ref in sorted(results):
        rs = results[ref]
        claimed = [r.rendering for r in rs if r.rule in ACCEPTED_RULES and r.rendering]
        for r in rs:
            if r.rule != "none":
                continue
            m = r.word.meta or {}
            sense_num = r.word.sense.split(".", 1)[1] if "." in r.word.sense else ""
            queue.append({
                "id": item_id(ref, r),
                "verse_ref": verse_label(ref),
                "verse": verses[ref].text,
                "heb": m.get("heb", ""), "translit": m.get("translit", ""), "strong": r.word.sid,
                "english": m.get("english", ""), "mandarin": m.get("gloss", ""),
                "sense": sense_num,
                "sense_renderings": [x for x, _ in by_sense.get(r.word.sense, Counter()).most_common(5)],
                "claimed": claimed,
                "prior": r.prior,
            })
    return queue


def make_batches(queue: list[dict]) -> list[list[dict]]:
    batches: list[list[dict]] = []
    cur: list[dict] = []
    size = 0
    for it in queue:
        n = len(json.dumps(it, ensure_ascii=False))
        if cur and (len(cur) >= MAX_BATCH_ITEMS or size + n > MAX_BATCH_CHARS):
            batches.append(cur)
            cur, size = [], 0
        cur.append(it)
        size += n
    if cur:
        batches.append(cur)
    return batches


PROMPT_HEAD = """你是熟悉聖經希伯來文與和合本（CUV，繁體）的審稿人。下面每一項是：一節和合本經文（verse）、這節裡的一個希伯來文原文字（heb 希伯來文、translit 音譯、strong 編號、english 英文解釋、mandarin 現代中文解釋〔簡體，供參考〕、sense 字義編號與 sense_renderings 該字義在別處已確定的和合本譯法〔可能是空的〕），以及 claimed（同一節裡已被其他原文字用掉的中文字，列表）。

請找出：這節和合本裡，「翻譯這個原文字」的那幾個中文字。規則：
1. 必須是 verse 中的連續原字（exact substring），不可含標點、不可改字、不可自己補字。
2. 不可與 claimed 裡的字重疊（那些字已經是別的原文字的譯法）。
3. 只取這個原文字本身的譯法：不要把相鄰別的詞或文法字（的、了、著…）一起帶進來；也不要只取一部分（例如譯法是「領出」就取「領出」）。
4. 和合本沒有直接翻出這個原文字時，答 NONE（例如合併省略、意譯到別處）。
5. 同一段中文在經文裡出現好幾次時，選對應這個原文字位置的那一處（只要回字串）。

只輸出一個 JSON 陣列，不要任何其他文字、不要 markdown 圍欄。每項格式：{"id":"…","span":"…"}（沒有就 "span":"NONE"）。陣列涵蓋全部項目，順序同輸入。

項目：
"""


def make_prompt(batch: list[dict]) -> str:
    slim = [{k: v for k, v in it.items() if k != "prior"} for it in batch]
    return PROMPT_HEAD + json.dumps(slim, ensure_ascii=False, indent=0) + "\n"


def parse_response(text: str) -> dict[str, str] | None:
    """從模型回覆取出 {id: span}；格式不對回傳 None。"""
    m = re.search(r"\[.*\]", text, re.S)
    if not m:
        return None
    try:
        arr = json.loads(m.group(0))
    except ValueError:
        return None
    out: dict[str, str] = {}
    for a in arr:
        if isinstance(a, dict) and "id" in a and isinstance(a.get("span"), str):
            out[str(a["id"])] = a["span"].strip()
    return out or None


def is_none(span: str) -> bool:
    return span.strip().upper() in ("NONE", "")


def validate_span(verse: VerseText, span: str, claimed: list[Span], expected: float) -> Span | None:
    """span 必須是經文裡連續、不跨標點、且不與已用位置重疊的原字；多處時取最靠近預期位置的。"""
    n = len(span)
    if n == 0 or span not in verse.cjk:
        return None
    occs: list[Span] = []
    start = verse.cjk.find(span)
    while start != -1:
        end = start + n
        if verse.pos[end - 1] - verse.pos[start] == n - 1 and verse.text[verse.pos[start]:verse.pos[end - 1] + 1] == span:
            occs.append((start, end))
        start = verse.cjk.find(span, start + 1)
    free = [o for o in occs if not any(_overlap(o, c) for c in claimed)]
    if not free:
        return None
    return min(free, key=lambda o: _distance(o, expected))


@dataclass
class Decision:
    kind: str            # accept / none_agree / disagree / invalid / missing
    span: Span | None = None
    a: str = ""
    b: str = ""


def decide(verse: VerseText, result: Result, a: str | None, b: str | None, claimed: list[Span]) -> Decision:
    if a is None or b is None:
        return Decision("missing", None, a or "", b or "")
    if is_none(a) and is_none(b):
        return Decision("none_agree", None, a, b)
    if a != b:
        return Decision("disagree", None, a, b)
    span = validate_span(verse, a, claimed, expected_position(result.word, verse))
    if span is None:
        return Decision("invalid", None, a, b)
    return Decision("accept", span, a, b)


def apply_ai(
    results: dict[tuple[int, int, int], list[Result]],
    verses: dict[tuple[int, int, int], VerseText],
    answers_a: dict[str, str],
    answers_b: dict[str, str],
    pair_of: dict[str, str] | None = None,
) -> tuple[dict[tuple[int, int, int], list[Result]], Counter, list[dict]]:
    """把兩位的答案套回結果。回傳新結果、各決定的筆數、分歧清單（供報告）。"""
    stats: Counter = Counter()
    disagreements: list[dict] = []
    out: dict[tuple[int, int, int], list[Result]] = {}
    for ref, rs in results.items():
        claimed = [r.span for r in rs if r.span and r.rule in ACCEPTED_RULES]
        new_rs: list[Result] = []
        for r in rs:
            if r.rule != "none":
                new_rs.append(r)
                continue
            iid = item_id(ref, r)
            d = decide(verses[ref], r, answers_a.get(iid), answers_b.get(iid), claimed)
            pair = (pair_of or {}).get(iid, "")
            stats[d.kind] += 1
            if pair:
                stats[f"{d.kind}:{pair}"] += 1
            if d.kind == "accept" and d.span:
                claimed.append(d.span)
                cjk = verses[ref].cjk
                new_rs.append(Result(r.word, cjk[d.span[0]:d.span[1]], "ai_agree", d.span, pair or None, r.prior))
            else:
                if d.kind in ("disagree", "invalid"):
                    disagreements.append({"id": iid, "kind": d.kind, "a": d.a, "b": d.b,
                                          "pair": pair, "strong": r.word.sid, "english": (r.word.meta or {}).get("english", ""),
                                          "verse": verses[ref].text})
                new_rs.append(r)
        out[ref] = new_rs
    return out, stats, disagreements


def decision_key(result: Result) -> str:
    """AI 採用結果的穩定鍵：MACULA 的 xml:id（不隨詞序或批次改變）。"""
    return (result.word.meta or {}).get("xmlid", "")


def collect_decisions(results: dict[tuple[int, int, int], list[Result]]) -> list[dict]:
    """把 ai_agree 的結果整理成可進版控的小檔內容（依 xml:id 排序）。"""
    rows = [{"id": decision_key(r), "span": r.rendering, "pair": r.pair or ""}
            for rs in results.values() for r in rs if r.rule == "ai_agree" and decision_key(r)]
    return sorted(rows, key=lambda d: d["id"])


def apply_decisions(
    results: dict[tuple[int, int, int], list[Result]],
    verses: dict[tuple[int, int, int], VerseText],
    decisions: dict[str, dict],
) -> tuple[dict[tuple[int, int, int], list[Result]], Counter]:
    """不呼叫模型：用存檔的採用結果重建 ai_agree。每筆仍要驗證是經文裡未被用掉的連續原字。"""
    stats: Counter = Counter()
    out: dict[tuple[int, int, int], list[Result]] = {}
    for ref, rs in results.items():
        claimed = [r.span for r in rs if r.span and r.rule in ACCEPTED_RULES]
        new_rs: list[Result] = []
        for r in rs:
            d = decisions.get(decision_key(r)) if r.rule == "none" else None
            span = validate_span(verses[ref], d["span"], claimed, expected_position(r.word, verses[ref])) if d else None
            if span:
                claimed.append(span)
                stats["accept"] += 1
                new_rs.append(Result(r.word, verses[ref].cjk[span[0]:span[1]], "ai_agree", span, d.get("pair") or None, r.prior))
            else:
                if d:
                    stats["rejected"] += 1
                new_rs.append(r)
        out[ref] = new_rs
    return out, stats
