import * as THREE from 'three';
import { createCombatHud, type CombatHud, type CombatHudOptions, type EnemyMark, type IntentKind } from '../../ui';
import play from './play';
import { defineScene, type SceneContext } from '../types';

/**
 * The Ink & Bone combat HUD over the reference combat room (play). The default state is the
 * Demo's ss2.jpg: level 1, HP 100/100, stamina 98/100, three small cards in the grid (a potion
 * healing 15 with 3 uses, a second potion, a weapon with heal 5 / damage 3 and ×2), one free row
 * and three locked slots, empty skill slots, the quest line bottom-left; the hero is aiming with
 * enemies on the field (当前环节 交互场牌, 场上有敌人？).
 * ?demo=marks,popups,status,rank,lowhp adds sample enemy marks (head bars, intents, a weak point;
 * play.ts still draws its own pips under them), popups, statuses, the turn summary and low HP
 * (the pulsing frame). The popups: four hits on one enemy (序号 0–3, so they appear 0.15 s apart and
 * fan 48 units further each), an enemy healing itself (red), the hero healed by a potion card
 * (sapphire, rising from the card), a charge and a bleed tick.
 */

const SAMPLE: NonNullable<CombatHudOptions['state']> = {
  hero: { hp: 100, hpMax: 100, stamina: 98, staminaMax: 100, level: 1, exp: 30, expMax: 100, corruption: 0, corruptionMax: 100 },
  aiming: true,
  enemiesOnField: true,
  items: [
    { id: 'potion-a', row: 0, size: 1, icon: 'potion', type: 'consumable', heal: 15, durability: 3 },
    { id: 'potion-b', row: 1, size: 1, icon: 'potion', type: 'consumable', durability: 3 },
    { id: 'blade', row: 2, size: 1, icon: 'dagger', type: 'weapon', heal: 5, damage: 3, combo: 2, charge: 0.45 },
  ],
  unlockedRows: 4,
  quest: { title: '往日回忆', line: '通过第<数值>3/36</>层' },
};

const INTENTS: IntentKind[] = ['attack', 'attack', 'special', 'heal', 'attack', 'fortify'];

let hud: CombatHud | null = null;
let demo = new Set<string>();
const fired = new Set<string>();

async function setup(ctx: SceneContext): Promise<void> {
  await play.setup(ctx);
  demo = new Set((ctx.params.get('demo') ?? '').split(',').filter(Boolean));
  const state = structuredClone(SAMPLE);
  if (demo.has('status')) state.statuses = [{ kind: 'flow', turns: 2 }, { kind: 'bleed', turns: 3 }, { kind: 'guard', turns: 1 }];
  if (demo.has('rank'))
    state.turnStats = {
      rank: 'SS',
      progress: 0.6,
      lines: [
        { value: '5', label: '反弹' },
        { value: '1k', label: '所有伤害' },
        { value: '4', label: '触发会心' },
        { value: '66', label: '强固' },
        { value: '1', label: '击杀敌人' },
      ],
    };
  if (demo.has('lowhp')) state.hero = { ...state.hero, hp: 31, armor: 12, dotPending: 9 };
  hud = await createCombatHud({ renderer: ctx.renderer, state });
}

/**
 * Floor positions of the play scene's mobs, read from the scene graph (play.ts keeps its state
 * private): each mob group stays at the origin and its drop shadow (y 0.01) sits under the body.
 */
function mobs(scene: THREE.Scene): THREE.Vector3[] {
  return scene.children
    .filter(o => o.name.startsWith('mob-'))
    .map(o => o.children.find(c => Math.abs(c.position.y - 0.01) < 1e-6)?.position.clone() ?? new THREE.Vector3(12, 0, 6));
}

function update(ctx: SceneContext, dt: number): void {
  play.update?.(ctx, dt);
  const h = hud;
  if (!h) return;
  if (demo.has('marks')) {
    const marks: EnemyMark[] = mobs(ctx.scene).map((m, i) => ({
      id: `mob-${i}`,
      at: { x: m.x, y: 0, z: m.z },
      head: { x: m.x, y: 2.4, z: m.z },
      hp: [6, 3, 2, 4, 3, 2][i % 6],
      hpMax: [8, 3, 2, 5, 4, 2][i % 6],
      armor: i === 0 ? 3 : 0,
      dot: i === 3 ? 1 : 0,
      elite: i === 0,
      intent: { kind: INTENTS[i % INTENTS.length], value: [14, 6, undefined, 9, 7, 4][i % 6] },
      weak: i === 2,
    }));
    h.setEnemies(marks);
  }
  if (demo.has('popups')) {
    const once = (key: string, at: number, fn: () => void): void => {
      if (ctx.time >= at && !fired.has(key)) {
        fired.add(key);
        fn();
      }
    };
    const list = mobs(ctx.scene);
    const p = (i: number): THREE.Vector3Like => ({ x: list[i]?.x ?? 12, y: 2, z: list[i]?.z ?? 6 });
    // sample 高度 55 (数据表_敌人_普通 大肠) and 旋转 20 (the hit direction plus the attacker's pick)
    const hit = { at: { world: p(2) }, height: 55, angle: 20 } as const;
    once('d1', 0.1, () => {
      for (const stack of [0, 1, 2]) h.popup({ kind: 'damage', value: [12, 9, 14][stack], stack, ...hit });
      h.popup({ kind: 'crit', value: 36, stack: 3, ...hit });
    });
    once('h1', 0.2, () => h.popup({ kind: 'heal', hero: false, value: 9, at: { world: p(3) }, angle: -40 }));
    once('h2', 0.3, () => h.popup({ kind: 'heal', hero: true, value: 15, at: { item: 'potion-a' } }));
    once('c1', 0.6, () => h.popup({ kind: 'charge', value: 15, at: { item: 'blade' } }));
    once('t1', 0.4, () => h.popup({ kind: 'dot', value: 3, prefix: '流血', at: { world: p(0) }, height: 55 }));
  }
  h.update(dt);
}

export default defineScene({
  name: 'ui-hud',
  description: 'Ink & Bone combat HUD (Demo layout) over the reference combat room; ?demo=marks,popups,status,rank,lowhp',
  setup,
  update,
});
