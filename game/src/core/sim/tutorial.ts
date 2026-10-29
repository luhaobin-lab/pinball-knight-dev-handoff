import type { World } from './world.ts';
/** Source widget boundary; tutorial owns the once-only state and UI view. */
export function tutorialTip(w:World,n:number):void{(w.sys.tutorial as typeof w.sys.tutorial&{showTip?(w:World,n:number):void}).showTip?.(w,n);}
export function hideTutorial(w:World):void{(w.sys.tutorial as typeof w.sys.tutorial&{hideTip?(w:World):void}).hideTip?.(w);}
