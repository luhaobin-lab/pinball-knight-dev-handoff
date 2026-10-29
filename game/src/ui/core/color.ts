/**
 * Packed colours for the UI's software surfaces: a colour is a uint32 in ImageData byte order
 * (little-endian RGBA, i.e. 0xAABBGGRR) with straight alpha, so a Surface's buffer can be handed
 * to ImageData or a texture directly.
 */
export type Rgba = number;

export function rgba(r: number, g: number, b: number, a = 255): Rgba {
  return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

/** '#rgb', '#rrggbb' or '#rrggbbaa'. */
export function hex(h: string): Rgba {
  let s = h.startsWith('#') ? h.slice(1) : h;
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const v = parseInt(s.slice(0, 6), 16);
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255;
  return rgba((v >> 16) & 255, (v >> 8) & 255, v & 255, a);
}

export const red = (c: Rgba): number => c & 255;
export const green = (c: Rgba): number => (c >>> 8) & 255;
export const blue = (c: Rgba): number => (c >>> 16) & 255;
export const alpha = (c: Rgba): number => c >>> 24;

/** '#rrggbb' of the colour (alpha dropped); for tests and debugging. */
export function toHex(c: Rgba): string {
  return `#${[red(c), green(c), blue(c)].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
