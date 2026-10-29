import { CHOICE_CENTRE } from '../ui/pages/multi-choice/layout';

/**
 * The play area's centre x (internal px of 960×540): the Demo's own anchor of the dialogs over the run (多选一父级 at
 * 960 + 288 of 1920; the reward stack 奖励提示框 sits under it). The room (room/stage.ts) and every dialog over the run
 * (pages/play-modal.ts) are centred on it; the full-screen run end stays on the screen's centre.
 */
export const PLAY_CX = CHOICE_CENTRE.x / 2;
