import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { 蓝图_能力_锻造锤_品质 } from '../../src/content/bp/Skill/Ability/道具/蓝图_能力_锻造锤_品质.ts';
import { 蓝图_能力_锻造锤_标签 } from '../../src/content/bp/Skill/Ability/道具/蓝图_能力_锻造锤_标签.ts';
import { 蓝图_能力_兑换物品 } from '../../src/content/bp/Skill/Ability/奖励/蓝图_能力_兑换物品.ts';

describe('source forge and voucher ability boundaries',()=>{
 it('bronze hammer source check chooses highest actual matchingquality equipment and upgrades only it through original delay',()=>{
  const f=fixture(),top=f.item('旧剑'),silver=f.item('旧盾',2),last=f.item('旧匕首');const a=f.w.spawn(蓝图_能力_锻造锤_品质,x=>{x.拥有者=f.hero;x.能力名='锻造锤_品质青铜';x.技能配置=合成数据表_技能.rows['锻造锤_品质青铜'];x.等级=1;});a.初始化();a.子初始化();a.检查子条件();expect(a.子条件通过).toBe(true);expect(a.最上方).toBe(top);const done=vi.spyOn(a,'释放结束');a.执行技能(false);expect(top.品质).toBe(2);expect(silver.品质).toBe(2);expect(last.品质).toBe(1);expect(done).toHaveBeenCalledWith(false);f.advance(.81);expect(top.释放技能中).toBe(false);
 });
 it('tag hammer uses permanent source mapping on real top card and original native tag prevents duplicate',()=>{
  const f=fixture(),top=f.item('旧盾');const a=f.w.spawn(蓝图_能力_锻造锤_标签,x=>{x.拥有者=f.hero;x.能力名='锻造锤_武器';x.技能配置=合成数据表_技能.rows['锻造锤_武器'];x.等级=1;});a.初始化();a.检查子条件();expect(a.最上方).toBe(top);a.执行技能(false);expect(top.OwnedGameplayTags.has('可交互.修炼牌.武器')).toBe(true);expect(top.额外标签_存档.size).toBeGreaterThan(0);const size=top.额外标签_存档.size;a.执行技能(false);expect(top.额外标签_存档.size).toBe(size);
 });
 it('voucher consumes actual top item then offers at most3 same-size source choices with inheritedquality and closes floor',()=>{
  const f=fixture(),top=f.item('旧剑',2);f.w.mode.当前总层数=99;const a=f.w.spawn(蓝图_能力_兑换物品,x=>{x.拥有者=f.hero;x.能力名='兑换卷_武器';x.技能配置=合成数据表_技能.rows['兑换卷_武器'];x.等级=1;});a.初始化();a.检查子条件();expect(a.子条件通过).toBe(true);const base=stat(top,'基础伤害'),finish=vi.spyOn(f.w.mode,'结束当前层');a.执行技能(false);expect(top.valid).toBe(false);expect(a.指定名组.length).toBeLessThanOrEqual(3);expect(f.w.modal.current?.kind).toBe('loot');expect(f.w.cult.未拾取牌.every(c=>c?.品质===2&&c.尺寸===top.尺寸)).toBe(true);expect(a.词条修正.size).toBeGreaterThan(0);expect(base).toBeGreaterThan(0);f.w.cult.切换物品盒子(true,false,-1,1,null);expect(finish).toHaveBeenCalledWith(true);
 });
});
