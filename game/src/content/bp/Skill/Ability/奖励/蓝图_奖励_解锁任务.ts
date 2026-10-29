/** Source L31: clear run quest progress, mark current run mission completed, release. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { World } from '../../../../../core/sim/world.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_奖励_解锁任务 extends 蓝图_能力 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_解锁任务';
  override 执行技能(_read:boolean):void{const s=(this.world.sys.save as typeof this.world.sys.save&{GetCustomSave(w:World):{当前轮回任务进度:Map<string,number>;主线任务:Map<string,boolean>}}).GetCustomSave(this.world);s.当前轮回任务进度.clear();s.主线任务.set((this.world.mode.当前轮回任务 as 蓝图_能力|null)?.能力名??'None',true);this.fx.ui({op:'update',widget:'save.persist'});this.释放结束(false);}
  override 被选中():void{}
  override 检查子条件():void{}
}
