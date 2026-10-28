"""從 collect/audio/bgm-candidates/ 與 bgm-more/raw/（OpenGameArt，皆為 CC0）裁出配樂，做成無縫循環的 MP3，輸出至 src/assets/music/。

每首取一段，頭尾以等功率交叉淡化接成可無限循環的檔案，響度統一到 -22 LUFS（程式播放時再乘上音量）。
來源與授權見 素材來源.md〈配樂〉；來源檔不進版控，成品進版控，部署環境不需要重做。
"""
from __future__ import annotations
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "collect" / "audio" / "bgm-candidates"
MORE = ROOT / "collect" / "audio" / "bgm-more" / "raw"
OUT = ROOT / "src" / "assets" / "music"
OUT.mkdir(parents=True, exist_ok=True)

FFMPEG = os.environ.get("FFMPEG_BIN", "ffmpeg")
FADE = 3.0  # 頭尾交叉淡化秒數

# (輸出檔名, 來源檔, 起始秒, 長度秒)
TRACKS = [
    ("ruins", "ruins_of_an_ancient_culture_.wav", 0.0, 75.0),
    ("plains", "sunset_plains.wav", 30.0, 120.0),
    ("hope", "hope.mp3", 10.0, 120.0),
    # 2026-10-27 使用者試聽 65 首候選後選定；collect/audio/ 只留這幾首的原檔
    ("epic", str(MORE / "epic-endgame-cinematic" / "ChoirChordsBassMaster.wav"), 4.0, 84.0),
    ("pursuit", str(MORE / "determined-pursuit-epic-orchestra-loop" / "determined_pursuit_loop.wav"), 0.0, 108.0),
    ("waiting", str(MORE / "waiting-ii" / "Waiting II_0.ogg"), 2.0, 94.0),
    ("expansion", str(MORE / "unexplored-expansion" / "tad_-_unexplored_-_expanded_1_by_bo_jingles_0.mp3"), 0.5, 87.0),
    ("firstlight", str(MORE / "first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track" / "first_light_particles_0.wav"), 1.0, 122.0),
]


def build(name: str, source: str, start: float, length: float) -> None:
    n, end = FADE, start + length
    graph = (
        f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,"
        "aformat=sample_rates=44100:channel_layouts=stereo,asplit=3[a][b][c];"
        f"[a]atrim=0:{n},asetpts=PTS-STARTPTS,afade=t=in:d={n}:curve=qsin[head];"
        f"[b]atrim={n}:{length - n},asetpts=PTS-STARTPTS[mid];"
        f"[c]atrim={length - n}:{length},asetpts=PTS-STARTPTS,afade=t=out:d={n}:curve=qsin[tail];"
        "[head][tail]amix=inputs=2:normalize=0:duration=longest[x];"
        "[mid][x]concat=n=2:v=0:a=1,loudnorm=I=-22:TP=-2:LRA=11[out]"
    )
    target = OUT / f"{name}.mp3"
    subprocess.run(
        [FFMPEG, "-v", "error", "-y", "-i", str(SRC / source), "-filter_complex", graph,
         "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "80k", "-ar", "44100", str(target)],
        check=True,
    )
    print(f"{name}: {target.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    for track in TRACKS:
        build(*track)
