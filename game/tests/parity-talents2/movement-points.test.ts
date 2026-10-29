import { describe, expect, it } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';

describe('source movement spawn points through the actual facade',()=>{
 it('keeps exact-interval old point but strict > false, starts beyond-threshold points at the old location, and stays pure',()=>{
  const f=fixture(),previous={x:10,y:20,z:56},before=f.w.digest(),rng=f.w.rng.save();
  const equal=函数库_工具.寻找移动创建点(f.hero,{x:138,y:20,z:56},previous,128);expect(equal).toEqual({创建点:[previous],方向:{x:1,y:0,z:0},有存在:false});
  const r=函数库_工具.寻找移动创建点(f.hero,{x:310,y:20,z:56},previous,128);expect(r).toEqual({创建点:[previous,{x:138,y:20,z:56}],方向:{x:1,y:0,z:0},有存在:true});
  expect(f.w.digest()).toBe(before);expect(f.w.rng.save()).toEqual(rng);
 });
 it('measures3D distance but normalizesXY, deduplicates zero planar movement and removes current point',()=>{
  const f=fixture(),prev={x:0,y:0,z:0};
  expect(函数库_工具.寻找移动创建点(f.hero,{x:0,y:0,z:300},prev,128)).toEqual({创建点:[prev],方向:{x:0,y:0,z:0},有存在:true});
  expect(函数库_工具.寻找移动创建点(f.hero,prev,prev,128)).toEqual({创建点:[],方向:{x:0,y:0,z:0},有存在:false});
  const r=函数库_工具.寻找移动创建点(f.hero,{x:30,y:40,z:120},prev,64);expect(r.创建点).toEqual([prev,{x:38.4,y:51.2,z:0}]);expect(r.方向).toEqual({x:.6,y:.8,z:0});
 });
 it('preserves existing FFloor nonfinite semantics for zero interval instead of returning a new gate result',()=>{
  const f=fixture();expect(函数库_工具.寻找移动创建点(f.hero,{x:1,y:0,z:0},{x:0,y:0,z:0},0)).toEqual({创建点:[],方向:{x:1,y:0,z:0},有存在:true});
 });
});
