import { describe, expect, it } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';
import { 蓝图_效果_电击球 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_电击球.ts';
import { 蓝图_效果_秘银鳞片 as 旧秘银鳞片 } from '../../src/content/bp/Skill/效果/过期/蓝图_效果_秘银鳞片.ts';
import { 蓝图_效果_闪电链 } from '../../src/content/bp/Skill/效果/蓝图_效果_闪电链.ts';
import { 蓝图_效果_免疫状态 } from '../../src/content/bp/Skill/效果/蓝图_效果_免疫状态.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci } from '../../src/core/math/sci.ts';

describe('item4 explicit dependency boundaries',()=>{
  it('电击球 source boundary preserves spawn/idle delays, actual lightning origin/caster and teardown with its root sphere integration',()=>{
    const f=fixture(),item=f.item('雷云精灵');f.enter();const skill=f.ability(item,'雷云精灵A');f.enemies[0].当前生命=sci(10000);
    // bp-items6 producer is still pending. This is its source child boundary, not an obtainable playable ball claim.
    const ball=f.w.spawn(蓝图_效果_电击球,x=>{x.拥有者=f.hero;x.释放者=f.hero;x.来自技能=skill;x.持续时长=-1;x.持续回合=3;},{x:100,y:0,z:0});skill.创建的效果.push(ball);f.hero.拥有的效果.push(ball);ball.激活效果('');
    f.advance(.39);expect(ball.ug_物理模拟请求).toBe(false);f.advance(.02);expect(ball.ug_物理模拟请求).toBe(false);f.advance(.4);expect(ball.ug_物理模拟请求).toBe(true);
    expect(f.w.coverage.counts.has('电击球.Sphere.SetSimulatePhysics')).toBe(false);
    const hp=f.hpOf(f.enemies[0]);ball.持续中触发('效果.时机.主动激活');const chain=f.w.objects().find(x=>x instanceof 蓝图_效果_闪电链) as 蓝图_效果_闪电链;
    expect(chain.非角色释放者).toBe(ball);expect(chain.释放者).toBe(f.hero);expect(chain.伤害数据.来自角色).toBe(item);f.advance(.11);expect(f.hpOf(f.enemies[0])).toBeLessThan(hp);
    ball.持续中触发('效果.时机.结束层时');expect(skill.创建的效果).not.toContain(ball);f.advance(.41);expect(ball.valid).toBe(true);f.advance(1.6);expect(ball.valid).toBe(false);
  });

  it('deprecated同名秘银 helper has independent path and full-life one-stack rescue, then destroys itself on next death check',()=>{
    const f=fixture(),item=f.item('秘银鳞片');f.enter();const skill=f.ability(item,'秘银鳞片A');
    // Deprecated 道具 ability producer is outside current card. Verify its registered exact-class boundary independently.
    const e=f.w.spawn(旧秘银鳞片,x=>{x.拥有者=f.hero;x.来自技能=skill;x.叠加层数=1;});f.hero.拥有的效果.push(e);
    const hit=()=>f.hero.受到即时伤害(make伤害({伤害数值:sci(20),来自角色:f.enemies[0],目标角色:f.hero}),true,false);
    for(let i=0;i<10&&e.触发次数_0===0;i++){hit();f.advance(.3);}
    expect(e.触发次数_0).toBe(1);expect(f.hpOf(f.hero)).toBeGreaterThan(100);expect(f.hero.死掉了).toBe(false);
    const immunity=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_免疫状态)!;immunity.销毁效果();f.advance(.6);
    for(let i=0;i<15&&!f.hero.死掉了;i++){hit();f.advance(.3);}
    expect(e.valid).toBe(false);expect(f.hero.死掉了).toBe(true);
  });
});
