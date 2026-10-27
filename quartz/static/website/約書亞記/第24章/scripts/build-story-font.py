"""Build/check the story-only Iansui subset, including its actual Unicode cmap."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError:
    # 部署環境沒有裝 fontTools：只讀檢查略過（字體成品已進版控），重建字體仍需要它。
    if '--check' in sys.argv:
        print('Story font check skipped: fontTools is not installed.')
        raise SystemExit(0)
    raise

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/assets/fonts/story-iansui.woff2'
RECEIPT = DEST.with_suffix('.json')

def story_chars():
    data = json.loads((ROOT / 'src/data/site.json').read_text(encoding='utf-8'))
    strings = ['0123456789:；，。！？「」『』（）・—– 書士你們不能事奉耶和華']
    def visit(value):
        if isinstance(value, str) and value in data['verseBlocks']:
            block = data['verseBlocks'][value]
            strings.append(value)
            strings.extend(line['text'] for line in block['lines'])
        elif isinstance(value, dict):
            for k, v in value.items():
                if k in ('text', 'headline') and isinstance(v, str):
                    strings.append(v)
                else:
                    visit(v)
        elif isinstance(value, list):
            for v in value:
                visit(v)
    for seg in data['segments']:
        for beat in seg['beats']:
            for key in ('verse', 'bgVerses', 'familyLines', 'compareRefs'):
                visit(beat.get(key))
    # The comparison includes the extra verse in Judges and both full columns.
    strings.extend(data['verses'][f'{book}{chapter}:{v}'] for book, chapter, verses in
                   [('書',24,range(28,32)), ('士',2,range(6,11))] for v in verses)
    return {ord(c) for c in ''.join(strings) if not c.isspace()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--source', type=Path, default=DEST.parent / 'Iansui-Regular.ttf')
    args = parser.parse_args()
    wanted = story_chars()
    if not args.check:
        options = subset.Options()
        options.flavor = 'woff2'
        options.name_IDs = ['*']
        font = subset.load_font(str(args.source), options)
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=wanted)
        sub.subset(font)
        # This is a modified subset; retain copyright/license and use a distinct family.
        replacements = {
            1: 'JOS Story',
            4: 'JOS Story Regular',
            6: 'JOSStory-Regular',
            16: 'JOS Story',
        }
        for record in font['name'].names:
            if record.nameID in replacements:
                record.string = replacements[record.nameID].encode(record.getEncoding())
        subset.save_font(font, str(DEST), options)
        RECEIPT.write_text(json.dumps({'source': 'https://github.com/ButTaiwan/iansui/releases/tag/v1.020',
            'version': '1.020', 'license': 'SIL OFL 1.1', 'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
            'characters': len(wanted), 'codepoints': sorted(wanted),
            'bytes': DEST.stat().st_size, 'sha256': hashlib.sha256(DEST.read_bytes()).hexdigest()}, indent=2)+'\n', encoding='utf-8')
    font = TTFont(DEST)
    missing = wanted - set(font.getBestCmap())
    if missing:
        raise SystemExit('Missing story glyphs: '+''.join(chr(c) for c in sorted(missing)))
    receipt = json.loads(RECEIPT.read_text(encoding='utf-8'))
    if receipt['sha256'] != hashlib.sha256(DEST.read_bytes()).hexdigest():
        raise SystemExit('Font receipt hash mismatch')
    print(f'Story font PASS: {len(wanted)} characters, {DEST.stat().st_size} bytes, missing=0')

if __name__ == '__main__':
    main()
