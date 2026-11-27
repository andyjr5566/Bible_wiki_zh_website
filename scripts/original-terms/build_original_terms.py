"""CLI：用 MACULA Hebrew 產生「經文原文詞對照」新資料（試做；不寫進 quartz/data）。

所有資料位置用參數或環境變數給，不寫死個人路徑。範例見 README.md。
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
import zipfile
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ai_stage import apply_ai, apply_decisions, build_queue, collect_decisions, make_batches  # noqa: E402
from charfold import build_fold_map  # noqa: E402
from macula import group_by_verse, read_macula_rows  # noqa: E402
from pipeline import ATTRIBUTION, run_alignment, to_json_chapters, top_renderings  # noqa: E402


def load_compat_module(repo_root: Path):
    path = repo_root / "scripts" / "build-verse-compat.py"
    spec = importlib.util.spec_from_file_location("build_verse_compat", path)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    sys.modules["build_verse_compat"] = mod
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def env_or(arg, name):
    return arg or os.environ.get(name)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--macula-tsv", default=os.environ.get("MACULA_HEBREW_TSV"))
    ap.add_argument("--scripture-root", default=os.environ.get("VERSE_COMPAT_SCRIPTURE_ROOT"))
    ap.add_argument("--compat-cache", default=os.environ.get("VERSE_COMPAT_CACHE_DIR"),
                    help="含 ChiUn.zip 與 Unihan.zip 的資料夾")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--repo-root", default=str(HERE.parents[1]))
    ap.add_argument("--ai-decisions", help="AI 採用結果存檔（jsonl，預設 scripts/original-terms/data/ai-decisions.jsonl）。"
                    "有模型輸出（--ai-dir）時由模型結果重新寫出；沒有時用它重建，不呼叫模型")
    ap.add_argument("--emit-site-data", action="store_true", help="同時寫入 <repo>/quartz/data/verse-original-terms.json（v2）")
    ap.add_argument("--books", default="1-6", help="書卷編號範圍，如 1-6")
    ap.add_argument("--ai-dir", help="AI 判讀批次與結果資料夾（預設 <out-dir>/ai）")
    args = ap.parse_args()
    for name in ("macula_tsv", "scripture_root", "compat_cache"):
        if not getattr(args, name):
            ap.error(f"缺少 --{name.replace('_', '-')}")

    repo = Path(args.repo_root)
    cache = Path(args.compat_cache)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    lo, hi = (int(x) for x in args.books.split("-"))
    books = set(range(lo, hi + 1))

    compat = load_compat_module(repo)
    with zipfile.ZipFile(cache / "Unihan.zip") as zf:
        fold_map = build_fold_map(zf.read("Unihan_Variants.txt").decode("utf-8"))

    print("載入和合本、STEP、信望愛…", flush=True)
    scripture_root = Path(args.scripture_root)
    baseline = compat.load_baseline_scripture(repo, scripture_root)
    step = compat.load_step_data(scripture_root)
    nrsv = compat.extract_nrsv_versification_from_chiun(cache / "ChiUn.zip")
    _conf, chiun = compat.load_sword_ztext_module(cache / "ChiUn.zip", baseline.books, nrsv)
    tokens, _attested = compat.extract_aligned_osis_tokens(baseline, chiun)
    fhl_by_verse: dict = {}
    for ref, toks in tokens.items():
        if ref[0] not in books:
            continue
        d: dict[str, list] = {}
        for t in toks:
            for s in t.strongs:
                if compat.is_lexical_strong_number(s):
                    d.setdefault(s, []).append(tuple(t.raw_char_range))
        fhl_by_verse[ref] = d

    print("讀 MACULA…", flush=True)
    by_verse = group_by_verse(read_macula_rows(args.macula_tsv), books)
    results, skipped, by_sense, verses = run_alignment(
        by_verse, step.heb_mt_to_eng_ref,
        {r: t for r, t in baseline.verses.items() if r[0] in books},
        fhl_by_verse, fold_map, compat.is_cjk,
    )

    def slug_of(b: int, c: int) -> str:
        return f"{b:02d}-{baseline.books_by_num[b]['name']}/第{c}章"

    rules_before: Counter = Counter(r.rule for rs in results.values() for r in rs)

    # ---- AI 判讀階段：建批次；兩位的結果都在時套用 ----
    ai_dir = Path(args.ai_dir) if args.ai_dir else out / "ai"
    (ai_dir / "batches").mkdir(parents=True, exist_ok=True)
    (ai_dir / "out").mkdir(exist_ok=True)
    label = lambda ref: f"{baseline.books_by_num[ref[0]]['short']} {ref[1]}:{ref[2]}"
    queue = build_queue(results, verses, by_sense, label)
    batches = make_batches(queue)
    for old_b in (ai_dir / "batches").glob("batch_*.json"):
        old_b.unlink()
    stems = []
    for i, batch in enumerate(batches, 1):
        tag = hashlib.sha1("|".join(it["id"] for it in batch).encode()).hexdigest()[:8]
        stem = f"batch_{i:04d}_{tag}"
        stems.append(stem)
        (ai_dir / "batches" / f"{stem}.json").write_text(json.dumps(batch, ensure_ascii=False), encoding="utf-8")
    # 每批的決定者：有 Gemini 結果 → codex+agy；否則有 codex_xhigh 結果 → codex+codex_xhigh
    answers_a: dict[str, str] = {}
    answers_b: dict[str, str] = {}
    pair_of: dict[str, str] = {}
    done: Counter = Counter()

    def load(stem: str, judge: str):
        f = ai_dir / "out" / f"{stem}.{judge}.json"
        return json.loads(f.read_text(encoding="utf-8")) if f.exists() else None

    for stem in stems:
        a = load(stem, "codex")
        second = next(((j, load(stem, j)) for j in ("agy", "codex_xhigh") if load(stem, j) is not None), None)
        if a is None or second is None:
            continue
        pair = f"codex+{second[0]}"
        done[pair] += 1
        for iid in a:
            pair_of[iid] = pair
        answers_a.update(a)
        answers_b.update(second[1])
    ai_stats: Counter = Counter()
    disagreements: list = []
    dec_path = Path(args.ai_decisions) if args.ai_decisions else HERE / "data" / "ai-decisions.jsonl"
    if done:
        results, ai_stats, disagreements = apply_ai(results, verses, answers_a, answers_b, pair_of)
        dec_path.parent.mkdir(parents=True, exist_ok=True)
        dec_path.write_text("".join(json.dumps(d, ensure_ascii=False) + chr(10) for d in collect_decisions(results)), encoding="utf-8")
    elif dec_path.exists():
        decisions = {d["id"]: d for d in (json.loads(l) for l in dec_path.read_text(encoding="utf-8").splitlines() if l.strip())}
        results, ai_stats = apply_decisions(results, verses, decisions)
    (out / "ai_disagreements.jsonl").write_text(
        "".join(json.dumps(d, ensure_ascii=False) + "\n" for d in disagreements), encoding="utf-8")

    # ---- 詞表：lemma／音譯取 STEP（字典形）；沒有就用 MACULA；中文意思不放（由前端用譯法統計組） ----
    per_strong: dict[str, Counter] = {}
    first_meta: dict[str, dict] = {}
    for rs in results.values():
        for r in rs:
            first_meta.setdefault(r.word.sid, r.word.meta or {})
            if r.rendering:
                per_strong.setdefault(r.word.sid, Counter())[r.rendering] += 1
    lexicon: dict[str, list] = {}
    compat_lexicon: dict[str, list] = {}
    for sid in sorted({r.word.sid for rs in results.values() for r in rs}, key=lambda s: int(s[1:])):
        m = first_meta[sid]
        step_entry = step.primary_by_strong.get(sid)
        lemma = step_entry.lemma if step_entry else m.get("lemma", "")
        translit = step_entry.translit if step_entry else m.get("translit", "")
        tops = top_renderings(per_strong.get(sid, Counter()))
        lexicon[sid] = [lemma, translit]
        compat_lexicon[sid] = [lemma, translit, "、".join(tops[:3]), tops]  # 舊前端格式（僅試做比對用）

    new = {"version": 2, "attribution": ATTRIBUTION, "lexicon": lexicon,
           "chapters": to_json_chapters(results, slug_of, True)}
    compat_out = {"version": 1, "attribution": ATTRIBUTION, "lexicon": compat_lexicon,
                  "chapters": to_json_chapters(results, slug_of, False)}
    (out / "verse-original-terms.new.json").write_text(json.dumps(new, ensure_ascii=False), encoding="utf-8")
    (out / "verse-original-terms.oldschema.json").write_text(json.dumps(compat_out, ensure_ascii=False), encoding="utf-8")
    if args.emit_site_data:
        (repo / "quartz" / "data" / "verse-original-terms.json").write_text(
            json.dumps(new, ensure_ascii=False, separators=(",", ":")) + chr(10), encoding="utf-8")
    missing_in_old = 0

    rules: Counter = Counter()
    with (out / "occurrences.jsonl").open("w", encoding="utf-8") as fh:
        for (b, c, v), rs in sorted(results.items()):
            for r in rs:
                rules[r.rule] += 1
                fh.write(json.dumps({
                    "ref": f"{b}.{c}.{v}", "slug": slug_of(b, c), "verse": v, "sid": r.word.sid, "sense": r.word.sense,
                    "rendering": r.rendering, "rule": r.rule, "pair": r.pair,
                    "hl": [verses[(b, c, v)].pos[r.span[0]], verses[(b, c, v)].pos[r.span[1] - 1] + 1] if r.span else None, "prior": r.prior, "text": baseline.verses[(b, c, v)],
                    **(r.word.meta or {})}, ensure_ascii=False) + "\n")
    stats = {"rules_before_ai": dict(rules_before), "rules": dict(rules), "total": sum(rules.values()), "skipped": dict(skipped),
             "ai": {"queue": len(queue), "batches": len(batches), "batches_done": dict(done), "decisions": dict(ai_stats)},
             "strongs": len(lexicon), "strongs_missing_in_old_lexicon": missing_in_old}
    (out / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
