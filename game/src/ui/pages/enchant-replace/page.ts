import{rect,inside,type Rect,type Surface}from'../../core/surface';import{Regions,type Page,type UiPointer}from'../../kit/page';import{drawRich,label,layoutRich}from'../../kit/rich';import{RICH_TALENT,TEXT}from'../../kit/style';import{panel}from'../../kit/widgets';import{BONE,INK}from'../../style/palette';import type{TextFont}from'../../text/font';
export interface EnchantReplaceModel{anchor:{x:number;y:number};incoming:string;current:readonly string[];enabled:readonly number[]}
/** Source550unit window,10/8/10/6 padding, header6pxunit margins, incoming24/6/24/16 and52unit rows.
 * The source page has no cancel button. Clicking a current enchant closes it by replacing that entry.
 */
export class EnchantReplacePage implements Page{
 readonly id='enchant-replace';private model:EnchantReplaceModel;private frame=rect(0,0,960,540);private box=rect(0,0,275,100);private readonly rows=new Regions<number>();private rowRects:Rect[]=[];
 constructor(private readonly font:TextFont,m:EnchantReplaceModel,private readonly pick:(i:number)=>void){this.model=m;this.place();}
 setModel(m:EnchantReplaceModel):void{this.model=m;this.place();}layout(frame:Rect):void{this.frame=frame;this.place();}
 private place():void{const incoming=layoutRich(this.font,`“${this.model.incoming}”`,241);let y=4+this.font.line+6+incoming.h+11;
  const heights=this.model.current.map(t=>Math.max(26,layoutRich(this.font,t,249).h+12)),height=y+heights.reduce((n,h)=>n+h,0)+3;
  const x=Math.max(this.frame.x,Math.min(this.model.anchor.x,this.frame.x+this.frame.w-275)),top=Math.max(this.frame.y,Math.min(this.model.anchor.y,492-height));this.box=rect(x,top,275,height);
  this.rowRects=heights.map(h=>{const r=rect(x+5,top+y,265,h);y+=h;return r});this.rows.set(this.rowRects.map((r,i)=>({rect:r,target:i})));
 }
 draw(s:Surface):void{panel(s,this.box,'tip');label(s,this.font,'选择替换附魔',rect(this.box.x+5,this.box.y+7,265,this.font.line),TEXT.title,'center');const text=layoutRich(this.font,`“${this.model.incoming}”`,241);drawRich(s,this.font,text,rect(this.box.x+17,this.box.y+this.font.line+13,241,text.h),{styles:RICH_TALENT});
  this.rowRects.forEach((r,i)=>{s.fillRect(rect(r.x,r.y+2,r.w,r.h-3),this.rows.hovered===i?INK.raised:INK.deep);s.frame(rect(r.x,r.y+2,r.w,r.h-3),BONE.faint);drawRich(s,this.font,layoutRich(this.font,this.model.current[i]!,249),rect(r.x+8,r.y+6,249,r.h-12),{styles:RICH_TALENT});});}
 hit(x:number,y:number):boolean{return inside(this.box,x,y);}pointer(e:UiPointer):boolean{const i=this.rows.route(e);if(i!==null&&this.model.enabled.includes(i))this.pick(i);return true;}
 optionRects():readonly Rect[]{return this.rowRects;}
}
