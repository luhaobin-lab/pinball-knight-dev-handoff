import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';
import { InputMapper } from '../../src/game/input';
import { piercingProfile } from '../../src/core/sim/collision-profile';

function setup() {
  const g = createGame({ seed:6,content:registry,filter:'ported',debug:{skipPrologue:true} });
  const bot=scriptedPolicy(),rng=botRng(6,0);
  for(let step=0;step<80;step++){
    g.runUntilInput();if(g.world.mode.场上有敌人&&g.view.phase==='交互场牌'&&!g.view.modal&&g.legal().some(c=>c.type==='aim.release'))break;
    const cmd=bot.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step});if(!cmd)throw Error('no command');g.send(cmd as Command);
  }
  const h=g.world.mode.玩家角色!;h.添加技能({DataTable:'CatapultHero/数据表/技能/数据表_技能_默认',RowName:'幻影斩'},1,0);
  return{g,h,a:h.拥有的主动能力[1]!};
}

describe('phantom source targeting and finite movement',()=>{
 it('selects without cooldown/payment; right-click cancels; real release consumes same pure indicator endpoint then finishes',()=>{
  const {g,h,a}=setup(),input=new InputMapper(),beforeMana=g.view.hero!.stamina;
  expect(g.send({type:'skill.press',slot:1}).ok).toBe(true);expect(h.有选中主动技能).toBe(true);expect(a.冷却效果).toBeNull();
  const enemy=g.view.field.find(e=>e.kind==='enemy')!,aim={x:enemy.position.x,y:enemy.position.y};
  const before=g.digest(),rng=g.world.rng.save(),preview=g.previewSkill!(aim)!;
  for(let i=0;i<10;i++)g.previewSkill!(aim);expect(g.digest()).toBe(before);expect(g.world.rng.save()).toEqual(rng);
  expect(preview.radius).toBe(200);
  input.setState({aimable:true,selectedSkill:true,hero:h.K2_GetActorLocation(),menuOpen:false,modal:false});
  const cancel=input.down(2,{floor:aim,hud:null})[0] as{cmd:Command};expect(cancel.cmd.type).toBe('skill.cancel');expect(g.send(cancel.cmd).ok).toBe(true);
  expect(h.有选中主动技能).toBe(false);expect(a.冷却效果).toBeNull();expect(g.view.hero!.stamina).toBe(beforeMana);
  expect(g.send({type:'skill.press',slot:1}).ok).toBe(true);
  const attack=vi.spyOn(h,'发动攻击');
  input.down(0,{floor:aim,hud:null});const release=input.up(0,{floor:aim,hud:null})[0]as{cmd:Command};expect(release.cmd.type).toBe('skill.target');
  const snapped=(release.cmd as Extract<Command,{type:'skill.target'}>).at,actual=g.previewSkill!(snapped)!;
  expect(g.send(release.cmd).ok).toBe(true);expect(h.目标位置).toEqual(actual.end);expect(a.冷却效果?.剩余回合).toBe(10);expect(piercingProfile(h)).toBe(true);
  const result=g.runUntilInput(15);expect(result).not.toBe('timeout');expect(result).not.toBe('idle');
  // Source actor tick now runs continuously for fog. After the one phantom strike, the resulting ordinary
  // collision invokes 可控反弹时交互 with the default launch skill; it is not a second phantom hop.
  expect(attack.mock.calls.filter(([skill])=>skill===a)).toHaveLength(1);
  expect(attack.mock.calls.map(([skill])=>skill?.能力名)).toEqual(['幻影斩','可控挥击']);
  expect(h.释放技能中).toBe(false);expect(h.有选中主动技能).toBe(false);expect(piercingProfile(h)).toBe(false);
 });
});
