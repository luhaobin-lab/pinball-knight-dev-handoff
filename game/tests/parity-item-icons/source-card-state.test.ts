import{it,expect}from'vitest';import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';
import{itemCards}from'../../src/game/bind/hud';import{科学数变普通,sciOf}from'../../src/core/math/sci';import{获取科学映射词条}from'../../src/core/math/stats';
it('actual source card badges, enchant sockets, remaining uses and round cooldown reach ordinary HUD without modifying the game',()=>{
 const g=createGame({seed:1,content:registry,debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();
 const w=g.world,sword=w.cult.创建牌到侧栏('旧剑',1,null,[],0,new Map()).卡牌实例!,potion=w.cult.创建牌到侧栏('生命药剂',1,null,[],0,new Map()).卡牌实例!;
 sword.添加附魔(['增伤附魔_0'],1,false,false,0);const active=potion.拥有的主动能力[0]!;active.创建冷却效果(-1,2);
 const snap=()=>itemCards([...g.view.inventory.equip,...g.view.inventory.backpack]),before=g.digest(),rng=w.rng.save(),cards=snap();
 expect(cards.find(c=>c.id===String(sword.id))).toMatchObject({damage:科学数变普通(获取科学映射词条(sword.词条,'基础伤害').输出值),enchants:1});
 expect(cards.find(c=>c.id===String(potion.id))).toMatchObject({durability:科学数变普通(获取科学映射词条(potion.词条,'生命').输出值),cooldown:3,enchants:0});
 expect(cards.find(c=>c.id===String(sword.id))?.heal).toBeUndefined();for(let n=0;n<10;n++)snap();expect(g.digest()).toBe(before);expect(w.rng.save()).toEqual(rng);
 active.冷却效果!.销毁效果();g.advance(1);w.mode.玩家角色!.失去生命_护甲(sciOf(20),sciOf(0),false);const uses=snap().find(c=>c.id===String(potion.id))!.durability!;
 expect(g.send({type:'item.use',item:potion.id}).ok).toBe(true);g.advance(1);const after=snap().find(c=>c.id===String(potion.id));
 if(uses>1)expect(after?.durability).toBe(uses-1);else expect(after).toBeUndefined();
});
