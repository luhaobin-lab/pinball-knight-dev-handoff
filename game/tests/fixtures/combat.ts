/**
 * `combatFixture({ hero, enemies, equip, seed })` (ARCHITECTURE §7.5): a world with the hero, enemies on the field and
 * equipped item cards, plus the helpers system tests use. It drives the real modules through the facade; where a
 * module is not ported yet the helper says which double it falls back to (the fallbacks follow the documented Demo
 * behaviour and disappear as the modules land).
 *
 *   const w = combatFixture({ hero: '幽冥骑士', enemies: ['眼球'], equip: [{ row: '旧剑', quality: 1 }], seed: 1 });
 *   w.fire(w.effect('旧剑', '蓝图_效果_蓄能造成额外伤害'), '效果.时机.自身完成充能');
 *   w.hit({ from: w.hero, to: w.enemies[0], amount: 20, type: '物理' });
 *   w.turnStart(); w.launch({ deg: -60 }); w.runUntilInput();
 */
import { registry } from '../../src/content/bp/index.ts';
import type { BpCtor, ContentRegistry, Vec3 } from '../../src/core/sim/types.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { fireLive, tickCopy } from '../../src/core/ability/dispatch.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import type { PresentEvent } from '../../src/core/api/events.ts';
import type { 枚举_伤害类型, 枚举_伤害来源, 结构_角色 } from '../../src/content/demo/types.ts';
import type { Systems } from '../../src/core/bp/systems.ts';

const PLAYERS = 'CatapultHero/数据表/角色/数据表_玩家';
const ENEMIES = 'CatapultHero/数据表/角色/数据表_敌人_普通';
const ITEMS = 'CatapultHero/数据表/合成数据表_修炼物品';

export interface CombatFixtureOptions {
  hero?: string;
  enemies?: readonly string[];
  equip?: readonly { row: string; quality?: number }[];
  seed?: number;
  strict?: boolean;
  /** Module doubles: `withSystems({ … })` from tests/fixtures/systems.ts. */
  systems?: Systems;
  content?: ContentRegistry;
}

export interface CombatFixture {
  readonly world: SimWorld;
  readonly hero: BP_Actor_Player;
  readonly enemies: BP_Actor_Other[];
  readonly cards: BP_Actor_Card[];
  /** The first effect of class `cls` (asset name or path) owned by the named card, the hero or an enemy. */
  effect(owner: string | BP_ManeActor, cls: string): 蓝图_效果;
  /** The ability named 能力名 on an actor (active, passive or enchant). */
  ability(owner: BP_ManeActor, 能力名: string): 蓝图_能力;
  /** Dispatch `tag` to one effect (or a list) as a live dispatcher does. */
  fire(e: 蓝图_效果 | readonly (蓝图_效果 | null)[], tag: string, set?: (e: 蓝图_效果) => void): void;
  /** The real damage pipeline: from.造成即时伤害(伤害 { 来源, 类型, 数值, 目标 }). */
  hit(o: { from: BP_ManeActor; to: BP_ManeActor; amount: number; type?: 枚举_伤害类型; source?: 枚举_伤害来源 }): void;
  /** 新回合触发时机 (module turn); before core-turn lands, the ABILIT-062 double (equipped cards, hero, field). */
  turnStart(): void;
  /** Aim the hero (degrees, the launch frame) and cast skill 0 (the launch) through 使目标执行自身技能. */
  launch(o: { deg: number }): boolean;
  /** Advance game time until no skill is being cast and nothing is scheduled sooner than `maxSeconds`. */
  runUntilInput(maxSeconds?: number): 'stopped' | 'idle' | 'timeout';
  /** Advance game time by `seconds` in canonical frames. */
  advance(seconds: number): void;
  /** Every presentation event so far (or of one kind). */
  events<K extends PresentEvent['kind']>(kind?: K): Extract<PresentEvent, { kind: K }>[];
  hpOf(a: BP_ManeActor): number;
}

function rowOf(w: SimWorld, table: string, row: string): 结构_角色 {
  const r = w.data.table(table)?.rows[row] as 结构_角色 | undefined;
  if (!r) throw new Error(`combatFixture: ${table} has no row ${row}`);
  return r;
}

/** Spawn an actor from a table row the way the run module does (deferred spawn, row, name, seed), then 激活角色. */
export function spawnActor<T extends BP_ManeActor>(w: SimWorld, cls: BpCtor<T>, table: string, row: string, o: { seed?: number; quality?: number; at?: Vec3 } = {}): T {
  const x = w.spawn<T>(cls, a => {
    a.角色配置 = rowOf(w, table, row);
    a.名字 = row;
    a.种子 = o.seed ?? 0;
    if (o.quality !== undefined) a.品质 = o.quality;
  }, o.at);
  x.激活角色(false);
  return x;
}

export function combatFixture(o: CombatFixtureOptions = {}): CombatFixture {
  const seed = o.seed ?? 1;
  const world = createWorld({ content: o.content ?? registry, seed, strict: o.strict ?? false, ...(o.systems ? { systems: o.systems } : {}) });
  const mode = world.mode;
  mode.当前环节 = '交互场牌';
  const hero = world.spawn(BP_Actor_Player, a => {
    a.角色配置 = rowOf(world, PLAYERS, o.hero ?? '幽冥骑士');
    a.名字 = o.hero ?? '幽冥骑士';
    a.种子 = seed;
  });
  mode.玩家角色 = hero;
  if (mode.玩家控制器) mode.玩家控制器.玩家角色 = hero;
  hero.激活角色(false);

  const enemies: BP_Actor_Other[] = [];
  (o.enemies ?? []).forEach((name, i) => {
    const e = spawnActor(world, BP_Actor_Other, ENEMIES, name, { seed: seed + i + 1, at: { x: 200 + 100 * i, y: 0, z: 0 } });
    // 添加到战场 (module turn) when ported, else the field list directly.
    if (world.sys.turn.蓝图_动作游戏模式?.添加到战场) mode.添加到战场(e);
    else mode.场上所有.push(e);
    enemies.push(e);
  });
  if (enemies.length > 0) mode.场上有敌人 = true;

  const cards: BP_Actor_Card[] = [];
  for (const [i, it] of (o.equip ?? []).entries()) {
    const c = spawnActor(world, BP_Actor_Card, ITEMS, it.row, { seed: seed + 100 + i, quality: it.quality ?? 1 });
    world.cult.已装备牌.push(c);
    // 装备目标 (module inventory) when ported; else the equip hooks of ABILIT-057 directly.
    if (world.sys.inventory.蓝图_动作游戏模式?.装备目标) mode.装备目标(c);
    else for (const e of [...c.拥有的效果]) if (e && e.HasMatchingGameplayTag('效果.时机.装上')) e.装上时触发();
    cards.push(c);
  }

  const all = (): BP_ManeActor[] => [hero, ...enemies, ...cards];
  const named = (owner: string | BP_ManeActor): BP_ManeActor => {
    if (typeof owner !== 'string') return owner;
    const a = all().find(x => x.名字 === owner);
    if (!a) throw new Error(`combatFixture: no actor named ${owner}`);
    return a;
  };
  const seen: PresentEvent[] = [];
  const drain = (): PresentEvent[] => {
    seen.push(...world.bus.drain());
    return seen;
  };

  const turnStartDouble = (): void => {
    // ABILIT-062 steps 3–5 (equipped cards, then the hero minus already fired, then the field minus already fired).
    const fired = new Set<蓝图_效果>();
    for (const c of world.cult.已装备牌) {
      if (!c) continue;
      const copy = [...c.拥有的效果];
      tickCopy(copy, '效果.时机.新一天时', { record: fired });
      函数库_工具.清理已销毁效果(c, copy);
    }
    const hcopy = [...hero.拥有的效果];
    tickCopy(hcopy, '效果.时机.新一天时', { skip: fired });
    函数库_工具.清理已销毁效果(hero, hcopy);
    for (const a of mode.场上所有) {
      if (!a || !world.isValid(a)) continue;
      const copy = [...a.拥有的效果];
      tickCopy(copy, '效果.时机.新一天时', { skip: fired });
      函数库_工具.清理已销毁效果(a, copy);
    }
  };

  return {
    world, hero, enemies, cards,
    effect(owner, cls) {
      const a = named(owner);
      const e = a.拥有的效果.find(x => !!x && (x.def.path === cls || x.def.name === cls));
      if (!e) throw new Error(`combatFixture: ${a.名字} has no effect ${cls}`);
      return e;
    },
    ability(owner, 能力名) {
      const a = [...owner.拥有的主动能力, ...owner.拥有的被动能力, ...owner.拥有的附魔能力.keys()].find(x => x?.能力名 === 能力名);
      if (!a) throw new Error(`combatFixture: ${owner.名字} has no ability ${能力名}`);
      return a;
    },
    fire(e, tag, set) {
      fireLive(Array.isArray(e) ? e : [e as 蓝图_效果], tag, set);
    },
    hit({ from, to, amount, type = '物理', source = '攻击' }) {
      from.造成即时伤害(make伤害({ 伤害来源: source, 伤害类型: type, 伤害数值: sci(amount), 来自角色: from, 目标角色: to }), false, false);
    },
    turnStart() {
      if (world.sys.turn.蓝图_动作游戏模式?.新回合触发时机) mode.新回合触发时机();
      else turnStartDouble();
    },
    launch({ deg }) {
      const r = (deg * Math.PI) / 180;
      const p = hero.K2_GetActorLocation();
      hero.目标方向 = { x: Math.cos(r), y: Math.sin(r), z: 0 };
      hero.目标位置 = { x: p.x + Math.cos(r) * 500, y: p.y + Math.sin(r) * 500, z: p.z };
      return 函数库_工具.使目标执行自身技能(hero, 0, hero, false).完成释放;
    },
    runUntilInput(maxSeconds = 120) {
      return world.clock.runUntil(() => !hero.释放技能中 && hero.行动结束实例.length === 0, maxSeconds);
    },
    advance(seconds) {
      const frames = Math.round(seconds * 60);
      for (let i = 0; i < frames; i++) world.clock.advance(1 / 60);
    },
    events(kind) {
      const all = drain();
      return (kind ? all.filter(e => e.kind === kind) : all) as never;
    },
    hpOf(a) {
      return 科学数变普通(a.当前生命);
    },
  };
}
