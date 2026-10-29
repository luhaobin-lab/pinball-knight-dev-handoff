"""Optional review-sheet fonts. Asset conversion does not require a system font."""
import os
from pathlib import Path
from PIL import ImageFont


def review_font(size):
    candidates = [
        os.environ.get('ICON_FONT', ''),
        str(Path(__file__).resolve().parents[1] / 'references/review-font.ttf'),
        '/System/Library/Fonts/PingFang.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
        'C:/Windows/Fonts/msyh.ttc',
        'DejaVuSans.ttf',
    ]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)
