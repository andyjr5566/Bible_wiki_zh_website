"""Check opaque cores of person cutouts used by the second-act stations."""
import json
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    # 部署環境沒有 numpy／Pillow：這是本機素材檢查，略過不擋建置。
    print('Person alpha check skipped: numpy and Pillow are not installed.')
    raise SystemExit(0)

ROOT = Path(__file__).resolve().parent.parent
THRESHOLD = 0.9
OPAQUE_ALPHA = 230
EDGE_PX = 6
EFFECT_EXEMPTIONS = {
    'water-left.webp': '水牆與水沫',
    'water-right.webp': '水牆與水沫',
    'redsea-sea.webp': '水面',
    'darkness.webp': '黑雲與霧氣',
}
COMPOSITE_EFFECTS = {
    'crossing.webp': '水面倒影不列入人物主體遮罩',
    'battle.webp': '戰場塵霧不列入人物主體遮罩',
}


def inner_mask(source: Image.Image, key: str | None, target_size: tuple[int, int]) -> np.ndarray:
    source = source.convert('RGBA')
    if key == 'white':
        rgb = np.asarray(source.convert('RGB')).astype(np.float32)
        luminance = rgb @ np.array([0.2126, 0.7152, 0.0722])
        mask = Image.fromarray((luminance < 96).astype(np.uint8) * 255, 'L')
    else:
        alpha = np.asarray(source.getchannel('A'))
        mask = Image.fromarray((alpha > 16).astype(np.uint8) * 255, 'L')
    if source.size != target_size:
        mask = mask.resize(target_size, Image.Resampling.NEAREST)
    return np.asarray(mask.filter(ImageFilter.MinFilter(EDGE_PX * 2 + 1))) > 0


def main() -> None:
    stations = json.loads((ROOT / 'src/data/stations.json').read_text(encoding='utf-8'))
    ledger = json.loads((ROOT / 'src/assets/stations/sources.json').read_text(encoding='utf-8'))
    figures = {}
    for station in stations:
        for layer in station['layers']:
            if layer['role'] in ('person', 'coffin'):
                figures[layer['asset']] = layer['role']

    failures = []
    results = []
    for asset, role in sorted(figures.items()):
        record = ledger[asset]
        output = Image.open(ROOT / 'src/assets/stations' / asset).convert('RGBA')
        source_path = ROOT / record['source']
        # lab/ 是本機素材工作區（數 GB，不進版控）；部署 CI 沒有它時，改用成品自己的輪廓當主體遮罩。
        if source_path.exists():
            mask = inner_mask(Image.open(source_path), record.get('key'), output.size)
        else:
            mask = inner_mask(output, None, output.size)
            if asset in COMPOSITE_EFFECTS:
                # 塵霧與倒影本來就半透明；沒有原圖可分主體時，只量明顯不透明的部分。
                solid = Image.fromarray((np.asarray(output.getchannel('A')) > 128).astype(np.uint8) * 255, 'L')
                mask = np.asarray(solid.filter(ImageFilter.MinFilter(EDGE_PX * 2 + 1))) > 0
        if asset == 'crossing.webp':
            mask[int(output.height * 0.76):, :] = False
        count = int(mask.sum())
        alpha = np.asarray(output.getchannel('A'))
        ratio = float(((alpha >= OPAQUE_ALPHA) & mask).sum() / count) if count else 0.0
        results.append((asset, role, ratio, count))
        if count == 0 or ratio < THRESHOLD:
            failures.append(f'{asset}: opaque core {ratio:.3f} < {THRESHOLD:.2f} ({count} px)')

    print(f'Person alpha: {len(results)} assets; threshold >= {THRESHOLD:.2f}; eroded {EDGE_PX}px.')
    for asset, role, ratio, count in results:
        print(f'  {asset} [{role}] {ratio:.3f} ({count:,} px)')
    print('Effect exemptions: ' + '; '.join(EFFECT_EXEMPTIONS))
    print('Composite effect masks: ' + '; '.join(COMPOSITE_EFFECTS))
    if failures:
        raise SystemExit('\n'.join(failures))
    print('alpha gate PASS')


if __name__ == '__main__':
    main()
