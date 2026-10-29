/**
 * 蓝图_发射物_箭矢: TODO one-line summary of what the blueprint does.
 * Demo: CatapultHero/BP/Skill/发射物/蓝图_发射物_箭矢 (dump/blueprints-pseudo/CatapultHero/BP/Skill/发射物/蓝图_发射物_箭矢.txt)
 * Parent: 蓝图_发射物. CDO tags (manifest): none.
 * Rows: 数据表_技能_修炼物品:射出箭矢（充能）, 数据表_技能_修炼物品:射出箭矢（碰撞）, 数据表_技能_修炼物品:蝮蛇飞刀, 数据表_技能_修炼物品:炸弹飞刀, 数据表_技能_修炼物品:闪鸣飞刀, 数据表_技能_修炼物品:手动射击, 数据表_技能_默认:可控反蹬箭.
 * Batch: content-bpkit.
 */
import { 蓝图_发射物 } from '../../../../../src/core/ability/projectile.ts';
import type { AssetPath } from '../../../../../src/content/demo/types.ts';

export class 蓝图_发射物_箭矢 extends 蓝图_发射物 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/发射物/蓝图_发射物_箭矢';

  override 触发发射物敌方效果(): void {
    // L25035:
    // K2Node_SwitchEnum_CmpSuccess_1 = (self.伤害类型 != 0)
    // if (!(K2Node_SwitchEnum_CmpSuccess_1)) goto L26903
    // K2Node_SwitchEnum_CmpSuccess_1 = (self.伤害类型 != 1)
    // if (!(K2Node_SwitchEnum_CmpSuccess_1)) goto L26181
    // K2Node_SwitchEnum_CmpSuccess_1 = (self.伤害类型 != 2)
    // if (!(K2Node_SwitchEnum_CmpSuccess_1)) goto L25640
    // K2Node_SwitchEnum_CmpSuccess_1 = (self.伤害类型 != 4)
    // if (!(K2Node_SwitchEnum_CmpSuccess_1)) goto L25640
    // K2Node_SwitchEnum_CmpSuccess_1 = (self.伤害类型 != 6)
    // if (!(K2Node_SwitchEnum_CmpSuccess_1)) goto L25261
    // pop_flow
    // L25261:
    // K2Node_MakeStruct_______2.效果类 = BlueprintGeneratedClass'蓝图_效果_闪电链_C'
    // K2Node_MakeStruct_______2.持续时间 = 1.0
    // K2Node_MakeStruct_______2.触发间隔 = 1.0
    // K2Node_MakeStruct_______2.持续回合 = -1
    // K2Node_MakeStruct_______2.叠加层数 = 1
    // K2Node_MakeStruct_______2.唯一？ = false
    // K2Node_MakeStruct_______2.检查效果名？ = false
    // K2Node_MakeStruct_______2.叠加上限 = 99
    // 函数库_技能_C.获取效果名(self.来自技能, K2Node_MakeStruct_______2.效果类, self, out CallFunc____________1)
    // CallFunc_IsValid_ReturnValue_3 = KismetSystemLibrary.IsValid(self.来自技能.拥有者)
    // if (!(CallFunc_IsValid_ReturnValue_3)) goto L20580
    // goto L20516
    // L25640:
    // K2Node_MakeStruct_______6.伤害来源 = 5
    // K2Node_MakeStruct_______6.伤害类型 = self.伤害类型
    // K2Node_MakeStruct_______6.不变速？ = false
    // K2Node_MakeStruct_______6.是暴击？ = false
    // K2Node_MakeStruct_______6.是弱点？ = false
    // K2Node_MakeStruct_______6.伤害数值 = self.伤害数值
    // K2Node_MakeStruct_______6.所需回合 = 3
    // K2Node_MakeStruct_______6.触发次数 = self.触发次数
    // K2Node_MakeStruct_______6.击中点位置 = Vector(0.0, 0.0, 0.0)
    // K2Node_MakeStruct_______6.击中点法线 = Vector(0.0, 0.0, 0.0)
    // K2Node_MakeStruct_______6.断开骨骼名 = 'None'
    // K2Node_MakeStruct_______6.来自技能 = self.来自技能
    // K2Node_MakeStruct_______6.来自角色 = self.来自技能.拥有者
    // K2Node_MakeStruct_______6.来自发射物 = self
    // K2Node_MakeStruct_______6.目标角色 = None
    // K2Node_MakeStruct_______6.来自角色.更新运动数据()
    // goto L19996
    // L26181:
    // GameplayStatics.BreakHitResult(ref self.Sweep Result, out CallFunc_BreakHitResult_bBlockingHit, out CallFunc_BreakHitResult_bInitialOverlap, out CallFunc_BreakHitResult_Time, out CallFunc_BreakHitResult_Distance, out CallFunc_BreakHitResult_Location, out CallFunc_BreakHitResult_ImpactPoint, out CallFunc_BreakHitResult_Normal, out CallFunc_BreakHitResult_ImpactNormal, out CallFunc_BreakHitResult_PhysMat, out CallFunc_BreakHitResult_HitActor, out CallFunc_BreakHitResult_HitComponent, out CallFunc_BreakHitResult_HitBoneName, out CallFunc_BreakHitResult_BoneName, out CallFunc_BreakHitResult_HitItem, out CallFunc_BreakHitResult_ElementIndex, out CallFunc_BreakHitResult_FaceIndex, out CallFunc_BreakHitResult_TraceStart, out CallFunc_BreakHitResult_TraceEnd)
    // K2Node_MakeStruct_______5.伤害来源 = 5
    // K2Node_MakeStruct_______5.伤害类型 = self.伤害类型
    // K2Node_MakeStruct_______5.不变速？ = true
    // K2Node_MakeStruct_______5.是暴击？ = false
    // K2Node_MakeStruct_______5.是弱点？ = false
    // K2Node_MakeStruct_______5.伤害数值 = self.伤害数值
    // K2Node_MakeStruct_______5.所需回合 = 3
    // K2Node_MakeStruct_______5.触发次数 = self.触发次数
    // K2Node_MakeStruct_______5.击中点位置 = CallFunc_BreakHitResult_Location
    // K2Node_MakeStruct_______5.击中点法线 = CallFunc_BreakHitResult_Normal
    // K2Node_MakeStruct_______5.断开骨骼名 = 'None'
    // K2Node_MakeStruct_______5.来自技能 = self.来自技能
    // K2Node_MakeStruct_______5.来自角色 = self.来自技能.拥有者
    // K2Node_MakeStruct_______5.来自发射物 = self
    // K2Node_MakeStruct_______5.目标角色 = self.当前命中角色
    // self.来自技能.拥有者.造成持续伤害(K2Node_MakeStruct_______5, false, false)
    // goto L1556
    // L26903:
    // GameplayStatics.BreakHitResult(ref self.Sweep Result, out CallFunc_BreakHitResult_bBlockingHit, out CallFunc_BreakHitResult_bInitialOverlap, out CallFunc_BreakHitResult_Time, out CallFunc_BreakHitResult_Distance, out CallFunc_BreakHitResult_Location, out CallFunc_BreakHitResult_ImpactPoint, out CallFunc_BreakHitResult_Normal, out CallFunc_BreakHitResult_ImpactNormal, out CallFunc_BreakHitResult_PhysMat, out CallFunc_BreakHitResult_HitActor, out CallFunc_BreakHitResult_HitComponent, out CallFunc_BreakHitResult_HitBoneName, out CallFunc_BreakHitResult_BoneName, out CallFunc_BreakHitResult_HitItem, out CallFunc_BreakHitResult_ElementIndex, out CallFunc_BreakHitResult_FaceIndex, out CallFunc_BreakHitResult_TraceStart, out CallFunc_BreakHitResult_TraceEnd)
    // K2Node_MakeStruct_______4.伤害来源 = 5
    // K2Node_MakeStruct_______4.伤害类型 = self.伤害类型
    // K2Node_MakeStruct_______4.不变速？ = true
    // K2Node_MakeStruct_______4.是暴击？ = false
    // K2Node_MakeStruct_______4.是弱点？ = false
    // K2Node_MakeStruct_______4.伤害数值 = self.伤害数值
    // K2Node_MakeStruct_______4.所需回合 = 3
    // K2Node_MakeStruct_______4.触发次数 = self.触发次数
    // K2Node_MakeStruct_______4.击中点位置 = CallFunc_BreakHitResult_Location
    // K2Node_MakeStruct_______4.击中点法线 = CallFunc_BreakHitResult_Normal
    // K2Node_MakeStruct_______4.断开骨骼名 = 'None'
    // K2Node_MakeStruct_______4.来自技能 = self.来自技能
    // K2Node_MakeStruct_______4.来自角色 = self.来自技能.拥有者
    // K2Node_MakeStruct_______4.来自发射物 = self
    // K2Node_MakeStruct_______4.目标角色 = self.当前命中角色
    // self.来自技能.拥有者.造成即时伤害(K2Node_MakeStruct_______4, false, false)
    // goto L1556
    // L27625:
    // self.范围检查？ = false
    // goto L24851
    //
    super.触发发射物敌方效果();
  }

  override 激活前触发(): void {
    // L27641:
    // CallFunc_EqualEqual_ObjectObject_ReturnValue = (self.来自技能.拥有者 == self.游戏模式.玩家角色)
    // if (!(CallFunc_EqualEqual_ObjectObject_ReturnValue)) goto L27625
    // self.最大穿透次数 = self.游戏模式.玩家角色.投射穿透
    // goto L27625
    // L27813:
    // return
    // end
    super.激活前触发();
  }
}
