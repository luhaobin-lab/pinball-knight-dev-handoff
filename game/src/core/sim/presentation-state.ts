/** Actual source override at emission; afterimages copy its identity and replay at their fixed position. */
export interface AnimationSnapshot { readonly sequence:string; readonly startedAt:number; readonly seconds:number; readonly loop:boolean }
export interface HasAnimationSnapshot { ug_animation?:AnimationSnapshot }
/** PaperFlipbook relative X scale, set only by BP_ManeActor.更新朝向's source guards. */
export interface HasSpriteFacing { ug_spriteScaleX?:1|-1 }
