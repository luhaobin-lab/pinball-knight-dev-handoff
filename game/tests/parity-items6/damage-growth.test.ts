import{describe,expect,it,vi}from'vitest';import{fixture,stat}from'../parity-items/fixture.ts';import{spawnActor}from'../fixtures/combat.ts';
import{BP_Actor_Other}from'../../src/core/sim/other.ts';import{sci,科学数变普通}from'../../src/core/math/sci.ts';import{make伤害}from'../../src/core/bp/structs.ts';
import{数据表_技能_附魔,数据表_技能_默认}from'../../src/content/demo/tables.ts';import{蓝图_效果_高温眼珠}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_高温眼珠.ts';
import{蓝图_效果_黑洞法杖B加成}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_黑洞法杖B加成.ts';import{蓝图_效果_魂珠A}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_魂珠A.ts';import{蓝图_效果_魂珠_炼尸}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_魂珠_炼尸.ts';import{蓝图_能力_魂珠}from'../../src/content/bp/Skill/Ability/道具/蓝图_能力_魂珠.ts';import{蓝图_效果_精神状态_光阴}from'../../src/content/bp/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_光阴.ts';import{蓝图_效果_闪电链}from'../../src/content/bp/Skill/效果/蓝图_效果_闪电链.ts';

describe('item6 source appended packets and persistent state',()=>{
 it('灼热眼珠 source enchant marks fire and appends one burn via victim outgoing function, excluding same skill/DoT recursion',()=>{
  const f=fixture(),sword=f.item('旧剑');sword.添加技能({DataTable:数据表_技能_附魔.asset,RowName:'灼热眼珠'},1,0);f.enter();const e=sword.拥有的效果.find(x=>x instanceof 蓝图_效果_高温眼珠)!;expect(sword.HasMatchingGameplayTag('可交互.修炼牌.火系')).toBe(true);const target=f.enemies[0];target.当前生命=sci(10000);const append=vi.spyOn(target,'造成持续伤害');
  sword.造成即时伤害(make伤害({伤害来源:'装备',伤害类型:'物理',伤害数值:sci(10),来自角色:sword,来自技能:sword.拥有的被动能力.find(a=>a?.能力名==='旧剑')!,目标角色:target}),true,true);expect(append).toHaveBeenCalledOnce();expect(append.mock.calls[0][0].来自角色).toBe(sword);expect(append.mock.calls[0][0].伤害类型).toBe('燃烧');expect(科学数变普通(append.mock.calls[0][0].伤害数值)).toBe(5);e.销毁效果();expect(sword.HasMatchingGameplayTag('可交互.修炼牌.火系')).toBe(false);
 });
 it('黑洞法杖 actual attached child raises staff by base*(1+.02count) for matching damage and removes its source on floor cleanup',()=>{
  const f=fixture(),staff=f.item('黑洞法杖'),knife=f.item('旧匕首');f.enter();const child=knife.拥有的效果.find(x=>x instanceof 蓝图_效果_黑洞法杖B加成)!;expect(child).toBeDefined();const b=stat(staff,'基础伤害');f.enemies[0].当前生命=sci(10000);
  knife.造成持续伤害(make伤害({伤害类型:'流血',伤害数值:sci(4),触发次数:2,来自角色:knife,目标角色:f.enemies[0]}),true,true);expect(stat(staff,'基础伤害')).toBeCloseTo(b+b*1.04);f.w.mode.结束层时机();expect(child.valid).toBe(false);expect(stat(staff,'基础伤害')).toBe(b);
 });
 it('魂珠 enchant counts all enemy deaths but rewards only its own kill after threshold, preserves counter after others kill',()=>{
  const f=fixture(),knife=f.item('旧匕首');knife.添加技能({DataTable:数据表_技能_附魔.asset,RowName:'魂珠'},1,0);f.enter();const e=knife.拥有的效果.find(x=>x instanceof 蓝图_效果_魂珠A)as 蓝图_效果_魂珠A,b=stat(knife,'基础伤害');
  const kill=(from:typeof f.hero|typeof knife)=>{const enemy=spawnActor(f.w,BP_Actor_Other,'CatapultHero/数据表/角色/数据表_敌人_普通','眼球');f.w.mode.添加到战场(enemy);enemy.受到即时伤害(make伤害({伤害数值:sci(10000),来自角色:from,目标角色:enemy}),true,false);};kill(f.hero);expect(e.充能计数).toBe(1);expect(stat(knife,'基础伤害')).toBe(b);kill(knife);expect(e.充能计数).toBe(0);expect(stat(knife,'基础伤害')).toBe(b+10);
 });
 it('魂珠 actual deaths store cappedEXP then actual itemuse creates that many free junk offers; source release override remains empty',()=>{
  const f=fixture(),pearl=f.item('魂珠');f.enter();const e=pearl.拥有的效果.find(x=>x instanceof 蓝图_效果_魂珠_炼尸)as 蓝图_效果_魂珠_炼尸;
  for(let i=0;i<8;i++){const enemy=spawnActor(f.w,BP_Actor_Other,'CatapultHero/数据表/角色/数据表_敌人_普通','眼球');f.w.mode.添加到战场(enemy);enemy.受到即时伤害(make伤害({伤害数值:sci(10000),来自角色:f.hero,目标角色:enemy}),true,false);}
  expect(e.获得数).toBe(4);expect(stat(pearl,'经验')).toBe(3);const ability=pearl.拥有的主动能力.find(x=>x instanceof 蓝图_能力_魂珠)as 蓝图_能力_魂珠;
  ability.检查子条件();expect(ability.子条件通过).toBe(false);f.w.mode.场上有敌人=false;f.w.mode.当前环节='交互场牌';f.w.cult.使用牌(pearl);expect(f.w.cult.未拾取牌).toHaveLength(3);expect(f.w.cult.未拾取牌.every(c=>c?.当前价格===0&&c.HasMatchingGameplayTag('可交互.修炼牌.废品'))).toBe(true);expect(f.w.modal.current?.kind).toBe('loot');
 });
 it('雷云精灵 item-type counter counts duplicate air items, excludes itself and updates on actual removal',()=>{
  const f=fixture(),cloud=f.item('雷云精灵');expect(stat(cloud,'加速冷却%')).toBe(0);const a=f.item('追风短剑');f.item('追风短剑');expect(stat(cloud,'加速冷却%')).toBe(1);a.被抓起(true);expect(stat(cloud,'加速冷却%')).toBe(.5);
 });
 it('黄金头盔 nextday grants original bounded光阴 stacks and respects named mission gate',()=>{
  const f=fixture();f.item('黄金头盔');f.enter();f.w.mode.回合开始触发数=2;f.w.mode.新回合触发时机();const effect=f.hero.拥有的效果.find(e=>e instanceof 蓝图_效果_精神状态_光阴)!;expect(effect).toBeDefined();expect(effect.叠加层数).toBe(2);f.w.mode.新回合触发时机();expect(effect.叠加层数).toBe(4);(f.w.mode.当前任务实例 as unknown as{能力名:string}).能力名='完成交互';f.w.mode.新回合触发时机();expect(effect.叠加层数).toBe(4);
 });
 it('雷神匕首 actual charged heroattack creates source3hop shock with configured damage and cleans waits',()=>{
  const f=fixture(),knife=f.item('雷神匕首');f.enter();f.charge(knife);f.enemies[0].当前生命=sci(10000);f.hero.添加技能({DataTable:数据表_技能_默认.asset,RowName:'可控挥击'},1,0);const attack=f.hero.拥有的主动能力.find(x=>x?.能力名==='可控挥击')!;expect(attack.类型.has('效果.时机.发动攻击前')).toBe(true);
  f.hero.造成即时伤害(make伤害({伤害来源:'攻击',伤害数值:sci(1),来自角色:f.hero,来自技能:attack,目标角色:f.enemies[0]}),true,true);const chain=f.w.objects().find(x=>x instanceof 蓝图_效果_闪电链)as 蓝图_效果_闪电链;expect(chain).toBeDefined();expect(chain.跳跃次数).toBe(3);expect(chain.伤害数据.来自角色).toBe(knife);f.advance(2);expect(chain.valid).toBe(false);
 });
});
