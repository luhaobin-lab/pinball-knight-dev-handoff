// A scripted fake of the game API (ARCHITECTURE Appendix A.8 with WAVE_A §3) for testing the bot harness without the
// real core: title → hero select → map (3 cells per floor) → rooms that end after N launches → victory panel → loot →
// next floor … → boss floor → run end. Three seeds misbehave on purpose:
//   crashSeed     entering a room on floor 2 throws;
//   softlockSeed  the first room of floor 2 waits forever (no legal command, nothing scheduled);
//   flakySeed     the digest depends on module state, so a second run of the same seed differs.
// Time only moves through scheduled events, so runUntilInput() ≡ advance() steps, as in the real scheduler.

export const FAKE_SEEDS = Object.freeze({ crashSeed: 13, softlockSeed: 7, flakySeed: 21 });

let flakyCounter = 0;

function rngOf(seed) {
  let s = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

const TILES = ['战斗房_简单', '宝箱房', '属性房', '探索房', '空'];

export function createFakeGame(options = {}, seeds = FAKE_SEEDS) {
  const seed = options.seed ?? 1;
  const rand = rngOf(seed);
  const floorsTotal = options.debug?.floors ?? 3;
  const flaky = seed === seeds.flakySeed ? ++flakyCounter : 0;
  const s = {
    screen: 'title',
    phase: 14,
    modal: null,
    run: null,
    hero: null,
    map: null,
    room: null,
    time: 0,
    seq: 0,
    timers: [],
    ended: false,
    pickedHero: null,
    coverage: { classesHit: {}, stubs: {}, unported: {} },
  };
  const hit = (bucket, name) => (s.coverage[bucket][name] = (s.coverage[bucket][name] ?? 0) + 1);

  const schedule = (dt, kind) => s.timers.push({ t: s.time + dt, seq: s.seq++, kind });
  const nextTimer = () => s.timers.reduce((a, b) => (!a || b.t < a.t || (b.t === a.t && b.seq < a.seq) ? b : a), null);

  function newFloor() {
    const n = s.run.floor;
    const cells = n === floorsTotal
      ? [{ id: `f${n}c0`, tile: '首领战斗' }]
      : [0, 1, 2].map(i => ({ id: `f${n}c${i}`, tile: TILES[Math.floor(rand() * TILES.length)] }));
    s.map = { floor: n, cells };
  }

  function enterRoom(cell) {
    const combat = cell.tile.includes('战斗');
    s.screen = 'room';
    s.phase = 8;
    s.room = { cell: cell.id, tile: cell.tile, combat, left: combat ? 2 + Math.floor(rand() * 4) + (cell.tile === '首领战斗' ? 3 : 0) : 0, actor: 100 + s.seq };
    hit('classesHit', cell.tile);
    if (cell.tile === '探索房') hit('stubs', '/Game/CatapultHero/BP/环境/探索房');
    schedule(0.5, 'roomReady');
  }

  function fire(kind) {
    switch (kind) {
      case 'roomReady':
        if (seed === seeds.softlockSeed && s.run.floor === 2) {
          s.phase = 99;
          return;
        }
        s.phase = s.room.combat ? 2 : 9.5;
        return;
      case 'launchEnd': {
        s.room.left--;
        s.run.turn++;
        hit('classesHit', '蓝图_效果_可控弹射');
        if (s.room.left <= 0) {
          s.phase = 19;
          s.modal = { kind: 'panel', result: 'victory', lines: [], canRetry: false };
          return;
        }
        s.phase = 0;
        schedule(0.8, 'enemyEnd');
        return;
      }
      case 'enemyEnd': {
        s.hero.hp -= Math.floor(rand() * 4);
        hit('unported', 'BP_Actor_Other.选择技能');
        if (s.hero.hp <= 0) {
          s.hero.hp = 0;
          s.phase = 19;
          s.modal = { kind: 'panel', result: 'failure', lines: [], canRetry: false };
          return;
        }
        s.phase = 2;
        return;
      }
    }
  }

  function runEnd(demoComplete) {
    s.screen = 'runEnd';
    s.phase = 13;
    s.modal = { kind: 'runEnd', lines: [], score: s.run.floor * 100 + s.run.金币, exploration: { level: 1, progress: 0, need: 1 }, demoComplete };
    s.ended = true;
  }

  function advance(dt) {
    const until = s.time + Math.max(0, dt);
    for (let t = nextTimer(); t && t.t <= until + 1e-9; t = nextTimer()) {
      s.timers.splice(s.timers.indexOf(t), 1);
      s.time = Math.max(s.time, t.t);
      fire(t.kind);
    }
    s.time = until;
  }

  function legal() {
    if (s.ended) return [];
    const m = s.modal;
    if (m) {
      switch (m.kind) {
        case 'page': return [{ type: 'page.close' }];
        case 'panel': return [{ type: 'panel.continue' }];
        case 'loot': return [{ type: 'loot.takeAll' }, { type: 'loot.close' }];
        case 'warning': return [{ type: 'warning.answer', params: { button: [0, 1] } }, { type: 'menu.close' }];
        case 'multiChoice': return [{ type: 'modal.pick', params: { option: [0, 1, 2] } }, { type: 'modal.skip' }];
      }
    }
    if (s.timers.length) return [];
    switch (s.screen) {
      case 'title': return [{ type: 'title.newRun' }, { type: 'title.settings' }, { type: 'title.quit' }];
      case 'heroSelect':
        return [{ type: 'hero.pick', params: { hero: ['幽冥骑士'] } }, ...(s.pickedHero ? [{ type: 'hero.start' }] : []), { type: 'hero.back' }];
      case 'map': return [{ type: 'map.enter', params: { cell: s.map.cells.map(c => c.id) } }, { type: 'menu.open' }];
      case 'room':
        if (s.phase === 2) return [{ type: 'aim.release' }, { type: 'menu.open' }];
        if (s.phase === 9.5) return [{ type: 'interact', params: { actor: [s.room.actor] } }, { type: 'menu.open' }];
        return [];
    }
    return [];
  }

  const isLegal = cmd => legal().some(spec => spec.type === cmd.type && Object.entries(spec.params ?? {}).every(([k, v]) => v.includes(cmd[k])));

  function send(cmd) {
    if (!cmd || typeof cmd.type !== 'string') return { ok: false, reason: 'bad command' };
    if (!isLegal(cmd)) return { ok: false, reason: `${cmd.type} not legal now` };
    switch (cmd.type) {
      case 'title.newRun': s.screen = 'heroSelect'; s.phase = 14; return { ok: true };
      case 'title.settings': s.modal = { kind: 'page', page: 'settings' }; return { ok: true };
      case 'page.close': s.modal = null; return { ok: true };
      case 'title.quit': s.ended = true; return { ok: true };
      case 'hero.pick': s.pickedHero = cmd.hero; return { ok: true };
      case 'hero.back': s.screen = 'title'; s.pickedHero = null; return { ok: true };
      case 'hero.start':
        s.run = { floor: 1, 金币: 0, turn: 0 };
        s.hero = { id: s.pickedHero, hp: 30 + (flaky % 2) };
        s.screen = 'map';
        s.phase = 9;
        newFloor();
        return { ok: true };
      case 'map.enter':
        if (seed === seeds.crashSeed && s.run.floor === 2) throw new Error('fake crash: map.enter on floor 2');
        enterRoom(s.map.cells.find(c => c.id === cmd.cell)); return { ok: true };
      case 'aim.release': {
        const a = cmd.aim;
        if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return { ok: false, reason: 'bad aim' };
        s.phase = 3;
        schedule(1.2 + Math.abs(a.x) * 0.3, 'launchEnd');
        return { ok: true };
      }
      case 'interact':
        s.modal = { kind: 'loot', title: s.room.tile, cells: [], exp: null, canTakeAll: true };
        return { ok: true };
      case 'panel.continue':
        if (s.modal.result === 'failure') { runEnd(false); return { ok: true }; }
        s.modal = { kind: 'loot', title: '战利品', cells: [], exp: 5, canTakeAll: true };
        return { ok: true };
      case 'loot.takeAll':
      case 'loot.close':
        if (cmd.type === 'loot.takeAll') s.run.金币 += 3;
        s.modal = null;
        if (s.room.tile === '首领战斗') { runEnd(true); return { ok: true }; }
        if (s.room.combat && s.run.turn % 3 === 0) {
          s.modal = { kind: 'multiChoice', source: 'levelUp', title: '升级', options: [{}, {}, {}], reroll: null, canSkip: true };
          return { ok: true };
        }
        return leaveRoom();
      case 'modal.pick':
      case 'modal.skip':
        s.modal = null;
        return leaveRoom();
      case 'menu.open': s.modal = { kind: 'warning', type: 0, buttons: ['重置房间', '放弃探险'] }; return { ok: true };
      case 'menu.close': s.modal = null; return { ok: true };
      case 'warning.answer':
        s.modal = null;
        if (cmd.button === 1) { runEnd(false); return { ok: true }; }
        if (s.screen === 'room') { s.timers = []; enterRoom(s.map.cells.find(c => c.id === s.room.cell)); }
        return { ok: true };
    }
    return { ok: false, reason: `unknown command ${cmd.type}` };
  }

  function leaveRoom() {
    s.room = null;
    s.run.floor++;
    s.screen = 'map';
    s.phase = 9;
    newFloor();
    return { ok: true };
  }

  function runUntilInput(maxSeconds = Infinity) {
    const limit = s.time + maxSeconds;
    for (;;) {
      if (s.ended) return 'ended';
      const t = nextTimer();
      if (!t) return legal().length ? 'input' : 'idle';
      if (t.t > limit) {
        advance(limit - s.time);
        return 'timeout';
      }
      advance(t.t - s.time);
    }
  }

  function preview(aim) {
    if (s.screen !== 'room' || s.phase !== 2) return null;
    const deg = (Math.round((Math.atan2(aim.y, aim.x) * 180) / Math.PI) + 360) % 360;
    const legs = [{ marker: deg % 7 === 0 ? 'enemy' : 'wall', length: 64 + (deg % 50), hit: deg % 7 === 0 ? { actor: { id: 'e1' } } : null }];
    if (deg % 11 === 0) legs.push({ marker: 'enemy', length: 80, hit: { actor: { id: 'e2' } } });
    return { legs };
  }

  const digest = () =>
    fnv(JSON.stringify([s.screen, s.phase, s.modal, s.run, s.hero, s.map, s.room, Math.round(s.time * 1e6), s.timers.map(t => [t.kind, Math.round(t.t * 1e6)]), s.pickedHero, flaky]));

  return {
    get view() {
      return { screen: s.screen, phase: s.phase, inputOpen: legal().length > 0, modal: s.modal, heroSelect: s.screen === 'heroSelect' ? { heroes: [{ row: '幽冥骑士', unlocked: true, unlockText: null }], picked: s.pickedHero } : null, run: s.run, hero: s.hero, field: [], map: s.map, inventory: { equip: [], backpack: s.run ? Array.from({ length: Math.floor(s.run.金币 / 3) }, (_, i) => ({ id: i })) : [] }, time: s.time };
    },
    legal,
    send,
    advance,
    runUntilInput,
    preview,
    digest,
    get coverage() {
      return s.coverage;
    },
  };
}
