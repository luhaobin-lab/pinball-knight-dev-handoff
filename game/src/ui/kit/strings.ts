import { text } from '../../content/text/strings';

/**
 * The fixed labels of the kit's pages by their Demo loc keys (namespace ''), resolved through `src/content/text`
 * (zh). Variable text arrives in the view models.
 */
export const STR_KEYS = {
  loot: '41DED0FA4C004517F066FFACF043AA32', // 战利品
  retreat: '63D4F975424F9EE90B06A3B194F313E5', // 撤退
  victory: 'B8B66C5F4F4097A58014D3B1C560A893', // 胜利
  failure: '9EFB066947CA42CAC91642AE68EA946E', // 失败
  challengeDone: '453BD3314CE7059D6104BCAEDAEC218E', // 挑战成功
  use: '4C7B9D334BC7677FFBFE34B051360775', // 使用
  modify: '5D954F1B4BC3732EAF7CF99D31D34881', // 改造
  dismantle: '2572016E401F2DC5D02D87809D89B69A', // 分解
  dismantleGain: '669357AF4C7762664C46BBBC3AE73CAD', // 分解获得：
  durability: 'E9B83D994EDFDA10CC9D1DAA93AF9B7C', // 耐久：
  unreachable: 'EEBA711445930DFBE4B5B0A3E8CAF818', // 无法抵达
  room: 'FD4F8A8247E1E5DBEA7403B501BB625F', // 房间
  objective: 'FE91013147606236E43FFF95CE7C3CDF', // 目标
  reward: '781928B6447B722FA84D3BA9A5C94586', // 奖励
  locked: '35AC4488488EF9C7727504B6BEF9A47E', // 未解锁
  reroll: '77608AEE4BC84F2AFA58A5AD385FCB70', // 刷新
  continue: '2F368B5D47B55CD6C036FFA75B21FA50', // 继续
  staminaCost: '0BCCF75C455A65799B261CB84707FE22', // 体力消耗:
  cooldownTurns: '0F76C46440CBB930823977BDD3739140', // 冷却回合:
  pickUp: '2F46BA1B4DBAC702F8B637A5BF68F64D', // 拾取
} as const;

type Label = keyof typeof STR_KEYS;

export const STR = {
  ...(Object.fromEntries(Object.entries(STR_KEYS).map(([k, key]) => [k, text('', key)])) as Record<Label, string>),
  /** 品质 names (strings `<青铜>青铜</>` …, glossary #35–#67). */
  qualityName: ['青铜', '白银', '黄金', '钻石'] as const,
};
