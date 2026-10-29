/** Minimal source capsule profile state, stored on the actor so digest/save observe it.
 * DefaultEngine.ini:178 穿透状态 is PhysicsOnly, ignores Pawn/projectile/Visibility/Camera but still blocks terrain.
 * This is not the broad 不可阻挡 gameplay tag (boss effects may use that tag without changing their profile).
 */
export interface CapsuleProfileState { ug_碰撞配置?: 'Pawn' | '穿透状态' }
export const piercingProfile = (actor: object): boolean => (actor as CapsuleProfileState).ug_碰撞配置 === '穿透状态';
export const queryProfileEnabled = (actor: object): boolean => !piercingProfile(actor);
