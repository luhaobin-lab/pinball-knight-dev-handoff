/**
 * Shared core types (ARCHITECTURE Appendix A.4): positions, class manifests, the content registry, the Demo data the
 * world carries. Contract file of core-contracts; changes go through its `needs`.
 */
import type { AssetPath, DemoTable, RichCurve } from '../../content/demo/types.ts';
import type { World } from './world.ts';

export type { AssetPath };
export type Tag = string;
/** World position in uu: x east, y south (the src/core/launch frame), z up. */
export interface Vec3 { x: number; y: number; z: number }
export interface Vec2 { x: number; y: number }
export interface Rotator { Pitch: number; Yaw: number; Roll: number }
export interface LinearColor { R: number; G: number; B: number; A: number }
/** UE FInputRange (a stat roll range, 结构 of 成长词条). */
export interface InputRange { Min: number; Max: number }

export type ClassKind = 'ability' | 'effect' | 'projectile' | 'actor' | 'card' | 'pickup' | 'decoration' | 'settlement' | 'other';

/** One entry of src/content/demo/classes.ts (content-bpkit). */
export interface ClassDef {
  readonly path: AssetPath;
  readonly name: string;
  readonly parent: AssetPath | null;
  readonly kind: ClassKind;
  readonly tags: readonly Tag[];                                   // CDO OwnedGameplayTags, inherited, redirected
  readonly vars: Readonly<Record<string, unknown>>;                // own variables: CDO defaults, mangled names
  readonly timelines: Readonly<Record<string, { readonly length: number; readonly tracks: Readonly<Record<string, RichCurve>> }>>;
  readonly components: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly rows: readonly string[];                                // live 'table:row' references
  readonly reachable: boolean;
}

/** One animation sequence of src/content/demo/anims.ts (content-bpkit): flipbook length and notifies, in seconds. */
export interface AnimDef {
  readonly path: AssetPath;
  readonly length: number;
  readonly notifies: readonly { readonly name: string; readonly time: number; readonly duration: number }[];
}

export type BpCtor<T = unknown> = (abstract new (world: World, def: ClassDef) => T) & { readonly path: AssetPath };

export interface ContentRegistry {
  get(path: AssetPath): BpCtor | undefined;
  readonly size: number;
  paths(): AssetPath[];
}

/** UE FHitResult, the fields the Demo reads. `actor` is the hit BpObject (typed loosely to keep this file leaf). */
export interface HitResult { actor: unknown; impactPoint: Vec3; impactNormal: Vec3; location: Vec3; normal: Vec3; blockingHit: boolean; time: number; distance: number;
  /** Identity of immutable traced geometry when no spawned actor exists; preserves class/tag source checks. */
  staticSurface?: { readonly kind: 'wall' | 'solid'; readonly tags: readonly string[]; readonly classes: readonly string[] } }

/** The Demo data a world carries: the tables (by asset path) and the generated manifests. */
export interface DemoData {
  /** A table by asset path (src/content/demo/registry.ts), undefined if the Demo has none. */
  table(asset: AssetPath): DemoTable<unknown> | undefined;
  /** src/content/demo/classes.ts by asset path (empty until wa/manifests). */
  readonly classes: Readonly<Record<AssetPath, ClassDef>>;
  /** src/content/demo/anims.ts: sequences by asset path. */
  readonly anims: Readonly<Record<AssetPath, AnimDef>>;
  /** src/content/demo/tags.ts: the registered gameplay tags. */
  readonly tags: readonly Tag[];
}

/** A text the player sees: a loc key of strings.json (namespace + key) and its format arguments. */
export interface TextRef { ns: string; key: string; args?: Readonly<Record<string, string | number>> }

export type PopupKind = 'damage' | 'heal' | 'charge' | 'infuse' | 'stamina' | 'corruption' | 'exp' | 'gold' | 'text';
export interface PopupPayload {
  popup: PopupKind; value: number | string; target: number | null; at: Vec3 | null;
  crit?: boolean; weak?: boolean; damageType?: string; stack?: number;
}
export interface LogLine { rich: string }
export interface UiOp { op: 'open' | 'close' | 'update'; widget: string; data?: unknown }
export type BgmState = '无' | '主界面' | '探索' | '战斗';
