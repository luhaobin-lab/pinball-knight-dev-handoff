/**
 * `createWorld` (ARCHITECTURE §4.1, §4.6, §4.9, §4.12; WAVE_A §3.5): the World every Demo object lives in. Deferred
 * spawn (construct with CDO defaults, `init`, `ReceiveBeginPlay`), destroy that keeps stale array slots (TURN-102),
 * monotonic ids, the scheduler and latent service, the presentation bus, coverage, class lookup with manifest stubs,
 * strict mode, the `'ported'` row filter, the modal service and traces over the src/core/launch geometry.
 */
import { demoAnims } from '../../content/demo/anims.ts';
import { demoClasses } from '../../content/demo/classes.ts';
import { demoTablesByAsset } from '../../content/demo/registry.ts';
import { demoTags } from '../../content/demo/tags.ts';
import type { DemoTable } from '../../content/demo/types.ts';
import type { PresentEvent } from '../api/events.ts';
import type { GameDebugOptions, SaveBlob } from '../api/types.ts';
import type { Systems } from '../bp/systems.ts';
import { 蓝图_能力 } from '../ability/ability.ts';
import { 蓝图_效果 } from '../ability/effect.ts';
import { 蓝图_发射物 } from '../ability/projectile.ts';
import { createLaunchWorld, sweepProbe, type LaunchWorld } from '../launch/index.ts';
import { piercingProfile, queryProfileEnabled } from './collision-profile.ts';
import { createRngDomains, type RngDomains } from '../rng/domains.ts';
import { createSystems } from '../sys/index.ts';
import { BP_ManeActor } from './actor.ts';
import { EventQueue } from './bus.ts';
import { BP_Actor_Card } from './card.ts';
import { Scheduler } from './clock.ts';
import { 蓝图_主角色控制器 } from './controller.ts';
import { CoverageCounters } from './coverage.ts';
import { 修炼物品格子组 } from './cult-grid.ts';
import { 修炼系统 } from './cult.ts';
import { Hasher, serialize } from './digest.ts';
import { makeFx } from './fx.ts';
import type { HasAnimationSnapshot } from './presentation-state.ts';
import { 蓝图_通用路口 } from './junction.ts';
import { ModalStack } from './modal.ts';
import { LatentService } from './latent.ts';
import { 蓝图_动作游戏模式 } from './mode.ts';
import { BpObject } from './object.ts';
import { BP_Actor_Other } from './other.ts';
import { BP_Actor_Player } from './player.ts';
import { ClassResolver } from './registry.ts';
import { g2Enemy, g2Tile, G2_SCOPE, stageFixedSkills } from './stage-scope.ts';
import { 蓝图_房间格子 } from './room-cell.ts';
import { 蓝图_房间 } from './room.ts';
import { 蓝图_动画结算 } from './settlement.ts';
import type { AnimDef, AssetPath, BpCtor, ClassDef, ContentRegistry, DemoData, HitResult, Vec3 } from './types.ts';
import type { Coverage, PresentBus, World, WorldTrace } from './world.ts';

/** An internal invariant violation (never bad input: `send` returns `{ ok: false }` for that). */
export class CoreError extends Error {
  override readonly name = 'CoreError';
}

/** The generated core classes (declarations by core-contracts): they register themselves here, not in content/bp. */
export const CORE_CLASSES: readonly BpCtor[] = [
  BP_ManeActor, BP_Actor_Player, BP_Actor_Other, BP_Actor_Card, 蓝图_动作游戏模式, 修炼系统, 修炼物品格子组, 蓝图_主角色控制器,
  蓝图_房间, 蓝图_房间格子, 蓝图_通用路口, 蓝图_动画结算, 蓝图_效果, 蓝图_能力, 蓝图_发射物,
];

/** A plain object for classes whose manifest chain ends in a native class we do not model. */
class GenericObject extends BpObject {
  static override readonly path: AssetPath = 'Script/Engine.Actor';
}

let demoDataCache: DemoData | null = null;

/** The Demo data from src/content/demo (tables, class / animation / tag manifests). */
export function demoData(): DemoData {
  if (demoDataCache) return demoDataCache;
  const anims: Record<AssetPath, AnimDef> = {};
  for (const [path, a] of Object.entries(demoAnims)) {
    anims[path] = { path, length: a.length, notifies: a.notifies.map(n => ({ name: n.name, time: n.time, duration: n.duration ?? 0 })) };
  }
  demoDataCache = {
    table: (asset: AssetPath): DemoTable<unknown> | undefined => (Object.hasOwn(demoTablesByAsset, asset) ? demoTablesByAsset[asset] : undefined),
    classes: demoClasses as unknown as Readonly<Record<AssetPath, ClassDef>>,
    anims,
    tags: demoTags,
  };
  return demoDataCache;
}

export interface WorldOptions {
  /** The class registry of src/content/bp (injected by the composition root). */
  readonly content: ContentRegistry;
  /** Run seed for the RNG domains (ignored when `rng` is given). */
  readonly seed?: number;
  /** Inject RNG domains (tests use fakes). */
  readonly rng?: RngDomains;
  readonly data?: DemoData;
  readonly strict?: boolean;
  readonly filter?: 'ported' | 'all';
  /** Module doubles (`withSystems`). */
  readonly systems?: Partial<Systems>;
  /**
   * The collision geometry traces run against (the room's floor grid and solids, built by the room / launch modules).
   * Bodies of live actors are added by the world. Default: no static geometry.
   */
  readonly geometry?: (world: World) => Parameters<typeof createLaunchWorld>[0];
  /** The createGame options the run / meta / save modules read (seed, save blob, debug flags). */
  readonly options?: GameWorldOptions;
}

export interface GameWorldOptions {
  readonly seed: number;
  readonly save?: SaveBlob;
  readonly debug?: GameDebugOptions;
}

/** What core-sim adds to the World contract for createGame, tests and tools. */
export interface SimWorld extends World {
  readonly options: GameWorldOptions;
  readonly scheduler: Scheduler;
  readonly latentImpl: LatentService;
  readonly counters: CoverageCounters;
  readonly events: EventQueue<PresentEvent>;
  /** The live objects in id order (destroyed objects drop out; arrays holding them keep their stale slots). */
  objects(): readonly BpObject[];
  objectById(id: number): BpObject | undefined;
  digest(): string;
  /** Replace the static trace geometry (room build). */
  setGeometry(g: WorldOptions['geometry']): void;
}

const ACTOR_RADIUS_DEFAULT = 28;

/**
 * SPEC-GAP: traces are planar (the launch core's top-down frame): a very tall probe so height never decides a hit.
 * Sphere queries retain a minimum radius; line queries below use an exact zero-width ray.
 */
function planarProbe(radius: number): { radius: number; halfHeight: number; z: number } {
  return { radius: Math.max(radius, 0.01), halfHeight: 1e6, z: 0 };
}

export function createWorld(o: WorldOptions): SimWorld {
  const clock = new Scheduler();
  const data = o.data ?? demoData();
  const counters = new CoverageCounters();
  const events = new EventQueue<PresentEvent>(() => clock.now);
  const strict = o.strict ?? false;
  const coreByPath = new Map<AssetPath, BpCtor>(CORE_CLASSES.map(c => [c.path, c]));
  const lookup = (path: AssetPath): BpCtor | undefined => o.content.get(path) ?? coreByPath.get(path);
  const resolver = new ClassResolver<BpCtor, ClassDef>({
    get: lookup,
    def: p => (Object.hasOwn(data.classes, p) ? data.classes[p] : undefined),
    fallback: def => {
      switch (def.kind) {
        case 'effect': return 蓝图_效果 as BpCtor;
        case 'ability': return 蓝图_能力 as BpCtor;
        case 'projectile': return 蓝图_发射物 as BpCtor;
        case 'settlement': return 蓝图_动画结算 as BpCtor;
        case 'card': return BP_Actor_Card as BpCtor;
        case 'actor': return BP_Actor_Other as BpCtor;
        default: return GenericObject as BpCtor;
      }
    },
  });

  // Rows → the classes that reference them (classes.ts `rows`), for isRowPorted.
  const rowClasses = new Map<string, AssetPath[]>();
  for (const def of Object.values(data.classes)) {
    for (const r of def.rows) {
      let l = rowClasses.get(r);
      if (!l) rowClasses.set(r, (l = []));
      l.push(def.path);
    }
  }

  // classes.rows describes direct skill references, not actors' 固定技能 or map widgets. Empty references alone
  // therefore cannot establish G2 readiness for a shop or an enemy row (WAVE_A §4).
  const rowPorted = (table: AssetPath, row: string, checking = new Set<string>()): boolean => {
    const name = table.slice(table.lastIndexOf('/') + 1).replace(/\..*$/, '');
    const key = `${name}:${row}`;
    if (checking.has(key)) return false;
    if (o.filter === 'ported') {
      if (name === '数据表_地图格' && !g2Tile(row)) return false;
      if (name === '数据表_敌人_普通' && !g2Enemy(row) && !(world.sys.tutorial as typeof world.sys.tutorial&{allowsEnemy?(w:World,n:string):boolean}).allowsEnemy?.(world,row)) return false;
    }
    if (!(rowClasses.get(key) ?? []).every(p => lookup(p) !== undefined)) return false;
    const asset = data.table(table) ? table : Object.keys(demoTablesByAsset).find(p => p.endsWith(`/${name}`));
    const value = asset ? data.table(asset)?.rows[row] as { 固定技能?: { DataTable: string | null; RowName: string }[] } | undefined : undefined;
    if (!value?.固定技能) return true;
    checking.add(key);
    const required = stageFixedSkills(o.filter ?? 'all', row, value.固定技能);
    if (o.filter === 'ported' && name === '数据表_敌人_普通' && row === G2_SCOPE.boss.row
      && required.length !== G2_SCOPE.boss.fixedSkills.length) return false;
    const ready = required.every(h => !h.DataTable || rowPorted(h.DataTable, h.RowName, checking));
    checking.delete(key);
    return ready;
  };

  // Live objects by id (insertion = id order). Destroyed objects leave it; arrays that hold them keep their slots.
  const byId = new Map<number, BpObject>();
  let ids = 0;
  let geometry = o.geometry;
  let mode: 蓝图_动作游戏模式 | null = null;
  let cult: 修炼系统 | null = null;
  const destroying = new Set<BpObject>();

  const latentImpl = new LatentService({
    clock,
    resolveTimeline: (path, name) => {
      const seen = new Set<string>();
      let def: ClassDef | undefined = data.classes[path];
      while (def && !seen.has(def.path)) {
        seen.add(def.path);
        if (def.timelines[name]) return def.timelines[name];
        def = def.parent ? data.classes[def.parent] : undefined;
      }
      return undefined;
    },
    anim: seq => {
      const a = Object.hasOwn(data.anims, seq) ? data.anims[seq] : undefined;
      return a ? { seconds: a.length, notifies: a.notifies } : undefined;
    },
    onAnim: (on, sequence, seconds, loop) => {
      (on as typeof on & HasAnimationSnapshot).ug_animation={sequence,startedAt:clock.now,seconds,loop};
      events.emit({ kind: 'actor.anim', id: on.id, sequence, seconds, loop });
    },
    missing: what => world.unported(`data: ${what}`),
  });

  const fx = makeFx(events);
  const bus: PresentBus = {
    fxFor: () => fx,
    emit: e => events.emit(e),
    drain: () => events.drain(),
  };

  const coverage: Coverage = {
    hit: what => counters.unportedHit(what),
    get counts() { return counters.combined(); },
  };

  const defOf = (ctor: BpCtor): ClassDef => {
    const p = ctor.path;
    if (Object.hasOwn(data.classes, p)) return data.classes[p];
    // Core or test classes without a manifest entry.
    return { path: p, name: p.slice(p.lastIndexOf('/') + 1), parent: null, kind: 'other', tags: [], vars: {}, timelines: {}, components: {}, rows: [], reachable: true };
  };

  const traceWorld = (channel: string, skipPawn = false): { lw: LaunchWorld; byKey: Map<string, BpObject>; overlapKeys: Set<string> } => {
    const def = geometry ? geometry(world) : {};
    const byKey = new Map<string, BpObject>();
    const overlapKeys = new Set<string>();
    const bodies = [...(def.bodies ?? [])];
    for (const x of byId.values()) {
      if (!(x instanceof BP_ManeActor) || !x.valid || x instanceof BP_Actor_Card) continue;
      if ((x as BP_ManeActor & { ug_碰撞开启?: boolean }).ug_碰撞开启 === false) continue;
      if (skipPawn || !queryProfileEnabled(x)) continue;
      const p = x.K2_GetActorLocation();
      const key = `#${x.id}`;
      byKey.set(key, x);
      // SPEC-GAP: actor collision as a circle of radius 宽度 (the launch core's body convention); channels are not modelled.
      bodies.push({ id: key, x: p.x, y: p.y, radius: x.宽度 > 0 ? x.宽度 : ACTOR_RADIUS_DEFAULT, tags: x.OwnedGameplayTags.toArray() });
    }
    const extra = world.sys.physics as typeof world.sys.physics & { effectBodyShapes?(w: World, channel: string): readonly {
      actor: BpObject; id: string; x: number; y: number; radius: number; blocking: boolean;
    }[] };
    for (const sphere of extra.effectBodyShapes?.(world, channel) ?? []) {
      byKey.set(sphere.id, sphere.actor); if (!sphere.blocking) overlapKeys.add(sphere.id);
      bodies.push({ id: sphere.id, x: sphere.x, y: sphere.y, radius: sphere.radius, halfHeight: sphere.radius, tags: sphere.actor.OwnedGameplayTags.toArray() });
    }
    const boxes=[...(def.boxes??[])];
    const boxApi=world.sys.physics as typeof world.sys.physics&{pickupBoxShapes?(w:World,channel:string):readonly{actor:BpObject;id:string;minX:number;maxX:number;minY:number;maxY:number;blocking:boolean}[]};
    for(const b of boxApi.pickupBoxShapes?.(world,channel)??[]){
      byKey.set(b.id,b.actor);if(!b.blocking)overlapKeys.add(b.id);
      boxes.push({id:b.id,minX:b.minX,maxX:b.maxX,minY:b.minY,maxY:b.maxY,tags:b.actor.OwnedGameplayTags.toArray()});
    }
    return { lw: createLaunchWorld({ ...def, bodies,boxes }), byKey, overlapKeys };
  };

  const toHit = (h: NonNullable<ReturnType<typeof sweepProbe>>, byKey: Map<string, BpObject>, from: Vec3, to: Vec3, overlapKeys: ReadonlySet<string>): HitResult => {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    return {
      actor: byKey.get(h.actor.id) ?? null,
      ...(h.actor.kind !== 'body' ? { staticSurface: { kind: h.actor.kind, tags: [...h.actor.tags], classes: [...h.actor.classes] } } : {}),
      impactPoint: { x: h.impactPoint.x, y: h.impactPoint.y, z: from.z },
      impactNormal: { x: h.normal.x, y: h.normal.y, z: 0 },
      location: { x: h.location.x, y: h.location.y, z: from.z },
      normal: { x: h.normal.x, y: h.normal.y, z: 0 },
      blockingHit: !overlapKeys.has(h.actor.id),
      time: h.time,
      distance: h.time * len,
    };
  };

  const trace: WorldTrace = {
    sphere(from, to, radius, channel, ignore = []) {
      const { lw, byKey, overlapKeys } = traceWorld(channel, channel === 'Pawn' && ignore.some(piercingProfile));
      const skip = new Set<string>(ignore.map(x => `#${x.id}`));
      const out: HitResult[] = [];
      // Multi trace: collect every overlapped body along the sweep in time order.
      for (let i = 0; i < 64; i++) {
        const h = sweepProbe(lw, from, to, planarProbe(radius), skip);
        if (!h) break;
        out.push(toHit(h, byKey, from, to, overlapKeys));
        // UE SphereTraceMultiByProfile includes all initial overlaps, including blocking ones. Preserve the existing
        // deterministic initial-overlap order; its equal-time tie order is not certified as Chaos-identical.
        if (!byKey.has(h.actor.id) && (from.x !== to.x || from.y !== to.y || from.z !== to.z)) break;
        skip.add(h.actor.id);
      }
      return out;
    },
    line(from, to, channel, ignore = []) {
      const { lw, byKey, overlapKeys } = traceWorld(channel), skip = new Set(ignore.map(x => `#${x.id}`));
      for (let i = 0; i < 64; i++) {
        const h = sweepProbe(lw, from, to, { radius: 0, halfHeight: 1e6, z: 0 }, skip);
        if (!h) return null;
        // A zero-width ray departing an exact surface touch is not entering that collider.
        if (h.time === 0 && !h.startPenetrating && (to.x - from.x) * h.normal.x + (to.y - from.y) * h.normal.y >= 0) {
          skip.add(h.actor.id); continue;
        }
        if (!overlapKeys.has(h.actor.id)) return toHit(h, byKey, from, to, overlapKeys);
        skip.add(h.actor.id); // UE single line trace reports blocking hits, not touch-only components.
      }
      return null;
    },
  };

  const world: SimWorld = {
    clock,
    latent: latentImpl,
    rng: o.rng ?? createRngDomains(o.seed ?? 0),
    data,
    get mode(): 蓝图_动作游戏模式 {
      if (!mode) throw new CoreError('world.mode used before the game mode exists');
      return mode;
    },
    get cult(): 修炼系统 {
      if (!cult) throw new CoreError('world.cult used before 修炼系统 exists');
      return cult;
    },
    sys: createSystems(o.systems),
    bus,
    coverage,
    modal: new ModalStack(),
    strict,
    filter: o.filter ?? 'all',
    trace,
    options: o.options ?? { seed: o.seed ?? 0 },
    scheduler: clock,
    latentImpl,
    counters,
    events,
    nextId: () => ++ids,
    spawn<T extends BpObject>(cls: AssetPath | BpCtor<T>, init?: (x: T) => void, at?: Vec3): T {
      let ctor: BpCtor;
      if (typeof cls === 'string') {
        const r = resolver.resolve(cls);
        if (!r) throw new CoreError(`spawn: unknown class ${cls}`);
        if (r.stub) {
          if (strict) throw new CoreError(`spawn: class ${cls} is not ported (strict)`);
          counters.stubHit(cls);
        }
        ctor = r.ctor;
      } else {
        ctor = cls as BpCtor;
      }
      const Concrete = ctor as unknown as new (w: World, d: ClassDef) => T;
      const x = new Concrete(world, defOf(ctor));
      counters.classHit(ctor.path);
      if (at) x.location = { ...at };
      byId.set(x.id, x);
      init?.(x);
      x.ReceiveBeginPlay();
      return x;
    },
    destroy(x: BpObject): void {
      if (!x.valid || destroying.has(x)) return;
      destroying.add(x);
      // UE order: Destroyed (ReceiveDestroyed) and EndPlay run while the actor is still valid.
      const hooks = x as unknown as { ReceiveDestroyed?: () => void; ReceiveEndPlay?: (reason: number) => void };
      hooks.ReceiveDestroyed?.();
      hooks.ReceiveEndPlay?.(0);
      x.valid = false;
      clock.cancelOwner(x);
      latentImpl.release(x);
      destroying.delete(x);
      byId.delete(x.id);
      if (x instanceof BP_ManeActor) events.emit({ kind: 'actor.despawn', id: x.id });
    },
    isValid(x: unknown): x is BpObject {
      return x instanceof BpObject && x.valid;
    },
    unported(what: string): void {
      if (strict) throw new CoreError(`unported: ${what}`);
      counters.unportedHit(what);
    },
    isPorted(path: AssetPath): boolean {
      return lookup(path) !== undefined;
    },
    isRowPorted(table: AssetPath, row: string): boolean {
      return rowPorted(table, row);
    },
    objects: () => [...byId.values()],
    objectById: id => byId.get(id),
    digest(): string {
      const h = new Hasher();
      const refs = { idOf: (v: object) => (v instanceof BpObject ? (v.valid ? v.id : -v.id) : undefined) }; // stale slots as −id
      h.update(`t=${clock.now};ids=${ids};`);
      for (const x of byId.values()) h.update(`@${x.id}:${x.def.path}:`).update(serialize(x, refs, x));
      for (const e of clock.pending()) h.update(`e${e.time}/${e.seq}/${e.owner instanceof BpObject ? e.owner.id : '-'}/${e.weak ? 'w' : 's'};`);
      h.update(serialize(world.rng.save(), refs));
      h.update(`modal=${JSON.stringify(world.modal.current)}`);
      return h.hex();
    },
    setGeometry(g) { geometry = g; },
  };

  // The engine objects that exist before the game mode's BeginPlay: the game mode, the player controller and the
  // cultivation system (the Demo spawns 修炼系统 inside the game mode's BeginPlay; world.cult needs it from the start).
  // Their BeginPlays run at boot (createGame), in the order the game mode's BeginPlay expects.
  const construct = <T extends BpObject>(ctor: BpCtor<T>): T => {
    const x = new (ctor as unknown as new (w: World, d: ClassDef) => T)(world, defOf(ctor as BpCtor));
    counters.classHit(ctor.path);
    byId.set(x.id, x);
    return x;
  };
  mode = construct(蓝图_动作游戏模式);
  mode.玩家控制器 = construct(蓝图_主角色控制器);
  cult = construct(修炼系统);
  return world;
}
