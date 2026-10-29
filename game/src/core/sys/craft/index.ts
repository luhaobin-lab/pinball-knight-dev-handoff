/** Source dismantling entry. Recipe/manufacturing/merge remain separate unported functions. */
import type { Systems } from '../../bp/systems.ts';
import { dismantle, dismantleCommand, dismantleLegal } from './dismantle.ts';
import { materialFns } from './materials.ts';
import { unlockRecipe } from './recipes.ts';
import { checkMerges, merge, mergeCards, mergeCompatible } from './merge.ts';
import { canOpenCraft, canPut, changeQuality, closeCraft, craftView, manufacture, openCraft, putItem, readCraft, selectRecipe, takeCraftItem } from './page.ts';
import { recipeGroups } from './recipes.ts';
import type { World } from '../../sim/world.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';

export interface CraftUi {
  openCraft(world: World, from?: BP_Actor_Card | null, category?: number): boolean;
  closeCraft(world: World): boolean;
  canPut(world: World, card: BP_Actor_Card | null): boolean;
}

export const craft: Systems['craft'] & CraftUi = {
  openCraft, closeCraft, canPut,
  函数库_工具: materialFns,
  修炼系统: { 分解牌: dismantle, 解锁配方判断: unlockRecipe, 检查可合成牌: checkMerges, 合成牌: merge, 制造牌: putItem },
  BP_Actor_Card: { 自身可合成判断(self, preview, target) {
    if (!self.可合成 || !target || !self.可合成目标牌.includes(target)) return { 失败了: true };
    self.world.cult.合成牌(self, target, preview); self.fx.ui({ op: 'update', widget: 'UI_合成进度', data: { visible: preview } }); return { 失败了: false };
  } },
  commands: {
    'item.dismantle': (w,c) => dismantleCommand(w,c.item),
    'item.modify': (w,c) => { const card=mergeCards(w).find(x=>x?.id===c.item);return {ok:!!card&&openCraft(w,card)}; },
    'page.open': (w,c) => { if(c.page==='stash')return{ok:(w.sys.camp as {openStash(w:World):boolean}).openStash(w)};if(c.page==='craft')return{ok:openCraft(w)};if(c.page==='materials'&&canOpenCraft(w)){w.cult.材料页关闭了=false;w.cult.打开页面类型='材料页';return{ok:true};}return{ok:false,reason:'page is not available'}; },
    'page.close': w => ({ok:!w.cult.仓库页关闭了?(w.sys.camp as {closeStash(w:World):boolean}).closeStash(w):closeCraft(w)}),
    'craft.select': (w,c) => ({ok:selectRecipe(w,c.recipe)}),
    'craft.quality': (w,c) => ({ok:changeQuality(w,c.delta)}),
    'craft.put': (w,c) => {const card=mergeCards(w).find(x=>x?.id===c.item);if(!card||!canPut(w,card))return{ok:false};card.被抓起(true);return{ok:w.cult.制造牌(card).放入了};},
    'craft.take': (w,c) => ({ok:takeCraftItem(w,c.item)}),
    'item.craft': (w,c) => ({ok:manufacture(w,c.recipe,c.count)}),
    'item.combine': (w, c) => {
      const all = mergeCards(w), a = all.find(x => x?.id === c.item), b = all.find(x => x?.id === c.with);
      if (w.modal.current || !a || !b || !mergeCompatible(a,b) || w.mode.玩家角色?.死掉了 || w.mode.玩家角色?.OwnedGameplayTags.has('状态.缴械')) return { ok: false, reason: 'items cannot merge' };
      a.被抓起(true); w.cult.合成牌(a,b,false); return { ok: true };
    },
  },
  legal(w) {
    const out = dismantleLegal(w); if (w.modal.current || !w.mode.玩家角色 || w.mode.玩家角色.死掉了 || w.mode.玩家角色.OwnedGameplayTags.has('状态.缴械')) return out;
    const v=craftView(w);
    if(v){
      out.push({type:'page.close'});
      const recipes=v.groups.flatMap(g=>g.rows.filter(r=>r.unlocked).map(r=>r.row));
      if(recipes.length)out.push({type:'craft.select',params:{recipe:recipes}});
      if(v.canIncrease||v.canDecrease)out.push({type:'craft.quality',params:{delta:[...(v.canDecrease?[-1]:[]),...(v.canIncrease?[1]:[])]}});
      const put=v.requirements.flatMap(r=>r.candidates.filter(()=>r.placed<r.need).map(c=>c.id));if(put.length)out.push({type:'craft.put',params:{item:put}});
      const take=[...v.inputs,...v.outputs].map(c=>c.id);if(take.length)out.push({type:'craft.take',params:{item:take}});
      if(v.canCraft&&v.selected)out.push({type:'item.craft',params:{recipe:[v.selected],count:[1]}});
      return out;
    }
    if(!w.cult.材料页关闭了)out.push({type:'page.close'});
    if(canOpenCraft(w)){out.push({type:'page.open',params:{page:['craft','materials']}});const modify=mergeCards(w).filter(c=>c&&w.isValid(c)&&recipeGroups(w,c.名字).length).map(c=>c!.id);if(modify.length)out.push({type:'item.modify',params:{item:modify}});}
    const all = mergeCards(w).filter(x => x && w.isValid(x));
    for (const a of all) if (a) { const others = all.filter(b => b && mergeCompatible(a,b)); if (others.length) out.push({ type: 'item.combine', params: { item: [a.id], with: others.map(x => x!.id) } }); }
    return out;
  },
  view(w){return{craft:craftView(w),materialsPage:!w.cult.材料页关闭了&&!readCraft(w)};},
};
