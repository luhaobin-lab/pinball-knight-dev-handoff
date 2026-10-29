/**
 * A minimal WebAudio stand-in for Node tests: every factory and scheduling call is recorded in `calls` (with the
 * node or param it was made on), every created node in `nodes` with its connections, so tests can see what the
 * engine built without a browser. Only what src/audio/engine.ts uses is implemented.
 */

export interface MockCall {
  readonly op: string;
  readonly args: readonly unknown[];
  /** The node or param the call was made on (factory calls have none). */
  readonly target?: object;
}

export class MockParam {
  value: number;
  private readonly log: MockCall[];
  private readonly name: string;
  constructor(log: MockCall[], name: string, value = 0) {
    this.log = log;
    this.name = name;
    this.value = value;
  }
  setValueAtTime(v: number, t: number) {
    this.log.push({ op: `${this.name}.setValueAtTime`, args: [v, t], target: this });
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.log.push({ op: `${this.name}.linearRampToValueAtTime`, args: [v, t], target: this });
    return this;
  }
  setTargetAtTime(v: number, t: number, k: number) {
    this.log.push({ op: `${this.name}.setTargetAtTime`, args: [v, t, k], target: this });
    return this;
  }
  cancelScheduledValues(t: number) {
    this.log.push({ op: `${this.name}.cancelScheduledValues`, args: [t], target: this });
    return this;
  }
}

export class MockNode {
  readonly kind: string;
  /** Nodes this one was connected to, in order. */
  readonly outputs: MockNode[] = [];
  protected readonly log: MockCall[];
  constructor(log: MockCall[], kind: string) {
    this.log = log;
    this.kind = kind;
  }
  connect(target: unknown) {
    this.outputs.push(target as MockNode);
    this.log.push({ op: `${this.kind}.connect`, args: [(target as MockNode).kind], target: this });
    return target;
  }
  disconnect() {
    this.log.push({ op: `${this.kind}.disconnect`, args: [], target: this });
  }
  /** One of the node's params (gain.gain, panner.pan, …). */
  param(name: string): MockParam {
    const p = (this as unknown as Record<string, unknown>)[name];
    if (!(p instanceof MockParam)) throw new Error(`${this.kind} has no param ${name}`);
    return p;
  }
}

class MockSource extends MockNode {
  buffer: MockBuffer | null = null;
  loop = false;
  readonly playbackRate: MockParam;
  onended: (() => void) | null = null;
  constructor(log: MockCall[]) {
    super(log, 'source');
    this.playbackRate = new MockParam(log, 'source.playbackRate', 1);
  }
  start(t = 0) {
    this.log.push({ op: 'source.start', args: [t], target: this });
  }
  stop(t = 0) {
    this.log.push({ op: 'source.stop', args: [t], target: this });
  }
}

class MockBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  readonly data: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  copyToChannel(src: Float32Array, ch: number) {
    this.data[ch].set(src);
  }
}

export interface MockContext {
  readonly calls: MockCall[];
  /** Every node created, in order (sources included). */
  readonly nodes: MockNode[];
  state: 'suspended' | 'running' | 'closed';
  currentTime: number;
  readonly sampleRate: number;
}

/** A mock AudioContext; `state` starts as given and resume() sets `resumeTo`. */
export function mockContext(options: { state?: MockContext['state']; resumeTo?: MockContext['state']; sampleRate?: number } = {}): MockContext & BaseAudioContext {
  const calls: MockCall[] = [];
  const nodes: MockNode[] = [];
  const node = (kind: string, params: Record<string, number> = {}) => {
    const n = new MockNode(calls, kind) as MockNode & Record<string, unknown>;
    for (const [name, value] of Object.entries(params)) n[name] = new MockParam(calls, `${kind}.${name}`, value);
    calls.push({ op: `create.${kind}`, args: [] });
    nodes.push(n);
    return n;
  };
  const ctx = {
    calls,
    nodes,
    state: options.state ?? 'running',
    currentTime: 0,
    sampleRate: options.sampleRate ?? 48000,
    destination: new MockNode(calls, 'destination'),
    createGain: () => node('gain', { gain: 1 }),
    createDynamicsCompressor: () => node('compressor', { threshold: 0, knee: 0, ratio: 1, attack: 0, release: 0 }),
    createWaveShaper: () => Object.assign(node('shaper'), { curve: null, oversample: 'none' }),
    createConvolver: () => Object.assign(node('convolver'), { buffer: null, normalize: true }),
    createStereoPanner: () => node('panner', { pan: 0 }),
    createIIRFilter: (ff: number[], fb: number[]) => {
      calls.push({ op: 'iir', args: [ff, fb] });
      return node('iir');
    },
    createBufferSource: () => {
      calls.push({ op: 'create.source', args: [] });
      const source = new MockSource(calls);
      nodes.push(source);
      return source;
    },
    createBuffer: (ch: number, length: number, rate: number) => new MockBuffer(ch, length, rate),
    resume() {
      calls.push({ op: 'resume', args: [] });
      ctx.state = options.resumeTo ?? 'running';
      return Promise.resolve();
    },
    close() {
      ctx.state = 'closed';
      return Promise.resolve();
    },
  };
  return ctx as unknown as MockContext & BaseAudioContext;
}

/** A manual audio clock for deterministic tests. */
export function manualClock(start = 0): { now: () => number; set: (t: number) => void; advance: (dt: number) => void } {
  let t = start;
  return { now: () => t, set: v => void (t = v), advance: dt => void (t += dt) };
}
