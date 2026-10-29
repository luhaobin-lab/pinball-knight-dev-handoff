import { type ScreenController, type ScreenDeps } from './controller';
import { CampStage } from '../room/camp';

/** UI_关卡地图页面 next to the HUD's side panel (the backpack stays reachable on the map). */
export const mapScreen = (deps: ScreenDeps): ScreenController => {
 let camp:CampStage|null=null;deps.renderer.lighting.background.set('#06050A');
 return{screen:'map',hud:true,stage:null,update(v,dt){if(v.camp){camp??=new CampStage(deps.renderer,deps.seed);camp.update(v,dt);}else if(camp){camp.dispose();camp=null;}},event(){},exit(){camp?.dispose();camp=null;}};
};
