import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from align import Result, VerseText, Word, align_verse_pass1, align_verse_pass2, choose_occurrence, find_spans, tally_confirmed  # noqa: E402
from charfold import build_fold_map, fold_text  # noqa: E402
from macula import gloss_candidates, is_content_word, parse_ref, sense_key, strong_key  # noqa: E402
from pipeline import to_json_chapters  # noqa: E402

UNIHAN = "\n".join([
    "U+6F54\tkSimplifiedVariant\tU+6D01",
    "U+6DE8\tkSemanticVariant\tU+51C8<kLau",
    "U+51C8\tkSimplifiedVariant\tU+51C0",
    "U+88E1\tkSimplifiedVariant\tU+88E1 U+91CC",
    "U+8AAA\tkSimplifiedVariant\tU+8BF4",
])
FOLD = build_fold_map(UNIHAN)


def is_cjk(ch):
    return "一" <= ch <= "鿿"


def verse(text):
    return VerseText.build(text, FOLD, is_cjk)


def word(sid="H1", sense=None, cands=("",), index=0, total=10):
    return Word(sid, sense or sid, [fold_text(c, FOLD) for c in cands if c], index, total)


class FoldTests(unittest.TestCase):
    def test_simplified_and_traditional_fold_together(self):
        self.assertEqual(fold_text("潔淨", FOLD), fold_text("洁净", FOLD))
        self.assertEqual(fold_text("說", FOLD), "说")

    def test_cuv_variants(self):
        self.assertEqual(fold_text("裡", FOLD), fold_text("裏", FOLD))
        self.assertEqual(fold_text("著", FOLD), fold_text("着", FOLD))

    def test_length_preserved(self):
        self.assertEqual(len(fold_text("潔淨之人！", FOLD)), 5)


class MaculaTests(unittest.TestCase):
    def test_parse_ref(self):
        self.assertEqual(parse_ref("GEN 20:5!14"), (1, 20, 5, 14))
        self.assertIsNone(parse_ref("MAT 1:1!1"))

    def test_strong_key_matches_old_keys(self):
        self.assertEqual(strong_key("2416a"), "H2416")
        self.assertEqual(strong_key("0871a"), "H871")
        self.assertEqual(strong_key("3824"), "H3824")
        self.assertIsNone(strong_key(""))

    def test_sense_key(self):
        self.assertEqual(sense_key("H5375", "6"), "H5375.6")
        self.assertEqual(sense_key("H5375", ""), "H5375")

    def test_content_word(self):
        self.assertTrue(is_content_word({"pos": "noun", "type": "common", "strongnumberx": "3824"}))
        self.assertTrue(is_content_word({"pos": "verb", "type": "qatal", "strongnumberx": "5375"}))
        self.assertFalse(is_content_word({"pos": "noun", "type": "proper", "strongnumberx": "1732"}))
        self.assertFalse(is_content_word({"pos": "preposition", "type": "", "strongnumberx": "0871a"}))
        self.assertFalse(is_content_word({"pos": "particle", "type": "direct object marker", "strongnumberx": "0853"}))
        self.assertFalse(is_content_word({"pos": "adjective", "type": "cardinal number", "strongnumberx": "0259"}))

    def test_gloss_candidates(self):
        self.assertEqual(gloss_candidates("神/上帝"), ["神", "上帝"])
        self.assertEqual(gloss_candidates("所产的"), ["所产的", "产"])
        self.assertEqual(gloss_candidates("称~为"), ["称"])
        self.assertEqual(gloss_candidates("在~上"), [])
        self.assertEqual(gloss_candidates(""), [])


class AlignTests(unittest.TestCase):
    def test_find_spans_not_across_punctuation(self):
        v = verse("神說，要有光。")
        self.assertEqual(find_spans(v, fold_text("說要", FOLD)), [])
        self.assertEqual(find_spans(v, "光"), [(4, 5)])

    def test_unique_returns_exact_verse_text(self):
        v = verse("你要潔淨他們。")
        res = align_verse_pass1(v, [word("H2891", cands=["洁净"])], {})
        self.assertEqual((res[0].rendering, res[0].rule), ("潔淨", "unique"))

    def test_fhl_picks_overlapping_occurrence(self):
        v = verse("神看光是好的，神就把光暗分開了。")
        # 「神」第一次在 0，第二次在 6；FHL 標在後者
        occs = find_spans(v, "神")
        self.assertEqual(len(occs), 2)
        res = align_verse_pass1(v, [word("H430", cands=["神"], index=0)], {"H430": [(5, 7)]})
        self.assertEqual(res[0].rule, "fhl")
        self.assertEqual(res[0].span, occs[1])

    def test_order_fallback_and_claiming(self):
        v = verse("神說神說")
        words = [word("H1", cands=["神"], index=0, total=4), word("H1", cands=["神"], index=2, total=4)]
        res = align_verse_pass1(v, words, {})
        self.assertEqual([r.span for r in res], [(0, 1), (2, 3)])
        self.assertTrue(all(r.rule == "order" for r in res))

    def test_not_found_is_none_never_borrowed(self):
        v = verse("他們就逃跑了。")
        res = align_verse_pass1(v, [word("H1", cands=["奸细"])], {"H1": [(0, 3)]})
        self.assertEqual((res[0].rendering, res[0].rule), ("", "none"))

    def test_choose_occurrence_skips_claimed(self):
        self.assertIsNone(choose_occurrence([(0, 1)], [(0, 1)], [], 0))
        self.assertEqual(choose_occurrence([(0, 1), (3, 4)], [(0, 1)], [], 0), ((3, 4), "order"))

    def test_pass2_uses_confirmed_rendering_inside_fhl_span_only(self):
        w = word("H7", "H7.1", cands=["不存在"])
        known = [Result(Word("H7", "H7.1", [], 0, 1), "饒恕", "unique", (0, 2))] * 2
        by_sense, by_strong = tally_confirmed(known)
        v = verse("求你饒恕他們，又饒恕我。")
        out = align_verse_pass2(v, [Result(w, "", "none")], {"H7": [(1, 4)]}, by_sense, by_strong, FOLD)
        self.assertEqual((out[0].rendering, out[0].rule), ("饒恕", "confirmed_sense"))
        self.assertEqual(out[0].span, (2, 4))
        # FHL 範圍不含譯法 -> 維持未譯出
        out = align_verse_pass2(v, [Result(w, "", "none")], {"H7": [(5, 7)]}, by_sense, by_strong, FOLD)
        self.assertEqual(out[0].rule, "none")
        # 沒有 FHL 位置 -> 不硬找
        out = align_verse_pass2(v, [Result(w, "", "none")], {}, by_sense, by_strong, FOLD)
        self.assertEqual(out[0].rule, "none")

    def test_pass2_rejects_dominated_single_char(self):
        counter_known = [Result(Word("H9", "H9", [], 0, 1), r, "unique", (0, 1)) for r in ["做"] * 2 + ["行", "作", "為", "造", "辦"] * 1]
        by_sense, by_strong = tally_confirmed(counter_known)
        v = verse("你做了")
        w = word("H9", "H9", cands=["不存在"])
        out = align_verse_pass2(v, [Result(w, "", "none")], {"H9": [(0, 3)]}, by_sense, by_strong, FOLD)
        self.assertEqual(out[0].rule, "none")

    def test_tally_ignores_empty(self):
        res = [Result(word("H1"), "", "none"), Result(word("H1"), "神", "unique", (0, 1))]
        by_sense, by_strong = tally_confirmed(res)
        self.assertEqual(by_strong["H1"], Counter({"神": 1}))

    def test_single_span_goes_to_best_fitting_occurrence_not_first(self):
        # 申 20:8：三個「心」詞，和合本只有一個「心」（弟兄的心）；第一個（膽怯的心）不該搶走
        v = verse("誰懼怕膽怯，他可以回家去，恐怕他弟兄的心消化，和他一樣。")
        words = [word("H3824", cands=["心"], index=2, total=20),
                 word("H3824", cands=["心"], index=17, total=20),
                 word("H3824", cands=["心"], index=19, total=20)]
        res = align_verse_pass1(v, words, {})
        span = find_spans(v, "心")[0]
        self.assertEqual([r.rendering for r in res], ["", "心", ""])
        self.assertEqual(res[1].span, span)
        self.assertEqual(res[1].rule, "order")  # 語序挑的，不直接接受

    def test_fhl_decides_between_two_spans_for_two_words(self):
        v = verse("心歡喜，他的心快樂。")
        words = [word("H3824", cands=["心"], index=1, total=10), word("H3824", cands=["心"], index=6, total=10)]
        res = align_verse_pass1(v, words, {"H3824": [(4, 6)]})
        # 兩個詞、兩個「心」：依序各一個
        self.assertEqual({r.span for r in res}, {(0, 1), (5, 6)})
        self.assertEqual(len({r.span for r in res}), 2)

    def test_order_rule_is_demoted_in_pass2(self):
        v = verse("神說神說")
        words = [word("H1", cands=["神"], index=0, total=4), word("H1", cands=["神"], index=2, total=4)]
        res = align_verse_pass1(v, words, {})
        out = align_verse_pass2(v, res, {}, {}, {}, FOLD)
        self.assertTrue(all(r.rule == "none" and r.prior == "order" and r.rendering == "" for r in out))


class OutputTests(unittest.TestCase):
    def test_old_schema_drops_empty_and_sense(self):
        rs = {(1, 1, 1): [Result(word("H1", "H1.2"), "神", "unique", (0, 1)), Result(word("H2", "H2"), "", "none")]}
        slug = lambda b, c: f"{b:02d}-X/第{c}章"
        self.assertEqual(to_json_chapters(rs, slug, True), {"01-X/第1章": {"1": [["H1", "神", "H1.2"], ["H2", "", "H2"]]}})
        self.assertEqual(to_json_chapters(rs, slug, False), {"01-X/第1章": {"1": [["H1", "神"]]}})


if __name__ == "__main__":
    unittest.main()
