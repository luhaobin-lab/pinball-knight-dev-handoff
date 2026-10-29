import { startDebugRouter } from './debug/router';

const canvas = document.querySelector<HTMLCanvasElement>('#view');
if (!canvas) throw new Error('index.html must contain <canvas id="view">');

const query = new URLSearchParams(location.search);
if (query.has('scene')) {
  void startDebugRouter(canvas);
} else {
  // The extracted entry starts one real battle. The archived game's normal entry remains in game/app.ts.
  void import('./battle')
    .then(({ startBattle }) => startBattle(canvas, Number(query.get('seed') ?? 1) || 1))
    .then(() => {
      window.__ready = true;
    })
    .catch((e: unknown) => {
      window.__error = String((e as Error)?.stack ?? e);
      throw e;
    });
}
