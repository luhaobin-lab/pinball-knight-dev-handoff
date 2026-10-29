/**
 * The game view (ARCHITECTURE Appendix A.8 with WAVE_A §3.1, §3.3, §3.8): plain data the shell, the UI and the bot read.
 * Each system module contributes its slice (§6.5). Contract file of core-contracts.
 */
import type { LaunchPlayback } from '../launch/index.ts';
import type { 枚举_环节 } from '../../content/demo/types.ts';
import type { AssetPath, Vec3 } from '../sim/types.ts';

export type Screen = 'title' | 'heroSelect' | 'map' | 'room' | 'runEnd';

export interface GameView {
  readonly tutorial?:TutorialView|null;
  readonly screen: Screen;
  readonly phase: 枚举_环节;
  /** 玩家可与环境交互？ */
  readonly inputOpen: boolean;
  readonly modal: ModalView | null;
  readonly title: TitleView | null;
  readonly heroSelect: HeroSelectView | null;
  readonly run: RunView | null;
  readonly hero: HeroView | null;
  /** 场上所有, in Demo order. */
  readonly field: readonly ActorView[];
  readonly pickups: readonly { id: number; row: string; position: Vec3 }[];
  readonly terrain: readonly TerrainView[];
  readonly projectiles: readonly ProjectileView[];
  readonly afterimages?:readonly AfterimageView[];
  readonly fieldEffects?:readonly FieldEffectView[];
  /** The RoomPlan of core-map (WAVE_A §3.8). */
  readonly room: RoomPlan | null;
  /** Source RT_战争迷雾: canonical full linear-red rows; presentation never writes exploration. */
  readonly fog?: FogView | null;
  readonly map: MapView | null;
  readonly inventory: InventoryView;
  readonly launch: { playback: LaunchPlayback; startedAt: number } | null;
  readonly log: readonly { t: number; rich: string }[];
  readonly time: number;
  readonly craft?: CraftView | null;
  readonly materialsPage?: boolean;
  readonly camp?: { readonly title: string; readonly statue: { readonly id: number; readonly unlocked: boolean };readonly portals?:readonly {id:number;option:string;size:number;wpo:number;enabled:boolean}[] } | null;
  readonly stash?: { readonly rows: number; readonly cols: number; readonly cells: readonly { id: number; name: string; row: number; col: number; size: number; quality: number }[] } | null;
}

export interface TutorialView {readonly tip:number;readonly name:string;readonly title:string;readonly text:string;readonly media:string|null}
export interface FogView {
  readonly visible: boolean;
  readonly size: 512;
  readonly extent: 2500;
  readonly height: 200;
  /** Nonzero f32-bit runs per row, base36 start.count.value separated by commas. */
  readonly rows: readonly string[];
}

export interface CraftView {
  readonly groups: readonly { name: string; label: string; rows: readonly { row: string; label: string; unlocked: boolean; supported: boolean }[] }[];
  readonly selected: string | null;
  readonly outputQuality: number;
  readonly extraQuality: number;
  readonly price: number;
  readonly canCraft: boolean;
  readonly canIncrease: boolean;
  readonly canDecrease: boolean;
  readonly requirements: readonly { row: string; need: number; placed: number; candidates: readonly { id: number; quality: number }[] }[];
  readonly materials: readonly { row: string; label: string; have: number; need: number }[];
  readonly inputs: readonly { id: number; row: string; quality: number }[];
  readonly outputs: readonly { id: number; row: string; quality: number }[];
}

/** UI_营地主菜单 visibility (PROTOTYPE_SCOPE §2): 序幕 always, 新的冒险 after the prologue, 继续冒险 never. */
export interface TitleView {
  readonly prologue: boolean;
  readonly newRun: boolean;
  /** The camp quest bar: 序幕 while 新手关中, else 凝视深渊. */
  readonly quest: { title: string; progress: number; need: number } | null;
}

export interface HeroSelectView {
  readonly heroes: readonly { row: string; unlocked: boolean; unlockText: string | null }[];
  readonly picked: string | null;
}

export interface RunView {
  readonly chapter: string;
  readonly floor: number;
  readonly floors: number;
  readonly quest: readonly { text: string; done: boolean }[];
  readonly turn: number;
  readonly 金币: number;
  readonly 精矿: number;
  readonly 当前腐化: number;
  readonly 最大腐化: number;
  readonly 英雄等级: number;
  readonly 经验: number;
  readonly 升级经验: number;
}

export interface StatusView { readonly name: string; readonly stacks: number; readonly turns: number; readonly icon: string }
export interface FieldEffectView{
 readonly id:number;readonly kind:'orb'|'blackhole'|'lightning';readonly position:Vec3;
 readonly phase:'spawn'|'idle'|'closing'|'hidden'|'active';readonly startedAt:number;readonly phaseAt:number;
 readonly radius:number;readonly duration?:number;readonly range?:number;readonly attractRange?:number;
 readonly end?:Vec3;readonly segments?:number;
}
export interface AfterimageView {
  readonly id:number;readonly owner:number|null;readonly position:Vec3;readonly createdAt:number;
  /** Exact source timeline scalar(track*20); mapping that scalar onto the reskin is presentation. */
  readonly dissolve:number;readonly sequence:string|null;readonly animationAge:number;readonly animationSeconds:number;
  /** Captured source PaperFlipbook.X scale (+1/-1), not an actor yaw. */
  readonly facing:1|-1;readonly ownerHeight:number;
}
export interface ProjectileView {
  readonly id: number; readonly cls: AssetPath; readonly position: Vec3;
  /** Optional for historical shell fixtures. Real runtime projects the actual movement component. */
  readonly velocity?: Vec3; readonly yaw?: number; readonly radius?: number;
  readonly active?: boolean; readonly stopped?: boolean; readonly source?: number | null;
  readonly sourcePosition?: Vec3 | null;
  /** Source activation/stop callback times, never first-observed render times. */
  readonly startedAt?: number; readonly stoppedAt?: number;
}
export interface SkillSlotView { readonly slot: number; readonly row: string; readonly cost: number; readonly cooldown: number; readonly usable: boolean }

export interface HeroView {
  /** Selected non-immediate active; its source indicator receives the next absolute pointer target. */
  readonly selectedSkill?: string | null;
  readonly id: number;
  readonly row: string;
  readonly position: Vec3;
  readonly hp: number; readonly maxHp: number; readonly armor: number;
  /** Authoritative 死掉了; forced source deaths can retain positive HP. Optional for historical view fixtures. */
  readonly dead?: boolean;
  readonly stamina: number; readonly maxStamina: number;
  readonly dot: number;
  readonly statuses: readonly StatusView[];
  readonly skills: readonly SkillSlotView[];
  readonly stats: Readonly<Record<string, number>>;
}
export interface SkillPreview {
  readonly origin: Vec3; readonly end: Vec3; readonly radius: number; readonly row: string;
  readonly indicatorType?: number;
  /** Legal source world-uu cell centres; pure preview does not create or activate terrain. */
  readonly terrain?: readonly Vec3[];
}

export interface TerrainView {
  readonly id: number; readonly cls: AssetPath;
  /** World-uu centres, not RoomPlan cell indices. */
  readonly cells: readonly [number, number][];
  readonly kind?: 'lava' | 'acid' | 'ghost' | 'caltrop' | 'beam' | 'spikes' | 'shield' | 'preview' | 'target';
  readonly state?: 'hidden' | 'spawning' | 'active' | 'warning' | 'erupting' | 'closing';
  readonly startedAt?: number;
  readonly turns?: number;
  readonly hostile?: boolean;
  readonly radius?: number;
  readonly visualRadius?: number;
  readonly scale?: number;
  readonly beams?: readonly { readonly from:Vec3; readonly to:Vec3 }[];
}

export type ActorKind = 'hero' | 'enemy' | 'boss' | 'neutral' | 'card' | 'pickup' | 'terrain' | 'projectile' | 'decoration';

export interface ActorView {
  /** Source UI_商品价格 on a shop shelf; absent once its purchase clears the label. */
  readonly shopPrice?: number;
  readonly shopPriceAt?: Vec3;
  readonly id: number; readonly row: string; readonly table: string; readonly kind: ActorKind;
  readonly position: Vec3; readonly radius: number; readonly height: number; readonly hidden: boolean;
  readonly hp: number; readonly maxHp: number; readonly armor: number;
  readonly intent: { readonly skill: string; readonly target: number | null; readonly text: string } | null;
  readonly statuses: readonly StatusView[];
  readonly elite: boolean; readonly boss: boolean;
}

/** core-map's room plan v0: 5 × 7 tiles of 64 uu (WAVE_A §3.8). */
export interface RoomPlan {
  /** Source custom backgrounds use their exact child-box colliders; cells remain a rendering/walkability raster. */
  readonly authoredBoundary?: boolean;
  readonly authoredEdges?:readonly (readonly [number,number,number,number])[];
  readonly layout: string;
  readonly variant: number;
  readonly cols: number;
  readonly rows: number;
  readonly tile: number;
  /** Lower boundary of grid cell (0, 0), in world uu; omitted legacy fixtures use (0, 0). */
  readonly origin?: { readonly x: number; readonly y: number };
  /** Floor cells as [col, row]. */
  readonly cells: readonly (readonly [number, number])[];
  readonly solids: readonly { kind: 'circle' | 'box'; at: Vec3; radius?: number; half?: { x: number; y: number }; angle?:number; hidden?:boolean; tags: readonly string[] }[];
  readonly decorations: readonly { cls: AssetPath; cell: readonly [number, number]; placement: string }[];
  /** The spawn deck in draw order: actor rows with their table. */
  readonly spawns: readonly { table: string; row: string; at: Vec3 | null }[];
  readonly task: string | null;
  readonly playerSpawn: Vec3;
  readonly background: string | null;
}

export interface MapCellView {
  readonly id: string;
  readonly col: number; readonly row: number;
  readonly tile: string;
  readonly reward: string | null;
  readonly quality: number;
  readonly explored: boolean;
  readonly enterable: boolean;
  readonly boss: boolean;
}
export interface MapView {
  readonly chapter: string;
  readonly floor: number;
  readonly cells: readonly MapCellView[];
  readonly links: readonly (readonly [string, string])[];
  readonly current: string | null;
  readonly stars: number;
  readonly bossNext: boolean;
  /** UI_关卡选项 (e.g. 营地). */
  readonly options: readonly string[];
}

export interface CardView {
  readonly id: number; readonly row: string; readonly quality: number;
  readonly charge: number; readonly chargeMax: number; readonly durability: number | null;
  readonly enchants: readonly string[]; readonly tooltip: readonly string[];
  readonly extractCost?:number;
  /** UI_修炼牌 uses source label tags for value badges and actual ability state for sockets/cooldown. */
  readonly badges?: {readonly damage?:number;readonly heal?:number;readonly armor?:number};
  readonly combo?:number;
  readonly cooldown?:number;
  readonly enchantCount?:number;
  readonly place: { grid: 'equip' | 'backpack' | 'stash' | 'side'; row: number; col: number } | null;
  readonly size: readonly [number, number];
}
export interface InventoryView {
  /** Read-only 修炼系统.背包关闭了 inverse; the presentation follows the source phase transitions. */
  readonly canRearrange?: boolean;
  readonly equip: readonly CardView[];
  readonly backpack: readonly CardView[];
  readonly lockedRows: readonly number[];
  readonly side: readonly CardView[];
  readonly stash?: readonly CardView[];
  readonly materials: Readonly<Record<string, number>>;
}

export interface ChoiceOptionView { readonly row: string; readonly title: string; readonly text: string; readonly level: number; readonly icon: string; readonly price?: number }
export interface LootCellView {
  readonly item: number; readonly row: string; readonly quality: number; readonly taken: boolean;
  readonly size?: 1 | 2 | 3;
  readonly price?: number;
  readonly tooltip?: readonly string[];
  /** Source 更新生成牌站位: column index and cumulative size before this card, retained after other takes. */
  readonly position?: { readonly col: number; readonly row: number };
}

export type MultiChoiceSource = 'levelUp' | 'unique' | 'initialReward' | 'boss' | 'scroll' | 'event' | 'ultimateChoice';

export type ModalView =
  | { kind: 'multiChoice'; source: MultiChoiceSource; title: string; options: readonly ChoiceOptionView[]; reroll: { cost: number; currency: string } | null; canSkip: boolean }
  | { kind: 'loot'; title: string; cells: readonly LootCellView[]; exp: number | null; canTakeAll: boolean;
      reroll?: { readonly cost: number; readonly remaining: number; readonly enabled: boolean } | null }
  | { kind: 'panel'; result: 'victory' | 'failure'; lines: readonly { label: string; value: string }[]; canRetry: boolean;
      /** Source per-character rows, hero then equipped items. Optional for historical view fixtures. */
      characters?: readonly { id: number; kind: 'hero' | 'item'; position: Vec3; width: number;
        stats: Readonly<Partial<Record<'charge' | 'damage' | 'heal' | 'armor', string>>> }[];
      backpackClosed?: boolean }
  | { kind: 'runEnd'; lines: readonly { label: string; value: string }[]; score: number; exploration: { level: number; progress: number; need: number }; demoComplete: boolean }
  /** UI_警告提示: type 0 结束本次探险？ (重置房间（+10腐化） or 保存并退出 / 放弃探险), type 2 resume (回忆 / 遗忘). */
  | { kind: 'warning'; type: 0 | 2; text: string; buttons: readonly [string, string] }
  | { kind: 'enchantReplace'; current: readonly string[]; incoming: string;target?:number;rows?:readonly string[];level?:number };
