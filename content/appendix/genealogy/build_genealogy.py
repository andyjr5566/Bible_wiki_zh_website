#!/usr/bin/env python3
"""族譜附錄：從 YAML 資料驗證並產生 Obsidian 頁面。

資料是唯一來源（`<卷>/genealogy.yaml` 人物關係、`<卷>/extras.yaml` 對照表與人物卡），
頁面由本程式產生，不手改。驗證全部以 `raw_scripture/` 和合本為準：

- 每個人名（或 `as` 標的經文寫法）、`of`（某地之祖）、`mother` 都必須逐字出現在所引經節。
- 所有「」引句必須逐字出現在同一條目所引的經節。
- 平行經文對照兩邊的字串、人數表的數字字串、城邑名都要逐字出現在各自經節。
- 範圍內每一節都要被資料涵蓋，或在 `uncovered` 註明理由。
- 產出頁面不得含跨檔 `[[` 連結（相關卷書尚未建條目，避免空連結；內部 # 標題錨點連結除外）。

用法：
    python appendix/genealogy/build_genealogy.py 歷代志上            # 驗證＋產生頁面
    python appendix/genealogy/build_genealogy.py 歷代志上 --check    # 只驗證
    python appendix/genealogy/build_genealogy.py 歷代志上 --review out.md  # 另輸出逐節對照表供人工複核
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SCRIPTURE = ROOT / "raw_scripture"
HERE = Path(__file__).resolve().parent

ABBR = {
    "創": "創世記", "出": "出埃及記", "利": "利未記", "民": "民數記", "申": "申命記",
    "書": "約書亞記", "士": "士師記", "得": "路得記", "撒上": "撒母耳記上", "撒下": "撒母耳記下",
    "王上": "列王紀上", "王下": "列王紀下", "代上": "歷代志上", "代下": "歷代志下",
    "拉": "以斯拉記", "尼": "尼希米記", "斯": "以斯帖記", "伯": "約伯記", "詩": "詩篇",
    "箴": "箴言", "傳": "傳道書", "歌": "雅歌", "賽": "以賽亞書", "耶": "耶利米書",
    "哀": "耶利米哀歌", "結": "以西結書", "但": "但以理書", "何": "何西阿書", "珥": "約珥書",
    "摩": "阿摩司書", "俄": "俄巴底亞書", "拿": "約拿書", "彌": "彌迦書", "鴻": "那鴻書",
    "哈": "哈巴谷書", "番": "西番雅書", "該": "哈該書", "亞": "撒迦利亞書", "瑪": "瑪拉基書",
    "太": "馬太福音", "可": "馬可福音", "路": "路加福音", "約": "約翰福音", "徒": "使徒行傳",
    "羅": "羅馬書", "林前": "哥林多前書", "林後": "哥林多後書", "加": "加拉太書",
    "弗": "以弗所書", "腓": "腓立比書", "西": "歌羅西書", "來": "希伯來書", "雅": "雅各書",
    "彼前": "彼得前書", "彼後": "彼得後書", "猶": "猶大書", "啟": "啟示錄",
}
FULL_TO_ABBR = {v: k for k, v in ABBR.items()}
QUOTE_RE = re.compile(r"「([^「」]+)」")
PUNCT_RE = re.compile(r"[，。、；：！？「」『』（）()\s─—…‧·]")


class Scripture:
    def __init__(self) -> None:
        self.cache: dict[tuple[str, int], list[str]] = {}

    def chapter(self, book: str, ch: int) -> list[str]:
        key = (book, ch)
        if key not in self.cache:
            path = SCRIPTURE / book / f"第{ch}章.txt"
            self.cache[key] = path.read_text(encoding="utf-8").splitlines() if path.is_file() else []
        return self.cache[key]

    def verse(self, book: str, ch: int, v: int) -> str | None:
        lines = self.chapter(book, ch)
        return lines[v - 1] if 1 <= v <= len(lines) else None


def parse_refs(refs: str, default_book: str) -> list[tuple[str, int, int]]:
    """「2:10-15, 撒下 13:20, 3:1-4:2」→ [(書, 章, 節), ...]；格式錯拋 ValueError。"""
    out: list[tuple[str, int, int]] = []
    for part in re.split(r"[,，;；]\s*", str(refs).strip()):
        if not part:
            continue
        book = default_book
        m = re.match(r"^([^\d\s]+)\s*(.*)$", part)
        if m:
            abbr, part = m.group(1), m.group(2)
            if abbr not in ABBR:
                raise ValueError(f"未知書卷簡稱：{abbr}")
            book = ABBR[abbr]
        m = re.fullmatch(r"(\d+):(\d+)(?:[-–](?:(\d+):)?(\d+))?", part)
        if not m:
            raise ValueError(f"經節格式錯誤：{part}")
        c1, v1 = int(m.group(1)), int(m.group(2))
        c2 = int(m.group(3)) if m.group(3) else c1
        v2 = int(m.group(4)) if m.group(4) else v1
        if c2 == c1:
            out += [(book, c1, v) for v in range(v1, v2 + 1)]
        else:
            raise ValueError(f"跨章範圍請拆開寫：{part}")
    return out


def norm(s: str) -> str:
    return PUNCT_RE.sub("", s)


def display(node_id: str) -> str:
    return node_id.split("#", 1)[0]


def fmt_ref(refs: str, default_book: str) -> str:
    """顯示用：預設卷書省略書名，其他卷書用簡稱。"""
    return str(refs).replace("-", "–")


class Builder:
    def __init__(self, book_dir: Path) -> None:
        self.dir = book_dir
        self.data = yaml.safe_load((book_dir / "genealogy.yaml").read_text(encoding="utf-8"))
        extras_path = book_dir / "extras.yaml"
        self.extras = yaml.safe_load(extras_path.read_text(encoding="utf-8")) if extras_path.is_file() else {}
        self.book = self.data["book"]
        self.abbr = FULL_TO_ABBR[self.book]
        self.sc = Scripture()
        self.errors: list[str] = []
        self.nodes: "OrderedDict[str, dict]" = OrderedDict()
        self.children: dict[str, list[str]] = defaultdict(list)
        self.covered: set[tuple[int, int]] = set()
        self.verse_names: dict[tuple[int, int], list[str]] = defaultdict(list)

    # ---------- 驗證工具 ----------
    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"[{where}] {msg}")

    def refs(self, refs: str, where: str) -> list[tuple[str, int, int]]:
        try:
            parsed = parse_refs(refs, self.book)
        except ValueError as exc:
            self.err(where, str(exc))
            return []
        for b, c, v in parsed:
            if self.sc.verse(b, c, v) is None:
                self.err(where, f"經節不存在：{b} {c}:{v}")
        return parsed

    def text_of(self, parsed) -> str:
        return "".join(self.sc.verse(b, c, v) or "" for b, c, v in parsed)

    def need_text(self, needle: str, parsed, where: str, what: str) -> None:
        if not parsed:
            return
        if norm(needle) not in norm(self.text_of(parsed)):
            span = ", ".join(f"{FULL_TO_ABBR.get(b, b)}{c}:{v}" for b, c, v in parsed[:3])
            self.err(where, f"{what}「{needle}」不在所引經文（{span}{'…' if len(parsed) > 3 else ''}）")

    def check_quotes(self, text: str, parsed, where: str) -> None:
        for q in QUOTE_RE.findall(text or ""):
            self.need_text(q, parsed, where, "引句")

    def cover(self, parsed) -> None:
        for b, c, v in parsed:
            if b == self.book:
                self.covered.add((c, v))

    # ---------- 族譜資料 ----------
    def record_names(self, shown: str, parsed) -> None:
        for b, c, v in parsed:
            if b == self.book:
                self.verse_names[(c, v)].append(shown)

    def add_node(self, item, parent: str | None, rel: str, st: dict, parsed, where: str, section: str) -> str | None:
        if isinstance(item, str):
            item = {"id": item}
        nid = item["id"]
        shown = item.get("as", display(nid))
        self.need_text(shown, parsed, where, "人名")
        if item.get("of"):
            self.need_text(item["of"], parsed, where, "地名")
        for s in item.get("check", []):
            self.need_text(s, parsed, where, "註記用字")
        self.check_quotes(item.get("note", ""), parsed, where)
        seen = st.setdefault("_seen", set())
        if nid in seen:
            self.err(where, f"同一句裡「{nid}」出現兩次；同名不同人請用「名#識別」")
        seen.add(nid)
        self.record_names(shown, parsed)
        if nid in self.nodes:
            # 已定義：同一父系視為重述（例如 6:50–53、9:35–44），父系不同就是衝突
            node = self.nodes[nid]
            if node["parent"] != parent:
                self.err(where, f"「{nid}」已在 {node['ref']} 定義為 {node['parent']} 的後代，此處卻接在 {parent}；"
                                "同名不同人請用「名#識別」")
            if item.get("as") and item["as"] != node["name"]:
                node["aliases"].append((st["ref"], item["as"]))
            node["restated"].append(st["ref"])
            return nid
        self.nodes[nid] = {
            "id": nid, "name": display(nid), "parent": parent, "rel": item.get("rel", rel),
            "ref": st["ref"], "of": item.get("of"), "of_word": item.get("of_word", "之祖"),
            "note": item.get("note"), "kind": item.get("kind"),
            "mark": item.get("mark"), "mother": item.get("mother", st.get("mother")),
            "aliases": [(st["ref"], item["as"])] if item.get("as") else [], "restated": [],
            "section": section, "pnote": item.get("pnote", st.get("pnote")),
        }
        if parent:
            self.children[parent].append(nid)
        return nid

    def ensure_parent(self, pid: str, st: dict, parsed, where: str, section: str) -> bool:
        if pid in self.nodes:
            shown = st.get("parent_as", display(pid))
            if st.get("parent_in_text", True):
                self.need_text(shown, parsed, where, "父名")
            if shown != self.nodes[pid]["name"] and (st["ref"], shown) not in self.nodes[pid]["aliases"]:
                self.nodes[pid]["aliases"].append((st["ref"], shown))
            return True
        if st.get("new_parent"):
            self.add_node({"id": pid, "as": st.get("parent_as", display(pid))}, None, "子",
                          {**st, "restate": False}, parsed, where, section)
            return True
        self.err(where, f"父名「{pid}」尚未定義（新的源頭請標 new_parent: true）")
        return False

    def load_genealogy(self) -> None:
        for sec in self.data["sections"]:
            sid = sec["id"]
            self.refs(sec["range"], f"{sid}.range")
            for i, st in enumerate(sec.get("statements", [])):
                where = f"{sid}#{i + 1}({st.get('ref')})"
                parsed = self.refs(st["ref"], where)
                self.cover(parsed)
                if st.get("mother"):
                    self.need_text(st["mother"], parsed, where, "母名")
                for s in st.get("check", []):
                    self.need_text(s, parsed, where, "註記用字")
                self.check_quotes(st.get("note", ""), parsed, where)
                if "chain" in st:
                    chain = st["chain"]
                    first = chain[0] if isinstance(chain[0], str) else chain[0]["id"]
                    if first in self.nodes:
                        shown = chain[0].get("as", display(first)) if isinstance(chain[0], dict) else display(first)
                        self.need_text(shown, parsed, where, "人名")
                        self.record_names(shown, parsed)
                        prev = first
                    elif st.get("new_parent") or st.get("new_root"):
                        prev = self.add_node(chain[0], None, "子", {**st, "restate": False}, parsed, where, sid)
                    else:
                        self.err(where, f"鏈首「{first}」尚未定義（新的源頭請標 new_root: true）")
                        continue
                    for item in chain[1:]:
                        prev = self.add_node(item, prev, "子", st, parsed, where, sid)
                elif "children" in st:
                    pid = st["parent"]
                    if not self.ensure_parent(pid, st, parsed, where, sid):
                        continue
                    for item in st["children"]:
                        self.add_node(item, pid, st.get("rel", "子"), st, parsed, where, sid)
                elif "roots" in st:
                    for item in st["roots"]:
                        self.add_node(item, None, "子", st, parsed, where, sid)
                elif "places" in st:
                    for p in st["places"]:
                        self.need_text(p, parsed, where, "地名")
                elif st.get("covers"):
                    pass  # 只宣告涵蓋（敘事節、總結句），內容在 note
                else:
                    self.err(where, "statement 需要 chain / children / roots / covers 其一")
            for note in sec.get("notes", []):
                where = f"{sid}.notes"
                parsed = self.refs(note["refs"], where)
                self.check_quotes(note["text"], parsed, where)
            if sec.get("spine"):
                a, b = sec["spine"]
                if a not in self.nodes or b not in self.nodes:
                    self.err(f"{sid}.spine", f"主線端點不存在：{a} / {b}")
                elif not self.path(a, b):
                    self.err(f"{sid}.spine", f"{b} 不是 {a} 的後代")

    def path(self, a: str, b: str) -> list[str]:
        seq = [b]
        while seq[-1] != a:
            p = self.nodes[seq[-1]]["parent"]
            if p is None:
                return []
            seq.append(p)
        return list(reversed(seq))

    # ---------- 附表 ----------
    def load_extras(self) -> None:
        ex = self.extras or {}
        for i, card in enumerate(ex.get("cards", [])):
            where = f"cards#{i + 1}({card.get('id')})"
            if card["id"] not in self.nodes:
                self.err(where, "人物卡對應的人物不在族譜資料中")
            parsed = self.refs(card["refs"], where)
            self.check_quotes(card["text"], parsed, where)
        for i, row in enumerate(ex.get("parallels", [])):
            where = f"parallels#{i + 1}"
            for side in ("a", "b"):
                parsed = self.refs(row[f"{side}_ref"], where)
                for s in row[f"{side}_text"].split("／"):
                    self.need_text(s, parsed, where, f"{side} 方字串")
        for i, row in enumerate(ex.get("troops", [])):
            where = f"troops#{i + 1}"
            parsed = self.refs(row["ref"], where)
            self.need_text(row["text"], parsed, where, "人數")
        for i, row in enumerate(ex.get("cities", [])):
            where = f"cities#{i + 1}({row['family']})"
            parsed = self.refs(row["ref"], where)
            for city in row["cities"]:
                self.need_text(city.rstrip("*"), parsed, where, "城名")
            if row.get("count_text"):
                self.need_text(row["count_text"], self.refs(row["count_ref"], where), where, "城數")
        for name in ex.get("homonyms", []):
            ids = [i for i, n in self.nodes.items() if n["name"] == name]
            if len(ids) < 2:
                self.err("homonyms", f"「{name}」在資料裡只有 {len(ids)} 人，不算同名不同人")
        for i, item in enumerate(ex.get("uncovered", [])):
            parsed = self.refs(item["refs"], f"uncovered#{i + 1}")
            self.cover(parsed)
        for key in ("cards", "parallels", "troops", "cities"):
            for row in ex.get(key, []):
                for field in ("refs", "ref", "a_ref"):
                    if row.get(field):
                        self.cover(self.refs(row[field], key))

    def check_coverage(self) -> None:
        lo, hi = self.data["scope"]
        for c in range(lo, hi + 1):
            for v in range(1, len(self.sc.chapter(self.book, c)) + 1):
                if (c, v) not in self.covered:
                    self.err("coverage", f"{self.abbr}{c}:{v} 沒有任何資料涵蓋")

    # ---------- 產生頁面 ----------
    def label(self, nid: str, with_rel: bool = True) -> str:
        n = self.nodes[nid]
        s = n["name"]
        extra = []
        if with_rel and n["rel"] != "子":
            s = f"〔{n['rel']}〕{s}"
        if n["of"]:
            extra.append(f"{n['of']}{n['of_word']}")
        if n["pnote"]:
            extra.append(n["pnote"])
        by_alias: "OrderedDict[str, list[str]]" = OrderedDict()
        for ref, alias in n["aliases"]:
            if alias != n["name"]:
                by_alias.setdefault(alias, []).append(fmt_ref(ref, self.book))
        for alias, refs in by_alias.items():
            extra.append(f"{refs[0]} {'起' if len(refs) > 1 else ''}作{alias}")
        if n["note"]:
            extra.append(n["note"])
        return s + (f"（{'；'.join(extra)}）" if extra else "")

    def chain_run(self, nid: str) -> list[str]:
        run = [nid]
        while True:
            kids = self.children.get(run[-1], [])
            if len(kids) != 1:
                return run
            k = kids[0]
            n = self.nodes[k]
            if n["rel"] != "子" or n["mother"] or n["section"] != self.nodes[nid]["section"]:
                return run
            run.append(k)

    def render_list(self, nid: str, depth: int, out: list[str], section: str, prefix: str) -> None:
        run = self.chain_run(nid)
        text = " → ".join(self.label(x, with_rel=(i == 0)) for i, x in enumerate(run))
        if any(self.nodes[x]["mark"] == "main" for x in run):
            text = f"★ {text}"
        if len(run) >= 4:
            text += f"　*（{len(run)} 代）*"
        ref = self.nodes[run[0]]["ref"]
        out.append(f"{prefix}{'  ' * depth}- {text}　`{fmt_ref(ref, self.book)}`")
        last = run[-1]
        kids = [k for k in self.children.get(last, []) if self.nodes[k]["section"] == section]
        groups: "OrderedDict[str | None, list[str]]" = OrderedDict()
        for k in kids:
            groups.setdefault(self.nodes[k]["mother"], []).append(k)
        multi = len(groups) > 1 or (None not in groups and groups)
        for mother, members in groups.items():
            d = depth + 1
            if multi and mother:
                out.append(f"{prefix}{'  ' * d}- *{mother}所生*")
                d += 1
            for k in members:
                self.render_list(k, d, out, section, prefix)

    def mermaid(self, roots: list[str], section: str, limit: int = 60) -> list[str]:
        lines = ["```mermaid", "flowchart LR"]
        counter = [0]
        styled_main, styled_anchor, styled_mom = [], [], []

        def nid_of() -> str:
            counter[0] += 1
            return f"n{counter[0]}"

        def esc(s: str) -> str:
            return s.replace('"', "#quot;")

        budget = [limit]

        def walk(node: str, parent_mid: str | None, edge: str) -> None:
            run = self.chain_run(node)
            names = [self.nodes[x]["name"] for x in run]
            alias = next((a for _, a in self.nodes[run[0]]["aliases"] if a != names[0]), None)
            if alias:
                names[0] = f"{names[0]}（{alias}）"
            if len(names) > 4:
                parts = [" → ".join(names[i:i + 4]) for i in range(0, len(names), 4)]
                text = " →<br/>".join(parts) + f"<br/>（{len(names)} 代）"
            else:
                text = " → ".join(names)
            mid = nid_of()
            lines.append(f'  {mid}["{esc(text)}"]')
            if parent_mid:
                lines.append(f"  {parent_mid} -->{'|' + esc(edge) + '|' if edge else ''} {mid}")
            if any(self.nodes[x]["mark"] == "main" for x in run):
                styled_main.append(mid)
            if self.nodes[run[0]]["section"] != section:
                styled_anchor.append(mid)
            budget[0] -= 1
            kids = [k for k in self.children.get(run[-1], []) if self.nodes[k]["section"] == section]
            if not kids:
                return
            if budget[0] <= 0:
                more = nid_of()
                lines.append(f'  {more}["…另 {self.count_desc(kids, section)} 人，見完整名單"]')
                lines.append(f"  {mid} --> {more}")
                return
            # 同一母親、或同一種非「子」關係（子孫、諸族…）的兒女，收到一個小圓角節點底下
            group_nodes: dict[str, str] = {}
            rel_count: dict[str, int] = defaultdict(int)
            for k in kids:
                rel_count[self.nodes[k]["rel"]] += 1
            for k in kids:
                n = self.nodes[k]
                lab = n["rel"] if n["rel"] != "子" else ""
                key = f"{n['mother']}所生" if n["mother"] else (lab if lab and rel_count[n["rel"]] > 1 else None)
                src = mid
                if key:
                    if key not in group_nodes:
                        group_nodes[key] = nid_of()
                        lines.append(f'  {group_nodes[key]}(["{esc(key)}"])')
                        lines.append(f"  {mid} --- {group_nodes[key]}")
                        styled_mom.append(group_nodes[key])
                    src = group_nodes[key]
                    if not n["mother"]:
                        lab = ""
                walk(k, src, lab)

        for r in roots:
            walk(r, None, "")
        lines.append("  classDef main fill:#d4a82e44,stroke:#c9971c,stroke-width:2px,font-weight:bold")
        lines.append("  classDef anchor fill:#7a8ca533,stroke:#7a8ca5")
        if styled_main:
            lines.append(f"  class {','.join(styled_main)} main")
        lines.append("  classDef mom fill:#8a7bb022,stroke:#9a8cc4,stroke-dasharray:3 3,font-size:12px")
        if styled_anchor:
            lines.append(f"  class {','.join(styled_anchor)} anchor")
        if styled_mom:
            lines.append(f"  class {','.join(styled_mom)} mom")
        lines.append("```")
        return lines

    def count_desc(self, kids: list[str], section: str) -> int:
        total = 0
        stack = list(kids)
        while stack:
            k = stack.pop()
            total += 1
            stack += [c for c in self.children.get(k, []) if self.nodes[c]["section"] == section]
        return total

    def section_roots(self, sec: dict) -> list[str]:
        sid = sec["id"]
        roots: list[str] = []
        for nid, n in self.nodes.items():
            if n["section"] != sid:
                continue
            p = n["parent"]
            anchor = nid if p is None or self.nodes[p]["section"] != sid else None
            if anchor:
                top = p if p is not None else nid
                if top not in roots:
                    roots.append(top)
        return roots

    def depth_of(self, nid: str, section: str) -> int:
        kids = [k for k in self.children.get(nid, []) if self.nodes[k]["section"] == section]
        return 1 + max((self.depth_of(k, section) for k in kids), default=0)

    def verse_count(self, ranges: list[str]) -> int:
        seen = set()
        for r in ranges:
            for b, c, v in parse_refs(r, self.book):
                seen.add((c, v))
        return len(seen)

    def render(self) -> str:
        d, ex = self.data, self.extras or {}
        out: list[str] = [f"# {d['title']}", ""]
        out += [d["intro"].strip(), ""]
        out += ["> [!info] 怎麼讀這份圖",
                "> - **金色框**（名單裡標 ★）：作者一路追下去的主線，例如大衛王室、大祭司、掃羅家。",
                "> - **藍灰色框**：從前一段接過來的人，方便看出這一段掛在誰底下。",
                "> - `2:10` 這樣的灰字是經節；沒寫書名的都是歷代志上。",
                "> - 一長串單傳的世代收成一行「甲 → 乙 → 丙」，括號裡標代數。",
                "> - 人名一律照和合本；別處經文寫法不同的，見文末「平行經文對照」。",
                ""]
        # 總覽
        out += ["## 總覽", "", "### 從亞當到以色列十二個兒子", ""]
        out += self.overview_mermaid()
        out += ["", "### 篇幅分給了誰", "",
                "同樣是以色列的兒子，作者給的篇幅差很多。數一數每段佔幾節，就看得出這份族譜的重心：", ""]
        out += self.bars()
        out += [""] + [d["overview_note"].strip(), ""]
        # 目錄
        out += ["### 目錄", ""]
        current = None
        for sec in d["sections"]:
            if sec["chapter"] != current:
                current = sec["chapter"]
                ch_title = f"第 {current} 章　{d['chapters'][current]}"
                out.append(f"- **[[#{ch_title}|第 {current} 章]]**")
            out.append(f"  - [[#{sec['title']}|{sec['title']}]]　`{fmt_ref(sec['range'], self.book)}`")
        if ex.get("parallels") or ex.get("homonyms") or ex.get("troops") or ex.get("cities"):
            out.append("- **[[#附表|附表]]**")
            if ex.get("parallels"):
                out.append("  - [[#平行經文對照|平行經文對照]]")
            if ex.get("homonyms"):
                out.append("  - [[#同名不同人|同名不同人]]")
            if ex.get("troops"):
                out.append("  - [[#經文記下的人數|經文記下的人數]]")
            if ex.get("cities"):
                out.append("  - [[#利未人的城邑（6:54–81）|利未人的城邑（6:54–81）]]")
        out.append("")
        # 各段
        cards = defaultdict(list)
        for card in ex.get("cards", []):
            cards[self.nodes[card["id"]]["section"]].append(card)
        current = None
        for sec in d["sections"]:
            if sec["chapter"] != current:
                current = sec["chapter"]
                out += ["---", "", f"## 第 {current} 章　{d['chapters'][current]}", ""]
            out += [f"### {sec['title']}", "", f"`{fmt_ref(sec['range'], self.book)}`　{sec['intro'].strip()}", ""]
            if sec.get("spine"):
                p = self.path(*sec["spine"])
                names = " → ".join(self.nodes[x]["name"] for x in p)
                out += [f"> [!tip] 主線（{len(p)} 代）", f"> {names}", ""]
            roots = self.section_roots(sec)
            # 只把三代以上的家族畫成圖；零散的小家族只列在名單裡，圖才不會被切碎
            deep = [r for r in roots if self.depth_of(r, sec["id"]) >= 3]
            if deep:
                out += self.mermaid(deep, sec["id"]) + [""]
            if roots:
                listing: list[str] = []
                for r in roots:
                    self.render_list(r, 0, listing, sec["id"], "> ")
                fold = "-" if len(listing) > 25 else "+"
                out += [f"> [!abstract]{fold} 完整名單（{self.count_section(sec['id'])} 人）"] + listing + [""]
            facts = []
            for st in sec.get("statements", []):
                ref = f"`{fmt_ref(st['ref'], self.book)}`"
                if "places" in st:
                    tail = f"　{st['note'].strip()}" if st.get("note") else ""
                    facts.append(f"- **{st['label']}**：{'、'.join(st['places'])}{tail}　{ref}")
                elif st.get("note"):
                    facts.append(f"- {st['note'].strip()}　{ref}")
            if facts:
                out += facts + [""]
            if cards.get(sec["id"]):
                out += ["**人物**", ""]
                for card in cards[sec["id"]]:
                    out.append(f"- **{display(card['id'])}**　{card['text'].strip()}　`{card['refs']}`")
                out.append("")
            if sec.get("notes"):
                out.append("> [!note] 讀經提醒")
                for note in sec["notes"]:
                    out.append(f"> - {note['text'].strip()}　`{note['refs']}`")
                out.append("")
            out += ["[[#目錄|↑ 回到目錄]] · [[#歷代志上 1–9 章 人物族譜圖|回到頂部]]", ""]
        out += self.tables()
        out += ["---", "", d["footer"].strip(), ""]
        page = "\n".join(out)
        cross_links = [m for m in re.findall(r"\[\[([^#\]][^\]]*)\]\]", page)]
        if cross_links:
            self.err("render", f"頁面含跨檔 [[ 連結（目前不加外部條目連結，避免空連結）：{cross_links[:5]}")
        return page

    def count_section(self, sid: str) -> int:
        return sum(1 for n in self.nodes.values() if n["section"] == sid)

    def overview_mermaid(self) -> list[str]:
        ov = self.data["overview"]
        lines = ["```mermaid", "flowchart LR"]
        for i, step in enumerate(ov["spine"]):
            lines.append(f'  s{i}["{step["label"]}<br/><small>{step["ref"]}</small>"]')
            if i:
                lines.append(f"  s{i - 1} --> s{i}")
        last = f"s{len(ov['spine']) - 1}"
        for j, t in enumerate(ov["tribes"]):
            where = t.get("where") or "沒有獨立段落"
            lines.append(f'  t{j}["{t["name"]}<br/><small>{where}</small>"]')
            lines.append(f"  {last} --> t{j}")
            if t.get("style"):
                lines.append(f"  class t{j} {t['style']}")
        lines += ["  classDef main fill:#d4a82e44,stroke:#c9971c,stroke-width:2px,font-weight:bold",
                  "  classDef none fill:#80808018,stroke:#999,stroke-dasharray:4 3",
                  "  class " + ",".join(f"s{i}" for i in range(len(ov["spine"]))) + " main", "```"]
        return lines

    def bars(self) -> list[str]:
        rows = []
        for g in self.data["overview"]["bars"]:
            n = self.verse_count(g["ranges"]) if g["ranges"] else 0
            rows.append((g["name"], n, "、".join(r.replace("-", "–") for r in g["ranges"]) or "沒有獨立段落"))
        rows.sort(key=lambda r: -r[1])
        width = max(len(r[0]) for r in rows)
        top = max(r[1] for r in rows)
        lines = ["```text"]
        for name, n, where in rows:
            bar = "█" * max(1, round(n / top * 30)) if n else "·"
            pad = "　" * (width - len(name))
            lines.append(f"{name}{pad} {bar} {n} 節" if n else f"{name}{pad} {bar} 沒有獨立段落")
        lines.append("```")
        return lines

    def tables(self) -> list[str]:
        ex = self.extras or {}
        out = ["---", "", "## 附表", ""]
        if ex.get("parallels"):
            out += ["### 平行經文對照", "", "同一件事、同一個人，在別卷書寫法不同。兩邊的字都照和合本原文：", "",
                    "| 項目 | 歷代志上 | 對照經文 | 說明 |", "|---|---|---|---|"]
            for r in ex["parallels"]:
                out.append(f"| {r['topic']} | {r['a_text']}　`{r['a_ref']}` | {r['b_text']}　`{r['b_ref']}` | {r.get('note', '')} |")
            out.append("")
            out += ["[[#目錄|↑ 回到目錄]] · [[#歷代志上 1–9 章 人物族譜圖|回到頂部]]", ""]
        if ex.get("homonyms"):
            out += ["### 同名不同人", "", "名字相同、但在族譜上是不同的人。讀到時先看他掛在誰底下：", "",
                    "| 名字 | 各是誰 |", "|---|---|"]
            for name in ex["homonyms"]:
                who = []
                for i, n in self.nodes.items():
                    if n["name"] != name:
                        continue
                    if n["parent"]:
                        rel = {"子": "的兒子", "女": "的女兒"}.get(n["rel"], f"的{n['rel']}")
                        desc = f"{display(n['parent'])}{rel}"
                    else:
                        desc = n["pnote"] or n["note"] or "經文沒有寫父親"
                    who.append(f"{desc}　`{n['ref']}`")
                out.append(f"| {name}（{len(who)} 人） | {'<br/>'.join(who)} |")
            out.append("")
            out += ["[[#目錄|↑ 回到目錄]] · [[#歷代志上 1–9 章 人物族譜圖|回到頂部]]", ""]
        if ex.get("troops"):
            out += ["### 經文記下的人數", "", "| 誰 | 數目 | 經文原句 | 經節 |", "|---|---:|---|---|"]
            for r in ex["troops"]:
                out.append(f"| {r['who']} | {r['number']:,} | {r['text']} | `{r['ref']}` |")
            out.append("")
            out += ["[[#目錄|↑ 回到目錄]] · [[#歷代志上 1–9 章 人物族譜圖|回到頂部]]", ""]
        if ex.get("cities"):
            out += ["### 利未人的城邑（6:54–81）", "", "標 \\* 的是經文在這裡明說的逃城。", "",
                    "| 宗族 | 在哪個支派的地 | 城邑 | 經節 |", "|---|---|---|---|"]
            for r in ex["cities"]:
                cities = "、".join(c.replace("*", "\\*") for c in r["cities"])
                out.append(f"| {r['family']} | {r['tribe']} | {cities} | `{r['ref']}` |")
            out.append("")
            if ex.get("cities_note"):
                out += [ex["cities_note"].strip(), ""]
            out += ["[[#目錄|↑ 回到目錄]] · [[#歷代志上 1–9 章 人物族譜圖|回到頂部]]", ""]
        return out

    def review(self) -> str:
        lo, hi = self.data["scope"]
        lines = [f"# {self.book} {lo}–{hi} 章 逐節對照（複核用）", ""]
        for c in range(lo, hi + 1):
            lines.append(f"## 第{c}章")
            for v, text in enumerate(self.sc.chapter(self.book, c), 1):
                names = self.verse_names.get((c, v), [])
                lines.append(f"- **{c}:{v}** {text}")
                lines.append(f"  - 收錄：{'、'.join(names) if names else '（無人名紀錄）'}")
        lines += ["", "## 關係清單（子 → 父）", ""]
        for nid, n in self.nodes.items():
            lines.append(f"- {nid} ← {n['parent'] or '（源頭）'}〔{n['rel']}〕{('母：' + n['mother']) if n['mother'] else ''} `{n['ref']}`")
        return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--review")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    b = Builder(HERE / args.book)
    b.load_genealogy()
    b.load_extras()
    b.check_coverage()
    page = b.render() if not b.errors else ""
    if args.review:
        Path(args.review).write_text(b.review(), encoding="utf-8")
    if b.errors:
        print(f"FAIL：{len(b.errors)} 項")
        for e in b.errors:
            print(" ", e)
        return 1
    print(f"PASS：{len(b.nodes)} 人、涵蓋 {len(b.covered)} 節")
    if not args.check:
        out = ROOT / b.data["output"]
        out.write_text(page, encoding="utf-8")
        print(f"已寫入 {out.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
