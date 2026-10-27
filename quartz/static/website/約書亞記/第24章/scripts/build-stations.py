"""只讀既有圖層；產生十一站 WebP 與可重建的來源帳。"""
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('key_layers', ROOT / 'scripts/key_layers.py')
key = importlib.util.module_from_spec(spec)
spec.loader.exec_module(key)


def main():
    stations = json.loads((ROOT / 'src/data/stations.json').read_text(encoding='utf-8'))
    dest = ROOT / 'src/assets/stations'
    dest.mkdir(parents=True, exist_ok=True)
    ledger = {}
    for station in stations:
        for layer in station['layers']:
            source = layer['source']
            output = layer['asset']
            if output in ledger:
                continue
            image = Image.open(ROOT / source).convert('RGBA')
            mode = layer.get('key')
            if mode:
                rgb = np.asarray(image.convert('RGB')).astype(np.float32)
                col, alpha = (key.key_white if mode == 'white' else key.key_magenta)(rgb)
                if layer['role'] in ('person', 'coffin') and mode == 'white':
                    luminance = rgb @ np.array([0.2126, 0.7152, 0.0722])
                    solid = luminance < 96
                    if output == 'crossing.webp':
                        solid[int(image.height * 0.76):, :] = False
                    alpha = np.where(solid, np.maximum(alpha, 0.97), alpha)
                col = key.flatten_silhouette(col, alpha)
                image = Image.fromarray((np.dstack([col, alpha]) * 255).round().astype(np.uint8))
            if output == 'jericho-magenta.webp':
                # Keep the city silhouette but trim the dark foreground mound so
                # the wall feet sit on the distant river shore.
                edge = [(0.0, 0.85), (0.08, 0.84), (0.2, 0.835), (0.3, 0.82),
                        (0.38, 0.75), (0.42, 0.68), (0.46, 0.62), (0.5, 0.6),
                        (0.56, 0.59), (0.62, 0.59), (0.68, 0.59), (0.74, 0.59),
                        (0.8, 0.59), (0.87, 0.595), (0.92, 0.6), (0.96, 0.61),
                        (1.0, 0.66)]
                rgba = np.asarray(image.convert('RGBA')).copy()
                keep = Image.new('L', image.size, 0)
                draw = ImageDraw.Draw(keep)
                ridge = [(round(x * (image.width - 1)), round(y * (image.height - 1))) for x, y in edge]
                draw.polygon([(0, 0), (image.width - 1, 0), *reversed(ridge)], fill=255)
                alpha_clip = np.asarray(keep.filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
                rgba[..., 3] = (rgba[..., 3].astype(np.float32) * alpha_clip).round().astype(np.uint8)
                image = Image.fromarray(rgba)
            if output == 'battle.webp':
                rgba = np.asarray(image.convert('RGBA')).copy()
                rgb = np.asarray(Image.open(ROOT / source).convert('RGB')).astype(np.float32)
                luminance = rgb @ np.array([0.2126, 0.7152, 0.0722])
                y = np.arange(image.height, dtype=np.float32)[:, None] / max(1, image.height - 1)
                x = np.arange(image.width, dtype=np.float32)[None, :] / max(1, image.width - 1)
                dust_fade = np.clip((0.69 - y) / 0.09, 0, 1)
                side_fade = np.clip(x / 0.06, 0, 1) * np.clip((1 - x) / 0.06, 0, 1)
                solid_people = luminance < 96
                rgba[..., 3] = np.where(
                    solid_people,
                    rgba[..., 3],
                    (rgba[..., 3].astype(np.float32) * 0.34 * dust_fade * side_fade).round(),
                ).astype(np.uint8)
                image = Image.fromarray(rgba)
            image.thumbnail((1440, 810), Image.Resampling.LANCZOS)
            target = dest / output
            image.save(target, 'WEBP', quality=80, method=6, exact=True)
            ledger[output] = {'source': source, 'key': mode, 'flatten': bool(mode),
                              'bytes': target.stat().st_size, 'size': list(image.size),
                              'bounds': list(image.getbbox() or (0, 0, 0, 0))}
    (dest / 'sources.json').write_text(json.dumps(ledger, indent=2) + '\n', encoding='utf-8')
    total = sum(x['bytes'] for x in ledger.values())
    if total > 15_000_000:
        raise ValueError(f'Layer budget exceeded: {total}')
    print(f'{len(stations)} stations; {len(ledger)} WebP; {total:,} bytes / 15,000,000')


if __name__ == '__main__':
    main()
