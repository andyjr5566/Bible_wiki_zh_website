#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build verse → line range index for raw commentary files.

Sources:
  CT    ccbiblestudy_CT_<book>_<ch>.txt   title 【<CT abbr><ch cn><verse>】
  GT    ccbiblestudy_GT_<book>_<ch>.txt   title 【<CT abbr><ch cn><verse>[~end] [note]】
  KC    kingcomments_<book>_<ch>.txt      (verse N) / (verses N-M) in paragraphs
  BH    biblehub_study_<book>_<ch>.txt    line "<BH name> <ch>:<verse>"
  STEP  stepbible_<book>_<ch>.txt         line "## <STEP name> <ch>:<verse>"
"""

import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# en -> cn (和合本書名 = raw_scripture dir), ct (CT/GT title abbreviation),
# bh (BibleHub English name, regex), step (STEPBible English name)
BOOKS = {
    'genesis':      {'cn': '創世記',     'ct': '創',   'bh': 'Genesis',      'step': 'Genesis'},
    'jeremiah':     {'cn': '耶利米書',   'ct': '耶',   'bh': 'Jeremiah',     'step': 'Jeremiah'},
    'ezekiel':      {'cn': '以西結書',   'ct': '結',   'bh': 'Ezekiel',      'step': 'Ezekiel'},
    'exodus':       {'cn': '出埃及記',   'ct': '出',   'bh': 'Exodus',       'step': 'Exodus'},
    'leviticus':    {'cn': '利未記',     'ct': '利',   'bh': 'Leviticus',    'step': 'Leviticus'},
    'numbers':      {'cn': '民數記',     'ct': '民',   'bh': 'Numbers',      'step': 'Numbers'},
    'deuteronomy':  {'cn': '申命記',     'ct': '申',   'bh': 'Deuteronomy',  'step': 'Deuteronomy'},
    'joshua':       {'cn': '約書亞記',   'ct': '書',   'bh': 'Joshua',       'step': 'Joshua'},
    '2_chronicles': {'cn': '歷代志下',   'ct': '代下', 'bh': '2 Chronicles', 'step': '2 Chronicles'},
    '2_kings':      {'cn': '列王紀下',   'ct': '王下', 'bh': '2 Kings',      'step': '2 Kings'},
    '1_samuel':     {'cn': '撒母耳記上', 'ct': '撒上', 'bh': '1 Samuel',     'step': '1 Samuel'},
    'ezra':         {'cn': '以斯拉記',   'ct': '拉',   'bh': 'Ezra',         'step': 'Ezra'},
    'nehemiah':     {'cn': '尼希米記',   'ct': '尼',   'bh': 'Nehemiah',     'step': 'Nehemiah'},
    'zechariah':    {'cn': '撒迦利亞書', 'ct': '亞',   'bh': 'Zechariah',    'step': 'Zechariah'},
    'joel':         {'cn': '約珥書',     'ct': '珥',   'bh': 'Joel',         'step': 'Joel'},
    'isaiah':       {'cn': '以賽亞書',   'ct': '賽',   'bh': 'Isaiah',       'step': 'Isaiah'},
    'amos':         {'cn': '阿摩司書',   'ct': '摩',   'bh': 'Amos',         'step': 'Amos'},
    'psalms':       {'cn': '詩篇',       'ct': '詩',   'bh': 'Psalms?',      'step': 'Psalms'},
    'ruth':         {'cn': '路得記',     'ct': '得',   'bh': 'Ruth',         'step': 'Ruth'},
}

# 舊程式相容：英文 → 和合本書名
BOOK_MAP = {k: v['cn'] for k, v in BOOKS.items()}

CN_DIGITS = {'〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
             '六': 6, '七': 7, '八': 8, '九': 9}


def parse_cn_number(s: str) -> Optional[int]:
    """Parse Chinese numerals such as 三 / 十六 / 廿三 / 三十五 / 八十一."""
    if not s:
        return None
    if s.isdigit():
        return int(s)
    total, cur = 0, 0
    for ch in s:
        if ch in CN_DIGITS:
            cur = CN_DIGITS[ch]
        elif ch == '十':
            total += (cur or 1) * 10
            cur = 0
        elif ch == '廿':
            total += 20
            cur = 0
        elif ch == '卅':
            total += 30
            cur = 0
        elif ch == '百':
            total += (cur or 1) * 100
            cur = 0
        else:
            return None
    return total + cur


CN_CHAR = '〇零一二三四五六七八九十廿卅百'
VERSE_TO_END = 999  # 跨章標題：起點在本章時，範圍延伸到本章最末節（以 999 代表）


def title_regex(book_en: str) -> re.Pattern:
    """CT/GT verse-title pattern for one book.

    Matches 【<ct><ch cn><v>】, 【<ct><ch cn><v1>~<v2>】, 【<ct><ch cn><v1>~<ch cn><v2>】 (cross-chapter),
    comma-separated extra ranges 【利十六6~10，20~22】, and trailing notes 【尼八1 水門】 / 【利十六6-22「…」】.
    Groups: 1 = start chapter (cn), 2 = start verse, 3 = end chapter (cn, optional),
    4 = end verse (optional), 5 = extra comma-separated ranges (optional).
    """
    ct = re.escape(BOOKS[book_en]['ct'])
    return re.compile(
        rf'【{ct}([{CN_CHAR}]+)(\d+)'
        rf'(?:\s*[～~\-–—]\s*(?:([{CN_CHAR}]+)\s*)?(\d+))?'
        rf'((?:\s*[，,]\s*\d+(?:\s*[～~\-–—]\s*\d+)?)*)'
        rf'[^】]*】'
    )


def parse_ct_title(line: str, book_en: str, chapter: int) -> Optional[List[Tuple[int, int]]]:
    """Return verse ranges [(start, end), ...] if the line is a verse title touching this chapter.

    - same chapter:               【利十六1~2】 -> [(1, 2)]
    - with comma extras:          【利十六6~10，20~22】 -> [(6, 10), (20, 22)]
    - starts here, ends later:    【利二十三1~二十五55】 -> [(1, VERSE_TO_END)]
    - starts earlier, ends here:  【利二十二1~二十三5】 -> [(1, 5)]
    """
    m = title_regex(book_en).search(line)
    if not m:
        return None
    start_ch = parse_cn_number(m.group(1))
    start_v = int(m.group(2))
    end_ch = parse_cn_number(m.group(3)) if m.group(3) else None
    end_v = int(m.group(4)) if m.group(4) else None

    if end_ch is None or end_ch == start_ch:
        if start_ch != chapter:
            return None
        ranges = [(start_v, end_v or start_v)]
    elif start_ch == chapter:
        ranges = [(start_v, VERSE_TO_END)]
    elif end_ch == chapter:
        ranges = [(1, end_v)]
    else:
        return None

    for extra in re.finditer(r'(\d+)(?:\s*[～~\-–—]\s*(\d+))?', m.group(5) or ''):
        s = int(extra.group(1))
        ranges.append((s, int(extra.group(2)) if extra.group(2) else s))
    return ranges


def title_verses(line: str, book_en: str, chapter: int) -> Optional[List[int]]:
    """Verse numbers covered by a title line of this chapter, or None."""
    ranges = parse_ct_title(line, book_en, chapter)
    if ranges is None:
        return None
    return sorted({v for s, e in ranges for v in range(s, e + 1)})


def extract_verses_from_ct(raw_data: List[str], book_en: str, chapter: int) -> Dict[int, Tuple[int, int]]:
    """Extract verse ranges from CT file."""
    result: Dict[int, Tuple[int, int]] = {}

    blocks = []
    for line_num, line in enumerate(raw_data, 1):
        title = parse_ct_title(line, book_en, chapter)
        if title:
            blocks.append({'start': line_num, 'title': title})

    for i, block in enumerate(blocks):
        block['end'] = blocks[i + 1]['start'] - 1 if i + 1 < len(blocks) else len(raw_data)

    for block in blocks:
        for start_v, end_v in block['title']:
            for v in range(start_v, end_v + 1):
                result[v] = (block['start'], block['end'])

    return result


def extract_verses_from_bh(raw_data: List[str], book_en: str, chapter: int) -> Dict[int, int]:
    """Extract verse line numbers from BH file (line '<BH name> <ch>:<verse>')."""
    result = {}
    pattern = re.compile(rf'^{BOOKS[book_en]["bh"]}\s+(\d+):(\d+)$', re.IGNORECASE)

    for line_num, line in enumerate(raw_data, 1):
        match = pattern.match(line.strip())
        if match and int(match.group(1)) == chapter:
            result[int(match.group(2))] = line_num

    return result


def extract_verses_from_step(raw_data: List[str], book_en: str, chapter: int) -> Dict[int, int]:
    """Extract verse line numbers from STEP file (line '## <STEP name> <ch>:<verse>')."""
    result = {}
    pattern = re.compile(rf'^##\s+{BOOKS[book_en]["step"]}\s+(\d+):(\d+)$', re.IGNORECASE)

    for line_num, line in enumerate(raw_data, 1):
        match = pattern.match(line.strip())
        if match and int(match.group(1)) == chapter:
            result[int(match.group(2))] = line_num

    return result


def extract_verses_from_kc(raw_data: List[str]) -> Dict[int, List[Tuple[int, int]]]:
    """Extract KC verse references from paragraphs."""
    result: Dict[int, List[Tuple[int, int]]] = {}

    current_para = []
    para_start = None

    for line_num, line in enumerate(raw_data, 1):
        if line.strip() == '':
            if current_para and para_start is not None:
                para_end = line_num - 1
                verse_nums = extract_verses_from_kc_para('\n'.join(current_para))
                for v in verse_nums:
                    result.setdefault(v, []).append((para_start, para_end))

            current_para = []
            para_start = None
        else:
            if para_start is None:
                para_start = line_num
            current_para.append(line)

    if current_para and para_start is not None:
        para_end = len(raw_data)
        verse_nums = extract_verses_from_kc_para('\n'.join(current_para))
        for v in verse_nums:
            result.setdefault(v, []).append((para_start, para_end))

    return result


def extract_verses_from_kc_para(para: str) -> List[int]:
    """Extract verse numbers from (verse N) or (verses N-M) patterns."""
    # 支援：(verse 23)、(verses 21-23)、(verses 42,45)、(verse 20b)、(verses 35,39,47; cf. verse 25)
    # 分號之後的內容（如 cf.、交叉引用）不計入本段的節。
    result = []
    for match in re.finditer(r'\(verses?\s+([^();]+?)\s*(?=[;)])', para):
        for piece in match.group(1).split(','):
            m = re.fullmatch(r'\s*(\d+)[a-z]?(?:\s*[–—-]\s*(\d+)[a-z]?)?\s*', piece)
            if not m:
                continue
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else start
            result.extend(range(start, end + 1))

    return list(set(result))


def extract_verses_from_gt(raw_data: List[str], book_en: str, chapter: int) -> Dict[int, List[Tuple[int, int, str]]]:
    """Extract GT verse references and source markers."""
    result: Dict[int, List[Tuple[int, int, str]]] = {}

    current_para = []
    para_start = None
    last_verse_range = None

    for line_num, line in enumerate(raw_data, 1):
        if line.strip() == '':
            if current_para and para_start is not None:
                para_end = line_num - 1
                verses = extract_verses_from_gt_para(current_para, book_en, chapter)
                if not verses:
                    verses = last_verse_range

                source = extract_source_from_gt_para(current_para) or '（無標記）'

                if verses:
                    last_verse_range = verses
                    for v in verses:
                        result.setdefault(v, []).append((para_start, para_end, source))

            current_para = []
            para_start = None
        else:
            if para_start is None:
                para_start = line_num
            current_para.append(line)

            title_vs = title_verses(line, book_en, chapter)
            if title_vs:
                last_verse_range = title_vs

    if current_para and para_start is not None:
        para_end = len(raw_data)
        verses = extract_verses_from_gt_para(current_para, book_en, chapter)
        if not verses:
            verses = last_verse_range

        source = extract_source_from_gt_para(current_para) or '（無標記）'

        if verses:
            for v in verses:
                result.setdefault(v, []).append((para_start, para_end, source))

    return result


def extract_verses_from_gt_para(para_lines: List[str], book_en: str, chapter: int) -> Optional[List[int]]:
    """Extract verse numbers from GT paragraph (first matching title)."""
    for line in para_lines:
        title_vs = title_verses(line, book_en, chapter)
        if title_vs:
            return title_vs

    return None


def extract_source_from_gt_para(para_lines: List[str]) -> Optional[str]:
    """Extract source marker from GT paragraph."""
    for line in reversed(para_lines):
        dash_count = line.count('─') + line.count('―') + line.count('—')
        if dash_count >= 2:
            match = re.search(r'[─―—]{2,}\s*(.+)', line)
            if match:
                source = match.group(1).strip()
                if source:
                    return source

    return None


def get_verse_count(book_en: str, chapter: int) -> int:
    """Get verse count by reading raw scripture file (one line per verse)."""
    book_cn = BOOK_MAP.get(book_en, '')
    if not book_cn:
        return 0

    paths = [
        Path('C:\\Obsidian\\Hermes\\scripture\\raw_scripture') / book_cn / f'第{chapter}章.txt',
        Path('/c/Obsidian/Hermes/scripture/raw_scripture') / book_cn / f'第{chapter}章.txt',
    ]

    for scripture_path in paths:
        try:
            if scripture_path.exists():
                with open(scripture_path, 'r', encoding='utf-8') as f:
                    return len(f.readlines())
        except Exception:
            pass

    return 0


def build_index_for_chapter(book_en: str, chapter: int) -> None:
    """Build index for a specific chapter."""
    path_candidates = [
        Path('C:\\Obsidian\\Hermes\\scripture\\raw_data'),
        Path('/c/Obsidian/Hermes/scripture/raw_data'),
    ]
    raw_data_path = None
    for p in path_candidates:
        if p.exists():
            raw_data_path = p
            break

    if raw_data_path is None:
        print('Raw data path not found')
        return

    ct_file = raw_data_path / f'ccbiblestudy_CT_{book_en}_{chapter}.txt'
    bh_file = raw_data_path / f'biblehub_study_{book_en}_{chapter}.txt'
    step_file = raw_data_path / f'stepbible_{book_en}_{chapter}.txt'
    kc_file = raw_data_path / f'kingcomments_{book_en}_{chapter}.txt'
    gt_file = raw_data_path / f'ccbiblestudy_GT_{book_en}_{chapter}.txt'

    book_cn = BOOK_MAP[book_en]
    verse_count = get_verse_count(book_en, chapter)

    ct_verses = {}
    bh_verses = {}
    step_verses = {}
    kc_verses = {}
    gt_verses = {}
    gt_raw = []

    if ct_file.exists():
        with open(ct_file, 'r', encoding='utf-8') as f:
            ct_verses = extract_verses_from_ct(f.readlines(), book_en, chapter)

    if bh_file.exists():
        with open(bh_file, 'r', encoding='utf-8') as f:
            bh_verses = extract_verses_from_bh(f.readlines(), book_en, chapter)

    if step_file.exists():
        with open(step_file, 'r', encoding='utf-8') as f:
            step_verses = extract_verses_from_step(f.readlines(), book_en, chapter)

    if kc_file.exists():
        with open(kc_file, 'r', encoding='utf-8') as f:
            kc_verses = extract_verses_from_kc(f.readlines())

    if gt_file.exists():
        with open(gt_file, 'r', encoding='utf-8') as f:
            gt_raw = f.readlines()
        gt_verses = extract_verses_from_gt(gt_raw, book_en, chapter)

    output_lines = [
        f'# {book_cn} 第{chapter}章 索引（自動產生，勿手改）\n',
        '\n',
        '## 逐節\n',
        '| 節 | CT | BH | STEP | KC 段落 | GT 段落 |\n',
        '|---|---|---|---|---|---|\n',
    ]

    for v in range(1, verse_count + 1):
        ct_str = '—'
        if v in ct_verses:
            start, end = ct_verses[v]
            ct_str = f'{start}–{end}'

        bh_str = str(bh_verses[v]) if v in bh_verses else '—'
        step_str = str(step_verses[v]) if v in step_verses else '—'

        kc_str = '—'
        if v in kc_verses:
            kc_str = '；'.join(f'{start}–{end}' for start, end in kc_verses[v])

        gt_str = '—'
        if v in gt_verses:
            gt_str = '；'.join(f'{start}–{end}（{src}）' for start, end, src in gt_verses[v])

        output_lines.append(f'| {v} | {ct_str} | {bh_str} | {step_str} | {kc_str} | {gt_str} |\n')

    output_lines.extend([
        '\n',
        '## GT 段落總表\n',
        '| 行 | 經節範圍 | 子來源 | 開頭 20 字 |\n',
        '|---|---|---|---|\n',
    ])

    if gt_raw:
        seen = set()
        for v in sorted(gt_verses.keys()):
            for start, end, source in gt_verses[v]:
                key = (start, end)
                if key in seen:
                    continue
                seen.add(key)

                para_text = ''.join(gt_raw[start-1:end])
                para_text = para_text[:20].replace('\n', ' ')

                output_lines.append(f'| {start}–{end} | {v} | {source} | {para_text} |\n')

    output_path = Path(__file__).parent / f'{book_en}_{chapter}.md'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)

    print(f'Created {output_path.name}')


def main():
    if len(sys.argv) < 3 or len(sys.argv) % 2 == 0:
        print('Usage: python build_index.py book1 ch1 book2 ch2 ...')
        sys.exit(1)

    for i in range(1, len(sys.argv), 2):
        book_en = sys.argv[i].lower()
        try:
            chapter = int(sys.argv[i + 1])
        except ValueError:
            continue

        if book_en not in BOOKS:
            print(f'Unknown book: {book_en}')
            continue

        build_index_for_chapter(book_en, chapter)


if __name__ == '__main__':
    main()
