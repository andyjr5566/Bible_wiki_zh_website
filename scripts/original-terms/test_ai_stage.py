import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ai_stage import apply_ai, apply_decisions, collect_decisions, build_queue, decide, make_batches, make_prompt, parse_response, validate_span  # noqa: E402
from align import Result, VerseText, Word  # noqa: E402


def is_cjk(ch):
    return "一" <= ch <= "鿿"


def verse(text):
    return VerseText.build(text, {}, is_cjk)


def res(sid, idx, rendering="", rule="none", span=None):
    return Result(Word(sid, sid, [], idx, 10, {"heb": "x", "translit": "t", "english": "e", "gloss": "g"}), rendering, rule, span)


class ParseTests(unittest.TestCase):
    def test_parse_with_noise(self):
        self.assertEqual(parse_response('好的\n[{"id":"a","span":"神"},{"id":"b","span":"NONE"}]'), {"a": "神", "b": "NONE"})

    def test_parse_bad(self):
        self.assertIsNone(parse_response("沒有 JSON"))
        self.assertIsNone(parse_response("[{oops}]"))


class ValidateTests(unittest.TestCase):
    def test_exact_substring_and_claimed(self):
        v = verse("神說，要有光。神看光是好的。")
        self.assertEqual(validate_span(v, "光", [], 0), (4, 5))
        self.assertIsNone(validate_span(v, "神說要", [], 0))   # 跨標點
        self.assertIsNone(validate_span(v, "黑暗", [], 0))     # 不在經文
        self.assertIsNone(validate_span(v, "光", [(4, 5), (7, 8)], 0))  # 全被用掉

    def test_prefers_unclaimed_nearest_expected(self):
        v = verse("神說，要有光。神看光是好的。")
        self.assertEqual(validate_span(v, "光", [(4, 5)], 0), (7, 8))


class DecideTests(unittest.TestCase):
    def setUp(self):
        self.v = verse("耶和華說，要有光。")
        self.r = res("H1", 3)

    def test_kinds(self):
        self.assertEqual(decide(self.v, self.r, "光", "光", []).kind, "accept")
        self.assertEqual(decide(self.v, self.r, "光", "有光", []).kind, "disagree")
        self.assertEqual(decide(self.v, self.r, "NONE", "none", []).kind, "none_agree")
        self.assertEqual(decide(self.v, self.r, "NONE", "光", []).kind, "disagree")
        self.assertEqual(decide(self.v, self.r, "光", "光", [(6, 7)]).kind, "invalid")
        self.assertEqual(decide(self.v, self.r, "光", None, []).kind, "missing")
        self.assertEqual(decide(self.v, self.r, "黑", "黑", []).kind, "invalid")


class ApplyTests(unittest.TestCase):
    def test_apply_only_agreed_and_no_double_claim(self):
        ref = (1, 1, 1)
        v = verse("神說有光。")
        rs = {ref: [res("H1", 0, "神", "unique", (0, 1)), res("H2", 1), res("H3", 2), res("H4", 3)]}
        a = {"1.1.1.1": "光", "1.1.1.2": "光", "1.1.1.3": "有"}
        b = {"1.1.1.1": "光", "1.1.1.2": "光", "1.1.1.3": "說"}
        out, stats, dis = apply_ai(rs, {ref: v}, a, b)
        rules = [r.rule for r in out[ref]]
        self.assertEqual(rules, ["unique", "ai_agree", "none", "none"])   # 第二個「光」已被用掉 -> invalid
        self.assertEqual(out[ref][1].rendering, "光")
        self.assertEqual(stats["accept"], 1)
        self.assertEqual({d["kind"] for d in dis}, {"invalid", "disagree"})

    def test_queue_and_batches(self):
        ref = (1, 1, 1)
        v = verse("神說有光。")
        rs = {ref: [res("H1", 0, "神", "unique", (0, 1)), res("H2", 1)]}
        q = build_queue(rs, {ref: v}, {"H2": Counter({"說": 3})}, lambda r: "創 1:1")
        self.assertEqual(len(q), 1)
        self.assertEqual(q[0]["claimed"], ["神"])
        self.assertEqual(q[0]["sense_renderings"], ["說"])
        self.assertIn("創 1:1", make_prompt(q))
        self.assertEqual(len(make_batches(q * 120)), 3)


class DecisionsTests(unittest.TestCase):
    def test_roundtrip_without_models(self):
        ref = (1, 1, 1)
        v = verse("神說有光。")
        w = lambda i, x: Result(Word(f"H{i}", f"H{i}", [], i, 10, {"xmlid": x}), "", "none")
        rs = {ref: [Result(Word("H1", "H1", [], 0, 10, {"xmlid": "o1"}), "神", "unique", (0, 1)), w(2, "o2"), w(3, "o3")]}
        out, _stats, _dis = apply_ai(rs, {ref: v}, {"1.1.1.2": "光", "1.1.1.3": "NONE"}, {"1.1.1.2": "光", "1.1.1.3": "NONE"}, {"1.1.1.2": "codex+agy"})
        saved = collect_decisions(out)
        self.assertEqual(saved, [{"id": "o2", "span": "光", "pair": "codex+agy"}])
        again, stats = apply_decisions(rs, {ref: v}, {d["id"]: d for d in saved})
        self.assertEqual([r.rule for r in again[ref]], ["unique", "ai_agree", "none"])
        self.assertEqual(again[ref][1].rendering, "光")
        self.assertEqual(stats["accept"], 1)
        # 存檔的字串在經文裡不存在 -> 不採用
        bad, stats = apply_decisions(rs, {ref: v}, {"o2": {"id": "o2", "span": "黑暗", "pair": ""}})
        self.assertEqual(stats["rejected"], 1)
        self.assertEqual(bad[ref][1].rule, "none")


if __name__ == "__main__":
    unittest.main()
