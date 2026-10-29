import { CraftPage, type CraftPageModel } from '../../../ui/pages/craft/page';
import { synced, type PageBinding } from '../page-model';
import { 数据表_材料 } from '../../../content/demo/tables';
import { ITEM_ROWS, itemIcon } from '../../../procgen/icons';
const sprite=(row:string)=> (ITEM_ROWS as readonly string[]).includes(row)?itemIcon(row,32):undefined;

const empty:CraftPageModel={title:'制造',selected:'',quality:1,price:0,canCraft:false,canIncrease:false,canDecrease:false,recipes:[],materials:[],requirements:[],inputs:[],outputs:[]};
const binding:PageBinding={id:'craft',modal:false,match:v=>!!v.craft||!!v.materialsPage,live:host=>{
  let current:CraftPageModel=empty;
  const page=new CraftPage(host.font,empty,i=>{if(i.kind==='close')host.send({type:'page.close'});else if(i.kind==='select')host.send({type:'craft.select',recipe:i.recipe});else if(i.kind==='quality')host.send({type:'craft.quality',delta:i.delta});else if(i.kind==='put')host.send({type:'craft.put',item:i.item});else if(i.kind==='take')host.send({type:'craft.take',item:i.item});else if(i.kind==='craft')host.send({type:'item.craft',recipe:current.selected,count:1});});
  return synced(page,v=>{
    const c=v.craft;
    current=c?{title:'制造',selected:c.selected??'',quality:c.outputQuality,price:c.price,canCraft:c.canCraft,canIncrease:c.canIncrease,canDecrease:c.canDecrease,recipes:c.groups.flatMap(g=>g.rows.map(r=>({...r,group:g.label}))),materials:c.materials,requirements:c.requirements.map(r=>({...r,item:r.candidates[0]?.id??null})),inputs:c.inputs,outputs:c.outputs}
      :{...empty,title:'材料',materialsOnly:true,materials:Object.entries(数据表_材料.rows).map(([row,m])=>({label:m.显示名.zh,have:v.inventory.materials[row]??0,need:0}))};
    current={...current,outputIcon:sprite(current.selected),requirements:current.requirements.map(r=>({...r,icon:sprite(r.row)})),outputs:current.outputs.map(r=>({...r,icon:sprite(r.row)}))};return current;
  });
}};
export default binding;
