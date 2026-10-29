/** BP_Actor_Player Sphere BeginOverlap, source L23377 -> L6570/L6846 -> Delay.15 -> L931. */
import type { LaunchFns } from '../../bp/systems.ts';
import { BpObject } from '../../sim/object.ts';

export const nearMissPlayer: NonNullable<LaunchFns['BP_Actor_Player']> = {
  BndEvt__BP_Actor_Player_Sphere_K2Node_ComponentBoundEvent_1_ComponentBeginOverlapSignature__DelegateSignature(self, _component, other, _otherComponent, _bodyIndex, _sweep, _hit) {
    const mode = self.游戏模式;
    if (!self.world.isValid(mode) || !(other instanceof BpObject) || !other.OwnedGameplayTags.has('可交互.角色.AI.仇恨')) return;
    if (mode.当前环节 !== '进行战斗' || self.移动中 || !self.疲劳了) return;
    self.delay('Player near-miss 269837090', 0.15, () => {
      // L794/L931 deliberately does not recheck the phase, movement or fatigue after the delay.
      if (self.OwnedGameplayTags.has('状态.反弹中')) return;
      self.获得精神状态('幸运', false);
      mode.更新回合战斗统计('擦肩而过', { 系数: 1, 指数: 0 }, 35, 3, '速降衰减', '');
      const p = self.K2_GetActorLocation();
      self.fx.popup({ popup: 'text', value: '擦肩而过', target: self.id, at: { ...p, z: p.z + 14 } });
    });
  },
};
