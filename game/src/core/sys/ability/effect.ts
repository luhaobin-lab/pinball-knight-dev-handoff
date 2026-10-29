/**
 * 蓝图_效果 base behaviour (ability-framework §4.E–4.G, ABILIT-039…059). Demo: CatapultHero/BP/Skill/蓝图_效果
 * (dump/blueprints-pseudo/CatapultHero/BP/Skill/蓝图_效果.txt). The generated class delegates here. The hooks content
 * overrides (激活后触发, 持续中触发, 销毁前触发, 销毁后触发, 额外子触发) have empty base bodies. The skill-slot and
 * buff-slot widget calls (对应技能格 / 对应增减益格) are UI: the HUD reads cooldowns and stacks from the view.
 */
import type { AbilityFns } from '../../bp/systems.ts';
import { 蓝图_效果 } from '../../ability/effect.ts';
import type { 蓝图_动画结算 } from '../../sim/settlement.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { FTrunc } from '../../math/kismet.ts';
import { 函数库_工具 as Tools } from '../../bp/index.ts';
import { addUnique, removeItem } from './util.ts';

const SETTLEMENT = 'CatapultHero/BP/动画/蓝图_动画结算';

/**
 * The ubergraph's Gate (L1155): closed until the time path opens it (L2062 → L1806), never closed again. Kept as an
 * `ug_` field on the effect (ARCHITECTURE §7.4 rule 2) so the digest and saves see it.
 */
type Gated = 蓝图_效果 & { ug_倒计时门?: boolean };
const gateOpen = (e: 蓝图_效果): boolean => (e as Gated).ug_倒计时门 === true;
const openGate = (e: 蓝图_效果): void => { (e as Gated).ug_倒计时门 = true; };

export const effectFns: NonNullable<AbilityFns['蓝图_效果']> = {
  // L2351 (ABILIT-042). Sequence: [L2479 / L2298 time path] → L2511 激活后触发 → L1818 slot UI.
  激活效果(self, Debug) {
    if (self.持续回合 > -1) {
      self.剩余回合 = self.持续回合 + 1;
    } else {
      // L2479
      self.剩余回合 = self.持续回合;
      // L2298 → L2077: first call after 触发间隔 + (−触发间隔) = 0 s; rate ≤ 0 creates no timer (ABILIT-043, SPEC-GAP U2/U3).
      if (self.持续时长 !== -1.0) {
        self.剩余时长 = self.持续时长;
        self.setTimer('持续效果', Math.fround(self.触发间隔), true, () => self.持续效果(), Math.fround(self.触发间隔 * -1.0));
        openGate(self);
        self.setTickEnabled(true);
      }
    }
    // L2511
    self.激活后触发(Debug);
  },

  // L622 (ABILIT-045): fires on the expiring tick too.
  持续效果(self) {
    if (self.已销毁) return;
    if (!(self.持续回合 < 0)) {
      // L954
      self.剩余回合 = self.剩余回合 - 1;
      self.已销毁 = Math.max(self.剩余回合, 0) === 0;
    }
    // L930
    self.持续中触发(self.触发时机);
  },

  // L2694 → L2535 (ABILIT-047). The Delay latches per node: a second call while pending runs 销毁前触发 again only.
  销毁效果(self) {
    if (!self.world.isValid(self)) return; // Engine object calls cannot resurrect a destroyed effect's latent work.
    self.销毁前触发();
    if (Math.fround(self.销毁延迟) > 0.0) self.delay('L2535', self.销毁延迟, () => finishDestroy(self));
    else finishDestroy(self);
  },

  // L2820 (ABILIT-053): max() refresh; the instance's own 持续时长 / 持续回合 stay.
  更新时间(self, 新) {
    self.剩余时长 = 新.持续时间 > self.剩余时长 ? 新.持续时间 : self.剩余时长;
    if (!(新.持续回合 >= 0)) return;
    const n = 新.持续回合 + 1;
    self.剩余回合 = n > self.剩余回合 ? n : self.剩余回合;
  },

  // L1150 → L1256 (ABILIT-044). DeltaSeconds is a float in UE. The debug PrintString is not ported.
  ReceiveTick(self, DeltaSeconds) {
    if (!gateOpen(self)) return;
    self.剩余时长 = self.剩余时长 - Math.fround(DeltaSeconds);
    if (self.剩余时长 <= 0.0) self.销毁效果();
  },

  // L2815 → L2699: caches 游戏模式. Every effect ticks in the Demo; the core ticks an effect while its countdown gate is
  // open, or from spawn when its class overrides ReceiveTick (so content ticks exactly as its blueprint does).
  ReceiveBeginPlay(self) {
    self.游戏模式 = self.world.mode;
    if (Object.getPrototypeOf(self).ReceiveTick !== 蓝图_效果.prototype.ReceiveTick) self.setTickEnabled(true);
  },

  // line 42 (ABILIT-049)
  连击处理(self, 结算数值) {
    const owner = self.来自技能?.拥有者 ?? null;
    self.连击计数 = 科学数变普通(获取科学映射词条(owner?.词条 ?? new Map(), '连击').输出值);
    if (!(self.连击计数 > 1.0)) {
      // L339
      self.额外子触发(结算数值, 1);
      return;
    }
    if (self.无延迟连击) {
      self.额外子触发(结算数值, FTrunc(self.连击计数));
      return;
    }
    // L368
    self.连击动画结算 = [];
    for (let i = 0; i <= FTrunc(self.连击计数 - 1.0); i++) {
      const child = self.world.spawn<蓝图_动画结算>(SETTLEMENT, s => {
        s.延迟 = 0.3;
        s.动画对象 = self;
        s.子动画结算 = [];
        s.结算类型 = '连击结算';
      });
      addUnique(self.连击动画结算, child);
      child.连击结算数值 = 结算数值;
      child.来自角色 = self.拥有者;
      self.拥有者?.加入行动结束(child);
    }
    // L1359
    const parent = self.world.spawn<蓝图_动画结算>(SETTLEMENT, s => {
      s.延迟 = 0.0;
      s.子动画结算 = [...self.连击动画结算];
      s.结算类型 = '无';
    });
    const mode = self.world.mode;
    addUnique(mode.模式动画结算数组, parent);
    mode.开始动画结算();
  },

  额外子触发() {},

  // line 162 (ABILIT-057). 是词条.不可叠加 is carried by no row (ABILIT-059, SPEC-GAP G5): only the default path is live.
  装上时触发(self) {
    const hero = self.world.mode.玩家角色;
    if (!hero) return;
    const skill = self.来自技能;
    if (skill?.HasMatchingGameplayTag('是词条.不可叠加')) {
      const { 存在相同被动: found, 存在的效果: old } = Tools.存在同类效果(self, hero.拥有的效果, self.def.path);
      if (found && old) {
        if (skill.等级 > (old.来自技能?.等级 ?? 0)) {
          addUnique(hero.拥有的效果, self);
          self.拥有者 = hero;
          removeItem(hero.拥有的效果, old);
          addUnique(hero.未生效效果数组, old);
          if (old.来自技能) old.来自技能.未生效 = true;
          return;
        }
        // L929
        addUnique(hero.未生效效果数组, self);
        self.拥有者 = hero;
        skill.未生效 = true;
        return;
      }
    }
    // L779
    addUnique(hero.拥有的效果, self);
    self.拥有者 = hero;
  },

  // line 109 (ABILIT-058): the 不可叠加 test is on the effect itself.
  卸下时触发(self) {
    const hero = self.world.mode.玩家角色;
    if (!hero) return;
    if (self.HasMatchingGameplayTag('是词条.不可叠加') && hero.未生效效果数组.includes(self)) {
      removeItem(hero.未生效效果数组, self);
      self.拥有者 = self.来自技能?.拥有者 ?? null;
      if (self.来自技能) self.来自技能.未生效 = false;
      return;
    }
    // L351
    removeItem(hero.拥有的效果, self);
    self.拥有者 = self.来自技能?.拥有者 ?? null;
    const same: (蓝图_效果 | null)[] = [];
    for (let i = 0; i < hero.未生效效果数组.length; i++) {
      const e = hero.未生效效果数组[i];
      if (e?.def.path === self.def.path) same.push(e);
    }
    if (same.length === 0) return;
    Tools.排序效果(self, same, false);
    const best = same[0]!;
    addUnique(hero.拥有的效果, best);
    removeItem(hero.未生效效果数组, best);
    if (best.来自技能) best.来自技能.未生效 = false;
  },

  持续中触发() {},
  销毁后触发() {},
  销毁前触发() {},
  激活后触发() {},
};

// L15 → L252 → L413 → L530: removal from the source ability owner's list and from the owner's list, then destroy.
function finishDestroy(self: 蓝图_效果): void {
  const w = self.world;
  const skill = self.来自技能;
  if (skill && w.isValid(skill)) {
    if (skill.拥有者 && w.isValid(skill.拥有者)) removeItem(skill.拥有者.拥有的效果, self);
  }
  if (self.拥有者 && w.isValid(self.拥有者)) removeItem(self.拥有者.拥有的效果, self);
  self.销毁后触发();
  self.K2_DestroyActor();
}
