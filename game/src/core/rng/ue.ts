/**
 * UE randomness with the exact engine formulas (core-math §10, CORE-M-120/121/123).
 * - `UeStream` = FRandomStream, used wherever a blueprint uses a stream or MakeRandomStream.
 * - `Rand15` = the 15-bit generator standing in for CRT `rand()`; the unseeded engine primitives run on it with their
 *   float32 formulas, so every quantised probability (m / 32768) matches the Demo.
 * Engine-side (English) names follow the Kismet node names.
 */

const f32 = Math.fround;
/** float(1/32767) = 0x38000100 (UE's `1 / RAND_MAX`). */
const INV_RAND_MAX = f32(1 / 32767);
const TWO_INV_RAND_MAX = f32(2 / 32767);

// ---- FRandomStream (CORE-M-121) ----

/** FRandomStream: `InitialSeed` int32, `Seed` uint32. */
export interface UeStream { InitialSeed: number; Seed: number }

export function MakeRandomStream(seed: number): UeStream {
  return { InitialSeed: seed | 0, Seed: seed >>> 0 };
}

/** `Seed = Seed·196314165 + 907633515` (mod 2³²). */
function mutate(s: UeStream): void {
  s.Seed = (Math.imul(s.Seed, 196314165) + 907633515) >>> 0;
}

/** GetFraction: mutate, then `float(0x3F800000 | Seed >> 9) − 1`, in [0, 1). */
export function GetFraction(s: UeStream): number {
  mutate(s);
  return (s.Seed >>> 9) / 8388608;
}

/** `R = b − a + 1; R ≤ 0 → a` without mutating; else `a + trunc(f32(frac · f32(R)))`. */
export function RandomIntegerInRangeFromStream(s: UeStream, a: number, b: number): number {
  const r = b - a + 1;
  if (r <= 0) return a;
  return a + Math.trunc(f32(GetFraction(s) * f32(r)));
}

/** `Max ≤ 0 → 0` (no mutate); else `trunc(f32(frac · f32(Max)))`. */
export function RandomIntegerFromStream(s: UeStream, max: number): number {
  if (max <= 0) return 0;
  return Math.trunc(f32(GetFraction(s) * f32(max)));
}

/** float a, b: `f32(f32((b − a) · frac) + a)`. */
export function RandomFloatInRangeFromStream(s: UeStream, a: number, b: number): number {
  const fa = f32(a);
  const d = f32(f32(b) - fa);
  return f32(f32(d * GetFraction(s)) + fa);
}

/** Index, −1 if empty (no mutate). */
export function Array_RandomFromStream<T>(s: UeStream, arr: readonly T[]): number {
  if (arr.length === 0) return -1;
  return Math.trunc(GetFraction(s) * arr.length);
}

/** `for i in 0..n−1: j = i + trunc(frac · (n − i))`, n mutations. */
export function Array_ShuffleFromStream<T>(s: UeStream, arr: T[]): void {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    const j = i + Math.trunc(GetFraction(s) * (n - i));
    if (i !== j) {
      const t = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = t;
    }
  }
}

export function copyStream(s: UeStream): UeStream {
  return { InitialSeed: s.InitialSeed, Seed: s.Seed };
}

// ---- Rand15 and the unseeded primitives (CORE-M-120, CORE-M-123) ----

/** CRT-style 15-bit generator replacing rand() (CORE-M-123). */
export interface Rand15 { state: number }

export function makeRand15(state: number): Rand15 {
  return { state: state >>> 0 };
}

/** One raw draw `k ∈ [0, 32767]`: `state = state·214013 + 2531011; k = (state >> 16) & 0x7FFF`. */
// Same-machine UCRT srand/rand matched1536 native draws (native-prd-oracle-0522). Original global seed/interleaving remains a gap.
export function rand15(g: Rand15): number {
  g.state = (Math.imul(g.state, 214013) + 2531011) >>> 0;
  return (g.state >>> 16) & 0x7fff;
}

/** FRand(k) = f32(f32(k) · f32(1/32767)): 32768 values in [0, 1], FRand(32767) = 1. */
export function frandOf(k: number): number {
  return f32(k * INV_RAND_MAX);
}

/** RandRange(a, b) for a given raw draw k (R = b − a + 1 > 0): `a + min(trunc(f32(f32(k)·f32(R)) · F), R − 1)`. */
export function randRangeOf(k: number, a: number, b: number): number {
  const r = b - a + 1;
  return a + Math.min(Math.trunc(f32(f32(k * f32(r)) * INV_RAND_MAX)), r - 1);
}

export function FRand(g: Rand15): number {
  return frandOf(rand15(g));
}

/** `(double)FRand · (b − a) + a`. */
export function RandomFloatInRange(g: Rand15, a: number, b: number): number {
  return FRand(g) * (b - a) + a;
}

/** FMath::RandRange / RandomIntegerInRange: `R ≤ 0 → a` with no draw. */
export function RandomIntegerInRange(g: Rand15, a: number, b: number): number {
  if (b - a + 1 <= 0) return a;
  return randRangeOf(rand15(g), a, b);
}

/** RandRange(0, Max − 1). */
export function RandomInteger(g: Rand15, max: number): number {
  return RandomIntegerInRange(g, 0, max - 1);
}

/** `min(trunc(f32(k) · f32(2/32767)), 1) == 1`, exactly 1/2. */
export function RandomBool(g: Rand15): boolean {
  return Math.min(Math.trunc(f32(rand15(g) * TWO_INV_RAND_MAX)), 1) === 1;
}

/** `W ≤ 0 → false` with no draw; else `W ≥ FRand` (W is a float parameter). */
export function RandomBoolWithWeight(g: Rand15, w: number): boolean {
  if (w <= 0) return false;
  return f32(w) >= FRand(g);
}

/** Index, −1 if empty (no draw). */
export function Array_Random<T>(g: Rand15, arr: readonly T[]): number {
  if (arr.length === 0) return -1;
  return RandomIntegerInRange(g, 0, arr.length - 1);
}

/** `for i in 0..n−1: j = RandRange(i, n−1); swap(i, j) if i != j`, n draws. */
export function Array_Shuffle<T>(g: Rand15, arr: T[]): void {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    const j = RandomIntegerInRange(g, i, n - 1);
    if (i !== j) {
      const t = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = t;
    }
  }
}
