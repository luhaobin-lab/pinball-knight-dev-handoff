/** Source L10/L15: both original events return without any operation. This is an intentional source-empty class. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_稳固射击 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_稳固射击';
  已触发 = false;
  override 激活后触发(_d: string): void {}
  override 持续中触发(_t: Tag): void {}
}
