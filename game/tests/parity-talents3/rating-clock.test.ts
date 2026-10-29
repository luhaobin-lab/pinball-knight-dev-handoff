import {describe,expect,it} from 'vitest';
import {demoClasses} from '../../src/content/demo/classes.ts';
import {GameClock} from '../../src/game/clock.ts';
describe('source rating-reward real-time clock mapping',()=>{
 it('shares the adapter only because the complete original timeline equals the verified death-resist timeline',()=>{
  expect(demoClasses['CatapultHero/BP/Skill/效果/天赋/蓝图_效果_评分获得效果'].timelines.时间轴)
   .toEqual(demoClasses['CatapultHero/BP/Skill/效果/物品/蓝图_效果_抵抗致死'].timelines.时间轴);
 });
 it('rating reward uses its event start/resumed position and produces identical game time across real-frame partitions',()=>{
  const results=[30,60,120].map(fps=>{const c=new GameClock();c.sync(12);c.dilate('ratingReward',11.95);for(let i=0;i<fps*2;i++)c.step(1/fps,false);return c.time;});
  const resist=new GameClock();resist.sync(12);resist.dilate('deathResist',11.95);resist.step(2,false);
  for(const t of results)expect(t).toBeCloseTo(resist.time,10);
  const c=new GameClock();c.sync(12);c.dilate('ratingReward',12);expect(c.step(.1,false)).toBeCloseTo(.01,8);expect(c.step(1,true)).toBe(0);
  c.dilate('none',c.time);expect(c.step(.1,false)).toBeCloseTo(.1,10);
 });
});
