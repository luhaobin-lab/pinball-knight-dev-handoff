# Subset Fusion Pixel 12px (proportional, zh_hans) to ASCII + every char in the Demo's zh-Hans strings
# + the art bible's in-world vocabulary. Writes the woff2 and a charset report.
# usage: python -I subset_font.py <src.woff2> <out.woff2> <charset_out.txt>
import json, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
sys.stdout.reconfigure(encoding='utf-8')
src, out, charset_out = sys.argv[1:4]
loc = json.load(open('D:/cindy-scratch/ra-loc/Game.zh-Hans.json', encoding='utf-8'))
chars = set(chr(c) for c in range(0x20, 0x7F))
for ns in loc.values():
    for s in ns.values():
        chars.update(s)
bible = ''
for f in ['D:/TAPTAPGAME_design/studio/ART_BIBLE.md', 'D:/TAPTAPGAME_ref/artbible/ART_BIBLE.md']:
    if os.path.exists(f):
        bible += open(f, encoding='utf-8').read()
extra = set(c for c in bible if ord(c) >= 0x3000) | set('「」『』《》【】〔〕…—·•、。，！？：；（）～％＋－×÷')
chars |= extra
chars -= set('\r\n\t\u200b\u200c\u200d\ufeff')
font = TTFont(src)
cmap = font.getBestCmap()
have = sorted(c for c in chars if ord(c) in cmap)
missing = sorted(c for c in chars if ord(c) not in cmap)
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']
opts.name_languages = ['*']
opts.notdef_outline = True
opts.hinting = False
sub = subset.Subsetter(opts)
sub.populate(unicodes=[ord(c) for c in have])
sub.subset(font)
font.flavor = 'woff2'
font.save(out)
open(charset_out, 'w', encoding='utf-8').write(''.join(have))
print('chars', len(chars), 'in font', len(have), 'missing', len(missing), ''.join(missing))
