import type { Rgba } from '../core/color';
import { Surface } from '../core/surface';

/**
 * The raster behind every procedural icon: shapes are authored in a 32-unit square and filled at
 * pixel centres into a role buffer, which `ink` turns into colours with a 1-px outline. Rendering
 * at the target size (never scaling a bitmap) keeps every icon on the 1-px grid.
 */
export const R = { None: 0, Body: 1, Shade: 2, Accent: 3, AccentShade: 4, Ink: 5 } as const;
export type Role = (typeof R)[keyof typeof R];

export type P = readonly [number, number];

export class Pen {
  readonly roles: Uint8Array;
  private readonly k: number;
  private readonly ox: number;
  private readonly oy: number;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.roles = new Uint8Array(w * h);
    this.k = Math.min(w, h) / 32;
    this.ox = (w - 32 * this.k) / 2;
    this.oy = (h - 32 * this.k) / 2;
  }

  /** Fills every pixel whose centre (in design units) passes `test`. */
  private paint(role: Role, test: (x: number, y: number) => boolean): this {
    for (let py = 0; py < this.h; py++) {
      for (let px = 0; px < this.w; px++) if (test((px + 0.5 - this.ox) / this.k, (py + 0.5 - this.oy) / this.k)) this.roles[py * this.w + px] = role;
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, role: Role): this {
    return this.paint(role, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, angle: number, role: Role): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return this.paint(role, (x, y) => (((x - cx) * c + (y - cy) * s) / rx) ** 2 + ((-(x - cx) * s + (y - cy) * c) / ry) ** 2 <= 1);
  }

  ring(cx: number, cy: number, r0: number, r1: number, role: Role): this {
    return this.paint(role, (x, y) => {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      return d >= r0 * r0 && d <= r1 * r1;
    });
  }

  box(x0: number, y0: number, x1: number, y1: number, role: Role): this {
    return this.paint(role, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  }

  /** A capsule from a to b of the given width. */
  stroke(a: P, b: P, width: number, role: Role): this {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const r2 = (width / 2) ** 2;
    return this.paint(role, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
      return (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2 <= r2;
    });
  }

  poly(pts: readonly P[], role: Role): this {
    return this.paint(role, (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }

  /** Recolours `role` to `otherwise` wherever `keep` fails (e.g. a flask's liquid line). */
  mask(role: Role, keep: (x: number, y: number) => boolean, otherwise: Role): this {
    for (let py = 0; py < this.h; py++) {
      for (let px = 0; px < this.w; px++) {
        const i = py * this.w + px;
        if (this.roles[i] === role && !keep((px + 0.5 - this.ox) / this.k, (py + 0.5 - this.oy) / this.k)) this.roles[i] = otherwise;
      }
    }
    return this;
  }
}

/**
 * Renders a design into a `w` × `h` surface (one pixel all round is kept for the outline):
 * `colors[role]` per role, `outline` around the silhouette.
 */
export function ink(w: number, h: number, design: (p: Pen) => void, colors: Readonly<Record<Exclude<Role, 0>, Rgba>>, outline: Rgba): Surface {
  const pen = new Pen(Math.max(1, w - 2), Math.max(1, h - 2));
  design(pen);
  const s = new Surface(w, h);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= pen.w || y >= pen.h ? 0 : pen.roles[y * pen.w + x]);
  for (let y = -1; y <= pen.h; y++) {
    for (let x = -1; x <= pen.w; x++) {
      const role = at(x, y) as Role;
      if (role) s.px(x + 1, y + 1, colors[role]);
      else {
        let near = false;
        for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1 && !near; ox++) near = at(x + ox, y + oy) !== 0;
        if (near) s.px(x + 1, y + 1, outline);
      }
    }
  }
  return s;
}
