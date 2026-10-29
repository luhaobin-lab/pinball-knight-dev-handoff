/**
 * The multi-choice of UI_主界面 (开启多选一 / 关闭多选一 / 刷新多选一 / 更新刷新按钮, MAIN ln 527–645 and UBERGRAPH
 * L917–L3397, L5166–L5672, L7416–L8014, L9905–L12007) and its options UI_天赋选项 (激活选项 L3734–L7154,
 * OnMouseButtonDown, 移除选项), ported to the core. The widget state lives here, one per world; the player answers
 * through the kernel modal service (`modal.pick` / `modal.reroll` / `modal.skip`).
 */
import type { CommandSpec, ModalAnswer } from '../../api/commands.ts';
import type { ChoiceOptionView, ModalView, MultiChoiceSource } from '../../api/view.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import 数据表_天赋_boss专属 from '../../../content/demo/data/数据表_天赋_boss专属.ts';
import 数据表_天赋_专属 from '../../../content/demo/data/数据表_天赋_专属.ts';
import 数据表_天赋_新新通用 from '../../../content/demo/data/数据表_天赋_新新通用.ts';
import { hasRow, type HasRows } from '../../../content/demo/index.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { FTrunc } from '../../math/kismet.ts';
import { 递减强化属性 } from '../../math/prob.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { Array_Shuffle } from '../../rng/ue.ts';
import type { BpObject } from '../../sim/object.ts';
import type { AssetPath, Tag } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { g2Talent, G2_SCOPE } from '../../sim/stage-scope.ts';
import { 技能行, 筛选天赋 } from './filter.ts';

const BOSS_PICK: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_首领天赋获取';

/** One UI_天赋选项 (CDO: 本次提升等级 1, 价格 1, 剩余可提升等级 1, 临时计数等级 1). */
interface 选项 {
  readonly 临时名字: string;
  技能实例: 蓝图_能力 | null;
  有存在相同: boolean;
  本次提升等级: number;
  剩余可提升等级: number;
  临时计数等级: number;
  价格: number;
  描述: string;
  显示等级: number;
  递进回调: number | null;
}

/** UI_主界面's multi-choice variables (CDO: 不加入回合开始？ true, 可刷新次数 1). */
interface 主界面 {
  筛选后天赋池: string[];
  排除天赋池: string[];
  多选一选项: 选项[];
  来自效果: 蓝图_效果 | null;
  来自能力: 蓝图_能力 | null;
  不加入回合开始: boolean;
  免费: boolean;
  天赋_事件: boolean;
  可刷新次数: number;
  刷新价格: number;
  /** Ubergraph copies of the last 开启多选一 parameters (read when the 0.2 s delay fires). */
  ug: { 目标或_且: boolean; 目标标签: Tag[]; 排除标签: Tag[]; 指定池子: string[]; 选项数量: number; 额外等级: number };
  source: MultiChoiceSource;
  /** The modal view currently shown (null while hidden). */
  view: ModalView | null;
  /** Delay latches of the two 0.2 s delays (Linkage 1618 / 917). */
  openPending: boolean;
  closePending: boolean;
  openCallback: number | null;
  closeCallback: number | null;
}

const states = new WeakMap<World, 主界面>();

/** UI event clicks check Ability.待机状态通过 (!owner.释放技能中) in source. The modal can appear during a launch;
 * event-jump simulation must let that real action settle before treating this as a decision boundary. This pure
 * predicate does not call 检查条件 (which consumes RNG), disable clicks, or change source cancellation rules.
 */
export function waitsForEventAction(world: World): boolean {
  const ui=states.get(world);
  if(!ui?.天赋_事件||!ui.view||world.modal.current!==ui.view)return false;
  const options=ui.多选一选项.filter(o=>world.isValid(o.技能实例)&&world.isValid(o.技能实例.拥有者));
  return options.length>0&&options.every(o=>o.技能实例!.拥有者!.释放技能中);
}

/** The world's UI_主界面 multi-choice state. */
export function 主界面Of(world: World): 主界面 {
  let s = states.get(world);
  if (!s) {
    s = {
      筛选后天赋池: [], 排除天赋池: [], 多选一选项: [], 来自效果: null, 来自能力: null, 不加入回合开始: true, 免费: false,
      天赋_事件: false, 可刷新次数: 1, 刷新价格: 0,
      ug: { 目标或_且: false, 目标标签: [], 排除标签: [], 指定池子: [], 选项数量: 0, 额外等级: 0 },
      source: 'levelUp', view: null, openPending: false, closePending: false, openCallback:null, closeCallback:null,
    };
    states.set(world, s);
  }
  return s;
}

/** The parameters of UI_主界面.开启多选一, in the Demo's order. */
export interface 开启多选一参数 {
  readonly 目标或_且: boolean;
  readonly 目标标签: readonly Tag[];
  readonly 排除标签: readonly Tag[];
  readonly 指定池子: readonly string[];
  readonly 不加入回合开始: boolean;
  readonly 免费: boolean;
  readonly 天赋_事件: boolean;
  readonly 选项数量: number;
  readonly 可刷新次数: number;
  readonly 额外等级: number;
  readonly 来自效果: 蓝图_效果 | null;
  readonly 来自能力: 蓝图_能力 | null;
}

/** FMath::Clamp (KismetMathLibrary.Clamp): X < Min ? Min : X < Max ? X : Max. */
function clampI(x: number, min: number, max: number): number {
  return x < min ? min : x < max ? x : max;
}

function 全局修正(world: World, 词条: string): number {
  return 科学数变普通(获取科学映射词条(world.mode.全局词条, 词条).输出值);
}

function headUp(world: World, text: string): void {
  const hero = world.mode.玩家角色;
  world.mode.fx.headUp(hero ?? world.mode, { ns: 'UI_主界面', key: text });
}

function sourceOf(p: 开启多选一参数): MultiChoiceSource {
  if (p.天赋_事件) return 'event';
  if (p.来自效果?.def.path === BOSS_PICK) return 'boss';
  if (p.来自能力) return 'initialReward';
  if (p.指定池子.length > 0) return 'scroll';
  if (p.目标标签.includes('能力.类型.天赋.唯一')) return 'unique';
  return 'levelUp';
}

/** 开启多选一 (L7416): store the parameters, join the turn-start barrier, then build the options after 0.2 s. */
export function 开启多选一(world: World, p: 开启多选一参数): void {
  const ui = 主界面Of(world);
  const mode = world.mode;
  ui.来自效果 = p.来自效果;
  ui.来自能力 = p.来自能力;
  ui.不加入回合开始 = p.不加入回合开始;
  ui.免费 = p.免费;
  ui.天赋_事件 = p.天赋_事件;
  ui.ug = { 目标或_且: p.目标或_且, 目标标签: [...p.目标标签], 排除标签: [...p.排除标签], 指定池子: [...p.指定池子], 选项数量: p.选项数量, 额外等级: p.额外等级 };
  ui.source = sourceOf(p);
  if (mode.玩家控制器) mode.玩家控制器.玩家可与环境交互 = false;
  ui.可刷新次数 = p.可刷新次数 + FTrunc(全局修正(world, '刷新次数修正'));
  if (!ui.不加入回合开始) mode.加入回合开始(mode.玩家角色); // L7942
  world.cult.切换屏蔽(true, true, 0); // L7825
  if (ui.openPending) return; // Delay latch (one per node)
  ui.openPending = true;
  ui.openCallback=world.clock.after(0.2, () => {
    ui.openCallback=null;
    ui.openPending = false;
    显示选项(world);
  });
}

/** Ubergraph @1618 (after the 0.2 s delay): refresh button, then the pool (given or filtered) and the options. */
function 显示选项(world: World): void {
  const ui = 主界面Of(world);
  更新刷新按钮(world);
  if (ui.ug.指定池子.length > 0 || ui.天赋_事件) {
    ui.筛选后天赋池 = world.filter === 'ported' && !ui.天赋_事件
      ? ui.ug.指定池子.filter(name => g2Talent(name) && 天赋行已移植(world, name))
      : [...ui.ug.指定池子];
  } else {
    const hero = world.mode.玩家角色;
    ui.筛选后天赋池 = 筛选天赋(world, hero?.天赋池 ?? [], {
      目标或_且: ui.ug.目标或_且, 目标标签: ui.ug.目标标签, 排除标签: ui.ug.排除标签, 排除天赋池: ui.排除天赋池,
      已移植: world.filter === 'ported' ? name => 天赋行已移植(world, name) : undefined,
    }); // L3397
  }
  创建选项(world);
}

const TALENT_TABLES: readonly HasRows<unknown, string>[] = [数据表_天赋_新新通用, 数据表_天赋_专属, 数据表_天赋_boss专属];

/** WAVE_A §3.5 under 'ported': a talent row is offered only when every class its manifest entry references is registered. */
function 天赋行已移植(world: World, name: string): boolean {
  const table = [...TALENT_TABLES].reverse().find(t => hasRow(t, name));
  const ready = table ? world.isRowPorted(table.asset, name) : false;
  if (!ready && world.filter === 'ported' && g2Talent(name)) throw new Error(`G2 required talent ${name} has unimplemented classes (${G2_SCOPE.source})`);
  return ready;
}

/** L2145: clear, then one UI_天赋选项 per pool entry (at most 选项数量 for talents; every entry for events). */
function 创建选项(world: World): void {
  const ui = 主界面Of(world);
  if (ui.筛选后天赋池.length === 0) {
    关闭多选一(world);
    headUp(world, '我没有可提升的天赋了。');
    return;
  }
  const last = ui.天赋_事件 ? ui.筛选后天赋池.length - 1 : Math.min(ui.筛选后天赋池.length - 1, ui.ug.选项数量 - 1);
  for (let i = 0; i <= last; i++) {
    const o: 选项 = { 临时名字: ui.筛选后天赋池[i], 技能实例: null, 有存在相同: false, 本次提升等级: 1, 剩余可提升等级: 1, 临时计数等级: 1, 价格: 1, 描述: '', 显示等级: 1, 递进回调: null };
    激活选项(world, o);
    if (!ui.多选一选项.includes(o)) ui.多选一选项.push(o);
  }
  展示(world);
}

/** UI_天赋选项.激活选项 (L3734): the level gain, the ability instance (owned or new), the price. */
function 激活选项(world: World, o: 选项): void {
  const ui = 主界面Of(world);
  const hero = world.mode.玩家角色;
  // SPEC-GAP: 诅咒？ is never set in the Demo's code, so the curse branch is not modelled.
  if (!ui.天赋_事件) o.本次提升等级 = 递减强化属性(2, 0.12, o.本次提升等级, world.rng.meta); // L5801
  const row = 技能行(o.临时名字); // L4172
  if (!row || !hero) return; // L5588 "合成数据表中无该天赋"
  const same = 函数库_工具.存在相同被动(hero, hero, o.临时名字);
  o.有存在相同 = same.有存在;
  const owned = same.对应能力;
  if (o.有存在相同 && owned) {
    o.剩余可提升等级 = owned.等级上限 === -1 ? 9999 : owned.等级上限 - owned.等级;
    o.本次提升等级 = owned.等级上限 === -1 ? o.本次提升等级 + ui.ug.额外等级 : clampI(o.本次提升等级 + ui.ug.额外等级, 1, o.剩余可提升等级);
    o.技能实例 = owned; // L4885
  } else {
    o.剩余可提升等级 = row.天赋上限 === -1 ? 9999 : row.天赋上限; // L5866
    o.本次提升等级 = row.天赋上限 === -1 ? o.本次提升等级 + ui.ug.额外等级 : clampI(o.本次提升等级 + ui.ug.额外等级, 1, o.剩余可提升等级);
    const path = row.能力.能力类;
    if (!path) return;
    const 等级 = o.本次提升等级;
    const a = world.spawn<蓝图_能力>(path, x => { // L6266
      x.唯一ID = o.临时名字;
      x.能力名 = o.临时名字;
      x.拥有者 = hero;
      x.等级 = 1;
      x.品质 = 1;
      x.种子 = 0;
    });
    a.技能配置 = row;
    a.等级 = 等级;
    a.初始化();
    a.子初始化();
    o.技能实例 = a;
    a.K2_AttachToActor(hero);
  }
  // L4918
  o.临时计数等级 = Math.min(ui.ug.额外等级 + 1, o.剩余可提升等级);
  o.价格 = ui.免费 ? 0 : o.本次提升等级 * 3; // 更新描述
  更新描述(world, o);
  if (o.本次提升等级 - ui.ug.额外等级 > 1) hero.获得精神状态('幸运', false); // L5533
  if (o.临时计数等级 < o.本次提升等级) o.递进回调 = world.clock.after(0.6, () => 递进等级(world, o)); // L5533 -> linkage423
}

/** UI_天赋选项.更新描述 L186: two pure previews; the widget never overwrites the owned ability's level or text. */
function 更新描述(world: World, o: 选项): void {
  const a = o.技能实例;
  if (!world.isValid(a)) return;
  // Cast<蓝图_能力_给自身加主动>: the child carries the active's original template and parameters.
  const described = '创建的主动' in a ? (a as 蓝图_能力 & { 创建的主动: 蓝图_能力 | null }).创建的主动 : a;
  if (!world.isValid(described)) return;
  const fresh = 函数库_工具.生成能力描述参数(a, described, o.临时计数等级, false, 1).描述中参数;
  const upgrade = 函数库_工具.生成能力描述参数(a, described, described.等级, true, o.临时计数等级).描述中参数;
  const args = o.有存在相同 ? upgrade : fresh;
  // Source binds exactly0..3 and an empty4; missing Array_Get text is empty.
  o.描述 = described.原始描述.zh.replace(/\{([0-4])\}/g, (_, n: string) => n === '4' ? '' : args[Number(n)]?.zh ?? '');
  o.显示等级 = (o.有存在相同 ? described.等级 : 0) + o.临时计数等级;
}

function 选项仍显示(world: World, o: 选项): boolean {
  const ui = 主界面Of(world);
  return world.isValid(o.技能实例) && ui.多选一选项.includes(o) && ui.view !== null && world.modal.current === ui.view;
}

/** L5533 Delay0.6 -> L38 increments, then Delay0.9 -> linkage15 updates text and repeats. */
function 递进等级(world: World, o: 选项): void {
  o.递进回调 = null;
  if (!选项仍显示(world, o) || o.临时计数等级 >= o.本次提升等级) return;
  o.临时计数等级++;
  o.递进回调 = world.clock.after(0.9, () => {
    o.递进回调 = null;
    if (!选项仍显示(world, o)) return;
    更新描述(world, o);
    展示(world);
    递进等级(world, o);
  });
}

/** UI_天赋选项.移除选项 (L7154): a new instance that was not picked is destroyed; an owned one is kept. */
function 移除选项(world: World, o: 选项): void {
  if (o.递进回调 !== null) world.clock.cancel(o.递进回调);
  o.递进回调 = null;
  if (!world.isValid(o.技能实例)) return;
  if (o.有存在相同) return;
  函数库_工具.销毁目标和子物体(o.技能实例, o.技能实例);
}

/** 更新刷新按钮 (L10015): price 3 + 刷新费用修正 精核. */
function 更新刷新按钮(world: World): void {
  const ui = 主界面Of(world);
  ui.刷新价格 = FTrunc(3 + 全局修正(world, '刷新费用修正'));
}

function 可刷新(world: World): boolean {
  const ui = 主界面Of(world);
  // The button shows when ¬天赋/事件 ∧ 可刷新次数 > 0 and is enabled when 可刷新次数 ≠ 0 ∧ 金币 ≥ 刷新价格.
  return !ui.天赋_事件 && ui.可刷新次数 > 0 && world.mode.金币 >= ui.刷新价格;
}

/** The modal view of the shown options; answers route back here. */
function 展示(world: World): void {
  const ui = 主界面Of(world);
  const options: ChoiceOptionView[] = ui.多选一选项.map(o => {
    const row = 技能行(o.临时名字);
    return {
      row: o.临时名字,
      title: row?.额外描述[0]?.zh ?? o.临时名字,
      text: o.描述,
      level: o.显示等级,
      icon: row?.图标 ?? '',
      // UI_天赋选项: paid options show their actual price; the price plate is hidden for free choices.
      ...(ui.免费 ? {} : { price: o.价格 }),
    };
  });
  const view: ModalView = {
    kind: 'multiChoice', source: ui.source, title: ui.天赋_事件 ? '事件' : '天赋', options,
    reroll: !ui.天赋_事件 && ui.可刷新次数 > 0 ? { cost: ui.刷新价格, currency: '精核' } : null, canSkip: true,
  };
  ui.view = view;
  world.modal.open(view, a => 回答(world, a));
}

function 回答(world: World, a: ModalAnswer): void {
  if (a.type === 'modal.pick') 选择(world, a.option);
  else if (a.type === 'modal.reroll') 点击刷新(world);
  else if (a.type === 'modal.skip') 关闭多选一(world); // 天赋放弃按钮 (L9905)
}

/** UI_天赋选项.OnMouseButtonDown: pay, learn (or run the event ability), close. */
function 选择(world: World, index: number): void {
  const ui = 主界面Of(world);
  const o = ui.多选一选项[index];
  if (!o) return;
  const mode = world.mode;
  if (!(o.价格 <= mode.金币)) {
    headUp(world, '没有足够精核。'); // L659
    return;
  }
  const a = o.技能实例;
  if (!world.isValid(a)) return;
  if (ui.天赋_事件) {
    a.检查条件();
    a.检查子条件();
    if (!a.本技能可释放) return; // L922
    const special = (a as unknown as { 特殊处理?: () => void }).特殊处理; // 接口_工具
    if (typeof special === 'function') special.call(a);
    a.执行技能(false);
  } else {
    mode.更新轮回战斗统计('获取天赋', 1); // L777
    mode.玩家角色?.添加天赋(a, o.本次提升等级, o.有存在相同, false);
  }
  o.技能实例 = null; // L430
  mode.增加金币_收入(false, false, o.价格 * -1, null);
  关闭多选一(world);
  mode.fx.sound('CatapultHero/声音/选奖励2');
}

/** 刷新按钮 click (L11892): one refresh used, pay, reshuffle the filtered pool, rebuild the options. */
function 点击刷新(world: World): void {
  if (!可刷新(world)) return;
  const ui = 主界面Of(world);
  ui.可刷新次数 = ui.可刷新次数 - 1;
  更新刷新按钮(world);
  world.mode.增加金币_收入(false, false, ui.刷新价格 * -1, null); // L11787
  刷新多选一(world);
}

/** 刷新多选一 (L5166): remove the options, shuffle 筛选后天赋池 (meta), rebuild from L2145. */
export function 刷新多选一(world: World): void {
  const ui = 主界面Of(world);
  for (const o of ui.多选一选项) 移除选项(world, o);
  ui.多选一选项 = [];
  Array_Shuffle(world.rng.meta, ui.筛选后天赋池); // L5079
  创建选项(world);
}

/** 关闭多选一 (L5217): remove the options now; after 0.2 s leave the barrier and call 天赋关闭后 on the sources. */
export function 关闭多选一(world: World): void {
  const ui = 主界面Of(world);
  for (const o of ui.多选一选项) 移除选项(world, o);
  ui.多选一选项 = [];
  if (ui.view && world.modal.current === ui.view) world.modal.close();
  ui.view = null;
  if (ui.closePending) return; // Delay latch
  ui.closePending = true;
  ui.closeCallback=world.clock.after(0.2, () => {
    ui.closeCallback=null;
    ui.closePending = false;
    关闭后(world);
  });
}

/** Ubergraph @917: unblock the UI, leave the barrier (unless 不加入回合开始？), then the sources' 天赋关闭后 (L1235). */
function 关闭后(world: World): void {
  const ui = 主界面Of(world);
  const mode = world.mode;
  world.cult.切换屏蔽(false, false, 2);
  if (mode.玩家控制器) {
    mode.玩家控制器.玩家可与环境交互 = true;
    mode.玩家控制器.在侧栏3DUI上 = false;
  }
  mode.玩家角色?.更新外观数据();
  if (!ui.不加入回合开始) mode.退出回合开始(mode.玩家角色); // L1546
  for (const src of [ui.来自效果, ui.来自能力] as (BpObject | null)[]) {
    if (!world.isValid(src)) continue;
    const f = (src as unknown as { 天赋关闭后?: () => void }).天赋关闭后; // 接口_工具
    if (typeof f === 'function') f.call(src);
  }
}

/** The modal commands the open multi-choice accepts (affordable picks, the refresh when enabled, give up). */
export function legal(world: World): CommandSpec[] {
  const ui = states.get(world);
  if (!ui?.view || world.modal.current !== ui.view) return [];
  const picks = ui.多选一选项.flatMap((o, i) => (o.价格 <= world.mode.金币 && world.isValid(o.技能实例) ? [i] : []));
  const out: CommandSpec[] = [];
  if (picks.length > 0) out.push({ type: 'modal.pick', params: { option: picks } });
  if (可刷新(world)) out.push({ type: 'modal.reroll' });
  out.push({ type: 'modal.skip' });
  return out;
}

/** Source OpenLevel destroys UI_主界面 and its option widgets/latent nodes. Persistent H5 services emulate that
 * lifetime explicitly; do not call normal 天赋关闭后 during teardown or close another owner's current modal.
 */
export function resetTransient(world:World):void{
  const ui=states.get(world);if(!ui)return;
  if(ui.openCallback!==null)world.clock.cancel(ui.openCallback);
  if(ui.closeCallback!==null)world.clock.cancel(ui.closeCallback);
  for(const o of ui.多选一选项)移除选项(world,o);
  if(ui.view&&world.modal.current===ui.view)world.modal.close();
  ui.多选一选项=[];ui.view=null;ui.openPending=false;ui.closePending=false;states.delete(world);
}
