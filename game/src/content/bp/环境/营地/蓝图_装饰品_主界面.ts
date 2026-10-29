import { 蓝图_装饰品 } from '../装饰品/蓝图_装饰品.ts';
/** Source has zero event/function bodies: its content is the SCS background, wordmark and two light systems.
 * Runtime titleScreen renders the procedural fungal backdrop and its existing animated title over that composition.
 * The asset identity is retained as data; no invented gameplay or periodic callbacks are attached.
 */
export class 蓝图_装饰品_主界面 extends 蓝图_装饰品 {
 static override readonly path='CatapultHero/BP/环境/营地/蓝图_装饰品_主界面';
 readonly 呈现组件=['营地背景2_Sprite','logo_Sprite','粒子_主界面光','粒子_主界面光2']as const;
}
