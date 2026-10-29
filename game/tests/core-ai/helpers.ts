/**
 * Test world for core-ai: the real core-sim world and the real `ai` module, with recording doubles for the modules
 * the AI calls through the facade (ability lifecycle, turn, damage, physics, launch, kernel, text). WAVE_A §1.4: the
 * other modules are never re-implemented, only stubbed as far as a vector needs. Replace with tests/fixtures
 * (`combatFixture`, `withSystems`) once wa/ability lands.
 */
import { 获取技能参数, 参数From } from '../../src/core/ability/params.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { sciOf, 科学数变普通, 科学数乘除, 科学数加减 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条, 词条映射From } from '../../src/core/math/stats.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import type { Vec3 } from '../../src/core/sim/types.ts';
import { 数据表_敌人_普通, 数据表_技能_默认 } from '../../src/content/demo/tables.ts';
import type { 结构_技能, 结构_角色 } from '../../src/content/demo/types.ts';
import { registry } from '../../src/content/bp/index.ts';

export type Call = [string, ...unknown[]];

export interface AiTestWorld {
  w: SimWorld;
  calls: Call[];
  /** Scripted uniform draws of 函数库_工具.传统概率判断 (passes when U < p), consumed in order; empty → 0. */
  rolls: number[];
  /** Scripted spots for 函数库_技能.获取目标范围空地. */
  spots: Vec3[];
  /** Whether 函数库_工具.附加效果前处理 reports an existing instance. */
  existing: 蓝图_效果 | null;
  enemy(row: string, at?: Vec3): BP_Actor_Other;
  called(name: string): Call[];
}

const enemyRows = 数据表_敌人_普通.rows as Readonly<Record<string, 结构_角色>>;

/** HalfToEven integer text, the 科学数字缩写(·, 0) result below 1000 (CORE-M-041). */
function halfToEven(v: number): string {
  const f = Math.floor(v);
  const d = v - f;
  const r = d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1);
  return String(r);
}

export function aiWorld(over: Partial<Systems> = {}, seed = 1): AiTestWorld {
  const calls: Call[] = [];
  const t: AiTestWorld = {
    w: null as unknown as SimWorld, calls, rolls: [], spots: [], existing: null,
    enemy: null as unknown as AiTestWorld['enemy'],
    called: (name: string) => calls.filter(c => c[0] === name),
  };
  const rec = (name: string, ...a: unknown[]): void => { calls.push([name, ...a]); };

  const destroyEffect = (e: 蓝图_效果): void => {
    if (e.已销毁) return;
    e.已销毁 = true;
    rec('销毁效果', e.def.name);
    e.销毁前触发();
    const finish = (): void => {
      const o = e.拥有者;
      if (o) { const i = o.拥有的效果.indexOf(e); if (i >= 0) o.拥有的效果.splice(i, 1); }
      e.world.destroy(e);
    };
    if (e.销毁延迟 > 0) e.world.clock.after(e.销毁延迟, finish); else finish();
  };

  const systems: Partial<Systems> = {
    ability: {
      蓝图_效果: {
        激活效果(e) {
          rec('激活效果', e.def.name);
          e.激活后触发('');
          if (e.HasMatchingGameplayTag('效果.时机.创建时')) e.持续中触发('效果.时机.创建时');
        },
        销毁效果: destroyEffect,
        激活后触发() {}, 销毁前触发() {}, 持续中触发() {}, ReceiveTick() {}, ReceiveBeginPlay() {},
      },
      蓝图_能力: {
        释放结束(a, 是打断) { rec('释放结束', a.def.name, 是打断); if (a.拥有者) { a.拥有者.当前能力 = null; a.拥有者.当前目标 = null; } }, // ENEMY--024
        被选中() {}, 检查子条件() {}, 子初始化() {}, ReceiveDestroyed() {},
        执行技能(a) { rec('执行技能', a.def.name); },
        检查条件(a) { // the gates this card's vectors rely on; the full rule is core-ability's (ABILIT-011…019)
          const o = a.拥有者;
          if (!o) return;
          const presetOk = !o.HasMatchingGameplayTag('可交互.角色.AI.预制技能顺序')
            || o.拥有的主动能力.indexOf(a) === (o.预制技能顺序组[o.当前预制技能序号] ?? 0);
          const ok = a.子条件通过 && !a.冷却效果 && presetOk && !o.释放技能中;
          a.本技能可释放 = ok;
          if (ok) { if (!o.可释放能力.includes(a)) o.可释放能力.push(a); } else { const i = o.可释放能力.indexOf(a); if (i >= 0) o.可释放能力.splice(i, 1); }
        },
      },
      BP_ManeActor: {
        添加技能(self, h, 等级, 轮次) { rec('添加技能', self.名字, h.RowName, 等级, 轮次); },
      },
      函数库_技能: {
        获取效果名: (_ctx, _a, cls) => ({ 效果名字: (cls ?? 'None').split('/').pop() ?? '' }),
        获取技能参数: (_ctx, a, i, prev) => a ? 获取技能参数({ 参数: a.参数.map(p => 参数From(p)), 等级: a.等级, 品质: a.品质, 上一次等级: a.上一次等级 }, i, prev) : { 整数: false, 乘算: false, 参数值: 0, 词条: '' },
      },
      函数库_工具: {
        附加效果前处理: () => ({ 不需附加新效果: t.existing !== null, 效果实例: t.existing }),
      },
    },
    kernel: {
      BP_ManeActor: {
        更新最大生命魔力(self) { // the double of ENEMY--076: 最大生命 = 生命 × (1 + 额外生命%)
          const hp = 获取科学映射词条(self.词条, '生命').输出值;
          const extra = 获取科学映射词条(self.词条, '额外生命%').输出值;
          self.当前最大生命 = 科学数乘除(hp, 科学数加减(sciOf(1, 0), extra, false), false);
        },
        关闭碰撞(self) { rec('关闭碰撞', self.名字); },
        开启碰撞(self) { rec('开启碰撞', self.名字); },
      },
      函数库_工具: {
        传统概率判断: (_ctx, p) => { const u = t.rolls.length ? t.rolls.shift()! : 0; rec('传统概率判断', p); return { 触发: u < p }; },
        范围选取点: (_ctx, at) => ({ 选到的点: [{ x: at.x + 96, y: at.y, z: at.z }] }),
      },
    },
    turn: {
      BP_ManeActor: { 结束行动(self, 实例, d) { rec('结束行动', self.名字, 实例, d); } },
      函数库_技能: {
        召唤角色到场上(_ctx, _gm, _table, row, at) {
          rec('召唤角色到场上', row, at);
          const m = t.enemy(row, at);
          return { 有出生动画: false, 出生动画: null, 召唤出来的: m };
        },
      },
    },
    damage: {
      BP_ManeActor: {
        获得治疗(self, h, 治愈, 无法暴击) { rec('获得治疗', self.名字, 科学数变普通(h.治疗整数), h.生命护甲, 治愈, 无法暴击); },
        检查死亡(self, a, b) { rec('检查死亡', self.名字, a, b); },
      },
      函数库_战斗日志: { 日志__获取角色名: (_ctx, a) => ({ Output: { zh: a?.名字 ?? '', en: a?.名字 ?? '' } }) },
    },
    physics: {
      函数库_技能: {
        根据体重添加冲击: (_ctx, who, I) => { rec('根据体重添加冲击', who?.名字, I); },
        获取目标范围空地: () => ({ 查询到的位置: t.spots.map(p => ({ ...p })), 位置对应角度: t.spots.map((_, i) => i * 72) }),
      },
    },
    launch: {
      BP_ManeActor: {
        更新运动数据(self) { rec('更新运动数据', self.名字); },
        更新朝向(self) { rec('更新朝向', self.名字); },
        发动攻击(self) { rec('发动攻击', self.名字); },
        退出攻击状态(self) { rec('退出攻击状态', self.名字); },
      },
    },
    text: {
      函数库_科学数: { 科学数字缩写: (_ctx, v) => { const s = halfToEven(科学数变普通(v)); return { 值: { zh: s, en: s }, 单位: { zh: '', en: '' }, ReturnValue: { zh: s, en: s } }; } },
    },
  };
  // merge `over` per module and class
  const merged: Partial<Systems> = { ...systems };
  for (const [m, mod] of Object.entries(over) as [keyof Systems, Record<string, unknown>][]) {
    const base = (merged[m] ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(mod)) out[k] = typeof v === 'object' && v ? { ...(base[k] as object ?? {}), ...v } : v;
    (merged as Record<string, unknown>)[m] = out;
  }
  t.w = createWorld({ content: registry, seed, strict: false, systems: merged });

  t.enemy = (row: string, at: Vec3 = { x: 0, y: 0, z: 0 }): BP_Actor_Other => {
    const r = enemyRows[row];
    return t.w.spawn(BP_Actor_Other, a => {
      a.名字 = row;
      a.角色配置 = r as BP_ManeActor['角色配置'];
      a.词条 = 词条映射From(r.科学词条);
      a.高度 = r.属性.高度; a.宽度 = r.属性.宽度; a.行动力 = r.属性.行动力;
      a.随机精英技能 = [...r.随机精英技能]; a.预制技能顺序组 = [...r.预制技能顺序];
      a.角色类型 = r.类型;
      for (const tag of r.标签) a.OwnedGameplayTags.add(tag);
      a.游戏模式 = t.w.mode;
      a.当前位置 = { ...at };
    }, at);
  };
  return t;
}

/** A 数据表_技能_默认 row as an ability of `owner` (the fields 蓝图_能力.初始化 copies, enough for these vectors). */
export function ability<T extends 蓝图_能力>(t: AiTestWorld, owner: BP_ManeActor, row: string): T {
  const rows = 数据表_技能_默认.rows as Readonly<Record<string, 结构_技能>>;
  const r = rows[row];
  const a = t.w.spawn<T>(r.能力.能力类 as string, x => {
    x.拥有者 = owner; x.能力名 = row; x.等级 = 1; x.品质 = 1;
    x.参数 = [...r.参数] as T['参数'];
    x.冲击力 = r.冲击力; x.冷却回合 = r.冷却回合; x.冷却秒 = r.冷却秒;
    for (const tag of r.类型) x.类型.add(tag);
    x.效果配置 = r.能力.效果.map(e => ({ 效果类: e.效果类, 持续时间: e.持续时间, 触发间隔: e.触发间隔, 持续回合: e.持续回合, 叠加层数: e.叠加层数, 唯一: e['唯一？'], 检查效果名: e['检查效果名？'], 叠加上限: e.叠加上限 }));
    x.技能动画 = [...r.能力.动画];
    x.地形选取 = r.能力.地形选取;
  });
  owner.拥有的主动能力.push(a);
  return a;
}
