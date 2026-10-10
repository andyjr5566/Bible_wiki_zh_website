#!/usr/bin/env python3
# 把「七的節奏」漩渦上的字，用一點明體（I.Ming）Regular 預先畫成一張白字透明底的圖集：
#   src/scene/vortex-glyphs.png   圖集（白字、透明底）
#   src/scene/vortex-glyphs.json  每個字串在圖集裡的矩形（順序：6 個標籤、6 行大字）與繪製字高
# 字串來源：src/scene/vortex-strings.json（vortex-text.ts 也讀同一份，不手抄兩份）。
#
# 授權：一點明體是 IPA Font License v1.0。從字型抽子集等於「派生程式」，有改名、附授權等義務，
# 所以字型檔與子集都不進版控、不嵌進網站；只把用字型畫出的圖片（數位內容）放進網站。
#
# 用法：python tools/build-vortex-glyphs.py [字型路徑]      （或設環境變數 IMING_FONT）
# 字型下載：https://github.com/ichitenfont/I.Ming/raw/master/8.10/I.Ming-8.10.ttf
# 需要 Pillow：pip install Pillow
import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('需要 Pillow：pip install Pillow')

root = Path(__file__).resolve().parent.parent
font_path = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('IMING_FONT', ''))
if not font_path.is_file():
    sys.exit('找不到一點明體字型檔。請從 https://github.com/ichitenfont/I.Ming/raw/master/8.10/I.Ming-8.10.ttf 下載，\n'
             '再用 python tools/build-vortex-glyphs.py <路徑> 或設環境變數 IMING_FONT 指定（字型檔不要放進專案）。')

LABEL_PX = 64   # 標籤的繪製字高（縮小時才清楚）
BIG_PX = 112    # 大字的繪製字高
MARGIN = 4

strings = json.loads((root / 'src/scene/vortex-strings.json').read_text(encoding='utf-8'))
items = [(s, LABEL_PX) for s in strings['ringLabels']] + [(s, BIG_PX) for s in strings['bigLines']]

fonts = {px: ImageFont.truetype(str(font_path), px) for px in {LABEL_PX, BIG_PX}}
rects = []
y = 0
width = 1
for text, px in items:
    f = fonts[px]
    asc, desc = f.getmetrics()
    w = int(f.getlength(text) + 0.999) + MARGIN * 2
    h = asc + desc + MARGIN * 2
    rects.append({'x': 0, 'y': y, 'w': w, 'h': h, 'base': MARGIN + asc, 'px': px})
    y += h
    width = max(width, w)

img = Image.new('RGBA', (width, y), (255, 255, 255, 0))
d = ImageDraw.Draw(img)
for (text, px), r in zip(items, rects):
    d.text((r['x'] + MARGIN, r['y'] + r['base']), text, font=fonts[px], fill=(255, 255, 255, 255), anchor='ls')

out_png = root / 'src/scene/vortex-glyphs.png'
img.save(out_png, optimize=True)
(root / 'src/scene/vortex-glyphs.json').write_text(
    json.dumps({'labelPx': LABEL_PX, 'bigPx': BIG_PX, 'width': width, 'height': y, 'rects': rects}, ensure_ascii=False, indent=1) + '\n',
    encoding='utf-8')
print(f'{out_png}  {width}x{y}  {out_png.stat().st_size // 1024} KB')
