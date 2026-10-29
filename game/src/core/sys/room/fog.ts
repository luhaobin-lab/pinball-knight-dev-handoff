/** Source: BP_ManeActor L12056/L11413/L12125 and 迷雾处理; 工具439/463; TA2 fog plane.
 * The cooked drawing pixel shader is decoded in FOG-SOURCE.md. No GPU or view query owns game state.
 */
import type { BP_ManeActor } from '../../sim/actor.ts';
import { BpObject } from '../../sim/object.ts';
import { isHiddenInGame } from '../../sim/engine.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import type { FogView } from '../../api/view.ts';
import { halfRed, fogRed } from './fog-color.ts';
export { fogRed } from './fog-color.ts';

export const FOG_SIZE = 512;
export const FOG_EXTENT = 2500;
const f = Math.fround;
const sat = (x: number): number => Number.isNaN(x) ? 0 : Math.max(0, Math.min(1, x));
export const fogUv = (p: Vec3): readonly [number, number] => [f((p.x + 1250) / 2500), f((p.y + 1250) / 2500)];

/** DXBC1407: projected segment distance -> inverted smoothstep(range,range*.3) -> max with old RT.
 * DXBC saturate(NaN)=0 handles the stationary segment's 0*rcp(0), rather than losing its reveal disc.
 * SPEC-GAP: CPU f32 operations have not been exhaustively compared with the original driver's fused MAD/rsq.
 */
export function fogBrush(u: number, v: number, a: readonly number[], b: readonly number[], range: number): number {
  if (!(Math.abs(range) > f(.00001)) || range < 0) return 0;
  const dx = f(b[0]! - a[0]!), dy = f(b[1]! - a[1]!);
  const px = f(u - a[0]!), py = f(v - a[1]!);
  const k = sat(f(f(f(px * dx) + f(py * dy)) * f(1 / f(f(dx * dx) + f(dy * dy)))));
  const x = f(px - f(k * dx)), y = f(py - f(k * dy));
  const d = f(Math.sqrt(f(f(x * x) + f(y * y)))), r = Math.max(range, f(.00001));
  const t = sat(f(f(d - r) / f(f(r * f(.3)) - r)));
  return f(f(t * t) * f(3 - f(2 * t)));
}

/** Canonical full-state encoding: nonzero runs of equal f32 bits, start/count/value in base36.
 * The private pixel cache is represented in full by toArray(), so world.digest includes every revealed pixel.
 * Rows are only rebuilt on writes; view() copies strings and never mutates the simulation or its RNG.
 */
export class FogMask {
  readonly #pixels = new Float32Array(FOG_SIZE * FOG_SIZE);
  readonly #bits = new Uint32Array(this.#pixels.buffer);
  readonly #rows = Array<string>(FOG_SIZE).fill('');
  toArray(): readonly string[] { return this.#rows; }
  snapshot(): readonly string[] { return this.#rows.slice(); }
  read(x: number, y: number): number { return this.#pixels[Math.max(0, Math.min(511, y)) * 512 + Math.max(0, Math.min(511, x))]!; }
  draw(a: readonly number[], b: readonly number[], range: number): void {
    if (!(range > .00001)) return;
    const x0 = Math.max(0, Math.floor((Math.min(a[0]!, b[0]!) - range) * 512));
    const x1 = Math.min(511, Math.ceil((Math.max(a[0]!, b[0]!) + range) * 512));
    const y0 = Math.max(0, Math.floor((Math.min(a[1]!, b[1]!) - range) * 512));
    const y1 = Math.min(511, Math.ceil((Math.max(a[1]!, b[1]!) + range) * 512));
    for (let y = y0; y <= y1; y++) {
      let changed = false;
      for (let x = x0; x <= x1; x++) {
        const i = y * 512 + x, value = halfRed(fogBrush((x + .5) / 512, (y + .5) / 512, a, b, range));
        if (value > this.#pixels[i]!) { this.#pixels[i] = value; changed = true; }
      }
      if (!changed) continue;
      const runs: string[] = [];
      for (let x = 0; x < 512;) {
        const value = this.#bits[y * 512 + x]!;
        if (!value) { x++; continue; }
        const start = x++;
        while (x < 512 && this.#bits[y * 512 + x] === value) x++;
        runs.push(`${start.toString(36)}.${(x - start).toString(36)}.${value.toString(36)}`);
      }
      this.#rows[y] = runs.join(',');
    }
  }
}

/** The level's StaticMeshActor tagged 迷雾, not a new Blueprint content class. */
class FogSurface extends BpObject {
  static override readonly path = 'Script/Engine.StaticMeshActor';
  bHiddenInGame = true; // The entry camp has already hidden this persistent level surface.
  ug_fogMask = new FogMask();
}
type RevealingActor = BP_ManeActor & { ug_fogMaterial?: { range: number } };
const lastDraw = new WeakMap<BP_ManeActor, { mask: FogMask; x: number; y: number; range: number }>();
function surface(w: World): FogSurface | null { const s = w.mode.迷雾图; return s instanceof FogSurface && w.isValid(s) ? s : null; }
export function ensureFog(w: World): void {
  if (surface(w)) return;
  w.mode.迷雾图 = w.spawn(FogSurface, undefined, { x: 0, y: 0, z: 200 });
}
export function clearFog(w: World): void { ensureFog(w); surface(w)!.ug_fogMask = new FogMask(); }
export function beginFog(self: BP_ManeActor): void {
  ensureFog(self.world);
  (self as RevealingActor).ug_fogMaterial = { range: 0 };
  self.setTickEnabled(true); // Source inherited ReceiveTick calls 迷雾处理 even while the actor is stationary.
  if (!self.OwnedGameplayTags.hasAny(['可交互.角色.玩家', '可交互.角色.AI.友善', '可交互.角色.AI.仇恨'])) return;
  self.delay('L11413 fog', .2, () => self.timeline('迷雾展开动画', 'PlayFromStart', {
    update: (_t, tracks) => { (self as RevealingActor).ug_fogMaterial!.range = f(sat(f(tracks['展开'] ?? 0)) * self.高度 * .002); },
    finished: () => { (self as RevealingActor).ug_fogMaterial!.range = f(self.高度 * .002); },
  }));
}
export function drawFog(self: BP_ManeActor): void {
  const material = (self as RevealingActor).ug_fogMaterial;
  if (!material || self.死掉了 || !['进行战斗', '交互场牌', '创建房间', '回合开始'].includes(self.world.mode.当前环节)) return;
  const s = surface(self.world); if (!s) return;
  const old = self.上一帧位置, p = self.K2_GetActorLocation(), prev = lastDraw.get(self);
  self.上一帧位置 = { ...p }; // Source writes this even for range0 and hidden fog.
  if (prev?.mask === s.ug_fogMask && prev.x === p.x && prev.y === p.y && prev.range === material.range && old.x === p.x && old.y === p.y) return;
  s.ug_fogMask.draw(fogUv(old), fogUv(p), material.range);
  lastDraw.set(self, { mask: s.ug_fogMask, x: p.x, y: p.y, range: material.range });
}
/** Exec143ba1570 clamps UV*size then truncates; pixel helper clamps to size-1. HDR ToFColorSRGB uses the native table. */
export function inFogAt(w: World, point: Vec3): boolean {
  const s = surface(w); if (!s || isHiddenInGame(s)) return false;
  const uv = fogUv(point);
  return fogRed(s.ug_fogMask.read(Math.floor(uv[0] * 512), Math.floor(uv[1] * 512))) < 80;
}
export function fogView(w: World): FogView | null {
  const s = surface(w); if (!s) return null;
  return { visible: !isHiddenInGame(s), size: 512, extent: 2500, height: 200, rows: s.ug_fogMask.snapshot() };
}
