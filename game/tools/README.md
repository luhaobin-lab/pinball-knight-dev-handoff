# tools — build, capture, review and measurement scripts

Owner: the integrator. Every tool resolves the checkout from its own location, so it works the same in the main
checkout and in a task worktree (`.codex/worktrees/<id>`), and several runs can go at once: each build goes to
its own folder under `D:/TAPTAPGAME_codex/studio/tmp/builds/<checkout>/`, is served on a free port, and gets its own
Chrome (the installed one, `channel: 'chrome'`, GPU through ANGLE/D3D11 with a SwiftShader fallback; browsers
are never downloaded). Logs go to stderr and the result to stdout. Servers, browsers and temporary frames are
always cleaned up, also on Ctrl+C and when the watchdog fires; Blender and Python run synchronously with a
15-minute limit.

| Command | What it does | Output |
|---|---|---|
| `npm run shots -- --scene a[,b] [--out dir] [--w 1920 --h 1080] [--t 1] [--frames n --interval 0.25] [--query "k=v&..."] [--nobuild] [--timeout 120]` | Builds (or with `--nobuild` reuses the last build), renders each scene at fixed time `--t` (default 1 s) and saves `<scene>.png`, or `<scene>-NN.png` for sequences stepped `--interval` seconds apart. Default `--out`: `D:/TAPTAPGAME_codex/studio/shots/<checkout>/` | JSON array of PNG paths; exit 1 on any page error, console error, shader error or blank frame (canvas luminance std < 2; `--allow-blank` skips that check) |
| `npm run perf -- --scene x [--seconds 5] [--w 1920 --h 1080] [--warmup 1] [--query ...] [--vsync] [--nobuild]` | Runs the scene in real time with the frame-rate limit off (or at vsync with `--vsync`) | JSON: fps, frame ms (mean, p50, p95, p99, max), CPU ms, draw calls, triangles, lights, sizes, GPU |
| `npm run review -- --scene x [--stills t1,t2] [--clip s] ...` | The review pack: stills, an H.264 MP4 and a crisp GIF from one build ([below](#review-pack-toolsreviewmjs)) | `pack.json` (also on stdout); exit 1 if anything failed |
| `npm run package [-- --scene play] [--out dir] [--name file.html] [--check]` | Builds a single JS chunk and inlines it into `delivery/棺材板下.html` (or `<dir>/index.html`), which runs from `file://` ([below](#playable-single-file-build-toolspackagemjs)) | JSON `{ file, bytes, scene }` |
| `npm run golden -- [--golden 02-aim] [--frame shot.png]` (`npm run golden:calibrate`) | Visual regression against `studio/golden/` on style metrics ([below](#visual-regression-toolsgoldenmjs)) | JSON report; exit 0 pass, 1 warn |
| `npm run data:import [-- --check] [-- --dump <dir>]` (`npm run data:check`) | Regenerates `src/content/demo/` from `D:/TAPTAPGAME_codex/reference/dump`; `--check` only verifies that the committed tables match. Owned by the content lane (`tools/data/`, see `src/content/README.md`) | JSON summary |
| `npm run bot -- [--runs 100] [--policy mix] [--seed 1] [--game real\|fake] [--determinism N] [--smoke] ...` | The headless bot: worker threads play whole runs through the game API and report crashes, softlocks, timeouts, determinism mismatches, outcomes and coverage ([below](#headless-bot-toolsbotmjs)) | JSON summary; `report.json`; exit 0 clean, 1 failures or alarms, 2 usage |
| `npm run train -- --stage merge\|train --phase t1\|t2\|t3 [--card id --paths globs] [--dry-run]` | The merge-train gates of WAVE_A §6 in this checkout ([below](#merge-train-toolstrainmjs)) | JSON summary; exit 1 when a blocking step failed |
| `node tools/bp/skeleton.mjs`, `coverage.mjs`, `batches.mjs` | The blueprint porting kit of content-bpkit: skeletons, coverage from a bot coverage JSON, the owner map ([tools/bp/README.md](bp/README.md)) | files / JSON |
| `npm run check` | `tsc` on the whole project, `tsc -p src/core` (no DOM types), `vitest run` (includes `tests/tools-review/`) | |

Extra query parameters reach the scene (`--query "view=normal"`, `--query "fx=demo"`). Use `--out` to keep
variants apart. The capture tools own `scene`, `t`, `capture`, `paused` and `frames`; `review.mjs` and
`golden.mjs` refuse a `--query` that sets them.

## Review pack (`tools/review.mjs`)

```
node tools/review.mjs --scene <name> [--query "k=v"] [--stills t1,t2,...] [--clip <seconds> [--from <t>] [--fps 60]]
                      [--crop x0,y0,x1,y1] [--out <dir>] [--nobuild] [--w 1920 --h 1080] [--gif-mb 12] [--keep-frames] [--timeout 120]
```

Builds once (or reuses the last build with `--nobuild`) and writes into `--out` (default
`D:/TAPTAPGAME_codex/studio/review/<checkout>/<scene>/`):

| File | What |
|---|---|
| `still-<t>.png` | One per `--stills` time: a fresh page load at `?t=<t>` in a `--w`×`--h` viewport, the same pixels as `npm run shots -- --t <t>` |
| `still-<t>-crop.png` | With `--crop`: the same frame cut to exactly `x0,y0,x1,y1` (x1, y1 exclusive, viewport pixels) |
| `clip.mp4` | `--clip` seconds from `--from` at `--fps`: H.264 High profile, 8-bit 4:2:0, tagged BT.709 limited range, CRF "HIGH", one keyframe per second; full resolution |
| `clip.gif` | The same clip on the internal pixel grid: nearest neighbour by the renderer's integer upscale (×2 at 1080p, ×3 with `res=pixel`), one global palette, no dithering, at most `--gif-mb` (default 12 MB) |
| `pack.json` | The commit (`head`, `dirty`), scene, query, viewport, GPU, internal size and upscale, the stills, the clip (crop, block, frames) and every file with its probed properties |

The pack, in short:

```json
{ "scene": "play", "query": "", "viewport": { "width": 1920, "height": 1080 },
  "commit": { "checkout": "tools-review", "head": "…", "dirty": false }, "internal": { "width": 960, "height": 540, "scale": 2 },
  "stills": [{ "t": 1.38, "file": "…/still-1.38.png", "crop": "…/still-1.38-crop.png" }],
  "clip": { "from": 0, "seconds": 4.1, "fps": 60, "frames": 246, "crop": "548,96,1748,966", "block": 2, "mp4": "…", "gif": "…" },
  "files": [{ "kind": "mp4", "file": "…/clip.mp4", "bytes": 3151620, "codec": "avc1", "profile": 100, "chroma": "4:2:0",
              "width": 1200, "height": 870, "frames": 246, "fps": 60, "seconds": 4.1 },
            { "kind": "gif", "file": "…/clip.gif", "width": 600, "height": 435, "frames": 123, "globalColors": 256,
              "localPalettes": 0, "durationMs": 4100, "delayCs": { "min": 3, "max": 4 }, "fps": 30, "scale": 1 }, "…"],
  "errors": [] }
```

How the clip is made:

- **Deterministic stepping.** The page opens at `?t=<from>`; before every further frame the tool calls
  `window.__debug.advance(n / 60)`, `n` whole router steps (`src/debug/router.ts` steps in 1/60 s), with frame
  times rounded cumulatively so the clip never drifts. `--fps` must be at most 60; rates that do not divide 60
  get uneven steps (logged).
- **Frames** are `f00000.png, f00001.png, …` in a temporary folder (`--keep-frames` keeps them in `<out>/frames/`).
  Both encoders read frames in the **numeric** order of the last number in each name, so a `shots` sequence
  (`play-99.png`, `play-100.png`) would also come out right.
- **Crop.** The clip's crop (default: the viewport) is snapped to the internal pixel grid (origin down to a
  multiple of the block, size to whole blocks and even), so H.264's 2×2 chroma blocks and the GIF's samples line
  up with whole internal pixels: `549,96,1749,966` becomes `548,96,1748,966` at ×2. Still crops are not snapped.
- **MP4**: Blender 5.2's bundled FFmpeg (`tools/lib/encode_mp4_blender.py`; the Playwright ffmpeg has no H.264
  encoder), Standard view transform so sRGB values pass unchanged. The tool then reads the file's own boxes and
  fails unless it is `avc1` 4:2:0 with the expected size and frame count.
- **GIF** (`tools/lib/encode_gif.py`): fast-octree palette of 255 colours over all frames, quantized without
  dither; index 255 is transparent and marks pixels unchanged since the previous frame (the film grain flips
  about a sixth of the quantized pixels every frame, so delta rectangles alone save little; this halves the
  file); the palette is passed to Pillow's
  `save()`, which otherwise writes a local colour table for every frame. Delays are rounded cumulatively to
  hundredths of a second (3 or 4 cs at 30 fps), so the GIF lasts exactly as long as the clip. It tries 30, 25,
  20 and 15 fps, then half the grid, until the file fits, decodes the result again and compares every frame
  with what it meant to write, and the tool checks for a single global palette and the right duration.
- **Measured** (this machine, `--scene play --clip 4.1`, 246 frames): about 45 s in total. With the golden crop
  `549,96,1749,966`: MP4 1200×870 3.0 MB, GIF 600×435 at 30 fps 5.6 MB. Full frame: MP4 1920×1080 3.3 MB, GIF
  960×540 at 30 fps 7.9 MB. (The old art-v2 recipe made a 10.6 MB GIF with Floyd–Steinberg noise, 122 local
  palettes and 3 cs delays that played 4.1 s in 3.69 s.)
- **Needs** Blender (`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`, or set `BLENDER`) and Python
  with Pillow and numpy (`python`, or set `PYTHON`), run as `python -I`.

Stills versus clip frames: the grade pass seeds its film grain with the render-frame counter, and `advance()`
presents one extra frame after its steps, so a clip frame and the still at the same time differ by grain only
(mean |Δ| ≈ 0.6 of 255), and impact frames requested for 2 frames show for 1 frame in clips. See the task
report's `needs` for the router change that would make them identical.

The G1 pack, for example:

```
node tools/review.mjs --scene play --stills 1.38,2.58 --clip 4.1 --crop 549,96,1749,966 --out D:/TAPTAPGAME_codex/studio/review/g1
```

## Playable single-file build (`tools/package.mjs`)

```
npm run package -- [--scene <name>] [--out <dir>] [--name <file.html>] [--check]
```

- Builds in `package` mode (one JS chunk) and inlines it, with the CSS, into one HTML file that runs from
  `file://` with no network. Default `delivery/棺材板下.html`; `--out <dir>` writes `<dir>/index.html` for static
  hosting (the review site); `--name` overrides the file name in either case.
- `--scene <name>` (a file in `src/debug/scenes/`) makes the page open that scene whenever its URL names none: an
  inline script in `<head>`, which runs before the module, adds `scene=<name>` with `history.replaceState`
  (falling back to `location.replace` if a browser refuses), keeping any other parameters. So `index.html` opens
  the scene, `index.html?zoom=2` opens it zoomed, and `index.html?scene=cast` still opens `cast`.
- `--check` opens the written file from `file://` in Chrome without a query, waits until the scene has rendered
  and fails on page errors or a different scene.

```
node tools/package.mjs --scene play --out D:/TAPTAPGAME_codex/studio/review/g1/site --check
```

## Visual regression (`tools/golden.mjs`)

```
node tools/golden.mjs [--golden 02-aim[,04-cast]] [--query "k=v"] [--out dir] [--nobuild]   # render the recipes fresh and compare
node tools/golden.mjs --golden 02-aim --frame shot.png [--crop x0,y0,x1,y1]                 # compare an existing PNG
node tools/golden.mjs --calibrate [--out dir] [--nobuild]                                   # re-run the calibration below
```

Compares frames with the golden frames on **style** metrics: tone, palette, saturation by region, pixel density,
outlines and the coarse composition. Each metric passes or warns against a documented threshold; a warning is a
flag for the art critics, not a verdict. Output: `{ verdict, thresholds, results: [{ golden, frame, render, crop,
verdict, warnings, metrics: [{ metric, value, limit, verdict, golden?, frame?, detail? }] }] }`. Exit 0 when
everything passes (or the calibration holds), 1 when anything warns (or a calibration case moved), 2 for usage
errors, 3 when a render or file could not be produced.

`--golden` takes `02`, `02-aim`, `02-aim.png` or a path; without `--frame` it renders the recipe below (all four by
default) in a fresh build, saves the compared image in `--out` (default `D:/TAPTAPGAME_codex/studio/shots/<checkout>/golden/`)
and compares it; `--query` adds parameters to every recipe (for example `res=pixel`). With `--frame`, a full
1920×1080 frame gets the golden's crop unless `--crop` says otherwise; any other size must match the golden.

### The golden frames and how they were rendered

Found by matching the approved frames against fresh renders of the baseline (`main` at the art-p merge):

| Golden | Recipe | Fresh render vs golden |
|---|---|---|
| `01-combat-zoom.png` 1920×1080 | `--scene play --t 1.3 --query "zoom=2&at=11.5,7"` | bit-identical |
| `02-aim.png` 1200×870 | `--scene play --t 1.38`, crop `549,96,1749,966` | grain only (it is frame 83 of the review clip) |
| `03-kill.png` 1200×870 | `--scene play --t 2.58`, crop `549,96,1749,966` | grain only (frame 155 of the clip) |
| `04-cast.png` 1920×1080 | `--scene cast --t 1` | bit-identical |

### Metrics

Everything except the block size is measured on the internal pixel grid (one sample per detected block), so a
frame at another density is still compared like for like. Luma is Rec. 709 weights on the encoded 0–255 values
(as in `shots`); hue and saturation are CIELAB (D65).

| Metric | Value | Threshold (warn beyond) | Catches |
|---|---|---|---|
| `luminance.mean` | Δ mean luma, levels of 255 | \|Δ\| > 4 | exposure drift, glow |
| `luminance.std` | Δ luma standard deviation | \|Δ\| > 4 | contrast changes |
| `luminance.histogram` | earth mover's distance of the 256-bin luma histograms, levels | > 4 | tone-curve and glow drift |
| `hue.histogram` | circular earth mover's distance of the 36-bin hue histograms, each pixel weighted by its chroma, degrees | > 8° | tints, gold grades, palette swaps |
| `saturation.regions` | largest \|log2\| of the mean-chroma ratio (chroma + 1) over the whole image and a 4×3 grid of regions; `detail` lists the ratio per region | > 0.3 (×0.81 … ×1.23) | desaturation or oversaturation anywhere |
| `pixel.block` | the integer block size on both axes: the largest b ≤ 8 that ≥ 75 % of the runs of identical pixels (at most 12 long, not touching the border) are multiples of | must equal the golden's | density changes (`res=pixel`, native HD, blurred or resampled frames) |
| `outline.band` | \|log2\| of the share of pixels lying strictly between their two neighbours along a row or column, at most 0.8× the brighter and at least 1.25× the darker (brighter ≥ 40): the darker-shade rim the outline pass draws along silhouettes | > 0.2 | outlines removed, outlines turned black, missing post |
| `outline.ink` | \|log2\| of the share of black ink: luma ≤ 20 next to a 4-neighbour ≥ 60 | > 0.4 | black (comic) outlines, overlay ink changes |
| `structure.ssim` | mean SSIM (7×7 windows) of the luma box-averaged to 160 columns | < 0.8 | camera, framing or layout changes; big new UI |

### Calibration

`node tools/golden.mjs --calibrate` renders the cases below fresh, builds the variants, saves every image in
`--out` (default `D:/TAPTAPGAME_codex/studio/shots/<checkout>/golden-calibration/`) and checks that each lands where it
should: the fresh renders and the drifting aim must pass; each drift must warn on the metric meant to catch it
(bold: warned). The outline variants are ground truth: the pixels the outline pass darkened are found by comparing
the final render with `?view=lit` (the resolve before post) outside `?view=overlay`, then either filled with
their brightest unoutlined neighbour or turned ink black. Values as measured on 2026-10-22:

| Case | Golden | Must warn on | mean | std | luma EMD | hue EMD | sat | block | band | ink | SSIM |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fresh render of the recipe | 01-combat-zoom | (pass) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 | 0.000 | 0.000 | 1.00 |
| fresh render of the recipe | 02-aim | (pass) | -0.001 | 0.002 | 0.017 | 0.027 | 0.001 | 0 | 0.001 | 0.000 | 1.00 |
| fresh render of the recipe | 03-kill | (pass) | -0.001 | -0.004 | 0.015 | 0.026 | -0.001 | 0 | -0.006 | -0.002 | 1.00 |
| fresh render of the recipe | 04-cast | (pass) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 | 0.000 | 0.000 | 1.00 |
| aim still drifting (t=1.2) | 02-aim | (pass) | -0.105 | -0.472 | 0.228 | 0.617 | 0.045 | 0 | -0.004 | -0.183 | 0.940 |
| `?res=pixel` (640×360, ×3) | 02-aim | block | -0.666 | 0.673 | 0.947 | 1.85 | -0.111 | **+1** | **0.501** | **0.622** | **0.743** |
| `?res=pixel` (640×360, ×3) | 04-cast | block | -0.782 | -0.264 | 0.785 | 2.29 | 0.120 | **+1** | **0.390** | 0.182 | **0.718** |
| `?view=lit` (no outline pass, no grade) | 02-aim | band | -3.75 | 1.63 | 3.96 | 5.62 | -0.121 | 0 | **-0.357** | **0.537** | 0.899 |
| `?view=lit` (no outline pass, no grade) | 04-cast | band | -1.56 | 2.41 | 3.06 | 4.27 | -0.091 | 0 | **-0.539** | **0.892** | 0.987 |
| desaturated 50 % | 02-aim | sat | -0.013 | 0.004 | 0.106 | 5.30 | **-0.915** | 0 | 0.003 | 0.000 | 1.00 |
| desaturated 50 % | 04-cast | sat | -0.068 | 0.025 | 0.242 | 4.87 | **-0.864** | 0 | 0.007 | 0.000 | 1.00 |
| gold grade 30 % | 02-aim | hue, sat | -0.002 | -0.087 | 0.095 | **36.7** | **-0.775** | 0 | 0.001 | 0.006 | 1.00 |
| gold grade 30 % | 04-cast | hue, sat | -0.016 | -0.052 | 0.114 | **40.9** | **-0.796** | 0 | 0.008 | 0.030 | 1.00 |
| desaturated 50 % + gold grade 30 % | 02-aim | hue, sat | -0.015 | -0.046 | 0.134 | **63.0** | **-1.69** | 0 | 0.008 | 0.001 | 1.00 |
| desaturated 50 % + gold grade 30 % | 04-cast | hue, sat | -0.049 | -0.008 | 0.152 | **78.6** | **-1.71** | 0 | 0.009 | 0.002 | 1.00 |
| screen-wide glow 30 % | 02-aim | mean, luma EMD | **12.7** | **4.29** | **12.7** | 3.16 | **0.323** | 0 | -0.192 | **-4.88** | 0.959 |
| screen-wide glow 30 % | 04-cast | mean, luma EMD | **13.2** | **5.89** | **13.2** | 3.10 | 0.266 | 0 | -0.155 | **-3.74** | 0.958 |
| black outlines (comic style) | 02-aim | band, ink | -1.31 | -0.253 | 1.31 | 3.20 | -0.137 | 0 | **-0.252** | **0.910** | 0.979 |
| black outlines (comic style) | 04-cast | band, ink | -0.656 | -0.130 | 0.657 | 2.21 | -0.055 | 0 | **-0.511** | **1.13** | 0.994 |
| outlines removed | 02-aim | band | 1.06 | 1.88 | 1.06 | 0.993 | -0.033 | 0 | **-0.336** | 0.033 | 0.988 |
| outlines removed | 04-cast | band | 0.498 | 0.873 | 0.498 | 0.320 | 0.004 | 0 | **-0.618** | -0.009 | 0.996 |
| re-pixelated to 3 px blocks | 02-aim | block | -0.041 | 0.163 | 0.195 | 0.586 | 0.019 | **+1** | **0.323** | 0.279 | 0.934 |

Margins: the worst passing case uses 3 % (mean), 12 % (std), 6 % (luma EMD), 8 % (hue), 15 % (saturation),
3 % (band), 46 % (ink) and 30 % (1 − SSIM) of its threshold. While exploring, milder drifts also warned
(desaturated 25 %: saturation -0.40; gold grade 15 %: hue 16°; gold 10 %: hue 10°; glow 10 %: mean +4.2), and two
legitimate content changes warned only on structure: the `play` room with `seed=2` (SSIM 0.74) and `03-kill`
compared with `02-aim` (0.74).

Limits worth knowing:

- `outline.ink` counts black ink, which in the play room is almost all the overlay's (chevron and pip outlines),
  so it does not see the coloured world outlines vanish; `outline.band` does, in both scenes.
- Structure and per-region saturation also move when big new UI covers part of the frame (the HUD over
  `01-combat-zoom`): read `detail` and look at the frame before treating that as drift.
- Thresholds live in `THRESHOLDS` (`tools/lib/style.ts`) and are pinned by `tests/tools-review/style.test.ts`.
  Change them only together with this table: run `--calibrate`, update the numbers, and keep every row green.

## Headless bot (`tools/bot.mjs`)

Owner: tools-bot (delegated for wave A). ARCHITECTURE §10.

```
npm run bot -- [--runs 100] [--policy random|scripted|mix|replay] [--seed 1] [--workers 18] [--game real|fake]
               [--hero 幽冥骑士] [--filter ported|all] [--floors N] [--force-items a,b] [--force-talents a,b]
               [--force-enemies a,b] [--max-sim 7200] [--max-commands 20000] [--strict] [--determinism N]
               [--coverage] [--out dir] [--compare prev-report.json] [--replay file] [--run-timeout 120]
               [--keep-logs] [--smoke]
```

Run *i* uses seed `--seed + i`. Each worker thread loads the game once (`--game real`: `createGame` of
`src/core/api/game.ts` with the registry of `src/content/bp/index.ts`; `--game fake`: `tools/bot/fake-game.mjs`)
and plays one run per job: `runUntilInput()`, the policy picks from `legal()`, `send`, until the run ends (the
run-end screen or modal, or `runUntilInput() === 'ended'`), crashes, softlocks or runs out of budget. Every run starts
with `debug.skipPrologue`; `--hero`, `--floors` and `--force-*` go to `GameOptions.debug`.

| Option | What |
|---|---|
| `--policy` | `random`: weighted over `legal()` (`RANDOM_WEIGHTS` in `src/bot/policies.ts`; quit 0, abandon tiny), whole-degree aims; `scripted`: hooks per screen and modal, best of 360 aims by preview score (skeleton, completed by game-g2); `mix` (default): scripted on even runs, random on odd; `replay`: sends `--replay`'s log |
| `--replay file` | A JSON command array, or a `report.json`: replays the error of `--seed` (or its first error) with that seed |
| `--determinism N` | Seeds `--seed … +N−1`: each played twice through `runUntilInput` and once replayed in `advance(1/60)` steps to the recorded decision times; all digests after every command and at the end must match |
| `--smoke` | One game in the main thread: runs it until input and checks it rests on `title` with title commands and a still digest (the T1 gate) |
| `--compare prev.json` | Adds the train alarms (any crash or softlock, determinism mismatch, a coverage drop, win rate or mean floors moving more than 15 %) |
| `--max-sim`, `--max-commands`, `--run-timeout` | Per-run budgets: sim seconds and commands give `timeout`; the wall-clock limit terminates the worker (a game stuck inside one call) and reports `timeout` |
| `--coverage` | Also writes `coverage.json` (classes hit, stubs hit, unported facade calls with counts, from `game.coverage`) |
| `--keep-logs` | Keeps the command logs of clean runs too (only failures keep them by default) |

Detection (`src/bot/runner.ts`, `LIMITS`): **crash**: an exception out of `createGame`, `legal`, `send`,
`runUntilInput` or `digest`; **softlock**: no legal command and nothing scheduled, 50 consecutive accepted commands
with an unchanged digest, more than 300 launches in one room, a phase (screen, phase, modal kind) unchanged for 600 sim
seconds, or 200 consecutive rejected commands; **timeout**: a budget spent; **determinism**: see above.

`report.json` (default `D:/TAPTAPGAME_codex/studio/logs/bot/<checkout>/<time>/`) is ARCHITECTURE §10.3's `{ runs, policy,
seed, crashes, softlocks, timeouts, victories, deaths, demoCompleted, winRate, floors, turns, simMinutes, estMinutes,
damagePerTurn, hpLossPerCombat, goldEarned, itemsHeld, talentsTaken, coverage, errors: [{ seed, kind, message, stack,
commandLog }], digest }` plus `commands`, `byPolicy`, `determinism`, `seconds` and `alarms`. `estMinutes` adds the
modelled think time per command kind (`THINK_SECONDS`). A victory is a run-end modal with `demoComplete`.

`src/bot/**` (policies, runner, detection, metrics) is pure, erasable TypeScript that imports only its own modules
and `src/core/api` types, so the browser shell can run the same policies (`?scene=game-loop&bot=scripted`);
`tests/tools-bot/purity.test.ts` checks it. The view numbers the report reads (floor, HP, gold, items, talents) are
looked up in `src/bot/sample.ts` under their likely names until the real views pin them.

The fake game (`tools/bot/fake-game.mjs`) implements the API with menus, a map of three cells per floor, rooms that
end after a few launches, loot, level-up picks, the pause warning and a run end, plus three deliberate faults:
seed 13 crashes on entering a floor-2 room, seed 7 softlocks in the first floor-2 room, seed 21 is nondeterministic.
Clean fake gates use `--seed 1000`.

## Merge train (`tools/train.mjs`)

Owner: tools-bot (delegated for wave A). WAVE_A §6.3–§6.4.

```
node tools/train.mjs --stage merge|train --phase t1|t2|t3 [--card <id> --paths "glob,glob"] [--base main --candidate HEAD]
                     [--compare prev-report.json] [--screens title,map,...] [--skip step,step] [--out dir] [--dry-run]
```

| Stage / phase | Steps (blocking unless marked) |
|---|---|
| `merge`, every phase | `check`, `data-check`, `ownership` (with `--card`: `git diff --name-only -z <base>...<candidate>` against `--paths` plus `tests/<card>/**` and `src/debug/scenes/<card>.ts`; candidate defaults to HEAD, NUL-delimited paths preserve Chinese names regardless of Git quotePath) |
| `merge --phase t1` | `bot-fake` (1000 fake runs from seed 1000, must be clean), `bot-smoke` (the real `createGame` to the title) |
| `merge --phase t2` | `bot-runs` (200 random runs, `--filter ported`) and `bot-determinism` (10 seeds), **warn only** |
| `merge --phase t3` | 200 mix-policy runs and 20 determinism seeds, blocking |
| `train` | the merge steps, then (t3) `bot-1000` with `--coverage` and `--compare`, `build`, `shots-<screen>` of `game-loop` with `bot=scripted&seed=3&stop=<screen>`, `perf` (10 s), `golden` (warn) |

Bot reports and shots go under `--out` (default `D:/TAPTAPGAME_codex/studio/logs/train/<checkout>/<stage>-<phase>-<time>/`).
`--skip` drops steps that do not apply yet (`--skip shots-boss,perf` before the screens exist). The summary lists
each step with its status (`pass`, `fail`, `warn`), seconds and the last 30 lines of a failed step's output.

`build` validates the ordinary `dist/` build. The first selected screenshot also makes a fresh capture-harness
build; subsequent screenshots and perf use `--nobuild` to reuse it. Skipping the first screenshot moves the fresh
build to the next selected screenshot. If every screenshot is skipped, perf builds for itself.

The historical t1/t2 warning policy remains available for diagnosis. A successful train exit with warning-only
bot failures does **not** authorize promotion under `studio/CODEX_WORKFLOW.md`; the coordinator's review ledger
still blocks crashes, softlocks, determinism failures and missing claimed behaviour. G2 requires the full t3 train
and its browser, coverage and producer review evidence. Determinism-only bot failures exit 1 even with zero normal runs.

`tools/bp/coverage.mjs` recognizes both `static readonly path = ...` and typed declarations such as
`static override readonly path: AssetPath = ...`. Content classes count only when a batch imports their module;
core base classes register themselves. A declared class is not evidence that a real bot run reached it.
The real `Game.coverage.classesHit` map counts actual spawns. Bot reports retain `classesHit` as the number of
distinct reached classes and `classes` as their names, with `classCounts` preserving the per-class spawn counts.
The blueprint coverage tool reads those counts and also accepts historical reports that only contain class names.

## Library (`tools/lib/`)

| Module | What |
|---|---|
| `harness.mjs` | Build, serve, Chrome, page watching, `openScene`, `sceneUrl`, `checkExtraQuery`, `runTool` (cleanup and watchdog) |
| `image.ts` | RGBA images, rectangles and a dependency-free PNG codec (Compression Streams, so it runs in Node, vitest and browsers) |
| `grid.ts` | Detects the internal pixel grid (block size and phase per axis) and samples or redraws it |
| `style.ts` | The style statistics, the comparison and `THRESHOLDS` |
| `variants.ts` | The deliberate drifts of the calibration (desaturate, gold grade, glow, re-pixelate, outline variants) |
| `pack.ts` | Review-pack helpers: still times, the clip's step schedule, the clip crop, numeric frame order |
| `media.ts` | Probes that read MP4 (codec, profile, chroma format, size, frames, rate) and GIF (size, frames, palettes, timing) |
| `encode_mp4_blender.py`, `encode_gif.py` | The encoders `review.mjs` runs |

The `.ts` modules are imported by the `.mjs` tools through Node's type stripping, never bundled: erasable
TypeScript only, no packages, sibling imports with the `.ts` extension (`tests/tools-review/node-runnable.test.ts`
checks this). Their unit tests are in `tests/tools-review/`, including the regression metrics on the real golden
frames.
