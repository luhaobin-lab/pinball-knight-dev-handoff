/**
 * The ability functions of BP_ManeActor (添加技能 routing, 打断技能, 附加效果前/后, 效果来自自身, 创建发射物(组)) and the
 * presentation-only entries W2 maps to this module. Demo: CatapultHero/BP/Actor/BP_ManeActor (pseudo lines below).
 */
import type { AbilityFns } from '../../bp/systems.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 结构_技能 } from '../../../content/demo/types.ts';
import { 品质From等级 } from '../../ability/params.ts';
import { fireLive } from '../../ability/dispatch.ts';
import { addUnique } from './util.ts';
import { classDisplayName } from './lib.ts';
import type { BpObject } from '../../sim/object.ts';
import type { 枚举_技能指示, 结构_地形选取配置 } from '../../../content/demo/types.ts';

type TerrainIndicator = BpObject & {
  圈大小: number;
  地形选取配置: 结构_地形选取配置;
  激活指示(owner: BP_ManeActor, kind: 枚举_技能指示): void;
  关闭指示(kind: 枚举_技能指示): void;
};

export const actorFns: NonNullable<AbilityFns['BP_ManeActor']> = {
  // BP_ManeActor L11698/L6922/L6966: type 6 has real terrain creation inside 技能指示.
  切换指示箭头(self, on, kind, radius, _points, _angles, terrain, _vfx) {
    if (!on) {
      const indicator = self.技能指示 as TerrainIndicator | null;
      if (indicator?.valid && typeof indicator.关闭指示 === 'function') indicator.关闭指示(kind);
      return;
    }
    if (!['地形区域（固定）','地形区域（实时）','指定位置（固定）'].includes(kind) || self.world.isValid(self.技能指示)) return;
    const indicator = self.world.spawn<TerrainIndicator>('CatapultHero/BP/交互/技能指示', x => {
      x.地形选取配置 = { ...terrain, 起点: terrain.起点.map(p => ({ ...p })), 格子类: { ...terrain.格子类 } };
      x.圈大小 = radius;
    });
    self.技能指示 = indicator;
    indicator.K2_AttachToActor(self);
    indicator.激活指示(self, kind);
  },
  // line 691
  效果来自自身(self, 效果) {
    const skill = 效果?.来自技能;
    if (!skill || !self.world.isValid(skill)) return false;
    return skill.拥有者 === self;
  },

  // line 1390. QUIRK: with 仅限来自自身 the listener's 触发时机 is set before the ownership test.
  创建发射物组(self, 触发次数, 仅限来自自身) {
    dispatchProjectile(self, '效果.时机.创建发射物组', 触发次数, 仅限来自自身);
  },

  // line 1998 (ABILIT-003, 005)
  添加技能(self, 技能数据, 等级, 获取轮次) {
    const row = (技能数据.DataTable ? self.world.data.table(技能数据.DataTable)?.rows[技能数据.RowName] : undefined) as 结构_技能 | undefined;
    if (!row) return; // L1595 "没有找到数据表技能//<row>" (debug print)
    const cls = row.能力.能力类;
    if (!cls) return; // SPEC-GAP: BeginDeferredActorSpawnFromClass(None) spawns nothing and the next calls hit None.
    const a = self.world.spawn<蓝图_能力>(cls, x => {
      x.唯一ID = `${self.唯一ID}//${classDisplayName(技能数据.DataTable)}//${技能数据.RowName}`;
      x.能力名 = 技能数据.RowName;
      x.拥有者 = self;
      x.等级 = 等级;
      x.品质 = 品质From等级(等级);
      x.种子 = self.种子;
    });
    a.技能配置 = row;
    a.初始化();
    a.子初始化();
    a.获取轮次 = 获取轮次;
    a.K2_AttachToActor(self);
    // Routing: enchant (dormant) / passive (runs now) / active by default.
    if (self.HasMatchingGameplayTag('可交互.修炼牌.附魔') && a.HasMatchingGameplayTag('能力.时机.附魔')) {
      self.拥有的附魔能力.set(a, a.能力名);
      return;
    }
    // L1782
    if (a.HasMatchingGameplayTag('能力.时机.被动')) {
      addUnique(self.拥有的被动能力, a);
      a.是天赋 = a.类型.has('能力.类型.天赋');
      a.被选中();
      a.执行技能(false);
      return;
    }
    // L2136
    addUnique(self.拥有的主动能力, a);
  },

  // line 2076: dispatch 创建发射物, then activate the projectile.
  创建发射物(self, 发射物实例, 触发次数, 仅限来自自身) {
    self.当前发射物 = 发射物实例;
    dispatchProjectile(self, '效果.时机.创建发射物', 触发次数, 仅限来自自身);
    // L1829
    const p = self.当前发射物;
    if (!p) return;
    p.游戏模式 = self.游戏模式 ?? self.world.mode;
    p.激活发射物();
  },

  // line 3099
  附加效果前(self, 效果实例) {
    self.当前附加效果 = 效果实例;
    fireLive(self.拥有的效果, '效果.时机.附加效果前');
  },

  // line 3132
  附加效果后(self, 效果实例) {
    self.当前附加效果 = 效果实例;
    fireLive(self.拥有的效果, '效果.时机.附加效果后');
  },

  // line 4976: 切换指示箭头(false, …) is presentation.
  打断技能(self, 结束行动) {
    if (结束行动) self.结束行动(null, '');
    const cur = self.当前能力;
    if (cur && self.world.isValid(cur)) cur.释放结束(true);
  },
};

function dispatchProjectile(self: BP_ManeActor, tag: string, 触发次数: number, 仅限来自自身: boolean): void {
  const list = self.拥有的效果;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || !self.world.isValid(e) || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    if (仅限来自自身 && e.来自技能?.拥有者 !== self) continue;
    e.触发次数 = 触发次数;
    e.持续中触发(tag);
  }
}

/** Entries of other classes that W2 maps to `ability` and that are presentation or input only in the Demo. */
export const presentationFns = {
  // BP_Actor_Card line 843 → L36400: a material flash with a cosmetic RandomFloat (presentation).
  BP_Actor_Card: { 条件筛选预览() {} },
  // 蓝图_通用路口 L3364: empty event.
  蓝图_通用路口: { 特殊处理() {} },
  // 蓝图_主角色控制器: the skill wheel is dead (ARCHITECTURE Appendix B "dead": gesture and skill-wheel functions).
  // 尝试执行指定技能 (L8452) only calls 获取点击位置(false), an input function of the controller.
  蓝图_主角色控制器: {
    关闭技能盘() { return { 选到技能了: false }; },
    打开技能盘() {},
    检索技能池() {},
    尝试执行指定技能(self) { self.获取点击位置(false); },
  },
} satisfies Pick<AbilityFns, 'BP_Actor_Card' | '蓝图_通用路口' | '蓝图_主角色控制器'>;
