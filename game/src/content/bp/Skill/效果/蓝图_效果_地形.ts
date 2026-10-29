/**
 * 蓝图_效果_地形 — the base of one terrain cell: it registers itself in the game mode's 地形环境 at 所在位置 (replacing and
 * destroying a previous terrain there) and tells its 地形管理组 when it is gone. Parent of 酸液池 and the wave-B terrains.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_地形 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/蓝图_效果_地形.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.主动激活, 效果.时机.新一天时.
 * Rows: none.
 * Batch: core-physics.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { Vec3 } from '../../../../core/sim/types.ts';
import type { AssetPath } from '../../../demo/types.ts';
import type { 蓝图_效果_地形管理组 } from './物品/蓝图_效果_地形管理组.ts';

/** TMap<FVector, …> finds keys by value; a JS Map compares object keys by identity. The stored key equal to `v`. */
export function terrainKey<V>(m: Map<Vec3, V>, v: Vec3): Vec3 | undefined {
  for (const k of m.keys()) if (k.x === v.x && k.y === v.y && k.z === v.z) return k;
  return undefined;
}

export class 蓝图_效果_地形 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_地形';
  序号: number = 0;
  地形激活: boolean = false;
  地形管理组: 蓝图_效果_地形管理组 | null = null;
  中心格: boolean = false;
  所在位置: Vec3 = { x: 0, y: 0, z: 0 };
  // CDO overrides of inherited variables (applied by the runtime from the manifest, never redeclared):
  //   触发时机 = '效果.时机.主动激活'

  // Empty hooks of the subclasses (地块指示 merging; no wave-A terrain overrides them).
  合并(_对方: unknown, _是上下: boolean, _边界: boolean): void {}
  临近合并(_他: unknown, _是上下: boolean): void {}
  更新(): void {}

  // L191
  override 销毁前触发(): void {
    this.地形激活 = false;
  }

  // L207: Map_Find / Map_Add on 游戏模式.地形环境 by value.
  override 激活后触发(_Debug: string): void {
    const m = this.游戏模式?.地形环境;
    if (!m) return;
    const key = terrainKey(m, this.所在位置);
    if (key !== undefined) {
      const old = m.get(key) ?? null;
      if (this.world.isValid(old)) old.销毁效果();
    }
    // L573: Map_Add replaces the value of an existing key in place.
    const k = terrainKey(m, this.所在位置) ?? { ...this.所在位置 };
    m.set(k, this);
  }

  // L10
  override 销毁后触发(): void {
    if (this.world.isValid(this.地形管理组)) this.地形管理组.删除地形(this);
    // L114: PrintString "Hello" (debug output, dropped).
  }
}
