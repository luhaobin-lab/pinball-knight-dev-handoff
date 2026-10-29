import { describe, expect, it, vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import { 蓝图_能力_守门人_熔岩道 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_守门人_熔岩道.ts';
import { 蓝图_能力_守门人_连环重锤 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_守门人_连环重锤.ts';
import { 蓝图_能力_守门人_目视 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_守门人_目视.ts';
import { 蓝图_能力_守门人_撕咬搜寻 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_守门人_撕咬搜寻.ts';
import { 蓝图_效果_飞跃重击 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_飞跃重击.ts';
import { 蓝图_效果_连环重锤 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_连环重锤.ts';
import { 蓝图_效果_地形管理组 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { tickCopy } from '../../src/core/ability/dispatch.ts';

function setup<T extends 蓝图_能力>(row: string) {
  const f = combatFixture({ enemies: ['守门人'], seed: 4 });
  const w = f.world, boss = f.enemies[0]!;
  for (const e of [...f.hero.拥有的效果]) if (e) w.destroy(e);
  f.hero.拥有的效果.length = 0;
  w.mode.当前层配置 = layerOf('第一层', 0)!;
  const room = w.spawn(蓝图_房间); w.mode.当前房间实例 = room; room.激活房间(5,7);
  // combatFixture uses the full source row; do not duplicate its seven fixed skills.
  const skill = f.ability(boss, row) as T;
  boss.当前能力 = skill;
  boss.K2_SetActorLocation({ x: 180, y: 0, z: 117 }); boss.更新运动数据();
  f.hero.K2_SetActorLocation({ x: -180, y: 0, z: 56 }); f.hero.更新运动数据();
  return { ...f, w, boss, room, skill };
}

describe('remaining Gatekeeper source skills (real composed boundary fixtures)', () => {
  it('source fixed-skill pool changes across phases and respects the actual one/two-turn cooldown effects',()=>{
    const f=setup('首领_守门人_重锤');
    const evaluate=()=>{f.boss.可释放能力.length=0;for(const s of f.boss.拥有的主动能力){s?.检查子条件();s?.检查条件();}};
    const task=f.w.spawn(BP_Mission);task.未完成=true;f.w.mode.当前任务实例=task;
    evaluate();
    expect(f.boss.可释放能力.map(x=>x?.能力名)).toEqual(['肉弹战车','首领_守门人_重锤','首领_守门人_连环重锤','首领_守门人_熔岩道']);
    f.boss.OwnedGameplayTags.add('状态.二阶段');evaluate();
    expect(f.boss.可释放能力.map(x=>x?.能力名)).toEqual(['肉弹战车','首领_守门人_熔岩道','首领_守门人二阶_撕咬搜寻','首领_守门人二阶_目视']);
    for(const name of ['首领_守门人_熔岩道','首领_守门人二阶_撕咬搜寻']){
      const skill=f.ability(f.boss,name);skill.创建冷却效果(skill.冷却秒,skill.冷却回合);
      expect(skill.冷却效果?.剩余回合).toBe(skill.冷却回合+1);
    }
    evaluate();expect(f.boss.可释放能力.map(x=>x?.能力名)).toEqual(['肉弹战车','首领_守门人二阶_目视']);
    tickCopy(f.boss.拥有的效果,'效果.时机.新一天时');函数库_工具.清理已销毁效果(f.boss,f.boss.拥有的效果);
    evaluate();expect(f.boss.可释放能力.map(x=>x?.能力名)).toEqual(['肉弹战车','首领_守门人二阶_目视']);
    tickCopy(f.boss.拥有的效果,'效果.时机.新一天时');函数库_工具.清理已销毁效果(f.boss,f.boss.拥有的效果);
    evaluate();expect(f.boss.可释放能力.map(x=>x?.能力名)).toContain('首领_守门人_熔岩道');
    expect(f.boss.可释放能力.map(x=>x?.能力名)).not.toContain('首领_守门人二阶_撕咬搜寻');
    tickCopy(f.boss.拥有的效果,'效果.时机.新一天时');函数库_工具.清理已销毁效果(f.boss,f.boss.拥有的效果);
    evaluate();expect(f.boss.可释放能力.map(x=>x?.能力名)).toContain('首领_守门人二阶_撕咬搜寻');
  });
  it.each([false,true])('lava lane phase2=%s uses .8/.3 intent and 3/5-wide source rectangles with two-turn life', phase2 => {
    const f = setup<蓝图_能力_守门人_熔岩道>('首领_守门人_熔岩道');
    if (phase2) f.boss.OwnedGameplayTags.add('状态.二阶段');
    f.skill.被选中(); f.advance((phase2 ? .3 : .8) - .01);
    expect(f.skill.地形管理组).toBeNull();
    f.advance(.02);
    const group = f.skill.地形管理组 as 蓝图_效果_地形管理组;
    expect(group).toBeInstanceOf(蓝图_效果_地形管理组);
    expect(group.地形选取.起始范围).toBe(phase2 ? 2 : 1);
    expect(group.地形选取.结束范围).toBe(phase2 ? 2 : 1);
    const points = f.skill.地形选取.起点;
    const p = f.boss.K2_GetActorLocation(), h = f.hero.K2_GetActorLocation();
    const d = Math.hypot(h.x-(p.x-64),h.y-(p.y-28),h.z-p.z);
    expect(points).toHaveLength(Math.trunc(d/192)+2);
    expect(Math.hypot(points[1]!.X-points[0]!.X,points[1]!.Y-points[0]!.Y)).toBeCloseTo(192);
    expect(group.拥有的地形.length).toBeGreaterThan(0);
    expect(group.拥有的地形.every(e => e!.剩余回合 === 2)).toBe(true);
    const hp=f.hpOf(f.hero); f.skill.执行技能(false); expect(f.hpOf(f.hero)).toBe(hp);
    expect(group.销毁结束技能释放).toBe(true);
  });

  it('barrage performs three actual 2000-speed, zero-height moves and creates three independent delayed groups', () => {
    const f = setup<蓝图_能力_守门人_连环重锤>('首领_守门人_连环重锤');
    const moves=vi.spyOn(f.boss,'移到目标地点');
    f.skill.被选中(); const target={...f.boss.目标位置};
    f.skill.本技能激活中=true; f.boss.释放技能中=true; f.skill.执行技能(false);
    expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    expect(f.skill.效果实例?.def.path).toBe('CatapultHero/BP/Skill/效果/敌人/蓝图_效果_碰撞伤害');
    expect(f.skill.效果实例?.剩余回合).toBe(1); // duration2 must NOT start a timer when turns0
    f.advance(.1); expect(f.boss.K2_GetActorLocation().x).not.toBe(180);
    f.advance(3);
    expect(moves.mock.calls).toEqual(Array.from({length:3},()=>['可控反弹曲线','卡牌高度位移曲线',2000,0]));
    const groups=f.w.objects().filter(o=>o instanceof 蓝图_效果_地形管理组 && o.来自技能===f.skill) as 蓝图_效果_地形管理组[];
    expect(groups).toHaveLength(3);
    expect(groups.every(g=>g.地形选取.起始范围===0 && g.地形选取.结束范围>=3 && g.地形选取.结束范围<=5 && !g.销毁结束技能释放)).toBe(true);
    expect(groups[0]!.地形选取.起点[0]!.X).toBeCloseTo(target.x);
    expect(f.skill.地形管理组).toBe(groups[2]);
    expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(false);
    expect(f.boss.释放技能中).toBe(false);
    expect(f.w.objects().some(o=>o instanceof 蓝图_效果_连环重锤)).toBe(false); // row's legacy effect is not executed
    f.boss.OwnedGameplayTags.add('状态.二阶段'); f.skill.检查子条件(); expect(f.skill.子条件通过).toBe(false);
  });

  it('gaze conditions use five unsnapped rotated midpoints and intent summons ready-to-act eyes only when conditions hold', () => {
    const f=setup<蓝图_能力_守门人_目视>('首领_守门人二阶_目视');
    const task=f.w.spawn(BP_Mission); task.未完成=true; f.w.mode.当前任务实例=task;
    f.skill.检查子条件(); expect(f.skill.子条件通过).toBe(false);
    f.boss.OwnedGameplayTags.add('状态.二阶段'); f.skill.检查子条件();
    expect(f.skill.查找位置.length).toBeGreaterThanOrEqual(3); expect(f.skill.子条件通过).toBe(true);
    const points=f.skill.查找位置.map(p=>({...p}));
    expect(points.some(p=>p.x%64!==32)).toBe(true);
    f.skill.被选中();
    expect(f.skill.召唤出来的).toHaveLength(points.length);
    for(const eye of f.skill.召唤出来的){
      expect(eye?.名字).toBe('眼球');expect(f.w.mode.可行动角色).toContain(eye);
      expect(eye!.当前能力?.无吟唱).toBe(true);expect(eye!.目标位置.x).toBe(-180);
    }
    f.skill.检查子条件(); expect(f.skill.子条件通过).toBe(false); // source raw enemy array now >2
    task.未完成=false; f.skill.检查子条件(); expect(f.skill.子条件通过).toBe(false);
    f.skill.本技能激活中=true; f.boss.释放技能中=true; f.skill.执行技能(false);
    const length=f.w.data.anims[f.skill.技能动画[0]!]!.length;
    f.advance(length-.01); expect(f.boss.释放技能中).toBe(true);
    f.advance(.02); expect(f.boss.释放技能中).toBe(false);
  });

  it('leap uses actual curve mover and source radius/P0 damage on landing, closes immunity and releases the action', () => {
    const f=setup<蓝图_能力_守门人_撕咬搜寻>('首领_守门人二阶_撕咬搜寻');
    f.skill.检查子条件();expect(f.skill.子条件通过).toBe(false);
    f.boss.OwnedGameplayTags.add('状态.二阶段');f.skill.检查子条件();expect(f.skill.子条件通过).toBe(true);
    f.hero.当前生命=sci(1000);f.hero.当前最大生命=sci(1000);
    f.skill.被选中();expect(f.boss.目标位置.x).toBe(-180);
    f.skill.本技能激活中=true;f.boss.释放技能中=true; f.skill.执行技能(false);
    const e=f.boss.拥有的效果.find(o=>o instanceof 蓝图_效果_飞跃重击) as 蓝图_效果_飞跃重击;
    const land=e.结束跳跃.bind(e), landing: { x:number; target:number; hp:number }[]=[];
    vi.spyOn(e,'结束跳跃').mockImplementation(()=>{landing.push({x:f.boss.K2_GetActorLocation().x,target:f.boss.目标位置.x,hp:f.hpOf(f.hero)});land();});
    expect([e.高度,e.移动速度,e.高度曲线,e.球体半径]).toEqual([300,1500,'飞跃重击',Math.fround(117*1.4)]);
    expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    f.advance(.1);expect(f.hpOf(f.hero)).toBe(1000);
    f.advance(.3);
    expect(landing).toHaveLength(1); expect(landing[0]!.x).toBeCloseTo(landing[0]!.target);
    expect(f.hpOf(f.hero)).toBeCloseTo(1000-2*科学数变普通(获取科学映射词条(f.boss.词条,'基础伤害').输出值));
    expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(false);expect(f.boss.释放技能中).toBe(false);
    f.advance(1.1);expect(e.valid).toBe(false);
  });

  it('barrage and leap retain full digest equality for frame, uneven and event-jump advancement',()=>{
    for(const row of ['首领_守门人_连环重锤','首领_守门人二阶_撕咬搜寻']){
      const a=setup(row),b=setup(row),c=setup(row);
      for(const f of[a,b,c]){f.boss.OwnedGameplayTags.add('状态.二阶段');f.skill.被选中();f.skill.本技能激活中=true;f.boss.释放技能中=true;f.skill.执行技能(false);}
      for(let i=0;i<240;i++)a.w.clock.advance(1/60);
      for(const t of[.03,.17,.8,1,2])b.w.clock.advance(t);
      c.w.clock.advance(4);
      expect(a.w.digest(),row).toBe(b.w.digest());expect(a.w.digest(),row).toBe(c.w.digest());
    }
  });

  it('destroying the ability cancels its latent slam callbacks; a dead owner cannot spawn a new leap effect',()=>{
    const f=setup<蓝图_能力_守门人_连环重锤>('首领_守门人_连环重锤');
    f.skill.被选中();f.skill.执行技能(false);f.w.destroy(f.skill);f.advance(3);
    expect(f.w.objects().filter(o=>o instanceof 蓝图_效果_地形管理组 && o.来自技能===f.skill)).toHaveLength(0);
    const leap=setup<蓝图_能力_守门人_撕咬搜寻>('首领_守门人二阶_撕咬搜寻');
    leap.boss.死掉了=true;leap.skill.执行技能(false);
    expect(leap.boss.拥有的效果.some(e=>e instanceof 蓝图_效果_飞跃重击)).toBe(false);
  });
});
