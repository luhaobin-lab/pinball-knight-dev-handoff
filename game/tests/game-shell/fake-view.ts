import {
  computeLaunchPreview,
  createLaunchWorld,
  planLaunch,
  STARTER_HERO,
  type LaunchPlayback,
  type LaunchPreview,
  type LaunchWorld,
} from '../../src/core/launch/index.ts';
import { row, 数据表_天赋_新新通用 } from '../../src/content/demo';
import type {
  Command,
  CommandResult,
  CommandSpec,
  ActorView as FieldActorView,
  CardView,
  Game,
  GameView,
  MapCellView,
  MapView,
  ModalView,
  PresentEvent,
  RoomPlan,
  SaveBlob,
  Screen,
} from '../../src/game/api';

/**
 * A fake `Game` for the shell (game-shell acceptance): every screen and modal of WAVE_A §3, reachable by plain
 * commands, with a real aim preview and launch playback (src/core/launch) in its rooms. It has no Demo rules: a
 * combat room ends when the enemies are touched, every room pays a loot box, every second room a level-up pick, and
 * the last floor's boss ends the run. Deterministic: no clock and no randomness.
 */

export interface FakeOptions {
  /** Floors in the run (default 3; the last is the boss floor). */
  floors?: number;
}

/** A 7 × 5 room of 128-uu tiles (the real RoomPlan v0 is 5 × 7 tiles of 64 uu, WAVE_A §3.8). */
const ROOM: RoomPlan = (() => {
  const cols = 7;
  const rows = 5;
  const cells: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
  return {
    layout: 'fake',
    variant: 0,
    cols,
    rows,
    tile: 128,
    cells,
    solids: [{ kind: 'circle', at: { x: 250, y: 400, z: 0 }, radius: 26, tags: [] }],
    decorations: [],
    spawns: [],
    task: null,
    playerSpawn: { x: 448, y: 560, z: 0 },
    background: null,
  };
})();

const HERO_ROW = '幽冥骑士';

const SWORD: CardView = { id: 900, row: '旧剑', quality: 0, charge: 0, chargeMax: 100, durability: null, enchants: [], tooltip: [], place: { grid: 'equip', row: 0, col: 0 }, size: [1, 2] };

type EventBody = PresentEvent extends infer E ? (E extends unknown ? Omit<E, 't'> : never) : never;
const FLOOR_ROWS = ['简单战斗', '宝箱房', '普通战斗'] as const;

/** A talent's 描述 from its Demo row with {0} filled by its first 提升值 (no Demo rules: only a readable text). */
function talentText(name: string): string {
  const r = row(数据表_天赋_新新通用, name);
  const step = r.参数[0]?.提升值 ?? 0;
  return r.描述.zh.replace('{0}', step < 1 ? `${Math.round(step * 1000) / 10}%` : String(step));
}

type Mode = 'title' | 'heroSelect' | 'map' | 'room' | 'runEnd';

interface FakeActor {
  id: number;
  row: string;
  kind: FieldActorView['kind'];
  x: number;
  z: number;
  radius: number;
  height: number;
  hp: number;
}

export class FakeGame implements Game {
  private mode: Mode = 'title';
  private modal: ModalView | null = null;
  private time = 0;
  private floor = 0;
  /** The hero's map column (营地 starts in the middle). */
  private col = 1;
  private rooms = 0;
  private actors: FakeActor[] = [];
  private nextId = 1;
  private hero: FakeActor | null = null;
  private launch: { playback: LaunchPlayback; startedAt: number; touched: Set<number>; contact: number } | null = null;
  private events: PresentEvent[] = [];
  private picked = HERO_ROW;
  private currentRow = '';
  private readonly floors: number;
  private menuReturn: ModalView | null = null;

  constructor(options: FakeOptions = {}) {
    this.floors = Math.max(1, options.floors ?? 3);
  }

  get view(): GameView {
    const hero = this.hero;
    return {
      screen: this.mode as Screen,
      phase: this.mode === 'room' ? (this.launch ? '进行战斗' : this.modal ? '物品盒子' : '交互场牌') : this.mode === 'map' ? '选择地图' : '进入营地',
      inputOpen: this.mode === 'room' && !this.launch && !this.modal,
      modal: this.modal,
      run:
        this.mode === 'map' || this.mode === 'room'
          ? {
              chapter: '遗迹',
              floor: this.floor,
              floors: this.floors,
              quest: [{ text: `通过第<数值>${this.floor}/${this.floors}</>层`, done: false }],
              turn: 1,
              金币: 8,
              精矿: 0,
              当前腐化: 0,
              最大腐化: 100,
              英雄等级: 1 + (this.rooms >> 1),
              经验: 40,
              升级经验: 150,
            }
          : null,
      hero: hero
        ? { id: hero.id, row: hero.row, position: { x: hero.x, y: hero.z, z: 0 }, hp: 100, maxHp: 100, armor: 0, stamina: 98, maxStamina: 100, dot: 0, statuses: [], skills: [], stats: {} }
        : null,
      title: this.mode === 'title' ? { prologue: true, newRun: true, quest: null } : null,
      heroSelect:
        this.mode === 'heroSelect'
          ? {
              heroes: [
                { row: '幽冥骑士', unlocked: true, unlockText: null },
                { row: '灵魂猎手', unlocked: false, unlockText: '探索等级提升至4后解锁。' },
              ],
              picked: this.picked,
            }
          : null,
      field: this.mode === 'room' ? this.actors.map(a => this.actorView(a)) : [],
      room: this.mode === 'room' ? ROOM : null,
      pickups: [],
      terrain: [],
      projectiles: [],
      map: this.mode === 'map' ? this.mapView() : null,
      inventory: { equip: [SWORD], backpack: [], lockedRows: [4, 5, 6, 7, 8, 9], side: [], materials: {} },
      log: [],
      launch: this.launch ? { playback: this.launch.playback, startedAt: this.launch.startedAt } : null,
      time: this.time,
    };
  }

  private actorView(a: FakeActor): FieldActorView {
    return {
      id: a.id,
      row: a.row,
      table: a.kind === 'hero' ? '数据表_玩家' : a.kind === 'neutral' ? '数据表_道具_通用' : '数据表_敌人_普通',
      kind: a.kind,
      position: { x: a.x, y: a.z, z: 0 },
      radius: a.radius,
      height: a.height,
      hidden: false,
      hp: a.hp,
      maxHp: 10,
      armor: 0,
      intent: a.kind === 'enemy' || a.kind === 'boss' ? { skill: '攻击', target: this.hero?.id ?? null, text: '6' } : null,
      statuses: [],
      elite: false,
      boss: a.kind === 'boss',
    };
  }

  /**
   * The map window as the Demo shows it (PROTOTYPE_SCOPE §5.2): the hero's row and up to 3 floors ahead, 3 tiles each.
   * Row 0 is [空, 营地, 空], floor 1 is 3 × 第一层, the last floor is [空, 首领战斗, 空], the others rotate FLOOR_ROWS;
   * the next floor's tiles within one column of the hero's can be entered, and links join tiles one column apart.
   */
  private rowTiles(row: number): readonly string[] {
    if (row === 0) return ['空', '营地', '空'];
    if (row === this.floors) return ['空', '首领战斗', '空'];
    if (row === 1) return ['第一层', '第一层', '第一层'];
    return FLOOR_ROWS.map((_, i) => FLOOR_ROWS[(i + row) % FLOOR_ROWS.length]);
  }

  private mapCells(): MapCellView[] {
    const out: MapCellView[] = [];
    for (let row = this.floor; row <= Math.min(this.floors, this.floor + 3); row++) {
      this.rowTiles(row).forEach((tile, col) => {
        const enterable = row === this.floor + 1 && tile !== '空' && Math.abs(col - this.col) <= 1;
        out.push({ id: `${row}:${col}`, col, row, tile, reward: null, quality: tile.endsWith('战斗') ? 1 + ((row + col) % 3) : 1, explored: false, enterable, boss: tile === '首领战斗' });
      });
    }
    return out;
  }

  private mapView(): MapView {
    const cells = this.mapCells();
    const byId = new Map(cells.map(c => [c.id, c]));
    const links: [string, string][] = [];
    for (const a of cells) {
      if (a.tile === '空') continue;
      for (const dx of [-1, 0, 1]) {
        const b = byId.get(`${a.row + 1}:${a.col + dx}`);
        if (b && b.tile !== '空') links.push([a.id, b.id]);
      }
    }
    return { chapter: '遗迹', floor: this.floor, cells, links, current: `${this.floor}:${this.col}`, stars: 0, bossNext: this.floor + 1 === this.floors, options: [] };
  }

  legal(): readonly CommandSpec[] {
    if (this.modal) {
      switch (this.modal.kind) {
        case 'multiChoice':
          return [{ type: 'modal.pick', params: { option: this.modal.options.map((_, i) => i) } }, ...(this.modal.canSkip ? [{ type: 'modal.skip' as const }] : [])];
        case 'loot':
          return [{ type: 'loot.take', params: { item: this.modal.cells.filter(c => !c.taken).map(c => c.item) } }, { type: 'loot.takeAll' }, { type: 'loot.close' }];
        case 'panel':
          return [{ type: 'panel.continue' }];
        case 'warning':
          return [{ type: 'warning.answer', params: { button: [0, 1] } }, { type: 'menu.close' }];
        case 'runEnd':
          return [{ type: 'runEnd.continue' }];
      }
    }
    switch (this.mode) {
      case 'title':
        return [{ type: 'title.prologue' }, { type: 'title.newRun' }, { type: 'title.settings' }, { type: 'title.quit' }];
      case 'heroSelect':
        return [{ type: 'hero.pick', params: { hero: [HERO_ROW] } }, { type: 'hero.start' }, { type: 'hero.back' }];
      case 'map':
        return [{ type: 'map.enter', params: { cell: this.mapCells().filter(c => c.enterable).map(c => c.id) } }, { type: 'menu.open' }];
      case 'room':
        return this.launch ? [] : [{ type: 'aim.release' }, { type: 'menu.open' }, ...this.actors.filter(a => a.kind === 'neutral').map(() => ({ type: 'interact' as const }))];
      case 'runEnd':
        return [{ type: 'runEnd.continue' }];
    }
  }

  send(cmd: Command): CommandResult {
    if (!this.legal().some(s => s.type === cmd.type)) return { ok: false, reason: `${cmd.type} is not legal on ${this.mode}${this.modal ? `/${this.modal.kind}` : ''}` };
    switch (cmd.type) {
      case 'title.newRun':
      case 'title.prologue':
        this.mode = 'heroSelect';
        break;
      case 'title.settings':
      case 'title.quit':
        break;
      case 'hero.pick':
        this.picked = cmd.hero;
        break;
      case 'hero.back':
        this.mode = 'title';
        break;
      case 'hero.start':
        this.floor = 0;
        this.col = 1;
        this.rooms = 0;
        this.mode = 'map';
        break;
      case 'map.enter':
        return this.enter(cmd.cell);
      case 'aim.release':
        return this.release(cmd.aim);
      case 'interact': {
        const prop = this.actors.find(a => a.id === cmd.actor && a.kind === 'neutral');
        if (!prop) return { ok: false, reason: 'no such prop' };
        this.loot();
        break;
      }
      case 'panel.continue':
        this.loot();
        break;
      case 'loot.take': {
        const m = this.modal;
        if (m?.kind !== 'loot' || !m.cells.some(c => c.item === cmd.item && !c.taken)) return { ok: false, reason: 'not offered' };
        const cells = m.cells.map(c => (c.item === cmd.item ? { ...c, taken: true } : c));
        this.modal = { ...m, cells };
        if (cells.every(c => c.taken)) this.leaveRoom();
        break;
      }
      case 'loot.takeAll':
      case 'loot.close':
        this.leaveRoom();
        break;
      case 'modal.pick':
      case 'modal.skip':
        this.modal = null;
        this.toMap();
        break;
      case 'menu.open':
        this.menuReturn = this.modal;
        this.modal = { kind: 'warning', type: 0, text: '结束本次探险？', buttons: [this.mode === 'map' ? '保存并退出' : '重置房间（+10腐化）', '放弃探险'] };
        break;
      case 'menu.close':
        this.modal = this.menuReturn;
        break;
      case 'warning.answer':
        if (cmd.button === 1) this.endRun(false);
        else this.modal = this.menuReturn;
        break;
      case 'runEnd.continue':
        this.modal = null;
        this.mode = 'title';
        this.hero = null;
        this.actors = [];
        break;
      default:
        return { ok: false, reason: `${cmd.type} unsupported by the fake` };
    }
    return { ok: true };
  }

  private enter(cell: string): CommandResult {
    const target = this.mapCells().find(c => c.id === cell);
    if (!target) return { ok: false, reason: `no cell ${cell}` };
    if (!target.enterable) return { ok: false, reason: `cell ${cell} cannot be entered` };
    this.floor = target.row;
    this.col = target.col;
    this.currentRow = target.tile;
    this.mode = 'room';
    this.actors = [];
    const hero = this.spawn(this.picked, 'hero', 448, 560, 56, 56);
    this.hero = hero;
    if (target.tile.endsWith('战斗')) {
      if (target.tile === '首领战斗') this.spawn('守门人', 'boss', 448, 200, 96, 120);
      else for (const [i, row] of ['眼球', '大肠', '大肠血卵'].entries()) this.spawn(row, 'enemy', 220 + i * 230, 180 + (i % 2) * 90, 40, 46);
    } else this.spawn(target.tile === '宝箱房' ? '任务祭坛' : '任务宝箱', 'neutral', 448, 220, 40, 40);
    return { ok: true };
  }

  private spawn(row: string, kind: FakeActor['kind'], x: number, z: number, radius: number, height: number): FakeActor {
    const a: FakeActor = { id: this.nextId++, row, kind, x, z, radius, height, hp: 10 };
    this.actors.push(a);
    const table = kind === 'hero' ? '数据表_玩家' : kind === 'neutral' ? '数据表_道具_通用' : '数据表_敌人_普通';
    this.emit({ kind: 'actor.spawn', id: a.id, row, table, cls: '', actorKind: kind, at: { x, y: 0, z }, radius, height, elite: false, hidden: false });
    return a;
  }

  private emit(e: EventBody): void {
    this.events.push({ ...e, t: this.time } as PresentEvent);
  }

  private world(): LaunchWorld {
    return createLaunchWorld({
      grid: { width: ROOM.cols * 2, depth: ROOM.rows * 2, cells: roomCells() },
      circles: ROOM.solids.map((s, i) => ({ id: `solid-${i}`, x: s.at.x, y: s.at.y, radius: s.radius ?? 0 })),
      bodies: this.actors.filter(a => a.kind !== 'hero' && a.hp > 0).map(a => ({ id: String(a.id), x: a.x, y: a.z, radius: a.radius, halfHeight: a.height })),
    });
  }

  preview(aim: { x: number; y: number }): LaunchPreview | null {
    if (this.mode !== 'room' || !this.hero || this.launch || this.modal) return null;
    return computeLaunchPreview(this.world(), { x: this.hero.x, y: this.hero.z }, aim, { hero: STARTER_HERO });
  }

  private release(aim: { x: number; y: number }): CommandResult {
    const preview = this.preview(aim);
    if (!preview) return { ok: false, reason: 'no aim' };
    const playback = planLaunch(preview);
    this.launch = { playback, startedAt: this.time, touched: new Set(), contact: 0 };
    this.emit({ kind: 'launch.start', hero: this.hero!.id });
    return { ok: true };
  }

  advance(dt: number): void {
    const end = this.time + Math.max(0, dt);
    const l = this.launch;
    if (l) {
      const contacts = l.playback.contacts;
      while (l.contact < contacts.length && l.startedAt + contacts[l.contact].time <= end) {
        const c = contacts[l.contact++];
        this.time = l.startedAt + c.time;
        const id = c.hit && c.hit.actor.kind === 'body' ? Number(c.hit.actor.id) : null;
        this.emit({ kind: 'launch.contact', index: c.index, contact: c.kind === 'enemy' ? 'enemy' : c.kind === 'gravity' ? 'gravity' : 'wall', actor: id });
        if (id !== null && c.kind === 'enemy') {
          l.touched.add(id);
          this.emit({ kind: 'time.dilation', curve: 'hitStop', from: this.time });
          this.emit({ kind: 'actor.hit', id, from: this.hero!.id, crit: false, weak: false });
          this.emit({ kind: 'popup', popup: 'damage', value: 20, target: id, at: null });
        }
      }
      if (end >= l.startedAt + l.playback.duration) {
        this.time = l.startedAt + l.playback.duration;
        this.hero!.x = l.playback.end.x;
        this.hero!.z = l.playback.end.y;
        for (const a of this.actors) {
          if (l.touched.has(a.id) && a.hp > 0) {
            a.hp = 0;
            this.emit({ kind: 'actor.die', id: a.id });
          }
        }
        this.emit({ kind: 'launch.end', hero: this.hero!.id });
        this.launch = null;
        if (!this.actors.some(a => (a.kind === 'enemy' || a.kind === 'boss') && a.hp > 0) && this.currentRow.endsWith('战斗')) {
          this.modal = { kind: 'panel', result: 'victory', lines: [{ label: '回合数', value: '1' }], canRetry: false };
        }
      }
    }
    this.time = end;
  }

  runUntilInput(): 'input' | 'idle' | 'ended' | 'timeout' {
    if (this.launch) this.advance(this.launch.startedAt + this.launch.playback.duration - this.time);
    return 'input';
  }

  private loot(): void {
    this.modal = { kind: 'loot', title: '战利品', cells: [
        { item: 901, row: '生命药剂', quality: 0, taken: false },
        { item: 902, row: '旧盾', quality: 1, taken: false },
      ], exp: 40, canTakeAll: true };
  }

  private leaveRoom(): void {
    this.rooms++;
    if (this.floor >= this.floors) return this.endRun(true);
    if (this.rooms % 2 === 0) {
      this.modal = {
        kind: 'multiChoice',
        source: 'levelUp',
        title: '选择天赋',
        options: ['博学', '力量', '强韧'].map(row => ({ row, title: row, text: talentText(row), level: 1, icon: '' })),
        reroll: null,
        canSkip: true,
      };
      return;
    }
    this.modal = null;
    this.toMap();
  }

  private toMap(): void {
    for (const a of this.actors) this.emit({ kind: 'actor.despawn', id: a.id });
    this.actors = [];
    this.hero = null;
    this.mode = 'map';
  }

  private endRun(won: boolean): void {
    this.toMap();
    this.mode = 'runEnd';
    this.modal = {
      kind: 'runEnd',
      lines: [
        { label: '通过层数', value: String(this.floor) },
        { label: '击杀敌人', value: '12' },
        { label: won ? '击败首领' : '自我放弃', value: won ? '+300' : '-100' },
      ],
      score: won ? 720 : 80,
      exploration: { level: 1, progress: won ? 720 : 80, need: 1000 },
      demoComplete: won,
    };
  }

  drainEvents(): PresentEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  readonly coverage = { classesHit: {}, unported: {}, stubs: {} };

  save(): SaveBlob {
    return { version: 0, meta: { '新手关过？': true }, run: null };
  }

  digest(): string {
    return JSON.stringify([this.mode, this.modal?.kind ?? '', this.floor, this.rooms, this.time.toFixed(4), this.actors.map(a => [a.id, a.hp, a.x | 0, a.z | 0])]);
  }
}

/** The fake room as a launch grid: each 128-uu cell is 2 × 2 launch tiles; outside the grid is wall. */
function roomCells(): Uint8Array {
  return new Uint8Array(ROOM.cols * 2 * ROOM.rows * 2).fill(1);
}

export function createFakeGame(options: FakeOptions = {}): Game {
  return new FakeGame(options);
}
