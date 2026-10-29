import { R, type P, type Pen, type Role } from '../../ui/icons/pen';

/**
 * The item glyphs: one drawing per kind of object, authored on the UI icon pen's 32-unit square (y down) in its
 * five roles: Body (bone), Shade (dim bone, the lower-right side), Accent and AccentShade (the item type's hue),
 * Ink (details). Rules, so 200 icons read as one set:
 *   - the silhouette fills a circle of radius ~14 around (16, 16); long objects run on the rising diagonal
 *     (grip bottom-left, point top-right), round ones sit centred;
 *   - light comes from the top-left: Shade takes the lower-right of every form;
 *   - the accent marks the part that says what the item does (grip, gem, liquid, trim), about a quarter of it;
 *   - blades, shafts and limbs are at least 3 units wide; Ink only for holes and engraved lines, 1 unit or more;
 *   - every icon covers 16–34 % of its square with its inks (the outline aside): one optical weight.
 * Glyphs shared by several items take a variant `k` (by what the name says, else 0, 1, 2 … in the order of the items
 * that share it; items.ts), so no two items look alike: blades change shape, guard and pommel; vials their bottle;
 * pills their band.
 */

export type Glyph = (p: Pen, k: number) => unknown;

/** Points of an arc (degrees, 0 = +x, counter-clockwise on screen). */
function arc(cx: number, cy: number, r: number, from: number, to: number, n = 10): P[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as P;
  });
}

/** A polyline as capsule strokes. */
function path(p: Pen, pts: readonly P[], w: number, role: (typeof R)[keyof typeof R]): Pen {
  for (let i = 1; i < pts.length; i++) p.stroke(pts[i - 1], pts[i], w, role);
  return p;
}

/**
 * A glyph drawn `k` times its size about the square's centre: heavy drawings are calmed to the set's optical weight
 * without redrawing them (every shape and the mask tests go through the same transform).
 */
function scaled(f: number, g: Glyph): Glyph {
  return (p: Pen, k: number) => {
    const t = (x: number): number => 16 + (x - 16) * f;
    const back = (x: number): number => 16 + (x - 16) / f;
    const tp = (a: P): P => [t(a[0]), t(a[1])];
    const sp = {
      disc: (cx: number, cy: number, r: number, role: Role) => (p.disc(t(cx), t(cy), r * f, role), sp),
      ellipse: (cx: number, cy: number, rx: number, ry: number, angle: number, role: Role) => (p.ellipse(t(cx), t(cy), rx * f, ry * f, angle, role), sp),
      ring: (cx: number, cy: number, r0: number, r1: number, role: Role) => (p.ring(t(cx), t(cy), r0 * f, r1 * f, role), sp),
      box: (x0: number, y0: number, x1: number, y1: number, role: Role) => (p.box(t(x0), t(y0), t(x1), t(y1), role), sp),
      stroke: (a: P, b: P, w: number, role: Role) => (p.stroke(tp(a), tp(b), w * f, role), sp),
      poly: (pts: readonly P[], role: Role) => (p.poly(pts.map(tp), role), sp),
      mask: (role: Role, keep: (x: number, y: number) => boolean, otherwise: Role) => (p.mask(role, (x, y) => keep(back(x), back(y)), otherwise), sp),
    };
    return g(sp as unknown as Pen, k);
  };
}

// ---- the rising diagonal --------------------------------------------------------------------------------------

/** Along the rising diagonal (toward the top-right) and across it (toward the lower-right, the shaded side). */
const U: P = [Math.SQRT1_2, -Math.SQRT1_2];
const N: P = [Math.SQRT1_2, Math.SQRT1_2];
const on = (o: P, s: number, t = 0): P => [o[0] + U[0] * s + N[0] * t, o[1] + U[1] * s + N[1] * t];

type Blade = 'straight' | 'leaf' | 'taper' | 'curve' | 'serrate' | 'wave' | 'broad' | 'hook';
type Guard = 'bar' | 'crescent' | 'disc' | 'spiked' | 'knob';
type Pommel = 'disc' | 'ring' | 'diamond' | 'spike';

const BLADES: readonly Blade[] = ['straight', 'curve', 'leaf', 'serrate', 'wave', 'taper', 'broad', 'hook'];
const GUARDS: readonly Guard[] = ['bar', 'crescent', 'disc', 'spiked', 'knob'];
const POMMELS: readonly Pommel[] = ['disc', 'diamond', 'ring', 'spike'];

interface BladeSpec {
  /** Blade length and half-width (units), grip length. */
  readonly len: number;
  readonly half: number;
  readonly grip: number;
}

/**
 * A bladed weapon on the diagonal, centred in the square: blade shape, guard and pommel from the variant, the
 * blade two-toned along its spine (bone edge up-left, dim edge down-right).
 */
function bladed(p: Pen, b: BladeSpec, k: number): Pen {
  const shape = BLADES[k % BLADES.length];
  const guard = GUARDS[(k + Math.floor(k / BLADES.length)) % GUARDS.length];
  const pommel = POMMELS[(k * 3 + 1) % POMMELS.length];
  const base = on([16, 16], -(b.len - b.grip - 2.6) / 2);
  const n = 14;
  const spine: P[] = [];
  const top: P[] = [];
  const low: P[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const tipStart = shape === 'broad' ? 0.82 : shape === 'taper' ? 0 : 0.7;
    let h = b.half * (f < tipStart ? 1 : Math.max(0, 1 - (f - tipStart) / (1 - tipStart)));
    if (shape === 'leaf') h *= 0.8 + 0.45 * Math.sin(Math.min(1, f / 0.75) * Math.PI * 0.9);
    if (shape === 'taper') h = b.half * 1.55 * (1 - f * 0.92);
    if (shape === 'broad') h *= 1.25;
    if (shape === 'wave') h *= 1 + 0.22 * Math.sin(f * Math.PI * 5);
    const c = shape === 'curve' ? -Math.sin(f * Math.PI * 0.9) * b.half * 0.9 : shape === 'hook' && f > 0.75 ? -(f - 0.75) * b.half * 6 : 0;
    const s = f * b.len;
    spine.push(on(base, s, c));
    top.push(on(base, s, c - h));
    low.push(on(base, s, c + h));
  }
  p.poly([...top, ...[...low].reverse()], R.Body).poly([...spine, ...[...low].reverse()], R.Shade);
  if (shape === 'serrate') for (const f of [0.22, 0.4, 0.58]) p.disc(...on(base, f * b.len, b.half + 0.3), 1.1, R.Ink);
  if (shape === 'broad' || shape === 'straight') p.stroke(on(base, 1.5), on(base, b.len * 0.55), 1.1, R.Ink);
  // the guard across the blade's base
  const g = b.half + 3;
  switch (guard) {
    case 'bar':
      p.stroke(on(base, 0, -g), on(base, 0, g), 2.8, R.Accent);
      break;
    case 'crescent':
      p.stroke(on(base, 0.4, -g + 0.6), on(base, -0.6, -b.half), 2.6, R.Accent).stroke(on(base, 0.4, g - 0.6), on(base, -0.6, b.half), 2.6, R.Accent);
      p.stroke(on(base, 1.6, -g - 0.4), on(base, 0.4, -g + 0.6), 2.4, R.Accent).stroke(on(base, 1.6, g + 0.4), on(base, 0.4, g - 0.6), 2.4, R.Accent);
      break;
    case 'disc':
      p.disc(...base, b.half + 1.8, R.Accent);
      break;
    case 'spiked':
      p.stroke(on(base, 0, -g), on(base, 0, g), 2.4, R.Accent).poly([on(base, 0, -g - 0.4), on(base, 2.4, -g - 1.6), on(base, -0.6, -g + 1.2)], R.Accent).poly([on(base, 0, g + 0.4), on(base, 2.4, g + 1.6), on(base, -0.6, g - 1.2)], R.Accent);
      break;
    case 'knob':
      p.stroke(on(base, 0, -b.half - 0.6), on(base, 0, b.half + 0.6), 2.6, R.Accent).disc(...on(base, 0, -g + 0.4), 1.9, R.Accent).disc(...on(base, 0, g - 0.4), 1.9, R.Accent);
      break;
  }
  // the grip and its shaded half, then the pommel
  const end = on(base, -b.grip);
  p.stroke(on(base, -1), end, 3.6, R.Accent).stroke(on(base, -1, 0.9), on(base, -b.grip, 0.9), 1.4, R.AccentShade);
  const pm = on(base, -b.grip - 1.6);
  switch (pommel) {
    case 'disc':
      p.disc(...pm, 2.5, R.Accent);
      break;
    case 'diamond':
      p.poly([on(pm, 2.2), on(pm, 0, 2.4), on(pm, -2.6), on(pm, 0, -2.4)], R.Accent);
      break;
    case 'ring':
      p.ring(...pm, 1.1, 2.7, R.Accent);
      break;
    case 'spike':
      p.poly([on(pm, 1.6, -2.2), on(pm, 1.6, 2.2), on(pm, -2.8)], R.Accent);
      break;
  }
  return p;
}

/** A shafted weapon on the diagonal: the shaft (3.2 units) from the butt to `head` along it. */
function shaft(p: Pen, from: number, to: number, role: (typeof R)[keyof typeof R] = R.Shade): Pen {
  return p.stroke(on([16, 16], from), on([16, 16], to), 3.4, role);
}

// ---- consumables' bottles -----------------------------------------------------------------------------------

/** A glass bottle: 0 tall vial, 1 round flask, 2 square bottle, 3 conical flask, 4 gourd, 5 test tubes, 6 canteen. */
function bottle(p: Pen, k: number): Pen {
  switch (k) {
    case 0: // the tall vial
      p.box(11, 8, 21, 28, R.Body).disc(16, 27, 5, R.Body).box(12.5, 3, 19.5, 8, R.Shade).box(11.5, 1.5, 20.5, 4, R.Body);
      p.box(12, 15, 20, 29, R.Accent).disc(16, 27, 4, R.Accent).mask(R.Accent, x => x < 16.5, R.AccentShade).box(13, 10, 14.5, 25, R.Body);
      return p;
    case 1: // round flask
      p.disc(16, 20, 9.5, R.Body).box(13, 4, 19, 12, R.Body).box(12, 2, 20, 5, R.Shade);
      p.disc(16, 21, 7.8, R.Accent).mask(R.Accent, (_x, y) => y > 17.5, R.Body).mask(R.Accent, (x, y) => x + y < 39, R.AccentShade).disc(12.5, 17.5, 1.5, R.Body);
      return p;
    case 2: // square bottle with a wide neck
      p.box(8.5, 11, 23.5, 29, R.Body).box(12, 5, 20, 11, R.Body).box(11, 2.5, 21, 6, R.Shade);
      p.box(10, 17, 22, 27.5, R.Accent).mask(R.Accent, x => x < 17, R.AccentShade).box(10.5, 13, 12.5, 25, R.Body).box(9, 26.5, 23, 29, R.Shade);
      return p;
    case 3: // conical flask
      p.poly([[13, 4], [19, 4], [19, 12], [26, 28], [6, 28], [13, 12]], R.Body).box(12, 2, 20, 5, R.Shade);
      p.poly([[10.5, 19], [21.5, 19], [25, 27], [7, 27]], R.Accent).mask(R.Accent, x => x < 17.5, R.AccentShade).stroke([14.5, 8], [12, 18], 1.2, R.Shade);
      return p;
    case 4: // gourd: two bulbs
      p.disc(16, 22, 8, R.Body).disc(16, 11, 5, R.Body).box(13.5, 3, 18.5, 7, R.Shade);
      p.disc(16, 22.5, 6.2, R.Accent).mask(R.Accent, (x, y) => x + y < 39.5, R.AccentShade).disc(13, 19.5, 1.4, R.Body).box(14, 15, 18, 16.5, R.Shade);
      return p;
    case 6: // a canteen on a strap
      p.ring(16, 15, 9.5, 11, R.Shade).disc(16, 19, 9, R.Body).mask(R.Body, (x, y) => x + y < 37, R.Shade).box(13.5, 6, 18.5, 10, R.Accent);
      return p.ring(16, 19, 5.5, 7, R.Accent).disc(16, 19, 2.4, R.AccentShade);
    default: // a pair of test tubes
      p.stroke([11, 6], [11, 27], 6, R.Body).stroke([21, 9], [21, 27], 6, R.Body).box(7.5, 4, 14.5, 7, R.Shade).box(17.5, 7, 24.5, 10, R.Shade);
      return p.stroke([11, 17], [11, 27], 4, R.Accent).stroke([21, 21], [21, 27], 4, R.AccentShade);
  }
}

// ---- the enchantment marks ------------------------------------------------------------------------------------

/** The mark inside a rune stone, by what the enchantment does (its 描述 name), and its tier pips. */
export const RUNE_MARKS = {
  damage: (p: Pen) => p.stroke([11, 20], [19, 10], 2.2, R.Accent).stroke([10.5, 14.5], [15.5, 19.5], 2, R.Accent),
  heal: (p: Pen) => p.box(13.4, 9, 16.6, 21, R.Accent).box(9, 13.4, 21, 16.6, R.Accent),
  armor: (p: Pen) => p.poly([[10, 9.5], [20, 9.5], [20, 15], [15, 21], [10, 15]], R.Accent),
  charge: (p: Pen) => p.poly([[16.5, 8], [11, 16], [15, 16], [13.5, 22], [19, 13.5], [15, 13.5]], R.Accent),
  any: (p: Pen) => p.ring(15, 15, 3.2, 5.4, R.Accent),
  strength: (p: Pen) => p.poly([[15, 8.5], [21, 15], [17.5, 15], [17.5, 21], [12.5, 21], [12.5, 15], [9, 15]], R.Accent),
  vigour: (p: Pen) => p.disc(12.6, 13, 3, R.Accent).disc(17.4, 13, 3, R.Accent).poly([[9.8, 14.2], [20.2, 14.2], [15, 21]], R.Accent),
  agility: (p: Pen) => {
    path(p, [[10, 12], [15, 16], [20, 12]], 2.2, R.Accent);
    return path(p, [[10, 17], [15, 21], [20, 17]], 2.2, R.Accent);
  },
  leech: (p: Pen) => p.disc(15, 17, 4, R.Accent).poly([[15, 8], [18.6, 15], [11.4, 15]], R.Accent),
  double: (p: Pen) => p.poly([[12, 9], [15.5, 14], [12, 19], [8.5, 14]], R.Accent).poly([[18, 11], [21.5, 16], [18, 21], [14.5, 16]], R.Accent),
  rend: (p: Pen) => p.stroke([10, 10], [14, 20], 1.8, R.Accent).stroke([14, 9], [18, 19], 1.8, R.Accent).stroke([18, 10], [21, 18], 1.8, R.Accent),
  echo: (p: Pen) => p.ring(15, 15, 1.4, 2.6, R.Accent).ring(15, 15, 4.4, 5.6, R.Accent),
  power: (p: Pen) => p.poly([[15, 8], [16.8, 13.2], [22, 13.4], [17.8, 16.6], [19.4, 21.6], [15, 18.6], [10.6, 21.6], [12.2, 16.6], [8, 13.4], [13.2, 13.2]], R.Accent),
  devour: (p: Pen) => p.disc(15, 15, 5.6, R.Accent).poly([[15, 15], [22, 11], [22, 19]], R.Body).disc(13.5, 12.5, 1.2, R.Ink),
} as const satisfies Record<string, (p: Pen) => unknown>;
export type RuneMark = keyof typeof RUNE_MARKS;

/** 1 or 2 tier pips under the rune ring (Ⅰ, Ⅱ). */
export function runePips(p: Pen, tier: number): Pen {
  for (let i = 0; i < tier; i++) p.disc(15 + (i - (tier - 1) / 2) * 4, 25.5, 1.4, R.Accent);
  return p;
}

// ---- the glyphs ------------------------------------------------------------------------------------------------

export const ICON_GLYPHS = {
  // ---- blades ---------------------------------------------------------------------------------------------------
  sword: (p: Pen, k: number) => bladed(p, { len: 22.5, half: 3.75, grip: 6.5 }, k + 1),
  dagger: (p: Pen, k: number) => bladed(p, { len: 19.5, half: 4.5, grip: 6.5 }, k),
  greatsword: (p: Pen, k: number) => bladed(p, { len: 23.5, half: 3.9, grip: 7 }, k + 6),

  // ---- hafted and drawn weapons ---------------------------------------------------------------------------------
  axe: (p: Pen, k: number) => {
    shaft(p, -15, 11);
    const head = on([16, 16], 8);
    if (k % 2 === 0) {
      // a bearded single bit
      p.poly([on(head, 4.5, -1.5), on(head, 6, -11), on(head, -2, -12), on(head, -5.5, -3), on(head, -4.5, -1.5)], R.Body).poly([on(head, 6, -11), on(head, -2, -12), on(head, -0.6, -8.4), on(head, 4.6, -8)], R.Accent).poly([on(head, 4.5, 1.5), on(head, 3, 4.5), on(head, -3, 4.5), on(head, -4.5, 1.5)], R.Shade);
    } else {
      // a double bit
      for (const side of [-1, 1]) p.poly([on(head, 3.2, side * 1.5), on(head, 5.5, side * 8.5), on(head, -5, side * 8.5), on(head, -3.2, side * 1.5)], side < 0 ? R.Body : R.Shade);
      p.stroke(on(head, 5.2, -8.4), on(head, -4.6, -8.4), 1.8, R.Accent).stroke(on(head, 5.2, 8.4), on(head, -4.6, 8.4), 1.8, R.AccentShade);
    }
    return p.disc(...on([16, 16], -15), 2.4, R.Accent);
  },
  hammer: (p: Pen, k: number) => {
    shaft(p, -15, 6);
    const head = on([16, 16], 8);
    if (k % 3 === 0) {
      // a square forge hammer
      p.poly([on(head, 4, -8.5), on(head, 4, 8.5), on(head, -4, 8.5), on(head, -4, -8.5)], R.Body).poly([on(head, 4, 0), on(head, 4, 8.5), on(head, -4, 8.5), on(head, -4, 0)], R.Shade).stroke(on(head, 0, -9), on(head, 0, 9), 2.4, R.Accent);
    } else if (k % 3 === 1) {
      // a round maul
      p.ellipse(...head, 8.5, 6, -Math.PI / 4, R.Body).mask(R.Body, (x, y) => x + y < head[0] + head[1] + 1, R.Shade).ring(...head, 1.6, 3, R.Accent);
    } else {
      // a war pick: a hammer face on one side, a spike on the other
      p.poly([on(head, 4.4, -1), on(head, 4.4, -9), on(head, -4.4, -9), on(head, -4.4, -1)], R.Body).poly([on(head, 4, 1), on(head, 0, 13), on(head, -4, 1)], R.Shade).disc(...head, 3.4, R.Accent);
    }
    return p.disc(...on([16, 16], -15), 2.4, R.Accent);
  },
  bow: (p: Pen, k: number) => {
    // the limb bulges to the top-left of the string, an arrow nocked through the grip
    const r = k % 3 === 2 ? 17.5 : k % 3 === 1 ? 14.5 : 16.1;
    path(p, arc(24, 24, r, 83, 187, 12), 4.2, R.Body);
    p.stroke(arc(24, 24, r, 83, 187, 1)[0], arc(24, 24, r, 83, 187, 1)[1], 1, R.Shade);
    if (k % 2 === 1) path(p, arc(24, 24, r - 4.2, 92, 178, 10), 2.2, R.Shade);
    p.stroke([18, 18], [6.5, 6.5], 1.8, R.Shade);
    const tip = k % 4;
    if (tip === 0) p.poly([[3, 3], [10, 5], [5, 10]], R.Body);
    else if (tip === 1) p.disc(5.5, 5.5, 3.4, R.Accent);
    else if (tip === 2) p.poly([[2.5, 2.5], [9, 4], [7, 6], [9.5, 8.5], [4, 9]], R.Body);
    else p.poly([[3, 6], [6, 3], [10, 7], [7, 10]], R.Body);
    p.stroke([19, 17], [22, 20], 3, R.Shade);
    return p.stroke([11, 14], [14, 11], 4.2, R.Accent).disc(...arc(24, 24, r, 83, 83, 1)[0], 2, R.Accent).disc(...arc(24, 24, r, 187, 187, 1)[0], 2, R.Accent);
  },
  crossbow: (p: Pen, k: number) => {
    // the stock on the diagonal, the curved prod across its head, a bolt laid in it
    p.stroke([5, 28], [21, 12], 4.4, R.Shade).disc(5.5, 27.5, 3.2, R.Accent).box(10, 20, 14.5, 24.5, R.Accent);
    path(p, arc(14, 19, k % 3 === 1 ? 13.5 : 12, -4, 94, 10), 3.4, R.Body);
    if (k % 3 === 1) p.box(16, 17, 22, 22, R.Accent).box(17.5, 18.5, 20.5, 20.5, R.Ink);
    if (k % 3 === 2) p.stroke([16, 13], [9, 6], 1.8, R.Shade);
    return p.stroke([13, 20], [26, 7], 1.8, R.Body).poly([[25, 4], [30, 3], [29, 8]], R.Body);
  },
  staff: (p: Pen, k: number) => {
    shaft(p, -16, 7);
    const c: P = [22, 10];
    switch (k % 6) {
      case 0: // a great orb in a claw
        return p.ring(...c, 6.6, 8.6, R.Body).disc(...c, 6.6, R.Accent).mask(R.Accent, (x, y) => x + y < 33, R.AccentShade).disc(20.6, 7.6, 1.6, R.Body);
      case 1: // an eye
        return p.disc(...c, 8.4, R.Body).mask(R.Body, (x, y) => x + y < 33, R.Shade).disc(...c, 4.2, R.Accent).disc(...c, 1.9, R.Ink);
      case 2: // a whirlwind spiral
        p.disc(...c, 8.6, R.Accent).mask(R.Accent, (x, y) => x + y < 33, R.AccentShade);
        return path(p, arc(22, 10, 5, 0, 300, 10), 1.8, R.Body);
      case 3: // a forked flame
        return p.poly([[15, 15], [17.5, 4], [21, 9], [23.5, 0.5], [26.5, 8], [30.5, 3.5], [29.5, 15.5], [22, 19]], R.Accent).mask(R.Accent, (x, y) => x + y < 37, R.AccentShade).poly([[19.5, 15], [23.5, 6], [26.5, 15]], R.Body);
      case 4: // a void ring
        return p.disc(...c, 8.4, R.Accent).disc(...c, 4.4, R.Ink).ring(...c, 4.4, 5.4, R.AccentShade).disc(20.6, 7.6, 1.2, R.Body);
      default: // a crook
        path(p, arc(22, 9, 5.5, -60, 200, 10), 4, R.Body);
        return p.disc(22, 9, 2.8, R.Accent);
    }
  },
  whip: (p: Pen) => {
    path(p, [[9, 23], [12, 15], [18, 12], [23, 16], [27, 12], [29, 5]], 4.6, R.Body);
    path(p, [[13, 16], [18, 13.5], [22, 17]], 1.2, R.Shade);
    for (const [x, y] of [[11, 18], [16, 11.5], [21, 14.5], [26, 14]] as const) p.disc(x, y, 1.5, R.Shade);
    return p.stroke([3.5, 29.5], [9, 23], 4.4, R.Accent).disc(3.5, 29.5, 2.5, R.AccentShade);
  },
  tentacle: (p: Pen, k: number) => {
    const pts: P[] = k % 2 ? [[24, 29], [19, 22], [21, 15], [16, 8], [8, 5]] : [[7, 29], [12, 22], [11, 15], [16, 8], [24, 5]];
    path(p, pts, 5.4, R.Accent);
    p.stroke(pts[4], k % 2 ? [3, 7] : [29, 7], 2.6, R.Accent);
    for (const q of pts.slice(1, 4)) p.disc(q[0] + (k % 2 ? 0.8 : -0.8), q[1], 1.4, R.Body);
    return p.stroke(pts[1], pts[2], 1.2, R.AccentShade);
  },
  hook: (p: Pen, k: number) => {
    p.stroke([6, 29], [16, 15], 3.6, R.Shade);
    if (k % 2 === 0) {
      // a grappling hook: three prongs
      for (const a of [-50, 30, 110]) path(p, arc(19, 11, 6.5, a, a + 75, 4), 3.6, R.Body);
      return p.disc(17, 13, 3.4, R.Accent).box(4, 26.5, 9.5, 31, R.Accent);
    }
    // a single hook on a chain
    p.ring(20, 9, 4.2, 8.2, R.Body).box(13, 2, 21, 10, R.None).poly([[11, 8], [15, 1.5], [17.5, 9]], R.Body);
    for (const q of [[8.5, 25.5], [12, 21]] as const) p.ring(q[0], q[1], 0.8, 2.6, R.Accent);
    return p.disc(16, 14, 3, R.Accent);
  },
  hoe: (p: Pen) => p.stroke([5, 29], [20, 9], 4.2, R.Shade).poly([[15, 3], [27, 4], [31, 15], [23, 12]], R.Body).poly([[23, 12], [31, 15], [27, 4], [25.5, 9]], R.Shade).disc(19, 8.5, 3, R.Accent).disc(4.5, 29.5, 2.2, R.Accent),

  // ---- armour ---------------------------------------------------------------------------------------------------
  shield: scaled(0.94, (p: Pen, k: number) => {
    switch (k % 6) {
      case 0: // heater with a cross
        return p.poly([[6, 4], [26, 4], [26, 15], [16, 28], [6, 15]], R.Body).mask(R.Body, x => x < 16, R.Shade).box(14.2, 6, 17.8, 24, R.Accent).box(8, 11.4, 24, 15, R.Accent);
      case 1: // round with a boss
        return p.disc(16, 16, 12.5, R.Body).mask(R.Body, (x, y) => x + y < 32, R.Shade).ring(16, 16, 9.5, 11, R.Accent).disc(16, 16, 3.4, R.Accent);
      case 2: // kite
        return p.poly([[16, 2], [26, 9], [16, 30], [6, 9]], R.Body).mask(R.Body, x => x < 16, R.Shade).poly([[16, 7], [21, 11], [16, 22], [11, 11]], R.Accent);
      case 3: // tower with rivets
        p.box(8, 3, 24, 29, R.Body).box(16, 3, 24, 29, R.Shade).box(8, 13, 24, 17, R.Accent);
        for (const [x, y] of [[10.5, 6], [21.5, 6], [10.5, 26], [21.5, 26]] as const) p.disc(x, y, 1.1, R.Ink);
        return p;
      case 4: // buckler with a crystal
        return p.disc(16, 16, 11.5, R.Body).mask(R.Body, (x, y) => x + y < 32, R.Shade).poly([[16, 8], [21, 16], [16, 24], [11, 16]], R.Accent).poly([[16, 8], [21, 16], [16, 16]], R.AccentShade);
      default: // spiked round
        p.disc(16, 16, 11, R.Body).mask(R.Body, (x, y) => x + y < 32, R.Shade);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          p.poly([[16 + Math.cos(a - 0.25) * 10, 16 + Math.sin(a - 0.25) * 10], [16 + Math.cos(a) * 14.5, 16 + Math.sin(a) * 14.5], [16 + Math.cos(a + 0.25) * 10, 16 + Math.sin(a + 0.25) * 10]], R.Accent);
        }
        return p.disc(16, 16, 3.6, R.Accent);
    }
  }),
  helm: scaled(0.9, (p: Pen, k: number) => {
    p.disc(16, 15, 10.5, R.Body).box(5.5, 15, 26.5, 26, R.Body).mask(R.Body, x => x < 17, R.Shade).box(8, 19, 24, 21, R.Ink).box(15, 21, 17, 26, R.Ink);
    if (k % 2 === 0) return p.poly([[13, 5], [16, 0.5], [19, 5]], R.Accent).box(5, 24, 27, 26.5, R.Accent);
    return p.poly([[6, 10], [1, 2], [3, 11], [6.5, 15]], R.Accent).poly([[26, 10], [31, 2], [29, 11], [25.5, 15]], R.Accent);
  }),
  boots: scaled(0.95, (p: Pen, k: number) => {
    // three-quarter view: the shaft rising to a cuff, the heel behind, the toe forward and right
    const tall = k % 2 === 1;
    const top = tall ? 3 : 9;
    p.poly([[8, top], [18, top], [19, 19], [27, 22], [28, 27], [26, 29], [9, 29], [7, 26]], R.Body).mask(R.Body, (x, y) => x < 13 || y < 20, R.Shade);
    p.box(7, top - 1, 19, top + 3, R.Accent).box(7, 27, 28, 29.5, R.Ink).box(7, 25, 12, 29.5, R.AccentShade);
    if (k % 4 === 2) p.box(8, 16, 18.5, 18, R.Accent).box(12, 15, 14, 19, R.Ink);
    if (k % 4 === 3) p.poly([[18, top + 3], [25, top - 1], [22, top + 5]], R.Accent);
    return p;
  }),
  gloves: scaled(0.95, (p: Pen, k: number) => {
    const fist = k % 4 === 1;
    if (fist) {
      p.box(6, 7, 25.5, 21, R.Body).mask(R.Body, x => x < 17, R.Shade);
      for (const y of [10.5, 14, 17.5]) p.box(6, y, 25.5, y + 0.9, R.Ink);
      p.ellipse(7, 14, 3.2, 5, 0, R.Body);
    } else {
      p.stroke([9, 16], [9, 7], 3.4, R.Body).stroke([13, 15], [13, 4], 3.4, R.Body).stroke([17, 15], [17, 4.5], 3.4, R.Body).stroke([21, 16], [21, 7.5], 3.4, R.Body).stroke([23, 20], [28, 14], 3.4, R.Body);
      p.box(7.5, 14, 23, 21, R.Body).box(16, 14, 23, 21, R.Shade);
      if (k % 4 === 3) p.box(7.5, 9, 23, 11.5, R.None).box(8, 11, 23, 14, R.Shade);
      if (k % 4 === 2) for (const x of [9, 13, 17, 21]) p.poly([[x - 1.6, 7 - (x === 13 || x === 17 ? 2.5 : 0)], [x, 2 - (x === 13 || x === 17 ? 2 : 0)], [x + 1.6, 7 - (x === 13 || x === 17 ? 2.5 : 0)]], R.Accent);
    }
    return p.box(8, 21, 22, 29, R.Accent).box(8, 26.5, 22, 29, R.AccentShade);
  }),
  armor: scaled(0.96, (p: Pen, k: number) => {
    // a cuirass: the breastplate with its neck opening and arm holes, a waist plate
    p.poly([[8, 5], [12, 4], [16, 7], [20, 4], [24, 5], [27, 10], [24, 14], [24, 27], [8, 27], [8, 14], [5, 10]], R.Body).mask(R.Body, x => x < 16.5, R.Shade);
    p.ellipse(16, 4.5, 4, 3, 0, R.None);
    switch (k % 6) {
      case 0: // a ridge and a belt
        return p.stroke([16, 9], [16, 22], 1.4, R.Ink).box(8, 21, 24, 23.5, R.Accent);
      case 1: // pauldrons
        return p.ellipse(7, 10, 4, 3.4, -0.5, R.Accent).ellipse(25, 10, 4, 3.4, 0.5, R.AccentShade).box(8, 22, 24, 24, R.Ink);
      case 2: // scales
        for (const y of [12, 17, 22]) for (const x of [11, 16, 21]) p.disc(x, y, 1.4, R.Accent);
        return p;
      case 3: // a laced leather vest
        for (const y of [11, 15, 19, 23]) p.stroke([14, y], [18, y + 2.4], 1.2, R.Accent).stroke([18, y], [14, y + 2.4], 1.2, R.Accent);
        return p;
      case 4: // a plate with a gem
        return p.disc(16, 15, 3.2, R.Accent).box(8, 22.5, 24, 27, R.AccentShade);
      default: // chain mail
        for (let y = 10; y < 26; y += 3) for (let x = 9.5 + ((y / 3) % 2) * 1.5; x < 23.5; x += 3) p.disc(x, y, 0.9, R.Ink);
        return p.box(8, 24.5, 24, 27, R.Accent);
    }
  }),
  robe: scaled(0.86, (p: Pen, k: number) => {
    // a hooded robe: the hood around a dark face, sleeves out to the sides, the skirt flaring
    const cape = k % 2 === 1;
    if (!cape) p.stroke([11, 12], [4.5, 21], 4.6, R.Body).stroke([21, 12], [27.5, 21], 4.6, R.Shade).disc(4.5, 21.5, 2.4, R.Accent).disc(27.5, 21.5, 2.4, R.AccentShade);
    p.poly([[11, 9], [21, 9], cape ? [29, 30] : [26, 30], cape ? [3, 30] : [6, 30]], R.Body).mask(R.Body, x => x < 16, R.Shade);
    p.ellipse(16, 8, 6.4, 6, 0, R.Body).mask(R.Body, (x, y) => x <= 16 || y > 14, R.Shade).ellipse(16, 9, 3.2, 3.2, 0, R.Ink);
    if (k % 4 < 2) p.box(10, 18, 22, 20, R.Accent);
    if (k % 4 >= 2) for (const x of [8, 13, 18, 23]) p.poly([[x - 2.5, 30.5], [x, 26.5], [x + 2.5, 30.5]], R.None);
    return p;
  }),
  hood: scaled(0.96, (p: Pen, k: number) => {
    p.poly([[16, 3], [25, 13], [27, 28], [5, 28], [7, 13]], R.Body).mask(R.Body, x => x < 16, R.Shade).ellipse(16, 18, 5.6, 6, 0, R.Ink);
    if (k % 2 === 0) return p.box(6, 25, 26, 28, R.Accent);
    return p.poly([[16, 3], [19.5, 7], [16, 11], [12.5, 7]], R.Accent).box(6, 26.5, 26, 28, R.AccentShade);
  }),
  crown: (p: Pen, k: number) => {
    switch (k % 3) {
      case 0: // a spiked crown
        return p.poly([[4, 25], [4, 11], [10, 17], [16, 7], [22, 17], [28, 11], [28, 25]], R.Body).mask(R.Body, x => x < 16, R.Shade).box(4, 21, 28, 25, R.Accent).disc(16, 16, 2.2, R.Accent);
      case 1: // a wreath of flowers
        path(p, arc(16, 23, 11.5, 10, 170, 10), 4.4, R.Shade);
        for (const a of [22, 58, 94, 130, 164]) {
          const [x, y] = arc(16, 23, 11.5, a, a, 1)[0];
          p.disc(x, y, 4, R.Accent).disc(x, y, 1.4, R.Body);
        }
        return p;
      default: // a stone circlet with a set stone
        return p.ellipse(16, 18, 13.5, 8.5, 0, R.Body).ellipse(16, 18, 8.5, 4, 0, R.None).mask(R.Body, (_x, y) => y < 18, R.Shade).poly([[16, 8], [20, 13], [16, 18], [12, 13]], R.Accent);
    }
  },
  mask: scaled(0.94, (p: Pen) => p.ellipse(16, 16, 10.5, 12.5, 0, R.Body).mask(R.Body, x => x < 17, R.Shade).ellipse(11.5, 13, 3, 2.2, 0.2, R.Ink).ellipse(20.5, 13, 3, 2.2, -0.2, R.Ink).box(11, 21.5, 21, 23, R.Ink).stroke([16, 3.5], [16, 9], 2, R.Accent)),
  bracer: (p: Pen, k: number) => {
    p.poly([[9, 5], [23, 5], [25, 27], [7, 27]], R.Body).mask(R.Body, x => x < 16, R.Shade);
    if (k % 2 === 0) return p.box(7.5, 9, 24.5, 12, R.Accent).box(7.5, 19, 25, 22, R.Accent).disc(16, 15.5, 1.8, R.Ink);
    return p.poly([[16, 9], [21, 16], [16, 23], [11, 16]], R.Accent).box(8, 5, 24, 7.5, R.AccentShade);
  },
  scale: (p: Pen) => p.poly([[16, 4], [26, 9], [25, 20], [16, 28], [7, 20], [6, 9]], R.Body).mask(R.Body, x => x < 16, R.Shade).stroke([16, 7], [16, 25], 1.4, R.Accent).stroke([16, 13], [10, 9], 1.2, R.Accent).stroke([16, 13], [22, 9], 1.2, R.Accent).stroke([16, 20], [9, 16], 1.2, R.Accent).stroke([16, 20], [23, 16], 1.2, R.Accent),

  // ---- accessories ------------------------------------------------------------------------------------------------
  ring: (p: Pen, k: number) => {
    p.ring(16, 19, 6.5, 10, R.Body).ring(16, 19, 6.5, 7.6, R.Shade).poly([[11, 9], [21, 9], [18, 5], [14, 5]], R.Shade);
    if (k % 2 === 0) return p.disc(16, 7.5, 4.2, R.Accent).disc(15, 6.5, 1.2, R.Body);
    return p.poly([[16, 1.5], [20, 7.5], [16, 11], [12, 7.5]], R.Accent).poly([[16, 1.5], [20, 7.5], [16, 7.5]], R.AccentShade);
  },
  amulet: (p: Pen, k: number) => {
    p.stroke([6, 3], [13, 14], 1.8, R.Shade).stroke([26, 3], [19, 14], 1.8, R.Shade);
    switch (k % 6) {
      case 0: // a round pendant
        return p.disc(16, 21, 8, R.Body).disc(16, 21, 5.4, R.Accent).disc(14.5, 19.5, 1.5, R.Body);
      case 1: // a shield-shaped badge
        return p.poly([[9, 14], [23, 14], [23, 21], [16, 29], [9, 21]], R.Body).mask(R.Body, x => x < 16, R.Shade).box(14.5, 15.5, 17.5, 26, R.Accent).box(10.5, 18, 21.5, 21, R.Accent);
      case 2: // an hourglass
        return p.poly([[8, 13], [24, 13], [17.5, 21], [24, 29.5], [8, 29.5], [14.5, 21]], R.Body).mask(R.Body, x => x < 16, R.Shade).poly([[12, 26.5], [20, 26.5], [16, 22.5]], R.Accent).poly([[12.5, 15.5], [19.5, 15.5], [16, 19]], R.Accent);
      case 3: // a four-leaf clover
        for (const [x, y] of [[12.5, 17.5], [19.5, 17.5], [12.5, 24.5], [19.5, 24.5]] as const) p.disc(x, y, 3.8, R.Accent);
        return p.mask(R.Accent, (x, y) => x + y < 37, R.AccentShade).disc(16, 21, 1.8, R.Body);
      case 4: // a drop of venom in a ring
        return p.ring(16, 22, 5, 8.6, R.Body).disc(16, 23, 3.6, R.Accent).poly([[16, 14.5], [19.4, 21.5], [12.6, 21.5]], R.Accent);
      default: // a bolt
        return p.disc(16, 21, 8, R.Body).poly([[17.5, 14.5], [12, 22], [16, 22], [14.5, 28], [20, 20], [16, 20]], R.Accent);
    }
  },
  belt: (p: Pen, k: number) => {
    p.box(2, 12, 30, 20, R.Body).box(2, 17, 30, 20, R.Shade);
    if (k % 2 === 0) return p.box(11, 9, 21, 23, R.Accent).box(14, 12, 18, 20, R.Ink).disc(5, 16, 1, R.Ink).disc(27, 16, 1, R.Ink);
    return p.disc(16, 16, 6.5, R.Accent).disc(16, 16, 3, R.Ink).box(22, 13.5, 30, 15, R.Ink);
  },
  cross: (p: Pen) => p.box(13, 3, 19, 29, R.Body).box(6, 9, 26, 15, R.Body).box(16, 3, 19, 29, R.Shade).box(16, 12, 26, 15, R.Shade).disc(16, 12, 3.4, R.Accent),
  gem: (p: Pen, k: number) => {
    switch (k % 3) {
      case 0: // a brilliant cut
        return p.poly([[9, 5], [23, 5], [29, 12], [16, 28], [3, 12]], R.Accent).poly([[9, 5], [23, 5], [20, 12], [12, 12]], R.Body).poly([[3, 12], [12, 12], [16, 28]], R.AccentShade).stroke([12, 12], [16, 27], 1, R.Body);
      case 1: // a cabochon in a setting
        return p.ellipse(16, 16, 11, 9, 0, R.Body).ellipse(16, 16, 8.6, 6.8, 0, R.Accent).mask(R.Accent, (x, y) => x + y < 33, R.AccentShade).ellipse(12.5, 13, 2.4, 1.4, -0.4, R.Body);
      default: // a long hexagonal crystal
        return p.poly([[16, 2], [24, 9], [24, 23], [16, 30], [8, 23], [8, 9]], R.Accent).mask(R.Accent, x => x < 16, R.AccentShade).poly([[16, 2], [24, 9], [16, 12], [8, 9]], R.Body).stroke([16, 12], [16, 29], 1, R.Body);
    }
  },
  crystal: (p: Pen, k: number) => {
    const shard = (x: number, w: number, top: number, role: 1 | 3): void => {
      p.poly([[x - w, 30], [x - w, top + w * 1.8], [x, top], [x + w, top + w * 1.8], [x + w, 30]], role);
      p.poly([[x, top], [x + w, top + w * 1.8], [x + w, 30], [x, 30]], role === 3 ? R.AccentShade : R.Shade);
    };
    switch (k % 4) {
      case 0: // a shard and two splinters
        shard(14, 4.5, 3, 3);
        shard(23, 3, 12, 1);
        shard(7, 2.5, 18, 1);
        return p;
      case 1: // one tall prism
        shard(16, 5.5, 2, 3);
        return p.stroke([14, 9], [14, 26], 1.1, R.Body);
      case 2: // two crossed prisms
        p.poly([[6, 27], [16, 5], [20, 7], [11, 29]], R.Accent).poly([[26, 27], [16, 5], [12, 7], [21, 29]], R.Body);
        return p.mask(R.Body, x => x < 18, R.Shade);
      default: // a star of three
        shard(16, 4, 4, 3);
        p.poly([[4, 26], [9, 13], [13, 16], [9, 29]], R.Body).poly([[28, 26], [23, 13], [19, 16], [23, 29]], R.Shade);
        return p;
    }
  },
  stone: scaled(0.92, (p: Pen, k: number) => {
    switch (k % 6) {
      case 0: // a rough ore with a seam
        return p.poly([[6, 12], [13, 5], [24, 6], [29, 15], [25, 27], [10, 28], [4, 21]], R.Body).poly([[24, 6], [29, 15], [25, 27], [16, 28], [18, 16]], R.Shade).stroke([10, 20], [15, 14], 1.8, R.Accent).stroke([15, 14], [21, 16], 1.8, R.Accent);
      case 1: // a rune pebble
        return p.ellipse(16, 17, 12, 10, -0.2, R.Body).mask(R.Body, (x, y) => x + y < 33, R.Shade).stroke([13, 12], [19, 22], 1.8, R.Accent).stroke([19, 12], [13, 17], 1.8, R.Accent);
      case 2: // a heavy block
        return p.poly([[5, 11], [17, 6], [28, 11], [28, 24], [16, 29], [5, 24]], R.Body).poly([[17, 16], [28, 11], [28, 24], [16, 29]], R.Shade).poly([[5, 11], [17, 6], [28, 11], [17, 16]], R.Accent);
      case 3: // a crowned queen stone
        return p.ellipse(16, 19, 11, 10, 0, R.Body).mask(R.Body, (x, y) => x + y < 35, R.Shade).poly([[9, 11], [11, 4], [14, 9], [16, 3], [18, 9], [21, 4], [23, 11]], R.Accent);
      case 4: // a mirror stone: a polished face
        return p.poly([[16, 3], [27, 12], [23, 28], [9, 28], [5, 12]], R.Body).mask(R.Body, x => x < 16, R.Shade).poly([[16, 8], [22, 13], [20, 23], [12, 23], [10, 13]], R.Accent).poly([[16, 8], [22, 13], [16, 15]], R.Body);
      default: // a banded armour stone
        return p.ellipse(16, 16, 12, 11, 0.3, R.Body).mask(R.Body, (x, y) => x + y < 33, R.Shade).box(5, 13, 27, 16, R.Accent).box(5, 19, 27, 21, R.AccentShade);
    }
  }),
  eye: scaled(0.94, (p: Pen) => p.disc(16, 16, 11.5, R.Body).mask(R.Body, (x, y) => x + y < 34, R.Shade).disc(16, 16, 6.2, R.Accent).disc(16, 16, 2.8, R.Ink).disc(13.5, 13.5, 1.3, R.Body).stroke([4.5, 13], [8, 15], 1, R.AccentShade).stroke([26, 21], [23, 19], 1, R.AccentShade)),
  quiver: (p: Pen) => p.poly([[9, 13], [16, 6], [26, 16], [19, 23]], R.Accent).poly([[19, 23], [26, 16], [23, 13], [16, 20]], R.AccentShade).stroke([12, 12], [5, 5], 1.8, R.Body).stroke([15, 9], [8, 2], 1.8, R.Body).poly([[3, 6], [5, 3], [7, 7]], R.Body).poly([[6, 3], [8, 0.5], [10, 4]], R.Body).stroke([18, 23], [24, 29], 4.4, R.Shade),
  bag: (p: Pen, k: number) => {
    p.disc(16, 20, 9.5, R.Body).mask(R.Body, (x, y) => x + y < 37, R.Shade).poly([[11, 9], [21, 9], [24, 4], [8, 4]], R.Body);
    if (k % 3 === 0) return p.box(10, 9, 22, 12, R.Accent).stroke([20, 12], [25, 16], 1.6, R.Accent);
    if (k % 3 === 1) return p.box(10, 9, 22, 12, R.Accent).disc(16, 21, 3.4, R.Accent);
    return p.box(10, 9, 22, 12, R.Accent).disc(13, 19, 1.6, R.Accent).disc(19, 23, 1.6, R.Accent).disc(18, 17, 1.2, R.Accent);
  },
  box: (p: Pen) => p.box(5, 10, 27, 27, R.Body).box(16, 10, 27, 27, R.Shade).box(5, 10, 27, 13.5, R.Accent).box(13, 11, 19, 18, R.Ink).box(14, 12, 18, 16, R.Accent),

  // ---- consumables -------------------------------------------------------------------------------------------------
  vial: (p: Pen, k: number) => bottle(p, k % 6),
  flask: (p: Pen, k: number) => {
    bottle(p, k === 0 ? 3 : 6);
    // the first flask is the empty bottle: glass only, the cork in the accent
    if (k === 0) p.mask(R.Accent, () => false, R.Body).mask(R.AccentShade, () => false, R.Shade).box(12, 2, 20, 5, R.Accent);
    return p;
  },
  pill: (p: Pen, k: number) => {
    // a capsule on the diagonal: a bone half and a coloured half (its named colour), a pattern for the reserved hues
    p.stroke([8, 24], [24, 8], 9.4, R.Body).stroke([16, 16], [24, 8], 9.4, R.Accent).stroke([17, 18.5], [25, 10.5], 2.6, R.AccentShade).stroke([7, 19], [13, 13], 1.6, R.Shade);
    if (k % 3 === 1) for (const [x, y] of [[18, 12], [21.5, 11.5], [19.5, 15.5], [23, 7.5]] as const) p.disc(x, y, 1.2, R.Ink);
    if (k % 3 === 2) for (const o of [0, 3.2]) p.stroke([16.4 + o, 10.4 - o], [20.6 + o, 14.6 - o], 1.2, R.Ink);
    return p;
  },
  fruit: (p: Pen, k: number) => {
    switch (k % 4) {
      case 0: // an apple with a leaf
        return p.disc(15, 19, 10, R.Accent).mask(R.Accent, (x, y) => x + y < 36, R.AccentShade).disc(11, 15, 2.2, R.Body).stroke([16, 9], [18, 3], 1.8, R.Shade).ellipse(23, 5, 4.4, 2.2, -0.4, R.Body);
      case 1: // a pear
        return p.disc(16, 22, 8, R.Accent).disc(16, 12, 5, R.Accent).mask(R.Accent, (x, y) => x + y < 37, R.AccentShade).disc(13, 18, 1.8, R.Body).stroke([16, 7], [14, 2], 1.8, R.Shade);
      case 2: // a cluster of berries
        for (const [x, y, r] of [[11, 19, 5], [20, 18, 5], [15.5, 25, 5], [16, 12, 4.4]] as const) p.disc(x, y, r, R.Accent);
        return p.mask(R.Accent, (x, y) => x + y < 36, R.AccentShade).disc(10, 17, 1.4, R.Body).disc(19, 16, 1.4, R.Body).stroke([16, 8], [20, 3], 1.6, R.Shade);
      default: // a cracked nut
        return p.ellipse(16, 17, 9.6, 11, 0.5, R.Body).mask(R.Body, (x, y) => x + y < 33, R.Shade).stroke([10, 11], [22, 23], 1.6, R.Accent).stroke([13, 16], [17, 12], 1.2, R.Accent);
    }
  },
  meat: (p: Pen, k: number) => {
    switch (k % 3) {
      case 0: // a drumstick: the bulb of meat, the bone out of it ending in a knob
        p.stroke([8, 24], [15, 17], 3.6, R.Body).disc(5, 26.5, 2.8, R.Body).disc(7.5, 29, 2.8, R.Body).mask(R.Body, (x, y) => x + y < 33, R.Shade);
        return p.ellipse(20, 12, 9.5, 7.5, -0.75, R.Accent).mask(R.Accent, (x, y) => x + y < 31, R.AccentShade).ellipse(17.5, 9.5, 2.8, 1.6, -0.75, R.Body);
      case 1: // a slab with its bone
        return p.ellipse(16, 17, 12.5, 9, -0.2, R.Accent).mask(R.Accent, (x, y) => x + y < 34, R.AccentShade).ellipse(12, 15, 4, 2.6, -0.2, R.Body).ring(12, 15, 1.2, 2.6, R.Shade);
      default: // a lump of overgrown flesh
        for (const [x, y, r] of [[13, 18, 8], [20, 14, 6], [21, 22, 5.5]] as const) p.disc(x, y, r, R.Accent);
        return p.mask(R.Accent, (x, y) => x + y < 36, R.AccentShade).disc(11, 15, 1.6, R.Body).disc(19, 11.5, 1.2, R.Body);
    }
  },
  mushroom: (p: Pen) => p.box(12, 15, 20, 29, R.Body).box(16, 15, 20, 29, R.Shade).ellipse(16, 13, 13, 9, 0, R.Accent).mask(R.Accent, (_x, y) => y < 15, R.None).box(3, 13.5, 29, 15.5, R.AccentShade).disc(10, 9, 1.8, R.Body).disc(19, 7, 1.6, R.Body).disc(23, 11, 1.4, R.Body),
  flower: (p: Pen) => p.stroke([16, 30], [16, 18], 2, R.Shade).ellipse(21, 25, 4, 2, 0.5, R.Shade).disc(16, 7, 4.2, R.Accent).disc(23, 12, 4.2, R.Accent).disc(20, 20, 4.2, R.AccentShade).disc(12, 20, 4.2, R.AccentShade).disc(9, 12, 4.2, R.Accent).disc(16, 14, 3.6, R.Body),
  herb: (p: Pen, k: number) => {
    switch (k % 4) {
      case 0: // a fern frond curling at its tip, leaflets down both sides
        path(p, [[10, 30], [12, 22], [15, 15], [20, 10], [24, 9]], 2, R.Shade);
        path(p, arc(22.5, 12.5, 3.5, 100, 400, 10), 2, R.Accent);
        for (const [x, y, a] of [[11, 24, 2.4], [13.5, 18, 2.2], [16.5, 13.5, 2]] as const) p.ellipse(x - 4, y - 1, 4.4, 1.8, a - 2.6, R.Accent).ellipse(x + 4, y + 1, 4.4, 1.8, a - 2.6, R.AccentShade);
        return p;
      case 1: // a sticky vine coiling up
        path(p, [[12, 30], [16, 24], [12, 18], [17, 12], [14, 6]], 3, R.Shade);
        for (const [x, y] of [[19, 23], [9.5, 17], [20, 11]] as const) p.ellipse(x, y, 5.4, 3.2, 0.4, R.Accent);
        return p.mask(R.Accent, x => x < 16, R.AccentShade).disc(14, 5, 2, R.Accent);
      case 2: // tall grass blades
        for (const [a, b, c] of [[[9, 30], [8, 14], [5, 5]], [[16, 30], [16, 12], [18, 2]], [[22, 30], [24, 15], [28, 7]]] as const) path(p, [a, b, c], 4.2, R.Accent);
        return p.mask(R.Accent, x => x > 20, R.AccentShade).stroke([7, 30], [25, 30], 2, R.Shade);
      default: // a moonlit fern: a crescent of leaflets
        path(p, arc(18, 17, 10, 105, 265, 10), 2.6, R.Shade);
        for (const a of [120, 150, 180, 210, 240]) {
          const [x, y] = arc(18, 17, 10, a, a, 1)[0];
          p.ellipse(x + 3.6, y, 4.6, 2.4, ((-a + 90) * Math.PI) / 180, R.Accent);
        }
        return p.mask(R.Accent, (_x, y) => y < 18, R.AccentShade).disc(23, 7.5, 3.6, R.Body);
    }
  },
  seed: (p: Pen, k: number) => {
    p.ellipse(16, 19, 8, 10.5, 0.35, R.Accent).mask(R.Accent, (x, y) => x + y < 37, R.AccentShade);
    if (k % 3 === 0) return p.stroke([13, 11], [11, 4], 1.8, R.Shade).ellipse(16, 4, 4, 2, -0.5, R.Body).ellipse(7, 5, 3.4, 1.8, 0.6, R.Body).disc(13, 17, 1.6, R.Body);
    if (k % 3 === 1) return p.stroke([10, 14], [21, 24], 1.4, R.Ink).stroke([11, 21], [16, 16], 1.2, R.Ink).disc(13, 15, 1.6, R.Body);
    return p.disc(13, 16, 1.6, R.Body).poly([[16, 8], [21, 3], [20, 9]], R.Body).stroke([16, 13], [24, 26], 1.2, R.Body);
  },
  egg: scaled(0.96, (p: Pen) => p.ellipse(16, 17, 10, 12.5, 0, R.Body).mask(R.Body, (x, y) => x + y * 0.6 < 27, R.Shade).disc(12, 12, 2.4, R.Accent).disc(20, 18, 3, R.Accent).disc(13, 23, 2, R.Accent).disc(19, 9, 1.4, R.Accent)),
  drop: (p: Pen, k: number) => {
    switch (k % 3) {
      case 0: // one drop
        return p.disc(16, 20, 8.6, R.Accent).poly([[16, 3], [24, 17], [8, 17]], R.Accent).mask(R.Accent, (x, y) => x + y < 37, R.AccentShade).ellipse(12.5, 18, 1.8, 3.2, 0.3, R.Body);
      case 1: // two drops
        p.disc(12, 21, 6.6, R.Accent).poly([[12, 8], [18.2, 19], [5.8, 19]], R.Accent).disc(23, 13, 4.6, R.Accent).poly([[23, 3], [27.2, 11], [18.8, 11]], R.Accent);
        return p.mask(R.Accent, (x, y) => x + y < 36, R.AccentShade).ellipse(9.5, 19, 1.4, 2.4, 0.3, R.Body);
      default: // a puddle of slime with bubbles
        return p.ellipse(16, 21, 13, 8, 0, R.Accent).mask(R.Accent, (x, y) => x + y < 38, R.AccentShade).disc(11, 18, 2.4, R.Body).disc(19, 7, 3, R.Accent).disc(25, 12, 2, R.AccentShade);
    }
  },
  bandage: (p: Pen, k: number) => {
    if (k % 2 === 0) return p.disc(13, 15, 9.5, R.Body).disc(13, 15, 4, R.Shade).disc(13, 15, 1.8, R.Ink).box(13, 21.5, 29, 24.5, R.Body).box(13, 23, 29, 24.5, R.Shade).stroke([5, 10], [9, 6], 1.2, R.Shade).box(24, 21.5, 26, 24.5, R.Accent);
    // an old frayed strip, knotted
    path(p, [[4, 24], [11, 18], [19, 19], [27, 10]], 6.4, R.Body);
    p.mask(R.Body, (x, y) => x + y < 33, R.Shade).disc(15, 18.5, 3, R.Accent);
    for (const [x, y] of [[3, 27], [5, 28.5], [28, 7], [29.5, 9]] as const) p.stroke([x, y], [x + (x < 16 ? -1 : 1.5), y + (x < 16 ? 2 : -2)], 1.2, R.Shade);
    return p;
  },
  book: scaled(0.9, (p: Pen) => p.box(7, 4, 25, 28, R.Shade).box(10, 5, 24, 26, R.Body).box(7, 4, 10, 28, R.Shade).box(12, 25, 24, 27, R.Accent).box(16, 9.5, 18, 20.5, R.Ink).box(12.5, 12.5, 21.5, 14.5, R.Ink).box(22, 13, 27, 18, R.Accent)),
  dust: (p: Pen, k: number) => {
    if (k % 2 === 0) return p.disc(16, 21, 8.5, R.Body).mask(R.Body, (x, y) => x + y < 38, R.Shade).poly([[12, 12], [20, 12], [22, 8], [10, 8]], R.Body).box(11, 11, 21, 13.5, R.Accent).disc(7, 6, 1.4, R.Accent).disc(25, 4, 1.8, R.Accent).disc(27, 11, 1.2, R.Accent).disc(4, 13, 1, R.Accent);
    // a heap of dust with motes rising
    return p.poly([[3, 28], [11, 17], [16, 13], [21, 17], [29, 28]], R.Body).mask(R.Body, x => x < 17, R.Shade).disc(16, 7, 1.8, R.Accent).disc(10, 9, 1.4, R.Accent).disc(22, 5, 1.6, R.Accent).disc(20, 11, 1.2, R.Accent).stroke([7, 26], [25, 26], 1.2, R.Accent);
  },
  bomb: (p: Pen) => p.disc(14, 19, 9.5, R.Shade).disc(11, 15, 3, R.Body).box(17, 7, 22, 11, R.Body).stroke([20, 8], [25, 3], 1.4, R.Body).poly([[26, 0], [28, 3], [31, 4], [28, 5], [26, 8], [25, 5], [22, 4], [25, 3]], R.Accent),

  // ---- loot ----------------------------------------------------------------------------------------------------------
  bone: (p: Pen) => p.stroke([9, 23], [23, 9], 5, R.Body).disc(6, 23, 3.6, R.Body).disc(9, 26, 3.6, R.Body).disc(23, 6, 3.6, R.Body).disc(26, 9, 3.6, R.Body).stroke([11, 23], [23, 11], 1.4, R.Shade),
  skull: scaled(0.96, (p: Pen) => p.disc(16, 13, 10.5, R.Body).box(9.5, 18, 22.5, 27, R.Body).mask(R.Body, (x, y) => x + y < 35, R.Shade).ellipse(11.5, 14, 3, 3.4, 0, R.Ink).ellipse(20.5, 14, 3, 3.4, 0, R.Ink).poly([[16, 18], [18, 22], [14, 22]], R.Ink).box(11.5, 24, 12.8, 27, R.Ink).box(15.4, 24, 16.6, 27, R.Ink).box(19.2, 24, 20.5, 27, R.Ink).disc(11.5, 14.5, 1.2, R.Accent).disc(20.5, 14.5, 1.2, R.Accent)),
  horned: (p: Pen) => p.disc(16, 16, 9, R.Body).box(10.5, 20, 21.5, 28, R.Body).mask(R.Body, (x, y) => x + y < 36, R.Shade).ellipse(12, 16.5, 2.6, 3, 0, R.Ink).ellipse(20, 16.5, 2.6, 3, 0, R.Ink).box(12, 25.5, 20, 27, R.Ink).poly([[8, 10], [2, 2], [3, 9], [7, 14]], R.Accent).poly([[24, 10], [30, 2], [29, 9], [25, 14]], R.Accent),
  fang: (p: Pen) => p.poly([[7, 5], [20, 4], [26, 10], [17, 30], [15, 16]], R.Body).poly([[20, 4], [26, 10], [17, 30], [19, 14]], R.Shade).box(7, 3, 21, 7, R.Accent).stroke([12, 9], [15, 20], 1, R.Shade),
  horn: (p: Pen) => path(p, [[22, 29], [21, 21], [16, 13], [9, 8], [4, 7]], 7, R.Body).stroke([21, 22], [16.5, 15], 2, R.Shade).stroke([24, 27], [20, 29], 5, R.Accent).stroke([3, 7], [1.5, 7.5], 2, R.Body),
  tail: (p: Pen) => path(p, [[3, 6], [10, 9], [14, 16], [16, 23], [22, 27]], 6, R.Accent).stroke([5, 7.5], [11, 10.5], 1.6, R.AccentShade).poly([[19, 22], [31, 23.5], [24, 32]], R.Body).poly([[24, 27], [31, 23.5], [24, 32]], R.Shade),
  limb: (p: Pen) => p.stroke([5, 27], [14, 15], 5.6, R.Body).stroke([14, 15], [26, 8], 4.8, R.Body).disc(14, 15, 4.8, R.Accent).disc(5, 27, 3.6, R.Shade).poly([[24, 3], [31, 6.5], [27, 12]], R.Body).stroke([16, 14], [24, 10], 1, R.Shade),
  claw: scaled(0.92, (p: Pen) => p.ellipse(10, 15, 3, 10.5, 0.35, R.Body).ellipse(17, 14, 3, 11.5, 0.15, R.Body).ellipse(24, 15, 3, 10.5, -0.1, R.Body).box(5, 23, 27, 29, R.Accent).box(5, 27, 27, 29, R.AccentShade)),
  orb: scaled(0.95, (p: Pen, k: number) => {
    p.disc(16, 14, 10, R.Accent).mask(R.Accent, (x, y) => x + y < 33, R.AccentShade).poly([[10, 23], [22, 23], [25, 29], [7, 29]], R.Shade);
    if (k % 2 === 0) return p.stroke([12, 10], [16, 16], 1.2, R.Body).stroke([16, 16], [21, 12], 1.2, R.Body).stroke([16, 16], [15, 21], 1.2, R.Body).disc(12, 9.5, 2, R.Body);
    return path(p, arc(16, 14, 5, 30, 330, 10), 1.4, R.Body).disc(16, 14, 1.6, R.Body);
  }),
  brain: scaled(0.96, (p: Pen) => {
    p.ellipse(11, 15, 7.5, 8.5, 0, R.Accent).ellipse(21, 15, 7.5, 8.5, 0, R.Accent).mask(R.Accent, x => x < 21, R.AccentShade).box(13, 22, 19, 28, R.Shade).stroke([16, 7], [16, 23], 1.2, R.Ink);
    path(p, [[6, 12], [9, 15], [12, 11]], 1.1, R.Ink);
    path(p, [[19, 18], [23, 15], [26, 19]], 1.1, R.Ink);
    return p;
  }),
  chip: (p: Pen) => p.box(8, 8, 24, 24, R.Body).box(16, 8, 24, 24, R.Shade).box(11.5, 11.5, 20.5, 20.5, R.Accent).box(3, 10, 8, 12, R.Body).box(3, 15, 8, 17, R.Body).box(3, 20, 8, 22, R.Body).box(24, 10, 29, 12, R.Shade).box(24, 15, 29, 17, R.Shade).box(24, 20, 29, 22, R.Shade).disc(10, 10, 1, R.Ink),
  nerve: (p: Pen) => path(p, [[4, 26], [11, 18], [9, 12], [17, 13], [19, 6], [26, 4]], 3.2, R.Body).stroke([11, 18], [16, 24], 2.6, R.Shade).stroke([17, 13], [24, 16], 2.6, R.Shade).disc(4, 26, 3.4, R.Accent).disc(26, 4, 3.4, R.Accent).disc(16, 24, 2.4, R.Accent).disc(24, 16, 2.4, R.Accent),
  branch: (p: Pen) => path(p, [[5, 29], [13, 19], [18, 9], [24, 3]], 3.8, R.Shade).stroke([13, 19], [24, 17], 2.8, R.Shade).stroke([17, 11], [10, 5], 2.4, R.Shade).ellipse(27, 16, 3.6, 2, 0.3, R.Accent).ellipse(8, 4, 3.4, 2, 0.7, R.Accent).ellipse(26, 3, 3, 1.8, -0.6, R.Accent).stroke([6, 27], [12, 20], 1, R.Body),
  leather: scaled(0.96, (p: Pen) => p.poly([[6, 8], [11, 5], [16, 8], [21, 5], [26, 8], [25, 15], [28, 23], [21, 27], [16, 24], [11, 27], [4, 23], [7, 15]], R.Body).poly([[16, 8], [21, 5], [26, 8], [25, 15], [28, 23], [21, 27], [16, 24]], R.Shade).stroke([10, 12], [22, 12], 1.2, R.Accent).stroke([10, 19], [22, 19], 1.2, R.Accent)),
  idol: (p: Pen) => p.disc(16, 8, 5, R.Body).poly([[10, 13], [22, 13], [26, 28], [6, 28]], R.Body).poly([[16, 13], [22, 13], [26, 28], [16, 28]], R.Shade).box(4, 27, 28, 30, R.Accent).ellipse(16, 8.5, 2.6, 1.2, 0, R.Ink).disc(16, 19, 2, R.Accent),
  wisp: (p: Pen, k: number) => {
    if (k % 2 === 0) return p.disc(16, 18, 8.5, R.Accent).poly([[9, 13], [12, 2], [16, 9], [21, 1], [23, 13]], R.Accent).mask(R.Accent, (x, y) => x + y < 36, R.AccentShade).ellipse(12.5, 18, 2, 2.6, 0, R.Ink).ellipse(19.5, 18, 2, 2.6, 0, R.Ink).poly([[11, 25], [16, 31], [21, 25]], R.AccentShade);
    // a breath: a curling wisp of smoke with a hollow face
    path(p, [[8, 28], [12, 22], [9, 15], [14, 9], [21, 7], [24, 3]], 5, R.Accent);
    return p.mask(R.Accent, (x, y) => x + y < 30, R.AccentShade).disc(18, 18, 6, R.Accent).ellipse(16, 17, 1.6, 2.2, 0, R.Ink).ellipse(20.5, 17, 1.6, 2.2, 0, R.Ink);
  },
  cloth: scaled(0.96, (p: Pen) => p.poly([[6, 7], [26, 5], [25, 24], [16, 28], [7, 25]], R.Body).poly([[16, 6], [26, 5], [25, 24], [16, 28]], R.Shade).stroke([10, 9], [9.5, 23], 1.2, R.Accent).stroke([16, 8], [16, 25], 1.2, R.Accent).stroke([22, 7], [22, 23], 1.2, R.AccentShade)),
  snail: scaled(0.93, (p: Pen) => p.box(3, 23, 28, 28, R.Accent).box(3, 26, 28, 28, R.AccentShade).disc(17, 15, 9.5, R.Body).ring(17, 15, 5.5, 7, R.Shade).ring(17, 15, 2, 3.2, R.Shade).mask(R.Body, (x, y) => x + y < 35, R.Shade).stroke([5, 23], [3, 16], 1.4, R.Accent).disc(3, 15, 1.4, R.Accent)),
  nest: scaled(0.96, (p: Pen) => p.ellipse(16, 20, 13.5, 7.5, 0, R.Shade).ellipse(16, 17.5, 10.5, 4.5, 0, R.Ink).disc(11, 13, 4.2, R.Accent).disc(19, 11.5, 4.6, R.Accent).disc(23.5, 15, 3.4, R.AccentShade).disc(17.5, 9.5, 1.4, R.Body).stroke([4, 20], [28, 22], 1, R.Body).stroke([6, 24], [26, 23], 1, R.Body)),
  whetstone: (p: Pen) => p.poly([[4, 19], [20, 5], [28, 12], [12, 26]], R.Body).poly([[12, 26], [28, 12], [26, 10], [10, 24]], R.Shade).stroke([8, 18], [20, 8], 1.4, R.Accent).stroke([11, 21], [23, 11], 1.4, R.Accent),
  lock: (p: Pen) => p.ring(16, 12, 5.5, 8, R.Shade).box(7, 13, 25, 28, R.Body).box(16, 13, 25, 28, R.Shade).disc(16, 19.5, 2.4, R.Ink).box(15, 20, 17, 25, R.Ink).box(7, 13, 25, 15, R.Accent),
  rune: (p: Pen) => p.disc(16, 16, 11, R.Shade).disc(15, 15, 9.6, R.Body).ring(15, 15, 7.6, 8.8, R.Accent),
  pool: (p: Pen) => p.ellipse(16, 22, 13.5, 7, 0, R.Shade).ellipse(16, 19, 11.5, 4.8, 0, R.Accent).ellipse(12, 18, 3.4, 1.4, 0, R.Body).disc(22, 10, 2.6, R.Accent).disc(10, 7, 2, R.AccentShade).disc(18, 4, 1.4, R.Accent),
  statue: scaled(0.9, (p: Pen, k: number) => {
    p.box(4, 26, 28, 30, R.Shade).ring(16, 9, 6.6, 8, R.Accent).disc(16, 9, 5.4, R.Body).poly([[9, 13], [23, 13], [26, 27], [6, 27]], R.Body).poly([[16, 13], [23, 13], [26, 27], [16, 27]], R.Shade);
    if (k % 2 === 0) return p.disc(16, 18, 2.4, R.Accent).stroke([21, 5], [13, 25], 1.2, R.Ink).poly([[23, 13], [26, 27], [20, 20]], R.None);
    return p.disc(16, 18, 3, R.Accent).disc(16, 18, 1.2, R.Body);
  }),
} as const satisfies Record<string, Glyph>;

export type GlyphId = keyof typeof ICON_GLYPHS;
