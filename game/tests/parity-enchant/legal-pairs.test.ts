import{it,expect}from'vitest';import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';
function setup(){const g=createGame({seed:1,content:registry,debug:{skipPrologue:true}});for(const type of['title.newRun','hero.start']as const){g.runUntilInput();expect(g.send({type}).ok).toBe(true)}g.runUntilInput();const item=(name:string)=>g.world.cult.创建牌到侧栏(name,1,null,[],0,new Map()).卡牌实例!;return{g,item};}
it('a lone real enchantment stone has no self-target command, matching the source handler refusal',()=>{
 const{g,item}=setup(),stone=item('伤害附魔A');expect(stone).toBeTruthy();const digest=g.digest();expect(g.legal().filter(s=>s.type==='item.enchant')).toEqual([]);expect(g.send({type:'item.enchant',stone:stone.id,target:stone.id}).ok).toBe(false);expect(g.digest()).toBe(digest);
});
it('each legal source stone/target pair is independently valid, while empty stones and unmatched item tags never leak into its target domain',()=>{
 const make=()=>{const f=setup();for(const name of['伤害附魔A','护甲附魔A','旧剑','旧盾','空附魔石'])expect(f.item(name),name).toBeTruthy();return f.g;};
 const g=make(),specs=g.legal().filter(s=>s.type==='item.enchant'),pairs=specs.flatMap(s=>s.params!.stone.flatMap(stone=>s.params!.target.map(target=>({stone:Number(stone),target:Number(target)}))));expect(pairs.length).toBeGreaterThan(0);
 expect(specs.every(s=>s.params!.stone.length===1)).toBe(true);const d=g.digest(),rng=g.world.rng.save();for(let i=0;i<10;i++)g.legal();expect(g.digest()).toBe(d);expect(g.world.rng.save()).toEqual(rng);
 for(const pair of pairs){expect(pair.stone).not.toBe(pair.target);const copy=make();const card=[...copy.view.inventory.equip,...copy.view.inventory.backpack].find(c=>c.id===pair.target)!;expect(card.row).not.toBe('空附魔石');expect(copy.send({type:'item.enchant',...pair}).ok,JSON.stringify(pair)).toBe(true);}
});
