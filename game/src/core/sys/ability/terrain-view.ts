/** Read-only source terrain/indicator projection. View reads never create actors, consume RNG or advance callbacks. */
import type { TerrainView } from '../../api/view.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import type { 结构_地形选取配置 } from '../../../content/demo/types.ts';

/** 技能指示.更新地形预览: half-cell grid snap, replace origins, then select the first legal group. */
export function previewTerrain(world: World, cfg: 结构_地形选取配置, target: Vec3): { config: 结构_地形选取配置; cells: Vec3[] } {
  const snap = 函数库_工具.吸附到网格(world.mode, target, { x: 0, y: 0, z: 0 }, 64);
  const config = { ...cfg, 起点: [{ X: snap.x, Y: snap.y, Z: snap.z }], 格子类: { ...cfg.格子类 } };
  const group = 函数库_工具.选择合法地形(world.mode, config, world.mode).选取到的格子[0];
  return { config, cells: (group?.真实坐标 ?? []).map(p=>({ x:p.X, y:p.Y, z:p.Z })) };
}

export function updateSkillIndicatorTarget(hero: BP_ManeActor, end: Vec3): void {
  const indicator = hero.技能指示 as (BpObject & { 更新地形预览?(target: Vec3): void }) | null;
  if (indicator?.valid) indicator.更新地形预览?.(end);
}

type VisibleSource = BpObject & {
  拥有者?: BP_ManeActor | null;
  所在位置?: Vec3; 剩余回合?: number;
  ug_visual?: { state: NonNullable<TerrainView['state']>; since: number };
  指示类型?: string; 圈大小?: number;
  视觉地块位置?: Vec3[];
  ug_segments?:{from:Vec3;to:Vec3}[];
  初始化完毕?:boolean;
  组件_地刺?:{序列组件:Vec3[];ug_phase:'ready'|'firing'|'sleeping';ug_since:number}|null;
  保护罩尺寸?:number;已拾取?:boolean;
};
export function terrainView(world: World): TerrainView[] {
  const objects = (world as World & { objects?(): readonly BpObject[] }).objects?.() ?? [];
  const terrain: TerrainView[] = [];
  for (const object of objects) {
    if (!object.valid) continue;
    const o = object as VisibleSource;
    const hostile = !!o.拥有者 && o.拥有者 !== world.mode.玩家角色 && o.拥有者.角色类型 !== world.mode.玩家角色?.角色类型;
    if(o.def.path.startsWith('CatapultHero/BP/环境/装饰品/蓝图_装饰品_地刺')&&o.组件_地刺){
      const c=o.组件_地刺,p=o.K2_GetActorLocation();terrain.push({id:o.id,cls:o.def.path,kind:'spikes',cells:c.序列组件.map(q=>[p.x+q.x,p.y+q.y]),
        state:c.ug_phase==='firing'?'erupting':c.ug_phase==='sleeping'?'closing':'warning',startedAt:c.ug_since,hostile:true});
    }else if(o.def.path==='CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_保护罩'){
      const p=o.K2_GetActorLocation(),visual=(o as unknown as {ug_visual:{state:string;since:number;scale:number}}).ug_visual;
      terrain.push({id:o.id,cls:o.def.path,kind:'shield',cells:[[p.x,p.y]],state:visual.state==='ready'?'warning':visual.state as NonNullable<TerrainView['state']>,
        startedAt:visual.since,radius:o.保护罩尺寸??160,visualRadius:(o.保护罩尺寸??160)+(world.mode.玩家角色?.高度??0),scale:visual.scale,hostile:false});
    }else if (o.def.path === 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_岩浆地板' && o.所在位置) {
      terrain.push({ id:o.id, cls:o.def.path, cells:[[o.所在位置.x,o.所在位置.y]], kind:'lava', state:o.ug_visual?.state ?? 'hidden', startedAt:o.ug_visual?.since ?? 0, turns:o.剩余回合 ?? 0, hostile });
    } else if(o.def.path==='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_酸液池'&&o.所在位置){
      terrain.push({id:o.id,cls:o.def.path,cells:[[o.所在位置.x,o.所在位置.y]],kind:'acid',state:o.ug_visual?.state??'hidden',startedAt:o.ug_visual?.since??0,turns:o.剩余回合??0,hostile});
    } else if(o.def.path==='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_幽魂池'&&o.所在位置){
      const p=o.K2_GetActorLocation();
      terrain.push({id:o.id,cls:o.def.path,cells:[[p.x,p.y]],kind:'ghost',state:o.ug_visual?.state??'hidden',startedAt:o.ug_visual?.since??0,turns:o.剩余回合??0,hostile});
    } else if(o.def.path==='CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_尖刺'){
      const p=o.K2_GetActorLocation();terrain.push({id:o.id,cls:o.def.path,cells:[[p.x,p.y]],kind:'caltrop',state:o.初始化完毕?'active':'spawning'});
    } else if(o.def.path==='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_电网'&&o.ug_segments?.length){
      terrain.push({id:o.id,cls:o.def.path,cells:[],kind:'beam',state:'active',beams:o.ug_segments.map(s=>({from:{...s.from},to:{...s.to}})),hostile:true});
    } else if (o.def.path === 'CatapultHero/BP/交互/技能指示') {
      if (o.指示类型 === '指定位置（固定）') {
        const p = o.K2_GetActorLocation();
        terrain.push({ id:o.id, cls:o.def.path, cells:[[p.x,p.y]], kind:'target', state:'warning', radius:o.圈大小 ?? 0, hostile });
      } else if (o.视觉地块位置?.length) {
        terrain.push({ id:o.id, cls:o.def.path, cells:o.视觉地块位置.map(p=>[p.x,p.y]), kind:'preview', state:'warning', hostile });
      }
    }
  }
  return terrain;
}
