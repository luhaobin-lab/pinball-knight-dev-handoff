import { describe, expect, it } from 'vitest';
import fnModules from '../../tools/gen/fn-modules.json';
import { generate } from '../../tools/gen/facade.mjs';
import { dumpExists } from '../../tools/data/dump.mjs';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { 蓝图_动作游戏模式 } from '../../src/core/sim/mode.ts';
import { 修炼系统 } from '../../src/core/sim/cult.ts';
import { stubWorld } from '../fixtures/stub-world.ts';

const FN = fnModules as { modules: Record<string, Record<string, string>> };
const GENERATED = import.meta.glob<string>(['../../src/core/**/*.ts'], { query: '?raw', import: 'default', eager: true });
const SYSTEMS = GENERATED['../../src/core/bp/systems.ts'];
const HAS_DUMP = dumpExists();
const MODULES = new Set(['sim', 'kernel', 'ability', 'projectile', 'physics', 'ai', 'turn', 'stamina', 'damage', 'rating', 'launch', 'charge', 'inventory',
  'text', 'rewards', 'talents', 'map', 'room', 'run', 'meta', 'save', 'craft', 'enchant', 'shop', 'camp', 'tutorial']);

describe('facade generator (WAVE_A A01)', () => {
  it.skipIf(!HAS_DUMP)('the generated files are up to date with the dump', () => {
    const { files } = generate();
    for (const [file, text] of files) {
      if (file.startsWith('src/core/sys/')) continue; // stubs: owned by their modules after wa/contracts
      expect(GENERATED[`../../${file}`], file).toBe(text);
    }
  });

  it('every function of the 19 classes has one module of W2 (or present / dead / engine / math)', () => {
    const classes = Object.keys(FN.modules).filter(c => !c.startsWith('UI_')); // widget facades: generator.test.ts
    const n = classes.reduce((k, c) => k + Object.keys(FN.modules[c]).length, 0);
    expect(classes).toHaveLength(19);
    expect(n).toBe(719);
    for (const [cls, fns] of Object.entries(FN.modules)) {
      for (const [fn, m] of Object.entries(fns)) expect(MODULES.has(m) || ['present', 'dead', 'engine', 'math'].includes(m), `${cls}.${fn}: ${m}`).toBe(true);
    }
  });

  it('module functions are declared in their module interface', () => {
    const iface = (m: string): string => SYSTEMS.split(`export interface ${m[0].toUpperCase()}${m.slice(1)}Fns {`)[1].split('\n}\n')[0];
    expect(iface('damage')).toContain('造成即时伤害?(self: BP_ManeActor, 伤害数据: 伤害');
    expect(iface('kernel')).toContain('吸附到网格?(ctx: BpObject');
    expect(iface('talents')).toContain('升级玩家?(self: BP_Actor_Player');
    expect(iface('shop')).toContain('交互到商人?(self: 蓝图_主角色控制器');
  });

  it('declarations carry the CDO defaults (sampled)', () => {
    const w = stubWorld();
    const def = { path: '', name: '', parent: null, kind: 'actor' as const, tags: [], vars: {}, timelines: {}, components: {}, rows: [], reachable: true };
    const a = new BP_Actor_Player(w, def);
    expect(a.疲劳了).toBe(true);
    expect(a.可闪避).toBe(true);
    expect(a.品质).toBe(1);
    expect(a.等级).toBe(1);
    expect(a.生命百分比).toBe(1);
    expect(a.恢复效果修正).toBe(1);
    expect(a.暴击保护计数).toBe(1);
    expect(a.敌人数量).toBe(1);
    expect(a.目标方向).toEqual({ x: 0, y: 1, z: 0 });
    expect(a.当前生命).toEqual({ 系数: 0, 指数: 0 });
    expect(a.名字).toBe('0.000000');
    expect(a.DecalScale).toBe(2);
    expect(a.Start_Delay).toBe(10);
    expect(a.被击特效A).toBe('CatapultHero/粒子/粒子_Blood_01');
    expect(a.终结目标_Q).toBe(false);
    expect(a).toBeInstanceOf(BP_ManeActor);
    const e = new (蓝图_效果 as unknown as new (...a: unknown[]) => 蓝图_效果)(w, { ...def, kind: 'effect' });
    expect(e.触发间隔).toBeTypeOf('number');
    const ab = new (蓝图_能力 as unknown as new (...a: unknown[]) => 蓝图_能力)(w, { ...def, kind: 'ability' });
    expect(ab.等级).toBe(1);
    const gm = new 蓝图_动作游戏模式(w, { ...def, kind: 'other' });
    const cs = new 修炼系统(w, { ...def, kind: 'other' });
    expect(gm.id).not.toBe(cs.id);
  });

  it('an unported function calls world.unported and returns its neutral value', () => {
    // Deliberately omit the launch implementation; the contract must survive later ports.
    const w = stubWorld({ sys: { launch: {} } });
    const def = { path: '', name: '', parent: null, kind: 'actor' as const, tags: [], vars: {}, timelines: {}, components: {}, rows: [], reachable: true };
    const a = new BP_ManeActor(w, def);
    expect(a.弹性处理()).toEqual({ 产生反弹: false });
    expect(w.unportedCalls).toContain('BP_ManeActor.弹性处理');
  });
});
