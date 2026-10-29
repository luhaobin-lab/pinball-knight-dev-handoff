import * as THREE from 'three';
import type { PassContext, PixelRenderer, PointLight } from '../../render/api';
import { buildRoom, type BuiltRoom } from '../../procgen/architecture/room';
import { obliqueCamera, obliqueProject, TILE_PX } from '../../procgen/architecture/framing';
import { B1_LIGHT, RAMPS } from '../../procgen/architecture/palette';
import { createToonMaterial } from '../../render/api';
import { samplePlayback, type ActorView as FieldActorView, type GameView, type LaunchPreview, type PresentEvent } from '../api';
import type { PixelCanvas } from '../overlay';
import { drawLaunchPreview } from '../launch-preview';
import { PreviewPulse } from '../preview-pulse';
import { KNIGHT_BOX } from '../reference-room';
import { createActorView, createHeroView, type ActorView } from '../views/actors';
import { PLAY_CX } from '../play-area';
import { roomFrame, roomSpec, type RoomFrame } from './build';
import { TerrainStage } from './terrain';
import { ProjectileStage } from './projectiles';
import { SkillEffects } from './skill-effects';
import {FieldEffects}from'./field-effects';
import { FogStage } from './fog';
import type { SkillPreview, TerrainView } from '../api';
import { INK, WHITE } from '../overlay';

/**
 * The 3D room of the `room` screen: the crypt kit room built from `view.room`, one actor view per field actor
 * (positions from state; the hero's from the launch playback while it runs), the reactions from the presentation
 * events, and the aim preview of `game.preview` on the pixel overlay.
 */

/**
 * The area the room is fitted into (internal px, 960×540): symmetric about `PLAY_CX` up to the right edge (it stays
 * clear of the HUD column, which ends at 178.5), `PLAY_MARGIN` px clear of every edge, at a whole number of internal
 * pixels per floor tile (never below the kit's `TILE_PX`).
 */
export const PLAY_AREA = { x0: 2 * PLAY_CX - 960, y0: 0, x1: 960, y1: 540 };
const PLAY_MARGIN = 6;

export interface Area {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * Whole internal px per tile for a box of `size` (internal px at `TILE_PX`) in `area`: `contain` fits it `PLAY_MARGIN`
 * px clear of every edge, `cover` fills the area edge to edge (cropping the box). Never below `TILE_PX`.
 */
export function fitTilePx(size: { w: number; h: number }, area: Area = PLAY_AREA, mode: 'contain' | 'cover' = 'contain'): number {
  const m = mode === 'contain' ? PLAY_MARGIN : 0;
  const sx = (area.x1 - area.x0 - 2 * m) / size.w;
  const sy = (area.y1 - area.y0 - 2 * m) / size.h;
  const k = mode === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
  return Math.max(TILE_PX, mode === 'contain' ? Math.floor(TILE_PX * k) : Math.ceil(TILE_PX * k));
}

/**
 * Aims the oblique camera so `group`'s screen box (walls and wall-top props included) is centred in `area` at the
 * `fitTilePx` zoom; the target lands on whole pixels of the zoomed grid.
 */
export function fitRoomCamera(renderer: PixelRenderer, group: THREE.Object3D, area: Area, mode: 'contain' | 'cover'): { ppt: number; target: { x: number; z: number } } {
  const box = new THREE.Box3().setFromObject(group);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const q = obliqueProject(renderer, 0, 0, { x, y, z });
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
  }
  const ppt = fitTilePx({ w: x1 - x0, h: y1 - y0 }, area, mode);
  const W = renderer.internal.width / 2, H = renderer.internal.height / 2;
  // the box centre in tiles from a zero target at zoom 1, minus the area centre's offset at the fitted zoom
  const tx = ((x0 + x1) / 2 - W) / TILE_PX - ((area.x0 + area.x1) / 2 - W) / ppt;
  const tz = ((y0 + y1) / 2 - H) / TILE_PX - ((area.y0 + area.y1) / 2 - H) / ppt;
  return { ppt, target: aimOblique(renderer, tx, tz, ppt) };
}

/**
 * Points the oblique camera at target (x, z) (tiles, rounded to whole pixels of the `ppt` grid) at `ppt` internal px
 * per tile; returns the rounded target.
 */
export function aimOblique(renderer: PixelRenderer, x: number, z: number, ppt: number): { x: number; z: number } {
  const target = { x: Math.round(x * ppt) / ppt, z: Math.round(z * ppt) / ppt };
  obliqueCamera(renderer, target.x, target.z);
  // obliqueCamera rounds to the zoom-1 grid: re-aim on the fitted grid, then zoom in
  renderer.camera.position.x += target.x - Math.round(target.x * TILE_PX) / TILE_PX;
  renderer.camera.position.z += target.z - Math.round(target.z * TILE_PX) / TILE_PX;
  renderer.camera.zoom = ppt / TILE_PX;
  renderer.camera.updateProjectionMatrix();
  return target;
}

/** The target that puts floor point (x, z) (tiles) at internal pixel (px, py) at `ppt` px per tile. */
export function obliqueTargetAt(renderer: PixelRenderer, x: number, z: number, px: number, py: number, ppt: number): { x: number; z: number } {
  return { x: x - (px - renderer.internal.width / 2) / ppt, z: z - (py - renderer.internal.height / 2) / ppt };
}

export interface StageMark {
  readonly id: number;
  readonly at: { x: number; y: number; z: number };
  readonly head: { x: number; y: number; z: number };
  readonly hp: number;
  readonly hpMax: number;
  readonly intent: number | null;
}

/** UI_意图提示's number: the intent text's value (e.g. "14"), null when it shows none. */
export function intentValue(text: string): number | null {
  const m = /-?\d+/.exec(text);
  return m ? Number(m[0]) : null;
}

/** The crypt kit's B1 lighting (the room screen and the title's key art). */
export function applyCryptLight(renderer: PixelRenderer): void {
  const L = renderer.lighting;
  L.background.set(B1_LIGHT.void);
  L.ambientSky.set(B1_LIGHT.ambientSky);
  L.ambientGround.set(B1_LIGHT.ambientGround);
  L.ambientIntensity = 4.4;
  L.keyColor.set(B1_LIGHT.god);
  L.keyDirection.set(-0.19, 0.67, -0.72);
  L.keyIntensity = 0.06;
  L.tint = 0.6;
}

export class RoomStage {
  readonly frame: RoomFrame;
  private readonly room: BuiltRoom;
  private readonly lights: PointLight[];
  private readonly actors = new Map<number, ActorView>();
  private readonly solidViews = new Map<string, ActorView>();
  private authoredEdges:THREE.InstancedMesh|null=null;
  private authoredEdgeKey='';
  private solidId = -1;
  private readonly pulse = new PreviewPulse();
  private preview: LaunchPreview | null = null;
  private heroUu = { x: 0, y: 0 };
  private time = 0;
  private readonly terrainStage: TerrainStage;
  private readonly projectileStage: ProjectileStage;
  private readonly skillEffects:SkillEffects;
  private readonly fieldEffects:FieldEffects;
  private readonly fog: FogStage;
  private groundWarnings: readonly TerrainView[] = [];
  private skillPreview: SkillPreview | null = null;
  private shopLabels: readonly FieldActorView[] = [];
  /** Camera target (tiles). */
  readonly target: { x: number; z: number };
  /** Internal pixels per floor tile at the fitted zoom. */
  readonly ppt: number;

  constructor(
    private readonly renderer: PixelRenderer,
    view: GameView,
    seed: number,
  ) {
    const plan = view.room!;
    this.frame = roomFrame(plan);
    this.fog = new FogStage(this.frame); renderer.scene.add(this.fog.mesh);
    this.terrainStage = new TerrainStage(this.frame);
    renderer.scene.add(this.terrainStage.group);
    this.room = buildRoom(roomSpec(plan, seed));
    renderer.scene.add(this.room.group);
    this.lights = this.room.lights.map(l => renderer.addPointLight(l));
    applyCryptLight(renderer);
    const fit = fitRoomCamera(renderer, this.room.group, PLAY_AREA, 'contain');
    this.projectileStage = new ProjectileStage(this.frame, fit.ppt);
    renderer.scene.add(this.projectileStage.group);
    this.skillEffects=new SkillEffects(this.frame,fit.ppt);renderer.scene.add(this.skillEffects.group);
    this.fieldEffects=new FieldEffects(this.frame,fit.ppt);renderer.scene.add(this.fieldEffects.group);
    this.ppt = fit.ppt;
    this.target = fit.target;
    this.sync(view, 0);
  }

  get heroPosition(): { x: number; y: number } {
    return this.heroUu;
  }

  setPreview(p: LaunchPreview | null): void {
    this.preview = p;
  }
  setSkillPreview(p: SkillPreview | null): void { this.skillPreview = p; }

  /** The hero comes from its independent slice; field actors and enemy corpses keep their own lifetimes. */
  sync(view: GameView, dt: number): void {
    this.shopLabels=view.field.filter(a=>a.shopPrice!==undefined&&a.shopPriceAt&&!a.hidden);
    this.time += dt;
    this.syncSolids(view);
    this.fog.sync(view.fog);
    this.terrainStage.sync(view.terrain,view.time);
    this.projectileStage.sync(view.projectiles,view.time,this.renderer.internal.width,this.renderer.internal.height);
    this.fieldEffects.sync(view.fieldEffects??[],view.time,this.renderer.internal.width,this.renderer.internal.height);
    this.groundWarnings=view.terrain.filter(t=>t.kind==='preview'||t.kind==='target');
    const seen = new Set<number>();
    const hero = view.hero;
    this.heroId = hero?.id ?? null;
    if (hero) {
      seen.add(hero.id);
      if (!this.actors.has(hero.id)) {
        const v = createHeroView(hero.id, this.renderer);
        this.renderer.scene.add(v.group);
        this.actors.set(hero.id, v);
      }
    }
    for (const a of view.field) {
      if (a.kind === 'hero') continue; // the hero slice is authoritative, including legacy views that list it twice
      seen.add(a.id);
      const v = this.actors.get(a.id) ?? this.spawn(a);
      if (!v.dead) {
        const t = this.frame.toTiles(a.position.x, a.position.y);
        v.place(t.x, t.z);
      }
      if (a.hp <= 0 && (a.kind === 'enemy' || a.kind === 'boss')) this.die(v);
    }
    // Pickups are an independent core view slice, like the hero. Retire consumed/expired pickups on its next update.
    for (const p of view.pickups) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const v = this.actors.get(p.id) ?? this.spawn({
        id: p.id, row: p.row, kind: 'pickup', table: '', position: p.position,
        radius: 50, height: 0, hidden: false, hp: 1, maxHp: 1, armor: 0, intent: null, statuses: [], elite: false, boss: false,
      });
      const t = this.frame.toTiles(p.position.x, p.position.y);
      v.place(t.x, t.z);
    }
    for (const [id, v] of this.actors) {
      if (!seen.has(id) && (!v.dead || v.kind === 'hero')) {
        v.dispose();
        this.actors.delete(id);
      }
    }
    if (hero) {
      const launch = view.launch;
      const p = launch ? samplePlayback(launch.playback, view.time - launch.startedAt).position : { x: hero.position.x, y: hero.position.y };
      this.heroUu = p;
      const hv = this.actors.get(hero.id);
      if (hv) {
        const t = this.frame.toTiles(p.x, p.y);
        hv.place(t.x, t.z);
      }
    }
    const hv = hero ? this.actors.get(hero.id) : undefined;
    for (const v of this.actors.values()) {
      if (hv && v !== hv && v.kind === 'mob') v.lookAt(hv.x, hv.z);
      v.update(dt, this.renderer.camera, view.time);
    }
    this.skillEffects.sync(view,this.renderer.camera,id=>this.actors.get(id),this.renderer.internal.width,this.renderer.internal.height);
    if (this.preview) this.pulse.update(dt, this.preview.pulse);
    const fireAt = hv ? [{ x: hv.x, y: 1.5, z: hv.z, reach: 2.8 }] : [];
    this.room.setFires(fireAt);
    this.room.update(this.renderer.time, dt);
  }

  /** Visible G2 rock placeholders share the exact footprint of the core's live wall boxes. */
  private syncSolids(view: GameView): void {
    const edges=view.room?.authoredEdges??[],edgeKey=JSON.stringify(edges);
    if(edgeKey!==this.authoredEdgeKey){
      if(this.authoredEdges){this.authoredEdges.removeFromParent();this.authoredEdges.geometry.dispose();(this.authoredEdges.material as THREE.Material).dispose();this.authoredEdges.dispose();}
      this.authoredEdgeKey=edgeKey;this.authoredEdges=null;
      if(edges.length){
        const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),createToonMaterial({ramp:RAMPS.slab,outline:true}),edges.length),matrix=new THREE.Matrix4();
        edges.forEach(([x0,y0,x1,y1],i)=>{const a=this.frame.toTiles(x0,y0),b=this.frame.toTiles(x1,y1),dx=b.x-a.x,dz=b.z-a.z;
          matrix.compose(new THREE.Vector3((a.x+b.x)/2,.08,(a.z+b.z)/2),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.atan2(dz,dx)),new THREE.Vector3(Math.hypot(dx,dz),.16,.04));mesh.setMatrixAt(i,matrix);});
        mesh.name='AuthoredBackdropEdgeApproximation';mesh.frustumCulled=false;this.renderer.scene.add(mesh);this.authoredEdges=mesh;
      }
    }
    const seen = new Set<string>();
    for (const s of view.room?.solids ?? []) {
      if (s.kind !== 'box' || !s.half || s.hidden) continue;
      const key = JSON.stringify([s.at, s.half, s.angle, s.tags]);
      if (seen.has(key)) continue;
      seen.add(key);
      let v = this.solidViews.get(key);
      if (!v) {
        v = createActorView({ id: this.solidId--, kind: 'terrain', row: '石墙', radius: Math.max(s.half.x, s.half.y), height: 100, elite: false }, this.renderer);
        this.solidViews.set(key, v);
        this.renderer.scene.add(v.group);
        const diameter = Math.max(1e-6, v.radius * 2);
        // roomFrame maps sourceUE+Y to renderX andUE+X to render−Z; keep obstacle footprint on its actual collider.
        v.group.scale.set((s.half.y * 2 / 64) / diameter, 1, (s.half.x * 2 / 64) / diameter);
        v.group.rotation.y=-(s.angle??0);
      }
      const p = this.frame.toTiles(s.at.x, s.at.y);
      v.place(p.x, p.z);
      // The prop kit places its body inside a root at the origin. Scale its footprint around this cell, not (0,0).
      const offset=new THREE.Vector3(p.x*v.group.scale.x,0,p.z*v.group.scale.z).applyAxisAngle(new THREE.Vector3(0,1,0),-(s.angle??0));
      v.group.position.set(p.x-offset.x,0,p.z-offset.z);
      v.update(0, this.renderer.camera, this.time);
    }
    for (const [key, v] of this.solidViews) if (!seen.has(key)) { v.dispose(); this.solidViews.delete(key); }
  }

  private spawn(a: FieldActorView): ActorView {
    const v = createActorView(a, this.renderer);
    this.renderer.scene.add(v.group);
    const t = this.frame.toTiles(a.position.x, a.position.y);
    v.place(t.x, t.z);
    this.actors.set(a.id, v);
    return v;
  }

  private onSplat: ((at: { x: number; z: number }) => void) | null = null;

  setPresentationHooks(onSplat: (at: { x: number; z: number }) => void): void { this.onSplat = onSplat; }

  /** Source planar vectors follow the room transform, just like actor positions. */
  direction(x: number, y: number): { x: number; z: number } {
    const zero = this.frame.toTiles(0, 0), p = this.frame.toTiles(x * 64, y * 64);
    return { x: p.x - zero.x, z: p.z - zero.z };
  }

  private die(v: ActorView | undefined): void {
    if (!v || v.dead) return;
    v.die(() => this.onSplat?.({ x: v.x, z: v.z }));
  }

  /** Plays one presentation event on the actors. */
  event(e: PresentEvent): void {
    this.skillEffects.event(e);
    switch (e.kind) {
      case 'actor.anim':
        this.actors.get(e.id)?.animate?.(e);
        break;
      case 'actor.hit':
        this.actors.get(e.id)?.flash();
        break;
      case 'actor.flash':
        this.actors.get(e.id)?.flash(e.seconds);
        break;
      case 'actor.squash':
        { const n = this.direction(e.normal.x, e.normal.y); this.actors.get(e.id)?.hit(n.x, n.z, e.speed); }
        break;
      case 'actor.die':
        this.die(this.actors.get(e.id));
        break;
      case 'actor.despawn': {
        const v = this.actors.get(e.id);
        if (v) {
          v.dispose();
          this.actors.delete(e.id);
        }
        break;
      }
      case 'launch.start':
        if (e.direction) {
          const h = this.actors.get(e.hero), d = this.direction(e.direction.x, e.direction.y);
          if (h) h.lookAt(h.x + d.x, h.z + d.z);
        }
        this.actors.get(e.hero)?.launch('start');
        break;
      case 'launch.end':
        this.actors.get(e.hero)?.launch('end');
        break;
      case 'launch.contact':
        if (e.contact === 'enemy') this.heroView()?.launch('slash');
        // Flash comes from actor.flash; a wall contact does not manufacture a damage flash.
        break;
      case 'ui': {
        const data = e.data as { id?: number; hidden?: boolean } | undefined;
        if (e.widget === 'actor.corpse' && data?.id !== undefined) this.die(this.actors.get(data.id));
        if (e.widget === 'actor.hidden' && data?.id !== undefined) {
          const v = this.actors.get(data.id); if (v) v.group.visible = !data.hidden;
        }
        break;
      }
      case 'actor.hide': {
        const v = this.actors.get(e.id);
        if (v) v.group.visible = !e.hidden;
        break;
      }
      default:
        break;
    }
  }

  private heroId: number | null = null;

  heroView(): ActorView | undefined {
    return this.heroId === null ? undefined : this.actors.get(this.heroId);
  }

  actor(id: number): ActorView | undefined {
    return this.actors.get(id);
  }

  /** Head bars and intents of the living enemies (UI_头顶状态条, UI_意图提示), in tiles. */
  marks(view: GameView): StageMark[] {
    return view.field
      .filter(a => (a.kind === 'enemy' || a.kind === 'boss') && a.hp > 0)
      .flatMap(a => {
        const v = this.actors.get(a.id);
        if (!v) return [];
        return [{ id: a.id, at: { x: v.x, y: 0, z: v.z + v.radius * 0.9 }, head: { x: v.x, y: v.top, z: v.z }, hp: a.hp, hpMax: a.maxHp, intent: a.intent ? intentValue(a.intent.text) : null }];
      });
  }

  draw(c: PixelCanvas, ctx: PassContext): void {
    this.drawGroundWarnings(c,ctx);
    for(const a of this.shopLabels){const v=a.shopPriceAt!,t=this.frame.toTiles(v.x,v.y),p=ctx.project({x:t.x,y:v.z/64,z:t.z});
      c.number(String(a.shopPrice),Math.round(p.x),Math.round(p.y),WHITE);}
    const p = this.preview;
    if (!p) return;
    drawLaunchPreview(
      c,
      p,
      q => {
        const t = this.frame.toTiles(q.x, q.y);
        return ctx.project({ x: t.x, y: 0, z: t.z });
      },
      { pxPerUu: this.ppt / 64, zoom: this.ppt / TILE_PX, hero: this.heroUu, heroBox: KNIGHT_BOX, pulse: this.pulse, time: this.time },
    );
  }

  private drawGroundWarnings(c:PixelCanvas,ctx:PassContext):void {
    const point=(x:number,y:number)=>{const t=this.frame.toTiles(x,y);return ctx.project({x:t.x,y:.04,z:t.z});};
    const line=(a:{x:number;y:number},b:{x:number;y:number},color:string)=>{c.line(a.x,a.y,b.x,b.y,INK,3);c.line(a.x,a.y,b.x,b.y,color,1);};
    const cells=(list:readonly (readonly[number,number])[],color:string)=>{
      for(const [x,y]of list){const pts=[point(x-32,y-32),point(x+32,y-32),point(x+32,y+32),point(x-32,y+32)];
        for(let i=0;i<4;i++)line(pts[i]!,pts[(i+1)%4]!,color);
      }
    };
    for(const t of this.groundWarnings){
      const color=t.hostile?'#D93A2A':WHITE;
      if(t.kind==='target'&&t.radius&&t.cells[0]){
        const [x,y]=t.cells[0],n=96;
        for(let i=0;i<n;i++){
          const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;
          line(point(x+Math.cos(a)*t.radius,y+Math.sin(a)*t.radius),point(x+Math.cos(b)*t.radius,y+Math.sin(b)*t.radius),color);
        }
      }else cells(t.cells,color);
    }
    if(this.skillPreview?.terrain)cells(this.skillPreview.terrain.map(p=>[p.x,p.y]),WHITE);
  }

  dispose(): void {
    this.fog.dispose();
    this.fieldEffects.dispose();
    this.skillEffects.dispose();
    this.projectileStage.dispose();
    this.terrainStage.dispose();
    for (const v of this.solidViews.values()) v.dispose();
    this.solidViews.clear();
    if(this.authoredEdges){this.authoredEdges.removeFromParent();this.authoredEdges.geometry.dispose();(this.authoredEdges.material as THREE.Material).dispose();this.authoredEdges.dispose();this.authoredEdges=null;}
    for (const v of this.actors.values()) v.dispose();
    this.actors.clear();
    for (const l of this.lights) this.renderer.removeLight(l);
    this.room.group.removeFromParent();
    this.room.dispose();
  }
}
