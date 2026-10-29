/**
 * 8-bit RGBA images, pixel rectangles and a dependency-free PNG codec. zlib goes through the web
 * Compression Streams API, so the same code runs in Node 24 (type stripping, imported by the .mjs
 * tools), in vitest and in a browser. Decodes every non-interlaced PNG (all colour types, bit depths
 * 1–16; 16-bit samples keep their high byte); encodes RGB, or RGBA when any pixel is translucent.
 */

/** Row-major RGBA, 4 bytes per pixel. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** Pixel rectangle; x1 and y1 are exclusive. */
export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** Samples per pixel by PNG colour type. */
const CHANNELS = new Map([
  [0, 1],
  [2, 3],
  [3, 1],
  [4, 2],
  [6, 4],
]);

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Parses "x0,y0,x1,y1" (pixels, x1/y1 exclusive). */
export function parseRect(text: string): Rect {
  const parts = text.split(',').map(s => Number(s.trim()));
  if (parts.length !== 4 || !parts.every(Number.isInteger)) throw new Error(`a rectangle is "x0,y0,x1,y1" in whole pixels, got "${text}"`);
  const [x0, y0, x1, y1] = parts;
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) throw new Error(`rectangle "${text}" must have 0 <= x0 < x1 and 0 <= y0 < y1`);
  return { x0, y0, x1, y1 };
}

export function rectText(r: Rect): string {
  return `${r.x0},${r.y0},${r.x1},${r.y1}`;
}

export function cropImage(image: RgbaImage, r: Rect): RgbaImage {
  if (r.x1 > image.width || r.y1 > image.height) throw new Error(`crop ${rectText(r)} exceeds the ${image.width}x${image.height} image`);
  const out = createImage(r.x1 - r.x0, r.y1 - r.y0);
  for (let y = 0; y < out.height; y++) {
    const from = ((r.y0 + y) * image.width + r.x0) * 4;
    out.data.set(image.data.subarray(from, from + out.width * 4), y * out.width * 4);
  }
  return out;
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Reverses the per-row PNG filters in place of a fresh buffer (rows of `stride` bytes). */
function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Uint8Array {
  const out = new Uint8Array(height * stride);
  if (raw.length < height * (stride + 1)) throw new Error('PNG: image data is truncated');
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const up = row - stride;
    if (type === 0) {
      out.set(raw.subarray(src, src + stride), row);
    } else if (type === 1) {
      for (let i = 0; i < stride; i++) out[row + i] = raw[src + i] + (i >= bpp ? out[row + i - bpp] : 0);
    } else if (type === 2) {
      for (let i = 0; i < stride; i++) out[row + i] = raw[src + i] + (y > 0 ? out[up + i] : 0);
    } else if (type === 3) {
      for (let i = 0; i < stride; i++) out[row + i] = raw[src + i] + (((i >= bpp ? out[row + i - bpp] : 0) + (y > 0 ? out[up + i] : 0)) >> 1);
    } else if (type === 4) {
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? out[row + i - bpp] : 0;
        const b = y > 0 ? out[up + i] : 0;
        const c = y > 0 && i >= bpp ? out[up + i - bpp] : 0;
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        out[row + i] = raw[src + i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
    } else {
      throw new Error(`PNG: unknown filter type ${type} on row ${y}`);
    }
  }
  return out;
}

export async function decodePng(bytes: Uint8Array): Promise<RgbaImage> {
  if (bytes.length < 8 || SIGNATURE.some((v, i) => bytes[i] !== v)) throw new Error('not a PNG file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  let alphas: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= bytes.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      depth = body[8];
      colorType = body[9];
      if (body[12] !== 0) throw new Error('PNG: interlaced (Adam7) images are not supported');
    } else if (type === 'PLTE') {
      palette = body;
    } else if (type === 'tRNS') {
      alphas = body;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  const channels = CHANNELS.get(colorType);
  if (!width || !height || channels === undefined || ![1, 2, 4, 8, 16].includes(depth)) throw new Error(`PNG: unsupported header (colour type ${colorType}, depth ${depth})`);
  if (colorType === 3 && !palette) throw new Error('PNG: palette image without PLTE');
  const joined = new Uint8Array(idat.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of idat) {
    joined.set(part, offset);
    offset += part.length;
  }
  const stride = Math.ceil((width * channels * depth) / 8);
  const rows = unfilter(await pipe(joined, new DecompressionStream('deflate')), height, stride, Math.max(1, (channels * depth) >> 3));

  const out = createImage(width, height);
  if (depth === 8 && (colorType === 2 || colorType === 6)) {
    // the common case (browser screenshots, PIL output): plain RGB(A) bytes
    for (let i = 0, j = 0; i < out.data.length; i += 4) {
      out.data[i] = rows[j++];
      out.data[i + 1] = rows[j++];
      out.data[i + 2] = rows[j++];
      out.data[i + 3] = colorType === 6 ? rows[j++] : 255;
    }
    return out;
  }
  const max = (1 << Math.min(depth, 8)) - 1;
  /** Sample `index` of row `y`, reduced to 8 bits (scaled up for depths < 8, high byte of 16). */
  const sample = (y: number, index: number): number => {
    if (depth === 8) return rows[y * stride + index];
    if (depth === 16) return rows[y * stride + index * 2];
    const bit = index * depth;
    const value = (rows[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & max;
    return colorType === 3 ? value : Math.round((value * 255) / max);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * channels;
      if (colorType === 3) {
        const index = sample(y, s);
        out.data[o] = palette![index * 3];
        out.data[o + 1] = palette![index * 3 + 1];
        out.data[o + 2] = palette![index * 3 + 2];
        out.data[o + 3] = alphas && index < alphas.length ? alphas[index] : 255;
      } else if (channels <= 2) {
        out.data[o] = out.data[o + 1] = out.data[o + 2] = sample(y, s);
        out.data[o + 3] = channels === 2 ? sample(y, s + 1) : 255;
      } else {
        out.data[o] = sample(y, s);
        out.data[o + 1] = sample(y, s + 1);
        out.data[o + 2] = sample(y, s + 2);
        out.data[o + 3] = channels === 4 ? sample(y, s + 3) : 255;
      }
    }
  }
  return out;
}

export async function encodePng(image: RgbaImage): Promise<Uint8Array> {
  const { width, height, data } = image;
  let opaque = true;
  for (let i = 3; i < data.length && opaque; i += 4) opaque = data[i] === 255;
  const channels = opaque ? 3 : 4;
  const stride = width * channels;
  // filter 1 (Sub) on every row: each byte minus the same channel of the previous pixel
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 1;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        const v = data[(y * width + x) * 4 + c];
        raw[row + 1 + x * channels + c] = v - (x > 0 ? data[(y * width + x - 1) * 4 + c] : 0);
      }
    }
  }
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  header.set([8, opaque ? 2 : 6, 0, 0, 0], 8);
  const chunks: [string, Uint8Array][] = [
    ['IHDR', header],
    ['IDAT', await pipe(raw, new CompressionStream('deflate'))],
    ['IEND', new Uint8Array(0)],
  ];
  const out = new Uint8Array(8 + chunks.reduce((n, [, body]) => n + 12 + body.length, 0));
  const view = new DataView(out.buffer);
  out.set(SIGNATURE, 0);
  let at = 8;
  for (const [type, body] of chunks) {
    view.setUint32(at, body.length);
    for (let i = 0; i < 4; i++) out[at + 4 + i] = type.charCodeAt(i);
    out.set(body, at + 8);
    view.setUint32(at + 8 + body.length, crc32(out, at + 4, at + 8 + body.length));
    at += 12 + body.length;
  }
  return out;
}
