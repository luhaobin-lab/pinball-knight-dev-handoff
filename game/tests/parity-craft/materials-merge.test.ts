import { describe, expect, it } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { mergeResult, mergeCompatible } from '../../src/core/sys/craft/merge.ts';
import { craftSave, recipeRows, hasRecipe } from '../../src/core/sys/craft/recipes.ts';

describe('direct source materials, recipe learning and actual item merges',()=>{
 it('material changes walk existing destination keys, subtract scales without clamp; demand totals remain unscaled and nonpositive needs pass',()=>{
  const f=fixture(),bag=new Map([['灌草',3],['铁矿',1]]),change=new Map([['灌草',2],['岩菇',8]]);函数库_工具.修改材料数量(f.hero,bag,change,2,false);expect([...bag]).toEqual([['灌草',7],['铁矿',1]]);
  函数库_工具.修改材料数量(f.hero,bag,change,4,true);expect(bag.get('灌草')).toBe(-1);
  const before=f.w.digest(),rng=f.w.rng.save(),need=new Map([['灌草',2],['铁矿',1]]);expect(函数库_工具.材料需求判断(f.hero,need,new Map([['灌草',4],['铁矿',2]]),2,true)).toMatchObject({满足需求:true,需求材料总数:3});expect(函数库_工具.材料需求判断(f.hero,need,new Map(),0,false).满足需求).toBe(true);expect(f.w.digest()).toBe(before);expect(f.w.rng.save()).toEqual(rng);
 });
 it('catalog has161source recipes; actual first acquisition learns recipe once including need-no-unlock rows',()=>{
  const f=fixture();expect(Object.values(recipeRows).filter(hasRecipe)).toHaveLength(161);const initial=craftSave(f.w).已解锁配方.length;const card=f.item('晶核剑');expect(craftSave(f.w).已解锁配方).toContain('晶核剑');f.w.cult.解锁配方判断(card);expect(craftSave(f.w).已解锁配方.length).toBe(initial+1);expect(f.events('ui').filter(x=>x.widget==='UI_奖励提示'&&JSON.stringify(x).includes('习得配方'))).toHaveLength(1);
 });
 it.each([[1,1,2,0],[2,2,3,0],[3,3,4,0]])('actual sameitem qualities%s+%s merge to%s and create old-quality祝福之灵 once', (qa,qb,quality,remainder)=>{
  const f=fixture(),a=f.item('旧匕首',qa),b=f.item('旧匕首',qb);expect(mergeCompatible(a,b)).toBe(true);expect(mergeResult(a,b)).toMatchObject({quality,remainder,upgraded:true});
  a.被抓起(true);f.w.cult.合成牌(a,b,false);expect(a.valid).toBe(false);expect(b.品质).toBe(quality);expect(b.下一级计数).toBe(remainder);f.advance(.81);expect(b.被抓起_Q).toBe(false);expect(f.w.cult.已装备牌).toContain(b);
  const blessings=[...f.w.cult.已装备牌,...f.w.cult.背包里牌,...f.w.cult.未拾取牌].filter(x=>x?.名字==='祝福之灵');expect(blessings).toHaveLength(1);expect(blessings[0]!.品质).toBe(Math.max(qa,qb));
 });
 it('mixedquality merge preserves remainder and does not create blessing without an upgrade',()=>{
  const f=fixture(),a=f.item('旧匕首'),b=f.item('旧匕首',2);expect(mergeResult(a,b)).toMatchObject({quality:2,remainder:1,upgraded:false});a.被抓起(true);f.w.cult.合成牌(a,b,false);expect(b.下一级计数).toBe(1);expect([...f.w.cult.已装备牌,...f.w.cult.未拾取牌].some(x=>x?.名字==='祝福之灵')).toBe(false);
 });
 it('real drop onto same item takes source merge branch, preview does not consume item or RNG',()=>{
  const f=fixture(),a=f.item('旧匕首'),b=f.item('旧匕首'),before=f.w.rng.save();expect(a.可合成目标牌).toContain(b);f.w.cult.合成牌(a,b,true);expect(a.valid).toBe(true);expect(b.品质).toBe(1);expect(f.w.rng.save()).toEqual(before);
  a.被抓起(true);a.K2_SetActorLocation(b.K2_GetActorLocation());a.被放下(false);expect(a.valid).toBe(false);expect(b.品质).toBe(2);expect(stat(b,'基础伤害')).toBeGreaterThan(0);
 });
});
