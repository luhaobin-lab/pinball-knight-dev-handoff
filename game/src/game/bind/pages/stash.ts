import { StashPage } from '../../../ui/pages/stash/page';
import { synced, type PageBinding } from '../page-model';
import { ITEM_ROWS, itemIcon } from '../../../procgen/icons';
const binding:PageBinding={id:'stash',modal:false,match:v=>!!v.stash,live:host=>{
 const p=new StashPage(host.font,{cells:[]},()=>host.send({type:'page.close'}));
 return synced(p,v=>({cells:(v.stash?.cells??[]).map(c=>({...c,icon:(ITEM_ROWS as readonly string[]).includes(c.name)?itemIcon(c.name,32):undefined}))}));
}};
export default binding;
