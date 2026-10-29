import{it,expect}from'vitest';import{createGame}from'../../src/core/api/game.ts';import{registry}from'../../src/content/bp/index.ts';
it('a real empty-stone modification page with only locked recipes offers no impossible select and can close',()=>{
 const g=createGame({seed:2,content:registry,filter:'ported',debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();
 const c=g.world.cult.创建牌到侧栏('空附魔石',1,null,[],0,new Map()).卡牌实例!;expect(c).toBeTruthy();
 expect(g.send({type:'item.modify',item:c.id})).toEqual({ok:true});const v=g.view.craft!;
 expect(v.groups.flatMap(g=>g.rows)).not.toHaveLength(0);expect(v.groups.every(g=>g.rows.every(r=>!r.unlocked))).toBe(true);
 const digest=g.digest(),rng=g.world.rng.save();for(let i=0;i<5;i++){expect(g.legal().some(c=>c.type==='craft.select')).toBe(false);expect(g.legal().some(c=>c.type==='page.close')).toBe(true);g.view;}
 expect(g.digest()).toBe(digest);expect(g.world.rng.save()).toEqual(rng);
 expect(g.send({type:'page.close'})).toEqual({ok:true});expect(g.view.craft).toBe(null);expect(g.world.isValid(c)).toBe(true);
});
