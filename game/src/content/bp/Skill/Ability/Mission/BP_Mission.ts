/**
 * BP_Mission: the room mission (turn-flow TURN-079…087). 执行技能 attaches the goal effect of 效果配置[0] to the
 * hero (拥有者 = 玩家角色, set by 创建任务); 完成任务 / 失败任务 set the flags, then lead to the reward flow or the floor end.
 * Demo: CatapultHero/BP/Skill/Ability/Mission/BP_Mission (dump/blueprints-pseudo/…/Ability/Mission/BP_Mission.txt).
 * Parent: 蓝图_能力. Batch: core-turn.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置, type 效果配置 } from '../../../../../core/bp/structs.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
import type { 结构_任务条 } from '../../../../../content/demo/types.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import { currentMapTile } from '../../../../../core/sim/map-tile.ts';

const 地图宝藏_PATH: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取地图宝藏';
/** MIS ln 84: reward types whose floor end follows 完成任务 after 0.5 s. */
const AUTO_END_REWARDS = ['能力.类型.奖励.获取属性', '能力.类型.奖励.获取兽肉', '能力.类型.奖励.获取锻造', '能力.类型.奖励.无', '能力.类型.奖励.休息', '能力.类型.奖励.是商店'];
const CARD_CLASSES: readonly AssetPath[] = ['CatapultHero/BP/Actor/BP_Actor_Card', 'CatapultHero/BP/Actor/BP_Actor_Equip'];

export class BP_Mission extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/Mission/BP_Mission';
  目标效果实例: 蓝图_效果 | null = null;
  失败了: boolean = false; // 失败了？
  未完成: boolean = true; // 未完成？
  完成过了: boolean = false; // 完成过了？
  计数实例: unknown[] = [];
  任务条结构: 结构_任务条 = structOf('结构_任务条');

  // L6195
  override 执行技能(是读档: boolean): void {
    const cfg = this.效果配置[0] ?? make效果配置();
    const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
    const owner = this.拥有者;
    if (!owner || !this.world.isValid(owner)) return;
    if (owner.死掉了) return; // L1107
    const pre = 函数库_工具.附加效果前处理(this, cfg, owner, name); // L1150
    let e: 蓝图_效果 | null = pre.效果实例;
    if (!pre.不需附加新效果) {
      e = this.spawnEffect(cfg, owner, name); // L1543
      if (!e) return;
    }
    this.目标效果实例 = e; // L1301
    if (!e) return;
    e.激活效果('');
    const loadable = e as 蓝图_效果 & { 读档处理?(是读档: boolean): void };
    if (typeof loadable.读档处理 === 'function') loadable.读档处理(是读档); // 接口_工具
  }

  // L7246
  完成任务(): void {
    this.未完成 = false;
    this.完成过了 = true;
    const mode = this.world.mode;
    const hero = mode.玩家角色;
    hero?.关闭碰撞(); // L7183
    // L6764: UI_任务列表.更新任务条 is presentation
    if (this.类型.has('能力.类型.任务.轮回')) return;
    this.world.cult.切换修炼背包(false); // L6938
    const cfg = make效果配置({ 效果类: 地图宝藏_PATH, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 1 });
    const name = 函数库_技能.获取效果名(this, this, 地图宝藏_PATH).效果名字; // L6359
    if (!hero || !this.world.isValid(hero)) return;
    if (hero.死掉了) return; // L3322
    if (函数库_工具.附加效果前处理(this, cfg, hero, name).不需附加新效果) return; // L3387
    const e = this.spawnEffect(cfg, hero, name); // L3742
    if (!e) return;
    e.激活效果('');
    const reward = currentMapTile(this.world)?.奖励技能实例; // MIS ln 81-85: the selected map tile
    if (reward && this.world.isValid(reward) && reward.类型.hasAny(AUTO_END_REWARDS)) {
      this.delay('L719', 0.5, () => mode.结束当前层(true));
    }
  }

  // L7273
  失败任务(): void {
    this.失败了 = true;
    this.完成过了 = false;
    const mode = this.world.mode;
    mode.玩家角色?.关闭碰撞(); // L7120
    this.world.cult.切换修炼背包(false); // L7002
    if (mode.玩家角色?.死掉了) return;
    mode.结束当前层(true); // L6726
  }

  /** The deferred spawn of an effect on `owner` (L1543…L2939, L3742…L184). */
  private spawnEffect(cfg: 效果配置, owner: BP_ManeActor, name: string): 蓝图_效果 | null {
    const w = this.world;
    if (!cfg.效果类) { w.unported('BP_Mission.效果生成失败'); return null; }
    const e = w.spawn<蓝图_效果>(cfg.效果类, o => {
      o.拥有者 = owner; o.释放者 = owner; o.来自技能 = this;
      o.持续时长 = cfg.持续时间; o.触发间隔 = cfg.触发间隔; o.持续回合 = cfg.持续回合; o.叠加层数 = cfg.叠加层数; o.临时 = false;
    });
    if (!w.isValid(e)) return null; // 效果生成失败
    e.效果名字 = name;
    if (CARD_CLASSES.includes(owner.def.path) && !e.临时) {
      e.OwnedGameplayTags.add('效果.时机.装上');
      e.OwnedGameplayTags.add('效果.时机.卸下');
    } else if (this.是天赋) {
      e.OwnedGameplayTags.add('能力.类型.天赋');
    }
    if (!owner.拥有的效果.includes(e)) owner.拥有的效果.push(e);
    e.K2_AttachToActor(owner);
    return e;
  }
}
