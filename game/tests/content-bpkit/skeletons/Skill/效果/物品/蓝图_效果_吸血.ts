/**
 * 蓝图_效果_吸血: TODO one-line summary of what the blueprint does.
 * Demo: CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.造成伤害后.
 * Rows: 数据表_技能_修炼物品:速效药剂B, 数据表_技能_附魔:传奇附魔_0, 数据表_技能_附魔:粘稠体液_0.
 * Batch: content-bpkit.
 */
import { 蓝图_效果 } from '../../../../../../src/core/ability/effect.ts';
import type { AssetPath } from '../../../../../../src/content/demo/types.ts';
import type { Tag } from '../../../../../../src/core/sim/types.ts';

export class 蓝图_效果_吸血 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血';
  来源名字: string = '元素伤害%';
  叠加值: number = 0;
  计数: number = 0;

  override 激活后触发(Debug: string): void {
    // L10:
    // goto L1056
    //
    super.激活后触发(Debug);
  }

  override 销毁前触发(): void {
    // L15:
    // goto L1056
    //
    super.销毁前触发();
  }

  override 持续中触发(触发时机: Tag): void {
    // L20:
    // CallFunc_EqualEqual_ObjectObject_ReturnValue = (self.来自技能.拥有者 == self.伤害数据.来自角色)
    // CallFunc_Array_Contains_ReturnValue = KismetArrayLibrary.Array_Contains(ref self.游戏模式.持续伤害类型, ref self.伤害数据.伤害类型)
    // CallFunc_Not_PreBool_ReturnValue = !CallFunc_Array_Contains_ReturnValue
    // CallFunc_BooleanAND_ReturnValue = (CallFunc_Not_PreBool_ReturnValue && CallFunc_EqualEqual_ObjectObject_ReturnValue)
    // if (!(CallFunc_BooleanAND_ReturnValue)) goto L1056
    // CallFunc_K2_GetActorLocation_ReturnValue = self.游戏模式.玩家角色.K2_GetActorLocation()
    // CallFunc_MakeVector_ReturnValue = KismetMathLibrary.MakeVector(self.游戏模式.玩家角色.高度, 0.0, 0.0)
    // CallFunc_Add_VectorVector_ReturnValue = (CallFunc_K2_GetActorLocation_ReturnValue + CallFunc_MakeVector_ReturnValue)
    // 函数库_技能_C.获取技能参数(self.来自技能, 0, false, "", self, out CallFunc___________, out CallFunc____________1, out CallFunc____________2, out CallFunc__________)
    // K2Node_MakeStruct_______.系数 = CallFunc____________2
    // K2Node_MakeStruct_______.指数 = 0
    // 函数库_科学数_C.科学数乘除*/(self.伤害数据.伤害数值, K2Node_MakeStruct_______, false, self, out CallFunc____________3)
    // K2Node_MakeStruct______.是暴击？ = false
    // K2Node_MakeStruct______.生命护甲 = false
    // K2Node_MakeStruct______.治疗整数 = CallFunc____________3
    // K2Node_MakeStruct______.治疗百分比 = 结构_科学数{系数=0.0, 指数=0}
    // K2Node_MakeStruct______.触发次数 = 1
    // K2Node_MakeStruct______.特效位置 = CallFunc_Add_VectorVector_ReturnValue
    // K2Node_MakeStruct______.来自技能 = self.来自技能
    // K2Node_MakeStruct______.释放者 = self.游戏模式.玩家角色
    // self.游戏模式.玩家角色.获得治疗(K2Node_MakeStruct______, false, false)
    // L1056:
    // return
    // end
    super.持续中触发(触发时机);
  }
}
