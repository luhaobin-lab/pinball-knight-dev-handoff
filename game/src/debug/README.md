# src/debug — debug router and scenes

- **Owner**: the integrator (`router.ts`, `types.ts`). Every lane may add scenes as `scenes/<lane>-<what>.ts`,
  for example `scenes/p1-hero-curl.ts`. Reference scenes: `hello` (lit crypt) and `contract` (one custom pass
  per render stage).
- **URL**: `index.html?scene=<name>&seed=<n or text>&t=<seconds>&frames=<n>&paused=<0|1>&view=<view>&stats=1`
  - `scene` (default `hello`): a file name in `scenes/`; unknown names fail and list the scenes.
  - `seed` (default 1): integer or text, normalized to uint32; the scene gets `ctx.seed` and `ctx.rng`.
  - `t`: fixed-time mode. The scene is stepped deterministically in 1/60 s steps (update and render each step)
    up to `t` seconds, then paused unless `paused=0`.
  - `frames` (default 1 with `t`, 3 without): frames rendered before `window.__ready` turns true.
  - `paused`: freeze time (default on in fixed-time mode); a paused page renders only on demand.
  - `view`: a renderer debug view (`normal`, `light`, `depth`, ...; see `src/render/README.md`).
  - `stats=1`: fps, CPU time, draw calls, triangles, lights.
  - Any other parameter reaches the scene through `ctx.params` (`pan=1`, `orbit=1` and `fx=demo` in `hello`).
- **Tool contract**: `window.__ready` (true once the requested frames are rendered), `window.__error` (the first
  failure, including shader compile errors, with the offending GLSL lines), `window.__scenes`, and
  `window.__debug` with `advance(seconds)` (deterministic steps, then `__ready` again), `stats()` (draw calls,
  triangles, lights, sizes, GPU) and `cpuMs` (last update + render). `renderer.validate()` problems are printed
  as console warnings after setup.
- **Scene module**:

```ts
import { defineScene } from '../types';

export default defineScene({
  name: 'p1-hero-curl', // must equal the file name
  setup(ctx) {
    // build into ctx.scene, configure ctx.renderer, draw randomness from ctx.rng
  },
  update(ctx, dt) {
    // dt is game time: 0 while paused or during hitstop
  },
});
```
