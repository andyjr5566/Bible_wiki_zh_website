"""Prepare compact WebP environment assets from the site's existing renders."""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "lab/assets-codex/shechem-env"
RENDER = ROOT / "lab/renders/shechem"
WORK = RENDER / "_work/keyed-env"
DEST = ROOT / "src/assets/shechem-env"
KEY_SCRIPT = ROOT / "scripts/key_layers.py"
TIMES = ("dawn", "morning", "afternoon", "dusk", "night")
BUDGET = 5_000_000


def save_webp(image, target, max_edge, quality, **options):
    image = image.copy()
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    image.save(target, "WEBP", quality=quality, method=6, exact=True, **options)
    return image.size, target.stat().st_size


def keyed_image(name, max_edge, quality):
    source = SOURCE / (name + ".png")
    keyed = WORK / (name + "-keyed.png")
    subprocess.run(
        [sys.executable, "-I", str(KEY_SCRIPT), "white", str(source), str(keyed)],
        check=True,
        cwd=ROOT,
    )
    image = Image.open(keyed).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 5 else 0).getbbox()
    if bbox:
        pad = 12
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(image.width, bbox[2] + pad), min(image.height, bbox[3] + pad))
        image = image.crop(bbox)
    size, byte_count = save_webp(
        image, DEST / (name + ".webp"), max_edge, quality,
        lossless=False, alpha_quality=96,
    )
    return {"source": str(source.relative_to(ROOT)).replace("\\", "/"),
            "size": list(size), "bytes": byte_count, "key": "white"}


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    ledger = {}
    for time_name in TIMES:
        source = RENDER / ("composite-" + time_name + ".png")
        image = Image.open(source).convert("RGB")
        size, byte_count = save_webp(image, DEST / (time_name + ".webp"), 4096, 80)
        ledger[time_name + ".webp"] = {
            "source": str(source.relative_to(ROOT)).replace("\\", "/"),
            "size": list(size), "bytes": byte_count, "layers": "sky+hills composite",
        }

    for name in ("oak", "oak-night"):
        ledger[name + ".webp"] = keyed_image(name, 1024, 80)
    ledger["stone-lying.webp"] = keyed_image("stone-lying", 960, 80)
    ledger["stone-standing.webp"] = keyed_image("stone-standing", 960, 80)

    texture_src = SOURCE / "stone-texture.png"
    texture = Image.open(texture_src).convert("RGB")
    size, byte_count = save_webp(texture, DEST / "stone-texture.webp", 768, 78)
    ledger["stone-texture.webp"] = {
        "source": str(texture_src.relative_to(ROOT)).replace("\\", "/"),
        "size": list(size), "bytes": byte_count, "tileable": True,
    }

    total = sum(item["bytes"] for item in ledger.values())
    manifest = {"total_bytes": total, "budget_bytes": BUDGET, "assets": ledger}
    (DEST / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(ledger)} WebP; {total:,} bytes / {BUDGET:,}")
    for name, item in ledger.items():
        print(f"{name}: {item['bytes']:,} bytes, {item['size'][0]}x{item['size'][1]}")
    if total > BUDGET:
        raise SystemExit("Shechem environment WebP budget exceeded")


if __name__ == "__main__":
    main()
