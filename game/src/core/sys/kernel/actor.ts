/**
 * Actor kernel (WAVE_A Appendix W2 `kernel`): BP_ManeActor.初始化 and the per-class 激活角色, the stat refresh
 * (更新最大生命魔力, 属性被修改后, 修正词条数值, 标签被修改后), 更新角色数据, collision flags and the ticks.
 * Demo: CatapultHero/BP/Actor/{BP_ManeActor, BP_Actor_Player, BP_Actor_Other, BP_Actor_Card, 蓝图_主角色控制器},
 * CatapultHero/BP/环境/蓝图_通用路口 (pseudo lines and labels below).
 *
 * Actors tick in the Demo, but the core does not tick an actor by default (ARCHITECTURE §4.6): a module that needs
 * BP_ManeActor.ReceiveTick (fog, 物理判断, 实时检测, the 移到目标地点 movement) turns it on with setTickEnabled(true).
 */
import type { KernelFns } from '../../bp/systems.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { TagSet } from '../../sim/tags.ts';
import { fireLive } from '../../ability/dispatch.ts';
import { 获取科学映射词条, 添加科学映射值, 科学映射原始值, 词条映射From } from '../../math/stats.ts';
import { 比较科学数_纯正, 科学数乘除, 科学数变普通 } from '../../math/sci.ts';
import { MakeRandomStream, Array_ShuffleFromStream } from '../../rng/ue.ts';
import { stageFixedSkills } from '../../sim/stage-scope.ts';

/** Array_AddUnique. */
function addUnique<T>(arr: T[], x: T): void {
  if (!arr.includes(x)) arr.push(x);
}

/** The movement started by 移到目标地点 (launch): its event parameters, kept by the ubergraph for ReceiveTick (L3933). */
export interface MoveParams { 位移曲线: string; 高度曲线: string; 高度: number }
type Moving = BP_ManeActor & { ug_移到目标地点?: MoveParams };

export const maneFns: NonNullable<KernelFns['BP_ManeActor']> = {
  // line 5572. Flow: the main block (row copy, 部位序号, stats) → L1698 (body, mass, head bar) → L2164 (anim, skills, talents).
  初始化(self, 是读档) {
    const w = self.world;
    const row = self.角色配置;
    self.游戏模式 = w.mode;
    self.已揭示 = false;
    self.死掉了 = false;
    self.战斗状态 = false;
    self.描述 = [...row.描述];
    self.解锁 = row.解锁;
    self.贴图 = row.贴图;
    self.精灵片 = row.精灵片;
    self.品质图 = [...row.品质图];
    self.音效 = [...row.音效];
    self.角色类型 = row.类型;
    self.部位 = new TagSet(row.部位);
    self.标签 = new TagSet(row.标签);
    self.动画配置 = row.动画;
    self.被击特效A = row.粒子[0] ?? null;
    self.弹力点 = 10;
    self.权重 = row.属性.权重;
    self.行动力 = row.属性.行动力;
    self.最大物理速度 = row.属性.速度;
    self.高度 = row.属性.高度;
    self.宽度 = row.属性.宽度;
    self.疲劳 = row.属性.疲劳;
    self.最大疲劳 = row.属性.最大疲劳;
    self.偏移 = row.属性.偏移;
    self.出生点 = { x: row.属性.出生点.X, y: row.属性.出生点.Y, z: row.属性.出生点.Z };
    replaceTags(self, self.标签.toArray());
    if (self.OwnedGameplayTags.hasAny(['可交互.角色.AI.仇恨.噩梦', '可交互.角色.AI.仇恨.首领'])) self.是精英 = true;
    // L1213
    for (const t of self.部位.toArray()) addUnique(self.部位序号, w.mode.所有部位数组.indexOf(t));
    // L4814
    if (!是读档) {
      // L5335
      self.词条 = 词条映射From(row.科学词条);
      self.唯一ID = `${self.名字}//${self.种子}`;
    }
    // L4828
    self.当前生命 = 获取科学映射词条(self.词条, '生命').输出值;
    self.当前魔力 = 获取科学映射词条(self.词条, '魔力').输出值;
    self.初始冲量 = 科学数变普通(科学映射原始值(self.词条, '质量', false)) / 50.0;
    self.装备掉落 = [...row.装备掉落];
    self.材料掉落 = [...row.材料掉落];
    self.制造需求 = row.制造需求;
    // L1698: capsule size and the head bar's elite icon are presentation (高度 / 宽度 / 是精英 are in the view).
    self.更新角色质量(false);
    // L2164: the sprite anim blueprint takes the row's sequences.
    self.精灵动画序列 = [...row.动画.精灵动画序列];
    // L2414
    self.预制技能顺序组 = [...row.预制技能顺序];
    for (const e of self.拥有的效果) e?.K2_DestroyActor();
    self.拥有的效果.length = 0;
    for (const a of self.拥有的主动能力) a?.K2_DestroyActor();
    self.拥有的主动能力.length = 0;
    for (const a of self.拥有的被动能力) a?.K2_DestroyActor();
    self.拥有的被动能力.length = 0;
    self.可释放能力.length = 0;
    // WAVE_A §4 G2 only: 守门人 has 肉弹战车; the full seven-skill Demo row remains unchanged under filter='all'.
    self.固定技能 = [...stageFixedSkills(w.filter, self.名字, row.固定技能)];
    self.随机普通技能 = [...row.随机普通技能];
    self.随机精英技能 = [...row.随机精英技能];
    self.拥有技能的数据 = [...self.固定技能];
    // The seeded shuffle (BP_ManeActor.初始化 shuffle, CORE-M-129 "seeded locals"): one random common skill.
    if (self.随机普通技能.length > 0) {
      Array_ShuffleFromStream(MakeRandomStream(self.种子), self.随机普通技能);
      const first = self.随机普通技能[0];
      if (first && !self.拥有技能的数据.some(h => h.DataTable === first.DataTable && h.RowName === first.RowName)) self.拥有技能的数据.push(first);
    }
    // L4063
    for (const h of self.拥有技能的数据) self.添加技能(h, 1, 0);
    // L4345
    self.天赋表 = [...row.天赋表];
    self.天赋池 = [];
    for (const t of self.天赋表) {
      const table = t ? w.data.table(t) : undefined;
      if (table) self.天赋池.push(...Object.keys(table.rows));
    }
    // L4760: 重置外观 (presentation), 控制器 = GetController.
    self.重置外观();
  },

  // line 5566: empty in BP_ManeActor (the subclasses override it).
  激活角色() {},

  // line 2895 (BP_Actor_Player L23387 calls it as its parent).
  更新最大生命魔力(self) {
    updateMaxHealthMana(self);
  },

  // line 2857: live dispatch of 属性被修改后, then the max refresh for the hero and hostiles.
  属性被修改后(self) {
    fireLive(self.拥有的效果, '效果.时机.属性被修改后');
    if (self.OwnedGameplayTags.hasAny(['可交互.角色.玩家', '可交互.角色.AI.仇恨'])) self.更新最大生命魔力();
  },

  // line 984: live dispatch over the hero's list (not the caller's).
  标签被修改后(self) {
    const hero = self.world.mode.玩家角色;
    if (hero) fireLive(hero.拥有的效果, '效果.时机.物品标签被修改');
  },

  // line 1190: copies every source "永久保留" of the given map into 词条, then 更新角色数据.
  修正词条数值(self, 修正词条) {
    for (const [name, entry] of 修正词条) {
      for (const [src, v] of entry.来源映射) if (src === '永久保留') 添加科学映射值(self.词条, name, '永久保留', v, false);
    }
    self.更新角色数据();
  },

  // L4067: Sequence 更新外观数据 → 更新朝向 → 更新运动数据.
  更新角色数据(self) {
    self.更新外观数据();
    self.更新朝向();
    self.更新运动数据();
  },

  // L6590 / L6666: physics simulation and collision flags. The core keeps them as fields the physics module reads.
  关闭碰撞(self) {
    setCollision(self, false, false);
  },
  开启碰撞(self) {
    setCollision(self, !self.OwnedGameplayTags.hasAny(['可交互.修炼牌', '可交互.角色.AI.不可动']), true);
  },

  // L4463→L3923→L3933: the ubergraph Gate is separate from the public 移动中 flag. L4122 opens it;
  // arrival closes it (L301/L311). 结束行动 can clear 移动中 while an older skill settles, without closing this Gate.
  ReceiveTick(self) {
    self.迷雾处理();
    self.物理判断();
    self.实时检测();
    const m = (self as Moving).ug_移到目标地点;
    if (!m) return;
    self.移动位置更新(m.位移曲线, m.高度曲线, m.高度);
    if (!self.抵达位置) return;
    self.移动当前时长 = 0.0;
    self.移动中 = false;
    self.结束移动判断();
  },

  // L4062: empty event.
  特殊处理() {},
};

export const playerFns: NonNullable<KernelFns['BP_Actor_Player']> = {
  // L16914 → L16447. The overlap sphere, the audio listener and the loop sound are presentation.
  激活角色(self, 是读档) {
    self.初始化(是读档);
    self.更新角色数据();
    self.属性被修改后();
    const { 本英雄, 非本英雄 } = heroTags(self.名字);
    self.本英雄标签 = 本英雄;
    self.非本英雄标签 = 非本英雄;
    // Player L16870 → L1591: after its initial preview object is ready. The native preview replaces that object,
    // but the source readiness flag still gates terrain BeginOverlap and the player's own tick.
    self.初始化完毕 = true;
  },

  // L23387: the parent's body.
  更新最大生命魔力(self) {
    updateMaxHealthMana(self);
  },

  // line 123: pickup hover bookkeeping (更新不再拾取物, 进入待拾取触发) belongs to the launch module.
  后更新(self) {
    self.更新不再拾取物();
    for (const p of self.将拾取的加速物) (p as { 进入待拾取触发?(x: null): void }).进入待拾取触发?.(null);
    self.之前将拾取的加速物 = [...self.将拾取的加速物];
    self.将拾取的加速物 = [];
  },
};

export const otherFns: NonNullable<KernelFns['BP_Actor_Other']> = {
  // L13056: 初始化, 成长属性, every ability re-initialised at the actor's level, then 初始化完毕 (EMS save flags dropped).
  激活角色(self, 是读档) {
    self.初始化(是读档);
    self.成长属性();
    for (const list of [self.拥有的被动能力, self.拥有的主动能力]) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i] as 蓝图_能力 | null;
        if (!a) continue;
        a.等级 = self.等级;
        a.初始化();
      }
    }
    self.初始化完毕 = true;
  },

  // L14315: empty.
  ReceiveDestroyed() {},
};

export const cardFns: NonNullable<KernelFns['BP_Actor_Card']> = {
  // L9569: the card face widget is presentation.
  激活角色(self, 是读档) {
    self.初始化(是读档);
    const tags = self.标签;
    self.尺寸 = tags.hasExact('可交互.修炼牌.小型') ? 1 : tags.hasExact('可交互.修炼牌.中型') ? 2 : 3;
    // Card L9569: compare the saved acquisition round with EMS; this is independent of the load flag.
    const save = (self.world.sys.save as { GetCustomSave?(w: typeof self.world): { 轮回次数: number } }).GetCustomSave?.(self.world);
    self.是遗产 = save !== undefined && self.获取轮次 !== save.轮回次数;
    if (self.是遗产) self.OwnedGameplayTags.add('可交互.修炼牌.遗产');
    const hp = 科学数变普通(科学映射原始值(self.词条, '最大生命', false));
    self.可使用 = hp > 0.0 || hp === -2.0;
    self.升级此牌(true, false);
  },

  // L12584: the parent tick, then the drag-follow of a grabbed card (input / presentation).
  ReceiveTick(self, DeltaSeconds) {
    self.DeltaTime = Math.fround(DeltaSeconds);
    maneFns.ReceiveTick!(self, Math.fround(self.DeltaTime));
  },

  // L37813 / L37863: the parent's.
  关闭碰撞(self) {
    setCollision(self, false, false);
  },
  开启碰撞(self) {
    setCollision(self, !self.OwnedGameplayTags.hasAny(['可交互.修炼牌', '可交互.角色.AI.不可动']), true);
  },
};

export const controllerFns: NonNullable<KernelFns['蓝图_主角色控制器']> = {
  // L8099 → L7039: input mapping (shell), 游戏模式, 玩家角色.
  ReceiveBeginPlay(self) {
    self.游戏模式 = self.world.mode;
    const hero = self.world.mode.玩家角色;
    if (hero) self.玩家角色 = hero;
  },
  // L8657 → L7496: cursor hover and drag (input, the shell).
  ReceiveTick() {},
};

export const junctionFns: NonNullable<KernelFns['蓝图_通用路口']> = {
  // L4814 → L3491
  ReceiveBeginPlay(self) {
    self.游戏模式 = self.world.mode;
    self.未点击 = true;
  },
  // L3447 → L2458: the reward icon bob (presentation).
  ReceiveTick() {},
};

/** line 2895 */
function updateMaxHealthMana(self: BP_ManeActor): void {
  添加科学映射值(self.词条, '最大生命', '', 获取科学映射词条(self.词条, '生命').输出值, false);
  const extra = 科学数乘除(获取科学映射词条(self.词条, '生命').输出值, 获取科学映射词条(self.词条, '额外生命%').输出值, false);
  添加科学映射值(self.词条, '最大生命', '额外生命词条', extra, false);
  self.当前最大生命 = 获取科学映射词条(self.词条, '最大生命').输出值;
  self.当前生命 = 比较科学数_纯正(self.当前最大生命, self.当前生命, true);
  self.生命百分比 = 科学数变普通(科学数乘除(self.当前生命, self.当前最大生命, true));
  self.当前最大魔力 = 获取科学映射词条(self.词条, '最大魔力').输出值;
  self.魔力百分比 = 科学数变普通(科学数乘除(self.当前魔力, 获取科学映射词条(self.词条, '最大魔力').输出值, true));
}

/** The collision state the physics module reads (SetSimulatePhysics / SetCollisionEnabled 0 or 3). */
function setCollision(self: BP_ManeActor, simulate: boolean, enabled: boolean): void {
  self.可物理模拟 = simulate;
  (self as BP_ManeActor & { ug_碰撞开启?: boolean }).ug_碰撞开启 = enabled;
}

/** Set OwnedGameplayTags = 标签. */
function replaceTags(self: BP_ManeActor, tags: readonly string[]): void {
  for (const t of self.OwnedGameplayTags.toArray()) self.OwnedGameplayTags.remove(t);
  for (const t of tags) self.OwnedGameplayTags.add(t);
}

const HERO_TAGS = ['可交互.角色.玩家.幽冥骑士', '可交互.角色.玩家.灵魂猎手', '可交互.角色.玩家.恶疫旅人', '可交互.角色.玩家.元素祭司'];
const HERO_NAMES = ['幽冥骑士', '灵魂猎手', '恶疫旅人', '元素祭司'];

/** 函数库_工具.获取英雄标签 (line 794). An unknown name reads Array_Get(−1) = the empty tag. */
export function heroTags(英雄名: string): { 本英雄: string; 非本英雄: TagSet } {
  const i = HERO_NAMES.indexOf(英雄名);
  const self = i >= 0 ? HERO_TAGS[i]! : 'None';
  return { 本英雄: self, 非本英雄: new TagSet(HERO_TAGS.filter(t => t !== self)) };
}
