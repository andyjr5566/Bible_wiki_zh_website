"""從 collect/audio/ (Freesound CC0) 裁切並壓縮網站內嵌音效至 src/assets/audio/。

所有來源皆為 collect/audio/audio-candidates.md 驗證之 Creative Commons 0 錄音與後製檔；
環境循環音：在原錄音裡找最平穩的 30 秒（短時響度起伏最小），頭尾以 3 秒等功率交疊接成真正無縫的循環，
單聲道 48kbps MP3。舊做法是 10 秒片段頭尾各自淡出淡入，每 10 秒聲音就掉到靜音再湧回來，
後半段只剩風聲時特別突兀（2026-10-27 使用者回報）。單次事件音保留完整瞬態。絕不使用 Web Audio 合成環境音。
"""

from __future__ import annotations
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAND = ROOT / "collect" / "audio" / "candidates"
REDSEA = ROOT / "collect" / "audio" / "redsea"
PROC = ROOT / "collect" / "audio" / "processed"
OUT = ROOT / "src" / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

FFMPEG = os.environ.get(
    "FFMPEG_BIN",
    r"C:\Users\andyj_adknr2z\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe",
)
if not Path(FFMPEG).exists():
    FFMPEG = "ffmpeg"

LOOP = -1.0  # 環境循環音：起點與長度由 pick_steady_window 自動決定
LOOP_LEN = 30.0
LOOP_FADE = 3.0
# 循環音統一響度：原錄音之間差到 25 dB（山谷風 -26、乾風 -53 LUFS），程式裡的音量數字才代表實際大小
LOOP_LUFS = -30

JOBS = [
    # (輸出檔名, 來源路徑, 起始秒, 長度秒, 濾鏡鏈, 位元率)
    (
        "valley-wind.mp3",
        CAND / "valley-wind-1-553733.mp3",
        LOOP,
        LOOP,
        "highpass=f=70,lowpass=f=2600,volume=0.85",
        "48k",
    ),
    (
        "oak-leaves.mp3",
        CAND / "oak-leaves-1-435206.mp3",
        LOOP,
        LOOP,
        "highpass=f=220,lowpass=f=5000,volume=0.80",
        "48k",
    ),
    (
        "river.mp3",
        PROC / "river-processed-1.mp3",
        LOOP,
        LOOP,
        "lowpass=f=3600,volume=0.82",
        "48k",
    ),
    (
        "sea-roar.mp3",
        REDSEA / "170829.mp3",
        LOOP,
        LOOP,
        "highpass=f=28,volume=1.0",
        "48k",
    ),
    (
        "desert-wind.mp3",
        CAND / "desert-wind-1-827840.mp3",
        LOOP,
        LOOP,
        "highpass=f=90,lowpass=f=2500,volume=0.82",
        "48k",
    ),
    (
        "crowd-murmur.mp3",
        PROC / "crowd-murmur-processed-1.mp3",
        LOOP,
        LOOP,
        "highpass=f=120,lowpass=f=620,volume=0.65",
        "48k",
    ),
    (
        "crowd-surge.mp3",
        PROC / "crowd-surge-processed-1.mp3",
        0.0,
        4.8,
        "highpass=f=110,lowpass=f=680,afade=t=in:st=0:d=0.35,afade=t=out:st=3.6:d=1.2,volume=0.72",
        "48k",
    ),
    (
        "stone-thud.mp3",
        PROC / "stone-thud-processed-1.mp3",
        0.0,
        1.7,
        "lowpass=f=900,volume=1.35",
        "64k",
    ),
]


def short_term_loudness(src: Path, chain: str) -> list[float]:
    """每 0.1 秒一點的短時響度（套上同一組濾鏡後量）。"""
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-i", str(src), "-ac", "1", "-af", f"{chain},ebur128",
                        "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="ignore")
    out = []
    for m in re.finditer(r"S:\s*(-?[\d.]+|-inf)", r.stderr):
        v = m.group(1)
        out.append(-70.0 if v == "-inf" else float(v))
    return out


def pick_steady_window(src: Path, chain: str, length: float) -> float:
    """找出短時響度起伏最小的一段（避開突然的強風、碰撞與錄音頭尾）。"""
    curve = short_term_loudness(src, chain)
    n = int(length * 10)
    best, start = float("inf"), 2.0
    for i in range(30, max(31, len(curve) - n - 30), 5):
        w = curve[i:i + n]
        if len(w) < n:
            break
        mean = sum(w) / n
        score = (sum((x - mean) ** 2 for x in w) / n) ** 0.5 + (max(w) - mean) * 0.5
        if score < best:
            best, start = score, i / 10
    return start


def build_loop(dst: Path, src: Path, chain: str, br: str) -> float:
    start = pick_steady_window(src, chain, LOOP_LEN + LOOP_FADE)
    n, length = LOOP_FADE, LOOP_LEN + LOOP_FADE
    graph = (
        f"[0:a]atrim=start={start}:end={start + length},asetpts=PTS-STARTPTS,{chain},asplit=3[a][b][c];"
        f"[a]atrim=0:{n},asetpts=PTS-STARTPTS,afade=t=in:d={n}:curve=qsin[head];"
        f"[b]atrim={n}:{length - n},asetpts=PTS-STARTPTS[mid];"
        f"[c]atrim={length - n}:{length},asetpts=PTS-STARTPTS,afade=t=out:d={n}:curve=qsin[tail];"
        "[head][tail]amix=inputs=2:normalize=0:duration=longest[x];"
        f"[mid][x]concat=n=2:v=0:a=1,loudnorm=I={LOOP_LUFS}:TP=-3:LRA=7[out]"
    )
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), "-filter_complex", graph,
                    "-map", "[out]", "-ac", "1", "-ar", "24000", "-b:a", br, str(dst)], check=True)
    return start


def build_sea_crash(dst: Path) -> None:
    """紅海水牆合上的一聲：三段 CC0 錄音的最高點對齊在第 3.3 秒疊起來，後面留長長的餘韻。
    巨浪（Shark_Anthony 468899）＋雷鳴般的浪（craigsmith 482856）＋雷聲只取 180 Hz 以下當低頻的一記（Nimlos 522025）。"""
    length = 12.0
    graph = (
        f"[0:a]atrim=start=3.5:end={3.5 + length},asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,loudnorm=I=-18:TP=-2[wave];"
        f"[1:a]atrim=start=2.8:end={2.8 + length},asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,loudnorm=I=-20:TP=-2[surf];"
        f"[2:a]atrim=start=25.7:end={25.7 + length},asetpts=PTS-STARTPTS,lowpass=f=180,lowpass=f=180,aformat=channel_layouts=stereo,loudnorm=I=-22:TP=-2[boom];"
        "[wave][surf][boom]amix=inputs=3:normalize=0:duration=longest,"
        f"afade=t=in:d=0.25,afade=t=out:st={length - 4}:d=4,alimiter=limit=0.89,loudnorm=I=-16:TP=-1.5[out]"
    )
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(REDSEA / "468899.mp3"), "-i", str(REDSEA / "482856.mp3"), "-i", str(REDSEA / "522025.mp3"),
                    "-filter_complex", graph, "-map", "[out]", "-ar", "44100", "-b:a", "96k", str(dst)], check=True)


def main() -> None:
    total = 0
    crash = OUT / "sea-crash.mp3"
    build_sea_crash(crash)
    total += crash.stat().st_size
    print(f"[audio] sea-crash.mp3: {crash.stat().st_size} bytes")
    for out_name, src, ss, dur, af, br in JOBS:
        dst = OUT / out_name
        if ss == LOOP:
            start = build_loop(dst, src, af, br)
            sz = dst.stat().st_size
            total += sz
            print(f"[audio] {out_name}: 無縫循環 {LOOP_LEN:.0f} 秒，取自第 {start:.1f} 秒，{sz} bytes")
            continue
        cmd = [
            FFMPEG,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            str(ss),
            "-t",
            str(dur),
            "-i",
            str(src),
            "-ac",
            "1",
            "-ar",
            "24000",
            "-af",
            af,
            "-b:a",
            br,
            str(dst),
        ]
        subprocess.run(cmd, check=True)
        sz = dst.stat().st_size
        total += sz
        print(f"[audio] {out_name}: {sz} bytes")
    print(f"[audio] total = {total} bytes ({total / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
