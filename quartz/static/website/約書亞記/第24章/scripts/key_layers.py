"""把 Gemini 生成的白底或洋紅底圖層去背成透明 PNG。

用法：python -I scripts/key_layers.py <white|magenta> <輸入圖> <輸出.png>
- white：白底。以最暗的色版推透明度，再把白色從半透明邊緣扣掉（剪影、水墨雲用）。
- magenta：#FF00FF 色鍵底。以「洋紅程度」推透明度，並把邊緣的洋紅溢色壓掉（帶白浪花的水、戰車用）。
"""
import argparse

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def key_white(rgb):
    a = 1.0 - rgb.min(axis=2) / 255.0
    a = np.clip((a - 0.04) / 0.92, 0, 1)
    safe = np.maximum(a, 1e-3)[..., None]
    col = (rgb / 255.0 - (1 - safe)) / safe
    return np.clip(col, 0, 1), a


def key_magenta(rgb):
    r, g, b = rgb[..., 0] / 255.0, rgb[..., 1] / 255.0, rgb[..., 2] / 255.0
    m = np.minimum(r, b) - g
    a = 1.0 - np.clip((m - 0.18) / (0.62 - 0.18), 0, 1)
    spill = np.clip(m, 0, None)
    col = np.stack([r - spill, g, b - spill], axis=2)
    return np.clip(col, 0, 1), a


def flatten_silhouette(col, a, edge_px=5, threshold=0.14):
    """壓暗剪影內部，保留距透明外緣五像素內的暖光。"""
    mask = Image.fromarray(((a > 0.02) * 255).astype(np.uint8))
    # 內部透明孔不算外緣；細小亮點與衣褶也應壓暗。
    mask = mask.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11))
    ImageDraw.floodfill(mask, (0, 0), 128, thresh=0)
    mask = Image.fromarray(((np.asarray(mask) != 128) * 255).astype(np.uint8))
    interior = np.asarray(mask.filter(ImageFilter.MinFilter(edge_px * 2 + 1))) / 255.0
    luminance = col @ np.array([0.2126, 0.7152, 0.0722])
    weight = interior * np.clip(luminance / threshold, 0, 1)
    ink = np.array([20, 16, 20]) / 255.0
    return col * (1 - weight[..., None]) + ink * weight[..., None]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['white', 'magenta'])
    parser.add_argument('src')
    parser.add_argument('dst')
    parser.add_argument('--flatten', action='store_true')
    parser.add_argument('--edge-px', type=int, choices=range(3, 7), default=5)
    parser.add_argument('--rim-threshold', type=float, default=0.14)
    args = parser.parse_args()
    mode, src, dst = args.mode, args.src, args.dst
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    col, a = (key_white if mode == "white" else key_magenta)(rgb)
    if args.flatten:
        col = flatten_silhouette(col, a, args.edge_px, args.rim_threshold)
    out = np.dstack([col, a]) * 255.0
    Image.fromarray(out.round().astype(np.uint8), "RGBA").save(dst, optimize=True)
    printable_dst = str(dst).encode("ascii", "backslashreplace").decode("ascii")
    print(printable_dst, f"opaque={float((a > 0.5).mean()):.3f}")


if __name__ == "__main__":
    main()
