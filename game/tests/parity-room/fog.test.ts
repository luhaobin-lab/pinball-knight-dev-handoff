import { describe, it, expect } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { beginFog, clearFog, drawFog, fogView, fogBrush, fogUv, fogRed, inFogAt, FogMask } from '../../src/core/sys/room/fog.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { SetActorHiddenInGame } from '../../src/core/sim/engine.ts';
const setup = () => {
  const f = combatFixture(); f.world.mode.当前环节 = '交互场牌'; clearFog(f.world);
  SetActorHiddenInGame(f.world.mode.迷雾图!, false); return f;
};
describe('cooked fog material and source actor/room lifecycle', () => {
  it('matches UV2500, stationary/segment brush, .3feather and raw range gate', () => {
    expect(fogUv({x:-1250,y:1250,z:99})).toEqual([0,1]);
    const a=[.5,.5],b=[.75,.5],r=Math.fround(.1);
    expect(fogBrush(.5,.5,a,a,r)).toBe(1);
    expect(fogBrush(.625,.5,a,b,r)).toBe(1); // Whole travelled segment, not only its endpoints.
    expect(fogBrush(.5,.6,a,a,r)).toBeLessThan(1e-10);
    expect(fogBrush(.5,.565,a,a,r)).toBeCloseTo(.5,5);
    expect(fogBrush(.5,.5,a,a,0)).toBe(0);expect(fogBrush(.5,.5,a,a,-1)).toBe(0);
  });
  it('retains explored pixels by max and canonical full-state rows differ for different revealed areas', () => {
    const m=new FogMask();m.draw([.25,.5],[.5,.5],.05);const first=m.snapshot();
    expect(m.read(128,256)).toBe(1);m.draw([.5,.5],[.75,.5],.05);
    expect(m.read(128,256)).toBe(1);expect(m.read(384,256)).toBe(1);expect(m.snapshot()).not.toEqual(first);
    const rows=m.snapshot();m.draw([.25,.5],[.75,.5],.01);expect(m.snapshot()).toEqual(rows);
  });
  it('uses .2 delay and inherited 1s source height timeline, real tick, read purity and no RNG draw', () => {
    const {world:w,hero}=setup(),rng=w.rng.save();hero.K2_SetActorLocation({x:0,y:0,z:hero.高度});beginFog(hero);
    w.clock.advance(.2);expect(inFogAt(w,{x:0,y:0,z:0})).toBe(true);
    w.clock.advance(1/60);w.clock.advance(1/60);expect(inFogAt(w,{x:0,y:0,z:0})).toBe(false);
    w.clock.advance(1);expect((hero as typeof hero&{ug_fogMaterial:{range:number}}).ug_fogMaterial.range).toBe(Math.fround(hero.高度*.002));
    expect([...w.coverage.counts.keys()].filter(k=>k.includes('迷雾展开动画'))).toEqual([]);
    const digest=w.digest();for(let i=0;i<4;i++){fogView(w);inFogAt(w,{x:0,y:0,z:0});函数库_工具.获取鼠标位置迷雾信息(hero);}
    expect(w.digest()).toBe(digest);expect(w.rng.save()).toEqual(rng);
    expect(fogRed(0)).toBe(0);expect(fogRed(1)).toBe(255);expect(fogRed(.08)).toBe(80);
  });
  it('observes source phase/death guards, hidden bypass, actual movement and room clear', () => {
    const {world:w,hero}=setup();beginFog(hero);w.clock.advance(1.3);const prior=fogView(w)!.rows;
    hero.K2_SetActorLocation({x:800,y:0,z:56});hero.死掉了=true;drawFog(hero);expect(fogView(w)!.rows).toEqual(prior);
    hero.死掉了=false;w.mode.当前环节='揭示场牌';drawFog(hero);expect(fogView(w)!.rows).toEqual(prior);
    w.mode.当前环节='交互场牌';drawFog(hero);expect(inFogAt(w,{x:800,y:0,z:0})).toBe(false);expect(inFogAt(w,{x:400,y:0,z:0})).toBe(false);
    expect(inFogAt(w,{x:0,y:1000,z:0})).toBe(true);SetActorHiddenInGame(w.mode.迷雾图!,true);expect(inFogAt(w,{x:0,y:1000,z:0})).toBe(false);
    clearFog(w);SetActorHiddenInGame(w.mode.迷雾图!,false);expect(inFogAt(w,{x:800,y:0,z:0})).toBe(true);
    drawFog(hero);expect(inFogAt(w,{x:800,y:0,z:0})).toBe(false); // Clear invalidates stationary optimization.
  });
  it('frame stepping and event advance preserve the complete mask/digest; destroy cancels inherited timeline', () => {
    const a=setup(),b=setup();for(const f of[a,b]){beginFog(f.hero);f.world.clock.after(.6,()=>f.hero.K2_SetActorLocation({x:250,y:80,z:56}),f.hero);}
    for(let i=0;i<90;i++)a.world.clock.advance(1/60);b.world.clock.advance(1.5);
    expect(a.world.digest()).toBe(b.world.digest());expect(fogView(a.world)).toEqual(fogView(b.world));
    const c=setup();beginFog(c.hero);c.world.clock.advance(.4);c.world.destroy(c.hero);const rows=fogView(c.world)!.rows;
    c.world.clock.advance(2);expect(fogView(c.world)!.rows).toEqual(rows);
  });
});
