/**
 * The kernel half of 函数库_工具 / 函数库_技能 (WAVE_A Appendix W2 `kernel`). Demo: CatapultHero/函数库/函数库_工具 and
 * 函数库_技能 (pseudo-file lines below). Pure math delegates to src/core/math (core-math).
 */
import type { KernelFns } from '../../bp/systems.ts';
import type { 结构_权重数据表 } from '../../../content/demo/types.ts';
import type { BpObject } from '../../sim/object.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { Rand15, UeStream } from '../../rng/ue.ts';
import { RandomFloatInRange } from '../../rng/ue.ts';
import { GridSnap_Float, 叠加映射属性, 计算除余数 } from '../../math/kismet.ts';
import { 计算除余数_科学, 限制科学数 } from '../../math/sci.ts';
import { 添加科学映射值 } from '../../math/stats.ts';
import * as prob from '../../math/prob.ts';
import { 函数库_技能 as Skills } from '../../bp/index.ts';
import { heroTags } from './actor.ts';

/**
 * The domain of a caller-domain draw (core-math CORE-M-129 "caller (combat or meta)"). SPEC-GAP: the facade does not
 * carry the caller's domain; draws made while a combat phase runs use `combat`, every other draw `meta`.
 */
function callerDomain(ctx: BpObject): Rand15 {
  const p = ctx.world.mode.当前环节;
  const combat = p === '回合开始' || p === '揭示场牌' || p === '交互场牌' || p === '进行战斗' || p === '回合结束';
  return combat ? ctx.world.rng.combat : ctx.world.rng.meta;
}

/** A blueprint RandomStream argument: the stream itself, or the run's 全局种子 when the caller passes none. */
function streamOf(ctx: BpObject, s: unknown): UeStream {
  return s && typeof s === 'object' && 'Seed' in s ? (s as UeStream) : ctx.world.rng.全局种子;
}

/** UE RotateAngleAxis around +Z (degrees). */
function rotateZ(v: Vec3, deg: number): Vec3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

const weightItems = (组: 结构_权重数据表[]) => 组 as unknown as Parameters<typeof prob.拆分权重数据表>[0];

export const 函数库_工具: NonNullable<KernelFns['函数库_工具']> = {
  PRD概率判断_批量(ctx, P, 触发计数, 触发次数) {
    return prob.PRD概率判断_批量(P, 触发计数, 触发次数, callerDomain(ctx));
  },
  PRD概率判断(ctx, P, 触发计数) {
    return { 触发: prob.PRD概率判断(P, 触发计数, callerDomain(ctx)) };
  },
  CfromP(_ctx, P) {
    return { C: prob.CfromP(P) };
  },
  PfromC(_ctx, C) {
    return { P: prob.PfromC(C) };
  },
  传统概率判断(ctx, 概率) {
    return { 触发: prob.传统概率判断(概率, callerDomain(ctx)) };
  },
  // The ref Int 被强化属性 comes back as an out.
  递减强化属性(ctx, 强化次数, 每次概率, 被强化属性) {
    return { 被强化属性: prob.递减强化属性(强化次数, 每次概率, 被强化属性, callerDomain(ctx)) };
  },
  权重选取(ctx, 权重组, Stream) {
    return { 选中的序号: prob.权重选取(权重组, streamOf(ctx, Stream)) };
  },
  拆分权重数据表(_ctx, 权重数据表组) {
    const r = prob.拆分权重数据表(weightItems(权重数据表组));
    return { 权重数组: r.权重数组, 数据表数组: r.数据表数组 as never };
  },
  权重创建数组(ctx, 数量, 权重数据表组, Stream) {
    return { 选出的数组: prob.权重创建数组(数量, weightItems(权重数据表组), streamOf(ctx, Stream)).filter(x => x !== null) as never };
  },
  权重强化数值(ctx, 权重强化映射, Stream) {
    return { 输出值: prob.权重强化数值(权重强化映射, streamOf(ctx, Stream)) };
  },
  随机化(ctx, 被随机, 吸附单位, 加减浮动, 浮动范围, 取整, Stream) {
    return prob.随机化(被随机, 吸附单位, 加减浮动, 浮动范围, 取整, streamOf(ctx, Stream));
  },

  // line 89: snaps x / y to the 64 uu grid and offsets half a cell toward the point; z = 0. 偏移 is unused.
  吸附到网格(_ctx, InVec, _偏移, 吸附大小) {
    const gy = GridSnap_Float(InVec.y, 64.0);
    const gx = GridSnap_Float(InVec.x, 64.0);
    const half = 吸附大小 * 0.5;
    const neg = 吸附大小 * -0.5;
    return { x: gx + (gx - InVec.x > 0.0 ? neg : half), y: gy + (gy - InVec.y > 0.0 ? neg : half), z: 0.0 };
  },

  // line 111: the yaw of the vector snapped to 角度 degrees, as a unit vector in the plane.
  向量吸附角度(_ctx, 输入, 角度) {
    const yaw = Math.fround((Math.atan2(输入.y, 输入.x) * 180) / Math.PI);
    const snapped = Math.fround(GridSnap_Float(yaw, 角度));
    const r = (snapped * Math.PI) / 180;
    return { 输出: { x: Math.cos(r), y: Math.sin(r), z: 0 } };
  },

  // line 311
  是敌人(_ctx, 我, 对方) {
    if (!我 || !对方) return { 是敌人: true };
    const same = 对方.角色类型 === 我.角色类型 || (对方.角色类型 === '玩家' && 我.角色类型 === '修炼牌');
    return { 是敌人: !same };
  },

  // line 407: the actor and its attached actors. Visibility is presentation: the view reads `hidden`.
  隐藏目标和子物体(ctx, 目标, bNewHidden) {
    if (!目标 || !ctx.world.isValid(目标)) return;
    ctx.world.bus.emit({ t: ctx.world.clock.now, kind: 'actor.hide', id: 目标.id, hidden: bNewHidden });
  },

  计算除余数_科学(_ctx, 累计值, 添加值, 触发阈值) {
    return 计算除余数_科学(累计值, 添加值, 触发阈值);
  },
  计算除余数(_ctx, 累计值, 添加值, 触发阈值) {
    return 计算除余数(累计值, 添加值, 触发阈值);
  },

  // line 794
  获取英雄标签(_ctx, 英雄名) {
    return heroTags(英雄名);
  },

  // line 1380: 数量 × 30 + 1 candidates (two combat draws each), then greedy picks at least 最小间距 apart on legal cells.
  范围选取点(ctx, 起始位置, 最小半径, 最大半径, 最小间距, 数量, 避开角色, 查询者体积) {
    const g = ctx.world.rng.combat;
    const initial: Vec3[] = [];
    const k = Math.SQRT1_2;
    for (let i = 0; i <= 数量 * 30; i++) {
      const r = RandomFloatInRange(g, 最小半径, 最大半径);
      const deg = Math.fround(RandomFloatInRange(g, 0.0, 360.0));
      const v = rotateZ({ x: r * k, y: r * k, z: 0 }, deg);
      const p = { x: 起始位置.x + v.x, y: 起始位置.y + v.y, z: 起始位置.z + v.z };
      if (!initial.some(q => q.x === p.x && q.y === p.y && q.z === p.z)) initial.push(p);
    }
    const picked: Vec3[] = [];
    for (let i = 0; i < initial.length; i++) {
      const c = initial[i]!;
      const tooClose = picked.some(q => Math.hypot(q.x - c.x, q.y - c.y) <= 最小间距);
      const legal = Skills.查找地形格(ctx, ctx.world.mode, c, { x: 0, y: 0, z: 0 }, 避开角色, 查询者体积);
      if (tooClose || !firstOut(legal)) continue;
      if (!picked.some(q => q.x === c.x && q.y === c.y && q.z === c.z)) picked.push(c);
      if (picked.length >= 数量) break;
    }
    return { 选到的点: picked };
  },

  // line 1846
  修改目标词条_加减(ctx, 目标, 词条, 来源, 修改值, 有限制, Min, Max) {
    if (!目标 || !ctx.world.isValid(目标)) return;
    添加科学映射值(目标.词条, 词条, 来源, 有限制 ? 限制科学数(修改值, Min, Max) : 修改值, false);
  },

  // line 2318: the same exchange sort as 排序效果.
  排序整数(_ctx, InputPin, 正序) {
    for (let i = 0; i < InputPin.length; i++) {
      for (let j = i; j <= InputPin.length - 1; j++) {
        const greater = InputPin[i]! > InputPin[j]!;
        if (正序 ? greater : !greater) {
          const t = InputPin[j]!;
          InputPin[j] = InputPin[i]!;
          InputPin[i] = t;
        }
      }
    }
  },

  // line 2656: depth-first over the attached actors, then the target.
  销毁目标和子物体(ctx, 目标) {
    destroyTree(ctx, 目标);
  },

  // line 2870
  检查阵营(_ctx, 目标) {
    return { 一个阵营: !!目标 && 目标.角色类型 === (目标.当前目标?.角色类型 ?? '玩家') };
  },

  // line 2897
  获取操控角色(ctx) {
    return { 玩家角色: ctx.world.mode.玩家控制器?.玩家角色 ?? null };
  },
};

/** 查找地形格's first out pin (找到了？). */
function firstOut(r: unknown): boolean {
  if (r && typeof r === 'object') {
    const v = Object.values(r)[0];
    return v === true;
  }
  return false;
}

function destroyTree(ctx: BpObject, 目标: BpObject | null): void {
  if (!目标 || !ctx.world.isValid(目标)) return;
  const children: BpObject[] = [];
  for (const o of attachedTo(ctx, 目标)) children.push(o);
  for (const c of children) destroyTree(ctx, c);
  目标.K2_DestroyActor();
}

/**
 * GetAttachedActors (函数库_工具.txt #2656): direct children from the runtime's live-object table.
 * Facade-only test worlds predating that table still use their explicitly supplied effect/ability lists.
 */
function attachedTo(ctx: BpObject, 目标: BpObject): BpObject[] {
  const objects = (ctx.world as typeof ctx.world & { objects?(): readonly BpObject[] }).objects;
  if (objects) return objects.call(ctx.world).filter(o => ctx.world.isValid(o) && o.attachParent === 目标);
  const out: BpObject[] = [];
  const t = 目标 as { 拥有的效果?: unknown[]; 拥有的主动能力?: unknown[]; 拥有的被动能力?: unknown[] };
  for (const list of [t.拥有的效果, t.拥有的主动能力, t.拥有的被动能力]) {
    for (const o of list ?? []) {
      if (o && ctx.world.isValid(o) && (o as BpObject).attachParent === 目标 && !out.includes(o as BpObject)) out.push(o as BpObject);
    }
  }
  return out;
}

export const 函数库_技能: NonNullable<KernelFns['函数库_技能']> = {
  叠加映射属性(_ctx, TargetMap, 能力_词条名, 叠加值, 最大值) {
    叠加映射属性(TargetMap, 能力_词条名, 叠加值, 最大值);
  },
};
