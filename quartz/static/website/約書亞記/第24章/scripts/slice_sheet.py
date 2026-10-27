"""角色表切片：python -I scripts/slice_sheet.py（或 --sheet FILE --role NAME --poses stand,walk-1）。

沿白色空隙分列、分欄；透明原圖保留 alpha。共用 key_layers.key_white。
正式表的 mapping 可寫 {"sheet":"名稱","index":0,"head":[x,y],"foot":[x,y]}。
錨點用輸出 PNG 的像素座標，原點在左上；可明確覆寫頭頂／腳底。
"""
import argparse
import importlib.util
import json
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("jos_key", ROOT / "scripts/key_layers.py")
key = importlib.util.module_from_spec(spec)
spec.loader.exec_module(key)


def keyed(path, mode="white"):
    im = Image.open(path).convert("RGBA")
    if mode == "alpha":
        return im
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    col, alpha = key.key_white(rgb)
    return Image.fromarray(np.dstack((col, alpha)).__mul__(255).round().astype(np.uint8))


def runs(mask, gap=6):
    indices = np.flatnonzero(mask)
    if not len(indices):
        return []
    breaks = np.flatnonzero(np.diff(indices) > gap) + 1
    return [(int(g[0]), int(g[-1]) + 1) for g in np.split(indices, breaks)]


def split_sheet(im, regions=None):
    if regions:
        width, height = im.size
        result = []
        for x0, y0, x1, y1 in regions:
            if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
                raise ValueError(f"角色表裁切框超出圖片範圍: {(x0, y0, x1, y1)} / {(width, height)}")
            result.append(im.crop((x0, y0, x1, y1)))
        return result
    a = np.asarray(im)[..., 3] > 100
    result = []
    for y0, y1 in runs(a.sum(axis=1) > 2):
        for x0, x1 in runs(a[y0:y1].sum(axis=0) > 2):
            if x1 - x0 >= 12 and y1 - y0 >= 30:
                result.append(im.crop((x0, y0, x1, y1)))
    return result


def trimmed(im):
    a = np.asarray(im)[..., 3]
    yy, xx = np.where(a > 80)
    if len(xx) == 0:
        raise ValueError("切片沒有可見人物")
    return im.crop((int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1))


def main_component(im):
    """暫代裁框清除鄰近人物的碎片；正式群組角色表不套此步。"""
    rgba = np.array(im)
    mask = rgba[..., 3] > 80
    seen = np.zeros(mask.shape, dtype=bool)
    best = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        q = deque([(int(y), int(x))])
        seen[y, x] = True
        component = []
        while q:
            cy, cx = q.popleft()
            component.append((cy, cx))
            for ny, nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx] = True
                    q.append((ny,nx))
        if len(component) > len(best):
            best = component
    keep = np.zeros(mask.shape, dtype=bool)
    if best:
        yy, xx = zip(*best)
        keep[yy,xx] = True
    # 1px 外擴保留抗鋸齒 alpha，不把剪影輪廓變成硬邊。
    padded = np.pad(keep, 1)
    keep = np.logical_or.reduce([padded[dy:dy+mask.shape[0],dx:dx+mask.shape[1]] for dy in range(3) for dx in range(3)])
    rgba[~keep,3] = 0
    return Image.fromarray(rgba)


def export(role, pose, im, override=None):
    im = trimmed(im)
    # 所有切片腳底同在 y=height-4；透明 padding 避免 atlas 滲邊。
    scale = min(1, 480 / im.height, 380 / im.width)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (im.width + 8, im.height + 8))
    out.paste(im, (4, 4))
    a = np.asarray(out)[..., 3]
    yy, xx = np.where(a > 100)
    top = int(yy.min())
    head_x = float(np.median(np.where(a[top:top + max(3, im.height // 20)] > 100)[1]))
    bottom = int(yy.max())
    foot_x = float(np.median(np.where(a[max(top, bottom - 5):bottom + 1] > 100)[1]))
    dest = ROOT / "src/assets/figures" / role / f"{pose}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, optimize=True)
    data = {"file": f"{role}/{pose}.png", "width": out.width, "height": out.height,
            "head": [head_x, top], "foot": [foot_x, bottom + 1]}
    for name in ("head", "foot"):
        if override and name in override:
            data[name] = override[name]
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet")
    parser.add_argument("--role")
    parser.add_argument("--poses")
    args = parser.parse_args()
    entries = {}
    dest = ROOT / "src/assets/figures/figures.json"
    if args.sheet:
        poses = args.poses.split(",")
        slices = split_sheet(keyed(args.sheet))
        if len(slices) != len(poses):
            raise ValueError(f"切片 {len(slices)} 張，姿勢 {len(poses)} 個，請檢查白色間隔")
        if dest.exists():
            entries = json.loads(dest.read_text(encoding="utf-8"))["figures"]
        for pose, im in zip(poses, slices):
            entries[f"{args.role}/{pose}"] = export(args.role, pose, im)
    else:
        config = json.loads((ROOT / "scripts/figure-sources.json").read_text(encoding="utf-8"))
        sheets = {k: keyed(ROOT / v["path"], v.get("key", "white")) for k, v in config["sheets"].items()}
        cuts = {k: main_component(sheets[v["sheet"]].crop(v["box"])) for k, v in config["cuts"].items()}
        for role, poses in config["roles"].items():
            for pose, source in poses.items():
                if isinstance(source, str):
                    im = cuts[source]
                else:
                    sheet = sheets[source["sheet"]]
                    regions = config["sheets"][source["sheet"]].get("regions")
                    im = split_sheet(sheet, regions)[source["index"]]
                entries[f"{role}/{pose}"] = export(role, pose, im, source if isinstance(source, dict) else None)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"version": 1, "figures": entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"figures: {len(entries)}, anchors: {len(entries) * 2}")


if __name__ == "__main__":
    main()
