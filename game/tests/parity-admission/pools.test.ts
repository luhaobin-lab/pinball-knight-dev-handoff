import {it,expect}from'vitest';
import{createWorld}from'../../src/core/sim/runtime';
import{registry,createRegistry}from'../../src/content/bp';
import{G2_SCOPE}from'../../src/core/sim/stage-scope';
import{数据表_天赋_新新通用,数据表_天赋_专属,数据表_天赋_boss专属,合成数据表_修炼物品}from'../../src/content/demo';
it('172item/93talent roots match audited source counts, with alldependencies present and unsupported hero/ignored roots excluded',()=>{
 const w=createWorld({content:registry,filter:'ported'});
 expect(new Set(G2_SCOPE.items).size).toBe(172);for(const name of G2_SCOPE.items){expect(合成数据表_修炼物品.rows[name]).toBeDefined();expect(w.isRowPorted(合成数据表_修炼物品.asset,name),name).toBe(true);}
 const general=Object.entries(数据表_天赋_新新通用.rows).filter(([,r])=>!r.类型.includes('忽略')).map(([n])=>n);
 const hero=Object.entries(数据表_天赋_专属.rows).filter(([,r])=>!r.类型.some(t=>t==='忽略'||t.endsWith('恶疫旅人')||t.endsWith('元素祭司'))).map(([n])=>n);
 expect([...G2_SCOPE.generalTalents].sort()).toEqual(general.sort());expect([...G2_SCOPE.heroTalents].sort()).toEqual(hero.sort());
 expect(G2_SCOPE.bossTalents).toEqual(['大型装甲','真视','新生之力','癫狂','爆裂火星','蓄力击','掠夺','暴食']);
 expect(general.length+hero.length+G2_SCOPE.bossTalents.length).toBe(93);
 for(const[t,names]of [[数据表_天赋_新新通用,G2_SCOPE.generalTalents],[数据表_天赋_专属,G2_SCOPE.heroTalents],[数据表_天赋_boss专属,G2_SCOPE.bossTalents]]as const)for(const n of names)expect(w.isRowPorted(t.asset,n),n).toBe(true);
});
it('a formerly exempt statue now fails the real registry gate when its required ability is removed',()=>{
 const missing='CatapultHero/BP/Skill/Ability/道具/蓝图_能力_破损的神像';const content=createRegistry(registry.paths().filter(p=>p!==missing).map(p=>registry.get(p)!));
 const w=createWorld({content,filter:'ported'});expect(w.isRowPorted(合成数据表_修炼物品.asset,'破损的神像')).toBe(false);
});
