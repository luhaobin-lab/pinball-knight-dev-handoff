// One bot worker thread: loads the game factory once, then plays the jobs the pool sends it.
import { parentPort, workerData } from 'node:worker_threads';
import { checkDeterminism, playRun } from '../../src/bot/index.ts';
import { loadFactory } from './games.mjs';

const factory = await loadFactory(workerData.game);

/** Clean runs drop their logs to keep messages small; failures keep everything. */
const slim = record =>
  record.outcome === 'crash' || record.outcome === 'softlock' || record.outcome === 'timeout' || workerData.keepLogs
    ? record
    : { ...record, commandLog: [], times: [], digests: [] };

parentPort.on('message', job => {
  if (job === 'exit') {
    parentPort.close();
    return;
  }
  let result;
  if (job.kind === 'determinism') {
    result = checkDeterminism(factory, job.options);
    if (result.equal) result = { ...result, commandLog: [] };
  } else result = slim(playRun(factory, job.options));
  parentPort.postMessage({ id: job.id, result });
});
parentPort.postMessage({ ready: true });
