"""從讀經資料找出人名、地名裡的多音字，產生 tts_polyphone.py 的 cases.tsv。

每個多音字的每一種讀音，挑一個「只有這一種讀法」的常用字代入，組成替代寫法；
第一個替代寫法是預期讀音（pypinyin 依詞語判斷的讀音，或下面 EXPECTED 裡人工指定的）。
用法：python scripts/polyphone_cases.py <reading.json> <cases.tsv> [段落id…（不寫就是全部）]
需要 pypinyin。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pypinyin import Style, pinyin

# 人名裡多音字的預期讀音（人工指定；沒寫的用 pypinyin 依詞語判斷）
EXPECTED: dict[str, str] = {"塞": "sāi", "便": "biàn", "撒": "sā", "番": "fān", "單": "dān", "大": "dà", "什": "shí"}
# 候選代入字：讀音 → 只有這一種讀法的常用字（找不到時從經文用字自動挑）
PREFERRED = {"sāi": "腮", "sè": "色", "biàn": "變", "pián": "駢", "sā": "仨", "sǎ": "灑", "fān": "翻", "pān": "攀",
             "dān": "丹", "shàn": "善", "chán": "蟬", "dài": "代", "shí": "時", "shén": "神"}


def readings(char: str) -> list[str]:
    return list(dict.fromkeys(pinyin(char, style=Style.TONE, heteronym=True)[0]))


def main() -> None:
    reading = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    wanted = set(sys.argv[3:])
    pool: dict[str, str] = {}
    words: dict[str, str] = {}
    for segment in reading["segments"]:
        for chapter in segment["chapters"]:
            for verse in chapter["verses"]:
                for ch in verse["text"]:
                    r = readings(ch)
                    if len(r) == 1:
                        pool.setdefault(r[0], ch)
                if wanted and segment["id"] not in wanted:
                    continue
                for t in verse["t"]:
                    if t["k"] in ("p", "l"):
                        word = verse["text"][t["s"]:t["e"]]
                        words.setdefault(word, verse["text"])
    pool.update(PREFERRED)
    # 代上 1–9 第一階段已經檢查過的名字不再重做
    checked = {verse["text"][t["s"]:t["e"]] for segment in reading["segments"] if segment["id"] == "chr1-9"
               for chapter in segment["chapters"] for verse in chapter["verses"] for t in verse["t"] if t["k"] in ("p", "l")}
    words = {w: s for w, s in words.items() if w not in checked}
    rows = []
    for word, sentence in sorted(words.items()):
        phrase = [r[0] for r in pinyin(word, style=Style.TONE)]
        for i, ch in enumerate(word):
            options = readings(ch)
            if len(options) < 2:
                continue
            expected = EXPECTED.get(ch, phrase[i])
            ordered = [expected] + [r for r in options if r != expected]
            alts = []
            for r in ordered:
                sub = pool.get(r)
                if sub and sub != ch:
                    alts.append(word[:i] + sub + word[i + 1:])
            if len(alts) >= 2:
                rows.append(f"{word}\t{'|'.join(alts)}\t{sentence}")
    Path(sys.argv[2]).write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(f"{len(rows)} 個詞要檢查")


if __name__ == "__main__":
    main()
