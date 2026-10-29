/** Batch `core-launch-sys`: the Demo blueprint classes this card ported (WAVE_A A16, Appendix W1: 14 classes). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_效果_可控弹射 } from '../Skill/效果/蓝图_效果_可控弹射.ts';
import { 蓝图_效果_反弹中 } from '../Skill/效果/蓝图_效果_反弹中.ts';
import { 蓝图_效果_可控反弹时交互 } from '../Skill/效果/蓝图_效果_可控反弹时交互.ts';
import { 蓝图_效果_反弹时攻击 } from '../Skill/效果/蓝图_效果_反弹时攻击.ts';
import { 蓝图_效果_可控反弹动画 } from '../Skill/效果/蓝图_效果_可控反弹动画.ts';
import { 蓝图_效果_时间变速 } from '../Skill/效果/蓝图_效果_时间变速.ts';
import { 蓝图_效果_残影 } from '../Skill/效果/蓝图_效果_残影.ts';
import { 蓝图_效果_闪烁 } from '../Skill/效果/蓝图_效果_闪烁.ts';
import { 蓝图_效果_蓄能攻击时XX } from '../Skill/效果/蓝图_效果_蓄能攻击时XX.ts';
import { 蓝图_效果_蓄能碰撞XX时XX } from '../Skill/效果/蓝图_效果_蓄能碰撞XX时XX.ts';
import { 蓝图_效果_蓄能造成额外伤害 } from '../Skill/效果/物品/蓝图_效果_蓄能造成额外伤害.ts';
import { 蓝图_效果_蓄能造成持续伤害 } from '../Skill/效果/物品/蓝图_效果_蓄能造成持续伤害.ts';
import { 蓝图_能力_挥击 } from '../Skill/Ability/玩家/蓝图_能力_挥击.ts';
import { 蓝图_能力_灌注 } from '../Skill/Ability/道具/蓝图_能力_灌注.ts';

const batch: readonly BpCtor[] = [
  蓝图_效果_可控弹射, 蓝图_效果_反弹中, 蓝图_效果_可控反弹时交互, 蓝图_效果_反弹时攻击, 蓝图_效果_可控反弹动画, 蓝图_效果_时间变速,
  蓝图_效果_残影, 蓝图_效果_闪烁, 蓝图_效果_蓄能攻击时XX, 蓝图_效果_蓄能碰撞XX时XX, 蓝图_效果_蓄能造成额外伤害, 蓝图_效果_蓄能造成持续伤害,
  蓝图_能力_挥击, 蓝图_能力_灌注,
];
export default batch;
