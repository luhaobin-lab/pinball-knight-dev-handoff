import { describe,expect,it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { showTip,hideTip,tutorialSave } from '../../src/core/sys/tutorial/tips.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';

describe('source tutorial widget gates and overlay ownership',()=>{
 it('keeps original enum numbering13liveof15, once-at-display, overwrite-not-queue and close-vs-continue widget semantics',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported'});g.runUntilInput();const m=g.world.mode;
  showTip(g.world,1);expect(g.view.tutorial).toBeNull();m.当前总层数=2;m.当前层回合=1;showTip(g.world,1);expect(g.view.tutorial?.name).toBe('启动弹射');showTip(g.world,2);expect(g.view.tutorial?.name).toBe('启动弹射');
  m.当前层回合=3;showTip(g.world,2);showTip(g.world,9);expect(g.view.tutorial?.name).toBe('敌人攻击');expect(tutorialSave(g.world).已触发新手提示).toEqual(['启动弹射','充能说明','敌人攻击']);
  hideTip(g.world,false);expect(m.玩家控制器!.在Widget上).toBe(true);showTip(g.world,9);expect(g.view.tutorial).toBeNull();showTip(g.world,8);hideTip(g.world,true);expect(m.玩家控制器!.在Widget上).toBe(false);
  showTip(g.world,7);expect(g.view.tutorial).toBeNull();m.当前总层数=4;showTip(g.world,3);expect(g.view.tutorial?.tip).toBe(3);m.当前总层数=6;showTip(g.world,5);expect(g.view.tutorial?.tip).toBe(5);
  for(const n of [0,6,11,12,13]){showTip(g.world,n);expect(g.view.tutorial?.tip).toBe(n);}expect(g.view.tutorial?.title).toBe('快速合成');
  g.world.modal.open({kind:'panel',result:'failure',lines:[],canRetry:false},()=>{});showTip(g.world,14);expect(g.view.tutorial?.name).toBe('失败说明');expect(g.view.modal?.kind).toBe('panel');
 });
 it('source use-item tip reduces health above80% once, does not pause game time and preserves underlying loot',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported'});g.runUntilInput();const m=g.world.mode,h=m.玩家角色!;m.当前总层数=2;
  g.world.modal.open({kind:'loot',title:'source boundary',cells:[],exp:null,canTakeAll:false},()=>{});const max=科学数变普通(h.当前最大生命);showTip(g.world,10);expect(科学数变普通(h.当前生命)).toBeCloseTo(max*.8);const hp=科学数变普通(h.当前生命),time=g.view.time;g.advance(.1);expect(g.view.time).toBeGreaterThan(time);showTip(g.world,10);expect(科学数变普通(h.当前生命)).toBe(hp);expect(g.view.modal?.kind).toBe('loot');
 });
});
