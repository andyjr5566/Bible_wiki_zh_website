"""把 MACULA 的原文字對到和合本經文裡的中文字。（純函式，不讀檔）

規則（見 dev-notes/original-terms/README.md O-2）：
  unique / fhl / order：MACULA 中文解釋（折疊簡繁後）在經文中找到
  confirmed_sense / confirmed_strong：用別處已確定的同字義／同原文字譯法，在信望愛標的範圍內找
  none：和合本未直接譯出（譯法留空）
"""
from __future__ import annotations

from collections import Counter
from functools import lru_cache
from dataclasses import dataclass

from charfold import fold_text

Span = tuple[int, int]  # [start, end)，座標是「只留漢字」的經文字串

ACCEPTED_RULES = {"unique", "fhl", "confirmed_sense", "ai_agree"}  # order、confirmed_strong 不再直接接受
MIN_CONFIRMED_COUNT = 2  # 規則②：一個譯法至少在別處被確定 2 次才拿來用
MIN_SINGLE_CHAR_SHARE = 0.5  # 規則②：單字譯法必須佔該字義已確定譯法的一半以上（避免「你」「行」這類萬用字）


@dataclass
class VerseText:
    text: str            # 和合本整節原文（含標點）
    cjk: str             # 只留漢字
    pos: list[int]       # cjk 每個字在 text 裡的位置
    folded: str          # cjk 折疊簡繁後（與 cjk 等長）

    @classmethod
    def build(cls, text: str, fold_map: dict[str, str], is_cjk) -> "VerseText":
        pos = [i for i, ch in enumerate(text) if is_cjk(ch)]
        cjk = "".join(text[i] for i in pos)
        return cls(text, cjk, pos, fold_text(cjk, fold_map))


@dataclass
class Word:
    sid: str                    # H3824
    sense: str                  # H3824.1 或 H3824
    candidates: list[str]       # 已折疊的候選詞
    index: int                  # 在整節（所有詞素）中的順序，0 起算
    total: int                  # 整節詞素數
    meta: dict | None = None    # 顯示用資料（希伯來文、音譯、英文、中文解釋、希伯來文節號）


@dataclass
class Result:
    word: Word
    rendering: str
    rule: str
    span: Span | None = None
    pair: str | None = None    # ai_agree 由哪一對評審決定（如 codex+agy）
    prior: str | None = None   # 被降級前的規則（order／confirmed_strong 不再直接接受，改送 AI）


def find_spans(verse: VerseText, needle_folded: str) -> list[Span]:
    """needle 在折疊後經文中的所有位置；不可跨標點（原文位置必須連續）。"""
    out: list[Span] = []
    n = len(needle_folded)
    if n == 0:
        return out
    start = verse.folded.find(needle_folded)
    while start != -1:
        end = start + n
        if verse.pos[end - 1] - verse.pos[start] == n - 1:
            out.append((start, end))
        start = verse.folded.find(needle_folded, start + 1)
    return out


def _overlap(a: Span, b: Span) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def _inside(a: Span, b: Span) -> bool:
    return b[0] <= a[0] and a[1] <= b[1]


def _distance(span: Span, expected: float) -> float:
    return abs((span[0] + span[1]) / 2 - expected)


def expected_position(word: Word, verse: VerseText) -> float:
    return (word.index + 0.5) / max(word.total, 1) * len(verse.cjk)


def choose_occurrence(
    occs: list[Span], claimed: list[Span], fhl: list[Span], expected: float
) -> tuple[Span, str] | None:
    """多個出現位置時挑一個：先排除已被別的原文字用掉的；再看信望愛位置；最後看原文語序。"""
    free = [o for o in occs if not any(_overlap(o, c) for c in claimed)]
    if not free:
        return None
    if len(occs) == 1:
        return free[0], "unique"
    near = [o for o in free if any(_overlap(o, f) for f in fhl)]
    if near:
        return min(near, key=lambda o: _distance(o, expected)), "fhl"
    return min(free, key=lambda o: _distance(o, expected)), "order"


def _best_candidate(verse: VerseText, w: Word) -> tuple[str, list[Span]] | None:
    for cand in w.candidates:
        occs = find_spans(verse, cand)
        if occs:
            return cand, occs
    return None


def assign_group(
    verse: VerseText, words: list[Word], spans: list[Span], fhl: list[Span]
) -> dict[int, tuple[Span, str]]:
    """同一原文字在一節裡出現多次、而且共用同一個候選詞時，一起分配（依序、總距離最小）。

    回傳 {words 的位置: (span, rule)}。解釋出現的處數少於原文字數時，只有最合適的幾個原文字拿到。
    """
    spans = sorted(spans)
    k, m = len(words), len(spans)
    t = min(k, m)
    big = len(verse.cjk) + 1.0

    def cost(i: int, j: int) -> float:
        c = _distance(spans[j], expected_position(words[i], verse))
        if any(_overlap(spans[j], f) for f in fhl):
            c -= big
        return c

    @lru_cache(maxsize=None)
    def best(i: int, j: int, c: int) -> tuple[float, tuple[tuple[int, int], ...]]:
        if c == 0:
            return 0.0, ()
        if i == k or j == m or (k - i) < c or (m - j) < c:
            return float("inf"), ()
        take_cost, take_pairs = best(i + 1, j + 1, c - 1)
        options = [(cost(i, j) + take_cost, ((i, j),) + take_pairs), best(i + 1, j, c), best(i, j + 1, c)]
        return min(options, key=lambda o: o[0])

    out: dict[int, tuple[Span, str]] = {}
    for i, j in best(0, 0, t)[1]:
        rule = "fhl" if any(_overlap(spans[j], f) for f in fhl) else ("unique" if k == 1 else "order")
        out[i] = (spans[j], rule)
    return out


def align_verse_pass1(
    verse: VerseText, words: list[Word], fhl_spans: dict[str, list[Span]]
) -> list[Result]:
    """規則①。找不到的原文字先回傳 rule='none'，留給第二階段。

    同一原文字在這節出現多次且共用同一個候選詞時，先整組分配（避免第一個把唯一的「心」拿走）。
    """
    first_hit = [_best_candidate(verse, w) for w in words]
    groups: dict[tuple[str, str], list[int]] = {}
    for i, (w, hit) in enumerate(zip(words, first_hit)):
        if hit:
            groups.setdefault((w.sid, hit[0]), []).append(i)
    pre: dict[int, tuple[Span, str]] = {}
    exhausted: set[int] = set()
    claimed: list[Span] = []
    for (sid, _cand), idxs in groups.items():
        if len(idxs) < 2:
            continue
        spans = [o for o in first_hit[idxs[0]][1]]
        got = assign_group(verse, [words[i] for i in idxs], spans, fhl_spans.get(sid, []))
        for local, (span, rule) in got.items():
            pre[idxs[local]] = (span, rule)
            claimed.append(span)
        exhausted.update(i for local, i in enumerate(idxs) if local not in got)
    results: list[Result] = []
    for i, w in enumerate(words):
        if i in pre:
            span, rule = pre[i]
            results.append(Result(w, verse.cjk[span[0]:span[1]], rule, span))
            continue
        hit = None
        expected = expected_position(w, verse)
        for cand in w.candidates:
            occs = find_spans(verse, cand)
            if not occs or (i in exhausted and cand == first_hit[i][0]):
                continue
            hit = choose_occurrence(occs, claimed, fhl_spans.get(w.sid, []), expected)
            if hit:
                break
        if hit:
            span, rule = hit
            claimed.append(span)
            results.append(Result(w, verse.cjk[span[0]:span[1]], rule, span))
        else:
            results.append(Result(w, "", "none"))
    return results


def tally_confirmed(all_results: list[Result]) -> tuple[dict[str, Counter], dict[str, Counter]]:
    """由第一階段結果統計：字義鍵 -> 譯法次數、原文字 -> 譯法次數。"""
    by_sense: dict[str, Counter] = {}
    by_strong: dict[str, Counter] = {}
    for r in all_results:
        if r.rule not in ("unique", "fhl") or not r.rendering:
            continue
        by_sense.setdefault(r.word.sense, Counter())[r.rendering] += 1
        by_strong.setdefault(r.word.sid, Counter())[r.rendering] += 1
    return by_sense, by_strong


def align_verse_pass2(
    verse: VerseText,
    results: list[Result],
    fhl_spans: dict[str, list[Span]],
    by_sense: dict[str, Counter],
    by_strong: dict[str, Counter],
    fold_map: dict[str, str],
) -> list[Result]:
    """規則②：對仍是 none（或規則①只靠語序挑的 order）的原文字，用已確定的同字義譯法在信望愛標的範圍內找。

    order 不再直接接受；找不到就降成 none（prior='order'），之後送 AI。
    """
    claimed = [r.span for r in results if r.span and r.rule in ACCEPTED_RULES]
    out: list[Result] = []
    for r in results:
        if r.rule not in ("none", "order"):
            out.append(r)
            continue
        w = r.word
        spans = fhl_spans.get(w.sid, [])
        found: Result | None = None
        if spans:
            tiers = (("confirmed_sense", by_sense.get(w.sense)),)
            for rule, counter in tiers:
                if not counter or found:
                    continue
                total = sum(counter.values())
                for ren, cnt in counter.most_common():
                    if cnt < MIN_CONFIRMED_COUNT:
                        break
                    if len(ren) == 1 and cnt / total < MIN_SINGLE_CHAR_SHARE:
                        continue
                    occs = [o for o in find_spans(verse, fold_text(ren, fold_map))
                            if any(_inside(o, f) for f in spans) and not any(_overlap(o, c) for c in claimed)]
                    if occs:
                        span = min(occs, key=lambda o: _distance(o, expected_position(w, verse)))
                        claimed.append(span)
                        found = Result(w, verse.cjk[span[0]:span[1]], rule, span)
                        break
        out.append(found or Result(w, "", "none", prior=r.rule if r.rule == "order" else None))
    return out
