import {describe,expect,it} from 'vitest';
import {createGame} from '../../src/core/api/game.ts';
import {registry} from '../../src/content/bp/index.ts';
import {开启多选一,主界面Of} from '../../src/core/sys/talents/choice.ts';
import {multiChoiceModel} from '../../src/game/bind/pages/modal-multi-choice.ts';

describe('source talent price reaches the visible choice',()=>{
 it.each([false,true])('free=%s keeps source price visibility and actual single payment',free=>{
  const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}});
  for(const type of ['title.newRun','hero.start'] as const){g.runUntilInput();expect(g.send({type}).ok).toBe(true);}g.runUntilInput();
  // Exact source chooser boundary. This does not claim a natural paid-event route.
  开启多选一(g.world,{目标或_且:false,目标标签:[],排除标签:[],指定池子:['力量'],不加入回合开始:true,免费:free,天赋_事件:false,选项数量:1,可刷新次数:0,额外等级:0,来自效果:null,来自能力:null});g.advance(.25);
  const state=主界面Of(g.world),modal=g.view.modal;expect(modal?.kind).toBe('multiChoice');if(modal?.kind!=='multiChoice')throw Error('source choice missing');
  const price=state.多选一选项[0]!.价格,model=multiChoiceModel(g.view,g.legal()),before=g.digest(),rng=g.world.rng.save();
  expect(price).toBe(free?0:state.多选一选项[0]!.本次提升等级*3);expect(model.options[0]!.price).toBe(free?undefined:price);
  for(let i=0;i<10;i++)multiChoiceModel(g.view,g.legal());expect(g.digest()).toBe(before);expect(g.world.rng.save()).toEqual(rng);
  const coins=g.world.mode.金币;expect(g.send({type:'modal.pick',option:0}).ok).toBe(true);expect(g.world.mode.金币).toBe(coins-price);
  expect(g.send({type:'modal.pick',option:0}).ok).toBe(false);expect(g.world.mode.金币).toBe(coins-price);
 });
});
