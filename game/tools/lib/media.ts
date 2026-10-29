/**
 * Probes for the review pack's outputs (tools/review.mjs): what an MP4 or GIF really contains, read
 * from its bytes, so pack.json reports facts (codec, chroma format, frames, timing, palettes).
 */

export interface Mp4Info {
  /** Sample entry of the video track, e.g. "avc1" for H.264. */
  readonly codec: string;
  /** H.264 profile_idc (66 baseline, 77 main, 100 high) and chroma format ("4:2:0" plays everywhere). */
  readonly profile: number | null;
  readonly chroma: string | null;
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  readonly fps: number | null;
  readonly seconds: number | null;
}

export interface GifInfo {
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  /** Colours in the global colour table (0 when there is none). */
  readonly globalColors: number;
  /** Frames that carry their own colour table. */
  readonly localPalettes: number;
  readonly durationMs: number;
  /** Shortest and longest frame delay, in hundredths of a second. */
  readonly delayCs: { readonly min: number; readonly max: number };
  readonly loops: boolean;
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
const HIGH_PROFILES = new Set([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135]);
const CHROMA = ['4:0:0', '4:2:0', '4:2:2', '4:4:4'];

/** Exp-Golomb bit reader over an H.264 RBSP (emulation-prevention bytes removed). */
function bitReader(nal: Uint8Array): { bits(n: number): number; ue(): number } {
  const rbsp: number[] = [];
  for (let i = 0; i < nal.length; i++) {
    if (i >= 2 && nal[i] === 3 && nal[i - 1] === 0 && nal[i - 2] === 0) continue;
    rbsp.push(nal[i]);
  }
  let at = 0;
  const bit = (): number => {
    if (at >= rbsp.length * 8) throw new Error('MP4: SPS ends early');
    const v = (rbsp[at >> 3] >> (7 - (at & 7))) & 1;
    at++;
    return v;
  };
  return {
    bits(n) {
      let v = 0;
      for (let i = 0; i < n; i++) v = v * 2 + bit();
      return v;
    },
    ue() {
      let zeros = 0;
      while (bit() === 0) zeros++;
      return 2 ** zeros - 1 + this.bits(zeros);
    },
  };
}

/** profile_idc and chroma_format_idc from an SPS NAL unit (header byte included). */
function parseSps(nal: Uint8Array): { profile: number; chroma: number } {
  const r = bitReader(nal.subarray(1));
  const profile = r.bits(8);
  r.bits(16); // constraint flags, level_idc
  r.ue(); // seq_parameter_set_id
  return { profile, chroma: HIGH_PROFILES.has(profile) ? r.ue() : 1 };
}

export function probeMp4(bytes: Uint8Array): Mp4Info {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number): string => String.fromCharCode(...bytes.subarray(at, at + 4));
  let codec = '';
  let width = 0;
  let height = 0;
  let frames = 0;
  let timescale = 0;
  let duration = 0;
  let delta = 0;
  let sps: { profile: number; chroma: number } | null = null;
  const walk = (start: number, end: number): void => {
    for (let at = start; at + 8 <= end; ) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) {
        size = end - at;
      }
      if (size < header) throw new Error(`MP4: bad box size at ${at}`);
      const kind = type(at + 4);
      const body = at + header;
      if (CONTAINERS.has(kind)) walk(body, at + size);
      else if (kind === 'stsd') walk(body + 8, at + size);
      else if (kind === 'avc1' || kind === 'avc3' || kind === 'hvc1' || kind === 'hev1' || kind === 'mp4v' || kind === 'vp09' || kind === 'av01') {
        if (!codec) {
          codec = kind;
          width = view.getUint16(body + 24);
          height = view.getUint16(body + 26);
          walk(body + 78, at + size);
        }
      } else if (kind === 'avcC' && !sps && (bytes[body + 5] & 0x1f) > 0) {
        sps = parseSps(bytes.subarray(body + 8, body + 8 + view.getUint16(body + 6)));
      } else if (kind === 'mdhd' && !timescale) {
        const v1 = bytes[body] === 1;
        timescale = view.getUint32(body + (v1 ? 20 : 12));
        duration = v1 ? Number(view.getBigUint64(body + 24)) : view.getUint32(body + 16);
      } else if (kind === 'stsz' && !frames) {
        frames = view.getUint32(body + 8);
      } else if (kind === 'stts' && !delta && view.getUint32(body + 4) === 1) {
        delta = view.getUint32(body + 12);
      }
      at += size;
    }
  };
  walk(0, bytes.length);
  if (!codec) throw new Error('MP4: no video sample entry');
  const found = sps as { profile: number; chroma: number } | null;
  return {
    codec,
    profile: found ? found.profile : null,
    chroma: found ? (CHROMA[found.chroma] ?? String(found.chroma)) : null,
    width,
    height,
    frames,
    fps: timescale && delta ? Math.round((timescale / delta) * 1000) / 1000 : null,
    seconds: timescale ? Math.round((duration / timescale) * 1000) / 1000 : null,
  };
}

export function probeGif(bytes: Uint8Array): GifInfo {
  const head = String.fromCharCode(...bytes.subarray(0, 6));
  if (head !== 'GIF87a' && head !== 'GIF89a') throw new Error('not a GIF file');
  const u16 = (at: number): number => bytes[at] | (bytes[at + 1] << 8);
  const width = u16(6);
  const height = u16(8);
  const globalColors = bytes[10] & 0x80 ? 2 << (bytes[10] & 7) : 0;
  let at = 13 + globalColors * 3;
  const skipBlocks = (): void => {
    while (at < bytes.length && bytes[at] !== 0) at += bytes[at] + 1;
    at++;
  };
  let frames = 0;
  let localPalettes = 0;
  let durationCs = 0;
  let min = Infinity;
  let max = 0;
  let pendingDelay = 0;
  let loops = false;
  while (at < bytes.length) {
    const block = bytes[at++];
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = bytes[at++];
      if (label === 0xf9) pendingDelay = u16(at + 2);
      if (label === 0xff && String.fromCharCode(...bytes.subarray(at + 1, at + 12)) === 'NETSCAPE2.0') loops = true;
      skipBlocks();
    } else if (block === 0x2c) {
      const packed = bytes[at + 8];
      at += 9;
      if (packed & 0x80) {
        localPalettes++;
        at += (2 << (packed & 7)) * 3;
      }
      at++; // LZW minimum code size
      skipBlocks();
      frames++;
      durationCs += pendingDelay;
      min = Math.min(min, pendingDelay);
      max = Math.max(max, pendingDelay);
      pendingDelay = 0;
    } else {
      throw new Error(`GIF: unexpected block 0x${block.toString(16)} at ${at - 1}`);
    }
  }
  return { width, height, frames, globalColors, localPalettes, durationMs: durationCs * 10, delayCs: { min: frames ? min : 0, max }, loops };
}
