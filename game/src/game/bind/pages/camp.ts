import { CampPage } from '../../../ui/pages/camp/page';
import { synced, type PageBinding } from '../page-model';
import { legalValues } from '../page-model';
const binding:PageBinding={id:'camp',modal:false,match:v=>!!v.camp&&!v.stash&&!v.craft&&!v.materialsPage&&!v.modal,live:host=>{
 const page=new CampPage(host.font,{unlocked:false,options:[]},name=>{if(name==='statue')host.send({type:'camp.statue'});else host.send({type:'camp.travel',option:name});});
 return synced(page,(v,legal)=>({unlocked:v.camp?.statue.unlocked??false,options:legalValues(legal,'camp.travel','option').map(String)}));
}};
export default binding;
