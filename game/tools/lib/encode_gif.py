# Encodes a numbered PNG sequence into a crisp looping GIF for the review pack (tools/review.mjs).
#   python -I encode_gif.py <frames dir> <source fps> <block> <limit bytes> <out.gif>
# - Frames are read in the numeric order of the last number in their names (f2 < f10 < f100).
# - Each frame is scaled down by <block> (the renderer's integer upscale) with nearest neighbour, so
#   the GIF shows the internal pixel grid exactly.
# - One global palette of 255 colours (fast octree over every frame), no dithering. Index 255 is
#   transparent and marks pixels that did not change since the previous frame (the film grain flips
#   about a sixth of them per frame, so delta rectangles alone save little). Passing the palette to save()
#   keeps Pillow from writing a local colour table per frame.
# - Frame delays are rounded cumulatively to hundredths of a second, so the GIF keeps the clip's length.
# - Tries 30, 25, 20 and 15 fps, then half the grid, until the file is at most <limit bytes>; the file
#   is decoded again and checked frame by frame.
# Prints a JSON summary on stdout.
import json
import os
import re
import sys

import numpy as np
from PIL import Image

RATES = (30, 25, 20, 15)
PALETTE_SAMPLE_PIXELS = 8_000_000
UNCHANGED = 255


def frame_number(name):
    digits = re.findall(r'\d+', name)
    return (int(digits[-1]) if digits else -1, name)


def shrink(im, block):
    w, h = im.width // block, im.height // block
    return im.resize((w, h), Image.Resampling.NEAREST, box=(0, 0, w * block, h * block))


def global_palette(frames):
    """Up to 255 colours by fast octree over all frames (subsampled in space to about
    PALETTE_SAMPLE_PIXELS). Returns the palette image to quantize with (real colours only, so no pixel
    maps to the transparent index) and the 256-entry palette to write, ending in an unused key colour."""
    w, h = frames[0].size
    step = 1
    while (w // step) * (h // step) * len(frames) > PALETTE_SAMPLE_PIXELS:
        step += 1
    tiles = [shrink(f, step) if step > 1 else f for f in frames]
    sample = Image.new('RGB', (tiles[0].width, tiles[0].height * len(tiles)))
    for k, tile in enumerate(tiles):
        sample.paste(tile, (0, tile.height * k))
    colours = sample.quantize(colors=UNCHANGED, method=Image.Quantize.FASTOCTREE).getpalette()[:UNCHANGED * 3]
    palette = Image.new('P', (1, 1))
    palette.putpalette(colours)
    entries = colours + [0, 0, 0] * (UNCHANGED - len(colours) // 3)
    used = {tuple(entries[i:i + 3]) for i in range(0, len(entries), 3)}
    key = next((r, g, b) for r in range(256) for g in (0, 255) for b in (255, 0) if (r, g, b) not in used)
    return palette, entries + list(key)


def timeline(count, source_fps, fps):
    """Source frame shown by each GIF frame, and each GIF frame's delay in hundredths of a second."""
    frames = max(1, round(count * fps / source_fps))
    picks = [min(count - 1, round(j * source_fps / fps)) for j in range(frames)]
    delays = [round(100 * (j + 1) / fps) - round(100 * j / fps) for j in range(frames)]
    return picks, delays


def encode(indices, colours, delays, out):
    frames = []
    previous = None
    for current in indices:
        data = current if previous is None else np.where(current == previous, UNCHANGED, current).astype(np.uint8)
        previous = current
        frame = Image.fromarray(data, 'P')
        frame.putpalette(colours)
        frames.append(frame)
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=[d * 10 for d in delays], loop=0,
                   optimize=False, disposal=1, transparency=UNCHANGED, palette=bytes(colours))


def verify(out, indices, colours):
    """The written GIF, composited frame by frame, must show exactly the quantized frames."""
    lut = np.array(colours, dtype=np.uint8).reshape(-1, 3)
    gif = Image.open(out)
    if gif.n_frames != len(indices):
        raise SystemExit(f'encode_gif: wrote {gif.n_frames} frames, expected {len(indices)}')
    for k, current in enumerate(indices):
        gif.seek(k)
        if not np.array_equal(np.asarray(gif.convert('RGB')), lut[current]):
            raise SystemExit(f'encode_gif: frame {k} of {out} does not decode to the quantized frame')


def main():
    frames_dir, source_fps, block, limit, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
    names = sorted((n for n in os.listdir(frames_dir) if n.lower().endswith('.png')), key=frame_number)
    if not names:
        raise SystemExit('encode_gif: no frames in ' + frames_dir)
    grid = [shrink(Image.open(os.path.join(frames_dir, n)).convert('RGB'), block) for n in names]
    size = 0
    for scale in (1, 2):
        frames = grid if scale == 1 else [shrink(f, 2) for f in grid]
        palette, colours = global_palette(frames)
        indices = [np.asarray(f.quantize(palette=palette, dither=Image.Dither.NONE)) for f in frames]
        if any((i >= UNCHANGED).any() for i in indices):
            raise SystemExit('encode_gif: a pixel was quantized to the transparent index')
        for fps in (r for r in RATES if r <= source_fps):
            picks, delays = timeline(len(indices), source_fps, fps)
            shown = [indices[i] for i in picks]
            encode(shown, colours, delays, out)
            size = os.path.getsize(out)
            if size <= limit:
                verify(out, shown, colours)
                print(json.dumps({'file': out, 'bytes': size, 'width': frames[0].width, 'height': frames[0].height, 'fps': fps,
                                  'frames': len(shown), 'scale': 1 / scale, 'source_frames': len(names), 'block': block}))
                return
            print(f'encode_gif: {size} bytes at {fps} fps, {frames[0].width}x{frames[0].height} > {limit}', file=sys.stderr)
    raise SystemExit(f'encode_gif: {size} bytes is over the {limit} byte limit even at 15 fps and half the grid')


main()
