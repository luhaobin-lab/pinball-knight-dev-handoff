/** Batch `core-ai`: the Demo blueprint classes this card ported (WAVE_A Appendix W1). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_大肠酸液 } from '../Skill/Ability/敌人/蓝图_能力_大肠酸液.ts';
import { 蓝图_能力_弹射 } from '../Skill/Ability/敌人/蓝图_能力_弹射.ts';
import { 蓝图_能力_治愈_强固 } from '../Skill/Ability/敌人/蓝图_能力_治愈_强固.ts';
import { 蓝图_效果_弹射 } from '../Skill/效果/蓝图_效果_弹射.ts';
import { 蓝图_效果_意图 } from '../Skill/效果/敌人/蓝图_效果_意图.ts';
import { 蓝图_效果_肉弹战车 } from '../Skill/效果/敌人/蓝图_效果_肉弹战车.ts';
import { 蓝图_效果_血卵孵化 } from '../Skill/效果/敌人/蓝图_效果_血卵孵化.ts';

const batch: readonly BpCtor[] = [蓝图_效果_意图, 蓝图_效果_血卵孵化, 蓝图_效果_肉弹战车, 蓝图_效果_弹射, 蓝图_能力_弹射, 蓝图_能力_治愈_强固, 蓝图_能力_大肠酸液];
export default batch;
