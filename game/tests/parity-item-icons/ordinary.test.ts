import{it,expect}from'vitest';
import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';
import{itemCards}from'../../src/game/bind/hud';import{itemIcon,itemIconSpec}from'../../src/procgen/icons';
import{drawCard}from'../../src/ui/hud/cards';import{cardLayout}from'../../src/ui/hud/layout';import{Surface}from'../../src/ui/core/surface';
it('ordinary row cards retain established item-specific procedural glyphs and keep pixel buffers outside JSON change keys',()=>{
 const g=createGame({seed:1,content:registry,debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();
 for(const row of['灵魂香菇','寂静法杖','投手之握']){const c=g.world.cult.创建牌到侧栏(row,1,null,[],0,new Map()).卡牌实例!;expect(c).toBeTruthy();}
 const before=g.digest(),rng=g.world.rng.save(),cards=itemCards([...g.view.inventory.equip,...g.view.inventory.backpack]);
 for(const card of cards){expect(card.spriteKey).toBeTruthy();const L=cardLayout(card.row,card.size),side=Math.min(L.icon.h,L.icon.w-18);expect(card.sprite!(side)).toBe(itemIcon(card.spriteKey!,side));
  const actual=new Surface(180,540),fallback=new Surface(180,540);drawCard(actual,card,false);drawCard(fallback,{...card,sprite:undefined},false);expect([...actual.data]).not.toEqual([...fallback.data]);
  expect(itemIconSpec(card.spriteKey!).glyph).not.toBe('orb');expect(JSON.stringify(card)).not.toContain('data');expect(JSON.stringify(card).length).toBeLessThan(500);
 }
 expect(g.digest()).toBe(before);expect(g.world.rng.save()).toEqual(rng);
});
