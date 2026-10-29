import type { BotCommand, BotGame, BotPreview, BotSpec, BotView } from './api.ts';
import type { BotRng } from './rng.ts';

/** What a policy sees when it must choose: the game, the accepted command specs and its own seeded stream. */
export interface PolicyContext {
  readonly game: BotGame;
  readonly legal: readonly BotSpec[];
  readonly rng: BotRng;
  /** Commands sent so far in this run. */
  readonly step: number;
}

export interface Policy {
  readonly name: string;
  /** The next command, or null when the policy has nothing more to send (a replay log ran out). */
  choose(ctx: PolicyContext): BotCommand | null;
}

export type PolicyName = 'random' | 'scripted' | 'mix' | 'replay';

/**
 * Relative weights per command kind for the random policy (ARCHITECTURE §10.2). Kinds that leave the game or the run
 * get 0 or a small weight so random runs still reach deep floors; anything unlisted gets `DEFAULT_WEIGHT`.
 */
export const RANDOM_WEIGHTS: Readonly<Record<string, number>> = {
  'title.quit': 0,
  'title.settings': 0.2,
  'title.prologue': 1,
  'title.newRun': 4,
  'hero.back': 0.2,
  'hero.pick': 2,
  'hero.start': 4,
  'map.enter': 6,
  'map.backpack': 0.3,
  'map.option': 0.5,
  'aim.release': 10,
  'skill.press': 1,
  'skill.target': 1,
  'skill.cancel': 0.5,
  interact: 3,
  'item.move': 1,
  'item.use': 1,
  'item.dismantle': 0.3,
  'item.combine': 0.3,
  'modal.pick': 4,
  'modal.reroll': 0.5,
  'modal.skip': 0.5,
  'loot.take': 2,
  'loot.takeAll': 3,
  'loot.close': 1,
  'panel.continue': 4,
  'panel.retry': 0.5,
  'menu.open': 0.1,
  'menu.close': 2,
  'menu.resetRoom': 0.05,
  'menu.abandon': 0.01,
  'menu.saveQuit': 0,
  'warning.answer': 1,
  'page.open': 0.1,
  'page.close': 2,
  'runEnd.continue': 4,
};
const DEFAULT_WEIGHT = 1;

/** The unit aim of a whole-degree angle (x east, y south), as `src/game/auto-aim.ts` sweeps them. */
export const aimOf = (degrees: number): { x: number; y: number } => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180),
});

/** API aim is an absolute cursor point, not a unit direction. Distance is a bot sampling choice, not a game stat. */
export function aimTarget(view: BotView | undefined, degrees: number): { x: number; y: number } {
  const p = (view?.hero as { position?: { x: number; y: number } } | null)?.position;
  const v = aimOf(degrees);
  // The harness fake has no spatial state and consumes directions; real GameView always supplies the hero position.
  return p ? { x: p.x + v.x * 4096, y: p.y + v.y * 4096 } : v;
}

/**
 * Builds a command from a spec by choosing one value per parameter. Dotted keys nest (`to.grid` → `{ to: { grid } }`),
 * so object parameters such as `item.move`'s `ItemPlace` can be listed flat. Aims are whole degrees; a target point
 * without listed values is drawn inside the 5 × 7 tile room.
 */
export function buildCommand(spec: BotSpec, rng: BotRng, view?: BotView): BotCommand {
  const cmd: Record<string, unknown> = { type: spec.type };
  for (const [key, values] of Object.entries(spec.params ?? {})) {
    if (values.length === 0) continue;
    const path = key.split('.');
    let at = cmd;
    for (const part of path.slice(0, -1)) at = (at[part] ??= {}) as Record<string, unknown>;
    at[path[path.length - 1]!] = rng.pick(values);
  }
  if (spec.type === 'aim.release' && cmd.aim === undefined) cmd.aim = aimTarget(view, rng.int(360));
  // SPEC-GAP: the contract does not say how skill.target lists its points; until it does, any point of the room floor.
  if (spec.type === 'skill.target' && cmd.at === undefined) cmd.at = { x: rng.next() * 7 * 64, y: rng.next() * 5 * 64 };
  return cmd as BotCommand;
}

function weighted(legal: readonly BotSpec[], rng: BotRng, weights: Readonly<Record<string, number>>): BotSpec | null {
  const w = legal.map(s => Math.max(0, weights[s.type] ?? DEFAULT_WEIGHT));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return legal[0] ?? null;
  let r = rng.next() * total;
  for (let i = 0; i < legal.length; i++) {
    r -= w[i]!;
    if (r < 0) return legal[i]!;
  }
  return legal[legal.length - 1]!;
}

type MoveCard = { id:number; quality?:number; size:readonly number[]; place?:{row:number;col?:number}|null };
type MoveInventory = { equip:readonly MoveCard[]; backpack:readonly MoveCard[]; lockedRows?:readonly number[] };
/** Bot-only conservative movement: choose a definitely empty public span. Source player rearrangement/swaps remain
 * available in the game, but cannot be certified from a Cartesian command-spec domain alone. No trial sends.
 * Null retains the historical fake-game contract when it has no inventory geometry.
 */
function emptyInventoryMoves(s:BotSpec,view:BotView):BotCommand[]|null {
  const inv=view.inventory as Partial<MoveInventory>|undefined;
  if(!inv?.equip||!inv.backpack)return null;
  const rows=(s.params?.['to.row']??[]).map(Number),limit=Math.max(-1,...rows)+1,columns=s.params?.['to.col']??[0];
  const out:BotCommand[]=[];
  for(const card of[...inv.equip,...inv.backpack]){
    if(!s.params?.item?.includes(card.id))continue;
    const height=card.size[1]??1;if(!(height>0)||!Number.isInteger(height)||(card.size[0]??1)>1)continue;
    for(const grid of s.params?.['to.grid']??[]){
      if(grid!=='equip'&&grid!=='backpack')continue;
      const occupants=grid==='equip'?inv.equip:inv.backpack,occupied=new Set(grid==='equip'?inv.lockedRows??[]:[]);
      for(const c of occupants)if(c.id!==card.id)for(let i=0;i<(c.size[1]??1);i++)occupied.add((c.place?.row??0)+i);
      for(const row of rows){
        if(row<0||row+height>limit||!Array.from({length:height},(_,i)=>row+i).every(r=>rows.includes(r)&&!occupied.has(r)))continue;
        if(occupants.some(c=>c.id===card.id&&c.place?.row===row))continue;
        for(const col of columns)if(col===0)out.push({type:'item.move',item:card.id,to:{grid,row,col}});
      }
    }
  }
  return out;
}

export function randomPolicy(weights: Readonly<Record<string, number>> = RANDOM_WEIGHTS): Policy {
  return {
    name: 'random',
    choose: ({ game, legal, rng }) => {
      // G2's factory skips the prologue. When the unlocked new-run entry is offered, exercise that complete-run
      // scope; fresh saves with only 序幕 still take the source prologue path. This is bot policy, not a game gate.
      if (game.view.screen === 'title' && legal.some(s => s.type === 'title.newRun')) return { type: 'title.newRun' };
      const candidates=legal.filter(s=>s.type!=='item.move'||emptyInventoryMoves(s,game.view)?.length!==0);
      const spec = weighted(candidates, rng, weights);
      if(spec?.type==='item.move'){
        const moves=emptyInventoryMoves(spec,game.view);if(moves)return moves.length?rng.pick(moves):null;
      }
      return spec ? buildCommand(spec, rng, game.view) : null;
    },
  };
}

/**
 * How good a shot looks in the preview (the order of `src/game/auto-aim.ts`'s `aimScore` without its placeholder
 * kills): distinct enemies hit, then enemy contacts, up to three wall bounces, a first contact on a wall and a long
 * first leg.
 */
export function previewScore(preview: BotPreview): number {
  const legs = preview.legs;
  // A stationary wall-contact chain is valid Demo geometry, but it must not beat a usable repositioning shot.
  // Seed 2's boss room otherwise prefers four zero-length walls (5 points) to 646 uu of movement (1.8 points).
  // This changes only bot choice: the planner and the player's ability to release that shot stay untouched.
  if (legs.length > 0 && legs.every(leg => leg.marker === 'wall' && leg.length <= 0)) return -Infinity;
  const hit = new Set<string | number>();
  let contacts = 0;
  let walls = 0;
  for (const leg of legs) {
    if (leg.marker === 'wall') walls++;
    if (leg.marker !== 'enemy') continue;
    contacts++;
    const id = leg.hit?.actor?.id;
    if (id !== undefined) hit.add(id);
  }
  const first = legs[0];
  const firstWall = first?.marker === 'wall' ? 2 : 0;
  const firstLen = first ? Math.min(first.length / 64, 6) : 0;
  return hit.size * 100 + contacts * 10 + Math.min(walls, 3) + firstWall + firstLen * 0.3;
}

/** The best of the 360 whole-degree aims by preview score; a random whole degree when the game has no preview. */
export function bestAim(game: BotGame, rng: BotRng): { x: number; y: number } {
  if (!game.preview) return aimTarget(game.view, rng.int(360));
  let best = aimTarget(game.view, rng.int(360));
  let bestScore = -Infinity;
  for (let deg = 0; deg < 360; deg++) {
    const aim = aimTarget(game.view, deg);
    const preview = game.preview(aim);
    if (!preview) continue;
    const score = previewScore(preview);
    if (score > bestScore) {
      bestScore = score;
      best = aim;
    }
  }
  return best;
}

/** Reposition after a prop rejected an interaction: use the real preview's final position, without bypassing reach. */
function approachAim(game: BotGame, actor: number | string): { x: number; y: number } | null {
  type Located = { id?: number | string; position?: { x: number; y: number } };
  const target = (game.view.field as readonly Located[] | undefined)?.find(a => a.id === actor)?.position;
  if (!target || !game.preview) return null;
  let best: { x: number; y: number } | null = null;
  let distance = Infinity;
  for (let degrees = 0; degrees < 360; degrees++) {
    const aim = aimTarget(game.view, degrees);
    const preview = game.preview(aim) as (BotPreview & { terminal?: { end: { x: number; y: number } } | null }) | null;
    if (!preview || preview.legs.every(leg => leg.length <= 0)) continue;
    const end = preview.terminal?.end ?? preview.legs.at(-1)?.end;
    if (!end) continue;
    const d = Math.hypot(end.x - target.x, end.y - target.y);
    if (d < distance) { distance = d; best = aim; }
  }
  return best;
}

/** Map tiles in the scripted preference order (WAVE_A A22): combat > chest > attribute > explore > empty. */
const TILE_PREFERENCE = ['首领', '战斗', '宝箱', '属性', '探索', '空'] as const;

/** A map cell's rank by its `MapCellView.tile` (the boss cell first: it is the only way on). */
function tileRank(view: BotView, cell: string | number): number {
  const cells = (view.map as { cells?: readonly { id?: unknown; tile?: unknown; boss?: unknown }[] } | null | undefined)?.cells ?? [];
  const found = cells.find(c => c.id === cell);
  const label = found ? `${found.boss === true ? '首领' : ''}${String(found.tile ?? '')}` : '';
  const rank = TILE_PREFERENCE.findIndex(word => label.includes(word));
  return rank < 0 ? TILE_PREFERENCE.length : rank;
}

const spec = (legal: readonly BotSpec[], type: string): BotSpec | undefined => legal.find(s => s.type === type);
const firstOf = (legal: readonly BotSpec[], ...types: string[]): BotSpec | undefined =>
  types.map(t => spec(legal, t)).find(s => s !== undefined);

/** Picks `want` for a parameter when the spec allows it, else the first listed value. */
function withParam(s: BotSpec, key: string, want?: string | number): BotCommand {
  const values = s.params?.[key] ?? [];
  const value = want !== undefined && values.includes(want) ? want : values[0];
  return (value === undefined ? { type: s.type } : { type: s.type, [key]: value }) as BotCommand;
}

/** Use a free equipment span, highest quality first. The policy reads inventory state; the core owns placement rules. */
function equipFromBackpack(view: BotView, legal: readonly BotSpec[]): BotCommand | null {
  const move = spec(legal, 'item.move');
  if (!move?.params?.['to.grid']?.includes('equip')) return null;
  type Card = { id: number; quality: number; size: readonly number[]; place?: { row: number } | null };
  const inv = view.inventory as { equip?: readonly Card[]; backpack?: readonly Card[]; lockedRows?: readonly number[] } | undefined;
  const occupied = new Set(inv?.lockedRows ?? []);
  for (const c of inv?.equip ?? []) for (let i = 0; i < (c.size[1] ?? 1); i++) occupied.add((c.place?.row ?? 0) + i);
  const rows = (move.params['to.row'] ?? []).map(Number);
  const limit = Math.max(-1, ...rows) + 1;
  for (const c of [...(inv?.backpack ?? [])].sort((a, b) => b.quality - a.quality || a.id - b.id)) {
    if (!move.params.item?.includes(c.id)) continue;
    const size = c.size[1] ?? 1;
    const row = rows.find(r => r + size <= limit && Array.from({ length: size }, (_, i) => r + i).every(x => !occupied.has(x)));
    if (row !== undefined) return { type: 'item.move', item: c.id, to: { grid: 'equip', row, col: 0 } };
  }
  return null;
}

/**
 * The scripted policy: hooks per screen and modal (ARCHITECTURE §10.2). Skeleton for wave A; game-g2 completes it
 * against the real views (equip the strongest, first affordable offer with the most stats, map cell kinds).
 */
export function scriptedPolicy(hero = '幽冥骑士'): Policy {
  const fallback = randomPolicy();
  let picked = false;
  let lastInteraction: { actor: number | string; state: string } | null = null;
  return {
    name: 'scripted',
    choose: ctx => {
      const { game, legal, rng } = ctx;
      const view = game.view;
      if (view.screen !== 'heroSelect') picked = false;
      const modal = view.modal;
      if (modal) lastInteraction = null;
      let s: BotSpec | undefined;
      if (modal) {
        switch (modal.kind) {
          case 'multiChoice':
            if ((s = spec(legal, 'modal.pick'))) return withParam(s, 'option', 0);
            break;
          case 'loot':
            if ((s = spec(legal, 'loot.takeAll'))) return { type: s.type };
            if ((s = spec(legal, 'loot.take'))) return withParam(s, 'item');
            if ((s = spec(legal, 'loot.close'))) return { type: s.type };
            break;
          case 'panel':
            if ((s = spec(legal, 'panel.continue'))) return { type: s.type };
            break;
          case 'runEnd':
            if ((s = spec(legal, 'runEnd.continue'))) return { type: s.type };
            break;
          case 'warning':
            if ((s = spec(legal, 'warning.answer'))) return withParam(s, 'button', 0);
            break;
        }
      }
      if (!modal) {
        const equip = equipFromBackpack(view, legal);
        if (equip) return equip;
      }
      switch (view.screen) {
        case 'title':
          if ((s = firstOf(legal, 'title.newRun', 'title.prologue'))) return { type: s.type };
          break;
        case 'heroSelect':
          if (view.heroSelect) picked = view.heroSelect.picked === hero;
          if (!picked && (s = spec(legal, 'hero.pick'))) {
            picked = true;
            return withParam(s, 'hero', hero);
          }
          if ((s = spec(legal, 'hero.start'))) return { type: s.type };
          break;
        case 'map':
          if ((s = spec(legal, 'map.option'))) return withParam(s, 'option');
          if ((s = spec(legal, 'map.enter'))) {
            const cells = [...(s.params?.cell ?? [])].sort((a, b) => tileRank(view, a) - tileRank(view, b));
            if (cells.length) return { type: s.type, cell: cells[0] };
          }
          break;
        case 'room':
          if ((s = spec(legal, 'interact'))) {
            const actors=s.params?.actor??[];
            const shopFields=view.field as readonly {id?:number|string;row?:string;shopPrice?:number;position?:object;hp?:number}[]|undefined;
            const shopKey=view.phase==='进入商店'?JSON.stringify([view.phase,view.run,view.inventory,shopFields]):null;
            const coins=(view.run as {金币?:number}|null)?.金币??0;
            const goods=actors.filter(id=>{const a=shopFields?.find(a=>a.id===id);return typeof a?.shopPrice==='number'&&a.shopPrice<=coins;});
            const merchant=actors.find(id=>shopFields?.find(a=>a.id===id)?.row==='商人');
            // A priced source interaction may accept the click yet reject its condition (no matching forge card).
            // Try the next affordable shelf, then the merchant exit; elapsed browser time is not progress.
            const shopOptions=[...goods,...(merchant===undefined?[]:[merchant])];
            let actor=shopKey&&shopOptions.length?shopOptions[0]:actors[0];
            if(shopKey&&lastInteraction?.state===shopKey){const next=shopOptions.indexOf(lastInteraction.actor)+1;actor=shopOptions[Math.min(next,shopOptions.length-1)]??actor;}
            const target = (view.field as readonly { id?: number | string; position?: object; hp?: number }[] | undefined)?.find(a => a.id === actor);
            const heroState = view.hero as { id?: number; position?: object; hp?: number } | null | undefined;
            const runState = view.run as { chapter?: string; floor?: number; turn?: number } | null | undefined;
            const state = JSON.stringify([view.screen, view.phase, runState?.chapter, runState?.floor, runState?.turn,
              heroState?.id, heroState?.position, heroState?.hp, actor, target?.position, target?.hp]);
            // A successful prop action yields to its chant/settlement or opens a modal. An unchanged
            // player/prop state means the click did not progress (source 点击交互 L3979: 太远了). Browser pacing
            // advances time between decisions, but elapsed time alone is not evidence that the click succeeded.
            if (actor !== undefined && lastInteraction?.actor === actor && lastInteraction.state === state && spec(legal, 'aim.release')) {
              const aim = approachAim(game, actor);
              lastInteraction = null;
              if (aim) return { type: 'aim.release', aim };
            }
            if (actor !== undefined) lastInteraction = { actor, state:shopKey??state };
            return withParam(s, 'actor',actor);
          }
          if ((s = spec(legal, 'aim.release'))) return { type: s.type, aim: bestAim(game, rng) };
          break;
        case 'runEnd':
          if ((s = spec(legal, 'runEnd.continue'))) return { type: s.type };
          break;
      }
      return fallback.choose(ctx);
    },
  };
}

/** Sends a recorded command log in order (reproducing a crash); null once it is exhausted. */
export function replayPolicy(log: readonly BotCommand[]): Policy {
  return { name: 'replay', choose: ({ step }) => log[step] ?? null };
}

/** The policy of one run: `mix` alternates scripted (even runs) and random (odd runs). */
export function makePolicy(name: PolicyName, runIndex: number, options: { hero?: string; log?: readonly BotCommand[] } = {}): Policy {
  switch (name) {
    case 'random':
      return randomPolicy();
    case 'scripted':
      return scriptedPolicy(options.hero);
    case 'mix':
      return runIndex % 2 === 0 ? scriptedPolicy(options.hero) : randomPolicy();
    case 'replay':
      return replayPolicy(options.log ?? []);
  }
}
