import { it, expect } from 'vitest';
import { halfRed, fogRed } from '../../src/core/sys/room/fog-color.ts';
import { LatentService } from '../../src/core/sim/latent.ts';
import { Scheduler } from '../../src/core/sim/clock.ts';

it('matches all15361binary16 values in [0,1] against independently executed original SSE color leaf', async () => {
  const red = new Uint8Array(0x3c01);
  for(let h=0;h<=0x3c00;h++){
    const e=h>>>10, m=h&1023, value=e===0?m*2**-24:2**(e-15)*(1+m/1024);
    expect(halfRed(value)).toBe(value);red[h]=fogRed(value);
  }
  // fog-native.py copied/relocated the original leaf+table, invoked Windows x64 ABI and compared scalar lanes.
  const digest = await crypto.subtle.digest('SHA-256', red);
  expect([...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')).toBe('fea05cf70f60ad4256661541d10530bac897ecec45bbd99cb441eca2290ac5ed');
  expect(fogRed(.07916259765625)).toBe(79);expect(fogRed(.0792236328125)).toBe(80);
  expect(halfRed(1+2**-11)).toBe(1);expect(halfRed(1+3*2**-11)).toBe(1+2**-9);
  expect(halfRed(2**-25)).toBe(0);expect(halfRed(3*2**-25)).toBe(2**-23);
});
it('inherited timeline resolution preserves local overrides and source owner cancellation',()=>{
  const clock=new Scheduler(), local={length:.1,tracks:{}},parent={length:1,tracks:{}},events:string[]=[];
  const latent=new LatentService({clock,anim:()=>undefined,resolveTimeline:()=>parent});
  const own={id:1,def:{path:'Child',timelines:{Local:local}},ReceiveTick(){}},inherited={id:2,def:{path:'Child',timelines:{}},ReceiveTick(){}};
  latent.timeline(own,'Local','PlayFromStart',{finished:()=>events.push('local')});
  latent.timeline(inherited,'Parent','PlayFromStart',{finished:()=>events.push('parent')});
  clock.advance(.2);expect(events).toEqual(['local']);clock.cancelOwner(inherited);clock.advance(2);expect(events).toEqual(['local']);
});
