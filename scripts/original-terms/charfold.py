"""簡繁折疊：把簡體與繁體（含和合本異體字）折成同一個字，方便比對。

折疊是「一字對一字」，所以折疊後的字串與原字串位置完全對得上。
純 Python，只需要 Unihan_Variants.txt（Unicode Unihan，見 README）。
"""
from __future__ import annotations

# Unihan 沒涵蓋或和合本特有的異體字
EXTRA_FOLDS = {"著": "着", "裡": "里", "裏": "里", "麽": "么", "麼": "么", "喫": "吃"}


def _cp(token: str) -> str | None:
    token = token.split("<", 1)[0]
    if not token.startswith("U+"):
        return None
    return chr(int(token[2:], 16))


def build_fold_map(unihan_variants_text: str) -> dict[str, str]:
    """由 Unihan_Variants.txt 內容建立「繁體字 → 簡體字」對照（取第一個與自己不同的簡體字）。"""
    fold: dict[str, str] = {}
    semantic: dict[str, list[str]] = {}
    for line in unihan_variants_text.splitlines():
        if not line or line[0] == "#":
            continue
        parts = line.split("\t")
        if len(parts) < 3 or parts[1] not in ("kSimplifiedVariant", "kSemanticVariant"):
            continue
        src = _cp(parts[0])
        if src is None:
            continue
        for tok in parts[2].split():
            dst = _cp(tok)
            if not dst or dst == src:
                continue
            if parts[1] == "kSimplifiedVariant":
                fold[src] = dst
                break
            semantic.setdefault(src, []).append(dst)
    # 沒有自己簡體字的異體字（例：淨 的異體 凈 → 净），借用語意異體字的折疊結果
    for src, dsts in semantic.items():
        if src not in fold:
            for dst in dsts:
                if dst in fold:
                    fold[src] = fold[dst]
                    break
    fold.update(EXTRA_FOLDS)
    return fold


def fold_text(text: str, fold_map: dict[str, str]) -> str:
    return "".join(fold_map.get(ch, ch) for ch in text)
