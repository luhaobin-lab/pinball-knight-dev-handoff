import { rect, inside, type Rect, type Surface } from '../../core/surface';
import { Regions, type Page, type UiPointer } from '../../kit/page';
import type { TextFont } from '../../text/font';
import { drawCard } from '../../kit/card';
import { label } from '../../kit/rich';
import { panel, drawButton, TEXT } from '../../kit';
import { BONE, INK } from '../../style/palette';
import { drawGlyphIn } from '../../style/glyphs';
import type { PixelSprite } from '../../kit/widgets';

/** statue_stash f083 measured cell78px at1080p; source CDO upper bounds create 14 columns x10 rows. */
export const STASH_UI = { x:347, y:93, cell:39, rows:10, cols:14, close:rect(875,17,20,20) };
export interface StashCell { id:number;name:string;row:number;col:number;size:number;quality:number;icon?:PixelSprite }
export interface StashModel { cells:readonly StashCell[] }
export const stashRect=(c:{row:number;col:number;size:number}):Rect=>rect(STASH_UI.x+c.col*39+2,STASH_UI.y+c.row*39+2,74,c.size*39-4);
export function stashHit(model:StashModel,x:number,y:number):string|null {
  for(const c of model.cells)if(c.name!=='锁定格'&&inside(stashRect(c),x,y))return'item:'+c.id;
  const row=Math.floor((y-STASH_UI.y)/39),col=Math.floor((x-STASH_UI.x)/39);
  return row>=0&&row<10&&col>=0&&col<14?`slot:stash:${row}:${col}`:null;
}
export class StashPage implements Page {
  readonly id='stash';private regions=new Regions<'close'>();
  constructor(private font:TextFont,private model:StashModel,private close:()=>void){this.layout();}
  setModel(m:StashModel):void{this.model=m;}
  layout():void{this.regions.set([{rect:STASH_UI.close,target:'close'}]);}
  draw(s:Surface):void{
    panel(s,rect(287,11,616,495),'window');label(s,this.font,'永恒神像',rect(306,16,552,22),TEXT.title,'center');
    label(s,this.font,'置入的物品会永久保留。',rect(347,51,546,28),TEXT.body,'center');
    for(let r=0;r<10;r++)for(let c=0;c<14;c++){const q=rect(STASH_UI.x+c*39+2,STASH_UI.y+r*39+2,35,35);s.fillRect(q,INK.base);s.frame(q,BONE.faint);}
    for(const c of this.model.cells){const q=stashRect(c);if(c.name==='锁定格'){
      s.fillRect(q,INK.base);s.frame(q,BONE.faint);s.line(q.x,q.y,q.x+q.w-1,q.y+q.h-1,BONE.faint);s.line(q.x+q.w-1,q.y,q.x,q.y+q.h-1,BONE.faint);
      drawGlyphIn(s,'lock',rect(q.x+29,q.y+29,16,16),{main:BONE.dim});
    }else drawCard(s,this.font,q,{icon:c.icon,quality:Math.max(0,Math.min(3,c.quality-1))as 0|1|2|3});}
    drawButton(s,this.font,STASH_UI.close,'×','normal');
  }
  hit(x:number,y:number):boolean{return inside(STASH_UI.close,x,y);}
  pointer(e:UiPointer):boolean{if(this.regions.route(e)==='close')this.close();return this.hit(e.x,e.y);}
}
