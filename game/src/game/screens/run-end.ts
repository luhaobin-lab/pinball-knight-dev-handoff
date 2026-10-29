import { backdrop, type ScreenController, type ScreenDeps } from './controller';

/** UI_冒险结束统计页 over the void. */
export const runEndScreen = (deps: ScreenDeps): ScreenController => backdrop('runEnd', false, deps);
