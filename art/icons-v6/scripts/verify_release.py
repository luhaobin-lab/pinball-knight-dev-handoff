"""Verify standalone PNGs and atlases; optionally require release mother files."""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-mothers', action='store_true', help='Fail if the optional mother archive has not been extracted.')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    briefs = json.loads((ROOT / 'data/briefs.json').read_text())
    anchor_hashes = json.loads((ROOT / 'data/approved-anchor-hashes.json').read_text())
    assert len(manifest['icons']) == len(briefs) == 308
    assert not manifest['missingIds']
    assert not json.loads((ROOT / 'qa/technical-validation.json').read_text())['issues']
    source = {brief['id']: brief for brief in briefs}
    assert set(source) == {r['id'] for r in manifest['icons']}
    assert sum(r['category'] == 'item' for r in manifest['icons']) == 175
    assert sum(r['category'] == 'talent' for r in manifest['icons']) == 133
    pages = {a['id']: Image.open(ROOT / a['image']).convert('RGBA') for a in manifest['atlases']}
    for atlas in manifest['atlases']:
        assert sha(ROOT / atlas['image']) == atlas['sha256']
    occupied = {key: [] for key in pages}
    total = reviewed = mother_matches = 0
    missing_mothers = []
    for record in manifest['icons']:
        brief = source[record['id']]
        for key in ['name', 'slot', 'description', 'sourceFlags']:
            assert record[key] == brief[key], (record['id'], key)
        assert (ROOT / record['prompt']).is_file()
        receipt = json.loads((ROOT / 'receipts' / (record['id'] + '.json')).read_text())
        mother = ROOT / record['mother']
        if mother.is_file():
            assert sha(mother) == receipt['motherSha256'], record['id'] + ' mother hash'
            mother_matches += 1
        else:
            missing_mothers.append(record['id'])
        if record['id'] in anchor_hashes:
            assert receipt['approvedByUser'] is True
            assert receipt['motherSha256'] == anchor_hashes[record['id']]['motherSha256']
        else:
            review = receipt.get('visualReview', '')
            status = review.get('status', '') if isinstance(review, dict) else review.split(':')[0]
            assert status in ['pass', 'passed'], record['id'] + ' visual review incomplete'
            reviewed += 1
        independent = receipt.get('independentVisualReview')
        if independent:
            assert independent['status'] == 'pass'
            assert independent['pixelSha256'] == record['variants']['256']['pixelSha256']
        for size, variant in record['variants'].items():
            path = ROOT / record['files'][size]
            image = Image.open(path).convert('RGBA')
            assert image.size == (variant['width'], variant['height'])
            assert hashlib.sha256(image.tobytes()).hexdigest() == variant['pixelSha256']
            assert sha(path) == variant['sha256']
            assert set(image.getchannel('A').tobytes()) == {0, 255}
            visible_colors = {pixel[:3] for pixel in image.getdata() if pixel[3]}
            assert len(visible_colors) == variant['colors'] <= {'128': 64, '256': 96}[size]
            bounds = image.getbbox()
            assert min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]) >= image.width // 32
            total += 1
        atlas = record['atlas']
        x, y, w, h = (atlas['frame'][key] for key in ['x', 'y', 'w', 'h'])
        page = pages[atlas['page']]
        assert x >= 4 and y >= 4 and x + w + 4 <= page.width and y + h + 4 <= page.height
        assert page.crop((x, y, x + w, y + h)).tobytes() == Image.open(ROOT / record['files']['256']).convert('RGBA').tobytes()
        for ox, oy, ow, oh in occupied[atlas['page']]:
            assert x >= ox + ow or x + w <= ox or y >= oy + oh or y + h <= oy
        occupied[atlas['page']].append((x, y, w, h))
    anchors = {}
    for identity, baseline in anchor_hashes.items():
        anchors[identity] = all(sha(ROOT / 'pixels' / size / (identity + '.png')) == value['sha256'] for size, value in baseline['variants'].items())
        assert anchors[identity]
    if args.require_mothers and missing_mothers:
        parser.error('Mother files are missing. Extract icon-mothers.zip from release handoff-2026-10-29 into art/icons-v6/; PNGs and the catalogue work without it.')
    report = {
        'status': 'pass', 'icons': 308, 'PNGVariantsVerified': total,
        'exactAtlasCropsMatched': 308, 'packagedMotherHashesMatched': mother_matches,
        'optionalMotherFilesMissing': missing_mothers,
        'productionVisualReviewsRecorded': reviewed, 'userApprovedAnchors': 3,
        'atlasPages': len(pages), 'protectedAnchorsUnchanged': anchors,
        'anchorBaseline': 'data/approved-anchor-hashes.json, recorded from the approved V6 delivery',
        'sourceNamesSlotsDescriptionsFlagsPreserved': True, 'atlasOverlap': False,
        'externalAuthorMachinePathsRequired': False,
        'boundary': 'File and atlas integrity plus previously recorded visual reviews. No target-game import or player recognition validation.'
    }
    (ROOT / 'qa/release-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
