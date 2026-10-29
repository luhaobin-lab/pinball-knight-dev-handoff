import{describe,it,expect}from'vitest';import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';import{科学数变普通}from'../../src/core/math/sci';import{获取科学映射词条}from'../../src/core/math/stats';import{enchants,extractCost}from'../../src/core/sys/enchant';import type{BP_Actor_Card}from'../../src/core/sim/card';
function setup(){const g=createGame({seed:6,content:registry,filter:'all',debug:{skipPrologue:true}});for(const c of[{type:'title.newRun'},{type:'hero.start'}]as const){g.runUntilInput();expect(g.send(c).ok).toBe(true)}g.runUntilInput();g.world.cult.切换修炼背包(false);
 const item=(row:string,q=1)=>{const c=g.world.cult.创建牌到侧栏(row,q,null,[],7,new Map()).卡牌实例;expect(c).toBeTruthy();return c!};return{g,item};}
const stat=(c:BP_Actor_Card,n:string)=>科学数变普通(获取科学映射词条(c.词条,n).输出值);
describe('source enchant apply replace extract',()=>{
 it('real one-slot drag applies source stone passive and consumes stone with no coins; repeated stone replaces',()=>{
  const{g,item}=setup(),target=item('旧匕首'),stone=item('伤害附魔A'),old=stat(target,'基础伤害'),coins=g.world.mode.金币;
  expect([...stone.拥有的附魔能力.values()]).toEqual(['增伤附魔_0']);const place=g.view.inventory.equip.find(c=>c.id===target.id)!.place!;
  expect(g.send({type:'item.move',item:stone.id,to:{...place,grid:'equip'}}).ok).toBe(true);expect(stone.valid).toBe(false);expect(enchants(target).map(a=>a.能力名)).toEqual(['增伤附魔_0']);expect(stat(target,'基础伤害')).toBeCloseTo(old+10);expect(g.world.mode.金币).toBe(coins);expect(target.附魔存档).toHaveLength(1);
  const next=item('伤害附魔B');expect(g.send({type:'item.enchant',stone:next.id,target:target.id}).ok).toBe(true);expect(enchants(target).map(a=>a.能力名)).toEqual(['增伤附魔_1']);expect(stat(target,'基础伤害')).toBe(old);expect(stat(target,'额外伤害%')).toBeCloseTo(.1);
 });
 it('two-slot item opens source replacement only when full, consumes incoming immediately and preserves replaced acquisition round',()=>{
  const{g,item}=setup(),target=item('旧剑');for(const name of['伤害附魔A','充能附魔A']){const stone=item(name);expect(g.send({type:'item.enchant',stone:stone.id,target:target.id}).ok).toBe(true)}expect(enchants(target)).toHaveLength(2);
  const stone=item('伤害附魔B',2);expect(g.send({type:'item.enchant',stone:stone.id,target:target.id}).ok).toBe(true);expect(stone.valid).toBe(false);expect(g.view.modal?.kind).toBe('enchantReplace');expect(g.legal().some(c=>c.type==='modal.skip')).toBe(false);expect(g.send({type:'modal.pick',option:0}).ok).toBe(true);expect(g.view.modal).toBeNull();expect(enchants(target).map(a=>[a.能力名,a.等级,a.获取轮次])).toEqual([['加速附魔_0',1,7],['增伤附魔_1',2,7]]);
 });
 it('real context extraction costs sum enchant levels, outputs source matching stones then clears; empty stone stays scrap',()=>{
  const{g,item}=setup(),target=item('旧剑'),a=item('伤害附魔A',2),b=item('充能附魔A');for(const stone of[a,b])expect(g.send({type:'item.enchant',stone:stone.id,target:target.id}).ok).toBe(true);const cost=extractCost(target);expect(cost).toBe(3);const coins=g.world.mode.金币;
  if(coins<cost)g.world.mode.增加金币_收入(false,false,cost-coins,null);const before=g.world.mode.金币;
  expect(g.send({type:'item.extract',item:target.id}).ok).toBe(true);expect(g.world.mode.金币).toBe(before-cost);expect(enchants(target)).toHaveLength(0);expect(target.附魔存档).toEqual([]);
  const all=[...g.world.cult.已装备牌,...g.world.cult.背包里牌].filter(c=>c?.valid);expect(all.some(c=>c!.名字==='伤害附魔A'&&c!.品质===2)).toBe(true);expect(all.some(c=>c!.名字==='充能附魔A')).toBe(true);
  const empty=item('空附魔石');expect(empty.拥有的主动能力).toHaveLength(0);expect(g.legal().some(s=>s.type==='item.extract'&&s.params?.item?.includes(empty.id))).toBe(false);
 });
 it('hero enchant equips and unequips its source key without changing caster; queries remain pure',()=>{
  const{g,item}=setup(),h=g.world.mode.玩家角色!,target=item('旧匕首'),stone=item('英雄附魔A'),before=科学数变普通(获取科学映射词条(h.词条,'基础伤害').输出值);
  expect(g.send({type:'item.enchant',stone:stone.id,target:target.id}).ok).toBe(true);expect(科学数变普通(获取科学映射词条(h.词条,'基础伤害').输出值)).toBe(before+5);
  const effect=target.拥有的效果.find(e=>e?.def.path.endsWith('附魔修改英雄属性'))!;expect(effect.释放者).toBe(target);expect(effect.拥有者).toBe(h);
  expect(g.send({type:'item.move',item:target.id,to:{grid:'backpack',row:0,col:0}}).ok).toBe(true);expect(科学数变普通(获取科学映射词条(h.词条,'基础伤害').输出值)).toBe(before);
  const digest=g.digest(),rng=g.world.rng.save();for(let i=0;i<10;i++){g.legal();void g.view;}expect(g.digest()).toBe(digest);expect(g.world.rng.save()).toEqual(rng);
 });
 it('source extraction rejects unaffordable, combat and disarmed input without spending; invalid enchant targets preserve the stone',()=>{
  const{g,item}=setup(),target=item('旧剑'),stone=item('伤害附魔A'),empty=item('空附魔石');
  expect(g.send({type:'item.enchant',stone:stone.id,target:empty.id}).ok).toBe(false);expect(stone.valid).toBe(true);expect(g.send({type:'item.enchant',stone:stone.id,target:target.id}).ok).toBe(true);
  g.world.mode.增加金币_收入(false,false,-g.world.mode.金币,null);const d=g.digest();expect(g.send({type:'item.extract',item:target.id}).ok).toBe(false);expect(g.digest()).toBe(d);
  g.world.mode.增加金币_收入(false,false,3,null);g.world.mode.场上有敌人=true;expect(g.send({type:'item.extract',item:target.id}).ok).toBe(false);g.world.mode.场上有敌人=false;
  g.world.mode.玩家角色!.OwnedGameplayTags.add('状态.缴械');expect(g.send({type:'item.extract',item:target.id}).ok).toBe(false);expect(g.world.mode.金币).toBe(3);
 });
});
