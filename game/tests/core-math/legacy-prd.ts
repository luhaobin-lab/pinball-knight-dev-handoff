/** Historical distribution-only implementation from bfdf87e. Test comparison only; never imported by runtime. */
import{CfromP,successCount}from'../../src/core/math/prd-coefficient.ts';
const clampI32=(x:number)=>Math.max(-2147483648,Math.min(2147483647,x));
export function legacyDistributionBatch(P: number, TriggerCount: number, Attempts: number, draw: () => number): { Triggered: boolean; SuccessCount: number; NextTriggerCount: number } {
  if (Attempts <= 0) return { Triggered: false, SuccessCount: 0, NextTriggerCount: TriggerCount };
  const C = CfromP(P);
  if (!(C > 0)) return { Triggered: false, SuccessCount: 0, NextTriggerCount: clampI32(TriggerCount + Attempts) };
  let n = TriggerCount;
  let a = Attempts;
  let s = 0;
  if (n < 1) {
    const d = Math.min(a, 1 - n);
    n += d;
    a -= d;
  }
  if (C > 1) return { Triggered: a > 0, SuccessCount: a, NextTriggerCount: a > 0 ? 1 : clampI32(n) };
  while (a > 0) {
    if (draw() < successCount(n * C)) { s++; n = 1; } else n++;
    a--;
  }
  return { Triggered: s > 0, SuccessCount: s, NextTriggerCount: clampI32(n) };
}
