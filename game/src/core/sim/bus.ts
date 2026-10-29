/**
 * The presentation bus (ARCHITECTURE §4.9, §6.4): events stamped with the game time they were emitted at, drained by
 * the shell or the bot. Presentation never feeds back into rules: nothing in the core reads the bus.
 */

export class EventQueue<E extends { readonly t: number }> {
  private queue: E[] = [];
  private readonly now: () => number;
  private total = 0;

  constructor(now: () => number) {
    this.now = now;
  }

  emit(e: DistributiveOmit<E, 't'>): void {
    this.queue.push({ ...e, t: this.now() } as unknown as E);
    this.total++;
  }

  drain(): E[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  /** Events emitted since the world was created (digest and diagnostics; drained or not). */
  get emitted(): number { return this.total; }
}

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
