import{describe,it,expect}from'vitest';import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';import{BP_Actor_Card}from'../../src/core/sim/card';import{添加科学映射值,获取科学映射词条}from'../../src/core/math/stats';import{科学数变普通,sciOf}from'../../src/core/math/sci';import{CARD_SAVED}from'../../src/core/sys/save/inventory';
const stat=(c:{词条:Parameters<typeof 获取科学映射词条>[0]},name:string)=>科学数变普通(获取科学映射词条(c.词条,name).输出值);
function setup(){const g=createGame({seed:6,content:registry,debug:{skipPrologue:true}});for(const type of['title.newRun','hero.start']as const){g.runUntilInput();expect(g.send({type}).ok).toBe(true);}g.runUntilInput();return g;}
function resume(save:ReturnType<ReturnType<typeof setup>['save']>){const g=createGame({seed:6,content:registry,save,debug:{skipPrologue:true}});g.runUntilInput();expect(g.view.modal).toMatchObject({kind:'warning',type:2});expect(g.send({type:'warning.answer',button:0}).ok).toBe(true);g.runUntilInput();g.advance(.51);return g;}
describe('source inventory actor persistence',()=>{
 it('map snapshot preserves exact source fields, equipped/backpack slots, quality, acquisition round, enchants and permanent stats across two fresh worlds',()=>{
  const g=setup(),w=g.world,hero=w.mode.玩家角色!,item=w.cult.创建牌到侧栏('旧剑',2,null,[],7,new Map()).卡牌实例!,bag=w.cult.创建牌到侧栏('旧匕首',1,null,[],8,new Map()).卡牌实例!;
  item.添加附魔(['增伤附魔_0','英雄附魔_0'],2,false,false,11);item.下一级计数=3;添加科学映射值(item.词条,'基础伤害','永久保留',sciOf(7,0),true);
  expect(g.send({type:'item.move',item:bag.id,to:{grid:'backpack',row:4,col:0}}).ok).toBe(true);hero.保存英雄信息();
  const before={heroDamage:stat(hero,'基础伤害'),itemDamage:stat(item,'基础伤害'),equip:g.view.inventory.equip,bag:g.view.inventory.backpack};const save=JSON.parse(JSON.stringify(g.save()));
  expect(CARD_SAVED).toHaveLength(24);const a=resume(save),loaded=[...a.world.cult.已装备牌,...a.world.cult.背包里牌].find(c=>c?.唯一ID===item.唯一ID)!;
  expect(loaded).toBeTruthy();expect(loaded.品质).toBe(2);expect(loaded.下一级计数).toBe(3);expect(loaded.获取轮次).toBe(7);expect(loaded.附魔存档.map(e=>[e.能力名,e.等级,e.获取轮次])).toEqual([['增伤附魔_0',2,11],['英雄附魔_0',2,11]]);
  expect(stat(loaded,'基础伤害')).toBe(before.itemDamage);expect(stat(a.world.mode.玩家角色!,'基础伤害')).toBe(before.heroDamage);
  expect(a.view.inventory.backpack.find(c=>c.row==='旧匕首')!.place).toEqual({grid:'backpack',row:4,col:0});expect(a.view.inventory.equip.find(c=>c.row==='旧剑')!.place).toEqual(before.equip.find(c=>c.id===item.id)!.place);
  // Source read=true map opening must not overwrite the save while the .5s card-placement delay is pending.
  expect(a.save().run!.actorSnapshot).toEqual(save.run.actorSnapshot);
  const b=resume(JSON.parse(JSON.stringify(a.save())));expect(stat(b.world.mode.玩家角色!,'基础伤害')).toBe(before.heroDamage);expect(b.view.inventory.equip.map(c=>c.row)).toEqual(a.view.inventory.equip.map(c=>c.row));
  expect(b.world.objects().filter(c=>c instanceof BP_Actor_Card&&c.唯一ID===item.唯一ID)).toHaveLength(1);
 });
 it('unacquired side and dead cards are recorded only as source discard entries and are not resurrected',()=>{
  const g=setup(),w=g.world;const side=w.cult.生成卡牌('CatapultHero/数据表/合成数据表_修炼物品','旧剑',{x:10,y:20,z:5},'None',false,1,0,[],new Map(),false,0,17).卡牌实例!;
  const dead=w.cult.创建牌到侧栏('旧匕首',1,null,[],0,new Map()).卡牌实例!;dead.死掉了=true;w.mode.玩家角色!.保存英雄信息();const a=resume(g.save());
  expect(a.world.objects().some(o=>o instanceof BP_Actor_Card&&(o.唯一ID===side.唯一ID||o.唯一ID===dead.唯一ID))).toBe(false);expect(a.view.inventory.side).toEqual([]);
 });
 it('old v0 saves without inventory continue through their original load path',()=>{
  const g=setup(),save=JSON.parse(JSON.stringify(g.save()));delete save.run.actorSnapshot.inventory;const a=resume(save);expect(a.view.screen).toBe('map');expect(a.world.mode.玩家角色!.死掉了).toBe(false);
 });
 it('a real source failure retry restores the inventory snapshot once and cancels old card children',()=>{
  const g=setup(),w=g.world,item=w.cult.创建牌到侧栏('旧剑',1,null,[],3,new Map()).卡牌实例!;item.添加附魔(['英雄附魔_0'],1,false,false,5);const heroDamage=stat(w.mode.玩家角色!,'基础伤害');
  const cell=g.view.map!.cells.find(c=>c.enterable)!;expect(g.send({type:'map.enter',cell:cell.id}).ok).toBe(true);g.runUntilInput();const children=w.objects().filter(o=>o.attachParent===item);
  w.mode.玩家角色!.检查死亡(true,true);g.advance(1.75);expect(g.view.modal).toMatchObject({kind:'panel',canRetry:true});expect(g.send({type:'panel.retry'}).ok).toBe(true);g.runUntilInput();g.advance(.6);
  expect(item.valid).toBe(false);expect(children.every(c=>!c.valid)).toBe(true);const loaded=w.cult.已装备牌.filter(c=>c?.唯一ID===item.唯一ID);expect(loaded).toHaveLength(1);expect(stat(w.mode.玩家角色!,'基础伤害')).toBe(heroDamage);expect(g.view.inventory.equip.find(c=>c.row==='旧剑')?.enchants).toEqual(['英雄附魔_0']);
 });
});
