import{it,expect,vi}from'vitest';
import{fixture}from'../parity-items/fixture.ts';
import{Cues,type CueTarget}from'../../src/game/cues.ts';
import handlers from'../../src/game/cues/launch-feel.ts';
import{CUES,GROUPS}from'../../src/audio/cues.ts';
import{nominalPlan}from'../../src/audio/patch.ts';
import{createAudio}from'../../src/audio/index.ts';
import{mockContext,manualClock}from'../audio-sfx/mock-audio.ts';
import{WAVES}from'../../src/audio/waves.ts';
it('real blocked damage and acquired charged bow dispatch source sounds into playable audio without touching simulationRNG',async()=>{
 const f=fixture();f.hero.格挡层计数=2;f.hit({from:f.enemies[0],to:f.hero,amount:10});
 const bow=f.item('分身短弓');f.enter();f.charge(bow);f.bounce();
 const events=f.events('sound').filter(e=>/音效_基础_(格挡|飞箭)$/.test(e.asset??''));expect(events.some(e=>e.asset==='音效_基础_格挡')).toBe(true);expect(events.some(e=>e.asset?.endsWith('/音效_基础_飞箭'))).toBe(true);
 const rng=f.w.rng.save(),ctx=mockContext(),clock=manualClock(),audio=createAudio({seed:9,context:()=>ctx,now:clock.now,prewarm:false});await audio.unlock();
 const t:CueTarget={sound:(cue,at)=>audio.play(cue,at??undefined),place:()=>({x:0,z:0}),shake:vi.fn(),spark:vi.fn()},cues=new Cues(handlers);
 for(const e of events){clock.set(e.t);cues.play(e,t);}expect(cues.unknown.size).toBe(0);expect(audio.events.some(e=>e.cue==='block'&&e.params.played)).toBe(true);expect(audio.events.some(e=>e.cue==='arrow'&&e.params.played)).toBe(true);expect(f.w.rng.save()).toEqual(rng);
 expect(audio.events.filter(e=>e.cue==='arrow'&&e.params.reason==='retrigger').length).toBeGreaterThan(0);audio.dispose();
});
it('honors connected MetaSound values instead of disconnected delay/literalpitch and preserves source wave windows',()=>{
 expect(CUES.block.layers.map(l=>[l.tempo,l.pitch,l.pitchRandom,l.maxTime,l.delay,l.volume])).toEqual([[1,0,5,2,0,.8],[2,0,5,3,0,2]]);
 expect(CUES.block.finishLayer).toBe(1);expect(nominalPlan(CUES.block).lifetime).toBe(3.01);
 expect(CUES.arrow.layers.map(l=>[l.tempo,l.pitch,l.highpass,l.maxTime,l.delay,l.volume])).toEqual([[1,0,500,3,0,4]]);expect(CUES.arrow.gain).toBe(1.3);
 expect(GROUPS.interval).toEqual({demo:'音效并发_零点一间隔',maxCount:8,retrigger:.1});
 for(const id of['metalShield','shield','arrow']as const){const w=WAVES[id],sr=48000*w.rate,samples=w.render(sr,1,1);expect(Math.abs(samples.length/sr-w.demoDuration)).toBeLessThan(1/sr);expect(samples.some(x=>Math.abs(x)>.1)).toBe(true);expect(samples.every(Number.isFinite)).toBe(true);}
});
