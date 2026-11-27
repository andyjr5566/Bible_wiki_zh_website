"""用 Codex 與 Gemini 跑 AI 判讀批次（可中斷續跑）。

讀 <ai-dir>/batches/batch_NNNN.json（由 build_original_terms.py 產生），
每批每個模型寫一個 <ai-dir>/out/batch_NNNN.<codex|agy>.json；已存在就跳過；格式不對最多重試 3 次。
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ai_stage import make_prompt, parse_response  # noqa: E402


def call_codex(prompt: str, model: str, effort: str, cwd: Path, timeout: int) -> str:
    exe = shutil.which("codex") or "codex"
    p = subprocess.run([exe, "exec", "--skip-git-repo-check", "-m", model, "-c", f'model_reasoning_effort="{effort}"',
                        "-s", "read-only", "-"], input=prompt, capture_output=True, text=True, encoding="utf-8",
                       cwd=cwd, timeout=timeout)
    return p.stdout


def call_agy(prompt: str, model: str, cwd: Path, timeout: int) -> str:
    exe = shutil.which("agy") or "agy"
    p = subprocess.run([exe, "-p", prompt, "--model", model, "--output-format", "text"],
                       capture_output=True, text=True, encoding="utf-8", cwd=cwd, timeout=timeout)
    return p.stdout


def run_one(ai_dir: Path, batch_file: Path, judge: str, args) -> str:
    out = ai_dir / "out" / f"{batch_file.stem}.{judge}.json"
    if out.exists():
        return "skip"
    if args.only_without and (ai_dir / "out" / f"{batch_file.stem}.{args.only_without}.json").exists():
        return "skip"
    batch = json.loads(batch_file.read_text(encoding="utf-8"))
    ids = {it["id"] for it in batch}
    prompt = make_prompt(batch)
    for attempt in range(3):
        try:
            if judge == "codex":
                text = call_codex(prompt, args.codex_model, args.codex_effort, ai_dir, args.timeout)
            elif judge == "codex_xhigh":
                text = call_codex(prompt, args.codex_model, "xhigh", ai_dir, args.timeout)
            else:
                text = call_agy(prompt, args.agy_model, ai_dir, args.timeout)
        except (subprocess.TimeoutExpired, OSError):
            continue
        ans = parse_response(text)
        if ans and ids <= set(ans):
            out.write_text(json.dumps({i: ans[i] for i in ids}, ensure_ascii=False), encoding="utf-8")
            return "ok"
    return "fail"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ai-dir", required=True)
    ap.add_argument("--workers", type=int, default=6, help="每個模型同時幾批")
    ap.add_argument("--codex-model", default="gpt-6.1-terra")
    ap.add_argument("--codex-effort", default="medium")
    ap.add_argument("--agy-model", default="gemini-4-hydrogen-high")
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--judges", default="codex,agy", help="要跑哪些模型，逗號分隔")
    ap.add_argument("--only-without", help="該批若已有這個模型的結果就不跑（例：agy，只替沒有 Gemini 結果的批次補 codex_xhigh）")
    ap.add_argument("--reverse", action="store_true", help="由最後一批往前跑（與另一個程序分工用）")
    ap.add_argument("--limit", type=int, default=0, help="只跑前 N 批（測試用）")
    args = ap.parse_args()
    ai_dir = Path(args.ai_dir)
    (ai_dir / "out").mkdir(exist_ok=True)
    batches = sorted((ai_dir / "batches").glob("batch_*.json"))
    if args.limit:
        batches = batches[: args.limit]
    if args.reverse:
        batches.reverse()
    judges = args.judges.split(",")
    log = (ai_dir / "progress.log").open("a", encoding="utf-8")

    def task(bj_judge):
        bj, judge = bj_judge
        r = run_one(ai_dir, bj, judge, args)
        log.write(f"{time.strftime('%H:%M:%S')} {bj.stem} {judge} {r}\n")
        log.flush()
        return r

    # 每個模型各用自己的執行緒池，互不等待
    pools = {j: ThreadPoolExecutor(args.workers) for j in judges}
    futs = [pools[j].submit(task, (b, j)) for j in judges for b in batches]
    res = [f.result() for f in futs]
    for p in pools.values():
        p.shutdown()
    print({k: res.count(k) for k in set(res)})
    return 0 if "fail" not in res else 1


if __name__ == "__main__":
    raise SystemExit(main())
