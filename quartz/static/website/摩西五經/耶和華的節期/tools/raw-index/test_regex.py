#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

pattern = r'【[^】]*?(\d+|[廿卅十一-九]+)[～~\-]?(\d+|[廿卅十一-九]+)?】'

test_lines = [
    '【利廿三1】「耶和華對摩西說：」',
    '【利廿三2】「你曉諭以色列人說...」',
    '【利廿三44】「於是，摩西...」',
    '【出十二14～20】',
    '【耶和華節期的條例】',  # Should not match
]

for line in test_lines:
    match = re.search(pattern, line)
    if match:
        print(f'Line: {line[:30]:<30} | Groups: {match.groups()}')
    else:
        print(f'Line: {line[:30]:<30} | NO MATCH')
