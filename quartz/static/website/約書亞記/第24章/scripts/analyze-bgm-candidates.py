"""量候選配樂的長度、響度、起伏，並剪出約 80 秒的試聽段（collect/audio/bgm-more/clips/，不進版控）。"""
from __future__ import annotations
import json, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "collect" / "audio" / "bgm-more" / "raw"
CLIPS = ROOT / "collect" / "audio" / "bgm-more" / "clips"
CLIPS.mkdir(parents=True, exist_ok=True)
CLIP = 80.0


def probe_dur(p: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def loud(p: Path) -> tuple[float, float, list[float]]:
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(p), "-af", "ebur128=peak=none", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"t:\s*([\d.]+)\s+TARGET:\S+ LUFS\s+M:\s*(-?[\d.inf]+)\s+S:\s*(-?[\d.inf]+)", r.stderr)
    shorts = []
    for t, M, S in m:
        try: shorts.append((float(t), float(M)))
        except ValueError: shorts.append((float(t), -70.0))
    integ = re.search(r"I:\s+(-?[\d.]+) LUFS", r.stderr.split("Summary:")[-1])
    lra = re.search(r"LRA:\s+([\d.]+) LU", r.stderr.split("Summary:")[-1])
    curve = [x for _, x in shorts]
    return (float(integ.group(1)) if integ else -70, float(lra.group(1)) if lra else 0, curve)


def best_window(curve: list[float], dur: float) -> float:
    # curve 每 0.1 s 一點；選平均響度最高且沒有靜音的 CLIP 秒
    step = 10
    n = int(CLIP * 10)
    if dur <= CLIP + 6 or len(curve) < n:
        return 0.0
    best, start = -999, 0
    for i in range(0, len(curve) - n, step * 2):
        w = curve[i:i + n]
        score = sum(w) / len(w) - (20 if min(w) < -45 else 0)
        if score > best: best, start = score, i / 10
    return start


def one(d: Path) -> dict | None:
    info = json.loads((d / "info.json").read_text(encoding="utf-8"))
    if not info.get("file"): return None
    src = d / info["file"]
    dur = probe_dur(src)
    I, lra, curve = loud(src)
    start = best_window(curve, dur)
    length = min(CLIP, dur)
    out = CLIPS / f"{d.name}.mp3"
    if not out.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(length), "-i", str(src),
                        "-af", f"afade=t=in:d=1.5,afade=t=out:st={max(0, length-3)}:d=3,loudnorm=I=-20:TP=-2:LRA=11",
                        "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k", str(out)], check=True)
    info.update(duration=round(dur, 1), lufs=I, lra=lra, clipStart=round(start, 1), clipLen=round(length, 1), clip=out.name)
    (d / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    return info


if __name__ == "__main__":
    dirs = sorted(p for p in RAW.iterdir() if (p / "info.json").exists())
    with ThreadPoolExecutor(4) as ex:
        res = [r for r in ex.map(one, dirs) if r]
    (ROOT / "collect" / "audio" / "bgm-more" / "index.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in res:
        print(f"{r['slug'][:44]:44} {r['duration']:6.0f}s I={r['lufs']:6.1f} LRA={r['lra']:4.1f} start={r['clipStart']:5.0f} | {r['author'][:16]:16} | {r['title'][:50]}")
