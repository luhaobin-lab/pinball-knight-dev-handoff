/**
 * 蓝图_效果_精神状态_饥饱: TODO one-line summary of what the blueprint does.
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱.txt)
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 效果.时机.新一天时, 效果.时机.增加体力后, 效果.时机.减少体力后.
 * Rows: 数据表_技能_精神状态:饥饿, 数据表_技能_精神状态:饱腹.
 * Batch: content-bpkit.
 */
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';
import type { AssetPath } from '../../../../../../../src/content/demo/types.ts';
import type { Tag } from '../../../../../../../src/core/sim/types.ts';

export class 蓝图_效果_精神状态_饥饱 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱';
  溢出的体力: { 系数: number; 指数: number } = { 系数: 0, 指数: 0 };

  override 激活后触发(Debug: string): void {
    // L242:
    // 激活后触发(K2Node_Event_Debug)
    // CallFunc_Concat_StrStr_ReturnValue = KismetStringLibrary.Concat_StrStr(self.来自技能.唯一ID, "")
    // 函数库_技能_C.获取技能参数(self.来自技能, 0, false, "", self, out CallFunc___________, out CallFunc____________1, out CallFunc____________2, out CallFunc___________1)
    // K2Node_MakeStruct_______.系数 = CallFunc____________2
    // K2Node_MakeStruct_______.指数 = 0
    // 函数库_科学数_C.添加科学映射值(ref self.拥有者.词条, CallFunc___________1, CallFunc_Concat_StrStr_ReturnValue, ref K2Node_MakeStruct_______, false, self)
    // goto L15
    //
    super.激活后触发(Debug);
  }

  override 持续中触发(触发时机: Tag): void {
    // L581:
    // 持续中触发(K2Node_Event_____)
    // GameplayTagsK2Node_SwitchGameplayTag_CmpSuccess = (K2Node_Event_____ != "效果.时机.新一天时")
    // if (!(GameplayTagsK2Node_SwitchGameplayTag_CmpSuccess)) goto L803
    // GameplayTagsK2Node_SwitchGameplayTag_CmpSuccess = (K2Node_Event_____ != "效果.时机.增加体力后")
    // if (!(GameplayTagsK2Node_SwitchGameplayTag_CmpSuccess)) goto L1533
    // GameplayTagsK2Node_SwitchGameplayTag_CmpSuccess = (K2Node_Event_____ != "效果.时机.减少体力后")
    // if (!(GameplayTagsK2Node_SwitchGameplayTag_CmpSuccess)) goto L1822
    // pop_flow
    // L803:
    // Temp_string_Variable = "饱腹"
    // Temp_int_Variable_1 = 3
    // Temp_int_Variable_2 = -3
    // 函数库_技能_C.获取技能参数(self.来自技能, 1, false, "", self, out CallFunc____________3, out CallFunc____________4, out CallFunc____________5, out CallFunc___________2)
    // CallFunc_FTrunc_ReturnValue_1 = KismetMathLibrary.FTrunc(CallFunc____________5)
    // Temp_int_Variable_3 = CallFunc_FTrunc_ReturnValue_1
    // Temp_int_Variable = CallFunc_FTrunc_ReturnValue_1
    // Temp_string_Variable_1 = "饥饿"
    // self.游戏模式.玩家角色.精神系统(0, switch(Temp_int_Variable){0: Temp_int_Variable_2; 1: Temp_int_Variable_1; default: K2Node_Select_Default}, switch(Temp_int_Variable_3){0: Temp_string_Variable_1; 1: Temp_string_Variable; default: K2Node_Select_Default_2}, false)
    // 函数库_技能_C.获取技能参数(self.来自技能, 1, false, "", self, out CallFunc____________3, out CallFunc____________4, out CallFunc____________5, out CallFunc___________2)
    // CallFunc_FTrunc_ReturnValue_1 = KismetMathLibrary.FTrunc(CallFunc____________5)
    // CallFunc_EqualEqual_IntInt_ReturnValue = (CallFunc_FTrunc_ReturnValue_1 == 1)
    // if (!(CallFunc_EqualEqual_IntInt_ReturnValue)) pop_flow
    // self.对应增减益格.显示额外数据(true)
    // CallFunc_LessEqual_IntInt_ReturnValue = (self.剩余回合 <= 0)
    // if (!(CallFunc_LessEqual_IntInt_ReturnValue)) pop_flow
    // L1518:
    // 销毁效果()
    // pop_flow
    // L1533:
    // push_flow L1822
    // 函数库_科学数_C.科学数加减+-(self.拥有者.溢出的体力, self.溢出的体力, false, self, out CallFunc____________6)
    // self.溢出的体力 = CallFunc____________6
    // 函数库_科学数_C.科学数变普通(self.溢出的体力, self, out CallFunc__________)
    // CallFunc_FMin_ReturnValue = KismetMathLibrary.FMin(CallFunc__________, 100.0)
    // CallFunc_FTrunc_ReturnValue = KismetMathLibrary.FTrunc(CallFunc_FMin_ReturnValue)
    // self.剩余回合 = CallFunc_FTrunc_ReturnValue
    // goto L96
    // L1822:
    // 函数库_技能_C.获取技能参数(self.来自技能, 1, false, "", self, out CallFunc____________3, out CallFunc____________4, out CallFunc____________5, out CallFunc___________2)
    // CallFunc_FTrunc_ReturnValue_1 = KismetMathLibrary.FTrunc(CallFunc____________5)
    // CallFunc_EqualEqual_IntInt_ReturnValue = (CallFunc_FTrunc_ReturnValue_1 == 1)
    // Temp_bool_Variable = CallFunc_EqualEqual_IntInt_ReturnValue
    // CallFunc_GreaterEqual_DoubleDouble_ReturnValue = (self.拥有者.魔力百分比 >= 0.25)
    // CallFunc_Not_PreBool_ReturnValue = !CallFunc_GreaterEqual_DoubleDouble_ReturnValue
    // if (!(switch(Temp_bool_Variable){false: CallFunc_GreaterEqual_DoubleDouble_ReturnValue; true: CallFunc_Not_PreBool_ReturnValue; default: K2Node_Select_Default_1})) pop_flow
    // goto L1518
    //
    super.持续中触发(触发时机);
  }

  override 销毁前触发(): void {
    // L2150:
    // 销毁前触发()
    // CallFunc_Concat_StrStr_ReturnValue_1 = KismetStringLibrary.Concat_StrStr(self.来自技能.唯一ID, "")
    // 函数库_技能_C.获取技能参数(self.来自技能, 0, false, "", self, out CallFunc___________, out CallFunc____________1, out CallFunc____________2, out CallFunc___________1)
    // CallFunc_________ReturnValue = 函数库_科学数_C.移除科学映射值(ref self.拥有者.词条, CallFunc___________1, CallFunc_Concat_StrStr_ReturnValue_1, self)
    // if (!(CallFunc_________ReturnValue)) pop_flow
    // goto L161
    // L2422:
    // return
    // end
    super.销毁前触发();
  }
}
