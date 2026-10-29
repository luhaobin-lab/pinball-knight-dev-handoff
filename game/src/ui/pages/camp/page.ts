import { rect, type Surface } from '../../core/surface';
import { Regions, type Page, type UiPointer } from '../../kit/page';
import { label } from '../../kit/rich';
import { TEXT } from '../../kit';
import type { TextFont } from '../../text/font';
/** Reference statue_room exact1080p footprints /2. The procedural scene uses these same anchors. */
export const CAMP_UI={statue:rect(560,67,128,220),portals:[rect(596,300,56,102),rect(428,140,56,102),rect(764,140,56,102)]};
export interface CampModel{unlocked:boolean;options:readonly string[]}
export class CampPage implements Page{
 readonly id='camp';private regions=new Regions<string>();
 constructor(private font:TextFont,private model:CampModel,private emit:(target:string)=>void){this.layout();}
 setModel(m:CampModel):void{this.model=m;this.layout();}
 layout():void{this.regions.set([{rect:CAMP_UI.statue,target:'statue'},...this.model.options.slice(0,3).map((name,i)=>({rect:CAMP_UI.portals[i],target:name}))]);}
 hit(x:number,y:number):boolean{return this.regions.at(x,y)!==null;}
 pointer(e:UiPointer):boolean{const t=this.regions.route(e);if(t)this.emit(t);return this.hit(e.x,e.y);}
 draw(s:Surface):void{
  if(this.regions.hovered==='statue'){
   label(s,this.font,this.model.unlocked?'永恒神像':'破损的神像',rect(540,242,168,22),TEXT.body,'center');
   label(s,this.font,this.model.unlocked?'祈祷获取永恒的庇护。':'无法祈祷，需要修复。',rect(504,266,240,22),TEXT.body,'center');
  }
  this.model.options.slice(0,3).forEach((name,i)=>label(s,this.font,name,rect(CAMP_UI.portals[i].x-35,CAMP_UI.portals[i].y+102,125,24),TEXT.title,'center'));
 }
}
