import{describe,it,expect}from'vitest';import{fixture,stat}from'../parity-items/fixture';import{数据表_技能_附魔,数据表_技能_奖励}from'../../src/content/demo/tables';import{enchants}from'../../src/core/sys/enchant';import{Array_Random,makeRand15}from'../../src/core/rng/ue';import{蓝图_奖励_获取物品}from'../../src/content/bp/Skill/Ability/奖励/蓝图_奖励_获取物品';
describe('source enchant row closure and exact selection domains',()=>{
 it('30implemented rows have real effects/text at fourqualities; the31st ignored unscoped arthropod row remains an explicit dead-content gap',()=>{
  const entries=Object.entries(数据表_技能_附魔.rows);expect(entries).toHaveLength(31);
  for(const[name,row]of entries)for(const quality of[1,2,3,4]){
   if(name==='节肢'){expect(row.标签).toContain('忽略');expect(row.能力.效果[0].效果类).toBe('CatapultHero/BP/Skill/效果/物品/蓝图_效果_节肢');const f=fixture();expect(f.w.isPorted(row.能力.效果[0].效果类!)).toBe(false);continue;}
   const f=fixture(),item=f.item('旧剑',quality);item.添加附魔([name],2**(quality-1),false,false,9);
   const a=enchants(item).find(a=>a.能力名===name)!;expect(a,`${name}/q${quality}`).toBeTruthy();expect(a.品质).toBe(quality);expect(a.描述.zh).not.toMatch(/\{\d+\}/);
   for(const cfg of row.能力.效果){expect(f.w.isPorted(cfg.效果类!),`${name} effect dependency`).toBe(true);expect(item.拥有的效果.some(e=>e?.def.path===cfg.效果类&&e.来自技能===a),`${name} actual effect`).toBe(true);}
  }
 });
 it('source numerical enchant vectors are10/20/40/80damage and10/20/30/40percent byquality, with codec preservinglevel/round',()=>{
  for(const[q,damage,pct]of[[1,10,.1],[2,20,.2],[3,40,.3],[4,80,.4]]as const){const f=fixture(),item=f.item('旧剑',q),old=stat(item,'基础伤害');item.添加附魔(['增伤附魔_0'],2**(q-1),false,false,17);expect(stat(item,'基础伤害')).toBeCloseTo(old+damage);item.添加附魔(['增伤附魔_1'],2**(q-1),false,false,17);expect(stat(item,'额外伤害%')).toBeCloseTo(pct);item.储存附魔();
   const saved=JSON.parse(JSON.stringify(item.附魔存档)),copy=f.w.cult.生成卡牌('CatapultHero/数据表/合成数据表_修炼物品','旧剑',{x:0,y:0,z:0},'None',false,q,0,saved,new Map(),false,5,123).卡牌实例!;
   expect(enchants(copy).map(a=>[a.能力名,a.等级,a.获取轮次])).toEqual(enchants(item).map(a=>[a.能力名,a.等级,a.获取轮次]));expect(stat(copy,'基础伤害')).toBeCloseTo(stat(item,'基础伤害'));}
 });
 it('creation enchant filters byfirstsecondarytags andignore, draws once frommeta only, and stones skip creationenchant',()=>{
  const f=fixture(),item=f.item('旧剑'),pool=Object.entries(数据表_技能_附魔.rows).filter(([,r])=>!r.标签.includes('忽略')&&(!r.副条件[0]?.目标标签.length||item.OwnedGameplayTags.hasAny(r.副条件[0].目标标签))).map(([n])=>n);
  expect(pool).not.toContain('节肢');
  const rng=makeRand15(f.w.rng.meta.state),expected=pool[Array_Random(rng,pool)],combat=f.w.rng.combat.state;item.添加附魔([],99,true,false,4);expect(enchants(item)[0].能力名).toBe(expected);expect(f.w.rng.meta.state).toBe(rng.state);expect(f.w.rng.combat.state).toBe(combat);
  const stone=f.item('伤害附魔A'),before=f.w.rng.save();stone.添加附魔([],1,true,false,0);expect(f.w.rng.save()).toEqual(before);expect(enchants(stone)).toEqual([]);
 });
 it('the11sourceordinary and6legendary stones create their real dormant enchants rather than applying their bonus to themselves',()=>{
  const names=['伤害附魔A','伤害附魔B','治愈附魔A','治愈附魔B','护甲附魔A','护甲附魔B','充能附魔A','充能附魔B','英雄附魔A','英雄附魔B','英雄附魔C','传奇附魔A','传奇附魔B','传奇附魔C','传奇附魔D','传奇附魔E','传奇附魔F'];
  expect(names).toHaveLength(17);for(const row of names){const f=fixture(),stone=f.item(row);expect(stone.拥有的附魔能力.size,row).toBe(1);expect(enchants(stone)).toEqual([]);expect(stone.拥有的效果.some(e=>e?.def.path.endsWith('蓝图_效果_附魔悬停物品')),row).toBe(true);}
 });
 it('source initialRewardB chance1 really enchants every eligible generated offer through the original reward producer',()=>{
  const f=fixture(),a=f.w.spawn(蓝图_奖励_获取物品,x=>{x.拥有者=f.hero;x.能力名='初始奖励B';x.技能配置=数据表_技能_奖励.rows.初始奖励B;x.等级=1;});a.初始化();a.执行技能(false);
  const offers=f.w.cult.未拾取牌.filter(c=>c?.valid);expect(offers.length).toBeGreaterThan(0);
  for(const card of offers)if(!card!.HasMatchingGameplayTag('可交互.修炼牌.附魔'))expect(enchants(card!),card!.名字).toHaveLength(1);
 });
});
