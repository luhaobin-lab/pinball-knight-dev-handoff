import { copyStream, MakeRandomStream, makeRand15, type Rand15, type UeStream } from './ue.ts';

/**
 * Named random domains (core-math CORE-M-124…128, ARCHITECTURE §4.13). Every gameplay draw goes through exactly one.
 * - `全局种子`: UeStream seeded `int32(runSeed)` at run start (replaces SeedRandomStream, 蓝图_动作游戏模式 L2615).
 * - `meta`: Rand15 `fnv1a32('meta') ^ runSeed` (out-of-combat unseeded draws).
 * - `level`: Rand15 `fnv1a32('level') ^ runSeed ^ floorIndex·0x9E3779B9`, reseeded by `enterFloor`.
 * - `combat` / `loot`: Rand15 `fnv1a32(name) ^ runSeed ^ combatIndex·0x9E3779B9`, reseeded by `enterCombat`.
 * Seeded locals (`MakeRandomStream(种子)`) are made by the caller with the blueprint's own seed.
 * The domain objects are stable: reseeding and `load` overwrite their state in place.
 */
export type RngDomain = 'meta' | 'level' | 'combat' | 'loot';

export interface RngDomains {
  readonly runSeed: number;
  readonly 全局种子: UeStream;
  readonly meta: Rand15; readonly level: Rand15; readonly combat: Rand15; readonly loot: Rand15;
  readonly floorIndex: number;
  readonly combatIndex: number;
  enterFloor(floorIndex: number): void;     // reseeds level
  enterCombat(combatIndex: number): void;   // reseeds combat and loot
  save(): RngSave; load(s: RngSave): void;
}

export interface RngSave { runSeed: number; 全局种子: UeStream; meta: number; level: number; combat: number; loot: number; floorIndex: number; combatIndex: number }

/** 32-bit FNV-1a over the UTF-8 bytes of a string. */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  const add = (byte: number): void => { h = Math.imul(h ^ byte, 0x01000193); };
  for (const ch of text) {
    const c = ch.codePointAt(0) as number;
    if (c < 0x80) add(c);
    else if (c < 0x800) { add(0xc0 | (c >> 6)); add(0x80 | (c & 63)); }
    else if (c < 0x10000) { add(0xe0 | (c >> 12)); add(0x80 | ((c >> 6) & 63)); add(0x80 | (c & 63)); }
    else { add(0xf0 | (c >> 18)); add(0x80 | ((c >> 12) & 63)); add(0x80 | ((c >> 6) & 63)); add(0x80 | (c & 63)); }
  }
  return h >>> 0;
}

const GOLDEN = 0x9e3779b9;
const SALT = { meta: fnv1a32('meta'), level: fnv1a32('level'), combat: fnv1a32('combat'), loot: fnv1a32('loot') } as const;

/** The seed of a domain generator (uint32). `index` is the floor index for `level`, the combat index for `combat`/`loot`. */
export function domainSeed(domain: RngDomain, runSeed: number, index = 0): number {
  const base = (SALT[domain] ^ runSeed) >>> 0;
  return domain === 'meta' ? base : (base ^ Math.imul(index, GOLDEN)) >>> 0;
}

export function createRngDomains(runSeed: number): RngDomains {
  const seed = runSeed >>> 0;
  const 全局种子 = MakeRandomStream(seed | 0);
  const meta = makeRand15(domainSeed('meta', seed));
  const level = makeRand15(domainSeed('level', seed, 0));
  const combat = makeRand15(domainSeed('combat', seed, 0));
  const loot = makeRand15(domainSeed('loot', seed, 0));
  let floorIndex = 0;
  let combatIndex = 0;
  let current = seed;
  return {
    get runSeed() { return current; },
    全局种子, meta, level, combat, loot,
    get floorIndex() { return floorIndex; },
    get combatIndex() { return combatIndex; },
    enterFloor(index: number): void {
      floorIndex = index;
      level.state = domainSeed('level', current, index);
    },
    enterCombat(index: number): void {
      combatIndex = index;
      combat.state = domainSeed('combat', current, index);
      loot.state = domainSeed('loot', current, index);
    },
    save(): RngSave {
      return { runSeed: current, 全局种子: copyStream(全局种子), meta: meta.state, level: level.state, combat: combat.state, loot: loot.state, floorIndex, combatIndex };
    },
    load(s: RngSave): void {
      current = s.runSeed >>> 0;
      全局种子.InitialSeed = s.全局种子.InitialSeed | 0;
      全局种子.Seed = s.全局种子.Seed >>> 0;
      meta.state = s.meta >>> 0;
      level.state = s.level >>> 0;
      combat.state = s.combat >>> 0;
      loot.state = s.loot >>> 0;
      floorIndex = s.floorIndex;
      combatIndex = s.combatIndex;
    },
  };
}
