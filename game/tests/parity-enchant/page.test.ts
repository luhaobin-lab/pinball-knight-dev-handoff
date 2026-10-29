import{it,expect}from'vitest';import{EnchantReplacePage}from'../../src/ui/pages/enchant-replace/page';import type{TextFont}from'../../src/ui/text/font';import{Surface,rect}from'../../src/ui/core/surface';
const font:TextFont={line:16,measure:t=>[...t].length*12,draw(s,t,x,y,style){s.fill(x,y,[...t].length*12,16,style.color);return[...t].length*12}};
it('source replacement anchors beside card, clamps above984units, wraps text and only sends enabled real row clicks',()=>{
 const picks:number[]=[],p=new EnchantReplacePage(font,{anchor:{x:180,y:490},incoming:'此物品造成的伤害增加10%。',current:['提升10伤害。','提升10%充能速度。'],enabled:[0,1]},i=>picks.push(i));p.layout(rect(0,0,960,540));
 const rows=p.optionRects();expect(rows).toHaveLength(2);expect(rows[0].x).toBe(185);expect(rows.at(-1)!.y+rows.at(-1)!.h).toBeLessThanOrEqual(492);
 const c={x:rows[1].x+10,y:rows[1].y+10};p.pointer({kind:'down',...c,button:0});p.pointer({kind:'up',...c,button:0});expect(picks).toEqual([1]);
 p.pointer({kind:'down',x:900,y:40,button:0});p.pointer({kind:'up',x:900,y:40,button:0});expect(picks).toEqual([1]);const surface=new Surface(960,540);p.draw(surface);expect(surface.data.some(v=>v!==0)).toBe(true);
});
