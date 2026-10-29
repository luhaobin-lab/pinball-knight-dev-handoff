/** Native sub_1445a65e0: quantized geometric skip with rejection, preserving its raw RNG consumption.
 * The supplied raw generator stands in for CRT rand(). Global stream routing remains a separate parity gap.
 */
import { CfromP, prdChance } from './prd-coefficient.ts';
import { rand15, type Rand15 } from '../rng/ue.ts';

export interface NativePrdResult { Triggered:boolean; SuccessCount:number; NextTriggerCount:number; CandidateCount:number }
const clampI32=(n:number)=>Math.min(2147483647,Math.max(-2147483648,n));

/** sub_1445b3680: exactly three CRT draws form31bits, shifted into the open interval (0,1). */
export function nativePrdUniform(draw:()=>number):number {
  const hi=(draw()&0x7fff)*65536,lo=(draw()&0x7fff)*2,bit=draw()&1;
  return (hi+lo+bit)*4.656612873077393e-10+2.3283064365386963e-10;
}

/** Exposes C, not P, matching the native internal routine ABI used by the binary oracle. */
export function nativePrdBatchCoefficient(C:number,counter:number,attempts:number,draw:()=>number):NativePrdResult {
  const result=(success:number,next:number,candidates=0):NativePrdResult=>({Triggered:success>0,SuccessCount:success,NextTriggerCount:clampI32(next),CandidateCount:candidates});
  if(attempts<=0)return result(0,counter);
  if(!(C>0))return result(0,counter+attempts);
  let n=counter,a=attempts,s=0,candidates=0;
  if(n<1){const skipped=Math.min(a,1-n);n+=skipped;a-=skipped;}
  if(C>1)return result(a,a>0?1:n);
  const blockLimit=Math.min(2147483647,Math.max(1,Math.ceil(1/Math.sqrt(C))));
  while(a>0){
    let block=Math.min(a,blockLimit);
    const bound=prdChance(C,n+block-1),logFailure=bound>=1?0:Math.log1p(-bound);
    while(block>0){
      const skipped=bound>=1?0:Math.floor(Math.log(nativePrdUniform(draw))/logFailure);
      if(skipped>=block){n+=block;a-=block;break;}
      candidates++;n+=skipped;a-=skipped;block-=skipped;
      const chance=prdChance(C,n);
      if(chance>=bound||nativePrdUniform(draw)<chance/bound){s++;n=1;a--;break;}
      a--;n++;block--;
    }
  }
  return result(s,n,candidates);
}

/** Native public wrapper calls CfromP only for positive Attempts, then supplies the native open-interval source. */
export function nativeRollPRDBatch(P:number,counter:number,attempts:number,g:Rand15):Omit<NativePrdResult,'CandidateCount'> {
  const r=nativePrdBatchCoefficient(attempts>0?CfromP(P):0,counter,attempts,()=>rand15(g));
  return {Triggered:r.Triggered,SuccessCount:r.SuccessCount,NextTriggerCount:r.NextTriggerCount};
}
