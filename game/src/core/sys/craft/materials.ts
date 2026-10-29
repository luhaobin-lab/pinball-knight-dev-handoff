/** Direct 函数库_工具 source #1015/#1054/#1781. The mutation loop intentionally walks existing destination keys. */
import type { CraftFns } from '../../bp/systems.ts';
import { 数据表_材料 } from '../../../content/demo/tables.ts';
import { Divide_IntInt } from '../../math/kismet.ts';

export const materialFns: NonNullable<CraftFns['函数库_工具']> = {
  修改材料数量(ctx, source, change, multiplier, subtract) {
    for (const key of [...source.keys()]) {
      const n = Math.imul(change.get(key) ?? 0, multiplier), current = source.get(key) ?? 0;
      source.set(key, (subtract ? current - n : current + n) | 0);
      if (!subtract) materialFns.尝试合成材料!(ctx, source, key);
    }
  },
  材料需求判断(_ctx, need, owned, multiplier, createUI) {
    let total = 0, required = 0, satisfied = 0;
    const cells: { row: string; owned: number; need: number; sufficient: boolean }[] = [];
    for (const [name, base] of need) {
      total = (total + base) | 0; const count = Math.imul(base, multiplier); if (count <= 0) continue;
      required++; const have = owned.get(name) ?? 0; if (have >= count) satisfied++;
      if (createUI) cells.push({ row: name, owned: Math.min(have, 99), need: count, sufficient: have >= count });
    }
    return { 满足需求: satisfied >= required, 创建的材料格: cells, 需求材料总数: total };
  },
  尝试合成材料(_ctx, storage, name) {
    const row = (数据表_材料.rows as Record<string, { 合成数: number; 合成物: string }>)[name]; if (!row) return;
    const old = storage.get(name) ?? 0; if (!(row.合成数 > 0 && old >= row.合成数)) return;
    storage.set(name, old % row.合成数); storage.set(row.合成物, (Divide_IntInt(old, row.合成数) + (storage.get(row.合成物) ?? 0)) | 0);
  },
  判断生产状态(ctx) { return { 生产中: ctx.world.mode.生产状态句柄 !== '' }; },
};
