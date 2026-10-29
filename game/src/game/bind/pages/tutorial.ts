import { TutorialPage } from '../../../ui/pages/tutorial/page';
import { synced,type PageBinding } from '../page-model';
const binding:PageBinding={id:'tutorial',modal:true,match:v=>!!v.tutorial,live:host=>{const p=new TutorialPage(host.font,{tip:0,title:'',text:''},kind=>host.send({type:kind==='continue'?'tutorial.continue':'tutorial.close'}));return synced(p,v=>v.tutorial??{tip:0,title:'',text:''});}};
export default binding;
