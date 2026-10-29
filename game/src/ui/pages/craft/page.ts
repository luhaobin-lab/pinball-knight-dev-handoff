import { rect, inside, type Rect, type Surface } from '../../core/surface';
import type { TextFont } from '../../text/font';
import { Regions, type Page, type UiPointer } from '../../kit/page';
import { label } from '../../kit/rich';
import { drawButton, panel, TEXT } from '../../kit';
import { BONE, INK } from '../../style/palette';
import { drawCard } from '../../kit/card';
import type { PixelSprite } from '../../kit/widgets';

export interface CraftPageModel {
  title: string; selected: string; quality: number; price: number; canCraft: boolean; canIncrease: boolean; canDecrease: boolean;
  recipes: readonly { row: string; label: string; unlocked: boolean; group: string }[];
  materials: readonly { label: string; have: number; need: number }[];
  requirements: readonly { row: string; need: number; placed: number; item: number | null; icon?:PixelSprite }[];
  inputs: readonly { id: number; row: string; quality: number }[];
  outputs: readonly { id: number; row: string; quality: number; icon?:PixelSprite }[];
  outputIcon?:PixelSprite;
  materialsOnly?: boolean;
}
export type CraftIntent = {kind:'close'}|{kind:'select';recipe:string}|{kind:'quality';delta:-1|1}|{kind:'craft'}|{kind:'put';item:number}|{kind:'take';item:number};
type Target=CraftIntent|{kind:'scroll';delta:number};
/** Reference screens/layout/craft_page.json rectangles /2 ->960x540; retains approved runtime Ink/Bone skin. */
export const CRAFT = {window:rect(287,11,530,495),close:rect(791,11,22,21),materials:rect(337,93,249,119),ingredients:rect(353,232,218,50),output:rect(420,299,84,125),button:rect(418,432,87,27),recipes:rect(630,82,146,397)};
export class CraftPage implements Page {
  readonly id='craft';private regions=new Regions<Target>();private scroll=0;
  private buttons:{r:Rect;text:string;target:Target;enabled:boolean}[]=[];
  constructor(private font:TextFont,private model:CraftPageModel,private emit:(i:CraftIntent)=>void){this.layout();}
  setModel(m:CraftPageModel):void {this.model=m;this.scroll=Math.min(this.scroll,Math.max(0,m.recipes.length-17));this.layout();}
  layout():void {
    const m=this.model;this.buttons=[{r:CRAFT.close,text:'×',target:{kind:'close'},enabled:true}];
    if(!m.materialsOnly){
      m.recipes.slice(this.scroll,this.scroll+17).forEach((r,i)=>this.buttons.push({r:rect(638,112+i*20,112,18),text:r.label,target:{kind:'select',recipe:r.row},enabled:r.unlocked}));
      this.buttons.push({r:rect(757,90,14,22),text:'▲',target:{kind:'scroll',delta:-8},enabled:this.scroll>0},{r:rect(757,447,14,22),text:'▼',target:{kind:'scroll',delta:8},enabled:this.scroll+17<m.recipes.length});
      // Source ingredient placeholders identify requirements; the actual chosen inventory card is placed via its context menu.
      m.requirements.forEach((r,i)=>this.buttons.push({r:rect(CRAFT.ingredients.x+i*72,CRAFT.ingredients.y,68,48),text:r.row+' '+r.placed+'/'+r.need,target:{kind:'put',item:r.item??-1},enabled:false}));
      m.inputs.forEach((r,i)=>this.buttons.push({r:rect(353+i*72,286,68,16),text:'取回 '+r.row,target:{kind:'take',item:r.id},enabled:true}));
      m.outputs.forEach((r,i)=>this.buttons.push({r:rect(CRAFT.output.x,CRAFT.output.y+i*40,CRAFT.output.w,36),text:r.row+' '+r.quality+'阶',target:{kind:'take',item:r.id},enabled:true}));
      this.buttons.push({r:CRAFT.button,text:'制造 '+m.price,target:{kind:'craft'},enabled:m.canCraft},{r:rect(391,400,24,20),text:'−',target:{kind:'quality',delta:-1},enabled:m.canDecrease},{r:rect(509,400,24,20),text:'+',target:{kind:'quality',delta:1},enabled:m.canIncrease});
    }
    this.regions.set(this.buttons.filter(b=>b.enabled).map(b=>({rect:b.r,target:b.target})));
  }
  draw(s:Surface):void {
    panel(s,CRAFT.window,'window');label(s,this.font,this.model.title,rect(300,14,480,22),TEXT.title,'center');
    this.model.materials.forEach((m,i)=>{const r=rect(CRAFT.materials.x+(i%4)*62,CRAFT.materials.y+Math.floor(i/4)*55,58,49);s.fillRect(r,INK.base);s.frame(r,BONE.faint);label(s,this.font,m.label,rect(r.x+2,r.y+2,r.w-4,18),TEXT.body,'center');label(s,this.font,m.need>0?m.have+'/'+m.need:String(m.have),rect(r.x+2,r.y+24,r.w-4,18),m.have<m.need?TEXT.disabled:TEXT.body,'center');});
    if(!this.model.materialsOnly){panel(s,CRAFT.recipes,'window');label(s,this.font,'配方',rect(638,88,110,20),TEXT.title,'center');label(s,this.font,this.model.selected,rect(345,308,235,22),TEXT.body,'center');label(s,this.font,this.model.quality+'阶',rect(420,400,84,20),TEXT.body,'center');}
    for(const b of this.buttons)drawButton(s,this.font,b.r,b.text,b.enabled?'normal':'disabled');
    // Reuse the approved procedural item cards, including source quality frames; no text-only substitute for the item face.
    if(!this.model.materialsOnly){
      for(let i=0;i<this.model.requirements.length;i++){const row=this.model.requirements[i]!,r=rect(CRAFT.ingredients.x+i*72,CRAFT.ingredients.y,68,48);drawCard(s,this.font,r,{icon:row.icon,quality:0});label(s,this.font,row.placed+'/'+row.need,rect(r.x+40,r.y+30,26,16),TEXT.body,'right');}
      if(!this.model.outputs.length&&this.model.selected)drawCard(s,this.font,rect(CRAFT.output.x,CRAFT.output.y,CRAFT.output.w,38),{icon:this.model.outputIcon,quality:Math.max(0,Math.min(3,this.model.quality-1)) as 0|1|2|3});
      this.model.outputs.forEach((row,i)=>drawCard(s,this.font,rect(CRAFT.output.x,CRAFT.output.y+i*40,CRAFT.output.w,36),{icon:row.icon,quality:Math.max(0,Math.min(3,row.quality-1)) as 0|1|2|3}));
    }
  }
  hit(x:number,y:number):boolean{return inside(CRAFT.window,x,y);}
  pointer(e:UiPointer):boolean{const t=this.regions.route(e);if(t){if(t.kind==='scroll'){this.scroll=Math.max(0,Math.min(Math.max(0,this.model.recipes.length-17),this.scroll+t.delta));this.layout();}else this.emit(t);}return this.hit(e.x,e.y);}
}
