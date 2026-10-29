"""Re-export saved mothers without a generation service; compare or write PNGs."""
from pathlib import Path
import argparse
import hashlib
import io
import json
import sys
from PIL import Image
from study_pixelize import fit_premultiplied, quantize

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--verify-only', action='store_true', help='Convert in memory and compare all output hashes; never replace PNGs.')
    mode.add_argument('--write', action='store_true', help='Rebuild PNGs from the exact saved release mothers.')
    parser.add_argument('--id', action='append', dest='ids', help='Limit to one or more stable IDs.')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    records = manifest['icons']
    if args.ids:
        unknown = set(args.ids) - {r['id'] for r in records}
        if unknown:
            parser.error('Unknown IDs: ' + ', '.join(sorted(unknown)))
        records = [r for r in records if r['id'] in args.ids]
    missing = [r['id'] for r in records if not (ROOT / r['mother']).is_file()]
    if missing:
        print('缺少母稿：' + ', '.join(missing[:12]) + (' …' if len(missing) > 12 else ''), file=sys.stderr)
        print('请下载 GitHub Release handoff-2026-10-29 中的 icon-mothers.zip，将 mothers/ 解压到 art/icons-v6/。已有 PNG、图集与 index.html 可独立使用。', file=sys.stderr)
        return 2
    mismatches = []
    verified = 0
    # Check every selected mother before writing any output.
    for record in records:
        receipt = json.loads((ROOT / 'receipts' / (record['id'] + '.json')).read_text())
        if hashlib.sha256((ROOT / record['mother']).read_bytes()).hexdigest() != receipt['motherSha256']:
            mismatches.append(record['id'] + ': mother hash differs from the release receipt')
    if mismatches:
        print('\n'.join(mismatches), file=sys.stderr)
        return 1
    for record in records:
        with Image.open(ROOT / record['mother']) as image:
            source = image.convert('RGBA')
        for width, colors in [(128, 64), (256, 96)]:
            height = width * record['slot']['rows'] // 2 if record['slot'] else width
            fitted, _ = fit_premultiplied(source, (width, height), width // 32)
            indexed, rgba, _, _ = quantize(fitted, colors)
            output = io.BytesIO()
            indexed.save(output, format='PNG', optimize=True, compress_level=9, transparency=0)
            content = output.getvalue()
            expected = record['variants'][str(width)]
            byte_match = hashlib.sha256(content).hexdigest() == expected['sha256']
            pixel_match = hashlib.sha256(rgba.tobytes()).hexdigest() == expected['pixelSha256']
            if not byte_match or not pixel_match:
                mismatches.append({'id': record['id'], 'width': width, 'fileBytesMatch': byte_match, 'pixelsMatch': pixel_match})
                continue
            if args.write:
                destination = ROOT / record['files'][str(width)]
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(content)
            verified += 1
    report = {
        'status': 'pass' if not mismatches else 'fail',
        'mode': 'write' if args.write else 'verify-only',
        'icons': len(records),
        'PNGVariantsReproducedWithExactBytesAndPixels': verified,
        'mismatches': mismatches,
        'source': 'Saved mothers; no network or image generation API used.',
        'boundary': 'Reproducible conversion and file integrity; no new visual or gameplay acceptance.'
    }
    (ROOT / 'qa').mkdir(exist_ok=True)
    (ROOT / 'qa/handoff-rebuild-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))
    return 0 if not mismatches else 1


if __name__ == '__main__':
    raise SystemExit(main())
