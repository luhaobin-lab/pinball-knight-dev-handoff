import {describe,it,expect}from'vitest';
import oracle from './native-vectors.json';
import {nativePrdBatchCoefficient,nativePrdUniform,nativeRollPRDBatch}from'../../src/core/math/prd-native.ts';
import {CfromP,prdChance,RollPRDBatch}from'../../src/core/math/prob.ts';
import {makeRand15,rand15}from'../../src/core/rng/ue.ts';
import {legacyDistributionBatch}from'../core-math/legacy-prd.ts';
describe('original binary numeric oracle, not a second hand-written implementation',()=>{
 it('matches the locally imported UCRT rand sequence for6seeds and1536draws',()=>{
  for(const v of oracle.ucrtRand){const g=makeRand15(v.seed),values=Array.from({length:v.draws},()=>rand15(g));expect(values.slice(0,8)).toEqual(v.first8);expect(values.slice(-8)).toEqual(v.last8);expect(g.state).toBe(v.finalState);}
 });
 it('matches every batch output, candidate count, raw draw count and final RNG state across960native calls',()=>{
  for(const [C,counter,attempts,seed,success,next,candidates,draws,state]of oracle.vectors){
   const g=makeRand15(seed!),start={C,counter,attempts,seed};let calls=0;
   const r=nativePrdBatchCoefficient(C!,counter!,attempts!,()=>{calls++;return rand15(g)});
   expect([r.SuccessCount,r.NextTriggerCount,r.CandidateCount,calls,g.state],JSON.stringify(start)).toEqual([success,next,candidates,draws,state]);
  }
 });
 it('matches extreme raw bit patterns at both open interval ends and rejection/skip boundaries',()=>{
  for(const v of oracle.boundaries){let calls=0;const r=nativePrdBatchCoefficient(v.C,v.counter,v.attempts,()=>v.raw[calls++%v.raw.length]!);
   expect([r.SuccessCount,r.NextTriggerCount,r.CandidateCount,calls],JSON.stringify(v)).toEqual([v.success,v.next,v.candidates,v.draws]);}
  for(const v of oracle.uniform){let calls=0;const u=nativePrdUniform(()=>v.raw[calls++]!);expect(u).toBe(v.value);expect(calls).toBe(v.draws);expect(u).toBeGreaterThan(0);expect(u).toBeLessThan(1);}
 });
 it('retains the independently native-checked float32 chance quantizer',()=>{
  for(const v of oracle.quantize)expect(prdChance(v.C,v.counter),JSON.stringify(v)).toBe(v.value);
 });
 it('public P wrapper supplies the native routine with C and preserves zero-attempt state',()=>{
  const g=makeRand15(516),h=makeRand15(516),r=nativeRollPRDBatch(.3,2,41,g),q=nativePrdBatchCoefficient(CfromP(.3),2,41,()=>rand15(h));
  expect(r).toEqual({Triggered:q.Triggered,SuccessCount:q.SuccessCount,NextTriggerCount:q.NextTriggerCount});expect(g).toEqual(h);
  const before=g.state;expect(nativeRollPRDBatch(NaN,-3,0,g)).toEqual({Triggered:false,SuccessCount:0,NextTriggerCount:-3});expect(g.state).toBe(before);
 });
 it('records why the distribution-only shortcut cannot claim native sequence parity',()=>{
  const old=makeRand15(3),native=makeRand15(3),actual=makeRand15(3);legacyDistributionBatch(.3,1,1,()=>rand15(old));
  const expected=nativeRollPRDBatch(.3,1,1,native);expect(RollPRDBatch(.3,1,1,actual)).toEqual(expected);expect(actual.state).toBe(native.state);expect(old.state).not.toBe(native.state);
 });
});
