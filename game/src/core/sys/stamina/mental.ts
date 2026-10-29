/**
 * The mental-state entry points on the hero (SCM-071, SCM-079): BP_Actor_Player.获得精神状态 and the empty
 * 精神系统 stub. Demo: BP/Actor/BP_Actor_Player.txt ln 389–452 (L370, L1784, L1999, L2132).
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 结构_技能 } from '../../../content/demo/types.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';

/**
 * `结构_存档_精神` at run time: the Demo stores the ability object in 能力实例 (the generated field type holds the data
 * shape, an asset path; see the result's needs).
 */
export interface 精神存档条目 {
  能力实例: 蓝图_能力 | null; 唯一ID: string; 能力等级: number; 能力品质: number; 剩余回合: number; 叠加层数: number;
}

export function 精神存档Of(hero: BP_Actor_Player): Map<string, 精神存档条目> {
  return hero.精神存档 as unknown as Map<string, 精神存档条目>;
}

const 合成数据表_技能 = 'CatapultHero/数据表/合成数据表_技能';

/** SCM-079: a bare `Return` in the Demo; every caller is a no-op. Do not port the morale/sanity meter. */
export function 精神系统(_self: BP_Actor_Player, _神智: number, _斗志: number, _Debug: string, _结算: boolean): void {}

/**
 * SCM-071. A save entry with a valid ability re-runs that ability; else a new `蓝图_能力_获得精神状态` (the row's 能力类)
 * is spawned from `合成数据表_技能[类型名]`, keeping the saved 唯一ID only for an old entry (L1999 `非旧档？`).
 */
export function 获得精神状态(self: BP_Actor_Player, 精神类型: string, 是读档: boolean): void {
  const save = 精神存档Of(self);
  let 非旧档 = false;
  const 类型名 = 精神类型;
  const entry = save.get(类型名);
  if (entry) {
    if (self.world.isValid(entry.能力实例)) {
      entry.能力实例.执行技能(是读档);
      return;
    }
    非旧档 = entry.唯一ID !== ''; // L1999
  }
  // L370
  const row = self.world.data.table(合成数据表_技能)?.rows[类型名] as 结构_技能 | undefined;
  if (!row) return; // L1784: PrintString of whether the row name exists (debug only)
  const cls = row.能力.能力类;
  if (!cls) return; // SPEC-GAP: BeginDeferredActorSpawnFromClass(None) fails; no mental row has an empty 能力类.
  const found = save.get(类型名);
  const a = self.world.spawn<蓝图_能力>(cls, x => {
    x.唯一ID = 非旧档 && found ? found.唯一ID : `${类型名}//精神状态`;
    x.能力名 = 类型名;
    x.拥有者 = self;
    x.等级 = found ? found.能力等级 : 1;
    x.品质 = found ? found.能力品质 : 1;
    x.种子 = 0;
  });
  a.K2_AttachToActor(self);
  a.技能配置 = row;
  a.初始化();
  a.子初始化();
  a.执行技能(是读档);
}
