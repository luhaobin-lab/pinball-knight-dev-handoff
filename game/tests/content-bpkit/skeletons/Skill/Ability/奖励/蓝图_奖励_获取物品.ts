/**
 * 蓝图_奖励_获取物品: TODO one-line summary of what the blueprint does.
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取物品 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取物品.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_技能_奖励:初始奖励B, 数据表_技能_奖励:获取物品_新手关, 数据表_技能_奖励:获取物品_新手关2, 数据表_技能_奖励:获取物品_初始, 数据表_技能_奖励:获取物品_其他角色, 数据表_技能_奖励:获取物品_附魔, 数据表_技能_奖励:获取物品_武器, 数据表_技能_奖励:获取物品_饰品, 数据表_技能_奖励:获取物品_工具, 数据表_技能_奖励:获取物品_灌注, 数据表_技能_奖励:获取物品_护甲, 数据表_技能_奖励:获取物品_格挡, 数据表_技能_奖励:获取物品_闪避, 数据表_技能_奖励:获取物品_流血, 数据表_技能_奖励:获取物品_剧毒, 数据表_技能_奖励:获取物品_治愈, 数据表_技能_奖励:获取物品_气地, 数据表_技能_奖励:获取物品_火电, 数据表_技能_奖励:获取物品_非武器, 数据表_技能_奖励:获取物品_大型, 数据表_技能_奖励:获取物品_中型, 数据表_技能_奖励:获取物品_小型, 数据表_技能_奖励:获取物品_废料, 数据表_技能_奖励:获取物品_随机废料, 数据表_技能_奖励:获取物品_白银, 数据表_技能_奖励:获取物品_全随机, 数据表_技能_奖励:获取物品_随机小型武器, 数据表_技能_奖励:获取物品_随机小型非武器, 数据表_技能_奖励:获取物品_随机武器, 数据表_技能_奖励:获取物品_随机饰品, 数据表_技能_奖励:获取物品_随机工具, 数据表_技能_奖励:获取物品_随机中型, 数据表_技能_奖励:获取物品_随机附魔, 数据表_技能_奖励:获取物品_传奇, 数据表_技能_奖励:终结选项_3.
 * Batch: content-bpkit.
 */
import { 蓝图_能力 } from '../../../../../../src/core/ability/ability.ts';
import type { AssetPath } from '../../../../../../src/content/demo/types.ts';

export class 蓝图_奖励_获取物品 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取物品';
  指定名组: string[] = [];
  Array: string[] = [];
  Gameplay_Tags: string[] = [];
  触发计数: number = 1;
  词条修正: Record<string, unknown> = {};
  数量: number = 1;
  生成品质: number = 1;
  不结束层: boolean = false;

  悬停高亮(_显示高亮: boolean): void {
    // L407:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.悬停高亮');
  }

  玩家交互(): void {
    // L408:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.玩家交互');
  }

  悬停提示(): void {
    // L409:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.悬停提示');
  }

  新一天时(): void {
    // L410:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.新一天时');
  }

  被复活_重置(): void {
    // L411:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.被复活/重置');
  }

  天赋关闭后(): void {
    // L412:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.天赋关闭后');
  }

  激活额外特效(_激活: boolean): void {
    // L413:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.激活额外特效');
  }

  读档处理(_是读档: boolean): void {
    // L414:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.读档处理');
  }

  奖励配置(_所在格层配置: unknown, _所在格种子: number): void {
    // L415:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.奖励配置');
  }

  AI行动前(): void {
    // L416:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.AI行动前');
  }

  回合开始前(): void {
    // L417:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.回合开始前');
  }

  结束层时(): void {
    // L418:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.结束层时');
  }

  衍生物提示(_开启: boolean): void {
    // L419:
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.衍生物提示');
  }

  override 执行技能(是读档: boolean): void {
    // L420:
    // 函数库_技能_C.获取技能参数(self, 4, false, "", self, out CallFunc____________10, out CallFunc____________11, out CallFunc____________12, out CallFunc___________3)
    // 函数库_技能_C.获取技能参数(self, 2, false, "", self, out CallFunc____________13, out CallFunc____________14, out CallFunc____________15, out CallFunc___________4)
    // CallFunc_EqualEqual_DoubleDouble_ReturnValue_1 = (CallFunc____________12 == 0.0)
    // CallFunc_FTrunc_ReturnValue_1 = KismetMathLibrary.FTrunc(CallFunc____________15)
    // 函数库_技能_C.获取技能参数(self, 3, false, "", self, out CallFunc____________22, out CallFunc____________23, out CallFunc____________24, out CallFunc___________7)
    // CallFunc_FTrunc_ReturnValue_3 = KismetMathLibrary.FTrunc(CallFunc____________24)
    // self.游戏模式.修炼系统.切换物品盒子(false, CallFunc_EqualEqual_DoubleDouble_ReturnValue_1, CallFunc_FTrunc_ReturnValue_3, CallFunc_FTrunc_ReturnValue_1, self)
    // L865:
    // CallFunc_Map_IsNotEmpty_ReturnValue = BlueprintMapLibrary.Map_IsNotEmpty(ref self.条件.解锁材料)
    // if (!(CallFunc_Map_IsNotEmpty_ReturnValue)) goto L1226
    // CallFunc_Map_Keys_Keys = []
    // BlueprintMapLibrary.Map_Keys(ref self.条件.解锁材料, out CallFunc_Map_Keys_Keys)
    // Temp_int_Loop_Counter_Variable_1 = 0
    // Temp_int_Array_Index_Variable = 0
    // L1055:
    // CallFunc_Array_Length_ReturnValue_1 = KismetArrayLibrary.Array_Length(ref CallFunc_Map_Keys_Keys)
    // CallFunc_Less_IntInt_ReturnValue_1 = (Temp_int_Loop_Counter_Variable_1 < CallFunc_Array_Length_ReturnValue_1)
    // if (!(CallFunc_Less_IntInt_ReturnValue_1)) goto L1226
    // Temp_int_Array_Index_Variable = Temp_int_Loop_Counter_Variable_1
    // push_flow L2778
    // Temp_int_Variable = 0
    // goto L217
    // L1226:
    // 函数库_技能_C.获取技能参数(self, 0, false, "", self, out CallFunc____________16, out CallFunc____________17, out CallFunc____________18, out CallFunc___________5)
    // CallFunc_FTrunc_ReturnValue_2 = KismetMathLibrary.FTrunc(CallFunc____________18)
    // 函数库_工具_C.递减强化属性(CallFunc_FTrunc_ReturnValue_2, 0.2, ref self.数量, self)
    // 函数库_技能_C.获取技能参数(self, 7, false, "", self, out CallFunc___________, out CallFunc____________1, out CallFunc____________2, out CallFunc__________)
    // CallFunc_EqualEqual_DoubleDouble_ReturnValue = (CallFunc____________2 == 0.0)
    // 函数库_技能_C.获取技能参数(self, 5, false, "", self, out CallFunc____________7, out CallFunc____________8, out CallFunc____________9, out CallFunc___________2)
    // CallFunc_FTrunc_ReturnValue = KismetMathLibrary.FTrunc(CallFunc____________9)
    // 函数库_技能_C.获取技能参数(self, 0, false, "", self, out CallFunc____________16, out CallFunc____________17, out CallFunc____________18, out CallFunc___________5)
    // 函数库_技能_C.获取技能参数(self, 1, false, "", self, out CallFunc____________19, out CallFunc____________20, out CallFunc____________21, out CallFunc___________6)
    // CallFunc_FTrunc_ReturnValue_2 = KismetMathLibrary.FTrunc(CallFunc____________18)
    // CallFunc_EqualEqual_DoubleDouble_ReturnValue_2 = (CallFunc____________21 == 0.0)
    // CallFunc_Clamp_ReturnValue = KismetMathLibrary.Clamp(self.生成品质, CallFunc_FTrunc_ReturnValue, self.单次级别上限)
    // self.游戏模式.修炼系统.刷新生成牌(false, CallFunc_EqualEqual_DoubleDouble_ReturnValue_2, CallFunc_EqualEqual_DoubleDouble_ReturnValue, CallFunc_Clamp_ReturnValue, CallFunc_FTrunc_ReturnValue_2, self.目标或/且, self.目标标签, self.排斥标签, true, false, ref self.指定名组, ref Temp_struct_Variable, self.词条修正)
    // Temp_int_Loop_Counter_Variable = 0
    // Temp_int_Array_Index_Variable_1 = 0
    // L2153:
    // CallFunc_Array_Length_ReturnValue = KismetArrayLibrary.Array_Length(ref self.游戏模式.修炼系统.未拾取牌)
    // CallFunc_Less_IntInt_ReturnValue = (Temp_int_Loop_Counter_Variable < CallFunc_Array_Length_ReturnValue)
    // if (!(CallFunc_Less_IntInt_ReturnValue)) pop_flow
    // Temp_int_Array_Index_Variable_1 = Temp_int_Loop_Counter_Variable
    // push_flow L2704
    // 函数库_技能_C.获取技能参数(self, 6, false, "", self, out CallFunc____________3, out CallFunc____________4, out CallFunc____________5, out CallFunc___________1)
    // 函数库_工具_C.传统概率判断(CallFunc____________5, self, out CallFunc____________6)
    // if (!(CallFunc____________6)) pop_flow
    // CallFunc_GetCustomSave_ReturnValue = EMSFunctionLibrary.GetCustomSave(self, BlueprintGeneratedClass'EMS_基础存档_C', "", "")
    // KismetArrayLibrary.Array_Get(ref self.游戏模式.修炼系统.未拾取牌, Temp_int_Array_Index_Variable_1, out CallFunc_Array_Get_Item_1)
    // CallFunc_Array_Get_Item_1.添加附魔(ref Temp_name_Variable, 0, true, false, CallFunc_GetCustomSave_ReturnValue.轮回次数)
    // pop_flow
    // L2704:
    // CallFunc_Add_IntInt_ReturnValue_2 = (Temp_int_Loop_Counter_Variable + 1)
    // Temp_int_Loop_Counter_Variable = CallFunc_Add_IntInt_ReturnValue_2
    // goto L2153
    // L2778:
    // CallFunc_Add_IntInt_ReturnValue_1 = (Temp_int_Loop_Counter_Variable_1 + 1)
    // Temp_int_Loop_Counter_Variable_1 = CallFunc_Add_IntInt_ReturnValue_1
    // goto L1055
    //
    super.执行技能(是读档);
  }

  override 被选中(): void {
    // L2852:
    // pop_flow
    //
    super.被选中();
  }

  override 检查子条件(): void {
    // L2853:
    // pop_flow
    //
    super.检查子条件();
  }

  盒子关闭后(): void {
    // L2854:
    // CallFunc_IsValid_ReturnValue = KismetSystemLibrary.IsValid(self.游戏模式.当前任务实例)
    // if (!(CallFunc_IsValid_ReturnValue)) pop_flow
    // CallFunc_EqualEqual_ByteByte_ReturnValue = (self.游戏模式.当前环节 == 9)
    // CallFunc_BooleanAND_ReturnValue = (self.游戏模式.当前任务实例.未完成？ && self.不结束层？)
    // CallFunc_BooleanOR_ReturnValue = (CallFunc_BooleanAND_ReturnValue || CallFunc_EqualEqual_ByteByte_ReturnValue)
    // if (!(CallFunc_BooleanOR_ReturnValue)) goto L3103
    // pop_flow
    // L3103:
    // self.游戏模式.结束当前层(true)
    // pop_flow
    //
    this.world.unported('蓝图_奖励_获取物品.盒子关闭后');
  }

  刷新盒子(): void {
    // L3141:
    // goto L865
    //
    this.world.unported('蓝图_奖励_获取物品.刷新盒子');
  }

  特殊处理(): void {
    // L3146:
    // self.不结束层？ = true
    // pop_flow
    // L3158:
    // return
    // end
    this.world.unported('蓝图_奖励_获取物品.特殊处理');
  }
}
