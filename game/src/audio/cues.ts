import type { WaveId } from './waves.ts';

/**
 * The cue table: every value is the Demo's, read from the MetaSound graphs (dump raw/Game/CatapultHero/声音/*.json,
 * decoded with tmp/feel/scripts/metasound3.py) and from the call sites that play them. Each layer is one instance of
 * the shared one-shot patch 音效_基础 (patch.ts): Wave Player → Delay Pitch Shift → One-Pole HPF → × 音量 → × AD
 * envelope, with its own RandomFloat(−5, 5) semitones per play.
 */

export type CueName = 'launch' | 'bump' | 'swing' | 'hit' | 'death' | 'step' | 'charge' | 'block' | 'arrow';
export type LoopName = 'wind';
export type GroupName = 'default' | 'many' | 'footstep' | 'interval';
export type BusName = 'master' | 'sfx' | 'ambience';

export const CUE_NAMES: readonly CueName[] = ['launch', 'bump', 'swing', 'hit', 'death', 'step', 'charge', 'block', 'arrow'];

/** SoundConcurrency assets: voices per group and the minimum time between two starts (RetriggerTime). */
export interface GroupDef {
  readonly demo: string;
  readonly maxCount: number;
  readonly retrigger: number;
}

export const GROUPS: Readonly<Record<GroupName, GroupDef>> = {
  default: { demo: '音效并发_默认', maxCount: 6, retrigger: 0 },
  many: { demo: '音效并发_大量', maxCount: 24, retrigger: 0.01 },
  footstep: { demo: '音效并发_脚步', maxCount: 8, retrigger: 0.2 },
  interval: { demo: '音效并发_零点一间隔', maxCount: 8, retrigger: 0.1 },
};

export interface LayerDef {
  /** Wave asset; several = MetaSound Random Get (equal weights, No Repeats 1, shared state). */
  readonly waves: readonly WaveId[];
  /** 播放速度: tempo with pitch compensation (changes time, not pitch). */
  readonly tempo: number;
  /** 音高: pure pitch shift, semitones. */
  readonly pitch: number;
  /** A RandomFloat(−n, n) wired into 音高 (extra pure pitch per play, semitones). */
  readonly pitchRandom: number;
  /**
   * 音效_基础_脚步: one RandomFloat(min, max) roll u multiplies both 音高 and 音量 (pitch = u × pitch,
   * volume = u × volume).
   */
  readonly roll?: readonly [number, number];
  /** Cutoff Frequency of the one-pole high-pass, Hz (0 = open). */
  readonly highpass: number;
  /** 最长时间: the AD envelope decays linearly over it, and the wave player stops at it, seconds. */
  readonly maxTime: number;
  /** Trigger Delay before the layer starts, seconds. */
  readonly delay: number;
  /** 音量. */
  readonly volume: number;
}

/**
 * Where a cue sounds: `listener` follows the hero (the Demo attaches it to the hero's capsule), `world` stays where
 * it was played (SpawnSoundAtLocation; the hero's position when no point is given), `screen` is 2D (SpawnSound2D:
 * no attenuation, no pan).
 */
export type CueSpace = 'listener' | 'world' | 'screen';

export interface CueDef {
  /** The Demo MetaSound. */
  readonly demo: string;
  /** Concurrency the Demo plays it with (the call site's override when it passes one). */
  readonly group: GroupName;
  readonly space: CueSpace;
  readonly layers: readonly LayerDef[];
  /** The layer whose envelope end fires OnFinished: the whole cue stops there (concurrency lifetime). */
  readonly finishLayer: number;
  /** Mixer gain on the layer sum. */
  readonly gain: number;
  /** Where the values come from. */
  readonly source: string;
}

const layer = (l: Partial<LayerDef> & Pick<LayerDef, 'waves'>): LayerDef => ({
  tempo: 1,
  pitch: 0,
  pitchRandom: 0,
  highpass: 0,
  maxTime: 3,
  delay: 0,
  volume: 1,
  ...l,
});

export const CUES: Readonly<Record<CueName, CueDef>> = {
  block: {
    demo: '音效_基础_格挡', group: 'interval', space: 'world',
    layers: [layer({ waves: ['metalShield'], pitchRandom: 5, maxTime: 2, volume: 0.8 }),
      layer({ waves: ['shield'], tempo: 2, pitchRandom: 5, maxTime: 3, volume: 2 })],
    finishLayer: 1, gain: 1,
    source: '格挡 effect SpawnSoundAttached overrides interval concurrency. Two RandomFloat[-5,5] wires override literal pitches2/5; both trigger immediately. The .1 TriggerDelay output is unconnected. OnFinished is shield patch.',
  },
  arrow: {
    demo: '音效_基础_飞箭', group: 'interval', space: 'world',
    layers: [layer({ waves: ['arrow'], highpass: 500, maxTime: 3, volume: 4 })],
    finishLayer: 0, gain: 1.3,
    source: '飞箭 graph forwards inputs into shared patch: tempo1/pitch0/HPF500/max3/volume4/start0. Arrow activation sourceL24851 SpawnSoundAtLocation volume1.3, interval concurrency override.',
  },
  launch: {
    demo: '音效_基础_启动弹射',
    group: 'many',
    space: 'listener',
    layers: [layer({ waves: ['whoosh1', 'whoosh2', 'whoosh3'], maxTime: 3 })],
    finishLayer: 0,
    gain: 1,
    source: '蓝图_能力 释放开始 L13434 → 函数库_技能 选择声音播放 (SpawnSoundAttached to the capsule, no overrides); graph: Random Get of mWooshLarge1/2/3, Cutoff 0, 最长时间 3',
  },
  bump: {
    demo: '音效_基础_普通撞',
    group: 'default',
    space: 'world',
    layers: [
      layer({ waves: ['punch'], pitch: 2.24, maxTime: 1 }),
      // 音高 = MapRange(Speed, 0..1 → −5..+5): Speed is 1.0 for every knight leg (≤ 3000 uu/s), so +5
      layer({ waves: ['clank'], pitch: 5, maxTime: 1, volume: 0.8 }),
    ],
    finishLayer: 1,
    // the mix × Speed: 1.0 for every knight leg
    gain: 1,
    source: 'BP_ManeActor 弹性处理 L291 (SpawnSoundAtLocation at the bouncer, 音效衰减_默认, 音效并发_默认; Speed = NormalizeToRange(max(当前物理速度, MapRangeClamped(移动当前速度, 3000..6000 → 2000..3000)), 0, 2000))',
  },
  swing: {
    demo: '音效_基础_挥剑',
    group: 'many',
    space: 'world',
    layers: [layer({ waves: ['swing'], tempo: 0.8, pitch: 3, highpass: 500, maxTime: 3, volume: 4 })],
    finishLayer: 0,
    gain: 1,
    source: 'Actor_C01_Attack notify 精灵声音播放 at t = 0 (SpawnSoundAtLocation at the hero, 音效衰减_默认, 音效并发_大量)',
  },
  hit: {
    demo: '音效_基础_砍中肉',
    // The asset lists 音效并发_零点一间隔, but 蓝图_效果_受伤 L1848 spawns it with 音效并发_默认, which overrides it.
    group: 'default',
    space: 'world',
    layers: [
      layer({ waves: ['flesh'], pitchRandom: 5, maxTime: 1, volume: 0.7 }),
      // Trigger Delay 0.1 → RandomFloat → 音高 (overrides the literal +2); Cutoff left at the patch default 500 Hz
      layer({ waves: ['splatter'], tempo: 1.51, pitchRandom: 5, highpass: 500, maxTime: 3, delay: 0.1 }),
    ],
    finishLayer: 0,
    gain: 1,
    source: '蓝图_效果_受伤 L1848 (来自技能.音效[0] of 可控挥击, SpawnSoundAtLocation at the victim, 音效衰减_默认, 音效并发_默认)',
  },
  death: {
    demo: '音效_基础_血浆01',
    group: 'many',
    space: 'world',
    layers: [layer({ waves: ['splat'], maxTime: 1, volume: 0.7 })],
    finishLayer: 0,
    gain: 1,
    source: 'Actor_M02_Die notify 精灵声音播放 at 0.503 s (SpawnSoundAtLocation at the dying actor, 音效衰减_默认, 音效并发_大量)',
  },
  step: {
    demo: '音效_基础_脚步',
    group: 'footstep',
    space: 'world',
    layers: [layer({ waves: ['step'], pitch: 1.0399988, roll: [1, 3], maxTime: 1, volume: 0.35199997 })],
    finishLayer: 0,
    gain: 1,
    source: '粒子_Dust_01 NiagaraDataInterfaceAudioPlayer (SpawnPerUnit ≈ 1 per 100 uu; 音效衰减_默认, 音效并发_脚步)',
  },
  charge: {
    demo: '音效_基础_充能完毕',
    group: 'many',
    space: 'screen',
    layers: [layer({ waves: ['chime'], tempo: 1.0400012, maxTime: 2.0000005 })],
    finishLayer: 0,
    gain: 1,
    source: 'BP_Actor_Card L1864 (SpawnSound2D, 音效并发_大量)',
  },
};

/**
 * 音效_风循环, the hero's 音效_循环 AudioComponent (BP_Actor_Player SCS, attenuation overridden to 音效衰减_默认):
 * Wave Player (loop) at Pitch Shift = 15 × Speed + RandomFloat(−5, 5) semitones (a resample), one-pole low-pass
 * 1000 Hz, × 音量 × Speed with 音量 = 0.4 × Speed. BP_Actor_Player L16938 sets Speed = NormalizeToRange(max(当前物理速度,
 * MapRangeClamped(移动当前速度, 3000..6000 → 2000..3000)), 300, 3000) every tick: 0.6296 at rest and on every knight
 * leg, so the loop never swells.
 */
export const WIND = {
  demo: '音效_风循环',
  wave: 'storm' as WaveId,
  speed: (2000 - 300) / (3000 - 300),
  pitchPerSpeed: 15,
  pitchRandom: 5,
  lowpass: 1000,
  volumePerSpeed: 0.4,
} as const;

/** 音效衰减_默认: AttenuationShapeExtents.X 100 (inner radius), FalloffDistance 1800, linear. */
export const ATTENUATION = { inner: 100, falloff: 1800 } as const;
