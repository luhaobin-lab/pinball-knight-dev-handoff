import { describe, expect, it } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { 蓝图_装饰品_铁砧 } from '../../src/content/bp/环境/装饰品/蓝图_装饰品_铁砧.ts';
import { legal, commands, view } from '../../src/core/sys/turn/input.ts';
describe('source room decoration anvil interface',()=>{
 it('actual forge room instantiates one source anvil, projects it, and accepted interact opens manufacture without a ManeActor skill cast',()=>{
  const f=fixture();f.w.mode.场上有敌人=false;f.w.mode.当前总层数=99;f.w.mode.当前层地图格配置表={DataTable:null,RowName:'锻造房'};f.w.mode.当前层配置=layerOf('锻造房',0)!;expect(f.w.mode.当前层配置).toBeTruthy();
  const room=f.w.spawn(蓝图_房间);f.w.mode.当前房间实例=room;room.激活房间(5,7);const anvils=room.房间装饰品.filter(x=>x instanceof 蓝图_装饰品_铁砧);expect(anvils).toHaveLength(1);
  f.w.mode.当前环节='交互场牌';f.w.mode.玩家控制器!.玩家可与环境交互=true;const id=anvils[0]!.id;expect(legal(f.w).find(s=>s.type==='interact')?.params?.actor).toContain(id);expect(view(f.w).field?.find(x=>x.id===id)?.row).toBe('铁砧');
  expect(commands.interact!(f.w,{type:'interact',actor:id}).ok).toBe(true);expect(f.w.cult.制造页关闭了).toBe(false);
 });
});
