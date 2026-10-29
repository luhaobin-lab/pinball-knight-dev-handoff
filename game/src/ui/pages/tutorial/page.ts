import { rect,inside,type Rect,type Surface } from '../../core/surface';
import { Regions,type Page,type UiPointer } from '../../kit/page';
import { drawButton,panel,TEXT } from '../../kit';
import { label } from '../../kit/rich';
import type { TextFont } from '../../text/font';
import { BONE,INK } from '../../style/palette';
import { itemIcon } from '../../icons/items';
export interface TutorialModel {tip:number;title:string;text:string}
export const TUTORIAL={window:rect(318,100,325,325),text:rect(330,111,300,60),media:rect(330,176,300,200),button:rect(379,386,202,31),close:rect(619,101,22,22)};
/** Source650x650unit centre panel with600x400media slot. Procedural instruction stills replace shipped reference movies. */
export class TutorialPage implements Page{
  readonly id='tutorial';private regions=new Regions<'continue'|'close'>();
  constructor(private font:TextFont,private model:TutorialModel,private emit:(s:'continue'|'close')=>void){this.layout();}
  setModel(m:TutorialModel):void{this.model=m;this.layout();}
  layout(_frame?:Rect):void{this.regions.set([{rect:TUTORIAL.button,target:'continue'},{rect:TUTORIAL.close,target:'close'}]);}
  draw(s:Surface):void{panel(s,TUTORIAL.window,'window');label(s,this.font,this.model.title,rect(333,108,282,22),TEXT.title,'center');
    const lines=this.model.text.match(/.{1,22}/g)??[];lines.forEach((t,i)=>label(s,this.font,t,rect(331,134+i*16,298,18),TEXT.body,'center'));
    const r=TUTORIAL.media;s.fillRect(r,INK.deep);s.frame(r,BONE.faint);
    // A small code-generated illustration, tied to the source tip verb, with the approved icon vocabulary.
    const glyph=this.model.tip===1||this.model.tip===2||this.model.tip===9?'sword':this.model.tip===3?'gem':this.model.tip===10?'potion':this.model.tip===8?'scroll':'orb';
    const a=itemIcon(glyph,'consumable',52,52),b=itemIcon(this.model.tip===5?'orb':'shield','armor',52,52);s.blit(a,r.x+45,r.y+66);s.blit(b,r.x+199,r.y+66);s.line(r.x+110,r.y+92,r.x+183,r.y+92,BONE.base);s.line(r.x+174,r.y+85,r.x+183,r.y+92,BONE.base);s.line(r.x+174,r.y+99,r.x+183,r.y+92,BONE.base);
    drawButton(s,this.font,TUTORIAL.button,'明白了','normal');drawButton(s,this.font,TUTORIAL.close,'×','normal');}
  hit(x:number,y:number):boolean{return inside(rect(0,0,960,540),x,y);}
  pointer(e:UiPointer):boolean{const t=this.regions.route(e);if(t)this.emit(t);return true;}
}
