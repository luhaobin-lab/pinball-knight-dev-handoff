/**
 * 蓝图_能力 base behaviour (ability-framework §4.A–4.D, ABILIT-003…038). Demo: CatapultHero/BP/Skill/蓝图_能力
 * (dump/blueprints-pseudo/CatapultHero/BP/Skill/蓝图_能力.txt). The generated class delegates here; the virtuals
 * (子初始化, 检查子条件, 被选中, 执行技能, 特殊结算) have empty base bodies.
 */
import type { AbilityFns } from '../../bp/systems.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 效果配置From, type 效果配置 } from '../../bp/structs.ts';
import { 函数库_工具 as Tools, 函数库_技能 as Skills, 函数库_战斗日志 as Log } from '../../bp/index.ts';
import { 获取科学映射词条, 词条映射From } from '../../math/stats.ts';
import { sciOf, 科学数零, 科学数加减, 科学数乘除, 科学数变普通 } from '../../math/sci.ts';
import { FCeil, FTrunc, GridSnap_Float } from '../../math/kismet.ts';
import { MakeRandomStream, RandomFloatInRangeFromStream, RandomIntegerInRange, RandomIntegerInRangeFromStream } from '../../rng/ue.ts';
import { TagSet } from '../../sim/tags.ts';
import { BP_Actor_Card } from '../../sim/card.ts';
import { fireLive } from '../../ability/dispatch.ts';
import { addUnique, formatText, isExactClass, removeItem, textOf } from './util.ts';

export const COOLDOWN = 'CatapultHero/BP/Skill/效果/蓝图_效果_冷却';
export const CHANT = 'CatapultHero/BP/Skill/效果/蓝图_效果_吟唱';
const EQUIP = 'CatapultHero/BP/Actor/BP_Actor_Equip';
const CARD = 'CatapultHero/BP/Actor/BP_Actor_Card';

/** The cast log line (strings.json 7BC19308…, ability-framework §10). */
const CAST_LOG = textOf('<强调>{执行者}</>释放了<技能>“{技能名}”</>。', '<强调>{执行者}</> used <技能>“{技能名}”</>.');

export const abilityFns: NonNullable<AbilityFns['蓝图_能力']> = {
  // L11440 (ABILIT-004)
  初始化(self) {
    self.游戏模式 = self.world.mode;
    const row = self.技能配置;
    self.图标 = row.图标;
    self.原始描述 = row.描述;
    self.额外原始描述 = [...row.额外描述];
    self.类型 = new TagSet(row.类型);
    self.音效 = [...row.音效];
    self.销毁释放者 = row['销毁释放者？'];
    self.触发战斗 = row['触发战斗？'];
    self.范围攻击 = row['范围攻击？'];
    self.技能距离 = row.技能距离;
    self.单次级别上限 = row.单次级别上限;
    self.等级上限 = row.天赋上限;
    self.伤害修正 = row.伤害修正;
    self.冲击力 = row.冲击力;
    self.吟唱 = row.吟唱;
    self.冷却秒 = row.冷却秒;
    self.冷却回合 = row.冷却回合;
    self.消耗 = row.消耗;
    replaceTags(self.OwnedGameplayTags, row.标签);
    self.条件 = row.主条件;
    self.副条件 = [...row.副条件];
    const c = self.条件;
    self.前置点数 = c.前置点数;
    self.排斥技能 = [...c.排斥技能];
    self.需求空间 = c.需求空间;
    self.概率 = c.概率;
    self.排斥或_且 = c.排斥或且;
    self.排斥标签 = new TagSet(c.排斥标签);
    self.需求位置 = c.需求位置;
    self.目标或_且 = c.目标或且;
    self.目标标签 = new TagSet(c.目标标签);
    self.需求唯一 = c['需求唯一？'];
    self.前置技能 = '无';
    // Step 6: the level roll only applies to an owner of exactly BP_Actor_Equip (legacy, not reachable).
    if (isExactClass(self.拥有者, EQUIP)) self.等级 = RandomIntegerInRangeFromStream(MakeRandomStream(self.种子), 1, self.等级上限);
    self.参数 = row.参数.map(p => ({ ...p, 初始区间: [...p.初始区间] }));
    // L11389 → L9846: 初始区间 (dormant: no live row has one); a fresh stream per parameter.
    for (let i = 0; i < self.参数.length; i++) {
      const p = self.参数[i]!;
      if (p.初始区间.length === 0) continue;
      const r = RandomFloatInRangeFromStream(MakeRandomStream(self.种子), Math.fround(p.初始区间[0] ?? 0), Math.fround(p.初始区间[1] ?? 0));
      const add = p['整数？'] ? FCeil(r) : GridSnap_Float(r, 0.005);
      self.参数[i] = { ...p, '不预算？': false, '品质倍率？': false, 初始值: add + p.初始值 };
    }
    // L11106
    self.更新技能描述(false, 0);
    self.技能动画 = [...row.能力.动画];
    self.技能能力 = row.能力.能力类;
    self.效果配置 = row.能力.效果.map(效果配置From);
    self.子效果配置 = row.能力.子效果.map(效果配置From);
    self.发射物 = [...row.能力.发射物];
    self.地形选取 = row.能力.地形选取;
  },

  // line 98 (ABILIT-006): {0}…{3} from 生成能力描述参数 (module text), {4} = ""; 额外描述 AddUnique.
  更新技能描述(self, 预览下N级, 预览N值) {
    const { 描述中参数 } = Tools.生成能力描述参数(self, self, self.等级, 预览下N级, 预览N值);
    self.描述中参数 = 描述中参数;
    const empty = textOf('');
    const args = { '0': 描述中参数[0] ?? empty, '1': 描述中参数[1] ?? empty, '2': 描述中参数[2] ?? empty, '3': 描述中参数[3] ?? empty, '4': empty };
    self.描述 = formatText(self.原始描述, args);
    self.额外描述 = [];
    for (const t of self.额外原始描述) {
      const f = formatText(t, args);
      if (!self.额外描述.some(x => x.zh === f.zh && x.en === f.en)) self.额外描述.push(f);
    }
  },

  // line 208 (ABILIT-027): 当前消耗 = 消耗 × (1 + 消耗减免%). QUIRK: 修改体力点 applies (1 − r) again (SPEC-GAP G3).
  消耗处理(self) {
    const owner = self.拥有者;
    if (!owner || !self.world.isValid(owner)) return { 消耗值: 0 }; // "角色死了" (debug print)
    const r = 获取科学映射词条(owner.词条, '消耗减免%').输出值;
    const k = 科学数加减(sciOf(1.0, 0), r, false);
    self.当前消耗 = 科学数变普通(科学数乘除(k, sciOf(self.消耗, 0), false));
    return { 消耗值: self.当前消耗 };
  },

  // L12896 (ABILIT-011…019)
  检查条件(self) {
    const owner = self.拥有者!;
    if (self.强制释放) return castable(self, true);
    self.效果通过 = true;
    // L5794: a valid cooldown short-circuits to "not castable" (one draw, ABILIT-012).
    if (self.冷却效果 && self.world.isValid(self.冷却效果)) return castable(self, false);
    // L6631
    self.待机状态通过 = !owner.释放技能中;
    self.消耗处理();
    self.消耗通过 = true;
    // L6879: the first stunned effect breaks the loop (ABILIT-014); invalid entries print "空效果" and continue.
    for (let i = 0; i < owner.拥有的效果.length; i++) {
      const e = owner.拥有的效果[i];
      if (!e || !self.world.isValid(e)) continue;
      self.效果通过 = !e.OwnedGameplayTags.hasAny(['状态.僵直']);
      if (!self.效果通过) break;
    }
    // L7592 (ABILIT-015)
    const cur = owner.当前能力;
    if (cur && self.world.isValid(cur)) self.前置技能通过 = self.前置技能 !== '无' ? self.前置技能 === cur.能力名 : true;
    else self.前置技能通过 = !(self.前置技能 !== '无');
    // L7814 (ABILIT-016)
    const idx = owner.拥有的主动能力.indexOf(self);
    self.预制序号通过 = !owner.HasMatchingGameplayTag('可交互.角色.AI.预制技能顺序') || idx === (owner.预制技能顺序组[owner.当前预制技能序号] ?? 0);
    // L8203 (ABILIT-017): computed, never used.
    const tgt = owner.当前目标;
    self.目标标签通过 = self.排斥标签.size === 0 || (!!tgt && self.world.isValid(tgt) && tgt.OwnedGameplayTags.hasAll(self.排斥标签.toArray()));
    // L8299 (ABILIT-018): U ≤ threshold, U in [0, 100]; the threshold is 概率 for 深渊 / 中立 owners (SPEC-GAP G1).
    return castable(self, roll(self) && allPass(self));
  },

  // L12931 (ABILIT-028, 029)
  释放结束(self, 是打断) {
    const owner = self.拥有者!;
    if (self.吟唱效果 && self.world.isValid(self.吟唱效果)) {
      self.吟唱效果.K2_DestroyActor(); // plain destroy: no 销毁前触发
      self.吟唱效果 = null;
    }
    // L13021
    self.无吟唱 = false;
    if (!(是打断 || self.本技能激活中)) return;
    self.本技能激活中 = false;
    owner.释放技能中 = false;
    if (是打断) {
      const t = self.地形管理组;
      if (t && self.world.isValid(t)) (t as unknown as { 清空地形(): void }).清空地形();
      // L13217
      owner.当前能力 = null;
      owner.当前目标 = null;
      return;
    }
    // L13284
    Skills.选择声音播放(self, self.音效, 2, owner);
    // L4804: live dispatch over the owner's effects
    fireLive(owner.拥有的效果, '效果.时机.释放技能后');
    // L5644 -> UI_技能格.释放后处理: slotted player actives1..4 grant morale only on completed release.
    // The active latch above excludes repeated completion; interruption returned before this source branch.
    const slot = owner.拥有的主动能力.indexOf(self);
    if (owner === self.world.mode.玩家角色 && slot >= 1 && slot <= 4) {
      self.world.mode.玩家角色.精神系统(0, Math.trunc(self.当前消耗 / 2 + self.冷却回合), '释放技能', false);
      self.fx.ui({ op: 'update', widget: 'UI_背包栏_3d', data: { op: '更新技能栏', slot } });
    }
    owner.当前能力 = null;
    owner.当前目标 = null;
    // L4288: an item card whose row stat 最大生命 has 系数 > 0 or == −2 (SPEC-GAP U8) gets 使用牌后处理.
    if (owner instanceof BP_Actor_Card) {
      const s = 获取科学映射词条(词条映射From(owner.角色配置.科学词条), '最大生命').输出值;
      if (s.系数 > 0.0 || s.系数 === -2.0) self.world.cult.使用牌后处理(owner);
    }
    // L4687
    if (self.销毁释放者) {
      owner.当前生命 = 科学数零;
      owner.检查死亡(true, false);
    }
  },

  // L13382 (ABILIT-025, 026)
  释放开始(self) {
    if (self.吟唱 <= 0.0) return castBody(self);
    // L15763: the chant; no flags, cost or cooldown yet.
    const chant = self.world.spawn<蓝图_效果>(CHANT, e => {
      e.拥有者 = self.拥有者;
      e.来自技能 = self;
      e.持续时长 = self.吟唱;
    });
    chant.K2_AttachToActor(self);
    chant.激活效果('');
  },

  // L16270 → L13434
  释放预处理(self) {
    castBody(self);
  },

  // L16319 (ABILIT-033)
  创建冷却效果(self, 冷却秒, 冷却回合) {
    if (冷却秒 <= 0.0 && 冷却回合 < 0.0) return;
    const s: 效果配置 = {
      效果类: COOLDOWN, 持续时间: 冷却秒, 触发间隔: -1.0, 持续回合: 冷却秒 <= 0.0 ? FTrunc(冷却回合) : -1,
      叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 1,
    };
    const name = Skills.获取效果名(self, self, s.效果类).效果名字;
    const owner = self.拥有者;
    // L16275 → L15
    if (!owner || !self.world.isValid(owner) || owner.死掉了) return;
    const merge = Tools.附加效果前处理(self, s, owner, name);
    if (merge.不需附加新效果) return;
    // L556
    const e = self.world.spawn<蓝图_效果>(COOLDOWN, x => {
      x.拥有者 = owner;
      x.释放者 = owner;
      x.来自技能 = self;
      x.持续时长 = s.持续时间;
      x.触发间隔 = s.触发间隔;
      x.持续回合 = s.持续回合;
      x.叠加层数 = s.叠加层数;
      x.临时 = false;
    });
    if (!self.world.isValid(e)) return; // "效果生成失败"
    e.效果名字 = name;
    tagNewEffect(self, e);
    // L3682
    addUnique(owner.拥有的效果, e);
    e.K2_AttachToActor(owner);
    e.K2_AttachToActor(self);
    e.激活效果('');
  },

  // L16919: fills 修炼系统.当前条件预览牌 with the 主条件 selection (UI highlight).
  预览目标(self) {
    const { 筛选后 } = Skills.技能条件筛选物品(self, self.world.cult, self, -1);
    for (const c of 筛选后) addUnique(self.world.cult.当前条件预览牌, c);
  },

  // L17007
  ReceiveDestroyed(self) {
    const t = self.地形管理组;
    if (t && self.world.isValid(t)) (t as unknown as { 清空地形(): void }).清空地形();
  },

  特殊结算() {},
  子初始化() {},
  检查子条件() {},
  被选中() {},
  执行技能() {},
};

/** L8856 / L5837, then L5922 (ABILIT-019): the debug roll draws again and is discarded (SPEC-GAP G2). */
function castable(self: 蓝图_能力, ok: boolean): void {
  const owner = self.拥有者!;
  self.本技能可释放 = ok;
  if (ok) addUnique(owner.可释放能力, self);
  else removeItem(owner.可释放能力, self);
  roll(self);
}

function roll(self: 蓝图_能力): boolean {
  const owner = self.拥有者!;
  const U = RandomIntegerInRange(self.world.rng.combat, 0, 100);
  const threshold = owner.角色类型 === '深渊' || owner.角色类型 === '中立' ? self.概率 : 100;
  return U <= threshold;
}

function allPass(self: 蓝图_能力): boolean {
  return self.子条件通过 && self.效果通过 && self.前置技能通过 && self.预制序号通过 && self.消耗通过 && self.解锁了 && self.待机状态通过;
}

/** L13434 … L15701 (ABILIT-026), in this exact order. */
function castBody(self: 蓝图_能力): void {
  const owner = self.拥有者!;
  self.本技能激活中 = true;
  owner.释放技能中 = true;
  const who = Log.日志__获取角色名(self, owner).Output;
  const what = Log.日志__获取能力名(self, self).Output;
  Log.日志__输出(self, formatText(CAST_LOG, { 执行者: who, 技能名: what }), owner, new TagSet(['可交互.角色.玩家']), new TagSet(['可交互.修炼牌']));
  self.创建冷却效果(self.冷却秒, self.冷却回合);
  Skills.选择声音播放(self, self.音效, 1, owner);
  if (self.当前消耗 > 0.0) Tools.修改体力点(self, sciOf(self.当前消耗 * -1.0, 0), 科学数零, owner, null, false, owner.K2_GetActorLocation());
  // L14802
  owner.更新外观数据();
  fireLive(owner.拥有的效果, '效果.时机.释放技能前');
  // L15701
  self.执行技能(false);
  if (self.触发战斗) self.world.mode.进入战斗状态();
}

/**
 * ABILIT-040 (L3682 / L4152): an effect spawned by an ability whose owner is exactly BP_Actor_Equip or BP_Actor_Card
 * (and not 临时) gets 效果.时机.装上 / 卸下; otherwise a talent's effect gets 能力.类型.天赋. The generic abilities
 * repeat this inline in their own modules.
 */
export function tagNewEffect(self: 蓝图_能力, e: 蓝图_效果): void {
  if ((isExactClass(self.拥有者, EQUIP) || isExactClass(self.拥有者, CARD)) && !e.临时) {
    e.OwnedGameplayTags.add('效果.时机.装上');
    e.OwnedGameplayTags.add('效果.时机.卸下');
  } else if (self.world.isValid(self) && self.是天赋) {
    e.OwnedGameplayTags.add('能力.类型.天赋');
  }
}

/** Set OwnedGameplayTags = 标签 (a replaced container). */
function replaceTags(set: TagSet, tags: readonly string[]): void {
  for (const t of set.toArray()) set.remove(t);
  for (const t of tags) set.add(t);
}
