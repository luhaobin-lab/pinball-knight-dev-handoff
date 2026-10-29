/**
 * 蓝图_效果_精神状态: TODO one-line summary of what the blueprint does.
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): none.
 * Rows: none.
 * Batch: content-bpkit.
 */
import { 蓝图_效果 } from '../../../../../../../src/core/ability/effect.ts';
import type { AssetPath } from '../../../../../../../src/content/demo/types.ts';
import type { Tag } from '../../../../../../../src/core/sim/types.ts';

export class 蓝图_效果_精神状态 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态';
  精神类型: number = 0;
  类型名: string = '乐观';
  是读档: boolean = false;

  悬停高亮(_显示高亮: boolean): void {
    // L1343:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.悬停高亮');
  }

  玩家交互(): void {
    // L1348:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.玩家交互');
  }

  悬停提示(): void {
    // L1353:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.悬停提示');
  }

  新一天时(): void {
    // L1358:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.新一天时');
  }

  被复活_重置(): void {
    // L1363:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.被复活/重置');
  }

  盒子关闭后(): void {
    // L1368:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.盒子关闭后');
  }

  天赋关闭后(): void {
    // L1373:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.天赋关闭后');
  }

  刷新盒子(): void {
    // L1378:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.刷新盒子');
  }

  激活额外特效(_激活: boolean): void {
    // L1383:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.激活额外特效');
  }

  奖励配置(_所在格层配置: unknown, _所在格种子: number): void {
    // L1388:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.奖励配置');
  }

  特殊处理(): void {
    // L1393:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.特殊处理');
  }

  AI行动前(): void {
    // L1398:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.AI行动前');
  }

  回合开始前(): void {
    // L1403:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.回合开始前');
  }

  结束层时(): void {
    // L1408:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.结束层时');
  }

  衍生物提示(_开启: boolean): void {
    // L1413:
    // goto L2264
    //
    this.world.unported('蓝图_效果_精神状态.衍生物提示');
  }

  override 激活后触发(Debug: string): void {
    // L1418:
    // CallFunc_HasMatchingGameplayTag_ReturnValue = self.拥有者.HasMatchingGameplayTag(GameplayTag{TagName='可交互.角色.玩家'})
    // if (!(CallFunc_HasMatchingGameplayTag_ReturnValue)) goto L2264
    // CallFunc_HasMatchingGameplayTag_ReturnValue_1 = HasMatchingGameplayTag(GameplayTag{TagName='效果.类型.减益.精神'})
    // if (!(CallFunc_HasMatchingGameplayTag_ReturnValue_1)) goto L186
    // self.游戏模式.主界面.区域判断.负面全屏警告()
    // goto L186
    //
    super.激活后触发(Debug);
  }

  override 销毁前触发(): void {
    // L1656:
    // CallFunc_Map_Find_ReturnValue = BlueprintMapLibrary.Map_Find(ref self.游戏模式.玩家角色.精神存档, ref self.来自技能.能力名, out CallFunc_Map_Find_Value)
    // if (!(CallFunc_Map_Find_ReturnValue)) goto L2194
    // K2Node_MakeStruct_________.能力实例 = None
    // K2Node_MakeStruct_________.唯一ID = self.来自技能.唯一ID
    // K2Node_MakeStruct_________.能力等级 = 1
    // K2Node_MakeStruct_________.能力品质 = 1
    // K2Node_MakeStruct_________.剩余回合 = 0
    // K2Node_MakeStruct_________.叠加层数 = 0
    // BlueprintMapLibrary.Map_Add(ref self.游戏模式.玩家角色.精神存档, ref self.来自技能.能力名, ref K2Node_MakeStruct_________)
    // self.游戏模式.玩家角色.保存精神状态()
    // L2194:
    // self.对应增减益格.RemoveFromParent()
    // goto L2264
    //
    super.销毁前触发();
  }

  override 持续中触发(触发时机: Tag): void {
    // L2235:
    // goto L2264
    //
    super.持续中触发(触发时机);
  }

  ReceiveDestroyed(): void {
    // L2240:
    // goto L1656
    //
    this.world.unported('蓝图_效果_精神状态.ReceiveDestroyed');
  }

  读档处理(_是读档: boolean): void {
    // L2245:
    // self.是读档？ = K2Node_Event_____
    // L2264:
    // return
    // end
    this.world.unported('蓝图_效果_精神状态.读档处理');
  }
}
