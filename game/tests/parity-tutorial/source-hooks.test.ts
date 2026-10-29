import{it,expect}from'vitest';
import{createGame}from'../../src/core/api/game.ts';
import{registry}from'../../src/content/bp/index.ts';
import{tutorialSave}from'../../src/core/sys/tutorial/tips.ts';
import{openPanel}from'../../src/core/sys/turn/mission.ts';
import{蓝图_奖励_解锁任务}from'../../src/content/bp/Skill/Ability/奖励/蓝图_奖励_解锁任务.ts';
import{Shell}from'../../src/game/loop.ts';
import{persistSave,readSave,type SaveStorage}from'../../src/game/storage.ts';
import type{PresentEvent}from'../../src/core/api/events.ts';
const fresh=()=>{const g=createGame({seed:1,content:registry,filter:'ported'});g.runUntilInput();g.send({type:'title.prologue'});g.runUntilInput();g.send({type:'tutorial.continue'});g.send({type:'map.enter',cell:'r1c1'});g.runUntilInput();return g;};
it('actual empty-bottle acquisition and craft page command trigger their distinct once-only source tips',()=>{
 const g=fresh(),w=g.world,card=w.cult.创建牌到侧栏('空瓶',1,null,[],0,new Map()).卡牌实例!;expect(w.isValid(card)).toBe(true);expect(g.view.tutorial?.tip).toBe(11);
 expect(g.send({type:'tutorial.continue'}).ok).toBe(true);expect(g.send({type:'page.open',page:'craft'}).ok).toBe(true);expect(g.view.tutorial?.tip).toBe(13);
 expect(g.send({type:'tutorial.continue'}).ok).toBe(true);expect(g.send({type:'page.close'}).ok).toBe(true);expect(g.send({type:'page.open',page:'craft'}).ok).toBe(true);expect(g.view.tutorial).toBeNull();
 expect(tutorialSave(w).已触发新手提示.filter(s=>['进行制作','高品合成'].includes(s))).toEqual(['进行制作','高品合成']);
});
it('actual Failure page shows the source explanation only for a living hero and leaves its panel underneath',()=>{
 const g=fresh();openPanel(g.world.mode,false,false);expect(g.view.tutorial?.tip).toBe(14);expect(g.view.modal?.kind).toBe('panel');expect(g.send({type:'tutorial.continue'}).ok).toBe(true);expect(g.legal().some(c=>c.type==='panel.continue')).toBe(true);
 const dead=fresh();dead.world.mode.玩家角色!.死掉了=true;openPanel(dead.world.mode,false,false);expect(dead.view.tutorial).toBeNull();expect(dead.view.modal?.kind).toBe('panel');
});
it('unlock reward source SaveCustom reaches the actual shell save callback and survives storage roundtrip immediately',()=>{
 const g=fresh(),w=g.world,s=tutorialSave(w),a=w.spawn(蓝图_奖励_解锁任务);a.能力名='序幕';w.mode.当前轮回任务=a;s.当前轮回任务进度.set('old',7);g.drainEvents();
 a.执行技能(false);const events=g.drainEvents().filter(e=>e.kind==='ui'&&e.widget==='save.persist');expect(events).toHaveLength(1);expect(s.当前轮回任务进度.size).toBe(0);expect(s.主线任务.get('序幕')).toBe(true);
 const data=new Map<string,string>(),storage:SaveStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}};let writes=0;
 const target={o:{onSave:()=>{writes++;persistSave(storage,g.save());}},controller:{event:()=>{}}};
 const event=(Shell.prototype as unknown as{event(e:PresentEvent):void}).event;for(const e of events)event.call(target as unknown as Shell,e);
 expect(writes).toBe(1);const restored=createGame({seed:9,content:registry,filter:'ported',save:readSave(storage)});expect(tutorialSave(restored.world).主线任务.get('序幕')).toBe(true);expect(tutorialSave(restored.world).当前轮回任务进度.size).toBe(0);
});
