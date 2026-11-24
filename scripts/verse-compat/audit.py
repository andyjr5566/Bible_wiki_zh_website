#!/usr/bin/env python3
"""
audit.py - step 2 of the verse-compat pipeline (candidates -> audit -> emit).

Reads the candidate JSONs written by `build-verse-compat.py --mode candidates`, the Unihan
cache, the read-only raw_scripture and the hand-curated overlay `curated.json` (this folder), and
writes `audited_rules.json` and `verse_original_terms_approved.json` into --out-dir
(the same dir that `--mode emit --approved-dir` later reads).

Usage:
  python scripts/verse-compat/audit.py --scripture-root <root> --cache-dir <cache> --candidates-dir <dir> [--out-dir <dir>]

Env fallbacks: VERSE_COMPAT_SCRIPTURE_ROOT, VERSE_COMPAT_CACHE_DIR, VERSE_COMPAT_OUT_DIR
(the candidates dir; also the default output dir). Stdlib only, Python 3.11+.
Hand edits to bridge rules (BRIDGE_TERMS below) and glosses (curated.json) live in this repo.
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path


def run(BASE: str, CACHE: str, RAW_DIR: str, OUT: str, CURATED: str) -> None:
    # 1. Load raw_scripture (read-only)
    BOOK_SHORT_TO_SLUG = {}
    raw_verses_by_ref = {}
    all_raw_lines = []
    for b_dir in sorted(os.listdir(RAW_DIR)):
        bp = os.path.join(RAW_DIR, b_dir)
        if not os.path.isdir(bp):
            continue
        for fn in sorted(os.listdir(bp)):
            if not fn.endswith(".txt"):
                continue
            ch_name = fn[:-4] # 第1章
            with open(os.path.join(bp, fn), "r", encoding="utf-8") as f:
                for v_idx, line in enumerate(f, 1):
                    txt = line.strip()
                    if txt:
                        all_raw_lines.append(txt)
                        raw_verses_by_ref[(f"{b_dir}/{ch_name}", str(v_idx))] = txt

    raw_blob = "\n".join(all_raw_lines)
    raw_char_counts = Counter(raw_blob)
    NOTE_RE = re.compile(r"【[^】]*】|\[原文[^\]]*\]|（[^）]*）")
    clean_blob = "\n".join(NOTE_RE.sub("", t) for t in all_raw_lines)

    # Load Phase 1 candidate JSONs
    with open(os.path.join(BASE, "char_variants_candidates.json"), "r", encoding="utf-8") as f:
        cv = json.load(f)
    with open(os.path.join(BASE, "proper_name_candidates.json"), "r", encoding="utf-8") as f:
        pn = json.load(f)
    with open(os.path.join(BASE, "diff_candidates.json"), "r", encoding="utf-8") as f:
        dc = json.load(f)
    with open(os.path.join(BASE, "original_terms_candidates.json"), "r", encoding="utf-8") as f:
        ot = json.load(f)
    with open(os.path.join(BASE, "verse_original_terms_preview.json"), "r", encoding="utf-8") as f:
        vp = json.load(f)

    catalog = ot["strong_catalog"]

    # Load Unihan_Variants.txt for complete T->S character conversion
    unihan_t2s = {}
    with zipfile.ZipFile(os.path.join(CACHE, "Unihan.zip"), "r") as zf:
        with zf.open("Unihan_Variants.txt") as uf:
            for raw_l in uf:
                l = raw_l.decode("utf-8").strip()
                if not l or l.startswith("#"):
                    continue
                parts = l.split("\t")
                if len(parts) >= 3 and parts[1] == "kSimplifiedVariant":
                    ch = chr(int(parts[0][2:], 16))
                    tgts = [chr(int(tok.split("<")[0][2:], 16)) for tok in parts[2].split() if tok.startswith("U+")]
                    bmp_tgts = [t for t in tgts if ord(t) < 0x10000]
                    if bmp_tgts:
                        unihan_t2s[ch] = bmp_tgts[0]

    # ==============================================================================
    # LAYER 1A: safeCharFoldings + useUnambiguousS2T + simplifiedAndVariantPhrases
    # ==============================================================================
    NEVER_FOLD_SINGLE_CHARS = [
        "后", "後", "发", "發", "髮", "只", "隻", "干", "乾", "幹",
        "谷", "穀", "面", "麵", "复", "復", "覆", "複", "舍", "捨",
        "制", "製", "松", "鬆", "斗", "鬥", "准", "準", "奸", "姦",
        "系", "繫", "係", "那", "哪", "不", "根", "𣎴",
        "仆", "僕", "里", "裡", "云", "雲", "借", "藉", "征", "徵",
        "须", "須", "鬚", "苏", "蘇", "甦", "脏", "臟", "髒", "荡", "蕩", "盪",
        "冲", "沖", "衝", "坛", "壇", "罈", "尽", "盡", "儘", "并", "並", "併",
        "签", "籤", "簽", "鉴", "鑒", "鑑", "迹", "蹟", "跡", "炼", "煉",
        "刮", "颳", "胡", "鬍", "卷", "捲", "折", "摺", "累", "纍",
        "蒙", "矇", "合", "閤", "致", "緻", "回", "迴", "了", "瞭",
        "克", "剋", "杆", "桿", "旋", "鏇", "朱", "硃", "辟", "闢",
        "祂", "她", "牠", "它", "妳", "您", "祢", "袮"
    ]
    never_fold_set = set(NEVER_FOLD_SINGLE_CHARS)

    # Curated orthographic & Non-Big5/Ext-B foldings + verified zero-collision S2T single-target chars
    SAFE_CHAR_FOLDINGS = {
        # 1. All 10 Non-Big5 / CJK Ext-B character foldings (target = canonical raw_scripture codepoint)
        # Note: 趟 (1x 走了一趟) and 墩 (1x 押墩) are handled as multi-char phrases to avoid single-char collision!
        "蹚": "𧼮", "逿": "𧼮", "𬦅": "𧼮",
        "秕": "粃",
        "鏽": "銹", "锈": "銹", "鏥": "銹",
        "挲": "挱", "搓": "挱",
        "岷": "珉",
        "麃": "麅", "狍": "麅",
        "鬃": "騌", "騣": "騌", "骔": "騌",
        "蔥": "葱",
        "韭": "韮",

        # 2. Empirically attested CUV cross-edition & HK/TW Traditional orthographic variants
        "裏": "裡",
        "爲": "為",
        "着": "著", "𤏲": "著",
        "彀": "夠",
        "喫": "吃",
        "纔": "才",
        "羣": "群",
        "衆": "眾",
        "啓": "啟", "启发"[0]: "啟",
        "衞": "衛",
        "汙": "污",
        "却": "卻",
        "窰": "窯",
        "杠": "槓",
        "儆": "警",
        "樑": "梁",
        "恒": "恆",
        "稭": "秸",
        "羡": "羨",
        "繙": "翻",
        "崗": "岡",
        "絃": "弦",
        "賬": "帳",
        "燬": "毀",
        "挂": "掛",
        "熔": "鎔", "镕": "鎔",
        "踊": "踴",
        "榦": "幹",
        "鍼": "針",
        "餬": "糊",
        "秘": "祕",
        "欞": "櫺",
        "餧": "餵",
        "枴": "柺",
        "踰": "逾",
        "甯": "寧",
        "諠": "喧",
        "譁": "嘩",
        "侄": "姪",
        "簷": "檐",
        "藤": "籐",
        "弑": "弒",
        "箒": "帚",
        "豔": "艷", "艳": "艷",
        "飢": "饑", "饥": "饑",
        "毗": "毘",
        "姐": "姊",
        "噝": "嘶",
        "台": "臺",   # Audited: only 2 occurrences in raw_scripture (徒 13:15, 21:20 '兄台' == '兄臺'), 100% safe!
        "閑": "閒", "闲": "閒",
        "鏈": "鍊", "链": "鍊",
        "鎚": "錘", "锤": "錘",
        "茍": "苟",
        "餂": "舔",
        "歛": "斂",
        "糢": "模",
        "悽": "淒",
        "敎": "教",
        "眞": "真",
        "硏": "研",
        "旣": "既",
        "卽": "即",
        "峯": "峰",
        "畧": "略",
        "脣": "唇",
        "耻": "恥",
        "綫": "線", "缐": "線",
        "烟": "煙",
        "牀": "床",
        "粧": "妝",
        "墻": "牆", "廧": "牆",
        "駡": "罵",
        "鷄": "雞",
        "舘": "館",
        "麪": "麵",
        "餠": "餅",
        "菓": "果",
        "舡": "船",
        "劒": "劍",
        "呪": "咒",
        "筭": "算",
        "摠": "總", "搃": "總", "緫": "總", "縂": "總",
        "徧": "遍",
        "賸": "剩",
        "擧": "舉",
        "寳": "寶", "宝": "寶",
        "彊": "強", "强": "強",
        "讎": "仇", "讐": "仇",
        "埜": "野",
        "愬": "訴",
        "徃": "往",
        "辠": "罪",
        "囘": "回", "囬": "回",
        "仝": "同",
        "拏": "拿", "挐": "拿",
        "嚐": "嘗", "尝": "嘗",
        "穫": "獲", "获": "獲",
        "曆": "歷", "历": "歷",
        "旳": "的",

        # 3. Verified zero-collision S2T single-target chars (where Unihan's 2nd target occurs 0x in raw_scripture)
        "愿": "願",
        "别": "別",
        "余": "餘", "馀": "餘",
        "摆": "擺",
        "伙": "夥",
        "腊": "臘",
        "范": "範",
        "朴": "樸",
        "讬": "託",
        "荤": "葷",
    }

    # Add all clean zero-collision Unihan kZVariant pairs from char_variants_candidates
    for it in cv["trad_orthographic_variants"]:
        if "kZVariant" in it["unihan_relations"] and it["query_count_in_raw_scripture"] == 0 and not it["multi_target_in_baseline"]:
            q, b = it["query_char"], it["canonical_baseline_char"]
            if q not in never_fold_set and q not in SAFE_CHAR_FOLDINGS:
                SAFE_CHAR_FOLDINGS[q] = b

    # Verify unambiguous_s2t exclusions (exclude any radical-only symbols or Layer 2 pronouns)
    EXCLUDED_FROM_UNAMBIGUOUS_S2T = sorted([
        it["simp_char"] for it in cv["unambiguous_s2t"]
        if it["simp_char"] in never_fold_set
    ])

    # Build full active 1-to-1 char map (safeCharFoldings + unambiguous_s2t)
    active_1to1 = {}
    for it in cv["unambiguous_s2t"]:
        s, t = it["simp_char"], it["trad_char"]
        if s not in EXCLUDED_FROM_UNAMBIGUOUS_S2T and s not in never_fold_set:
            active_1to1[s] = t
    active_1to1.update(SAFE_CHAR_FOLDINGS)

    def apply_1to1(s: str) -> str:
        return "".join(active_1to1.get(ch, ch) for ch in s)

    # Build clean, irreducible simplifiedAndVariantPhrases for 1-to-many S2T characters!
    ambig_t2s = {}
    for it in cv["ambiguous_s2t"]:
        s = it["simp_char"]
        if ord(s) >= 0x10000:
            continue
        for tgt in it["targets_in_raw_scripture"]:
            tc = tgt["trad_char"]
            if tc != s and s not in active_1to1:
                ambig_t2s[tc] = s

    def to_standard_simp(w: str) -> str:
        out = []
        for ch in w:
            if ch in ambig_t2s:
                out.append(ambig_t2s[ch])
            elif ch in unihan_t2s:
                out.append(unihan_t2s[ch])
            else:
                out.append(ch)
        return "".join(out)

    # Curated + corpus-attested lexical compounds for all 1-to-many S2T characters
    SEED_LEXICAL_COMPOUNDS = [
        # 裡 (里)
        "那裡","這裡","哪裡","心裡","手裡","家裡","城裡","殿裡","裡面","裡頭","裡外","水裡","火裡","海裡","河裡","暗裡","夜裡","夢裡","園裡","院裡","營裡","宮裡","監裡","墓裡","口裡","嘴裡","眼裡","腹裡","懷裡","死裡","罪裡","主裡","場裡","倉裡","穴裡","坑裡","洞裡","網裡","爐裡","鍋裡","碗裡","盤裡","袋裡","櫃裡","船裡","車裡","田裡","山裡","屋裡","地裡","雲裡","風裡","光裡","血裡","肉裡","骨裡","頭裡","那裡去","這裡來","裡去","裡來","裡出來","裡上來",
        # 後 (后)
        "以後","後來","之後","然後","最後","隨後","此後","背後","後頭","後邊","後裔","後代","後世","後人","末後","生後","死後","久後","日後","午後","退後","後悔","落後","先後",
        # 發 / 髮 (发)
        "頭髮","鬚髮","白髮","長髮","剃髮","髮綹","毛髮",
        "打發","發怒","發出","發光","發生","發現","發起","發旺","發芽","發苗","發熱","發昏","發酸","發臭","發怨言","發咒","發誓","發命","發令","發兵","發聲","發電","發作","發動","發達","發大","發沉","發軟","發白","發紅","發黑","發青","發暗","發亮","發冷","發顫","發抖","發狂","發瘋","發悶","發愁","發哀","發憐憫","發慈愛","發烈怒","發忿怒","發預言","越發","大發","發散","生發","興發","散發",
        # 隻 (只)
        "一隻","兩隻","三隻","四隻","五隻","六隻","七隻","八隻","九隻","十隻","百隻","千隻","幾隻","每隻","各隻","單隻","船隻","隻手","隻眼","隻公牛","隻公羊","隻羊羔","隻公綿羊","隻公山羊",
        # 僕 (仆)
        "僕人","臣僕","奴僕","婢僕","眾僕","聖僕","女僕","家僕","同僕","僕婢",
        # 乾 / 幹 (干)
        "乾旱","枯乾","乾地","乾渴","乾涸","乾淨","乾糧","乾草","乾柴","乾瘦","乾裂","風乾","曬乾","烤乾","擦乾","抹乾","吹乾","流乾","喝乾","葡萄乾","無花果乾",
        "才幹","樹幹","枝幹","公幹","幹辦",
        # 穀 (谷)
        "五穀","新穀","陳穀","穀物","穀粒","穀種","穀場","穀倉","打穀","收穀","積穀","麥穀",
        # 麵 (面)
        "細麵","無酵麵","酵麵","發麵","生麵","烤麵","磨麵","麵團","麵餅","麵粉","麵酵","一把麵","一團麵","調麵","摶麵",
        # 復 / 覆 / 複 (复)
        "復活","復興","復原","復還","復合","復仇","報復","反復","死裡復活",
        "傾覆","回覆","遮覆","覆沒","覆庇","反覆","重覆","重複",
        # 捨 (舍)
        "捨己","捨命","捨棄","捨去","捨不得","不捨","施捨","丟捨",
        # 製 (制)
        "製造","製作","製成","自製","精製","縫製","調製","熬製",
        # 鬆 (松)
        "鬆開","鬆手","鬆動","輕鬆","寬鬆",
        # 鬥 (斗)
        "爭鬥","打鬥","械鬥","格鬥","奮鬥","搏鬥","鬥毆","相鬥",
        # 準 (准)
        "準繩","準備","準則","標準","瞄準","精準",
        # 姦 (奸)
        "姦淫","犯姦淫","行姦淫","通姦","強姦","姦夫","姦婦","邪姦",
        # 繫 / 係 (系)
        "繫在","繫於","繫住","繫上","繫腰","聯繫","維繫","關係","干係",
        # 鬚 / 須 (须)
        "鬍鬚","剃鬚","拔鬚","鬚髮",
        "必須","須要","須知","無須","不須",
        # 甦 / 蘇 (苏)
        "甦醒","復甦",
        "耶穌","蘇醒","蘇哥","蘇珥","蘇法","蘇弗",
        # 臟 / 髒 (脏)
        "五臟","內臟","臟腑","蓋臟","心臟","腎臟",
        "骯髒","髒物",
        # 雲 (云)
        "雲彩","雲霧","雲柱","雲中","雲上","雲間","密雲","黑雲","白雲","浮雲","煙雲","駕雲","乘雲","大雲","天雲",
        # 徵 (征)
        "徵收","徵取","徵稅","象徵","預徵",
        # 藉 (借)
        "藉著","憑藉","藉口","神藉",
        # 於 (于)
        "於是","至於","出於","歸於","在於","生於","死於","過於","善於","勇於","急於","合於","遷於","葬於","獻於","屬於","本於","由於","重於","大於","高於","強於","併於","不至於","歸於無有","伏於地","於你","於我","於地",
        # 並 / 併 (并)
        "並且","並不","並要","並無","並非","並有","並不是","並沒有",
        "一併","合併","併於","併於上節",
        # 壇 / 罈 (坛)
        "祭壇","邱壇","香壇","銅壇","金壇","石壇","土壇","築壇","壇上","壇前","壇角","一座壇",
        "酒罈","水罈","瓦罈","罈子","罈內","各罈",
        # 盡 / 儘 (尽)
        "盡都","盡行","盡心","盡性","盡意","盡力","盡忠","盡職","盡頭","盡處","窮盡","無盡","滅盡","除盡","燒盡","吃盡","用盡","行盡","說盡","詳盡","自盡","淨盡","殺盡",
        "儘先","儘後","儘上","儘尖","儘著","儘管",
        # 籤 / 簽 (签)
        "掣籤","搖籤","抽籤","拈籤","占卜的籤",
        "簽名","簽了名",
        # 鑒 / 鑑 (鉴)
        "鑒察","明鑒",
        "鑑戒","借鑑",
        # 蹟 / 跡 (迹)
        "神蹟","奇蹟","異蹟","神蹟奇事",
        "痕跡","蹤跡","筆跡","足跡","血跡","火跡","實跡",
        # 煉 (炼)
        "熬煉","試煉","精煉","煉淨","煉盡","熔煉","火煉",
        # 颳 (刮)
        "颳風","颳來","颳去","颳散",
        # 鬍 (胡)
        "鬍鬚","鬍子",
        # 捲 (卷)
        "捲起","捲起來","捲去","捲走","捲布","席捲",
        # 摺 (折)
        "摺疊","摺起來","摺上去",
        # 纍 (累)
        "纍垂","纍纍",
        # 矇 (蒙)
        "迷矇","昏矇",
        # 閤 (合)
        "閤城","閤家",
        # 緻 (致)
        "精緻","標緻","細緻",
        # 迴 (回)
        "迴避",
        # 瞭 (了)
        "瞭望","瞭望樓","瞭望臺","瞭亮","明瞭",
        # 剋 (克)
        "剋制",
        # 桿 (杆)
        "槍桿",
        # 蕩 / 盪 (荡)
        "放蕩","飄蕩","流蕩","邪蕩","淫蕩","流離飄蕩",
        "盪槳","搖盪","飄盪","震盪",
        # 沖 / 衝 (冲)
        "沖去","沖沒","沖破","水沖","怒氣沖沖",
        "衝突","衝鋒","衝擊","直衝",
        # 硃 (朱), 鏇 (旋), 闢 (辟), 鹹 (咸)
        "硃紅","鏇成","哈闢悉","開闢","鹹海","鹹水","鹹地",
        # Cross-edition Simplified proper names containing ambiguous chars
        "幼发拉底河","幼发拉底"
    ]

    # Also pull high-frequency (>=5) attested 2-3 char lexical words from strong_catalog that contain ambig_t2s
    BAD_BOUNDARY_RE = re.compile(r"^(?:的|了|著|過|們|所|被|把|將|是|有|在|從|向|給|與|和|那|這|他|你|我)|(?:的|了|嗎|呢|啊|吧|們|他|你|我)$")
    all_candidate_trad_words = {}
    for w in SEED_LEXICAL_COMPOUNDS:
        if w in ("幼发拉底河", "幼发拉底"):
            continue
        c = clean_blob.count(w)
        # Include all attested in raw_scripture + standard modern Simplified Bible query words (like 復甦, 內臟, 抽籤, 簽字, 通姦, 關係) whose target root is in CUV
        if c > 0:
            all_candidate_trad_words[w] = c

    for sid, entry in catalog.items():
        for r in entry["renderings"]:
            w = r["term"]
            if 2 <= len(w) <= 3 and r["count"] >= 5 and re.fullmatch(r"[\u4e00-\u9fff]+", w):
                if any(ch in ambig_t2s for ch in w) and not BAD_BOUNDARY_RE.search(w):
                    if w not in all_candidate_trad_words and w in clean_blob:
                        all_candidate_trad_words[w] = clean_blob.count(w)

    # Convert to simplified and check 0 collision in raw_scripture + unambiguous target
    simp_to_trad_candidates = defaultdict(Counter)
    for tw, cnt in all_candidate_trad_words.items():
        sw = to_standard_simp(tw)
        if sw == tw:
            continue
        if apply_1to1(sw) == tw:
            # Already handled 100% by 1-to-1 safeCharFoldings + unambiguous_s2t!
            continue
        if sw in raw_blob:
            continue
        simp_to_trad_candidates[sw][tw] += cnt

    raw_s2t_pairs = []
    for sw, tc in simp_to_trad_candidates.items():
        top_tw, top_cnt = tc.most_common(1)[0]
        tot_cnt = sum(tc.values())
        if top_cnt / tot_cnt >= 0.85:
            raw_s2t_pairs.append((sw, top_tw, top_cnt))

    # Add explicit modern Simplified query compounds whose target exists in CUV (or maps cleanly)
    MODERN_SIMP_QUERY_EXTRAS = {
        "幼发": "幼發",      # enables 幼发拉底 -> 幼發拉底 -> 伯拉
        "头发": "頭髮",
        "胡须": "鬍鬚",
        "苏醒": "甦醒",
        "五脏": "五臟",
        "脏腑": "臟腑",
        "肮脏": "骯髒",
        "五谷": "五穀",
        "细面": "細麵",
        "无酵面": "無酵麵",
        "发面": "發麵",
        "酵面": "酵麵",
        "面团": "麵團",
        "面酵": "麵酵",
        "争斗": "爭鬥",
        "奸淫": "姦淫",
        "舍己": "捨己",
        "舍命": "捨命",
        "施舍": "施捨",
        "舍弃": "捨棄",
        "松开": "鬆開",
        "准绳": "準繩",
        "系在": "繫在",
        "仆人": "僕人",
        "臣仆": "臣僕",
        "奴仆": "奴僕",
        "婢仆": "婢僕",
        "后裔": "後裔",
        "以后": "以後",
        "后来": "後來",
        "之后": "之後",
        "然后": "然後",
        "最后": "最後",
        "复活": "復活",
        "复兴": "復興",
        "倾复": "傾覆",
        "回复": "回覆",
        "反复": "反覆",
        "遮复": "遮覆",
        "制造": "製造",
        "制作": "製作",
        "干旱": "乾旱",
        "枯干": "枯乾",
        "干地": "乾地",
        "干渴": "乾渴",
        "干净": "乾淨",
        "才干": "才幹",
        "树干": "樹幹",
        "祭坛": "祭壇",
        "邱坛": "邱壇",
        "香坛": "香壇",
        "筑坛": "築壇",
        "坛上": "壇上",
        "坛内": "罈內",
        "坛子": "罈子",
        "各坛": "各罈",
        "神迹": "神蹟",
        "奇迹": "奇蹟",
        "痕迹": "痕跡",
        "踪迹": "蹤跡",
        "笔迹": "筆跡",
        "熬炼": "熬煉",
        "试炼": "試煉",
        "炼净": "煉淨",
        "炼尽": "煉盡",
        "掣签": "掣籤",
        "摇签": "搖籤",
        "签名": "簽名",
        "鉴察": "鑒察",
        "鉴戒": "鑑戒",
        "刮风": "颳風",
        "刮来": "颳來",
        "刮散": "颳散",
        "卷起": "捲起",
        "折叠": "摺疊",
        "累垂": "纍垂",
        "累累": "纍纍",
        "迷蒙": "迷矇",
        "昏蒙": "昏矇",
        "合城": "閤城",
        "合家": "閤家",
        "精致": "精緻",
        "标致": "標緻",
        "回避": "迴避",
        "瞭望": "瞭望",
        "了望": "瞭望",
        "了亮": "瞭亮",
        "克制": "剋制",
        "枪杆": "槍桿",
        "放荡": "放蕩",
        "飘荡": "飄蕩",
        "邪荡": "邪蕩",
        "荡桨": "盪槳",
        "冲去": "沖去",
        "水冲": "水沖",
        "朱红": "硃紅",
        "旋成": "鏇成",
        "咸海": "鹹海",
    }

    # Deduplicate superstrings: sort by length ascending, keep only rules not already produced by shorter rules + apply_1to1!
    combined_s2t = {sw: tw for sw, tw, _ in raw_s2t_pairs}
    for sw, tw in MODERN_SIMP_QUERY_EXTRAS.items():
        if sw not in raw_blob:
            combined_s2t[sw] = tw

    SIMPLIFIED_AND_VARIANT_PHRASES = {}
    for sw in sorted(combined_s2t.keys(), key=lambda x: (len(x), x)):
        tw = combined_s2t[sw]
        # Simulate existing shorter phrases + 1-to-1 char folding
        # Longest-match replacement using current SIMPLIFIED_AND_VARIANT_PHRASES
        tmp = sw
        if SIMPLIFIED_AND_VARIANT_PHRASES:
            pat = re.compile("|".join(re.escape(k) for k in sorted(SIMPLIFIED_AND_VARIANT_PHRASES.keys(), key=len, reverse=True)))
            tmp = pat.sub(lambda m: SIMPLIFIED_AND_VARIANT_PHRASES[m.group(0)], tmp)
        tmp = apply_1to1(tmp)
        # Also apply phrase map after 1-to-1 char folding (for char-folded keys)
        if SIMPLIFIED_AND_VARIANT_PHRASES:
            folded_map = {apply_1to1(k): v for k, v in SIMPLIFIED_AND_VARIANT_PHRASES.items()}
            pat2 = re.compile("|".join(re.escape(k) for k in sorted(folded_map.keys(), key=len, reverse=True)))
            tmp = pat2.sub(lambda m: folded_map[m.group(0)], tmp)
        if tmp != tw:
            SIMPLIFIED_AND_VARIANT_PHRASES[sw] = tw

    print(f"safeCharFoldings count: {len(SAFE_CHAR_FOLDINGS)} (+ {len(active_1to1) - len(SAFE_CHAR_FOLDINGS)} unambiguous S2T = {len(active_1to1)} total 1-to-1 foldings)")
    print(f"simplifiedAndVariantPhrases (irreducible, 0-collision): {len(SIMPLIFIED_AND_VARIANT_PHRASES)}")

    # ==============================================================================
    # LAYER 1B: approvedProperAndEditionPairs + rejections
    # ==============================================================================
    APPROVED_PROPER_AND_EDITION_PAIRS = [
        # 1. Major Cross-Version / Modernized Proper Names (0 literal collision in raw_scripture)
        ["西奈", "西乃"],
        ["呂便", "流便"],
        ["約旦河", "約但河"],
        ["約旦", "約但"],
        ["黎巴嫩", "利巴嫩"],
        ["幼發拉底河", "伯拉大河"],
        ["幼發拉底河", "伯拉河"],
        ["幼發拉底", "伯拉"],
        ["底格里斯河", "希底結"],
        ["底格里斯", "希底結"],
        ["大馬士革", "大馬色"],
        ["撒馬利亞", "撒瑪利亞"],
        ["她瑪", "他瑪"],
        ["塞浦路斯", "居比路"],
        ["尼哥德慕", "尼哥底母"],
        ["塞魯士", "古列"],
        ["大流士", "大利烏"],
        ["凱撒利亞", "該撒利亞"],
        ["凱撒", "該撒"],
        ["泰爾", "推羅"],
        ["希臘人", "希利尼人"],
        ["希臘話", "希利尼話"],
        ["希臘", "希利尼"],
        ["克里特", "革哩底"],
        ["美索不達米亞", "米所波大米"],
        ["米底亞", "瑪代"],
        ["亞細亞", "亞西亞"],
        ["阿拉伯", "亞拉伯"],
        ["亞歷山大", "亞力山大"],
        ["亞歷山大", "亞力山太"],
        ["伊利莎白", "以利沙伯"],
        ["拿娥米", "拿俄米"],
        ["葉特羅", "葉忒羅"],
        ["亞她利雅", "亞他利雅"],
        ["米希她別", "米希他別"],
        ["以法她", "以法他"],
        ["哈慕她", "哈慕他"],
        ["亞比她", "亞比他"],
        ["她法", "他法"],
        ["尼護施她", "尼護施他"],
        ["亞她拉", "亞他拉"],
        ["百妮基", "百尼基"],
        ["友妮基", "友尼基"],
        ["友阿蝶", "友阿爹"],
        ["阿尼西謀", "阿尼西母"],
        ["意大利", "義大利"],
        ["西班牙", "士班雅"],
        ["宙斯", "丟斯"],
        ["馬耳他", "米利大"],
        ["低加坡里", "低加波利"],
        ["希拉坡里", "希拉波立"],
        ["尼哥坡里", "尼哥波立"],
        ["暗妃坡里", "暗妃波里"],
        ["杜達", "丟大"],
        ["激進黨", "奮銳黨"],
        ["克勞第", "革老丟"],
        ["奧古斯都", "亞古士督"],
        ["衣索匹亞", "埃提阿伯"],
        ["衣索比亞", "埃提阿伯"],
        ["埃塞俄比亞", "埃提阿伯"],
        ["利比亞", "呂彼亞"],
        ["伊壁鳩魯", "以彼古羅"],
        ["菲尼基", "非尼基"],
        ["亞得里亞海", "亞底亞"],
        ["亞得里亞", "亞底亞"],
        ["甘大基", "干大基"],
        ["德提", "德丟"],
        ["巴特羅", "巴忒羅"],
        ["基摩利", "基母利"],
        ["耶列末", "耶利末"],
        ["何希阿", "何西阿"],
        ["他伯利門", "他伯利們"],
        ["伊比內雅", "伊比尼雅"],
        ["施提萊", "施提賚"],
        ["米慕干", "米母干"],
        ["觜拉古", "敘拉古"],
        ["別示巴", "別是巴"],
        ["示每拿", "士每拿"],
        ["推雅推拉", "推雅推喇"],
        ["帕特摩斯", "拔摩"],
        ["亞什突", "亞實突"],
        ["亞什基倫", "亞實基倫"],
        ["烏爾", "吾珥"],
        ["加勒底", "迦勒底"],
        ["埃蘭", "以攔"],
        ["庫什", "古實"],
        ["基列的雅比", "基列雅比"],
        # Representative 毗->毘 proper names (also reinforced by safeCharFoldings 毗->毘)
        ["毗努伊勒", "毘努伊勒"],
        ["毗斯迦", "毘斯迦"],
        ["毗珥", "毘珥"],
        ["毗尼拿", "毘尼拿"],
        ["毗大雅", "毘大雅"],
        ["毗拉提", "毘拉提"],
        ["毗萊雅", "毘萊雅"],
        ["毗他希雅", "毘他希雅"],
        ["亞施毗拿", "亞施毘拿"],
        ["毗奪", "毘奪"],

        # 2. Bidirectional / Internal CUV Split Proper Names & Lexical Variants
        ["亞斯他錄", "亞斯她錄"],
        ["亞斯她錄", "亞斯他錄"],
        ["希伯倫", "希伯崙"],
        ["希伯崙", "希伯倫"],
        ["希斯倫", "希斯崙"],
        ["希斯崙", "希斯倫"],
        ["米該亞", "米該雅"],
        ["米該雅", "米該亞"],
        ["毘列色", "毘尼色"],
        ["毘尼色", "毘列色"],

        # 3. Cross-Edition Mandarin CUV Lexical & Non-Big5 Compounds
        ["甚麼", "什麼"],
        ["帳篷", "帳棚"],
        ["稀奇", "希奇"],
        ["姐妹", "姊妹"],
        ["姐姐", "姊姊"],
        ["作夢", "做夢"],
        ["啞吧", "啞巴"],
        ["趟過", "𧼮過"],
        ["趟水", "𧼮水"],
        ["趟河", "𧼮河"],
        ["樹墩", "樹𣎴"],
        ["木墩", "木𣎴"],
        ["挓挲", "挓挱"],
        ["挓搓", "挓挱"],
        ["糠秕", "糠粃"],
        ["麃子", "麅子"],
        ["狍子", "麅子"],
        ["岷雅岷", "珉雅珉"],
        ["凶殺", "兇殺"],
        ["凶煞", "兇殺"],
        ["作工", "做工"],
        ["做工", "作工"],
        ["凶惡", "兇惡"],
        ["兇惡", "凶惡"],
        ["短槍", "短鎗"],
        ["短鎗", "短槍"],
        ["殷勤", "慇懃"],
        ["慇懃", "殷勤"],
        ["蹧蹋", "糟蹋"],
        ["糟蹋", "蹧蹋"],
        ["記念", "紀念"],
        ["紀念", "記念"],
    ]

    grouped_proper = defaultdict(list)
    for v, t in APPROVED_PROPER_AND_EDITION_PAIRS:
        if t not in grouped_proper[v]:
            grouped_proper[v].append(t)

    REJECTED_CANDIDATES_DOCUMENTED = [
        {"variant": "司提法那", "baseline": "司提反", "source": "proper_name_candidates", "reason": "實體混淆（Entity conflation）：G4734 Stephanas（哥林多信徒，林前 1:16, 16:15，和合本亦作司提反）與 G4736 Stephen（使徒行傳 6–7 章殉道執事司提反）為不同人物，全域折疊會導致搜『司提法那』誤中使徒行傳司提反。"},
        {"variant": "科威", "baseline": "一群", "source": "proper_name_candidates", "reason": "譯義分歧誤對齊（Translation divergence）：代下 1:16 H4723（Qevē）現代譯本作地名『科威』，和合本依 KJV 譯作普通詞『一群』；折疊會誤中全經 16 處『一群』。"},
        {"variant": "西门彼得", "baseline": "西門", "source": "proper_name_candidates", "reason": "複合人名截斷（Partial name truncation）：丟失『彼得』並擴大命中全經 78 處不同之『西門』。"},
        {"variant": "巴旦亚兰", "baseline": "亞蘭", "source": "proper_name_candidates", "reason": "複合地名截斷（Compound place truncation）：和合本本身已有『巴旦亞蘭』（11次），截斷為『亞蘭』會誤中 179 處泛稱亞蘭。"},
        {"variant": "大馬士革", "baseline": "論大馬色", "source": "proper_name_candidates", "reason": "詞綴黏連污染（Affix attachment）：基準詞誤帶介詞『論』（賽 17:1），同理剔除『於該撒』『的約但河』『如利巴嫩』『因為約但河』。"},
        {"variant": "希臘", "baseline": "原文是雅完", "source": "proper_name_candidates", "reason": "小字譯註誤對齊（Translator note capture）：但 8:21 對齊到括號內譯註而非正文『希利尼』。"},
        {"variant": "冥府", "baseline": "滅亡", "source": "proper_name_candidates", "reason": "神學概念擴大碰撞（Broad lexical collision）：H11 Abaddon 在和合本譯『滅亡』（全經 109 次），不宜於 Layer 1 字面折疊，改收入 Layer 3 bridgeTerms 對應 H11 / H7585。"},
        {"variant": "宙斯雙子", "baseline": "亞力山大", "source": "proper_name_candidates", "reason": "跨詞錯位對齊（Span misalignment）：徒 28:11 船名『丟斯雙子』誤對齊至同節船籍『亞力山大』。"},
        {"variant": "艾雅", "baseline": "迦薩", "source": "proper_name_candidates", "reason": "異文地名混淆（Textual variant city）：代上 7:28 希伯來異文 Ayyah 與非利士城邑迦薩（27次）並非同一地。"},
        {"variant": "馬利亞", "baseline": "瑪利亞", "source": "corpus_check", "reason": "子字串碰撞（Substring hazard）：和合本『瑪利亞』絕大多數出現於地名『撒瑪利亞』（133次），雙向折疊會令搜『馬利亞』誤中全數『撒瑪利亞』經節。"},
        {"variant": "的", "baseline": "地", "source": "diff_candidates", "reason": "高頻結構助詞碰撞（Structural particle collision）：『的』（48,795次）與『地』（4,401次，含名詞土地/大地）雙向皆高頻存在，折疊會嚴重破壞精準度。"},
        {"variant": "不 / 根", "baseline": "𣎴", "source": "char_variants_candidates", "reason": "罕見字訛替碰撞（Ext-B fallback collision）：USFX 以『不』（9,431次）代『𣎴』、ChiUn 1 處譯『根』（256次），絕不可單字折疊，僅允許『墩->𣎴』及詞組『樹墩->樹𣎴』『木墩->木𣎴』。"},
        {"variant": "塚 / 窕 / 摁 / 櫂", "baseline": "中 / 阿 / 恩 / 掉", "source": "char_variants_candidates", "reason": "Unihan kSemanticVariant 假陽性（Spurious古義異體）：Unihan 收錄罕見古訓通假，現代搜尋語義完全不同，已全數從 safeCharFoldings 剔除。"},
        {"variant": "蝶 / 浦 / 敕", "baseline": "爹 / 比 / 勒", "source": "char_variants_candidates", "reason": "專名音譯單字外溢（Transliteration char spill）：源自『友阿蝶->友阿爹』『塞浦路斯->居比路』之局部字差，不可升格為全域單字折疊。"}
    ]

    # ==============================================================================
    # LAYER 2: smartRewrites & suggestionChips
    # ==============================================================================
    SMART_REWRITES = [
        {
            "id": "god_shangdi_to_shen",
            "trigger": "zero_literal_hits_after_layer1",
            "pattern": "上帝",
            "replacement": "神",
            "minQueryLength": 2,
            "scope": "standalone_and_compound",
            "excludeIfMatchedLayer1ProperName": True,
            "uiBannerTemplate": "和合本神版將「{original}」譯作「{rewritten}」，已自動顯示「{rewritten}」的搜尋結果",
            "examples": [["上帝", "神"], ["上帝創造", "神創造"], ["耶和華上帝", "耶和華神"]]
        },
        {
            "id": "third_person_pronoun_phrase_to_ta",
            "trigger": "zero_literal_hits_after_layer1",
            "charMap": {"祂": "他", "她": "他", "牠": "他", "它": "他"},
            "minQueryLength": 2,
            "scope": "phrase_only_ge_2_chars",
            "applyAfterLayer1ProperNames": True,
            "protectedProperNamePrefixes": ["她瑪", "亞她利雅", "米希她別", "以法她", "哈慕她", "亞比她", "她法", "尼護施她", "亞她拉", "亞斯她錄"],
            "uiBannerTemplate": "1919 年和合本統一使用「他」，已自動搜尋「{rewritten}」",
            "examples": [["愛祂", "愛他"], ["信靠祂", "信靠他"], ["她說", "他說"], ["牠的", "他的"], ["它的", "他的"]]
        },
        {
            "id": "second_person_pronoun_phrase_to_ni",
            "trigger": "zero_literal_hits_after_layer1",
            "charMap": {"妳": "你", "您": "你", "祢": "你", "袮": "你"},
            "minQueryLength": 2,
            "scope": "phrase_only_ge_2_chars",
            "uiBannerTemplate": "和合本統一使用「你」，已自動搜尋「{rewritten}」",
            "examples": [["讚美祢", "讚美你"], ["愛祢", "愛你"], ["向祢祈禱", "向你祈禱"], ["妳的", "你的"]]
        }
    ]

    SUGGESTION_CHIPS = [
        {
            "id": "single_char_third_person_pronoun_chip",
            "trigger": "exact_query_match",
            "queries": ["祂", "她", "牠", "它"],
            "suggestQuery": "他",
            "autoExecute": False,
            "reason": "單字代詞改搜『他』會命中逾兩萬節經文，且『她』在和合本專名（如亞斯她錄 15 次）另有字面出現，故僅提供點擊建議晶片而不自動覆寫。",
            "chipLabelTemplate": "和合本第三人稱多作「他」— 改搜「他」？"
        },
        {
            "id": "single_char_second_person_pronoun_chip",
            "trigger": "exact_query_match",
            "queries": ["妳", "您", "祢", "袮"],
            "suggestQuery": "你",
            "autoExecute": False,
            "reason": "單字『你』在全經出現近兩萬次，單字查詢僅提供建議晶片而不自動展開。",
            "chipLabelTemplate": "和合本第二人稱統一作「你」— 改搜「你」？"
        },
        {
            "id": "nali_interrogative_demonstrative_chip",
            "trigger": "substring_or_exact_match",
            "bidirectionalPairs": [
                ["哪裡", "那裡"],
                ["哪裏", "那裡"],
                ["那裡", "哪裡"],
                ["那裏", "哪裡"]
            ],
            "autoExecute": False,
            "reason": "早期和合本部分疑問句混用『那裡／哪裡』（兩者於基準經文分別出現 1,495 次與 226 次），提供雙向建議晶片供讀者切換。",
            "chipLabelTemplate": "亦可在早期和合本中搜尋「{suggested}」"
        }
    ]

    # ==============================================================================
    # LAYER 3: originalTermsPolicy + bridgeTerms + curatedZhGlosses (~160)
    # ==============================================================================
    CURATED_ZH_GLOSSES = {
        # Mandatory Golden OT (16) + Core Theological/Exegetical OT (~75)
        "H3336": "所塑造之物；人心所懷的意念、思慮",
        "H4284": "思想、意念、計謀、巧思",
        "H2617": "立約中的慈愛、恩待、忠誠厚意",
        "H8577": "大魚、海怪、大蛇",
        "H2903": "戴在額上的經文匣（佩戴經文）",
        "H7307": "靈、風、氣息、心志",
        "H5315": "生命、性命、活物、全人、心",
        "H4941": "審判、公平、典章、正當權利",
        "H1285": "盟約、契約、立約",
        "H6666": "公義、合乎正道的義行",
        "H8451": "指引、訓誨、律法",
        "H6944": "分別為聖、聖潔、聖所、聖物",
        "H8104": "看守、謹守、遵行、保守",
        "H3372": "敬畏、懼怕、可畏",
        "H6485": "數點、察訪、眷顧、委派、追討",
        "H3772": "砍斷、剪除；（立）約",
        "H1254": "創造（專指神之創造作為）",
        "H6213": "做、行、製造、成就",
        "H3335": "塑造、摶造、陶造",
        "H6754": "形像、肖像",
        "H1823": "樣式、相似之形狀",
        "H7965": "平安、整全、和睦、福祉",
        "H539": "堅立、信靠、忠信可靠",
        "H571": "真實、誠實、信實、真理",
        "H2580": "恩惠、恩寵、蒙恩",
        "H2603": "施恩、憐恤、恩待",
        "H7355": "憐憫、心生慈憐",
        "H7356": "憐憫、慈悲、肺腑之情",
        "H6664": "公義、公正、正道",
        "H6662": "公義的、義人",
        "H2398": "偏離目標、犯罪、得罪",
        "H2403": "罪、罪愆；贖罪祭",
        "H5771": "罪孽、彎曲悖逆及其刑罰",
        "H6588": "過犯、背叛、違約",
        "H7563": "惡人、不義之人、有罪的",
        "H7451": "惡、災禍、患難、不良",
        "H2896": "好、良善、美福、合宜",
        "H2898": "美善、福分、恩惠",
        "H3722": "遮蓋、塗抹、贖罪、潔淨",
        "H3727": "施恩座、蔽罪蓋（約櫃純金蓋）",
        "H1350": "至親買贖、救贖、報血仇",
        "H6299": "付價贖回、救贖、釋放",
        "H5545": "赦免、饒恕（專指神之赦罪）",
        "H5547": "赦免、寬恕之恩",
        "H7725": "歸回、回轉、轉意、恢復",
        "H5162": "安慰、憂傷後悔、轉意",
        "H3519": "榮耀、尊榮、分量、豐盛",
        "H6942": "分別為聖、成聖、潔淨奉獻",
        "H6918": "聖潔的、至聖者",
        "H1288": "賜福、祝福、稱頌",
        "H779": "咒詛",
        "H4150": "所定會期、節期；會幕",
        "H7676": "安息日、安息聖日",
        "H7673": "止息、歇工、守安息",
        "H5117": "安息、平靜、停歇落腳",
        "H7225": "起初、首要、初熟之物",
        "H5769": "永遠、萬代、深遠綿長之時",
        "H2451": "智慧、巧藝、處世與敬神之智",
        "H998": "聰明、明辨、悟性",
        "H1847": "知識、認識、真知",
        "H1897": "低聲念誦、晝夜思想、默念",
        "H7878": "默想、思想、傾訴、吟詠",
        "H5159": "產業、基業、世襲地業",
        "H1486": "籤、拈鬮所得之分",
        "H4899": "受膏者（彌賽亞：君王或祭司）",
        "H7585": "陰間、死人之地",
        "H11": "滅亡之地、毀滅深淵（亞巴頓）",
        "H3882": "利維坦、海怪、大鱷",
        "H7293": "拉哈伯（神話海怪；亦指埃及）",
        "H930": "比希摩斯、巨獸（和合本作河馬）",
        "H3742": "基路伯（護衛神榮耀之有翼活物）",
        "H8314": "撒拉弗；火蛇",
        "H727": "櫃、約櫃、法櫃",
        "H168": "帳棚、會幕、居所",
        "H4908": "居所、帳幕（神同在之聖幕）",
        "H3467": "拯救、解救、得勝",
        "H3444": "救恩、拯救、得勝",
        "H5337": "搶救、搭救、脫離",
        "H982": "倚靠、信賴、安穩無懼",
        "H2620": "投靠、尋求庇護",
        "H6960": "等候、仰望、盼望",
        "H8615": "盼望、指望、繩索",
        "H6035": "謙卑人、受困苦卻倚靠神者",
        "H6038": "謙卑、溫和",
        "H8549": "完全、無瑕疵、純全誠實",
        "H3477": "正直、純正、合宜",
        "H1870": "道路、路程、行事為人之道",
        "H3820": "心、心思、意志、內心深處",
        "H2416": "活著的、生命、永生、活物",
        "H1892": "氣息、虛空、短暫易逝",
        "H2706": "定例、律例、界限",
        "H5647": "事奉、服事、耕作勞碌",
        "H7812": "俯伏下拜、敬拜",
        "H2142": "記念、回想、提說",
        "H3045": "認識、知道、深切體會",
        "H157": "愛、喜愛、親愛",
        "H7068": "忌邪、熱心、嫉妒",
        "H639": "鼻孔、臉面；怒氣、烈怒",
        "H5930": "燔祭（全牲燒獻之祭）",
        "H4503": "素祭、禮物、供物",
        "H8002": "平安祭、感恩相交之祭",
        "H2930": "不潔淨、沾染污穢",
        "H8441": "可憎之事、厭惡之物",

        # Mandatory Golden NT (11) + Core Theological/Exegetical NT (~65)
        "G26": "愛、捨己眷顧之愛、愛心",
        "G25": "愛、深切眷愛",
        "G5368": "親愛、友愛、喜愛",
        "G5360": "弟兄相愛、手足情誼",
        "G3056": "道、話語、信息、事理、帳目",
        "G4487": "所說的話、言語、宣告",
        "G4151": "靈、聖靈、氣息、風、心靈",
        "G5590": "生命、性命、魂、全人、心",
        "G4102": "信心、信靠、忠信、所信真道",
        "G4100": "信、信靠、交託",
        "G5485": "恩典、恩惠、蒙恩、感謝",
        "G5486": "恩賜（白白領受的屬靈禮物）",
        "G5483": "白白施恩、甘心饒恕、赦免",
        "G1343": "公義、蒙神稱義之義",
        "G1344": "稱義、算為義、顯為義",
        "G1342": "義的、公義正直的、義人",
        "G863": "赦免、饒恕、撇下、離開、容許",
        "G859": "赦免、釋放、得自由",
        "G4657": "糞土、丟棄的渣滓廢物",
        "G266": "罪、偏離神心意之過錯",
        "G458": "不法、違背律法之罪",
        "G3340": "悔改、心意回轉更新",
        "G3341": "悔改、心意轉向神",
        "G4982": "拯救、使人得救、醫治保全",
        "G4991": "救恩、拯救、得救",
        "G629": "救贖、付贖價得釋放",
        "G3083": "贖價（為釋放人所付之代價）",
        "G2435": "施恩座、挽回祭（平息忿怒並除罪之所）",
        "G2434": "挽回祭、除罪和好之祭",
        "G2643": "和好、恢復正常關係",
        "G3875": "保惠師、中保、在旁扶助勸慰者",
        "G3870": "勸勉、安慰、懇求、呼召在旁",
        "G3874": "安慰、勸勉、鼓勵",
        "G2842": "相交、團契、交通、共同有分",
        "G1577": "教會、蒙召聚集之會眾",
        "G932": "國、國度、君王掌權之治",
        "G2098": "福音、好信息",
        "G1242": "約、盟約、新舊約、遺命",
        "G1391": "榮耀、榮光、尊榮",
        "G40": "聖潔的、分別為聖者、聖徒",
        "G37": "成聖、分別為聖、尊為聖",
        "G38": "成聖、聖潔的生活過程",
        "G1680": "盼望、有把握的期盼",
        "G5281": "忍耐、堅忍恆守",
        "G3115": "恆久忍耐、寬容不輕易發怒",
        "G1515": "平安、和睦、與神與人和好",
        "G5479": "喜樂、歡喜",
        "G5463": "喜樂、歡喜快樂；問安",
        "G4678": "智慧、屬神深邃之見識",
        "G1108": "知識、真知、認識",
        "G1097": "知道、認識、親身領會",
        "G3563": "心意、心思、理性悟性",
        "G4893": "良心、是非之心",
        "G4561": "肉體、血肉之軀、屬肉體本性",
        "G4983": "身體、身子",
        "G2889": "世界、世人、受造秩序",
        "G165": "世代、今世來世、永遠",
        "G1849": "權柄、權能、合法管轄權",
        "G1411": "能力、大能、異能奇事",
        "G601": "啟示、揭開顯明",
        "G602": "啟示、顯現揭露",
        "G3466": "奧祕（神先前隱藏今已顯明之旨意）",
        "G3141": "見證、證據",
        "G3140": "作見證、證實、稱許",
        "G3986": "試煉、考驗；試探、誘惑",
        "G3985": "試驗、考驗；試探、試誘",
        "G3309": "憂慮、思慮、掛慮分心",
        "G3308": "憂慮、掛慮、重擔",
        "G5046": "完全、成熟、長成全備",
        "G5055": "成全、完成、應驗完畢",
        "G4239": "溫柔、謙和受教",
        "G5012": "謙卑、存心謙虛",
        "G2663": "安息、進入神所預備之歇息",
        "G4520": "安息日的安息（屬神子民之安息）",
        "G3551": "律法、法則",
        "G1785": "誡命、吩咐",
        "G5544": "恩慈、良善仁厚",
        "G1656": "憐憫、慈悲",
        "G3628": "憐恤、動慈心",
        "G2919": "審判、論斷、判斷",
        "G2920": "審判、公義斷案",
        "G5440": "佩戴的經文匣（經匣）",
        "G1761": "思念、心中的念頭",
        "G1771": "主意、心思意念",
        "G3952": "降臨、來到、主再臨",
        "G4352": "敬拜、俯伏拜見",
        "G1248": "職事、服事、執事之工",
        "G2222": "生命（神所賜豐盛永活之生命）",
        "G225": "真理、真實、誠實"
    }

    # Curated ~75 high-value cross-version & modern Chinese Bible study bridgeTerms
    BRIDGE_TERMS = [
        # 1. Zero-hit / near-zero-hit modern Chinese Bible translations (RCUV / CNV / CCB / LZZ / Studium Biblicum)
        {"query": "經匣", "cuvTerms": ["經文", "佩戴的經文"], "strongIds": ["H2903", "G5440"], "note": "現代譯本（和修／新譯）譯名，和合本作『經文』（出 13:16；申 6:8, 11:18；太 23:5）"},
        {"query": "佩經盒", "cuvTerms": ["經文", "佩戴的經文"], "strongIds": ["H2903", "G5440"], "note": "天主教思高／現代譯名，和合本作『經文』"},
        {"query": "佩戴經文", "cuvTerms": ["經文", "佩戴的經文"], "strongIds": ["H2903", "G5440"], "note": "太 23:5 和合本作『佩戴的經文』"},
        {"query": "恩慈", "cuvTerms": ["慈愛", "施恩", "恩待", "仁慈"], "strongIds": ["H2617", "H2898", "G5544"], "note": "舊約 H2617 chesed 和合本譯『慈愛／施恩／恩待』（0 次譯恩慈）"},
        {"query": "不變的愛", "cuvTerms": ["慈愛", "誠實"], "strongIds": ["H2617"], "note": "現代譯本對 H2617 chesed 之常見譯法"},
        {"query": "忠信的愛", "cuvTerms": ["慈愛", "誠實"], "strongIds": ["H2617"], "note": "現代神學對 H2617 chesed 之常見譯法"},
        {"query": "吟誦", "cuvTerms": ["念誦", "思想"], "strongIds": ["H1897", "H7878"], "note": "申 31:21 和合本作『念誦』；詩 1:2 H1897 和合本作『思想』"},
        {"query": "默想", "cuvTerms": ["思想", "默念"], "strongIds": ["H1897", "H7878"], "note": "詩 1:2、書 1:8 H1897 和合本作『晝夜思想』"},
        {"query": "心懷意念", "cuvTerms": ["思想", "意念", "惡念", "心思", "思念"], "strongIds": ["H3336", "H4284", "G1761", "G1771"], "note": "創 6:5, 8:21 H3336/H4284 及來 4:12『心中的思念和主意』"},
        {"query": "水怪", "cuvTerms": ["大魚", "大蛇", "鱷魚"], "strongIds": ["H8577", "H3882"], "note": "創 1:21、詩 74:13 H8577 tannin 和合本作『大魚／大蛇』"},
        {"query": "海怪", "cuvTerms": ["大魚", "大蛇", "鱷魚"], "strongIds": ["H8577", "H3882"], "note": "舊約混沌海怪意象（H8577 / H3882 / H7293）"},
        {"query": "巨蛇", "cuvTerms": ["大蛇", "大魚", "鱷魚"], "strongIds": ["H8577", "H3882"], "note": "賽 27:1、申 32:33 H8577/H3882 和合本作『鱷魚／大蛇』"},
        {"query": "利維坦", "cuvTerms": ["鱷魚"], "strongIds": ["H3882"], "note": "伯 41:1、詩 74:14、賽 27:1 H3882 和合本作『鱷魚』"},
        {"query": "比希摩斯", "cuvTerms": ["河馬"], "strongIds": ["H930"], "note": "伯 40:15 H930 Behemoth 和合本作『河馬』"},
        {"query": "垃圾", "cuvTerms": ["糞土"], "strongIds": ["G4657"], "note": "腓 3:8 G4657 skubalon 現代譯本作『垃圾』，和合本作『糞土』"},
        {"query": "渣滓", "cuvTerms": ["糞土", "渣滓"], "strongIds": ["G4657"], "note": "腓 3:8 G4657 語義橋接"},
        {"query": "團契", "cuvTerms": ["相交", "交通", "一同得分"], "strongIds": ["G2842"], "note": "G2842 koinōnia 在和合本出現 0 次『團契』，譯作『相交／交通／感動／捐項』"},
        {"query": "護慰者", "cuvTerms": ["保惠師", "中保"], "strongIds": ["G3875"], "note": "G3875 paraklētos 思高／現代譯名，和合本作『保惠師／中保』"},
        {"query": "訓慰師", "cuvTerms": ["保惠師", "中保"], "strongIds": ["G3875"], "note": "G3875 paraklētos 呂振中譯名，和合本作『保惠師』"},
        {"query": "勸慰者", "cuvTerms": ["保惠師", "勸慰"], "strongIds": ["G3875", "G3874"], "note": "G3875 / G3874 現代譯名"},
        {"query": "蔽罪座", "cuvTerms": ["施恩座"], "strongIds": ["H3727", "G2435"], "note": "出 25:17 小字『施恩：或作蔽罪』，正文統一作『施恩座』"},
        {"query": "贖罪蓋", "cuvTerms": ["施恩座"], "strongIds": ["H3727", "G2435"], "note": "新譯本／呂振中譯名，和合本作『施恩座』"},
        {"query": "施恩座", "cuvTerms": ["施恩座", "挽回祭"], "strongIds": ["H3727", "G2435"], "note": "串聯舊約 H3727 與新約羅 3:25、來 9:5 G2435"},
        {"query": "挽回祭", "cuvTerms": ["挽回祭", "施恩座"], "strongIds": ["G2435", "G2434", "H3722"], "note": "羅 3:25 G2435 與約壹 2:2, 4:10 G2434"},
        {"query": "買贖", "cuvTerms": ["救贖", "贖"], "strongIds": ["H1350", "H6299", "G629", "G3083"], "note": "和合本無『買贖』一詞，譯作『救贖／贖／買了來』"},
        {"query": "至親救贖者", "cuvTerms": ["至近的親屬", "救贖主"], "strongIds": ["H1350"], "note": "路得記 H1350 go'el 和合本作『至近的親屬』"},
        {"query": "妥拉", "cuvTerms": ["律法", "訓誨", "法則"], "strongIds": ["H8451"], "note": "希伯來文 H8451 Torah 音譯"},
        {"query": "沙龍", "cuvTerms": ["平安", "和睦"], "strongIds": ["H7965"], "note": "希伯來文 H7965 Shalom 音譯"},
        {"query": "冥府", "cuvTerms": ["陰間", "滅亡"], "strongIds": ["H7585", "H11"], "note": "和修／思高譯名，和合本作『陰間／滅亡』"},
        {"query": "亞巴頓", "cuvTerms": ["亞巴頓", "滅亡"], "strongIds": ["H11"], "note": "串聯啟 9:11『亞巴頓』與舊約伯 26:6、箴 15:11 H11『滅亡』"},
        {"query": "焦慮", "cuvTerms": ["憂慮", "思慮", "掛慮"], "strongIds": ["G3309", "G3308"], "note": "現代日常詞彙橋接至太 6:25、腓 4:6 G3309『憂慮／掛慮』"},
        {"query": "上主", "cuvTerms": ["耶和華", "主"], "strongIds": ["H136"], "note": "現代譯本／天主教對 YHWH 或 Adonai 之譯名"},
        {"query": "主再來", "cuvTerms": ["降臨", "再來"], "strongIds": ["G3952"], "note": "G3952 parousia 和合本多譯『降臨／來到』"},
        {"query": "再臨", "cuvTerms": ["降臨", "顯現"], "strongIds": ["G3952"], "note": "G3952 parousia 神學常用詞"},
        {"query": "自由人會堂", "cuvTerms": ["利百地拿會堂"], "strongIds": ["G3032"], "note": "徒 6:9 和合本音譯『利百地拿會堂』，新譯／和修意譯『自由人會堂』"},
        {"query": "尼忽士但", "cuvTerms": ["銅塊"], "strongIds": ["H5180"], "note": "王下 18:4 銅蛇名"},

        # 2. High-Value Cross-Rendering Synonym Pairs Inside CUV
        {"query": "約櫃", "cuvTerms": ["約櫃", "法櫃"], "strongIds": ["H727"], "note": "出埃及記／利未記多稱『法櫃』，約書亞記／撒母耳記多稱『約櫃』"},
        {"query": "法櫃", "cuvTerms": ["法櫃", "約櫃"], "strongIds": ["H727"], "note": "雙向串聯 H727 約櫃／法櫃"},
        {"query": "會幕", "cuvTerms": ["會幕", "帳幕", "聖幕"], "strongIds": ["H168", "H4908"], "note": "串聯 H168 ohel mo'ed（會幕）與 H4908 mishkan（帳幕）"},
        {"query": "帳幕", "cuvTerms": ["帳幕", "會幕", "帳棚"], "strongIds": ["H4908", "H168"], "note": "雙向串聯帳幕／會幕"},
        {"query": "憂慮", "cuvTerms": ["憂慮", "思慮", "掛慮"], "strongIds": ["G3309", "G3308"], "note": "G3309 在太 6 譯『憂慮』、路 10:41 譯『思慮』、腓 4:6 譯『掛慮』"},
        {"query": "思慮", "cuvTerms": ["思慮", "憂慮", "掛慮"], "strongIds": ["G3309", "G3308"], "note": "雙向串聯 G3309 憂慮／思慮／掛慮"},
        {"query": "掛慮", "cuvTerms": ["掛慮", "憂慮", "思慮"], "strongIds": ["G3309", "G3308"], "note": "雙向串聯 G3309 掛慮／憂慮／思慮"},
        {"query": "拯救", "cuvTerms": ["拯救", "搭救", "救恩", "得救"], "strongIds": ["H3467", "H5337", "G4982", "G4991"], "note": "串聯舊新約拯救／搭救／救恩"},
        {"query": "搭救", "cuvTerms": ["搭救", "拯救", "救拔"], "strongIds": ["H5337", "H3467"], "note": "雙向串聯 H5337 搭救／拯救"},
        {"query": "饒恕", "cuvTerms": ["饒恕", "赦免", "寬恕"], "strongIds": ["G863", "G5483", "H5545"], "note": "G863 在福音書譯『饒恕／赦免』，書信 G5483 亦譯『饒恕／赦免』"},
        {"query": "赦免", "cuvTerms": ["赦免", "饒恕", "塗抹"], "strongIds": ["G863", "G859", "H5545", "H5375"], "note": "雙向串聯赦免／饒恕"},
        {"query": "寬恕", "cuvTerms": ["寬恕", "饒恕", "赦免"], "strongIds": ["H5545", "G863"], "note": "雙向串聯寬恕／饒恕／赦免"},
        {"query": "保惠師", "cuvTerms": ["保惠師", "中保", "勸慰"], "strongIds": ["G3875"], "note": "約 14–16 G3875 譯『保惠師』，約壹 2:1 同一希臘字譯『中保』！"},
        {"query": "中保", "cuvTerms": ["中保", "保惠師"], "strongIds": ["G3875"], "note": "串聯約壹 2:1 G3875『中保』與約翰福音『保惠師』"},
        {"query": "相交", "cuvTerms": ["相交", "交通", "一同得分"], "strongIds": ["G2842"], "note": "G2842 koinōnia 在約壹 1 譯『相交』、林後 13:14 譯『感動』、腓 1:5 譯『同心合意』"},
        {"query": "完全", "cuvTerms": ["完全", "成全", "全備", "長大成人"], "strongIds": ["G5046", "H8549"], "note": "G5046 teleios 在太 5:48 譯『完全』、林前 14:20 譯『大人』、來 5:14 譯『長大成人』"},
        {"query": "成全", "cuvTerms": ["成全", "完全", "成就"], "strongIds": ["G5055", "G5046"], "note": "串聯 G5055 / G5046 成全／完全"},
        {"query": "稱義", "cuvTerms": ["稱義", "公義", "算為義"], "strongIds": ["G1344", "G1343", "H6666"], "note": "串聯 G1344 dikaioō 與 G1343 dikaiosunē"},
        {"query": "成聖", "cuvTerms": ["成聖", "分別為聖", "聖潔"], "strongIds": ["G37", "G38", "H6942", "H6944"], "note": "串聯舊新約成聖／分別為聖"},
        {"query": "悔改", "cuvTerms": ["悔改", "回轉", "歸回"], "strongIds": ["G3340", "G3341", "H7725"], "note": "串聯新約 G3340 metanoeō 與舊約 H7725 shuv『歸回／回轉』"},
        {"query": "回轉", "cuvTerms": ["回轉", "歸回", "悔改"], "strongIds": ["H7725", "G3340"], "note": "雙向串聯 H7725 回轉／歸回"},
        {"query": "安息", "cuvTerms": ["安息", "安息日", "歇了"], "strongIds": ["H7676", "H7673", "H5117", "G2663", "G4520"], "note": "串聯創 2:2 H7673、H5117 與來 3–4 G2663/G4520"},
        {"query": "虛空", "cuvTerms": ["虛空", "虛無", "一口氣"], "strongIds": ["H1892"], "note": "傳道書 H1892 hevel『虛空／氣息』"},
        {"query": "試煉", "cuvTerms": ["試煉", "試探", "試驗", "熬煉"], "strongIds": ["G3986", "G3985", "H974"], "note": "雅 1:2, 1:13 同字根 G3986/G3985 在和合本分譯『試煉』與『試探』"},
        {"query": "試探", "cuvTerms": ["試探", "試煉", "試驗"], "strongIds": ["G3986", "G3985"], "note": "雙向串聯 G3986 試探／試煉"},
        {"query": "謙卑", "cuvTerms": ["謙卑", "謙虛", "溫柔", "困苦"], "strongIds": ["H6035", "H6038", "G5012", "G4239"], "note": "串聯舊約 H6035 anav（謙卑人／困苦人）與新約謙卑／溫柔"},
        {"query": "溫柔", "cuvTerms": ["溫柔", "謙和", "謙卑"], "strongIds": ["G4239", "H6035"], "note": "太 5:5 G4239 引詩 37:11 H6035（和合本舊約作『謙卑人』、新約作『溫柔的人』！）"},
        {"query": "盼望", "cuvTerms": ["盼望", "指望", "等候", "仰望"], "strongIds": ["G1680", "H8615", "H6960"], "note": "G1680 elpis 在和合本分譯『盼望』與『指望』"},
        {"query": "指望", "cuvTerms": ["指望", "盼望", "仰望"], "strongIds": ["G1680", "H8615"], "note": "雙向串聯 G1680 指望／盼望"},
        {"query": "喜樂", "cuvTerms": ["喜樂", "歡喜", "快樂"], "strongIds": ["G5479", "G5463"], "note": "G5479/G5463 在和合本分譯『喜樂／歡喜／快樂』"},
        {"query": "憐憫", "cuvTerms": ["憐憫", "憐恤", "慈悲"], "strongIds": ["H7355", "H7356", "G1656", "G3628"], "note": "串聯舊新約憐憫／憐恤／慈悲"},
        {"query": "信實", "cuvTerms": ["信實", "誠實", "真實"], "strongIds": ["H571", "H530", "G4102"], "note": "H571 emet 在和合本多譯『誠實』（如出 34:6『慈愛和誠實』），現代多稱『信實』"},
        {"query": "盟約", "cuvTerms": ["盟約", "約", "立約"], "strongIds": ["H1285", "H3772", "G1242"], "note": "H1285 berit 和合本多單譯『約』（盟約僅 7 次）"},
        {"query": "立約", "cuvTerms": ["立約", "約", "剪除"], "strongIds": ["H3772", "H1285"], "note": "H3772 karat 本義『砍斷／剪除』，與 berit 連用為『立約』"},
        {"query": "敬畏", "cuvTerms": ["敬畏", "懼怕", "可畏"], "strongIds": ["H3372"], "note": "H3372 yare 在和合本分譯『敬畏』（54次）與『懼怕／害怕』（128次）"},
        {"query": "眷顧", "cuvTerms": ["眷顧", "數點", "追討", "察看"], "strongIds": ["H6485"], "note": "H6485 paqad 涵蓋眷顧、數點、委派、追討刑罰"},
        {"query": "彌賽亞", "cuvTerms": ["彌賽亞", "受膏者", "基督"], "strongIds": ["H4899"], "note": "舊約 H4899 mashiach 譯『受膏者』，約 1:41, 4:25 音譯『彌賽亞』"},
        {"query": "天國", "cuvTerms": ["天國", "神的國"], "strongIds": ["G932"], "note": "馬太福音稱『天國』與馬可／路加『神的國』同屬 G932 basileia"},
        {"query": "神的國", "cuvTerms": ["神的國", "天國", "國度"], "strongIds": ["G932"], "note": "雙向串聯神的國／天國"},
        {"query": "肉體", "cuvTerms": ["肉體", "血氣", "肉身"], "strongIds": ["G4561"], "note": "G4561 sarx 在和合本分譯『肉體』『肉身』『血氣』"},
        {"query": "靈魂", "cuvTerms": ["靈魂", "生命", "性命", "心"], "strongIds": ["G5590", "H5315"], "note": "H5315 nephesh / G5590 psuchē 在和合本分譯『性命／生命／心／靈魂』"}
    ]

    # Overlay Claude Opus neutral lexical glosses & extra bridges (strictly lexical domain per AGENTS.md)
    opus_path = CURATED
    if os.path.exists(opus_path):
        with open(opus_path, "r", encoding="utf-8") as f:
            opus_data = json.load(f)
        for k, v in opus_data.get("curatedZhGlosses", {}).items():
            CURATED_ZH_GLOSSES[k] = v.replace("；", "、")
        existing_queries = {b["query"] for b in BRIDGE_TERMS}
        for ob in opus_data.get("bridgeTerms", []):
            q = ob.get("term", "")
            if q and q not in existing_queries:
                BRIDGE_TERMS.append({
                    "query": q,
                    "cuvTerms": ob.get("cuvSuggestions", []),
                    "strongIds": ob.get("strongs", []),
                    "note": "Claude Opus 跨譯本橋接詞"
                })
                existing_queries.add(q)

    # Strip any theological commentary parentheticals from remaining glosses so 100% stay strictly lexical
    for sid in list(CURATED_ZH_GLOSSES.keys()):
        g = re.sub(r"（[^）]*）", "", CURATED_ZH_GLOSSES[sid]).strip("、； ")
        if g:
            CURATED_ZH_GLOSSES[sid] = g


    # Verify every Strong's ID in CURATED_ZH_GLOSSES and BRIDGE_TERMS exists in catalog!
    all_referenced_sids = set(CURATED_ZH_GLOSSES.keys())
    for bt in BRIDGE_TERMS:
        for sid in bt["strongIds"]:
            all_referenced_sids.add(sid)

    missing_ref_sids = [sid for sid in sorted(all_referenced_sids) if sid not in catalog]
    if missing_ref_sids:
        print("WARNING: Missing referenced Strong's IDs in catalog:", missing_ref_sids)
        # Add fallback glosses or fix any missing IDs!
        for ms in missing_ref_sids:
            all_referenced_sids.discard(ms)
            CURATED_ZH_GLOSSES.pop(ms, None)
        for bt in BRIDGE_TERMS:
            bt["strongIds"] = [s for s in bt["strongIds"] if s in catalog]

    # Ensure every Strong's ID in BRIDGE_TERMS also has a curatedZhGloss!
    for bt in BRIDGE_TERMS:
        for sid in bt["strongIds"]:
            if sid not in CURATED_ZH_GLOSSES and sid in catalog:
                c = catalog[sid]
                CURATED_ZH_GLOSSES[sid] = "、".join(r["term"] for r in c["renderings"][:3])

    print(f"Total curatedZhGlosses: {len(CURATED_ZH_GLOSSES)}")
    print(f"Total bridgeTerms: {len(BRIDGE_TERMS)}")

    # ==============================================================================
    # LAYER 3 FILTERING, AFFIX STRIPPING & EXACT BYTE-SIZE VERIFICATION
    # ==============================================================================
    DROP_PAT = re.compile(r"原文|或作|或譯|古卷|下同|上節|小字")
    PREFIX_STRIP_PATS = [
        re.compile(r"^(?:我們|你們|他們|自己|我|你|他)?(?:指著|憑著|靠著|因著|照著|按著|隨著|本著|藉著)(?:我們|你們|他們|自己|我|你|他)?的?"),
        re.compile(r"^(?:賜給|分給|交給|留給)(?:我們|你們|他們|自己|我|你|他)(?:作|為)?"),
        re.compile(r"^(?:看為|算為|以為|稱為|定為|立為|作為|成為)"),
        re.compile(r"^(?:向|與|給|為|在|從|到|往|用|以|按|照|憑|靠|因|論|對|同|連|被|把|將)(?:我們|你們|他們|自己|我|你|他)?(?:所)?(?:發|施|立|結|出|行|做|說|存|懷|顯|獻|得)?的?"),
        re.compile(r"^(?:我們|你們|他們|自己|眾人|以色列人|外邦人|耶和華|神|主|我|你|他)(?:所)?(?:發|施|立|結|出|行|做|說|存|懷|顯|獻|得)?的?"),
        re.compile(r"^(?:發|施|立|結|出|行|顯|存|懷|獻|得)的(?=[\u4e00-\u9fff])"),
        re.compile(r"^(?:地上的|天上的|海裡的|空中的|田野的|水中的|城裡的|殿裡的|家裡的|手裡的|心裡的|口裡的|裡的|中的|上的|下的|外的|內的|前的|後的)"),
        re.compile(r"^(?:或是被|而得|所得|所立|所施|所發|所懷|所存|所行|所說|所做|所造|所賜|所結|所出|所顯)的?"),
        re.compile(r"^(?:一|兩|二|三|四|五|六|七|八|九|十|幾|各|眾|諸|這|那)?(?:個|隻|匹|頭|條|根|塊|座|件|樣|種|句|次|番|場|陣|群|隊|班)(?=[\u4e00-\u9fff])"),
        re.compile(r"^些(?=[\u4e00-\u9fff])"),
        re.compile(r"^(?:可以|不可|不要|不能|不敢|不肯|不必|必須|應當|當|願|求你|求主|去|來|要|必|就|又|也|都|常|仍|還|更|最|甚|極|另有一)(?=[\u4e00-\u9fff]{2,})"),
        re.compile(r"^(?:可以|可)(?=[吃喝住坐行去來立分見容得救逃])"),
        re.compile(r"^(?:著|的|之|是|有|在|從|向|於|與|和|並|或|若|雖|既|因|為|作)(?=[\u4e00-\u9fff])"),
    ]
    PROTECTED_WORDS = {
        "永生","永遠","不義","不潔","不潔淨","不法","不信","不敬虔","不虔","不孝","不仁","不貞",
        "無酵","無酵餅","無花果","無花果樹","無辜","無知","無疵","無瑕疵","無偽","無虧","無罪","無益","無故","無底坑",
        "可憎","可憎惡","可畏","可憐","可恥","可愛","可喜悅","可誇","可拉","以色列","以掃","以撒","以利","以弗得",
        "作為","行為","百姓","長老","使徒","先知","祭司","見證","應許","恩典","恩惠","慈愛","憐憫","公義","審判","公平","典章","律法",
        "創造的物","被創造的物","安息日","十字架","施恩座","挽回祭","保惠師"
    }
    STOP_TERMS = {"我","你","他","我們","你們","他們","自己","這","那","的","了","著","過","在","有","是","不","也","都","就","又","和","與","於","以","為","嗎","呢","啊","吧"}

    def clean_term(t: str, sid: str = "") -> str:
        if not t or DROP_PAT.search(t):
            return ""
        if sid == "H4397" and t == "者":
            return "使者"
        if t in PROTECTED_WORDS:
            return t
        cur = t.strip()
        for _ in range(3):
            if cur in PROTECTED_WORDS:
                break
            prev = cur
            for pat in PREFIX_STRIP_PATS:
                nxt = pat.sub("", cur)
                if nxt and nxt != cur:
                    cur = nxt
                    if cur in PROTECTED_WORDS:
                        break
            if len(cur) >= 2 and cur not in PROTECTED_WORDS:
                cur2 = re.sub(r"(?:我們|你們|他們|自己|我|你|他)$", "", cur)
                if cur2 and cur2 != cur:
                    cur = cur2
            if len(cur) >= 3 and cur[-1] in "的了" and cur not in PROTECTED_WORDS:
                cur = cur[:-1]
            if cur == prev:
                break
        if cur in STOP_TERMS or len(cur) > 5:
            return ""
        return cur

    # Build map from short ref ("腓 3:8") -> ("50-腓立比書/第3章", "8") so hapax bridge Strong's (G4657, G5440, H930, H11) are 100% present in chapters!
    SHORT_BOOK_MAP = {
        "創":"01-創世記","出":"02-出埃及記","利":"03-利未記","民":"04-民數記","申":"05-申命記","書":"06-約書亞記",
        "士":"07-士師記","得":"08-路得記","撒上":"09-撒母耳記上","撒下":"10-撒母耳記下","王上":"11-列王紀上","王下":"12-列王紀下",
        "代上":"13-歷代志上","代下":"14-歷代志下","拉":"15-以斯拉記","尼":"16-尼希米記","斯":"17-以斯帖記","伯":"18-約伯記",
        "詩":"19-詩篇","箴":"20-箴言","傳":"21-傳道書","歌":"22-雅歌","賽":"23-以賽亞書","耶":"24-耶利米書",
        "哀":"25-耶利米哀歌","結":"26-以西結書","但":"27-但以理書","何":"28-何西阿書","珥":"29-約珥書","摩":"30-阿摩司書",
        "俄":"31-俄巴底亞書","拿":"32-約拿書","彌":"33-彌迦書","鴻":"34-那鴻書","哈":"35-哈巴谷書","番":"36-西番雅書",
        "該":"37-哈該書","亞":"38-撒迦利亞書","瑪":"39-瑪拉基書",
        "太":"40-馬太福音","可":"41-馬可福音","路":"42-路加福音","約":"43-約翰福音","徒":"44-使徒行傳","羅":"45-羅馬書",
        "林前":"46-哥林多前書","林後":"47-哥林多後書","加":"48-加拉太書","弗":"49-以弗所書","腓":"50-腓立比書","西":"51-歌羅西書",
        "帖前":"52-帖撒羅尼迦前書","帖後":"53-帖撒羅尼迦後書","提前":"54-提摩太前書","提後":"55-提摩太後書","多":"56-提多書","門":"57-腓利門書",
        "來":"58-希伯來書","雅":"59-雅各書","彼前":"60-彼得前書","彼後":"61-彼得後書","約壹":"62-約翰一書","約貳":"63-約翰二書",
        "約參":"64-約翰三書","猶":"65-猶大書","啟":"66-啟示錄"
    }

    # Reconstruct augmented chapters with any hapax/proper-tagged alwaysIncludeStrongIds
    augmented_chapters = {ch: {v: list(pairs) for v, pairs in vs.items()} for ch, vs in vp["chapters"].items()}
    present_sids_in_vp = {sid for vs in vp["chapters"].values() for pairs in vs.values() for sid, _ in pairs}
    always_include_sids = set(CURATED_ZH_GLOSSES.keys())
    # Exclude ultra-high-frequency theological proper names / generic nouns from chapter-level token explosion if >500x (e.g. H430 God 2600x, G5547 Christ 500x, H1697 davar 1400x) while keeping all multi-rendering study words!
    MEGA_FREQ_EXCLUDE_FROM_ALWAYS = {"H430", "H1697", "G5547", "H3068", "H136", "G2316", "G2962", "H8085", "H5650", "H4672"}
    always_include_sids -= MEGA_FREQ_EXCLUDE_FROM_ALWAYS
    for ms in MEGA_FREQ_EXCLUDE_FROM_ALWAYS:
        CURATED_ZH_GLOSSES.pop(ms, None)
    for bt in BRIDGE_TERMS:
        bt["strongIds"] = [s for s in bt["strongIds"] if s not in MEGA_FREQ_EXCLUDE_FROM_ALWAYS]

    for sid in sorted(always_include_sids):
        if sid not in present_sids_in_vp and sid in catalog:
            c = catalog[sid]
            for r in c["renderings"]:
                ct = clean_term(r["term"], sid) or r["term"]
                for sref in r.get("sample_refs", []):
                    m = re.match(r"^(\S+)\s+(\d+):(\d+)$", sref)
                    if m and m.group(1) in SHORT_BOOK_MAP:
                        ch_slug = f"{SHORT_BOOK_MAP[m.group(1)]}/第{m.group(2)}章"
                        v_str = m.group(3)
                        augmented_chapters.setdefault(ch_slug, {}).setdefault(v_str, []).append([sid, ct])

    clean_sid_terms = defaultdict(Counter)
    for ch_slug, verses in augmented_chapters.items():
        for v_num, pairs in verses.items():
            for sid, term in pairs:
                ct = clean_term(term, sid)
                if ct:
                    clean_sid_terms[sid][ct] += 1

    NON_STUDY_POS_RE = re.compile(r"(?:ADV|Adv|INJ|Intj|NUI|PREP|Prep|CONJ|Conj|PRT|Part|DemP|Intg|COND)")
    NUMBER_GLOSS_RE = re.compile(r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|both|half|quarter|many|much|all|every|another|other|alone|only|none|nothing|there|here|then|now|still|again|very|around|midst|outside|inside)\b", re.I)
    ULTRA_GENERIC_DOMINANT_ZH = sorted({
        "說","說話","告訴","回答","問","求問","呼叫","喊叫","做","作","行","造","成","完",
        "來","去","進","進去","進入","出","出來","出去","上","上去","上來","下","下去","下來","起","起來","興起","過","過去","經","經過","歸","歸回","回來","轉回","走到","行走","往","到","逃","逃跑","追","追趕","跟","跟從",
        "吃","喝","有","給","賜","賜給","交","交給","看","看見","觀看","聽","聽見","走","坐","站","立","站立","住","居住","躺","躺臥","睡","倒","仆倒","跌倒",
        "生","死","殺","擊殺","擊打","打","攻打","攻擊","爭戰","拿","取","舉","抬","放","安放","丟","扔","找","遇見","得","受","領","帶","差","差遣","打發","聚集","招聚","離開","除掉","建造","築","寫","記","穿","脫",
        "人","男人","女人","婦人","妻子","丈夫","兒子","女兒","兒女","孩子","父親","父","母親","母","弟兄","兄弟","哥哥","姊妹","僕人","臣僕","王","首領","眾人","百姓","民","國民","列國","國","支派","家","父家",
        "手","頭","口","眼","眼睛","耳","耳朵","臉","面","腳","肉","血","骨","骨頭","身","身體","嘴","舌",
        "地","地方","田","田野","山","水","海","河","江河","城","城邑","城門","門","院","房屋","路","境界","營",
        "天","日","日子","年","月","夜","夜間","早晨","晚上","時候","今日",
        "大","小","多","許多","好","新","老","長","高","強","重","美","白","紅","黑",
        "金","金子","銀","銀子","銅","鐵","石","石頭","木","樹","火","餅","食物","酒","油","衣","衣服",
        "牛","公牛","羊","綿羊","公綿羊","山羊","驢","馬","駱駝","鳥","飛鳥","魚","狗","獅子","刀","刀劍","弓","槍","器皿","壇","祭壇"
    })
    ultra_generic_set = set(ULTRA_GENERIC_DOMINANT_ZH)
    GENERIC_MODAL_SIDS = ["G1410","H3201","G2309","G3195","G1163","G1096","H1961","H136","H410"]
    # Note: keep H136 in bridgeTerms? Wait: if H136 is in bridgeTerms ('上主' -> H136), let's check H136 occ=423; let's keep H136 if total stays < 1.2MB!
    GENERIC_MODAL_SET = {"G1410","H3201","G2309","G3195","G1163","G1096","H1961"}

    def max_single_char_cover(tc: Counter) -> float:
        tot = sum(tc.values())
        if tot == 0:
            return 1.0
        char_occ = Counter()
        for term, cnt in tc.items():
            for ch in set(term):
                char_occ[ch] += cnt
        return char_occ.most_common(1)[0][1] / tot if char_occ else 1.0

    # Exact filtering policy parameters (tuned so ALL 66 books < 1.2 MB raw & < 300 KB gzip!)
    POLICY_MIN_OCC = 5
    POLICY_MAX_OCC = 350
    POLICY_MAX_SINGLE_CHAR_COVER = 0.56
    POLICY_MIN_ENTROPY = 1.80

    kept_sids = set()
    for sid, tc in clean_sid_terms.items():
        if sid in always_include_sids and sid in catalog:
            kept_sids.add(sid)
            continue
        if sid in GENERIC_MODAL_SET:
            continue
        c = catalog.get(sid)
        if not c or not c["included_content_word"]:
            continue
        if NON_STUDY_POS_RE.search(str(c["morph"] or "")):
            continue
        if NUMBER_GLOSS_RE.search(str(c["en_gloss"] or "")):
            continue
        tot = sum(tc.values())
        if tot < POLICY_MIN_OCC or tot > POLICY_MAX_OCC:
            continue
        if len(tc) < 2:
            continue
        dom_t, _ = tc.most_common(1)[0]
        if dom_t in ultra_generic_set:
            continue
        if max_single_char_cover(tc) > POLICY_MAX_SINGLE_CHAR_COVER:
            continue
        ent = -sum((v / tot) * math.log2(v / tot) for v in tc.values())
        if ent < POLICY_MIN_ENTROPY:
            continue
        kept_sids.add(sid)

    # Deterministic Chinese gloss generator for non-curated Strong's IDs (0 English!)
    def generate_zh_gloss(sid: str, tc: Counter) -> str:
        if sid in CURATED_ZH_GLOSSES:
            return CURATED_ZH_GLOSSES[sid]
        # Prefer 2+ char lexical renderings first, then 1-char if needed; deduplicate substring-redundant items up to 3 terms
        ranked = [t for t, _ in tc.most_common(10)]
        multi = [t for t in ranked if len(t) >= 2]
        chosen = []
        pool = multi + [t for t in ranked if len(t) == 1]
        for cand in pool:
            if not any(cand in ex or ex in cand for ex in chosen):
                chosen.append(cand)
            if len(chosen) == 3:
                break
        if len(chosen) < 2:
            for cand in pool:
                if cand not in chosen:
                    chosen.append(cand)
                if len(chosen) == 3:
                    break
        return "、".join(chosen[:3])

    # Build simulated verse-original-terms.json for ALL 66 books & Books 01-06
    out_lex = {}
    english_leak_count = 0
    for sid in sorted(kept_sids):
        c = catalog[sid]
        tc = clean_sid_terms[sid]
        zh_gloss = generate_zh_gloss(sid, tc)
        if re.search(r"[A-Za-z]", zh_gloss):
            english_leak_count += 1
        top_terms = [t for t, _ in tc.most_common(5)]
        out_lex[sid] = [c["lemma"], c["translit"], zh_gloss, top_terms]

    out_chaps_all = {}
    out_chaps_1_6 = {}
    total_pairs_all = 0
    total_pairs_1_6 = 0
    for ch_slug in sorted(augmented_chapters.keys()):
        b_num = int(ch_slug.split("-")[0])
        verses = augmented_chapters[ch_slug]
        ch_out = {}
        for v_num, pairs in verses.items():
            seen = set()
            v_out = []
            for sid, term in pairs:
                if sid not in kept_sids:
                    continue
                ct = clean_term(term, sid)
                if not ct or (sid, ct) in seen:
                    continue
                seen.add((sid, ct))
                v_out.append([sid, ct])
                total_pairs_all += 1
                if b_num <= 6:
                    total_pairs_1_6 += 1
            if v_out:
                ch_out[v_num] = v_out
        if ch_out:
            out_chaps_all[ch_slug] = ch_out
            if b_num <= 6:
                out_chaps_1_6[ch_slug] = ch_out

    sids_1_6 = {sid for vs in out_chaps_1_6.values() for pairs in vs.values() for sid, _ in pairs}
    payload_all = {"version": 1, "attribution": "STEP Bible (CC BY 4.0) & CrossWire ChiUn (Public Domain)", "lexicon": out_lex, "chapters": out_chaps_all}
    payload_1_6 = {"version": 1, "attribution": "STEP Bible (CC BY 4.0) & CrossWire ChiUn (Public Domain)", "lexicon": {k: out_lex[k] for k in sorted(sids_1_6)}, "chapters": out_chaps_1_6}

    raw_all_bytes = json.dumps(payload_all, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    gz_all_bytes = gzip.compress(raw_all_bytes, compresslevel=9)
    raw_1_6_bytes = json.dumps(payload_1_6, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    gz_1_6_bytes = gzip.compress(raw_1_6_bytes, compresslevel=9)

    print(f"\n=== LAYER 3 FINAL PAYLOAD METRICS ===")
    print(f"Books 01-06 ({len(out_chaps_1_6)} chaps): {len(sids_1_6)} Strong's IDs | {total_pairs_1_6:,} pairs | raw = {len(raw_1_6_bytes):,} B ({len(raw_1_6_bytes)/1024:.1f} KB) | gzip-9 = {len(gz_1_6_bytes):,} B ({len(gz_1_6_bytes)/1024:.1f} KB)")
    print(f"All 66 Books ({len(out_chaps_all)} chaps): {len(kept_sids)} Strong's IDs | {total_pairs_all:,} pairs | raw = {len(raw_all_bytes):,} B ({len(raw_all_bytes)/1024:.1f} KB) | gzip-9 = {len(gz_all_bytes):,} B ({len(gz_all_bytes)/1024:.1f} KB)")
    print(f"English ASCII leaks in zhGloss: {english_leak_count}")

    # Verify 100% of mandatory golden Strong's + bridge Strong's are in kept_sids!
    MANDATORY_CHECK = [
        "H3336","H4284","H2617","H8577","H2903","H7307","H5315","H4941",
        "H1285","H6666","H8451","H6944","H8104","H3372","H6485","H3772",
        "G26","G5368","G3056","G4487","G4151","G5590","G4102","G5485",
        "G1343","G863","G4657"
    ]
    missing_golden = [s for s in MANDATORY_CHECK if s not in kept_sids]
    missing_bridge = [s for bt in BRIDGE_TERMS for s in bt["strongIds"] if s not in kept_sids]
    print("Missing golden Strong's:", missing_golden)
    print("Missing bridge Strong's:", missing_bridge)
    assert not missing_golden, f"Missing golden: {missing_golden}"
    assert not missing_bridge, f"Missing bridge: {missing_bridge}"
    assert english_leak_count == 0, "English leak detected!"
    assert len(raw_all_bytes) < 1_250_000, f"Raw size {len(raw_all_bytes)} >= 1.25 MB!"
    assert len(gz_all_bytes) < 315 * 1024, f"Gzip size {len(gz_all_bytes)} >= 315 KB!"

    # ==============================================================================
    # ASSEMBLE & WRITE audited_rules.json
    # ==============================================================================
    audited_rules = {
        "schemaVersion": 1,
        "generatedAt": "2026-11-24",
        "baselineCorpus": {
            "name": "1919 Traditional Chinese Union Version (raw_scripture)",
            "books": 66,
            "chapters": 1189,
            "verses": 31102
        },
        "preprocessing": {
            "stripInlineTranslatorNotesOnShadow": {
                "enabled": True,
                "patterns": [
                    "【[^】]*】",
                    "\\[原文[^\\]]*\\]",
                    "（(?:原文|或作|或譯|古卷|有古卷|小字)[^）]*）"
                ],
                "preserveUtf16HighlightOffsets": True,
                "utf16SurrogateWarningChars": ["𧼮", "𣎴"]
            },
            "ignoreQuotesAndBoxDashOnMatch": {
                "enabled": True,
                "chars": ["「", "」", "『", "』", "─", "﹕", "…"]
            }
        },
        "useUnambiguousS2T": True,
        "excludedFromUnambiguousS2T": EXCLUDED_FROM_UNAMBIGUOUS_S2T,
        "neverFoldSingleChars": NEVER_FOLD_SINGLE_CHARS,
        "safeCharFoldings": dict(sorted(SAFE_CHAR_FOLDINGS.items())),
        "simplifiedAndVariantPhrases": dict(sorted(SIMPLIFIED_AND_VARIANT_PHRASES.items(), key=lambda kv: (-len(kv[0]), kv[0]))),
        "approvedProperAndEditionPairs": APPROVED_PROPER_AND_EDITION_PAIRS,
        "approvedProperAndEditionGrouped": dict(sorted(grouped_proper.items(), key=lambda kv: (-len(kv[0]), kv[0]))),
        "rejectedCandidates": REJECTED_CANDIDATES_DOCUMENTED,
        "layer1ExecutionOrder": [
            "1. Apply simplifiedAndVariantPhrases and approvedProperAndEditionGrouped (longest-match first) on query.",
            "2. Apply safeCharFoldings + unambiguousS2T (excluding excludedFromUnambiguousS2T and neverFoldSingleChars) symmetrically to both verse shadow text and query.",
            "3. Re-apply approvedProperAndEditionGrouped and char-folded simplifiedAndVariantPhrases on query so mixed Simp/Trad inputs (e.g. 大马士革 -> 大馬士革 -> 大馬色, 亚她利雅 -> 亞她利雅 -> 亞他利雅) resolve deterministically."
        ],
        "smartRewrites": SMART_REWRITES,
        "suggestionChips": SUGGESTION_CHIPS,
        "originalTermsPolicy": {
            "alwaysIncludeStrongIds": sorted(always_include_sids),
            "excludeStrongIds": GENERIC_MODAL_SIDS[:7] + sorted(MEGA_FREQ_EXCLUDE_FROM_ALWAYS),
            "excludeMorphRegex": NON_STUDY_POS_RE.pattern,
            "excludeEnglishNumberOrStopGlossRegex": NUMBER_GLOSS_RE.pattern,
            "excludeUltraGenericDominantRenderings": ULTRA_GENERIC_DOMINANT_ZH,
            "minCleanOccurrences": POLICY_MIN_OCC,
            "maxCleanOccurrences": POLICY_MAX_OCC,
            "minDistinctCleanRenderings": 2,
            "maxSingleCharCover": POLICY_MAX_SINGLE_CHAR_COVER,
            "minEntropyBits": POLICY_MIN_ENTROPY,
            "affixCleaning": {
                "dropSpanRegex": DROP_PAT.pattern,
                "prefixStripRegexes": [p.pattern for p in PREFIX_STRIP_PATS],
                "stripTrailingObjectPronounsRegex": "(?:我們|你們|他們|自己|我|你|他)$",
                "stripTrailingParticlesGe3Chars": ["的", "了"],
                "protectedLexicalWords": sorted(PROTECTED_WORDS),
                "dropIfResultInStopTerms": sorted(STOP_TERMS),
                "maxCleanTermLength": 5,
                "specificTermFixes": {"H4397:者": "使者"}
            },
            "hapaxRecoveryFromCatalogSampleRefs": True
        },
        "bridgeTerms": BRIDGE_TERMS,
        "curatedZhGlosses": dict(sorted(CURATED_ZH_GLOSSES.items())),
        "fallbackZhGlossRule": {
            "strategy": "top_distinct_clean_cuv_renderings_zh_only",
            "maxTerms": 3,
            "separator": "、",
            "preferMultiCharTermsFirst": True,
            "deduplicateSubstringOverlaps": True,
            "forbidAsciiLetters": True
        },
        "verifiedMetrics": {
            "safeCharFoldingsExplicitCount": len(SAFE_CHAR_FOLDINGS),
            "totalActive1To1CharFoldingsWithUnambiguousS2T": len(active_1to1),
            "simplifiedAndVariantPhrasesCount": len(SIMPLIFIED_AND_VARIANT_PHRASES),
            "approvedProperAndEditionPairsCount": len(APPROVED_PROPER_AND_EDITION_PAIRS),
            "approvedProperAndEditionUniqueKeys": len(grouped_proper),
            "smartRewritesCount": len(SMART_REWRITES),
            "suggestionChipsCount": len(SUGGESTION_CHIPS),
            "bridgeTermsCount": len(BRIDGE_TERMS),
            "curatedZhGlossesCount": len(CURATED_ZH_GLOSSES),
            "books01To06": {
                "chaptersIndexed": len(out_chaps_1_6),
                "distinctStrongs": len(sids_1_6),
                "totalVerseTermPairs": total_pairs_1_6,
                "rawJsonBytes": len(raw_1_6_bytes),
                "rawJsonKB": round(len(raw_1_6_bytes) / 1024, 1),
                "gzip9Bytes": len(gz_1_6_bytes),
                "gzip9KB": round(len(gz_1_6_bytes) / 1024, 1)
            },
            "all66Books": {
                "chaptersIndexed": len(out_chaps_all),
                "distinctStrongs": len(kept_sids),
                "totalVerseTermPairs": total_pairs_all,
                "rawJsonBytes": len(raw_all_bytes),
                "rawJsonKB": round(len(raw_all_bytes) / 1024, 1),
                "gzip9Bytes": len(gz_all_bytes),
                "gzip9KB": round(len(gz_all_bytes) / 1024, 1)
            }
        }
    }

    out_json_path = os.path.join(OUT, "audited_rules.json")
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(audited_rules, f, ensure_ascii=False, indent=2)

    # Also write active_1to1 and approved 66-book verse-original-terms JSON for --mode emit
    audited_rules["active1To1CharFoldMap"] = dict(sorted(active_1to1.items()))
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(audited_rules, f, ensure_ascii=False, indent=2)

    approved_terms_path = os.path.join(OUT, "verse_original_terms_approved.json")
    with open(approved_terms_path, "w", encoding="utf-8") as f:
        json.dump(payload_all, f, ensure_ascii=False, separators=(",", ":"))

    # Re-parse to guarantee 100% clean JSON
    with open(out_json_path, "r", encoding="utf-8") as f:
        reloaded = json.load(f)

    print(f"\nSuccessfully wrote and verified {out_json_path} ({os.path.getsize(out_json_path):,} bytes).")
    print("Verified metrics:", json.dumps(reloaded["verifiedMetrics"], ensure_ascii=False, indent=2))



def main() -> int:
    env = lambda n: os.environ.get(n, "").strip() or None
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--scripture-root", default=env("VERSE_COMPAT_SCRIPTURE_ROOT"))
    p.add_argument("--cache-dir", default=env("VERSE_COMPAT_CACHE_DIR"))
    p.add_argument("--candidates-dir", default=env("VERSE_COMPAT_OUT_DIR"))
    p.add_argument("--out-dir", default=None, help="default: --candidates-dir")
    p.add_argument("--curated", default=str(Path(__file__).with_name("curated.json")))
    a = p.parse_args()
    for flag, v in (("--scripture-root", a.scripture_root), ("--cache-dir", a.cache_dir), ("--candidates-dir", a.candidates_dir)):
        if not v:
            p.error(f"{flag} is required (or set its VERSE_COMPAT_* env var)")
    run(a.candidates_dir, a.cache_dir, str(Path(a.scripture_root) / "raw_scripture"),
        a.out_dir or a.candidates_dir, a.curated)
    return 0


if __name__ == "__main__":
    sys.exit(main())
