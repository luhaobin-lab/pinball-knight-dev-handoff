import {describe,it,expect}from'vitest';
import{combatFixture}from'../fixtures/index.ts';
import{函数库_工具}from'../../src/core/bp/index.ts';
import{nativeRollPRDBatch}from'../../src/core/math/prd-native.ts';
import{makeRand15}from'../../src/core/rng/ue.ts';
import{添加科学映射值}from'../../src/core/math/stats.ts';
import{sci}from'../../src/core/math/sci.ts';
describe('production source PRD integration',()=>{
 it('actual critical-hit facade updates count and consumes exactly native combat raw state, leaving meta untouched',()=>{
  const{world:w,hero}=combatFixture({seed:516});w.mode.当前环节='进行战斗';添加科学映射值(hero.词条,'暴击率%','native test',sci(.3),false);hero.暴击保护计数=2;
  const ref=makeRand15(w.rng.combat.state),meta=w.rng.meta.state,expected=nativeRollPRDBatch(.3,2,41,ref);
  expect(hero.会心判断(41)).toEqual({触发:expected.Triggered,会心次数:expected.SuccessCount});expect(hero.暴击保护计数).toBe(expected.NextTriggerCount);
  expect(w.rng.combat.state).toBe(ref.state);expect(w.rng.meta.state).toBe(meta);
 });
 it('the same production kernel dispatch routes map-phase PRD to its existing meta domain without touching combat',()=>{
  const{world:w,hero}=combatFixture({seed:3});w.mode.当前环节='选择地图';const ref=makeRand15(w.rng.meta.state),combat=w.rng.combat.state;
  const expected=nativeRollPRDBatch(.05,7,9,ref),actual=函数库_工具.PRD概率判断_批量(hero,.05,7,9);
  expect(actual).toEqual({触发:expected.Triggered,成功次数:expected.SuccessCount,更新触发计数:expected.NextTriggerCount});
  expect(w.rng.meta.state).toBe(ref.state);expect(w.rng.combat.state).toBe(combat);
 });
});
