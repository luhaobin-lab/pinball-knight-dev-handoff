/**
 * Module `ai` (WAVE_A Appendix W2, card core-ai): enemy skill choice, intents, floor growth, elite rolls and the custom
 * monster attributes. Spec: spec-drafts/enemy-ai-intents.md (ENEMY--011…090); pseudo BP_ManeActor (递进预制技能顺序 line 706,
 * 跳过本回合 4344, 选择技能 4355, 检查技能条件 4478, 乘数强化属性 4907), BP_Actor_Other (成长属性 line 34, 实时检测 UG L8393),
 * 蓝图_动作游戏模式 (写入/查询怪物自定义属性 412/433, AI行动前 628, 获取当前层成长率 1268, 精英化敌人 2227, 预测AI行动 3434),
 * 函数库_工具 (乘数强化属性 line 1276). The AI cast loop (`执行AI行动`), the gauge and the spawning are module `turn`.
 */
import type { Systems } from '../../bp/systems.ts';
import { 函数库_工具, 函数库_技能 } from '../../bp/index.ts';
import { make效果配置 } from '../../bp/structs.ts';
import { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 乘数强化属性 as 乘数强化属性_lib } from '../../math/kismet.ts';
import { sciOf, 科学数乘除, 科学数变普通, type 科学数 } from '../../math/sci.ts';
import { 添加科学映射值, 获取科学映射词条 } from '../../math/stats.ts';
import { Array_Random } from '../../rng/ue.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { Array_AddUnique, Array_RemoveItem } from '../../sim/engine.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BpObject } from '../../sim/object.ts';
import { growthRate } from './growth.ts';

export const INTENT_CLASS = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_意图';
const NO_TERRAIN = { 选取方式: '选取范围地形格（矩形）', 避开角色: false, 起点: [], 起始范围: 0, 结束范围: 0, '开启预览框?': false, 格子类: { 效果类: null, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, '唯一？': false, '检查效果名？': false, 叠加上限: 1 } } as const;

/** The Demo's GameplayStatics.GetObjectName for a key (SPEC-GAP: UE instance numbering is unknown; unique per object). */
function objectName(o: BpObject | null): string {
  return o ? `${o.def.name}_C_${o.id}` : 'None';
}

const stat = (m: BP_ManeActor['词条'], name: string): 科学数 => 获取科学映射词条(m, name).输出值;

/**
 * The node level 获取当前层成长率 reads (`当前所在格.奖励技能实例.等级`, L202). 当前所在格 is the UI_地图格 widget, which the
 * generated game mode does not declare.
 * SPEC-GAP: read structurally if the map module puts it on the mode; else 1 (the Demo's NewLocalVar_1 default).
 */
function nodeLevel(mode: 蓝图_动作游戏模式): number {
  const cell = (mode as unknown as { 当前所在格?: { 奖励技能实例?: { 等级?: number; valid?: boolean } | null } | null }).当前所在格;
  const inst = cell?.奖励技能实例;
  return inst && inst.valid !== false && typeof inst.等级 === 'number' ? inst.等级 : 1;
}

export const ai: Systems['ai'] = {
  BP_ManeActor: {
    // line 706, L181/L277
    递进预制技能顺序(self) {
      self.当前预制技能序号 = self.当前预制技能序号 + 1 >= self.预制技能顺序组.length ? 0 : self.当前预制技能序号 + 1;
    },

    // line 4344 (ENEMY--034): no gauge change, no 结束行动.
    跳过本回合(self) {
      self.切换指示箭头(false, '固定方向', 60.0, [], [], NO_TERRAIN, null);
      self.当前能力 = null;
      const mode = self.游戏模式 ?? self.world.mode;
      Array_RemoveItem(mode.可行动角色, self as BP_ManeActor | null);
      self.疲劳了 = true;
    },

    // line 4355 (ENEMY--031): uniform pick, 被选中, rotation step, then the unique intent effect.
    选择技能(self) {
      const w = self.world;
      const i = Array_Random(w.rng.combat, self.可释放能力);
      self.当前能力 = i < 0 ? null : self.可释放能力[i];
      self.当前能力备份 = self.当前能力;
      if (w.isValid(self.当前能力备份)) self.当前能力备份.被选中();
      self.递进预制技能顺序();
      const cfg = make效果配置({ 效果类: INTENT_CLASS, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 });
      const { 效果名字 } = 函数库_技能.获取效果名(self, self.空技能, cfg.效果类);
      if (!w.isValid(self)) return; // L3797
      if (self.死掉了) return; // L530
      const pre = 函数库_工具.附加效果前处理(self, cfg, self, 效果名字);
      if (pre.不需附加新效果) { // L854
        pre.效果实例?.激活效果('');
        return;
      }
      // L1125: deferred spawn with the exposed fields
      const eff = w.spawn<蓝图_效果>(INTENT_CLASS, e => {
        e.拥有者 = self; e.释放者 = self; e.来自技能 = self.空技能;
        e.持续时长 = cfg.持续时间; e.触发间隔 = cfg.触发间隔; e.持续回合 = cfg.持续回合; e.叠加层数 = cfg.叠加层数; e.临时 = false;
      }, self.K2_GetActorLocation()); // spawned at the origin, then attached KeepRelative (L3410): it sits on the owner
      if (!w.isValid(eff)) return; // L3560 效果生成失败
      eff.效果名字 = 效果名字;
      const cls = self.def.name;
      if ((cls === 'BP_Actor_Equip' || cls === 'BP_Actor_Card') && !eff.临时) {
        eff.OwnedGameplayTags.add('效果.时机.装上');
        eff.OwnedGameplayTags.add('效果.时机.卸下');
      } else if (w.isValid(self.空技能) && self.空技能.是天赋) { // L3645
        eff.OwnedGameplayTags.add('能力.类型.天赋');
      }
      Array_AddUnique(self.拥有的效果, eff as 蓝图_效果 | null); // L3410
      eff.K2_AttachToActor(self);
      eff.激活效果('');
    },

    // line 4478 (ENEMY--028): live index loop over 拥有的主动能力; 交互-typed skills are skipped.
    检查技能条件(self) {
      self.可释放能力.length = 0;
      for (let i = 0; i < self.拥有的主动能力.length; i++) {
        const a = self.拥有的主动能力[i];
        if (!self.world.isValid(a)) continue; // None / stale: the calls on it are no-ops
        if (a.类型.has('能力.类型.交互')) continue;
        a.检查子条件(); // L557
        a.检查条件();
      }
      if (self.可释放能力.length === 0) self.跳过本回合(); // L388
      else self.选择技能(); // L468
    },

    // line 4907: 强化前 × (成长率修正 × 成长率 × (额外等级 + 等级) + 1)
    乘数强化属性(self, 强化前, 成长率修正, 额外等级) {
      const k = 成长率修正 * self.成长率 * (额外等级 + self.等级) + 1.0;
      return { 强化后: 科学数乘除(强化前, sciOf(k, 0), false) };
    },
  },

  BP_Actor_Other: {
    // line 34 → L277 (ENEMY--009, ENEMY--075): the elite affix first, then the growth writes over the base source "".
    成长属性(self) {
      if (self.随机精英技能.length > 0 && self.是精英) {
        const i = Array_Random(self.world.rng.combat, self.随机精英技能);
        const h = self.随机精英技能[i];
        self.添加技能({ DataTable: h.DataTable, RowName: h.RowName }, 1, 0);
      }
      const elite = self.是精英;
      const dmg = self.乘数强化属性(stat(self.词条, '基础伤害'), 1.0, 0).强化后;
      添加科学映射值(self.词条, '基础伤害', '', elite ? 科学数乘除(dmg, sciOf(1.2, 0), false) : dmg, false);
      const hp = self.乘数强化属性(self.乘数强化属性(stat(self.词条, '生命'), 1.5, 0).强化后, 1.5, 0).强化后;
      添加科学映射值(self.词条, '生命', '', elite ? 科学数乘除(hp, sciOf(2.0, 0), false) : hp, false);
      添加科学映射值(self.词条, '治愈', '', self.乘数强化属性(stat(self.词条, '治愈'), 1.5, 0).强化后, false);
      添加科学映射值(self.词条, '护甲', '', self.乘数强化属性(stat(self.词条, '护甲'), 1.5, 0).强化后, false);
      // QUIRK (OT lines 70/76): the elite ×2 of 最大魔力 / 魔力 is written into local temporary maps, so it has no effect.
      const exp = stat(self.词条, '经验');
      添加科学映射值(self.词条, '经验', '', elite ? 科学数乘除(exp, sciOf(2.0, 0), false) : exp, false);
      self.更新最大生命魔力();
      self.当前生命 = self.当前最大生命;
      self.生命百分比 = 1.0;
    },

    // UG L8393: the corpse stops once its physics speed falls below 5: collision off, tick off, motion data updated.
    // SPEC-GAP: the Demo gates this on a UG Gate that 物理终止检测 (module physics) opens 0.2 s after death; ported as
    // "while 死掉了", the tick being what runs it.
    实时检测(self) {
      if (!self.死掉了) return;
      if (!(self.当前物理速度 < 5.0)) return;
      self.关闭碰撞();
      self.setTickEnabled(false);
      self.更新运动数据();
    },
  },

  蓝图_动作游戏模式: {
    // line 412 (ENEMY--090): key = GetObjectName(目标) + 名称; 覆盖 stores, else adds (missing → 0 + 值).
    写入怪物自定义属性(self, 添加目标, 属性名称, 值, 覆盖) {
      const key = objectName(添加目标) + 属性名称;
      self.怪物自定义属性映射.set(key, 覆盖 ? 值 : (self.怪物自定义属性映射.get(key) ?? 0) + 值);
    },

    // line 433
    查询怪物自定义属性(self, 查询目标, 属性名称) {
      const key = objectName(查询目标) + 属性名称;
      const v = self.怪物自定义属性映射.get(key);
      return { 值: v ?? 0, 存在: v !== undefined };
    },

    // line 628 (ENEMY--021): decorations' AI行动前 (接口_工具), then per 场上所有 actor 更新外观数据 and its effects tagged
    // 效果.时机.AI行动前 (live index loops).
    AI行动前(self) {
      const decos = self.当前房间实例?.房间装饰品 ?? [];
      for (let i = 0; i < decos.length; i++) {
        const d = decos[i] as (BpObject & { AI行动前?(): void }) | null;
        if (d && typeof d.AI行动前 === 'function') d.AI行动前();
      }
      for (let i = 0; i < self.场上所有.length; i++) {
        const a = self.场上所有[i];
        if (!a) continue;
        a.更新外观数据();
        for (let j = 0; j < a.拥有的效果.length; j++) {
          const e = a.拥有的效果[j];
          if (!self.world.isValid(e)) continue;
          if (!e.HasMatchingGameplayTag('效果.时机.AI行动前')) continue;
          e.触发时机 = '效果.时机.AI行动前';
          e.持续中触发('效果.时机.AI行动前');
        }
      }
    },

    // line 1268 (ENEMY--073)
    获取当前层成长率(self, 预览等级, 额外层数) {
      const level = 预览等级 === -1 ? nodeLevel(self) : 预览等级;
      return { OutXY: growthRate(self.当前总层数, 额外层数, self.通过关卡数, self.无尽模式, level) };
    },

    // line 2227 (ENEMY--079): two 传统概率判断 draws; roll 1 only resets or grows the accumulator, roll 2 decides (QUIRK).
    精英化敌人(self) {
      const cap = (): number => (self.当前总层数 <= 3 ? 0 : self.当前层配置.精英上限);
      const extra = (): number => 科学数变普通(stat(self.全局词条, '额外精英几率%'));
      const r1 = 函数库_工具.传统概率判断(self, self.当前层配置.精英几率 + self.精英几率累加 + extra()).触发;
      if (r1 && self.当前层精英数量 < cap()) {
        self.精英几率累加 = 0.0;
      } else { // L1061
        const task = self.当前任务实例;
        const kill = task instanceof 蓝图_能力 && task.能力名 === '消灭所有敌人';
        const grown = extra() + (self.当前总层数 <= 3 ? 0.0 : self.当前层配置.精英几率) + self.精英几率累加;
        self.精英几率累加 = kill ? grown : self.精英几率累加;
      }
      // L539
      const r2 = 函数库_工具.传统概率判断(self, self.当前层配置.精英几率 + self.精英几率累加 + extra()).触发;
      return r2 && self.当前层精英数量 < cap();
    },

    // line 3434 (ENEMY--027): over a copy of 可行动角色; actors that hold an intent keep it.
    预测AI行动(self) {
      const list = [...self.可行动角色];
      for (const a of list) {
        if (!a) continue;
        if (self.world.isValid(a.当前能力)) continue;
        a.检查技能条件(); // L416
      }
    },
  },

  函数库_工具: {
    // line 1276 (CORE-M-109)
    乘数强化属性(_ctx, 强化前, 成长率修正, 成长率, 等级) {
      return { 强化后: 乘数强化属性_lib(强化前, 成长率修正, 成长率, 等级) };
    },
  },
};
