import{EnchantReplacePage,type EnchantReplaceModel}from'../../../ui/pages/enchant-replace/page';import{cardRect}from'../../../ui/hud/cards';import{itemCards}from'../hud';import{synced,type PageBinding,legalValues}from'../page-model';
const binding:PageBinding={id:'enchant-replace',modal:true,match:v=>v.modal?.kind==='enchantReplace',live:host=>{
 const page=new EnchantReplacePage(host.font,{anchor:{x:180,y:120},incoming:'',current:[],enabled:[]},option=>host.send({type:'modal.pick',option}));
 return synced(page,(v,legal):EnchantReplaceModel=>{const m=v.modal;if(m?.kind!=='enchantReplace')return{anchor:{x:180,y:120},incoming:'',current:[],enabled:[]};const card=[...v.inventory.equip,...v.inventory.backpack].find(c=>c.id===m.target),r=card?cardRect(itemCards([card])[0]!):{x:0,y:120,w:180,h:50};
  return{anchor:{x:r.x+r.w+(card?.place?.grid==='equip'?(host.sideOffset?.()??0):0),y:r.y},incoming:m.incoming,current:m.current,enabled:legalValues(legal,'modal.pick','option').filter((i):i is number=>typeof i==='number')};});
}};export default binding;
