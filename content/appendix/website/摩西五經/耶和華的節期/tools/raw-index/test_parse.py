#!/usr/bin/env python3
# -*- coding: utf-8 -*-

def parse_chinese_number(s):
    if not s:
        return None
    s = s.strip()
    try:
        return int(s)
    except:
        pass

    CHINESE_NUMS = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '廿': 20, '卅': 30,
    }

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

# Test
tests = ['廿三', '1', '2', '44', '十二', '十', '三', '廿', '卅', '卅四']
for t in tests:
    result = parse_chinese_number(t)
    print(f"'{t}' -> {result}")
