#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional

CHINESE_NUMS = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '廿': 20, '卅': 30,
}

def parse_chinese_number(s):
    if not s:
        return None
    s = s.strip()
    try:
        return int(s)
    except:
        pass

    result = 0
    if '廿' in s:
        result = 20
        s = s.replace('廿', '')
    elif '卅' in s:
        result = 30
        s = s.replace('卅', '')

    if '十' in s:
        idx = s.index('十')
        if idx == 0:
            if result == 0:
                result = 10
            else:
                result += 10
        else:
            mult = CHINESE_NUMS.get(s[0], 0)
            result = mult * 10
        s = s[idx+1:]

    if s:
        result += CHINESE_NUMS.get(s[0], 0)

    return result if result > 0 else None

def parse_ct_title(line):
    match = re.search(r'【[^】]*?(\d+|[廿卅十一-九]+)[～~\-]?(\d+|[廿卅十一-九]+)?】', line)
    if not match:
        return None

    start_str = match.group(1)
    end_str = match.group(2)

    start = parse_chinese_number(start_str)
    if start is None:
        return None

    end = None
    if end_str:
        end = parse_chinese_number(end_str)

    return (start, end)

def extract_verses_from_ct(raw_data):
    result = {}

    # Collect all titled blocks
    blocks = []
    for line_num, line in enumerate(raw_data, 1):
        title = parse_ct_title(line)
        if title:
            blocks.append({'start': line_num, 'title': title})

    print(f"Found {len(blocks)} titled blocks")
    for i, b in enumerate(blocks[:5]):
        print(f"  Block {i}: line {b['start']}, title {b['title']}")

    # Set end line for each block
    for i, block in enumerate(blocks):
        block['end'] = blocks[i + 1]['start'] - 1 if i + 1 < len(blocks) else len(raw_data)

    # Populate result
    for block in blocks:
        start_v, end_v = block['title']
        end_v = end_v or start_v
        for v in range(start_v, end_v + 1):
            result[v] = (block['start'], block['end'])

    return result

# Read and parse
with open(r'C:\Obsidian\Hermes\scripture\raw_data\ccbiblestudy_CT_leviticus_23.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

ct_verses = extract_verses_from_ct(lines)
print(f"\nResult: {len(ct_verses)} verses")
print(f"Verses: {sorted(ct_verses.keys())}")
print(f"\nFirst few entries:")
for v in sorted(ct_verses.keys())[:5]:
    print(f"  Verse {v}: lines {ct_verses[v]}")
