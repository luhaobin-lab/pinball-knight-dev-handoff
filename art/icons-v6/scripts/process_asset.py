"""Import a replacement mother and export both PNG sizes; anchors are protected."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import numpy as np
from PIL import Image
from study_pixelize import fit_premultiplied, quantize

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def process(identity, source, generation_job=None):
    briefs = {b['id']: b for b in json.loads((ROOT / 'data/briefs.json').read_text())}
    if identity not in briefs:
        raise ValueError('Unknown stable icon ID: ' + identity)
    if identity in ['I005', 'I047', 'I106']:
        raise ValueError('Approved anchors are immutable. To reproduce their saved release PNGs, use rebuild_pngs.py.')
    source = Path(source).expanduser().resolve()
    if not source.is_file():
        raise ValueError('Mother file not found. Supply --source path/to/new-mother.png; the public package contains editable pixels/256 masters, not high-resolution mothers. This import command requires a newly supplied source image.')
    brief = briefs[identity]
    destination = ROOT / 'mothers' / (identity + '.png')
    image = Image.open(source).convert('RGBA')
    alpha = np.array(image)[:, :, 3]
    if not np.any(alpha < 128):
        raise ValueError('Expected a truly transparent generated background')
    if np.count_nonzero(alpha >= 128) < 100:
        raise ValueError('Empty or invalid subject')
    destination.parent.mkdir(exist_ok=True)
    if source != destination.resolve():
        shutil.copy2(source, destination)
    variants = {}
    for width, colors in [(128, 64), (256, 96)]:
        height = width * brief['slot']['rows'] // 2 if brief['slot'] else width
        fitted, fit = fit_premultiplied(image, (width, height), width // 32)
        indexed, rgba, palette, _ = quantize(fitted, colors)
        output = ROOT / 'pixels' / str(width) / (identity + '.png')
        output.parent.mkdir(parents=True, exist_ok=True)
        indexed.save(output, optimize=True, compress_level=9, transparency=0)
        bounds = rgba.getbbox()
        assert min(bounds[0], bounds[1], width - bounds[2], height - bounds[3]) >= width // 32
        variants[str(width)] = {'file': str(output.relative_to(ROOT)), 'width': width, 'height': height, 'colors': len(palette) - 1, 'bytes': output.stat().st_size, 'sha256': sha(output), 'pixelSha256': hashlib.sha256(rgba.tobytes()).hexdigest(), 'alphaBounds': list(bounds), 'fit': fit}
    provenance = {'sourceFilename': source.name, 'localCachePathRemoved': True}
    if generation_job:
        provenance['generationJobId'] = generation_job
    receipt = {'id': identity, 'name': brief['name'], 'status': 'generated-normalized', 'source': str(destination.relative_to(ROOT)), 'sourceProvenance': provenance, 'method': 'Imported transparent mother; approved V5 algorithmic pixelization', 'mother': str(destination.relative_to(ROOT)), 'motherSha256': sha(destination), 'motherSize': list(image.size), 'variants': variants, 'visualReview': 'pending'}
    (ROOT / 'receipts' / (identity + '.json')).write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'id': identity, 'status': 'needs-visual-review', 'mainPNG': variants['256']['file']}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--id', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--generation-job', help='Optional image generation job identifier; never put API credentials here.')
    args = parser.parse_args()
    try:
        process(args.id, args.source, args.generation_job)
    except ValueError as error:
        parser.error(str(error))
