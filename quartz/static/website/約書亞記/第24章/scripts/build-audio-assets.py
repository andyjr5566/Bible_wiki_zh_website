"""從 collect/audio/ (Freesound CC0) 裁切並壓縮網站內嵌音效至 src/assets/audio/。

所有來源皆為 collect/audio/audio-candidates.md 驗證之 Creative Commons 0 錄音與後製檔；
為配合 vite-plugin-singlefile 單一 HTML 封裝，環境循環音裁切為 10 秒無縫淡入淡出單聲道 48kbps MP3，
單次事件音保留完整瞬態。絕不使用 Web Audio 合成環境音。
"""

from __future__ import annotations
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAND = ROOT / "collect" / "audio" / "candidates"
PROC = ROOT / "collect" / "audio" / "processed"
OUT = ROOT / "src" / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

FFMPEG = os.environ.get(
    "FFMPEG_BIN",
    r"C:\Users\andyj_adknr2z\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe",
)
if not Path(FFMPEG).exists():
    FFMPEG = "ffmpeg"

JOBS = [
    # (輸出檔名, 來源路徑, 起始秒, 長度秒, 濾鏡鏈, 位元率)
    (
        "valley-wind.mp3",
        CAND / "valley-wind-1-553733.mp3",
        12.0,
        10.5,
        "highpass=f=70,lowpass=f=2600,afade=t=in:st=0:d=1.2,afade=t=out:st=9.3:d=1.2,volume=0.85",
        "48k",
    ),
    (
        "oak-leaves.mp3",
        CAND / "oak-leaves-1-435206.mp3",
        26.0,
        10.0,
        "highpass=f=220,lowpass=f=5000,afade=t=in:st=0:d=1.1,afade=t=out:st=8.9:d=1.1,volume=0.80",
        "48k",
    ),
    (
        "river.mp3",
        PROC / "river-processed-1.mp3",
        10.0,
        10.0,
        "lowpass=f=3600,afade=t=in:st=0:d=1.1,afade=t=out:st=8.9:d=1.1,volume=0.82",
        "48k",
    ),
    (
        "sea-wind.mp3",
        CAND / "sea-wind-3-447623.mp3",
        20.0,
        10.5,
        "lowpass=f=3200,afade=t=in:st=0:d=1.2,afade=t=out:st=9.3:d=1.2,volume=0.85",
        "48k",
    ),
    (
        "sea-close.mp3",
        PROC / "sea-close-processed-1.mp3",
        0.0,
        4.0,
        "lowpass=f=3400,afade=t=out:st=3.1:d=0.9,volume=0.88",
        "48k",
    ),
    (
        "desert-wind.mp3",
        CAND / "desert-wind-1-827840.mp3",
        18.0,
        10.0,
        "highpass=f=90,lowpass=f=2500,afade=t=in:st=0:d=1.1,afade=t=out:st=8.9:d=1.1,volume=0.82",
        "48k",
    ),
    (
        "crowd-murmur.mp3",
        PROC / "crowd-murmur-processed-1.mp3",
        8.0,
        9.5,
        "highpass=f=120,lowpass=f=620,afade=t=in:st=0:d=1.1,afade=t=out:st=8.4:d=1.1,volume=0.65",
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


def main() -> None:
    total = 0
    for out_name, src, ss, dur, af, br in JOBS:
        dst = OUT / out_name
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
