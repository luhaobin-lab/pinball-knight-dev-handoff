// A worker-thread pool for bot jobs. Jobs go one at a time to idle workers; a job that runs longer than the wall-clock
// limit (a game stuck inside runUntilInput or send) terminates its worker, is reported as a timeout and the worker is
// replaced. A worker that dies (out of memory, a crash outside the game) reports its job as a crash.
import { Worker } from 'node:worker_threads';

const WORKER = new URL('./worker.mjs', import.meta.url);

/** Preserve execution failure as incomplete verification, never manufacture a digest mismatch. */
export function failedJobResult(job, kind, message) {
  const options = job.options;
  if (job.kind === 'determinism') return { seed: options.seed, completed: false, equal: false, digests: ['', '', ''], firstDivergence: -1, mode: 'incomplete', commandLog: [], failure: { kind, message } };
  return { seed: options.seed, runIndex: options.runIndex ?? 0, policy: options.policy, outcome: kind, reason: message, ...(kind === 'crash' ? { error: { message } } : {}), victory: false, floors: 0, turns: 0, combats: 0, simSeconds: 0, estSeconds: 0, commands: 0, rejected: 0, hpLost: 0, hpLossPerCombat: null, damagePerTurn: [], gold: null, items: null, talents: null, commandLog: [], times: [], digests: [], digest: '', coverage: null };
}

/**
 * @param {{ game: string, workers: number, runTimeout: number, keepLogs?: boolean, onResult?: (job, result) => void }} o
 * @param {Array<{ kind: 'run' | 'determinism', options: object }>} jobs
 * @returns {Promise<object[]>} results in job order
 */
export function runPool(o, jobs) {
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  const workers = new Set();
  return new Promise((resolve, reject) => {
    if (jobs.length === 0) return resolve(results);
    const finish = (index, result) => {
      results[index] = result;
      o.onResult?.(jobs[index], result);
      if (++done === jobs.length) {
        for (const w of workers) w.terminate();
        resolve(results);
      }
    };
    const failed = (index, kind, message) => failedJobResult(jobs[index], kind, message);
    const spawn = () => {
      const w = new Worker(WORKER, { workerData: { game: o.game, keepLogs: o.keepLogs ?? false } });
      let current = -1;
      let timer = null;
      workers.add(w);
      const give = () => {
        if (next >= jobs.length) {
          w.postMessage('exit');
          return;
        }
        current = next++;
        w.postMessage({ id: current, ...jobs[current] });
        timer = setTimeout(() => {
          const index = current;
          current = -1;
          workers.delete(w);
          w.terminate();
          finish(index, failed(index, 'timeout', `wall-clock limit of ${o.runTimeout} s`));
          if (done < jobs.length && next < jobs.length) spawn();
        }, o.runTimeout * 1000);
      };
      w.on('message', msg => {
        if (msg.ready) return give();
        clearTimeout(timer);
        current = -1;
        finish(msg.id, msg.result);
        give();
      });
      w.on('error', err => {
        clearTimeout(timer);
        workers.delete(w);
        if (current < 0) return reject(err);
        const index = current;
        current = -1;
        finish(index, failed(index, 'crash', `worker died: ${err.message}`));
        if (done < jobs.length && next < jobs.length) spawn();
      });
      w.on('exit', () => {
        clearTimeout(timer);
        workers.delete(w);
      });
    };
    const n = Math.max(1, Math.min(o.workers, jobs.length));
    for (let i = 0; i < n; i++) spawn();
  });
}
