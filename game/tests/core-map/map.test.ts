import { describe, expect, it } from 'vitest';
import { findRow, 数据表_地图格 } from '../../src/content/demo/index.ts';
import { 筛选地图格池, 近期X次出现 } from '../../src/core/sys/map/pool.ts';
import { newMapPage, 保存地图页, 获取层数品质, 重置关卡页, 重置地图页, 进入关卡 } from '../../src/core/sys/map/page.ts';
import { handleOf } from '../../src/core/sys/map/types.ts';
import { simulateRun, type RunRecord } from './drive.ts';
import { fakeEnv } from './fake-env.ts';

const SPECIAL = new Set(['空', '传奇房', '恢复点', '锻造房', '营地', '首领战斗']);

/** Checks every invariant of the WAVE_A core-map card on one run. */
function checkRun(r: RunRecord): void {
  expect(r.rows.length).toBe(13);  // rows 0–12
  for (const row of r.rows) expect(row).toHaveLength(3);
  expect(r.rows[0]).toEqual(['空', '营地', '空']);
  expect(r.rows[1]).toEqual(['第一层', '第一层', '第一层']);
  const firstRewards = r.tiles.filter(t => t.row === 1).map(t => t.reward).sort();
  expect(firstRewards).toEqual(['初始奖励A', '初始奖励B', '初始奖励C']);
  expect(r.rows[12]).toEqual(['空', '首领战斗', '空']);
  expect(r.tiles.filter(t => t.row === 11).every(t => t.nextBoss)).toBe(true);
  expect(r.tiles.filter(t => t.row !== 11).some(t => t.nextBoss)).toBe(false);
  // 解锁层数 and the 随机事件 tag for every drawn tile.
  for (const t of r.tiles) {
    if (t.row === 0 || t.row === 12) continue;
    const row = findRow(数据表_地图格, t.name);
    expect(row, t.name).toBeDefined();
    if (!row) continue;
    expect(t.row >= row.解锁层数.Min && t.row <= row.解锁层数.Max, `${t.name} on row ${t.row}`).toBe(true);
    expect(row.标签.length === 0 || row.标签.includes('能力.类型.奖励.随机事件'), t.name).toBe(true);
    if (t.name === '空') expect(t.row).toBeGreaterThanOrEqual(2);
    expect(['天赋房', '测试', '首领战斗']).not.toContain(t.name);
  }
  // 传奇房 at most once; no plain duplicates inside a row.
  expect(r.rows.flat().filter(n => n === '传奇房').length).toBeLessThanOrEqual(1);
  for (const row of r.rows.slice(2, 12)) {
    const plain = row.filter(n => !SPECIAL.has(n));
    expect(new Set(plain).size, row.join()).toBe(plain.length);
  }
  // History rules: combat tiles never within their exclusion window (history = 3 offered tiles per row, newest first).
  const history: string[] = [];
  for (let i = 0; i < r.rows.length; i++) {
    const row = r.rows[i] as string[];
    if (i >= 2 && i <= 11) {
      for (const [name, short] of [['简单战斗', 5], ['普通战斗', 7], ['精英战斗', 10]] as const) {
        if (row.includes(name)) expect(history.slice(0, short), `${name} row ${i}`).not.toContain(name);
      }
    }
    for (const n of row) history.unshift(n);  // UI_关卡地图页面 L944 inserts each tile at 0
  }
  // Rewards: hero tag filter (no other hero's item tables) and reward levels.
  for (const t of r.tiles) {
    expect(t.reward ?? '').not.toMatch(/闪避|流血|剧毒|治愈$|气地|火电/);
    if (t.reward === '复合奖励') expect(t.level).toBe(findRow(数据表_地图格, t.name)?.奖励等级);
    else if (t.reward !== null) expect(t.level).toBe(1);
  }
}

describe('core-map: map generation (遗迹)', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: invariants and golden rows 0–4 + boss row`, async () => {
      const r = simulateRun(fakeEnv({ seed }));
      checkRun(r);
      const golden = r.tiles.filter(t => t.row <= 4 || t.row === 12);
      await expect(JSON.stringify(golden, null, 1)).toMatchFileSnapshot(`golden/map-seed-${seed}.json`);
    });
  }

  it('is a pure function of the seed (same seed, same map)', () => {
    expect(simulateRun(fakeEnv({ seed: 77 })).tiles).toEqual(simulateRun(fakeEnv({ seed: 77 })).tiles);
    expect(simulateRun(fakeEnv({ seed: 77 })).rows).not.toEqual(simulateRun(fakeEnv({ seed: 78 })).rows);
  });

  it('invariants hold over 200 seeds, and the chapter page then offers 营地 only', () => {
    for (let seed = 100; seed < 300; seed++) {
      const env = fakeEnv({ seed });
      const r = simulateRun(env);
      checkRun(r);
      expect(env.mode.通过关卡数).toBe(1);
      expect(r.page.页面).toBe(0);
      expect(r.page.当前关卡选项).toEqual(['营地']);
      expect(env.mode.本轮通过关卡).toEqual(['遗迹']);
    }
  });

  it('reachability: the next row with dx ∈ {−1, 0, 1}; unreachable next-row tiles turn 空', () => {
    const env2 = fakeEnv({ seed: 5 });
    const run2 = simulateRun(env2, (ts, page) => {
      const here = page.当前所在格!;
      for (const t of ts) {
        expect(Math.abs(t.坐标.X - here.坐标.X)).toBeLessThanOrEqual(1);
        expect(t.坐标.Y).toBe(here.坐标.Y + 1);
      }
      // The next row's unreachable tiles turned 空 (变空).
      for (const t of page.地图格数组) if (t.坐标.Y === here.坐标.Y + 1 && Math.abs(t.坐标.X - here.坐标.X) > 1) expect(t.地图格配置表).toBe('空');
      return ts[0]!;
    });
    expect(run2.visited.length).toBe(12);
  });

  it('chapter page: 遗迹 at 通过关卡数 0, 营地 at Demo关卡数 (and in the prologue)', () => {
    const env = fakeEnv({ seed: 9 });
    const page = newMapPage();
    env.mode.当前关卡名 = '营地';
    重置关卡页(env, page);
    expect(page.当前关卡选项).toEqual(['遗迹']);
    env.mode.当前关卡名 = '遗迹';
    env.mode.通过关卡数 = 1;
    重置关卡页(env, page);
    expect(page.当前关卡选项).toEqual(['营地']);
    // Entering 营地 is the run end (the caller opens the run-end page); a chapter rebuilds the map.
    expect(进入关卡(env, page, '营地')).toBe(false);
    env.mode.通过关卡数 = 0;
    env.mode.当前总层数 = 0;
    expect(进入关卡(env, page, '遗迹')).toBe(true);
    expect(page.页面).toBe(1);
    expect(env.mode.当前关卡最高层数).toBe(12);
  });
});

describe('core-map: prologue (新手关)', () => {
  it('rows 0–7 are [空, 营地, 空] then [空, 新手关0N, 空]; 营地 only after floor 7', () => {
    const env = fakeEnv({ seed: 4, prologue: true });
    const r = simulateRun(env);
    expect(r.rows).toEqual([
      ['空', '营地', '空'], ['空', '新手关01', '空'], ['空', '新手关02', '空'], ['空', '新手关03', '空'], ['空', '新手关04', '空'],
      ['空', '新手关05', '空'], ['空', '新手关06', '空'], ['空', '新手关07', '空'],
    ]);
    expect(r.visited).toEqual(['新手关01', '新手关02', '新手关03', '新手关04', '新手关05', '新手关06', '新手关07']);
    expect(r.page.当前关卡选项).toEqual(['营地']);
    expect(r.tiles.filter(t => t.row >= 1 && t.col === 1).map(t => t.reward)).toEqual(['获取物品_新手关', '复合奖励_新手关', '获取经验_新手关', '复合奖励_新手关', '获取锻造_新手关', '获取物品_新手关2', '复合奖励']);
  });
});

describe('core-map: 筛选地图格池 rules', () => {
  const fresh = (seed: number) => {
    const env = fakeEnv({ seed });
    const page = newMapPage();
    env.mode.当前关卡最高层数 = 12;
    return { env, page };
  };

  it('the boss tag gives [空, 首领战斗, 空] when 当前总层数 > 6, else [空, 精英战斗, 空]', () => {
    const { env, page } = fresh(1);
    env.mode.当前地图格标签队列 = ['能力.类型.奖励.复合奖励.首领', '能力.类型.奖励.复合奖励.首领'];
    env.mode.当前总层数 = 11;
    expect(筛选地图格池(env, page).map(h => h.RowName)).toEqual(['空', '首领战斗', '空']);
    env.mode.当前总层数 = 6;
    expect(筛选地图格池(env, page).map(h => h.RowName)).toEqual(['空', '精英战斗', '空']);
  });

  it('简单战斗 is forced when the last 9 offered tiles hold none (history ≥ 9), excluded within 5', () => {
    let forced = 0;
    for (let seed = 0; seed < 50; seed++) {
      const { env, page } = fresh(seed);
      page.地图格数量累计 = 9;  // floor 3
      page.地图格层数 = 3;
      env.mode.地图格历史 = ['宝箱房', '属性房', '探索房', '宝箱房', '属性房', '探索房', '宝箱房', '属性房', '探索房'].map(handleOf);
      const row = 筛选地图格池(env, page).map(h => h.RowName);
      expect(row).toContain('简单战斗');
      forced++;
    }
    expect(forced).toBe(50);
  });

  it('传奇房 is never offered once it is in the history, and its PRD counter advances on failure', () => {
    const { env, page } = fresh(3);
    page.地图格数量累计 = 15;
    page.地图格层数 = 5;
    env.mode.地图格历史 = [handleOf('传奇房')];
    const before = env.mode.传奇房触发计数;
    for (let i = 0; i < 30; i++) {
      env.mode.当前地图格标签队列 = ['能力.类型.奖励.随机事件'];
      expect(筛选地图格池(env, page).map(h => h.RowName)).not.toContain('传奇房');
    }
    expect(env.mode.传奇房触发计数).toBe(before);
    env.mode.地图格历史 = [];
    let seen = false;
    for (let i = 0; i < 200 && !seen; i++) {
      env.mode.当前地图格标签队列 = ['能力.类型.奖励.随机事件'];
      seen = 筛选地图格池(env, page).some(h => h.RowName === '传奇房');
    }
    expect(seen).toBe(true);
    expect(env.mode.传奇房触发计数).toBe(1);
  });

  it('恢复点 and 锻造房 follow their conditions', () => {
    const run = (o: { recovery?: boolean; forge?: boolean }) => {
      const env = fakeEnv({ seed: 8, ...o });
      env.mode.金币 = 10;
      const r = simulateRun(env);
      return r.rows.flat();
    };
    expect(run({})).not.toContain('恢复点');
    expect(run({}).filter(n => n === '锻造房')).toHaveLength(0);
    expect(run({ recovery: true })).toContain('恢复点');
    expect(run({ forge: true })).toContain('锻造房');
  });

  it('近期X次是否出现X奖励 reads the newest entries first', () => {
    const h = ['A', 'B', 'C'].map(handleOf);
    expect(近期X次出现(h, 2, 'C')).toEqual({ 有足够历史: true, 没出现过: true });
    expect(近期X次出现(h, 3, 'C')).toEqual({ 有足够历史: true, 没出现过: false });
    expect(近期X次出现(h, 4, 'A')).toEqual({ 有足够历史: false, 没出现过: false });
  });
});

describe('core-map: 获取层数品质', () => {
  it('floors 23/24/47/48 with 阈值 24 (CORE-M-TV-023)', () => {
    expect([0, 23, 24, 47, 48, 72].map(f => 获取层数品质(f, 24))).toEqual([1, 1, 2, 2, 3, 4]);
  });
});

describe('core-map: filter ported (G2 content)', () => {
  const G2_TILES = new Set(['空', '营地', '第一层', '宝箱房', '属性房', '探索房', '简单战斗', '普通战斗', '首领战斗']);
  const G2_ENEMIES = new Set(['眼球', '大肠', '大肠血卵', '守门人']);
  const ported = (table: string, row: string): boolean =>
    table.endsWith('/数据表_地图格') ? G2_TILES.has(row) : table.endsWith('/数据表_敌人_普通') ? G2_ENEMIES.has(row) : true;

  it('skips unported tiles and combat variants with unported enemies', () => {
    for (let seed = 0; seed < 100; seed++) {
      const r = simulateRun(fakeEnv({ seed, ported }));
      expect(r.rows.length).toBe(13);
      for (const t of r.tiles) {
        expect(G2_TILES.has(t.name), t.name).toBe(true);
        if (t.name === '简单战斗' || t.name === '普通战斗') expect([0, 1]).toContain(t.variant);
      }
    }
  });
});

describe('core-map: 1000-seed histogram (input for parity-stats)', () => {
  it('tile types offered per floor, leftmost-lane policy', async () => {
    const hist: Record<string, number>[] = [];
    for (let seed = 0; seed < 1000; seed++) {
      const r = simulateRun(fakeEnv({ seed }));
      r.rows.forEach((row, i) => { for (const n of row) { const h = (hist[i] ??= {}); h[n] = (h[n] ?? 0) + 1; } });
    }
    const sorted = hist.map(h => Object.fromEntries(Object.entries(h).sort((a, b) => b[1] - a[1])));
    // Old histogram-1000.json is preserved for pre-native PRD bfdf87e; source draw consumption now differs.
    await expect(JSON.stringify(sorted, null, 1)).toMatchFileSnapshot('golden/histogram-1000-native-prd.json');
  });
});

describe('core-map: tile save rows (结构_存档_地图格)', () => {
  it('保存地图页 → 读取地图页 restores the same tiles, rewards and variants', () => {
    const env2 = fakeEnv({ seed: 21 });
    const page = newMapPage();
    重置地图页(env2, page);
    const save = 保存地图页(page);
    expect(save.地图格存档数组).toHaveLength(12);
    const env3 = fakeEnv({ seed: 21 });
    env3.mode.当前关卡任务条 = env2.mode.当前关卡任务条;
    const page3 = newMapPage();
    重置地图页(env3, page3, JSON.parse(JSON.stringify(save)));
    const strip = (p: typeof page) => p.地图格数组.map(t => [t.地图格配置表, t.奖励, t.层配置序号, t.坐标.X, t.坐标.Y, t.可探索]);
    expect(strip(page3)).toEqual(strip(page));
    expect(page3.当前所在格?.地图格名).toBe('营地');
  });
});
