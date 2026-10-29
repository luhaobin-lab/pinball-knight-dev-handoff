import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { FRAME } from '../../src/core/sim/clock';

function setup() {
  const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();
  const h=g.world.mode.玩家角色!; h.更新运动数据(); return { g,h };
}

describe('BP mover is source movement, independent from native preview playback', () => {
  it('uses .01 minimum, original curve and +X height arc, then signals arrival exactly once', () => {
    const {g,h}=setup(), start={...h.当前位置};
    h.关闭碰撞(); // Source jump gate: this vector isolates the curve, not the camp's newly restored final sweep.
    h.目标位置={x:start.x+400,y:start.y,z:start.z};
    const end=vi.spyOn(h,'结束移动判断');
    h.移到目标地点('卡牌平面位移曲线','卡牌高度位移曲线',800,200);
    expect(h.移动所需时长).toBe(.5);
    g.advance(FRAME); expect(h.K2_GetActorLocation().z).toBe(h.高度);
    g.advance(.1); expect(h.K2_GetActorLocation().x).toBeGreaterThan(start.x);expect(h.K2_GetActorLocation().z).toBe(h.高度);
    g.advance(.4);
    expect(h.K2_GetActorLocation()).toEqual({x:start.x+400,y:start.y,z:h.高度});
    expect(h.移动中).toBe(false);expect(end).toHaveBeenCalledOnce();
    g.advance(.5);expect(end).toHaveBeenCalledOnce();
    h.更新运动数据();h.目标位置={...h.当前位置};h.移到目标地点('卡牌平面位移曲线','卡牌高度位移曲线',800,0);
    expect(h.移动所需时长).toBe(.01);g.advance(FRAME);expect(h.移动中).toBe(false);
  });
  it('frame and uneven advancement retain identical full simulation state and source piercing toggles', () => {
    const a=setup(),b=setup();
    for(const {g,h}of[a,b]){h.目标位置={x:h.当前位置.x+160,y:h.当前位置.y+80,z:0};h.切换穿透状态(true);h.移到目标地点('闪避曲线','卡牌高度位移曲线',3000,0);expect(h.HasMatchingGameplayTag('状态.不可阻挡')).toBe(true);void g;}
    for(let i=0;i<30;i++)a.g.advance(FRAME);for(const d of[.03,.17,.3])b.g.advance(d);
    expect(a.g.digest()).toBe(b.g.digest());
    a.h.切换穿透状态(false);expect(a.h.HasMatchingGameplayTag('状态.不可阻挡')).toBe(false);
  });
});
