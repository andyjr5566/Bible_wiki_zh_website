"""共用 atlas；相同暫代切片去重，透明邊界留 4px，不會取到隔壁人物。"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/assets/figures"
data = json.loads((DEST / "figures.json").read_text(encoding="utf-8"))
images = {name: Image.open(DEST / frame["file"]).convert("RGBA") for name, frame in data["figures"].items()}
size = 2048
for attempt in range(12):
    unique, packed = {}, {}
    x, y, row_h = 4, 4, 0
    atlas = Image.new("RGBA", (size, size))
    fits = True
    for name, frame in data["figures"].items():
        im = images[name]
        digest = hashlib.sha256(im.tobytes() + str(im.size).encode()).hexdigest()
        if digest not in unique:
            if x + im.width + 4 > size:
                x, y, row_h = 4, y + row_h + 4, 0
            if y + im.height + 4 > size:
                fits = False
                break
            atlas.paste(im, (x, y))
            unique[digest] = [x / size, 1 - (y + im.height) / size, im.width / size, im.height / size]
            x += im.width + 4
            row_h = max(row_h, im.height)
        packed[name] = {**frame, "uv": unique[digest]}
    if fits:
        atlas.save(DEST / "atlas.webp", lossless=True, method=6)
        total = sum(p.stat().st_size for p in DEST.rglob("*") if p.suffix in (".png", ".webp"))
        if total <= 4_000_000:
            break
    # 正式表到齊時自動縮小，連同錨點與切片一起重算；保持單張圖集與 4 MB 預算。
    for name, frame in data["figures"].items():
        im = images[name]
        w, h = max(16, round(im.width * .85)), max(16, round(im.height * .85))
        resized = im.resize((w, h), Image.Resampling.LANCZOS)
        sx, sy = w / im.width, h / im.height
        frame["head"] = [frame["head"][0] * sx, frame["head"][1] * sy]
        frame["foot"] = [frame["foot"][0] * sx, frame["foot"][1] * sy]
        bbox = resized.getchannel("A").getbbox()
        if bbox:
            left, top, right, bottom = bbox
            pad_left, pad_top = max(0, 4 - left), max(0, 4 - top)
            pad_right, pad_bottom = max(0, 4 - (w - right)), max(0, 4 - (h - bottom))
        else:
            pad_left = pad_top = pad_right = pad_bottom = 0
        padded = Image.new("RGBA", (w + pad_left + pad_right, h + pad_top + pad_bottom))
        padded.paste(resized, (pad_left, pad_top))
        frame["head"] = [frame["head"][0] + pad_left, frame["head"][1] + pad_top]
        frame["foot"] = [frame["foot"][0] + pad_left, frame["foot"][1] + pad_top]
        frame["width"], frame["height"] = padded.size
        images[name] = padded
        padded.save(DEST / frame["file"], optimize=True)
else:
    raise ValueError("人物貼圖無法在 2048 圖集與 4 MB 預算內容納，請檢查角色表數量")
(DEST / "figures.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(DEST / "atlas.json").write_text(json.dumps({"size": size, "frames": packed}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
# Copy only into src; the shared render directory is read-only for this task.
Image.open(ROOT / "lab/renders/layers/ford/sky.png").convert("RGB").resize((1280, 720), Image.Resampling.LANCZOS).save(ROOT / "src/assets/shechem-sky.webp", quality=84)
print(f"atlas unique: {len(unique)}, textures: {total} bytes / 4000000")
